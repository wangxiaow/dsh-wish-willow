import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { projectSchema } from '../packages/p1/src/state.js';
import { classifyRisk, evaluateGate, validateReport } from '../packages/p1/src/quality-gate.js';
import { qualityFixture } from './helpers/p2-state.mjs';

test('P2 deterministic tiers: only demonstrable docs changes are low; first/function/config are medium; hard triggers are high', () => {
  const classify = fields => classifyRisk({ wish: '本地说明修订', decisions: [], changes: [{ path: 'README.md' }], baseline: true, ...fields });
  assert.equal(classify({}).level, 'low');
  for (const fields of [{ baseline: false }, { changes: [{ path: 'app.js' }] }, { changes: [{ path: 'config.txt' }] },
    { changes: [{ path: 'tests/example.md' }] }, { changes: [] }]) assert.equal(classify(fields).level, 'medium');
  for (const fields of [{ wish: '对外发布并处理个人信息' }, { decisions: [{ risk: 'major', text: '重大行为' }] },
    { commands: ['Remove-Item data -Recurse'] }, { changedText: 'DELETE FROM accounts' }]) assert.equal(classify(fields).level, 'high');
});

test('P2 valid PASS releases exactly once and ordinary mutations cannot bypass the Host state gate', async () => {
  const f = await qualityFixture(); const { attempt } = await f.begin(); const review = await f.complete(attempt);
  const ready = await f.store.recordGate(f.projectId, f.candidate.id);
  assert.equal(ready.releases.length, 0);
  assert.equal(ready.quality.gates.at(-1).verdict, 'ALLOW');
  await assert.rejects(f.store.mutate(f.projectId, 'coder-release-bypass', { kind: 'agent', ref: randomUUID() }, p => {
    p.releases.push({ id: randomUUID(), versionId: f.candidate.binding.versionId, buildId: f.candidate.binding.buildId,
      changeId: f.candidate.binding.changeId, releasedAt: p.updatedAt, sourcePath: p.workspace, snapshotPath: f.candidate.snapshotPath,
      startCommand: f.candidate.startCommand, summary: 'bypass', evidenceIds: f.candidate.evidenceIds, qualityGateId: p.quality.gates.at(-1).id });
  }), { code: 'quality-gate' });
  const released = await f.store.releaseCandidate(f.projectId, f.candidate.id);
  assert.equal(released.releases.length, 1);
  assert.equal(released.versions[0].status, 'Released');
  assert.equal(released.quality.gates.find(g => g.id === released.releases[0].qualityGateId).reviewId, review.id);
  const again = await f.store.releaseCandidate(f.projectId, f.candidate.id);
  assert.deepEqual(again, released, 'idempotent repeat neither duplicates release nor changes revision/history');
  assert.ok(projectSchema.safeParse(again).success);
});

test('P2 FAIL, missing/partial evidence, wrong identity, must-fix issues and incomplete checks cannot PASS', async () => {
  for (const mutation of [
    { status: 'FAIL' },
    { readsChange: reads => reads.filter(r => r.materialId !== 'm2') },
    { readsChange: reads => reads.map(r => r.materialId === 'm0' ? { ...r, end: 0 } : r) },
    { reportChange: r => ({ ...r, binding: { ...r.binding, snapshotHash: 'a'.repeat(64) } }) },
    { reportChange: r => ({ ...r, issues: [{ severity: 'must-fix', description: 'Requirement missing despite exit 0', materialIds: ['m1'] }] }) },
    { reportChange: r => ({ ...r, checks: r.checks.filter(c => c.name !== 'tests') }) },
    { reportChange: r => ({ ...r, checks: r.checks.map(c => c.name === 'tests' ? { ...c, materialIds: ['m4'] } : c) }) },
  ]) {
    const f = await qualityFixture(); const { attempt } = await f.begin(); await f.complete(attempt, mutation);
    const blocked = await f.store.releaseCandidate(f.projectId, f.candidate.id);
    assert.equal(blocked.releases.length, 0);
    assert.notEqual(blocked.quality.gates.at(-1).verdict, 'ALLOW');
    assert.equal(blocked.versions[0].status, 'Built');
  }
});

