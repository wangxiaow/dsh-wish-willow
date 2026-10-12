import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { temporary } from '../helpers/temp.mjs';
import { createFixtureRunner } from '../helpers/runner.mjs';
import { unifiedRuntime } from '../helpers/unified-runtime.mjs';
import { settle } from '../helpers/p1-runtime.mjs';
import { passingFixtureReview } from '../helpers/p2-reviewer.mjs'; // explicit scripted Reviewer only

const sha256 = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const project = input => ({ input });

test('one unified Bundle row opens both historical domains and serves both services', async t => {
  const root = await temporary(t);
  const host = await unifiedRuntime(root);
  t.after(host.close);
  assert.equal(host.mounted.state, 2);
  assert.ok(host.ctx.storageDomain.get('wish_willow'), 'the legacy P0 domain is opened by the unified row');
  assert.ok(host.ctx.storageDomain.get('wish_willow_p1'), 'the evolution domain is opened by the same row');
  assert.ok(host.ctx.get('wishWillow'), 'legacy Service is registered once');
  assert.ok(host.ctx.get('wishWillowP1'), 'evolution Service is registered once');

  const legacy = await host.callP0('create', project({ title: '[P0] 统一前产品', wish: '保留旧记录', status: 'confirmed' }));
  const created = await host.call('create', project({ requestId: '3f1a1c0e-0000-4000-8000-000000000101', title: '统一产品', wish: '我希望有一个待办应用' }));
  assert.equal(created.requirements.length, 0, 'creating a product records no invented requirement');
  const imported = await host.call('importLegacy', project({ productId: legacy.id, requestId: '3f1a1c0e-0000-4000-8000-000000000102' }));
  assert.equal(imported.id, legacy.id);
  assert.equal(imported.legacy.snapshot, JSON.stringify(legacy));

  const media = JSON.parse(await readFile(join(root, 'wish_willow_p1.json'), 'utf8'));
  assert.equal(media.unit.name, 'wish_willow_p1');
  assert.equal(media.unit.version, 1);
  const legacyMedia = JSON.parse(await readFile(join(root, 'wish_willow.json'), 'utf8'));
  assert.equal(legacyMedia.unit.name, 'wish_willow');
  assert.equal(legacyMedia.unit.version, 1);
});

test('disabling and reloading the unified row keeps every fact and never drops a storage domain', async t => {
  const root = await temporary(t);
  const first = await unifiedRuntime(root);
  const legacy = await first.callP0('create', project({ title: '生命周期产品', wish: '旧愿望', status: 'confirmed' }));
  const created = await first.call('create', project({ requestId: '3f1a1c0e-0000-4000-8000-000000000103', title: '生命周期', wish: '新愿望' }));
  await first.call('importLegacy', project({ productId: legacy.id, requestId: '3f1a1c0e-0000-4000-8000-000000000104' }));
  const p0Bytes = await readFile(join(root, 'wish_willow.json'), 'utf8');
  const p1Hash = await sha256(join(root, 'wish_willow_p1.json'));

  await first.mounted.dispose();
  assert.equal(first.ctx.get('wishWillow'), undefined, 'disabling the unified row unregisters the legacy Service');
  assert.equal(first.ctx.get('wishWillowP1'), undefined, 'disabling the unified row unregisters the evolution Service');
  assert.equal(first.ctx.storageDomain.get('wish_willow'), undefined);
  assert.equal(first.ctx.storageDomain.get('wish_willow_p1'), undefined);
  await assert.rejects(first.call('list'));
  assert.equal(await readFile(join(root, 'wish_willow.json'), 'utf8'), p0Bytes, 'disabling never rewrites product data');
  assert.equal(await sha256(join(root, 'wish_willow_p1.json')), p1Hash);

  const second = await unifiedRuntime(root);
  t.after(second.close);
  const rows = await second.call('list');
  assert.equal(rows.length, 2, 'both records come back after reload');
  assert.equal(rows.find(row => row.id === created.id).creationRequestId, '3f1a1c0e-0000-4000-8000-000000000103');
  assert.equal(rows.find(row => row.id === legacy.id).legacy.snapshot, JSON.stringify(await second.callP0('list').then(list => list[0])));
  assert.equal(await readFile(join(root, 'wish_willow.json'), 'utf8'), p0Bytes);
});

test('the unified Host fails closed on malformed, foreign-version and invalid media in either domain', async t => {
  const cases = [
    ['wish_willow.json', '{broken', 'malformed-medium'],
    ['wish_willow.json', JSON.stringify({ unit: { name: 'wish_willow', version: 2 }, global: null, tables: { products: {} } }), 'version-mismatch'],
    ['wish_willow.json', JSON.stringify({ unit: { name: 'wish_willow', version: 1 }, global: null, tables: { products: { unsafe: { title: 'invalid' } } } }), 'invalid-record'],
    ['wish_willow_p1.json', '{broken', 'malformed-medium'],
    ['wish_willow_p1.json', JSON.stringify({ unit: { name: 'wish_willow_p1', version: 2 }, global: null, tables: { projects: {} } }), 'version-mismatch'],
    ['wish_willow_p1.json', JSON.stringify({ unit: { name: 'wish_willow_p1', version: 1 }, global: null, tables: { projects: { unsafe: { title: 'invalid' } } } }), 'invalid-record'],
  ];
  for (const [file, bytes, code] of cases) {
    const root = await temporary(t);
    await writeFile(join(root, file), bytes);
    await assert.rejects(unifiedRuntime(root), { code }, `${file} must fail closed with ${code}`);
    assert.equal(await readFile(join(root, file), 'utf8'), bytes, `${file} bytes must survive a refused load`);
  }
});

