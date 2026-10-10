import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { temporary } from '../helpers/temp.mjs';
import { p1Runtime } from '../helpers/p1-runtime.mjs';

test('P1 service persists via real DSH storage, keeps P0 bytes intact and imports by UUID', async t => {
  const root = await temporary(t);
  const host = await p1Runtime(root, { withP0: true });
  t.after(host.close);
  const legacy = await host.callP0('create', { input: { title: '[P0] 已验收产品', wish: '保留旧记录', status: 'confirmed' } });
  const p0Path = join(root, 'wish_willow.json');
  const p0Before = await readFile(p0Path, 'utf8');

  const requestId = '3f1a1c0e-0000-4000-8000-000000000001';
  const created = await host.call('create', { input: { requestId, title: '待办事项应用', wish: '我想做一个待办事项应用' } });
  const again = await host.call('create', { input: { requestId, title: '待办事项应用', wish: '我想做一个待办事项应用' } });
  assert.equal(created.id, again.id);
  assert.equal((await host.call('list')).length, 1);
  assert.equal(created.requirements.length, 0);
  assert.equal(created.versions.length, 0);
  assert.deepEqual(created.history.map(row => row.action), ['create-product']);
  assert.deepEqual(created.history[0].source, { kind: 'user', ref: requestId });

  const imported = await host.call('importLegacy', { input: { productId: legacy.id, requestId: '3f1a1c0e-0000-4000-8000-000000000002' } });
  assert.equal(imported.id, legacy.id);
  assert.equal(imported.legacy.snapshot, JSON.stringify(legacy));
  assert.equal(imported.legacy.revision, legacy.revision);
  assert.equal(imported.legacy.productId, legacy.id);
  assert.equal(await readFile(p0Path, 'utf8'), p0Before);
  assert.deepEqual((await host.callP0('list'))[0], legacy);

  await assert.rejects(host.call('create', { input: { requestId, title: 'different', wish: 'different' } }), { code: 'wish-willow-p1/idempotency-conflict' });
  await assert.rejects(host.call('create', { input: { requestId: 'not-a-uuid', title: 'x', wish: 'y' } }));
  await assert.rejects(host.call('read', { input: { projectId: '3f1a1c0e-0000-4000-8000-0000000000ff' } }), { code: 'wish-willow-p1/not-found' });
  await assert.rejects(host.call('importLegacy', { input: { productId: created.id, requestId: '3f1a1c0e-0000-4000-8000-000000000003' } }), { code: 'wish-willow-p1/not-found' });
  await assert.rejects(host.call('create', { wrong: { requestId, title: 'x', wish: 'y' } }));
  await assert.rejects(host.call('create', { input: { requestId, title: 'x', wish: 'y', status: 'draft' } }));
});

test('a new Host generation reopens both domains from the same root with identical facts', async t => {
  const root = await temporary(t);
  const first = await p1Runtime(root, { withP0: true });
  const legacy = await first.callP0('create', { input: { title: '[P0] 跨进程', wish: '旧数据', status: 'draft' } });
  const created = await first.call('create', { input: { requestId: '3f1a1c0e-0000-4000-8000-000000000004', title: '产品', wish: '愿望' } });
  await first.call('importLegacy', { input: { productId: legacy.id, requestId: '3f1a1c0e-0000-4000-8000-000000000005' } });
  await first.close();

  const media = JSON.parse(await readFile(join(root, 'wish_willow_p1.json'), 'utf8'));
  assert.equal(media.unit.name, 'wish_willow_p1');
  assert.equal(media.unit.version, 1);
  assert.equal(media.tables.projects[created.id].title, '产品');
  assert.equal(media.tables.projects[legacy.id].legacy.snapshot, JSON.stringify(legacy));

  const second = await p1Runtime(root, { withP0: true });
  t.after(second.close);
  const rows = await second.call('list');
  assert.equal(rows.length, 2);
  const reopened = rows.find(row => row.id === created.id);
  assert.equal(reopened.creationRequestId, '3f1a1c0e-0000-4000-8000-000000000004');
  assert.equal(reopened.revision, 1);
  assert.equal(rows.find(row => row.legacy).legacy.snapshot, JSON.stringify((await second.callP0('list'))[0]));
});

test('P1 media fails closed on malformed bytes, foreign version and invalid records', async t => {
  const root = await temporary(t);
  const path = join(root, 'wish_willow_p1.json');
  const unit = name => ({ unit: { name, version: 1 }, global: null, tables: { projects: {} } });
  for (const [bytes, code] of [['{broken', 'malformed-medium'],
    [JSON.stringify({ ...unit('wish_willow_p1'), unit: { name: 'wish_willow_p1', version: 2 } }), 'version-mismatch'],
    [JSON.stringify({ ...unit('wish_willow_p1'), tables: { projects: { unsafe: { title: 'invalid' } } } }), 'invalid-record']]) {
    await writeFile(path, bytes);
    await assert.rejects(p1Runtime(root, {}), { code });
    assert.equal(await readFile(path, 'utf8'), bytes);
  }
});