test('P2 risk escalation adds checks and approvals; Reviewer cannot lower a hard-high floor', async () => {
  const medium = await qualityFixture(); const { attempt } = await medium.begin();
  const raised = await medium.complete(attempt, { reportChange: r => ({ ...r, risk: 'high', riskReasons: ['New privacy finding'] }) });
  assert.throws(() => validateReport(medium.candidate, raised.report, raised.reads), /risk-scope/);
  assert.equal(evaluateGate(medium.store.read(medium.projectId), medium.candidate).verdict, 'REVIEW_INCOMPLETE');
  const high = await qualityFixture({ risk: 'high' }); const next = await high.begin();
  const lowered = await high.complete(next.attempt, { reportChange: r => ({ ...r, risk: 'low' }) });
  assert.throws(() => validateReport(high.candidate, lowered.report, lowered.reads), /risk floor/);
});

test('P2 high risk: no approval, rejection and stale/scope-mismatched approval never release', async () => {
  const f = await qualityFixture({ risk: 'high' }); const { attempt } = await f.begin(); const review = await f.complete(attempt);
  const waiting = await f.store.releaseCandidate(f.projectId, f.candidate.id);
  assert.equal(waiting.status, 'blocked'); assert.equal(waiting.quality.gates.at(-1).verdict, 'AWAITING_APPROVAL');
  for (const fields of [f.approval(review, true, { binding: { ...f.candidate.binding, snapshotHash: 'b'.repeat(64) } }),
    f.approval(review, true, { riskReasons: ['different risk'] }), f.approval(review, true, { scope: 'public-release' }),
    f.approval(review, true, { reviewId: randomUUID() })]) await assert.rejects(f.store.approveCandidate(fields));
  assert.equal(f.store.read(f.projectId).releases.length, 0);
  await f.store.approveCandidate(f.approval(review, false));
  const rejected = await f.store.releaseCandidate(f.projectId, f.candidate.id);
  assert.equal(rejected.quality.gates.at(-1).verdict, 'REJECTED');
  await assert.rejects(f.store.approveCandidate(f.approval(review, true)), { code: 'decision-final' });
  assert.equal(f.store.read(f.projectId).quality.approvals.length, 1);
});

