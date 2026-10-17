import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contractHash, decisionsForChange } from '../../packages/p1/src/quality-gate.js';
import { temporary } from '../helpers/temp.mjs';
import { p1Runtime, settle } from '../helpers/p1-runtime.mjs';

const plan = async ({ tool }) => {
  const state = await tool('wish_state', {});
  await tool('wish_plan', { requirements: [], constraints: [], decisions: [{ text: '使用收费云服务', risk: 'major' }],
    tasks: [{ description: '实现用户批准的方案', category: 'technical' }] });
  await assert.rejects(tool('write', { path: 'unauthorized.txt', content: 'no', workdir: state.workspace }), /Plan first/);
};
async function blocked(host) {
  const created = await host.call('create', { input: { requestId: randomUUID(), title: '决策恢复', wish: '本地记录工具' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: randomUUID(), wish: created.goal } });
  return settle(host, created.id);
}
const decide = (host, p, accepted) => host.call('decide', { input: { projectId: p.id, expectedRevision: p.revision, decisionId: p.decisions.at(-1).id, accepted } });
const retry = (p) => ({ projectId: p.id, expectedRevision: p.revision, requestId: randomUUID(), changeId: p.changes.at(-1).id });

test('rejected decision persists, blocks execution and new wishes, and idle cancellation actually resolves the blocked change', async t => {
  const root = await temporary(t), host = await p1Runtime(root, { turns: [plan] }); t.after(host.close);
  let p = await blocked(host);
  const rejection = { projectId: p.id, expectedRevision: p.revision, decisionId: p.decisions[0].id, accepted: false };
  p = await host.call('decide', { input: rejection });
  assert.deepEqual(await host.call('decide', { input: rejection }), p, 'same decision after response loss is a no-op');
  assert.equal(p.decisions[0].status, 'rejected'); assert.equal(p.status, 'blocked');
  assert.equal(p.evidence.length, 0); assert.equal(host.scripted.state.modelCreateCount, 1);
  await assert.rejects(host.call('retry', { input: retry(p) }), /decision|决策/i);
  await assert.rejects(host.call('submit', { input: { projectId: p.id, expectedRevision: p.revision, requestId: randomUUID(), wish: '改方案' } }), /current change/);
  const before = structuredClone(p);
  p = await host.call('cancel', { input: { projectId: p.id } });
  assert.equal(p.changes[0].status, 'failed');
  assert.deepEqual(p.decisions, before.decisions); assert.deepEqual(p.requirements, before.requirements);
  assert.equal(p.tasks[0].status, 'completed'); assert.equal(p.releases.length, 0);
  const cancelled = p;
  assert.deepEqual(await host.call('cancel', { input: { projectId: p.id } }), cancelled);
  await host.close();
  const reopened = await p1Runtime(root, { turns: [plan] }); t.after(reopened.close);
  assert.deepEqual(await reopened.call('read', { input: { projectId: p.id } }), cancelled);
  const next = await reopened.call('submit', { input: { projectId: p.id, expectedRevision: p.revision, requestId: randomUUID(), wish: '取消后另提新愿望' } });
  const settled = await settle(reopened, next.id);
  assert.equal(settled.changes.length, 2); assert.equal(settled.decisions[0].status, 'rejected');
});

const revision = p => ({ projectId: p.id, expectedRevision: p.revision, requestId: randomUUID(), decisionId: p.decisions.at(-1).id, text: '改用无费用的本地文件；不使用云服务' });

