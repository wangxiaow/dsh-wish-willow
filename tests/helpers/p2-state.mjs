// In-memory Product State / filesystem-attestation fixtures, NOT execution or model evidence.
import { randomUUID } from 'node:crypto';
import { createEvolutionStore } from '../../packages/p1/src/state.js';
import { contractHash, hashJson, requiredChecks } from '../../packages/p1/src/quality-gate.js';

export async function qualityFixture({ risk = 'medium', verify = async () => {}, record } = {}) {
  const rows = new Map(record ? [[record.id, structuredClone(record)]] : []);
  let chain = Promise.resolve(), writes = 0;
  const table = { get: id => rows.get(id), entries: () => rows.entries(),
    put: async (id, value) => { writes++; rows.set(id, value); },
    update(id, callback) {
      const result = chain.then(() => { const next = callback(rows.get(id)); rows.set(id, next); writes++; return next; });
      chain = result.catch(() => {}); return result;
    } };
  const options = { uuid: randomUUID, now: () => new Date().toISOString(), workspaceFor: id => `C:\\p2-fixture\\projects\\${id}`,
    failure: (code, message) => Object.assign(Error(message), { code }), verifyCandidate: verify };
  const store = createEvolutionStore(table, options);
  if (record) return { store, table, reopen: () => createEvolutionStore(table, options), writes: () => writes };
  const initial = await store.create({ requestId: randomUUID(), title: 'P2 contract fixture', wish: 'Two numbers must be added' });
  const p = await store.submit({ projectId: initial.id, expectedRevision: initial.revision, requestId: randomUUID(), wish: initial.goal });
  const changeId = p.changes[0].id, versionId = p.versions[0].id, runId = randomUUID(), buildId = randomUUID(), candidateId = randomUUID();
  const sourceId = randomUUID(), integrityId = randomUUID(), materialsId = randomUUID();
  const sha = hashJson('FIXTURE ONLY'), root = `C:\\p2-fixture\\deliveries\\${p.id}\\candidates\\${candidateId}\\${versionId}`;
  await store.mutate(p.id, 'fixture-build', { kind: 'runtime', ref: 'fixture-only' }, next => {
    next.runs.push({ id: runId, changeId, sessionId: `fixture-coder-${runId}`, status: 'completed', startedAt: next.createdAt,
      endedAt: next.updatedAt, modelCalls: 0, toolCalls: 0, failures: 0 });
    for (const kind of ['code', 'build', 'test', 'run']) next.evidence.push({ id: randomUUID(), changeId, runId, kind,
      sessionId: next.runs[0].sessionId, callId: `fixture-${kind}`, tool: kind === 'code' ? 'write' : 'pwsh', success: true,
      ...(kind === 'code' ? {} : { exitCode: 0, command: `fixture ${kind}` }), summary: 'SCRIPTED DTO ONLY', recordedAt: next.createdAt });
    next.artifacts.push({ id: sourceId, changeId, versionId, path: `${root}\\source-snapshot.json`, sha256: sha, bytes: 1, kind: 'source-snapshot' },
      { id: integrityId, changeId, versionId, path: `${root}\\delivery-integrity.json`, sha256: sha, bytes: 1, kind: 'delivery-manifest' });
    next.builds.push({ id: buildId, changeId, versionId, status: 'passed', evidenceIds: next.evidence.map(e => e.id), artifactIds: [sourceId, integrityId], createdAt: next.createdAt });
    next.versions[0].status = 'Built'; next.versions[0].buildId = buildId; next.changes[0].status = 'running';
  });
  const built = store.read(p.id);
  const materials = ['requirements', 'source', 'test', 'diff', 'evidence', 'integrity', 'risk'].map((kind, index) => ({ id: `m${index}`, kind,
    path: `fixture:${kind}`, sha256: sha, chars: 1, required: true, verifiable: true }));
  const candidate = { id: candidateId, binding: { candidateId, projectId: p.id, changeId, versionId, buildId, snapshotHash: sha, materialsHash: sha,
    contractHash: contractHash(built, changeId) }, createdAt: p.createdAt, sourceArtifactId: sourceId, integrityArtifactId: integrityId,
    materialsArtifactId: materialsId, evidenceIds: built.evidence.map(e => e.id), snapshotPath: `${root}\\source`, startCommand: 'node app.js',
    summary: 'SCRIPTED FIXTURE ONLY', risk, riskReasons: ['FIXTURE risk'], materials };
  await store.registerCandidate(p.id, candidate, { id: materialsId, changeId, versionId, path: `${root}\\review-materials.json`, sha256: sha, bytes: 1, kind: 'review-materials' });
  const begin = (explicit = false) => store.beginReview(p.id, candidateId, randomUUID(), store.read(p.id).revision, explicit);
  const complete = async (attempt, { status = 'PASS', reportChange = value => value, readsChange = value => value } = {}) => {
    const report = reportChange({ binding: candidate.binding, status, risk, riskReasons: [],
      checks: requiredChecks(risk).map(name => ({ name, status, reason: 'SCRIPTED CHECK ONLY', materialIds: materials.map(m => m.id) })), issues: [], summary: `SCRIPTED ${status}` });
    const review = { id: randomUUID(), attemptId: attempt.id, binding: candidate.binding, sessionId: attempt.sessionId, status, report,
      reads: readsChange(materials.map(m => ({ materialId: m.id, sha256: m.sha256, offset: 0, end: 1, callId: `read-${m.id}` }))),
      reason: report.summary, endedAt: new Date().toISOString(), execution: { persisted: true, endReason: 'completed', steps: 1, toolCalls: 8, failures: 0 } };
    await store.finishReview(p.id, review, { id: randomUUID(), changeId, versionId, path: `${root}\\review-${attempt.id}.json`, sha256: sha, bytes: 1, kind: 'review-report' });
    return review;
  };
  const approval = (review, accepted = true, overrides = {}) => ({ projectId: p.id, candidateId, expectedRevision: store.read(p.id).revision,
    requestId: randomUUID(), reviewId: review.id, binding: candidate.binding, risk, riskReasons: candidate.riskReasons,
    scope: 'local-delivery-only', accepted, ...overrides });
  return { store, table, projectId: p.id, candidate, begin, complete, approval, reopen: () => createEvolutionStore(table, options), writes: () => writes };
}
