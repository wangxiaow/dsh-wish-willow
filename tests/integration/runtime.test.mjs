import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runtime } from '../helpers/runtime.mjs';
import { temporary } from '../helpers/temp.mjs';
const fields = { title: '真实 DSH 存储', wish: 'P0 only', status: 'draft' };

test('real Cordis loading, Gateway binding, JSON durability, concurrent CAS and unload/reload', async t => {
  const root = await temporary(t); const host = await runtime(root); t.after(host.close);
  assert.equal(host.wish.state, 2);
  assert.deepEqual(await host.call('list'), []);
  const created = await host.call('create', { input: fields });
  const disk = JSON.parse(await readFile(join(root, 'wish_willow.json'), 'utf8'));
  assert.equal(disk.unit.name, 'wish_willow');
  assert.equal(disk.tables.products[created.id].title, fields.title);
  const writes = await Promise.allSettled(['A', 'B'].map(title => host.call('update', { input: { ...fields, title, id: created.id, expectedRevision: 1 } })));
  assert.equal(writes.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(writes.find(item => item.status === 'rejected').reason.code, 'wish-willow/conflict');
  await assert.rejects(host.call('create', { input: { ...fields, extra: true } }), { code: 'wish-willow/invalid-input' });
  await assert.rejects(host.call('create', { wrong: fields }));
  const before = await host.call('list');
  await host.wish.dispose();
  assert.equal(host.ctx.get('wishWillow'), undefined);
  assert.equal(host.ctx.storageDomain.get('wish_willow'), undefined);
  await assert.rejects(host.call('list'));
  const Wish = await import('../../src/host.js');
  const nextFiber = host.ctx.plugin(Wish); await nextFiber;
  assert.equal(nextFiber.state, 2); assert.deepEqual(await host.call('list'), before);
  await nextFiber.dispose();
});

test('two independent Node processes restore the same product via real DSH services', async t => {
  const root = await temporary(t);
  for (const stage of ['seed', 'recover']) {
    const result = spawnSync(process.execPath, ['tests/helpers/restart-child.mjs', stage, root], { stdio: 'inherit', timeout: 20000 });
    assert.equal(result.status, 0, `${stage}: ${result.error ?? ''}`);
  }
  const proof = JSON.parse(await readFile(join(root, 'restart-proof.json'), 'utf8'));
  assert.equal(proof.recovered, true); assert.equal(proof.revision, 2);
});

test('malformed media, mismatched version and invalid stored records fail closed, leaving bytes intact', async t => {
  const root = await temporary(t); const path = join(root, 'wish_willow.json');
  for (const [bytes, code] of [['{broken', 'malformed-medium'],
    [JSON.stringify({ unit: { name: 'wish_willow', version: 2 }, global: null, tables: { products: {} } }), 'version-mismatch'],
    [JSON.stringify({ unit: { name: 'wish_willow', version: 1 }, global: null, tables: { products: { unsafe: { title: 'invalid' } } } }), 'invalid-record']]) {
    await writeFile(path, bytes);
    await assert.rejects(runtime(root), { code });
    assert.equal(await readFile(path, 'utf8'), bytes);
  }
});
