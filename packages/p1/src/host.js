import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createEvolutionStore, projectSchema, createInput, refInput, wishInput } from './state.js';
import { Orchestrator } from './orchestrator.js';
import { bindingSchema, riskSchema, latestReview } from './quality-gate.js';
import { verifyReviewCandidate } from './reviewer.js';

export const name = 'wish-willow-p1';
export const inject = ['storageDomain', 'typertGateway', 'agents', 'agentDefaultModel', 'agentPresets', 'sandboxPolicy', 'sessions', 'sessionQuery'];
export const evolutionDomain = defineDomain({ name: 'wish_willow_p1', version: 1, layout: 'single', tables: { projects: domainTable(projectSchema) } });
const failure = (reason, message, details = {}) => new RemoteError(`wish-willow-p1/${reason}`, message, details);
const initializers = [];
const uuid = z.uuid();
const retryInput = wishInput.omit({ wish: true }).extend({ changeId: uuid, acknowledgeUncertain: z.boolean().optional() });
const decisionInput = refInput.extend({ decisionId: uuid, expectedRevision: z.number().int().positive(), accepted: z.boolean() });
const candidateInput = refInput.extend({ candidateId: uuid, expectedRevision: z.number().int().positive(), requestId: uuid });
const approvalInput = candidateInput.extend({ reviewId: uuid, binding: bindingSchema, risk: riskSchema,
  riskReasons: z.array(z.string().min(1).max(10000)).max(50), scope: z.literal('local-delivery-only'), accepted: z.boolean() });

