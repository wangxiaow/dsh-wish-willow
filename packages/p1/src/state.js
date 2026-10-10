import { z } from 'zod';

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
  sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().nonnegative(), kind: z.enum(['source-snapshot', 'delivery-manifest']) });
const build = z.strictObject({ id, changeId: id, versionId: id, status: z.enum(['passed', 'failed']),
  evidenceIds: z.array(id).min(1), artifactIds: z.array(id).min(1), createdAt: time });
const version = z.strictObject({ id, changeId: id, label: z.string().min(1).max(100),
  status: z.enum(['Planned', 'Built', 'Released']), buildId: id.optional(), releaseId: id.optional() });
const release = z.strictObject({ id, versionId: id, buildId: id, changeId: id, releasedAt: time,
  sourcePath: z.string().min(1).max(2000), snapshotPath: z.string().min(1).max(2000),
  startCommand: text, summary: text, evidenceIds: z.array(id).min(1) });
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
  evidence: z.array(evidence).max(3000), artifacts: z.array(artifact).max(300), builds: z.array(build).max(100),
  versions: z.array(version).max(100), releases: z.array(release).max(100), history: z.array(audit).max(10000),
}).superRefine((p, ctx) => {
  const fail = message => ctx.addIssue({ code: 'custom', message });
  const all = [p.requirements, p.constraints, p.decisions, p.tasks, p.runs, p.changes, p.evidence, p.artifacts, p.builds, p.versions, p.releases, p.history];
  const ids = all.flat().map(x => x.id);
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
  for (const r of p.releases) if (!p.builds.some(b => b.id === r.buildId && b.versionId === r.versionId && b.status === 'passed')) fail('Release requires passed associated build');
});

export const createInput = z.strictObject({ requestId: id, title: z.string().trim().min(1).max(120), wish: text });
export const refInput = z.strictObject({ projectId: id });
export const wishInput = refInput.extend({ requestId: id, expectedRevision: z.number().int().positive(), wish: text });

/** One aggregate per product: mutations are atomic in the existing DSH Domain write queue. */
export function createEvolutionStore(table, { uuid, now, workspaceFor, failure }) {
  let creationQueue = Promise.resolve();
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
  return {
    read, mutate,
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
        if (!current.changes.some(c => ['pending', 'running'].includes(c.status))) continue;
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
