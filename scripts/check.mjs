import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.name, 'dsh-wish-willow');
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
console.log('Build PASS: install-ready JavaScript entrypoints, lazy Client factory, Bundle manifest and schema import. No transpilation needed.');