test('reject -> reopen paused -> revise -> fresh approval -> resume original tasks once, without the original chat', async t => {
  const root = await temporary(t), first = await p1Runtime(root, { turns: [plan] }); t.after(first.close);
  let p = await decide(first, await blocked(first), false);
  const original = structuredClone(p), revisionRequest = revision(p);
  await first.close();
  let writes = 0;
  const resumedCode = async ({ tool }) => {
    const state = await tool('wish_state', {});
    assert.deepEqual(state.decisions.map(d => d.status), ['rejected', 'accepted']);
    assert.match(state.decisions[1].text, /本地文件/);
    await tool('write', { path: 'approved.txt', content: 'approved local-only revision', workdir: state.workspace }); writes++;
    // Stop before build/delivery: this fixture verifies the approval boundary, not P2 acceptance.
  };
  const host = await p1Runtime(root, { turns: [resumedCode] }); t.after(host.close);
  assert.deepEqual(await host.call('read', { input: { projectId: p.id } }), original);
  assert.equal(host.scripted.state.createCount, 0, 'opening never auto-runs');
  await assert.rejects(decide(host, p, true), /revised|overwritten/);
  const oldHash = contractHash(p, p.changes[0].id);
  p = await host.call('reviseDecision', { input: revisionRequest });
  assert.deepEqual(p.decisions.map(d => d.status), ['rejected', 'proposed']);
  assert.deepEqual(p.decisions[0], original.decisions[0]);
  assert.deepEqual(p.tasks, original.tasks); assert.deepEqual(p.requirements, original.requirements);
  assert.equal(p.changes.length, 1); assert.equal(p.versions.length, 1);
  assert.notEqual(contractHash(p, p.changes[0].id), oldHash);
  assert.deepEqual(decisionsForChange(p, p.changes[0].id), p.decisions, 'review contract includes rejected history and revision');
  assert.deepEqual(await host.call('reviseDecision', { input: revisionRequest }), p, 'lost response retry is idempotent');
  await assert.rejects(host.call('reviseDecision', { input: { ...revisionRequest, text: 'different' } }), /reused/);
  await assert.rejects(host.call('retry', { input: retry(p) }), /decision/i);
  await assert.rejects(host.ctx.wishWillowP1.orchestrator.stageDelivery({ projectId: p.id, changeId: p.changes[0].id,
    input: { startCommand: 'node app.js', summary: 'not approved' } }), /Unresolved major decision/);
  p = await decide(host, p, true);
  assert.equal(host.scripted.state.createCount, 0, 'approval alone never starts execution');
  const request = retry(p), tasksBefore = structuredClone(p.tasks);
  await host.call('retry', { input: request });
  p = await settle(host, p.id);
  assert.equal(writes, 1); assert.equal(host.scripted.state.modelCreateCount, 1);
  assert.equal(p.changes.length, 1); assert.equal(p.versions.length, 1);
  assert.deepEqual(p.tasks.map(t => t.id), tasksBefore.map(t => t.id));
  assert.deepEqual(p.tasks[0], tasksBefore[0], 'completed planning task is never rerun');
  assert.equal(p.runs.length, 2); assert.equal(p.decisions[0].status, 'rejected');
  assert.equal(await readFile(join(p.workspace, 'approved.txt'), 'utf8'), 'approved local-only revision');
  const beforeRepeat = structuredClone(p);
  await host.call('retry', { input: request });
  await host.call('submit', { input: { projectId: p.id, expectedRevision: 1, requestId: p.changes[0].requestId, wish: p.changes[0].wish } });
  p = await settle(host, p.id);
  assert.equal(writes, 1); assert.deepEqual(p, beforeRepeat);
  await host.close();
  const reopened = await p1Runtime(root); t.after(reopened.close);
  assert.deepEqual(await reopened.call('retry', { input: request }), p);
  assert.equal(reopened.scripted.state.createCount, 0);
});

test('normal approval resumes without re-planning; multiple decisions all need approval', async t => {
  const root = await temporary(t);
  const multiPlan = async ({ tool }) => tool('wish_plan', { requirements: [], constraints: [],
    decisions: [{ text: '第一事项', risk: 'major' }, { text: '第二事项', risk: 'major' }], tasks: [{ description: '仅批准后执行', category: 'technical' }] });
  const first = await p1Runtime(root, { turns: [multiPlan] }); t.after(first.close);
  let p = await blocked(first); p = await decide(first, p, true);
  await assert.rejects(first.call('retry', { input: retry(p) }), /decision/i);
  p = await first.call('decide', { input: { projectId: p.id, expectedRevision: p.revision, decisionId: p.decisions[0].id, accepted: true } });
  await first.close();
  let writes = 0;
  const host = await p1Runtime(root, { turns: [async ({ tool }) => {
    const state = await tool('wish_state', {});
    await tool('write', { path: 'normal.txt', content: 'yes', workdir: state.workspace }); writes++;
  }] }); t.after(host.close);
  assert.equal(host.scripted.state.createCount, 0);
  const request = retry(p);
  const results = await Promise.allSettled([host.call('retry', { input: request }), host.call('retry', { input: request })]);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  p = await settle(host, p.id);
  assert.equal(writes, 1); assert.equal(p.runs.length, 2); assert.equal(p.changes.length, 1);
  assert.deepEqual(p.decisions.map(d => d.status), ['accepted', 'accepted']);
});

