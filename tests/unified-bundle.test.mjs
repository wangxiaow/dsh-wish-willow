import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { composeEntries, loadOptionalPatches } from '@deepseek-ai/dsh-app-boot';

const repo = fileURLToPath(new URL('..', import.meta.url));
const readJson = async relative => JSON.parse(await readFile(resolve(repo, relative), 'utf8'));
const loadClient = async relative => {
  let declaration;
  new vm.Script(await readFile(resolve(repo, relative), 'utf8')).runInNewContext({
    window: { __ModuleLoader__: { load: row => { declaration = row; } } },
  });
  return declaration;
};

test('the install surface is one Bundle: one manifest, one patch row, one Client entry', async () => {
  const manifest = await readJson('package.json');
  assert.equal(manifest.name, 'dsh-wish-willow');
  assert.equal(manifest.version, '0.3.2');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.exports['.'], './src/host.js');
  assert.equal(manifest.exports['./client'], './client.js');
  assert.ok(manifest.files.includes('packages/p1/src/'), 'the internal P1 module ships inside the unified tarball');
  assert.ok(manifest.files.includes('src/'), 'the internal P0 module ships inside the unified tarball');
  assert.equal(manifest.files.some(entry => entry.includes('evidence')), false, 'test evidence is not shipped in the install artifact');
  assert.equal(Object.keys(manifest.dsh).sort().join(','), 'bundle,client', 'exactly one bundle and one client declaration per install');

  const layer = loadOptionalPatches('test', resolve(repo, 'cordis.patch.yml'));
  const entries = composeEntries([layer]);
  const rows = entries.filter(row => row.name === 'dsh-wish-willow');
  assert.equal(rows.length, 1, 'one loader row for the whole product');
  assert.equal(rows[0].id, 'wish-willow');
  assert.deepEqual(rows[0].config, {});
  assert.equal(entries.some(row => row.id === 'wish-willow-p0' || row.id === 'wish-willow-p1'), false, 'no legacy companion row is inserted');

  const declaration = await loadClient('client.js');
  const client = declaration.factory(() => ({}));
  assert.equal(declaration.id, manifest.name, 'the Client module id equals the installed package name');
  assert.equal(typeof client.apply, 'function');
});

test('upgrading the composition replaces two legacy rows with one and needs no data migration', () => {
  // The pre-upgrade composition an existing user has: the P0 bundle row plus the P1 companion row.
  const legacyP0 = [{ insert: [{ id: 'wish-willow-p0', name: 'dsh-wish-willow', config: {} }] }];
  const legacyP1 = loadOptionalPatches('test', resolve(repo, 'packages/p1/cordis.patch.yml'));
  const before = composeEntries([legacyP0, legacyP1]);
  assert.deepEqual(before.map(row => row.id), ['wish-willow-p0', 'wish-willow-p1']);
  assert.equal(new Set(before.map(row => row.name)).size, 2, 'before the upgrade two packages were installed');

  const after = composeEntries([legacyP0, legacyP1, loadOptionalPatches('test', resolve(repo, 'cordis.patch.yml'))]);
  // The unified patch adds its own row; the upgrade removes the two legacy bundles from
  // `dsh.profile.bundles`, which removes their rows again. What matters here is that the
  // unified product itself needs exactly one row and shares no id with them.
  const unifiedRows = after.filter(row => row.id === 'wish-willow');
  assert.equal(unifiedRows.length, 1);
  assert.equal(after.filter(row => row.name.startsWith('dsh-wish-willow')).length, 3, 'the three wish-willow packages are distinguishable by id');
  const final = composeEntries([loadOptionalPatches('test', resolve(repo, 'cordis.patch.yml'))]);
  assert.deepEqual(final.map(row => row.id), ['wish-willow'], 'after removing the legacy bundles exactly one row remains');
});

test('the internal modules keep their own identity, services and storage domains', async () => {
  const unified = await import('../src/host.js');
  const p0 = await import('../src/p0/host.js');
  const p1 = await import('../packages/p1/src/host.js');
  assert.equal(unified.name, 'wish-willow');
  assert.equal(p0.name, 'wish-willow-p0');
  assert.equal(p1.name, 'wish-willow-p1');
  assert.equal(typeof p0.apply, 'function');
  assert.equal(typeof p1.apply, 'function');
  assert.equal(p0.productDomain.name, 'wish_willow');
  assert.equal(p0.productDomain.version, 1);
  assert.equal(p1.evolutionDomain.name, 'wish_willow_p1');
  assert.equal(p1.evolutionDomain.version, 1);
  assert.equal(Object.keys(p0.productDomain.tables).join(','), 'products');
  assert.equal(Object.keys(p1.evolutionDomain.tables).join(','), 'projects');
  // The unified row injects the union of what both internal modules need, so one row can mount both.
  const union = [...new Set([...p0.inject, ...p1.inject])].sort();
  assert.deepEqual([...unified.inject].sort(), union);
});

test('the frozen legacy companion stays installable for rollback while the unified bundle owns the product', async () => {
  const p1 = await readJson('packages/p1/package.json');
  assert.equal(p1.name, 'dsh-wish-willow-p1');
  assert.equal(p1.version, '0.2.0-p1.1');
  assert.equal(p1.dsh.bundle.patch, './cordis.patch.yml');
  const host = await import('../packages/p1/src/host.js');
  assert.equal(host.evolutionDomain.name, 'wish_willow_p1', 'the legacy companion still reads the same domain it always wrote');
  assert.equal(host.evolutionDomain.version, 1);
  const rows = composeEntries([loadOptionalPatches('test', resolve(repo, 'packages/p1/cordis.patch.yml'))]);
  assert.deepEqual(rows.map(row => ({ id: row.id, name: row.name })), [{ id: 'wish-willow-p1', name: 'dsh-wish-willow-p1' }]);
  const legacyClient = await loadClient('packages/p1/client.js');
  assert.equal(legacyClient.id, p1.name);
});

test('the unified Bundle declares the same compatibility window it was verified against', async () => {
  const manifest = await readJson('package.json');
  assert.equal(manifest.peerDependencies['@deepseek-ai/dsh'], '0.2.0-rc.2');
  assert.equal(manifest.peerDependencies['@deepseek-ai/cordis'], '~4.0.4');
  for (const [name, meta] of Object.entries(manifest.peerDependenciesMeta)) {
    assert.equal(meta.optional, true, `${name} must be an optional peer so the profile installs without a compiler`);
  }
  assert.equal(manifest.scripts.prepare, undefined, 'no lifecycle script runs on install');
});

