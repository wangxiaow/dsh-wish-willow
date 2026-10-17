import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createEvolutionStore, projectSchema, createInput, refInput, wishInput,
  changeDecisions as readChangeDecisions, pendingMajorDecisions as readPendingMajorDecisions, assertUnexecutedPlan as checkUnexecutedPlan } from './state.js';
import { Orchestrator } from './orchestrator.js';
import { bindingSchema, riskSchema, latestReview } from './quality-gate.js';
import { verifyReviewCandidate } from './reviewer.js';

export const name = 'wish-willow-p1';
export const inject = ['storageDomain', 'typertGateway', 'agents', 'agentDefaultModel', 'agentPresets', 'sandboxPolicy', 'sessions', 'sessionQuery'];
export const evolutionDomain = defineDomain({ name: 'wish_willow_p1', version: 1, layout: 'single', tables: { projects: domainTable(projectSchema) } });
const failure = (reason, message, details = {}) => new RemoteError(`wish-willow-p1/${reason}`, message, details);
const decisionState = fn => {
  try { return fn(); } catch (error) { throw failure('unsafe-decision-state', error.message); }
};
const changeDecisions = (...args) => decisionState(() => readChangeDecisions(...args));
const pendingMajorDecisions = (...args) => decisionState(() => readPendingMajorDecisions(...args));
const assertUnexecutedPlan = (...args) => decisionState(() => checkUnexecutedPlan(...args));
const initializers = [];
const uuid = z.uuid();
const retryInput = wishInput.omit({ wish: true }).extend({ changeId: uuid, acknowledgeUncertain: z.boolean().optional() });
const decisionInput = refInput.extend({ decisionId: uuid, expectedRevision: z.number().int().positive(), accepted: z.boolean() });
const revisionInput = decisionInput.omit({ accepted: true }).extend({ requestId: uuid, text: z.string().trim().min(1).max(10000) });
const cancelInput = refInput.extend({ changeId: uuid.optional(), expectedRevision: z.number().int().positive().optional() });
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
    const resumeAction = `resume-approved-plan:${fields.changeId}`;
    const resumed = previous.history.find(h => h.action.startsWith('resume-approved-plan:') && h.source.ref === fields.requestId);
    if (resumed) {
      if (resumed.action !== resumeAction) throw failure('idempotency-conflict', 'Resume request reused for another change');
      return previous;
    }
    if (this.orchestrator.isActive(fields.projectId)) throw failure('busy', 'Wait for current execution to stop');
    const c = previous.changes.find(c => c.id === fields.changeId);
    if (c?.status === 'blocked' && changeDecisions(previous, c.id).length && !previous.builds.some(b => b.changeId === c.id)) {
      const result = await this.store.mutate(previous.id, resumeAction, { kind: 'user', ref: fields.requestId }, p => {
        if (p.changes.at(-1)?.id !== c.id || p.changes.at(-1).status !== 'blocked') throw failure('not-retryable', 'Not the current blocked plan');
        if (pendingMajorDecisions(p, c.id).length) throw failure('decision-required', 'Resolve major decisions first; revise rejected decisions or keep paused/cancel');
        assertUnexecutedPlan(p, c.id);
        p.changes.at(-1).status = 'pending'; p.status = 'running';
      }, fields.expectedRevision);
      this.orchestrator.launch(result.id, c.id); return result;
    }
    if (!c || !['failed', 'uncertain', 'blocked'].includes(c.status)) throw failure('not-retryable', 'Change is not retryable');
    const candidate = previous.quality?.candidates.filter(x => x.binding.changeId === c.id).at(-1);
    if (candidate && c.status === 'blocked' && latestReview(previous, candidate.id)?.status === 'PASS') throw failure('candidate-awaiting-approval', 'Approve/reject or resume the existing candidate; do not restart Coding', {});
    if (c.attempt >= 3) throw failure('retry-budget', 'Three attempts exhausted; submit a revised wish after inspecting results');
    if (c.status === 'uncertain' && !fields.acknowledgeUncertain) throw failure('uncertain', 'Inspect workspace and acknowledge unknown side effects before retrying');
    if (pendingMajorDecisions(previous, c.id).length) throw failure('decision-required', 'Resolve major decisions first');
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
    const previous = this.store.read(fields.projectId), status = fields.accepted ? 'accepted' : 'rejected';
    if (previous.decisions.some(d => d.id === fields.decisionId && d.risk === 'major' && d.status === status)) return previous;
    return this.store.mutate(fields.projectId, 'user-decision', { kind: 'user', ref: fields.decisionId }, p => {
      const c = p.changes.at(-1);
      const d = changeDecisions(p, c?.id).find(d => d.id === fields.decisionId);
      if (!d || c?.status !== 'blocked') throw failure('decision-not-found', 'No current blocked major decision');
      const status = fields.accepted ? 'accepted' : 'rejected';
      if (d.status === status) return;
      if (d.status !== 'proposed') throw failure('decision-final', 'Rejected decisions must be revised, never overwritten');
      d.status = status;
    }, fields.expectedRevision);
  }
  async reviseDecision(input) {
    const fields = revisionInput.parse(input), previous = this.store.read(fields.projectId);
    const repeated = previous.decisions.find(d => d.id === fields.requestId);
    if (repeated) {
      if (repeated.source.kind !== 'user' || repeated.source.ref !== fields.decisionId || repeated.text !== fields.text) throw failure('idempotency-conflict', 'Decision revision request reused');
      return previous;
    }
    if (this.orchestrator.isActive(previous.id)) throw failure('busy', 'Wait for current execution to stop');
    return this.store.mutate(previous.id, 'revise-rejected-decision', { kind: 'user', ref: fields.requestId }, p => {
      const c = p.changes.at(-1);
      const d = pendingMajorDecisions(p, c?.id).find(d => d.id === fields.decisionId && d.status === 'rejected');
      if (!d || c?.status !== 'blocked') throw failure('decision-not-found', 'No current rejected decision to revise');
      assertUnexecutedPlan(p, c.id);
      if (fields.text === d.text.trim()) throw failure('revision-required', 'Describe the modified proposal, not the rejected text');
      p.decisions.push({ id: fields.requestId, text: fields.text, risk: 'major', status: 'proposed', source: { kind: 'user', ref: d.id } });
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
  async cancel(input) {
    const fields = cancelInput.parse(input), p = this.store.read(fields.projectId), c = p.changes.at(-1);
    if (fields.changeId && fields.changeId !== c?.id) throw failure('conflict', 'Current change changed; refresh before canceling');
    if (fields.expectedRevision !== undefined && fields.expectedRevision !== p.revision) throw failure('conflict', 'Product changed; refresh before canceling');
    if (this.orchestrator.isActive(p.id)) { this.orchestrator.cancel(p.id); return p; }
    if (c?.status !== 'blocked' || !changeDecisions(p, c.id).length || p.builds.some(b => b.changeId === c.id)) return p;
    // Preserve the old project-only cancellation API; bound inputs are used by the current UI.
    return this.store.mutate(p.id, 'cancel-blocked-plan', { kind: 'user', ref: c.id }, next => {
      const change = next.changes.find(x => x.id === c.id);
      change.status = 'failed'; change.result = '用户已取消本次计划；决策与任务历史保留，不自动重试。'; next.status = 'failed';
      for (const task of next.tasks.filter(t => t.changeId === c.id && ['pending', 'blocked'].includes(t.status))) {
        task.status = 'failed'; task.result = change.result;
      }
    }, p.revision);
  }
}
for (const method of ['list', 'read', 'create', 'legacy', 'importLegacy', 'submit', 'retry', 'decide', 'reviseDecision', 'cancel', 'approveCandidate', 'reReview', 'resumeCandidate']) {
  Remote(EvolutionService.prototype[method], { kind: 'method', name: method, static: false, private: false, addInitializer: initialize => initializers.push(initialize) });
}

export async function apply(ctx, supplied = {}, onService) {
  // A generated UUID is the only workspace segment accepted from clients; no arbitrary path API.
  const config = { workspaceRoot: path.resolve(supplied.workspaceRoot ?? path.join(process.env.DSH_HOME ?? process.cwd(), 'wish-willow')),
    maxSteps: Number.isInteger(supplied.maxSteps) ? supplied.maxSteps : 60,
    maxRunMs: Number.isInteger(supplied.maxRunMs) ? supplied.maxRunMs : 900000 };
  const domain = await ctx.storageDomain.open(evolutionDomain);
  let orchestrator, service;
  ctx.effect(() => async () => { await service?.closeIntake?.(); await orchestrator?.close(); await domain.close(); }, 'wish-willow-p1: intake, execution then domain teardown');
  const store = createEvolutionStore(domain.table('projects'), { uuid: randomUUID, now: () => new Date().toISOString(),
    workspaceFor: id => path.join(config.workspaceRoot, 'projects', id), failure,
    verifyCandidate: (project, candidate) => verifyReviewCandidate(project, candidate, config.workspaceRoot) });
  await store.recover();
  orchestrator = new Orchestrator(ctx, store, config);
  service = new EvolutionService(ctx, store, orchestrator);
  onService?.(service); // Internal composition hook; apply must not return a Service to Cordis.
}
