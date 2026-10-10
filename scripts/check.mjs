import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));assert.equal(manifest.name, 'dsh-wish-willow');
assert.equal(manifest.license, 'MIT');
assert.equal(manifest.author, 'wangxiaow');
assert.equal(manifest.repository.url, 'git+https://github.com/wangxiaow/dsh-wish-willow.git');
const license = await readFile(new URL('../LICENSE', import.meta.url), 'utf8');
assert.match(license, /^MIT License\r?\n/);
assert.match(license, /Copyright \(c\) 2026 wangxiaow/);
assert.equal(manifest.dsh.client.platform, 'web');
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(manifest.scripts.prepare, undefined, 'Git install must not need lifecycle build scripts');
assert.equal(manifest.peerDependencies['@deepseek-ai/dsh'], '0.2.0-rc.2');
const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
assert.match(patch, /id: wish-willow-p0/);
assert.match(patch, /name: dsh-wish-willow/);
let declaration;
new vm.Script(await readFile(new URL('../client.js', import.meta.url), 'utf8')).runInNewContext({
  window: { __ModuleLoader__: { load: row => { declaration = row; } } },
});
assert.equal(declaration.id, manifest.name);
for (const path of ['src/model.js', 'src/host.js', 'client.js']) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  assert.equal(result.status, 0, `syntax: ${path}`);
}
for (const language of ['en', 'zh']) {
  const data = JSON.parse(await readFile(new URL(`../locale/${language}.json`, import.meta.url), 'utf8'));
  assert.ok(data.meta.title && data.meta.description);
}
await import('../src/host.js');

// P1 companion bundle: same install contract, separate package, separate domain.
const p1 = JSON.parse(await readFile(new URL('../packages/p1/package.json', import.meta.url), 'utf8'));
assert.equal(p1.name, 'dsh-wish-willow-p1');
assert.equal(p1.license, 'MIT');
assert.equal(p1.author, 'wangxiaow');
assert.equal(p1.repository.url, 'git+https://github.com/wangxiaow/dsh-wish-willow.git');
assert.equal(p1.dsh.client.platform, 'web');
assert.equal(p1.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(p1.scripts?.prepare, undefined, 'Git install must not need lifecycle build scripts');
assert.equal(p1.peerDependencies['@deepseek-ai/dsh'], '0.2.0-rc.2');
for (const entry of ['src/', 'client.js', 'cordis.patch.yml', 'README.md', 'LICENSE']) assert.ok(p1.files.includes(entry), `P1 files must ship ${entry}`);
const p1Patch = await readFile(new URL('../packages/p1/cordis.patch.yml', import.meta.url), 'utf8');
assert.match(p1Patch, /id: wish-willow-p1/);
assert.match(p1Patch, /name: dsh-wish-willow-p1/);
let p1Declaration;
new vm.Script(await readFile(new URL('../packages/p1/client.js', import.meta.url), 'utf8')).runInNewContext({
  window: { __ModuleLoader__: { load: row => { p1Declaration = row; } } },
});
assert.equal(p1Declaration.id, p1.name, 'lazy Client factory id must equal the package name');
for (const path of ['packages/p1/src/state.js', 'packages/p1/src/artifacts.js', 'packages/p1/src/orchestrator.js', 'packages/p1/src/host.js', 'packages/p1/client.js']) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  assert.equal(result.status, 0, `syntax: ${path}`);
}
const p1Host = await import('../packages/p1/src/host.js');
assert.equal(p1Host.evolutionDomain.name, 'wish_willow_p1');
assert.equal(p1Host.evolutionDomain.version, 1);
assert.notEqual(p1Host.evolutionDomain.name, (await import('../src/host.js')).productDomain.name, 'P1 must not write the accepted P0 domain');
const p1Readme = await readFile(new URL('../packages/p1/README.md', import.meta.url), 'utf8');
assert.match(p1Readme, /wish_willow_p1/);
assert.match(p1Readme, /同一存储 root 只允许一个写入 Host/);
console.log('Build PASS: install-ready JavaScript entrypoints, lazy Client factory, Bundle manifest and schema import. No transpilation needed.');