export class EvolutionService extends TypertRemoteService {
  constructor(ctx, store, orchestrator) {
    super(ctx, 'wishWillowP1'); this.store = store; this.orchestrator = orchestrator;
    for (const initialize of initializers) initialize.call(this);
  }
  list() { return this.store.list(); }
  read(input) { return this.store.read(refInput.parse(input).projectId); }
  create(input) { return this.store.create(createInput.parse(input)); }
  legacy() { return this.ctx.get('wishWillow')?.list() ?? []; }
  importLegacy(input) {
    const value = z.strictObject({ productId: uuid, requestId: uuid }).parse(input);
    const row = this.legacy().find(x => x.id === value.productId);
    if (!row) throw failure('not-found', 'P0 source product unavailable');
    return this.store.importLegacy(row, value.requestId);
  }
  async submit(input) {
    const fields = wishInput.parse(input); const p = await this.store.submit(fields);
    const c = p.changes.find(c => c.requestId === fields.requestId);
    this.orchestrator.launch(p.id, c.id); return p;
  }
  async retry(input) {
    const fields = retryInput.parse(input);
    const previous = this.store.read(fields.projectId);
    const repeated = previous.changes.find(c => c.requestId === fields.requestId);
    if (repeated) return previous;
    const c = previous.changes.find(c => c.id === fields.changeId);
    if (!c || !['failed', 'uncertain', 'blocked'].includes(c.status)) throw failure('not-retryable', 'Change is not retryable');
    const candidate = previous.quality?.candidates.filter(x => x.binding.changeId === c.id).at(-1);
    if (candidate && c.status === 'blocked' && latestReview(previous, candidate.id)?.status === 'PASS') throw failure('candidate-awaiting-approval', 'Approve/reject or resume the existing candidate; do not restart Coding', {});
    if (c.attempt >= 3) throw failure('retry-budget', 'Three attempts exhausted; submit a revised wish after inspecting results');
    if (c.status === 'uncertain' && !fields.acknowledgeUncertain) throw failure('uncertain', 'Inspect workspace and acknowledge unknown side effects before retrying');
    if (previous.decisions.some(d => d.risk === 'major' && d.status !== 'accepted')) throw failure('decision-required', 'Resolve major decisions first');
    await this.store.mutate(fields.projectId, 'user-retry-acknowledgement', { kind: 'user', ref: fields.requestId }, p => {
      p.changes.find(x => x.id === c.id).status = 'failed';
      for (const t of p.tasks.filter(t => t.changeId === c.id && ['pending', 'running', 'blocked', 'uncertain'].includes(t.status))) t.status = 'failed';
      p.status = 'failed';
    }, fields.expectedRevision);
    const base = this.store.read(fields.projectId);
    let result = await this.store.submit({ projectId: base.id, expectedRevision: base.revision, requestId: fields.requestId, wish: c.wish });
    const next = result.changes.find(x => x.requestId === fields.requestId);
    result = await this.store.mutate(base.id, 'link-retry', { kind: 'user', ref: fields.requestId }, p => {
      const change = p.changes.find(x => x.id === next.id); change.retryOf = c.id; change.attempt = c.attempt + 1;
    });
    this.orchestrator.launch(base.id, next.id); return result;
  }
  async decide(input) {
    const fields = decisionInput.parse(input);
    return this.store.mutate(fields.projectId, 'user-decision', { kind: 'user', ref: fields.decisionId }, p => {
      const d = p.decisions.find(d => d.id === fields.decisionId && d.risk === 'major' && d.status === 'proposed');
      if (!d) throw failure('decision-not-found', 'No proposed major decision');
      d.status = fields.accepted ? 'accepted' : 'rejected';
    }, fields.expectedRevision);
  }
  async approveCandidate(input) {
    const fields = approvalInput.parse(input);
    await this.store.approveCandidate(fields);
    return this.store.releaseCandidate(fields.projectId, fields.candidateId);
  }
  async reReview(input) {
    const fields = candidateInput.parse(input), previous = this.store.read(fields.projectId);
    const repeated = previous.quality?.attempts.find(a => a.requestId === fields.requestId);
    if (repeated) {
      if (repeated.candidateId !== fields.candidateId) throw failure('idempotency-conflict', 'Review request reused for another candidate');
      return previous;
    }
    if (this.orchestrator.isActive(fields.projectId)) throw failure('review-busy', 'Wait for current execution to end');
    const { project, attempt } = await this.store.beginReview(fields.projectId, fields.candidateId, fields.requestId, fields.expectedRevision, true);
    this.orchestrator.launchReview(fields.projectId, fields.candidateId, attempt);
    return project;
  }
  async resumeCandidate(input) {
    const fields = candidateInput.parse(input), p = this.store.read(fields.projectId);
    const candidate = p.quality?.candidates.find(c => c.id === fields.candidateId);
    if (!candidate) throw failure('candidate-not-found', 'No such persisted candidate');
    if (p.releases.some(r => r.buildId === candidate.binding.buildId)) return p;
    if (this.orchestrator.isActive(p.id)) throw failure('review-busy', 'Candidate execution is active');
    if (p.revision !== fields.expectedRevision) throw failure('conflict', 'Product changed; refresh before resuming');
    // No coding, review or model invocation: repeat the Host checks for this exact stored candidate.
    return this.store.releaseCandidate(p.id, candidate.id);
  }
  cancel(input) { const fields = refInput.parse(input); this.orchestrator.cancel(fields.projectId); return this.store.read(fields.projectId); }
}
for (const method of ['list', 'read', 'create', 'legacy', 'importLegacy', 'submit', 'retry', 'decide', 'cancel', 'approveCandidate', 'reReview', 'resumeCandidate']) {
  Remote(EvolutionService.prototype[method], { kind: 'method', name: method, static: false, private: false, addInitializer: initialize => initializers.push(initialize) });
}

export async function apply(ctx, supplied = {}) {
  // A generated UUID is the only workspace segment accepted from clients; no arbitrary path API.
  const config = { workspaceRoot: path.resolve(supplied.workspaceRoot ?? path.join(process.env.DSH_HOME ?? process.cwd(), 'wish-willow')),
    maxSteps: Number.isInteger(supplied.maxSteps) ? supplied.maxSteps : 60,
    maxRunMs: Number.isInteger(supplied.maxRunMs) ? supplied.maxRunMs : 900000 };
  const domain = await ctx.storageDomain.open(evolutionDomain);
  let orchestrator;
  ctx.effect(() => async () => { await orchestrator?.close(); await domain.close(); }, 'wish-willow-p1: execution then domain teardown');
  const store = createEvolutionStore(domain.table('projects'), { uuid: randomUUID, now: () => new Date().toISOString(),
    workspaceFor: id => path.join(config.workspaceRoot, 'projects', id), failure,
    verifyCandidate: (project, candidate) => verifyReviewCandidate(project, candidate, config.workspaceRoot) });
  await store.recover();
  orchestrator = new Orchestrator(ctx, store, config);
  new EvolutionService(ctx, store, orchestrator);
}
