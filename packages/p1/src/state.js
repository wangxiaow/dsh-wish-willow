import { z } from 'zod';
import { qualitySchema, emptyQuality, assertQualityAssociations, assertCandidateCurrent, evaluateGate, effectiveRisk,
  hashJson, latestReview, sameBinding } from './quality-gate.js';

const id = z.uuid();
const time = z.iso.datetime();
const text = z.string().min(1).max(10000);
const status = z.enum(['pending', 'running', 'completed', 'failed', 'blocked', 'uncertain']);
const source = z.strictObject({ kind: z.enum(['user', 'agent', 'runtime', 'migration']), ref: z.string().min(1).max(200) });
const fact = z.strictObject({ id, text, confirmation: z.enum(['confirmed', 'inferred']), source });
const decision = z.strictObject({ id, text, risk: z.enum(['ordinary', 'major']), status: z.enum(['proposed', 'accepted', 'rejected']), source });
const task = z.strictObject({ id, projectId: id, changeId: id, description: text,
  category: z.enum(['technical', 'experience']), phase: z.enum(['plan', 'code', 'verify', 'deliver']),
  dependencies: z.array(id).max(30), status, runId: id.optional(), result: text.optional(), evidenceIds: z.array(id).max(100) });
const run = z.strictObject({ id, changeId: id, sessionId: z.string().min(1).max(200), status,
  startedAt: time, endedAt: time.optional(), model: z.string().max(200).optional(), provider: z.string().max(200).optional(),
  modelCalls: z.number().int().nonnegative(), toolCalls: z.number().int().nonnegative(), failures: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(), reason: text.optional() });
const evidence = z.strictObject({ id, changeId: id, runId: id, kind: z.enum(['code', 'build', 'test', 'run']),
  sessionId: z.string(), callId: z.string(), tool: z.string(), seq: z.number().int().nonnegative().optional(),
  command: z.string().max(20000).optional(), exitCode: z.number().int().optional(),
  success: z.boolean(), summary: text, recordedAt: time });