test('P2 current high approval survives reopen and is idempotent/CAS-bound; no coding/review restart', async () => {
  const f = await qualityFixture({ risk: 'high' }); const { attempt } = await f.begin(); const review = await f.complete(attempt);
  await f.store.releaseCandidate(f.projectId, f.candidate.id);
  const pending = f.store.read(f.projectId);
  const reopened = f.reopen(); await reopened.recover();
  assert.deepEqual(reopened.read(f.projectId), pending, 'waiting approval is durable and is not converted into an uncertain coder run');
  const input = f.approval(review);
  const results = await Promise.allSettled([reopened.approveCandidate(input), reopened.approveCandidate({ ...input, requestId: randomUUID() })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  const released = await reopened.releaseCandidate(f.projectId, f.candidate.id);
  const repeated = await reopened.approveCandidate(input);
  assert.deepEqual(repeated, released);
  assert.equal(released.quality.approvals.length, 1); assert.equal(released.releases.length, 1);
  assert.deepEqual(released.runs, pending.runs); assert.deepEqual(released.quality.attempts, pending.quality.attempts);
  await assert.rejects(reopened.approveCandidate({ ...input, accepted: false }), { code: 'idempotency-conflict' });
});

test('P2 changed material or contract fails final attestation; original PASS remains recorded, not silently overwritten', async () => {
  const f = await qualityFixture({ verify: async () => { throw Error('snapshot hash mismatch'); } });
  const { attempt } = await f.begin(); const review = await f.complete(attempt);
  const stopped = await f.store.releaseCandidate(f.projectId, f.candidate.id);
  assert.equal(stopped.releases.length, 0); assert.match(stopped.quality.gates.at(-1).reason, /snapshot hash mismatch/);
  assert.equal(stopped.quality.reviews[0].status, 'PASS'); assert.equal(stopped.quality.reviews[0].id, review.id);
  await f.store.mutate(f.projectId, 'changed-contract-fixture', { kind: 'user', ref: randomUUID() }, p => {
    p.constraints.push({ id: randomUUID(), text: 'New user constraint', confirmation: 'confirmed', source: { kind: 'user', ref: 'fixture' } });
  });
  assert.equal(evaluateGate(f.store.read(f.projectId), f.candidate).verdict, 'REVIEW_INCOMPLETE');
  await assert.rejects(f.store.mutate(f.projectId, 'overwrite-review', { kind: 'runtime', ref: 'fixture' }, p => { p.quality.reviews[0].reason = 'erase failure'; }), { code: 'immutable-review' });
});

test('P2 cancellation before/during final attestation blocks Release without rewriting the completed review; explicit resume can reuse it', async () => {
  for (const when of ['before', 'during']) {
    const controller = new AbortController();
    const f = await qualityFixture({ verify: async () => { if (when === 'during') controller.abort(); } });
    const { attempt } = await f.begin(); await f.complete(attempt);
    const original = structuredClone(f.store.read(f.projectId).quality.reviews[0]);
    if (when === 'before') controller.abort();
    const stopped = await f.store.releaseCandidate(f.projectId, f.candidate.id, controller.signal);
    assert.equal(stopped.releases.length, 0); assert.equal(stopped.quality.gates.at(-1).verdict, 'REVIEW_INCOMPLETE');
    assert.match(stopped.quality.gates.at(-1).reason, /显式取消/); assert.deepEqual(stopped.quality.reviews[0], original);
    const resumed = await f.store.releaseCandidate(f.projectId, f.candidate.id);
    assert.equal(resumed.releases.length, 1); assert.equal(resumed.quality.attempts.length, 1);
  }
});

test('P2 interrupted review becomes BLOCKED once; at most one explicit re-review appends both outcomes', async () => {
  const f = await qualityFixture(); const first = await f.begin();
  await f.store.recover();
  const interrupted = f.store.read(f.projectId);
  assert.equal(interrupted.quality.reviews[0].status, 'BLOCKED'); assert.equal(interrupted.quality.reviews[0].sessionId, first.attempt.sessionId);
  await f.store.recover(); assert.deepEqual(f.store.read(f.projectId), interrupted);
  await assert.rejects(f.begin(), { code: 'review-budget' });
  const second = await f.begin(true); await f.complete(second.attempt);
  const delivered = await f.store.releaseCandidate(f.projectId, f.candidate.id);
  assert.equal(delivered.quality.reviews.length, 2); assert.deepEqual(delivered.quality.reviews[0], interrupted.quality.reviews[0]);
  assert.notEqual(delivered.quality.attempts[0].sessionId, delivered.quality.attempts[1].sessionId);
  assert.equal(delivered.releases.length, 1);
  await assert.rejects(f.begin(true), { code: 'review-budget' });
});

test('P2 old Product State and Release parse unchanged with no invented quality data or eager rewrite', async () => {
  const f = await qualityFixture(); const built = f.store.read(f.projectId);
  const old = structuredClone(built); delete old.quality;
  old.artifacts = old.artifacts.filter(a => ['source-snapshot', 'delivery-manifest'].includes(a.kind));
  const releaseId = randomUUID();
  old.releases.push({ id: releaseId, versionId: old.versions[0].id, buildId: old.builds[0].id, changeId: old.changes[0].id,
    releasedAt: old.updatedAt, sourcePath: old.workspace, snapshotPath: f.candidate.snapshotPath, startCommand: 'node app.js', summary: 'P1 historical fixture', evidenceIds: old.evidence.map(e => e.id) });
  old.versions[0].status = 'Released'; old.versions[0].releaseId = releaseId; old.changes[0].status = 'completed'; old.status = 'delivered';
  const bytes = JSON.stringify(old);
  assert.deepEqual(projectSchema.parse(old), old);
  const legacy = await qualityFixture({ record: old }); await legacy.store.recover();
  assert.equal(JSON.stringify(legacy.store.read(old.id)), bytes); assert.equal(legacy.writes(), 0);
  assert.equal(legacy.store.read(old.id).quality, undefined);
});