test('crash after durable blocked plan but before run finalization recovers only the planning pause', async t => {
  const root = await temporary(t), first = await p1Runtime(root, { turns: [plan] }); t.after(first.close);
  let p = await decide(first, await blocked(first), false);
  p = await first.ctx.wishWillowP1.store.mutate(p.id, 'fixture-interrupted-plan-finalization', { kind: 'runtime', ref: 'test' }, next => {
    next.runs[0].status = 'running'; delete next.runs[0].endedAt; delete next.runs[0].durationMs;
  });
  await first.close();
  const host = await p1Runtime(root); t.after(host.close);
  p = await host.call('read', { input: { projectId: p.id } });
  assert.equal(p.status, 'blocked'); assert.equal(p.runs[0].status, 'blocked');
  assert.equal(p.decisions[0].status, 'rejected'); assert.equal(host.scripted.state.createCount, 0);
  const before = structuredClone(p); await host.ctx.wishWillowP1.store.recover();
  assert.deepEqual(await host.call('read', { input: { projectId: p.id } }), before);
  p = await host.call('reviseDecision', { input: revision(p) });
  assert.deepEqual(p.decisions.map(d => d.status), ['rejected', 'proposed']);
});

test('crash after resume is saved but before launch becomes uncertain; replay never launches again', async t => {
  const root = await temporary(t), first = await p1Runtime(root, { turns: [plan] }); t.after(first.close);
  let p = await decide(first, await blocked(first), true);
  const request = retry(p);
  first.ctx.wishWillowP1.orchestrator.launch = () => {}; // inject this exact crash boundary, no new Agent
  p = await first.call('retry', { input: request });
  assert.equal(p.changes[0].status, 'pending');
  await first.close();
  const host = await p1Runtime(root); t.after(host.close);
  p = await host.call('read', { input: { projectId: p.id } });
  assert.equal(p.status, 'uncertain');
  assert.deepEqual(await host.call('retry', { input: request }), p);
  await assert.rejects(host.call('retry', { input: retry(p) }), /acknowledge unknown side effects/);
  assert.equal(host.scripted.state.createCount, 0);
});

test('CAS rejects stale revision/cancel, repeated rejection cannot overwrite history, and unsafe old execution fails closed', async t => {
  const root = await temporary(t), host = await p1Runtime(root, { turns: [plan] }); t.after(host.close);
  let p = await decide(host, await blocked(host), false);
  const request = revision(p);
  const results = await Promise.allSettled([host.call('reviseDecision', { input: request }), host.call('reviseDecision', { input: { ...request, requestId: randomUUID(), text: '另一方案' } })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'wish-willow-p1/conflict');
  await assert.rejects(host.call('cancel', { input: { projectId: p.id, changeId: p.changes[0].id, expectedRevision: p.revision } }), /refresh/);
  p = await host.call('read', { input: { projectId: p.id } });
  p = await decide(host, p, false);
  const store = host.ctx.wishWillowP1.store;
  await assert.rejects(store.mutate(p.id, 'tamper', { kind: 'agent', ref: p.runs[0].id }, next => { next.decisions[0].status = 'accepted'; }), /history/);
  p = await store.mutate(p.id, 'fixture-unsafe-legacy', { kind: 'runtime', ref: 'test' }, next => {
    next.tasks.find(t => t.phase === 'code').status = 'running';
  });
  await assert.rejects(host.call('reviseDecision', { input: revision(p) }), { code: 'wish-willow-p1/unsafe-decision-state' });
  assert.equal(host.scripted.state.modelCreateCount, 1);
  assert.deepEqual(store.read(p.id), p);
  p = await store.mutate(p.id, 'fixture-unknown-legacy-link', { kind: 'runtime', ref: 'test' }, next => {
    next.decisions.push({ id: randomUUID(), text: '来源丢失的旧决策', risk: 'major', status: 'rejected', source: { kind: 'migration', ref: 'unknown' } });
  });
  await assert.rejects(host.call('reviseDecision', { input: revision(p) }), error => error.code === 'wish-willow-p1/unsafe-decision-state' && /Unknown decision association/.test(error.message));
  assert.deepEqual(store.read(p.id), p);
});
