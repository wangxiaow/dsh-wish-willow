import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { temporary } from '../helpers/temp.mjs';
import { createFixtureRunner } from '../helpers/runner.mjs';
import { unifiedRuntime } from '../helpers/unified-runtime.mjs';
import { settle } from '../helpers/p1-runtime.mjs';
import { passingFixtureReview } from '../helpers/p2-reviewer.mjs'; // explicit Reviewer fixture, not real acceptance

const sha256 = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const plan = async ({ tool }) => {
  const state = await tool('wish_state', {});
  await tool('wish_plan', {
    requirements: ['可以新增任务'],
    constraints: ['仅本地运行'],
    decisions: [],
    tasks: [{ description: '实现最小待办功能', category: 'technical' }],
  });
  return state;
};
const code = async ({ tool }) => {
  const { workspace } = await tool('wish_state', {});
  await tool('write', { path: 'app.js', content: 'console.log("todo")\n', workdir: workspace });
  await tool('wish_verify', { kind: 'build', command: 'node --check app.js', description: 'build' });
  await tool('wish_verify', { kind: 'test', command: 'node --check app.js', description: 'test' });
  await tool('wish_verify', { kind: 'run', command: 'node app.js', description: 'run' });
  await tool('wish_deliver', { startCommand: 'node app.js', summary: '待办应用已交付' });
};
const change = (host, projectId, requestId, wish, expectedRevision) =>
  host.call('submit', { input: { projectId, expectedRevision, requestId, wish } });

test('a P0-only installation upgrades in place: bytes, UUID, history and confirmed facts survive', async t => {
  const root = await temporary(t);
  // 1. The pre-upgrade installation: only the accepted P0 companion plugin.
  const legacyOnly = await unifiedRuntime(root, { modules: 'legacy' });
  const p0Row = await legacyOnly.callP0('create', { input: { title: '[P0] 已验收产品', wish: '保留旧记录', status: 'confirmed' } });
  const undone = await legacyOnly.callP0('update', { input: { id: p0Row.id, expectedRevision: 1, title: '[P0] 已验收产品', wish: '保留旧记录（已确认）', status: 'confirmed' } });
  await legacyOnly.close();
  const p0Bytes = await readFile(join(root, 'wish_willow.json'), 'utf8');

  // 2. The upgrade: the unified bundle replaces both companions over the same storage root.
  const unified = await unifiedRuntime(root);
  t.after(unified.close);
  assert.equal(await readFile(join(root, 'wish_willow.json'), 'utf8'), p0Bytes, 'the upgrade never rewrites P0 bytes');
  const rows = await unified.call('legacy');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], undone, 'the legacy product is visible with its real revision');
  assert.deepEqual(await unified.call('list'), [], 'no product is invented during the upgrade');

  // 3. The explicit, idempotent, UUID-preserving import.
  const first = await unified.call('importLegacy', { input: { productId: undone.id, requestId: '3f1a1c0e-0000-4000-8000-000000000201' } });
  const again = await unified.call('importLegacy', { input: { productId: undone.id, requestId: '3f1a1c0e-0000-4000-8000-000000000202' } });
  assert.equal(first.id, undone.id, 'the P0 UUID is preserved');
  assert.equal(again.id, first.id, 'a repeated import is idempotent');
  assert.equal((await unified.call('list')).length, 1);
  assert.equal(again.legacy.snapshot, JSON.stringify(undone), 'the legacy snapshot is preserved field by field');
  assert.equal(again.goal, undone.wish);
  assert.equal(await readFile(join(root, 'wish_willow.json'), 'utf8'), p0Bytes, 'import writes nothing into the P0 domain');
});