const artifact = z.strictObject({ id, changeId: id, versionId: id, path: z.string().min(1).max(2000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().nonnegative(), kind: z.enum(['source-snapshot', 'delivery-manifest', 'review-materials', 'review-report']) });
const build = z.strictObject({ id, changeId: id, versionId: id, status: z.enum(['passed', 'failed']),
  evidenceIds: z.array(id).min(1), artifactIds: z.array(id).min(1), createdAt: time });
const version = z.strictObject({ id, changeId: id, label: z.string().min(1).max(100),
  status: z.enum(['Planned', 'Built', 'Released']), buildId: id.optional(), releaseId: id.optional() });
const release = z.strictObject({ id, versionId: id, buildId: id, changeId: id, releasedAt: time,
  sourcePath: z.string().min(1).max(2000), snapshotPath: z.string().min(1).max(2000),
  startCommand: text, summary: text, evidenceIds: z.array(id).min(1), qualityGateId: id.optional() });
const change = z.strictObject({ id, requestId: id, wish: text, createdAt: time,
  status, versionId: id, attempt: z.number().int().min(1).max(3), retryOf: id.optional(), result: text.optional() });
const audit = z.strictObject({ id, at: time, action: z.string().min(1).max(120), source, revision: z.number().int().positive() });

export const projectSchema = z.strictObject({
  id, schemaVersion: z.literal(1), revision: z.number().int().positive(), title: z.string().trim().min(1).max(120),
  goal: z.string().max(10000), currentWish: z.string().max(10000), createdAt: time, updatedAt: time,
  workspace: z.string().min(1).max(2000), status: z.enum(['draft', 'running', 'blocked', 'failed', 'delivered', 'uncertain']),
  creationRequestId: id, legacy: z.strictObject({ productId: id, revision: z.number().int().positive(), snapshot: z.string().max(20000) }).optional(),
  requirements: z.array(fact).max(300), constraints: z.array(fact).max(300), decisions: z.array(decision).max(300),
  tasks: z.array(task).max(1000), runs: z.array(run).max(300), changes: z.array(change).max(100),
  evidence: z.array(evidence).max(3000), artifacts: z.array(artifact).max(800), builds: z.array(build).max(100),
  versions: z.array(version).max(100), releases: z.array(release).max(100), history: z.array(audit).max(10000),
  quality: qualitySchema.optional(),
}).superRefine((p, ctx) => {
  const fail = message => ctx.addIssue({ code: 'custom', message });
  const all = [p.requirements, p.constraints, p.decisions, p.tasks, p.runs, p.changes, p.evidence, p.artifacts, p.builds, p.versions, p.releases, p.history];
  const ids = [...all.flat(), ...(p.quality ? [p.quality.candidates, p.quality.attempts, p.quality.reviews, p.quality.approvals, p.quality.gates].flat() : [])].map(x => x.id);
  if (new Set(ids).size !== ids.length) fail('Duplicate stable ID');
  const has = (rows, key) => rows.some(x => x.id === key);
  for (const t of p.tasks) {
    if (t.projectId !== p.id || !has(p.changes, t.changeId) || (t.runId && !has(p.runs, t.runId))) fail('Invalid task association');
    if (t.dependencies.some(x => !has(p.tasks, x) || x === t.id)) fail('Invalid task dependency');
    if (t.evidenceIds.some(x => !has(p.evidence, x))) fail('Missing task evidence');
    if (t.status === 'completed' && t.phase !== 'plan' && t.evidenceIds.length === 0) fail('Completion requires execution evidence');
  }
  for (const e of p.evidence) if (!has(p.changes, e.changeId) || !has(p.runs, e.runId)) fail('Invalid evidence association');
  for (const v of p.versions) {
    if (!has(p.changes, v.changeId)) fail('Invalid version association');
    if (v.status !== 'Planned' && !p.builds.some(b => b.id === v.buildId && b.versionId === v.id && b.status === 'passed')) fail('Built version requires passed build');
    if (v.status === 'Released' && !p.releases.some(r => r.id === v.releaseId && r.versionId === v.id && r.buildId === v.buildId)) fail('Released version requires release record');
  }
  for (const b of p.builds) {
    if (!has(p.versions, b.versionId) || b.evidenceIds.some(x => !has(p.evidence, x)) || b.artifactIds.some(x => !has(p.artifacts, x))) fail('Missing build evidence/artifact');
    if (b.status === 'passed') {
      const proof = p.evidence.filter(e => b.evidenceIds.includes(e.id) && e.success && e.exitCode === 0 && e.changeId === b.changeId);
      if (!['build', 'test', 'run'].every(kind => proof.some(e => e.kind === kind))) fail('Passed build requires actual build, test and run exit 0');
    }
  }
  for (const r of p.releases) {
    if (!p.builds.some(b => b.id === r.buildId && b.versionId === r.versionId && b.status === 'passed')) fail('Release requires passed associated build');
    if (r.qualityGateId && !p.quality?.gates.some(g => g.id === r.qualityGateId && g.verdict === 'ALLOW' &&
      p.quality.candidates.some(c => c.id === g.candidateId && c.binding.changeId === r.changeId && c.binding.versionId === r.versionId && c.binding.buildId === r.buildId))) fail('Missing bound release gate');
  }
  try { assertQualityAssociations(p); } catch (error) { fail(error.message); }
});

export const createInput = z.strictObject({ requestId: id, title: z.string().trim().min(1).max(120), wish: text });
export const refInput = z.strictObject({ projectId: id });
export const wishInput = refInput.extend({ requestId: id, expectedRevision: z.number().int().positive(), wish: text });

/** One aggregate per product: mutations are atomic in the existing DSH Domain write queue. */
export function createEvolutionStore(table, { uuid, now, workspaceFor, failure, verifyCandidate }) {
  let creationQueue = Promise.resolve();
  // Private one-use filesystem attestations. Generic mutations cannot manufacture a new Release.
  const releasePermits = new Set();
  const queue = fn => {
    const result = creationQueue.then(fn); creationQueue = result.catch(() => {}); return result;
  };
  const read = projectId => {
    const value = table.get(projectId);
    if (!value) throw failure('not-found', 'Product does not exist', { projectId });
    return structuredClone(value);
  };
  const mutate = async (projectId, action, origin, fn, expectedRevision) => {
    read(projectId);
    const result = await table.update(projectId, current => {
      if (expectedRevision !== undefined && current.revision !== expectedRevision) throw failure('conflict', 'Product changed; refresh before retrying', { expectedRevision, actualRevision: current.revision });
      const next = structuredClone(current);
      fn(next);
      // An idempotent no-op does not produce a new logical revision/history entry.
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      if (JSON.stringify(next.releases.slice(0, current.releases.length)) !== JSON.stringify(current.releases)) throw failure('immutable-release', 'Historical releases are immutable', {});
      for (const key of ['artifacts', 'builds', 'evidence']) {
        if (JSON.stringify(next[key].slice(0, current[key].length)) !== JSON.stringify(current[key])) throw failure('immutable-evidence', 'Historical build/artifact/evidence records are immutable', {});
      }
      for (const key of ['candidates', 'attempts', 'reviews', 'approvals', 'gates']) {
        const old = current.quality?.[key] ?? [];
        if (JSON.stringify((next.quality?.[key] ?? []).slice(0, old.length)) !== JSON.stringify(old)) throw failure('immutable-review', 'Quality history cannot be overwritten or removed', {});
      }
      if (JSON.stringify(next.quality) !== JSON.stringify(current.quality) && origin.kind !== 'runtime' &&
        !(origin.kind === 'user' && action === 'approve-reviewed-candidate' &&
          ['candidates', 'attempts', 'reviews', 'gates'].every(key => JSON.stringify(next.quality?.[key]) === JSON.stringify(current.quality?.[key])))) {
        throw failure('quality-authority', 'Coding Agent cannot write reviews, gates or user approvals', {});
      }
      if ((next.quality?.approvals.length ?? 0) > (current.quality?.approvals.length ?? 0) &&
        !(origin.kind === 'user' && action === 'approve-reviewed-candidate')) throw failure('quality-authority', 'Only an explicit user candidate decision can append approval', {});
      for (const added of next.releases.slice(current.releases.length)) {
        const gate = next.quality?.gates.find(g => g.id === added.qualityGateId);
        const candidate = next.quality?.candidates.find(c => c.id === gate?.candidateId);
        if (!releasePermits.has(added.id) || !candidate || gate.verdict !== 'ALLOW' || !sameBinding(candidate.binding, latestReview(next, candidate.id)?.binding) ||
          evaluateGate(next, candidate).verdict !== 'ALLOW' || added.changeId !== candidate.binding.changeId || added.versionId !== candidate.binding.versionId ||
          added.buildId !== candidate.binding.buildId || added.startCommand !== candidate.startCommand || added.snapshotPath !== candidate.snapshotPath ||
          added.sourcePath !== next.workspace || JSON.stringify(added.evidenceIds) !== JSON.stringify(candidate.evidenceIds)) {
          throw failure('quality-gate', 'Every new Release needs an independent review, Host gate and fresh filesystem attestation', {});
        }
      }
      for (const old of [...current.requirements, ...current.constraints].filter(x => x.confirmation === 'confirmed')) {
        if (![...next.requirements, ...next.constraints].some(x => JSON.stringify(x) === JSON.stringify(old))) throw failure('confirmed-fact', 'Confirmed facts cannot be overwritten', {});
      }
      next.revision++;
      next.updatedAt = now();
      next.history.push({ id: uuid(), at: next.updatedAt, action, source: origin, revision: next.revision });
      return projectSchema.parse(next);
    });
    return structuredClone(result);
  };
  const initial = (projectId, fields, legacy) => {
    const at = now();
    return projectSchema.parse({ id: projectId, schemaVersion: 1, revision: 1, title: fields.title,
      goal: fields.wish, currentWish: fields.wish, createdAt: at, updatedAt: at, workspace: workspaceFor(projectId),
      status: 'draft', creationRequestId: fields.requestId, ...(legacy ? { legacy } : {}),
      requirements: [], constraints: [], decisions: [], tasks: [], runs: [], changes: [], evidence: [],
      artifacts: [], builds: [], versions: [], releases: [], history: [{ id: uuid(), at, action: legacy ? 'import-p0-snapshot' : 'create-product',
        source: { kind: legacy ? 'migration' : 'user', ref: fields.requestId }, revision: 1 }] });
  };
  const gateRecord = (p, candidate, result) => {
    const q = p.quality;
    const old = q.gates.filter(g => g.candidateId === candidate.id).at(-1);
    if (old && old.verdict === result.verdict && old.reviewId === result.reviewId && old.approvalId === result.approvalId && old.reason === result.reason) return old;
    const gate = { id: uuid(), candidateId: candidate.id, at: now(), ...result };
    q.gates.push(gate);
    if (p.changes.at(-1)?.id === candidate.binding.changeId && result.verdict !== 'ALLOW') {
      const change = p.changes.find(c => c.id === candidate.binding.changeId);
      const waiting = result.verdict === 'AWAITING_APPROVAL';
      change.status = waiting ? 'blocked' : 'failed'; change.result = result.reason;
      p.status = waiting ? 'blocked' : 'failed';
      const task = p.tasks.find(t => t.changeId === change.id && t.phase === 'deliver');
      if (task) { task.status = waiting ? 'blocked' : 'failed'; task.result = result.reason; task.evidenceIds = candidate.evidenceIds; }
    }
    return gate;
  };
  const recordGate = (projectId, candidateId, override) => mutate(projectId, 'quality-gate-result', { kind: 'runtime', ref: candidateId }, p => {
    const candidate = p.quality?.candidates.find(c => c.id === candidateId);
    if (!candidate) throw failure('candidate-not-found', 'No such delivery candidate', {});
    gateRecord(p, candidate, override ?? evaluateGate(p, candidate));
  });
  return {
    read, mutate, recordGate,
    registerCandidate(projectId, candidate, materialsArtifact) {
      return mutate(projectId, 'freeze-review-candidate', { kind: 'runtime', ref: candidate.id }, p => {
        p.quality ??= emptyQuality();
        if (p.quality.candidates.some(c => c.id === candidate.id)) throw failure('candidate-conflict', 'Candidate already exists', {});
        p.artifacts.push(materialsArtifact);
        // The build was recorded before Coder completion. Its original record is never edited.
        // The materials artifact is associated with the candidate rather than inserted into that historic build.
        p.quality.candidates.push(candidate);
        assertCandidateCurrent(p, candidate);
      });
    },
    async beginReview(projectId, candidateId, requestId, expectedRevision, explicit = false) {
      let selected;
      const result = await mutate(projectId, 'start-independent-review', { kind: 'runtime', ref: requestId }, p => {
        const q = p.quality, candidate = q?.candidates.find(c => c.id === candidateId);
        if (!candidate) throw failure('candidate-not-found', 'No candidate', {});
        const repeated = q.attempts.find(a => a.requestId === requestId);
        if (repeated) {
          if (repeated.candidateId !== candidateId) throw failure('idempotency-conflict', 'Review request reused for another candidate', {});
          selected = repeated; return;
        }
        assertCandidateCurrent(p, candidate);
        const existing = q.attempts.filter(a => a.candidateId === candidateId);
        if (existing.some(a => !q.reviews.some(r => r.attemptId === a.id))) throw failure('review-busy', 'A review is already active or uncertain', {});
        if (existing.length >= 2 || (existing.length && !explicit)) throw failure('review-budget', 'Only one explicit re-review is permitted; no automatic retry', {});
        if (p.releases.some(r => r.buildId === candidate.binding.buildId)) throw failure('already-released', 'Released candidate cannot be re-reviewed', {});
        selected = { id: uuid(), candidateId, number: existing.length + 1, requestId, sessionId: `wish-review-${uuid()}`, startedAt: now() };
        q.attempts.push(selected);
        const c = p.changes.find(c => c.id === candidate.binding.changeId); c.status = 'running'; p.status = 'running';
        const task = p.tasks.find(t => t.changeId === c.id && t.phase === 'deliver');
        if (task) { task.status = 'running'; task.result = '独立 Reviewer 正在读取本候选源码、测试和执行证据'; }
      }, expectedRevision);
      return { project: result, attempt: selected };
    },
    finishReview(projectId, review, artifact) {
      return mutate(projectId, 'finish-independent-review', { kind: 'runtime', ref: review.attemptId }, p => {
        const q = p.quality, attempt = q?.attempts.find(a => a.id === review.attemptId);
        if (!attempt || attempt.sessionId !== review.sessionId || q.reviews.some(r => r.attemptId === attempt.id)) throw failure('review-conflict', 'Review attempt is invalid or already finalized', {});
        if (artifact) p.artifacts.push(artifact);
        q.reviews.push({ ...review, ...(artifact ? { artifactId: artifact.id } : {}) });
      });
    },
    async approveCandidate(fields) {
      const old = read(fields.projectId).quality?.approvals.find(a => a.requestId === fields.requestId);
      const requestMatches = a => a.candidateId === fields.candidateId && a.reviewId === fields.reviewId && a.accepted === fields.accepted &&
        a.bindingHash === hashJson(fields.binding) && a.riskHash === hashJson({ level: fields.risk, reasons: fields.riskReasons, scope: fields.scope });
      if (old) {
        if (!requestMatches(old)) throw failure('idempotency-conflict', 'Approval request ID reused with different authorization', {});
        return read(fields.projectId);
      }
      return mutate(fields.projectId, 'approve-reviewed-candidate', { kind: 'user', ref: fields.requestId }, p => {
        const q = p.quality, candidate = q?.candidates.find(c => c.id === fields.candidateId), review = latestReview(p, fields.candidateId);
        if (!candidate || review?.id !== fields.reviewId || !sameBinding(candidate.binding, fields.binding)) throw failure('stale-approval', 'Approval does not target the current candidate/review', {});
        const gate = evaluateGate(p, candidate), risk = effectiveRisk(candidate, review);
        if (risk.level !== 'high' || risk.level !== fields.risk || hashJson(risk.reasons) !== hashJson(fields.riskReasons) || fields.scope !== risk.scope) throw failure('approval-scope', 'Risk reasons or operation scope changed', {});
        const prior = q.approvals.find(a => a.candidateId === candidate.id && a.reviewId === review.id);
        if (prior) {
          if (prior.accepted === fields.accepted) return;
          throw failure('decision-final', 'An approval/rejection cannot be overwritten; submit a revised change', {});
        }
        if (gate.verdict !== 'AWAITING_APPROVAL') throw failure('review-required', 'Cannot approve FAIL/BLOCKED/UNVERIFIED or an invalid candidate', {});
        q.approvals.push({ id: uuid(), candidateId: candidate.id, reviewId: review.id, requestId: fields.requestId, at: now(),
          bindingHash: hashJson(candidate.binding), riskHash: risk.hash, scope: risk.scope, accepted: fields.accepted });
      }, fields.expectedRevision);
    },
    async releaseCandidate(projectId, candidateId, signal) {
      const before = read(projectId), candidate = before.quality?.candidates.find(c => c.id === candidateId);
      if (!candidate) throw failure('candidate-not-found', 'No persisted candidate', {});
      if (before.releases.some(r => r.buildId === candidate.binding.buildId)) return before;
      const verdict = evaluateGate(before, candidate);
      const canceled = () => recordGate(projectId, candidateId, { verdict: 'REVIEW_INCOMPLETE', reviewId: latestReview(read(projectId), candidateId)?.id,
        reason: '交付被显式取消；已保存的审查结论保留，需用户选择继续原候选' });
      if (signal?.aborted) return canceled();
      if (verdict.verdict !== 'ALLOW') return recordGate(projectId, candidateId);
      try {
        if (typeof verifyCandidate !== 'function') throw Error('No Host filesystem verifier configured');
        await verifyCandidate(before, candidate);
        signal?.throwIfAborted();
      } catch (error) {
        if (signal?.aborted) return canceled();
        return recordGate(projectId, candidateId, { verdict: 'REVIEW_INCOMPLETE', reviewId: verdict.reviewId,
          reason: `候选/报告/完整性证据重新核验失败：${error.message}`.slice(0, 9000) });
      }
      const releaseId = uuid(); releasePermits.add(releaseId);
      try {
        return await mutate(projectId, 'release-reviewed-candidate', { kind: 'runtime', ref: candidateId }, p => {
          if (p.releases.some(r => r.buildId === candidate.binding.buildId)) return;
          signal?.throwIfAborted();
          const fresh = evaluateGate(p, candidate);
          if (fresh.verdict !== 'ALLOW') throw failure('quality-gate', 'Gate changed before release', {});
          const gate = gateRecord(p, candidate, fresh), b = candidate.binding;
          p.releases.push({ id: releaseId, versionId: b.versionId, buildId: b.buildId, changeId: b.changeId, releasedAt: now(),
            sourcePath: p.workspace, snapshotPath: candidate.snapshotPath, startCommand: candidate.startCommand, summary: candidate.summary,
            evidenceIds: candidate.evidenceIds, qualityGateId: gate.id });
          const version = p.versions.find(v => v.id === b.versionId); version.status = 'Released'; version.releaseId = releaseId;
          const change = p.changes.find(c => c.id === b.changeId); change.status = 'completed'; change.result = candidate.summary; p.status = 'delivered';
          const task = p.tasks.find(t => t.changeId === b.changeId && t.phase === 'deliver');
          if (task) { task.status = 'completed'; task.result = candidate.summary; task.evidenceIds = candidate.evidenceIds; }
        }, before.revision);
      } catch (error) {
        if (signal?.aborted) return canceled();
        throw error;
      } finally { releasePermits.delete(releaseId); }
    },
    list: () => [...table.entries()].map(([, x]) => structuredClone(x)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    create(input) {
      const fields = createInput.parse(input);
      return queue(async () => {
        const existing = [...table.entries()].map(([, x]) => x).find(x => x.creationRequestId === fields.requestId);
        if (existing) {
          if (existing.title !== fields.title || existing.goal !== fields.wish) throw failure('idempotency-conflict', 'Request ID already used with different input', {});
          return structuredClone(existing);
        }
        const record = initial(uuid(), fields);
        if (table.get(record.id)) throw failure('id-collision', 'ID already exists', {});
        await table.put(record.id, record); return structuredClone(record);
      });
    },
    importLegacy(row, requestId) {
      return queue(async () => {
        if (table.get(row.id)) return read(row.id);
        const record = initial(row.id, { requestId: id.parse(requestId), title: row.title, wish: row.wish },
          { productId: row.id, revision: row.revision, snapshot: JSON.stringify(row) });
        await table.put(record.id, record); return structuredClone(record);
      });
    },
    async submit(input) {
      const fields = wishInput.parse(input);
      // Check retry first (including stale expectedRevision after response loss); recheck inside serialized write.
      const existing = read(fields.projectId).changes.find(c => c.requestId === fields.requestId);
      if (existing) {
        if (existing.wish !== fields.wish) throw failure('idempotency-conflict', 'Request ID already used with different wish', {});
        return read(fields.projectId);
      }
      return mutate(fields.projectId, 'submit-wish', { kind: 'user', ref: fields.requestId }, p => {
        if (p.changes.some(c => c.requestId === fields.requestId)) return;
        if (p.changes.some(c => ['pending', 'running', 'blocked', 'uncertain'].includes(c.status))) throw failure('busy', 'Resolve current change before submitting another', {});
        const changeId = uuid(), versionId = uuid();
        p.currentWish = fields.wish; p.status = 'running';
        p.changes.push({ id: changeId, requestId: fields.requestId, wish: fields.wish, createdAt: now(), status: 'pending', versionId, attempt: 1 });
        p.versions.push({ id: versionId, changeId, label: `0.${p.versions.length + 1}.0`, status: 'Planned' });
        p.requirements.push({ id: uuid(), text: fields.wish, confirmation: 'confirmed', source: { kind: 'user', ref: changeId } });
        p.tasks.push({ id: uuid(), projectId: p.id, changeId, description: '理解愿望、保留正式需求并制定执行计划', category: 'experience',
          phase: 'plan', dependencies: [], status: 'pending', evidenceIds: [] });
      }, fields.expectedRevision);
    },
    async recover() {
      for (const [, current] of table.entries()) {
        const incomplete = current.quality?.attempts.filter(a => !current.quality.reviews.some(r => r.attemptId === a.id)) ?? [];
        if (incomplete.length) await mutate(current.id, 'recover-interrupted-review', { kind: 'runtime', ref: 'host-start' }, p => {
          for (const a of incomplete) {
            const candidate = p.quality.candidates.find(c => c.id === a.candidateId);
            const review = { id: uuid(), attemptId: a.id, binding: candidate.binding, sessionId: a.sessionId, status: 'BLOCKED', reads: [],
              reason: 'Host 在独立审查中中断；Session 和候选保留，不自动重审，不能 PASS。', endedAt: now(),
              execution: { persisted: false, endReason: 'host-interrupted', steps: 0, toolCalls: 0, failures: 0 } };
            p.quality.reviews.push(review);
            gateRecord(p, candidate, { verdict: 'REVIEW_INCOMPLETE', reviewId: review.id, reason: review.reason });
          }
        });
        if (!read(current.id).changes.some(c => ['pending', 'running'].includes(c.status))) continue;
        await mutate(current.id, 'recover-interrupted-execution', { kind: 'runtime', ref: 'host-start' }, p => {
          p.status = 'uncertain';
          for (const c of p.changes.filter(c => ['pending', 'running'].includes(c.status))) { c.status = 'uncertain'; c.result = 'Host 已中断。结果待确认；不会自动重复有副作用的执行。请检查工程后显式重试。'; }
          for (const t of p.tasks.filter(t => ['pending', 'running'].includes(t.status))) { t.status = 'uncertain'; t.result = '执行中断，尚无可确认的完成证据。'; }
          for (const r of p.runs.filter(r => r.status === 'running')) { r.status = 'uncertain'; r.reason = 'Host interrupted'; }
        });
      }
    },
  };
}