test('an interrupted unified execution is recovered as uncertain and is never re-run automatically', async t => {
  const interrupted = await temporary(t);
  let open; const gate = new Promise(resolve => { open = resolve; });
  const first = await unifiedRuntime(interrupted, { turns: [async () => { await gate; }] });
  const created = await first.call('create', project({ requestId: '3f1a1c0e-0000-4000-8000-000000000105', title: '中断产品', wish: '生成一个应用' }));
  await first.call('submit', project({ projectId: created.id, expectedRevision: 1, requestId: '3f1a1c0e-0000-4000-8000-000000000106', wish: '生成一个应用' }));
  // The Host state a killed process leaves on disk: a change that is still pending/running.
  const media = await readFile(join(interrupted, 'wish_willow_p1.json'), 'utf8');
  const pending = JSON.parse(media).tables.projects[created.id].changes.at(-1).status;
  assert.ok(['pending', 'running'].includes(pending), `interrupted media must show an unfinished change, got ${pending}`);
  open();
  await first.close();

  const root = await temporary(t);
  await writeFile(join(root, 'wish_willow_p1.json'), media);
  const second = await unifiedRuntime(root);
  t.after(second.close);
  const recovered = await second.call('read', project({ projectId: created.id }));
  assert.equal(recovered.status, 'uncertain');
  assert.equal(recovered.changes.at(-1).status, 'uncertain', 'no silent success and no automatic retry');
  assert.match(recovered.changes.at(-1).result, /不会自动重复/);
  assert.equal(second.scripted.state.modelCreateCount, 0, 'no Agent was created for the interrupted change on restart');
  assert.equal(second.scripted.state.validationCreateCount, 0, 'no delivery validation ran either');
});

test('two independent Node processes reopen both domains through the unified row', async t => {
  const root = await temporary(t);
  for (const stage of ['seed', 'recover']) {
    const result = spawnSync(process.execPath, ['tests/helpers/restart-child-unified.mjs', stage, root], { stdio: 'inherit', timeout: 30000 });
    assert.equal(result.status, 0, `${stage}: ${result.error ?? ''}`);
  }
  const proof = JSON.parse(await readFile(join(root, 'unified-restart-proof.json'), 'utf8'));
  assert.equal(proof.recovered, true);
  assert.equal(proof.legacyRevision, 2);
  assert.equal(proof.projects, 2);
});

test('submitting a wish from the unified entry point produces real Agent, evidence-gated versions', async t => {
  const root = await temporary(t);
  const turns = [
    async ({ tool }) => { await tool('wish_state', {}); await tool('wish_plan', { requirements: ['可以新增任务'], constraints: [], decisions: [], tasks: [{ description: '实现待办', category: 'technical' }] }); },
    async ({ tool }) => {
      const state = await tool('wish_state', {});
      await tool('write', { path: 'app.js', content: 'console.log(1)\n', workdir: state.workspace });
      await tool('wish_verify', { kind: 'build', command: 'node --check app.js', description: 'build' });
      await tool('wish_verify', { kind: 'test', command: 'node --check app.js', description: 'test' });
      await tool('wish_verify', { kind: 'run', command: 'node app.js', description: 'run' });
      await tool('wish_deliver', { startCommand: 'node app.js', summary: '已交付最小应用' });
    },
  ];
  const host = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns });
  t.after(host.close);
  const created = await host.call('create', project({ requestId: '3f1a1c0e-0000-4000-8000-000000000107', title: '交付产品', wish: '生成最小应用' }));
  await host.call('submit', project({ projectId: created.id, expectedRevision: 1, requestId: '3f1a1c0e-0000-4000-8000-000000000108', wish: '生成最小应用' }));
  const row = await settle(host, created.id);
  assert.equal(row.status, 'delivered');
  assert.equal(row.releases.length, 1);
  assert.equal(row.versions.at(-1).status, 'Released');
  const release = row.releases.at(-1);
  assert.equal(release.startCommand, 'node app.js');
  assert.ok(release.snapshotPath.startsWith(join(root, 'products', 'deliveries')), `snapshot stays inside the controlled workspace root: ${release.snapshotPath}`);
  assert.equal(row.workspace, join(root, 'products', 'projects', created.id), 'the product workspace is derived from the configured root, never from a client path');
  assert.ok(row.evidence.filter(e => e.success && e.exitCode === 0).length >= 3);
});
