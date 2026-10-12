// SCRIPTED Agent/command DTO tests. No real model or Shell invocation; NOT real Reviewer acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { temporary } from './helpers/temp.mjs';
import { fixtureRunnerBrand } from './helpers/isolation.mjs';
import { p1Runtime, settle } from './helpers/p1-runtime.mjs';
import { readFixtureMaterials, fixtureReport, passingFixtureReview } from './helpers/p2-reviewer.mjs';
import { runReviewer } from '../packages/p1/src/reviewer.js';

const commandDtos = { brand: fixtureRunnerBrand, run: async () => ({ kind: 'foreground', exitCode: 0,
  timedOut: false, aborted: false, stdout: 'SCRIPTED COMMAND DTO ONLY; no subprocess executed', stderr: '' }) };
const good = 'export function sum(a, b) { return a + b; }\nconsole.log(sum(2, 3));\n';
const defective = 'export function sum(a, b) { return a - b; }\nconsole.log(sum(0, 0));\n';
const weakTest = 'import assert from "node:assert/strict"; import { sum } from "./app.mjs"; assert.equal(sum(0, 0), 0);\n';
const plan = async ({ tool }) => {
  await tool('wish_state', {});
  await tool('wish_plan', { requirements: ['任意两个有限数必须相加'], constraints: ['仅本地运行'], decisions: [], tasks: [{ description: '实现加法', category: 'technical' }] });
};
const coding = source => async ({ tool }) => {
  const { workspace } = await tool('wish_state', {});
  await tool('write', { path: 'app.mjs', content: source, workdir: workspace });
  await tool('write', { path: 'app.test.mjs', content: weakTest, workdir: workspace });
  for (const [kind, command] of [['build', 'node --check app.mjs'], ['test', 'node app.test.mjs'], ['run', 'node app.mjs']]) {
    await tool('wish_verify', { kind, command, description: `SCRIPTED ${kind}` });
  }
  await tool('wish_deliver', { startCommand: 'node app.mjs', summary: 'Coder claims addition implemented (claim, not proof).' });
};
async function start(t, { source = good, reviewTurns = [passingFixtureReview], createFailure, truncateReads = false } = {}) {
  const root = await temporary(t);
  const host = await p1Runtime(root, { commandRunner: commandDtos, turns: [plan, coding(source)], reviewTurns });
  t.after(host.close);
  if (createFailure) host.scripted.state.reviewCreateError = createFailure;
  host.scripted.state.truncateReviewReads = truncateReads;
  const created = await host.call('create', { input: { requestId: randomUUID(), title: 'P2 reviewer fixture', wish: '两个数必须相加；仅在本地交付。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: randomUUID(), wish: created.goal } });
  return { root, host, project: await settle(host, created.id) };
}

test('P2 scripted PASS requires real bound material reads and a fresh Reviewer only after Coder disposal', async t => {
  const { host, project } = await start(t);
  assert.equal(project.status, 'delivered'); assert.equal(project.releases.length, 1);
  const candidate = project.quality.candidates[0], review = project.quality.reviews[0];
  assert.equal(review.status, 'PASS'); assert.equal(review.execution.persisted, true); assert.equal(review.execution.endReason, 'completed');
  assert.equal(host.scripted.state.modelDisposed, 1); assert.equal(host.scripted.state.reviewDisposed, 1);
  assert.equal(host.scripted.state.reviewCreateCount, 1); assert.equal(project.runs.length, 1);
  const session = host.scripted.getSession(review.sessionId);
  const creation = host.scripted.state.creations.find(c => c.sessionId === review.sessionId);
  assert.equal(creation.seed, null); assert.equal(creation.meta.parentSession, undefined); assert.equal(creation.coderDisposed, 1);
  assert.equal(creation.meta.cwd, candidate.snapshotPath); assert.notEqual(review.sessionId, project.runs[0].sessionId);
  assert.equal(session.followups.length, 1); assert.ok(session.events.some(e => e.type === 'tool/result'));
  assert.ok(candidate.materials.filter(m => m.required).every(m => review.reads.some(r => r.materialId === m.id && r.end === m.chars)));
  assert.deepEqual(project.history.filter(h => h.action === 'release-reviewed-candidate').length, 1);
  const record = JSON.parse(await readFile(project.artifacts.find(a => a.id === candidate.materialsArtifactId).path, 'utf8'));
  assert.match(record.materials.find(m => m.path === 'candidate:app.mjs').content, /return a \+ b/);
  assert.match(record.materials.find(m => m.path === 'candidate:app.test.mjs').content, /assert\.equal/);
});

test('P2 independent scripted defect detector reads actual source/test and rejects an explicit requirement violation despite all exit-0 DTOs', async t => {
  const independent = async context => {
    const content = await readFixtureMaterials(context);
    const source = context.reviewRequest.materials.find(m => m.path === 'candidate:app.mjs');
    const testFile = context.reviewRequest.materials.find(m => m.path === 'candidate:app.test.mjs');
    assert.match(content.get(source.id), /return a - b/); assert.match(content.get(testFile.id), /sum\(0, 0\)/);
    await context.tool('wish_review_submit', fixtureReport(context.reviewRequest, { status: 'FAIL', summary: '实际源码执行减法；弱测试仅验证 0+0，违反明确加法需求。',
      issues: [{ severity: 'must-fix', description: 'Subtracts instead of adding; exit 0 from the weak test is irrelevant', materialIds: [source.id, testFile.id], location: 'app.mjs:1' }] }));
  };
  const { project } = await start(t, { source: defective, reviewTurns: [independent] });
  assert.ok(project.evidence.filter(e => ['build', 'test', 'run'].includes(e.kind)).every(e => e.success && e.exitCode === 0));
  assert.equal(project.quality.reviews[0].status, 'FAIL'); assert.equal(project.quality.gates.at(-1).verdict, 'NEEDS_CHANGES');
  assert.equal(project.releases.length, 0); assert.equal(project.versions[0].status, 'Built');
});

test('P2 missing material reads, stale report binding and malformed submissions fail closed', async t => {
  for (const reviewer of [
    async c => { const missing = c.reviewRequest.materials.find(m => m.kind === 'test').id; await readFixtureMaterials(c, { skip: [missing] }); await c.tool('wish_review_submit', fixtureReport(c.reviewRequest)).catch(() => {}); },
    async c => { await readFixtureMaterials(c); const report = fixtureReport(c.reviewRequest); report.binding.snapshotHash = 'a'.repeat(64); await c.tool('wish_review_submit', report).catch(() => {}); },
    async c => { await c.tool('wish_review_submit', { status: 'PASS', invented: true }).catch(() => {}); },
    async () => {},
  ]) {
    const { project } = await start(t, { reviewTurns: [reviewer] });
    assert.equal(project.releases.length, 0); assert.equal(project.quality.reviews[0].status, 'UNVERIFIED');
    assert.equal(project.quality.gates.at(-1).verdict, 'REVIEW_INCOMPLETE');
  }
  const truncated = await start(t, { truncateReads: true });
  assert.notEqual(truncated.project.quality.reviews[0].status, 'PASS', 'full returned value cannot conceal a truncated model-visible body');
  assert.equal(truncated.project.quality.reviews[0].reads.length, 0); assert.equal(truncated.project.releases.length, 0);
});

test('P2 Reviewer write, Shell, network, other-agent, approval, release and out-of-packet reads are tool-denied', async t => {
  const denied = [];
  const adversary = async c => {
    for (const [name, args] of [
      ['write', { path: 'app.mjs', content: 'tamper' }], ['edit', { file_path: 'app.mjs', old_string: '+', new_string: '-' }],
      ['pwsh', { command: 'echo forbidden' }], ['subagent', { prompt: 'delegate' }], ['web_fetch', { url: 'https://example.com' }],
      ['approveCandidate', {}], ['wish_deliver', {}], ['read', { materialId: '../../private' }], ['read', { file_path: 'outside.txt' }],
      ['read', { materialId: 'm0', sandbox_permissions: 'danger-full-access' }],
    ]) {
      await c.tool(name, args).then(() => denied.push(false), () => denied.push(true));
    }
    await readFixtureMaterials(c);
    await c.tool('wish_review_submit', fixtureReport(c.reviewRequest));
  };
  const { project } = await start(t, { reviewTurns: [adversary] });
  assert.deepEqual(denied, Array(10).fill(true)); assert.equal(project.releases.length, 0);
  assert.notEqual(project.quality.reviews[0].status, 'PASS');
  assert.equal(await readFile(path.join(project.quality.candidates[0].snapshotPath, 'app.mjs'), 'utf8'), good);
});

test('P2 model creation/error/cancel/step exhaustion have one recorded non-PASS outcome and no automatic retries', async t => {
  const cases = [
    { createFailure: 'SCRIPTED model unavailable' },
    { reviewTurns: [] }, // absent Reviewer fixture must never synthesize an implicit PASS
    { reviewTurns: [async () => { throw Error('SCRIPTED model error'); }] },
    { reviewTurns: [async c => { c.agent.cancel({ kind: 'user' }); }] },
    { reviewTurns: [async c => { for (let step = 2; step <= 21; step++) await c.requestStep(step); }] },
  ];
  for (const options of cases) {
    const { project, host } = await start(t, options);
    assert.equal(project.releases.length, 0); assert.equal(project.quality.attempts.length, 1);
    assert.equal(project.quality.reviews.length, 1); assert.equal(project.quality.reviews[0].status, 'BLOCKED');
    assert.equal(host.scripted.state.modelCreateCount, 1);
  }
});

test('P2 explicit one-time re-review retains prior failure and does not recode; changed snapshot cannot use stale PASS', async t => {
  const first = async c => { await readFixtureMaterials(c); await c.tool('wish_review_submit', fixtureReport(c.reviewRequest, { status: 'UNVERIFIED' })); };
  const { project, host } = await start(t, { reviewTurns: [first, passingFixtureReview] });
  const original = structuredClone(project.quality.reviews[0]), candidate = project.quality.candidates[0];
  const request = { projectId: project.id, candidateId: candidate.id, expectedRevision: project.revision, requestId: randomUUID() };
  await host.call('reReview', { input: request }); const delivered = await settle(host, project.id);
  assert.equal(delivered.releases.length, 1); assert.equal(delivered.quality.reviews.length, 2); assert.deepEqual(delivered.quality.reviews[0], original);
  assert.equal(host.scripted.state.modelCreateCount, 1); assert.equal(host.scripted.state.reviewCreateCount, 2);
  await host.call('reReview', { input: request }); assert.equal(host.scripted.state.reviewCreateCount, 2);
  await assert.rejects(host.call('reReview', { input: { ...request, requestId: randomUUID(), expectedRevision: delivered.revision } }));

  const highReview = async c => { await readFixtureMaterials(c); await c.tool('wish_review_submit', fixtureReport(c.reviewRequest, { risk: 'high' })); };
  const other = await start(t, { reviewTurns: [highReview] }); const waiting = other.project, bound = waiting.quality.candidates[0], report = waiting.quality.reviews[0];
  await writeFile(path.join(bound.snapshotPath, 'app.mjs'), 'export const tampered = true;\n'); // owned fixture only; deliberate hash tamper
  const result = await other.host.call('approveCandidate', { input: { projectId: waiting.id, candidateId: bound.id, expectedRevision: waiting.revision,
    requestId: randomUUID(), reviewId: report.id, binding: bound.binding, risk: 'high', riskReasons: [...bound.riskReasons, ...report.report.riskReasons],
    scope: 'local-delivery-only', accepted: true } });
  assert.equal(result.releases.length, 0); assert.equal(result.quality.reviews[0].status, 'PASS');
  assert.equal(result.quality.gates.at(-1).verdict, 'REVIEW_INCOMPLETE');
});

test('P2 high pending candidate survives a real storage reopen; explicit bound approval releases without recoding/review', async t => {
  const high = async c => { await readFixtureMaterials(c); await c.tool('wish_review_submit', fixtureReport(c.reviewRequest, { risk: 'high' })); };
  const first = await start(t, { reviewTurns: [high] });
  const waiting = first.project, candidate = waiting.quality.candidates[0], review = waiting.quality.reviews[0];
  assert.equal(waiting.status, 'blocked'); assert.equal(waiting.releases.length, 0);
  await first.host.close();
  const medium = path.join(first.root, 'wish_willow_p1.json'), before = await readFile(medium, 'utf8');
  const second = await p1Runtime(first.root); t.after(second.close);
  assert.equal(await readFile(medium, 'utf8'), before, 'opening a pending approval does not eagerly rewrite media');
  const reopened = await second.call('read', { input: { projectId: waiting.id } });
  assert.deepEqual(reopened.quality, waiting.quality); assert.deepEqual(reopened.runs, waiting.runs);
  const request = { projectId: waiting.id, candidateId: candidate.id, expectedRevision: reopened.revision, requestId: randomUUID(),
    reviewId: review.id, binding: candidate.binding, risk: 'high', riskReasons: [...candidate.riskReasons, ...review.report.riskReasons], scope: 'local-delivery-only', accepted: true };
  const released = await second.call('approveCandidate', { input: request });
  assert.equal(released.releases.length, 1); assert.equal(released.status, 'delivered');
  assert.equal(second.scripted.state.modelCreateCount, 0); assert.equal(second.scripted.state.reviewCreateCount, 0);
  const repeated = await second.call('approveCandidate', { input: request }); assert.deepEqual(repeated, released);
});

test('P2 time budget cancels/drains a scripted Reviewer and leaves an explicit BLOCKED result', async t => {
  const waitingForAbort = async ({ signal }) => { if (!signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); };
  const { project, host } = await start(t, { reviewTurns: [passingFixtureReview, waitingForAbort] });
  const candidate = project.quality.candidates[0];
  const packet = JSON.parse(await readFile(project.artifacts.find(a => a.id === candidate.materialsArtifactId).path, 'utf8'));
  const attempt = { id: randomUUID(), candidateId: candidate.id, number: 2, requestId: randomUUID(), sessionId: `wish-review-${randomUUID()}`, startedAt: new Date().toISOString() };
  const review = await runReviewer(host.ctx, { candidate, attempt, materials: packet.materials, maxMs: 10 });
  assert.equal(review.status, 'BLOCKED'); assert.match(review.reason, /budget|cancelled/i);
  assert.equal(host.scripted.state.reviewDisposed, 2); assert.equal(project.releases.length, 1, 'direct runner test cannot alter Product State');
});