test('a delivered P0+P1 installation upgrades without losing released history, then evolves a second version', async t => {
  const root = await temporary(t);
  // 1. Round one runs on the pre-upgrade installation (both companion plugins), as an existing user would have it.
  const legacyHost = await unifiedRuntime(root, { modules: 'legacy', commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns: [plan, code] });
  const p0Row = await legacyHost.callP0('create', { input: { title: '[P0] 历史产品', wish: '旧愿望', status: 'confirmed' } });
  const created = await legacyHost.call('create', { input: { requestId: '3f1a1c0e-0000-4000-8000-000000000203', title: '待办事项应用', wish: '我想做一个待办事项应用' } });
  await change(legacyHost, created.id, '3f1a1c0e-0000-4000-8000-000000000204', created.goal, created.revision);
  const before = await settle(legacyHost, created.id);
  assert.equal(before.status, 'delivered');
  assert.equal(before.releases.length, 1);
  const firstRelease = before.releases[0];
  const firstSnapshot = await readdir(firstRelease.snapshotPath);
  await legacyHost.close();

  const p0Hash = await sha256(join(root, 'wish_willow.json'));
  const p1Hash = await sha256(join(root, 'wish_willow_p1.json'));

  // 2. The upgrade opens the very same media through the unified bundle.
  const unified = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns: [plan, code] });
  t.after(unified.close);
  assert.equal(await sha256(join(root, 'wish_willow.json')), p0Hash, 'P0 media is byte-identical after the upgrade');
  assert.equal(await sha256(join(root, 'wish_willow_p1.json')), p1Hash, 'P1 media is byte-identical after the upgrade');
  const reopened = await unified.call('read', { input: { projectId: created.id } });
  assert.deepEqual(reopened, before, 'every persisted fact is identical through the unified entry point');
  assert.equal(reopened.versions[0].status, 'Released');
  assert.deepEqual(reopened.history, before.history, 'the append-only audit history survives');
  assert.deepEqual(await unified.call('legacy'), [p0Row], 'the pre-upgrade P0 product is still readable');

  // 3. Round two continues the same product and workspace through the unified bundle.
  await change(unified, created.id, '3f1a1c0e-0000-4000-8000-000000000205', '请增加任务优先级', reopened.revision);
  const after = await settle(unified, created.id);
  assert.equal(after.status, 'delivered');
  assert.equal(after.releases.length, 2, 'the second round adds a release instead of rewriting one');
  assert.deepEqual(after.releases[0], firstRelease, 'the first release record is untouched');
  assert.notEqual(after.releases[1].snapshotPath, firstRelease.snapshotPath, 'each version has its own immutable snapshot');
  assert.equal(after.versions.length, 2);
  assert.deepEqual(after.versions.map(v => v.label), ['0.1.0', '0.2.0']);
  assert.deepEqual(after.versions.map(v => v.status), ['Released', 'Released']);
  assert.deepEqual(await readdir(firstRelease.snapshotPath), firstSnapshot, 'the first version snapshot is not overwritten');
  assert.equal(after.requirements.filter(row => row.confirmation === 'confirmed').length, 2, 'both confirmed wishes are preserved');
  assert.equal(await sha256(join(root, 'wish_willow.json')), p0Hash, 'evolving the product never touches the legacy P0 domain');
  assert.equal(after.workspace, before.workspace, 'the second round reuses the original product workspace');
});

test('a fresh unified installation creates both domains without any migration step', async t => {
  const root = await temporary(t);
  const host = await unifiedRuntime(root);
  t.after(host.close);
  assert.deepEqual(await host.call('list'), []);
  assert.deepEqual(await host.call('legacy'), []);
  const created = await host.call('create', { input: { requestId: '3f1a1c0e-0000-4000-8000-000000000206', title: '全新产品', wish: '一个全新愿望' } });
  assert.equal(created.revision, 1);
  const files = await readdir(root);
  assert.deepEqual(files.filter(name => name.endsWith('.json')), ['wish_willow_p1.json'], 'a fresh install writes only the domain it needs');
  await host.close();
  const second = await unifiedRuntime(root);
  t.after(second.close);
  assert.deepEqual((await second.call('read', { input: { projectId: created.id } })).title, '全新产品');
});
