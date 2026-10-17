import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(manifest.name, 'dsh-wish-willow');
assert.equal(manifest.version, '0.3.2');
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
for (const entry of ['src/', 'packages/p1/src/', 'client.js', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
  assert.ok(manifest.files.includes(entry), `unified bundle must ship ${entry}`);
}

// One install unit: the patch inserts exactly one row and no legacy companion row.
const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
assert.match(patch, /id: wish-willow\n/);
assert.match(patch, /name: dsh-wish-willow\n/);
assert.doesNotMatch(patch, /id: wish-willow-p0/);
assert.doesNotMatch(patch, /id: wish-willow-p1/);
assert.equal((patch.match(/^ {4}- id:/gm) ?? []).length, 1, 'the unified bundle must insert exactly one Host row');
assert.equal((patch.match(/^- insert:/gm) ?? []).length, 1, 'the unified bundle must use one insert list');

// One client entry: a single lazy module declaring the package name and one Slot registration.
const clientCode = await readFile(new URL('../client.js', import.meta.url), 'utf8');
let declaration;
new vm.Script(clientCode).runInNewContext({ window: { __ModuleLoader__: { load: row => { declaration = row; } } } });
assert.equal(declaration.id, manifest.name, 'lazy Client factory id must equal the package name');
assert.equal((clientCode.match(/__ModuleLoader__\.load\(/g) ?? []).length, 1);
assert.equal((clientCode.match(/ctx\.slots\.register\(/g) ?? []).length, 1, 'the unified UI registers exactly one section');
assert.doesNotMatch(clientCode, /'wish-willow-p0'|'wish-willow-p1'/);

for (const path of ['src/host.js', 'src/native-intake.js', 'src/p0/host.js', 'src/p0/model.js', 'client.js']) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  assert.equal(result.status, 0, `syntax: ${path}`);
}
for (const language of ['en', 'zh']) {
  const data = JSON.parse(await readFile(new URL(`../locale/${language}.json`, import.meta.url), 'utf8'));
  assert.ok(data.meta.title && data.meta.description);
}

// The unified plugin composition: one row, two unchanged internal storage domains.
const unified = await import('../src/host.js');
assert.equal(unified.name, 'wish-willow');
assert.deepEqual(unified.inject, ['storageDomain', 'typertGateway', 'agents', 'agentDefaultModel', 'agentPresets', 'sandboxPolicy', 'sessions', 'sessionQuery', 'tools', 'systemPrompt', 'userQuestions']);
assert.equal(typeof unified.apply, 'function');
assert.equal(unified.productDomain.name, 'wish_willow');
assert.equal(unified.productDomain.version, 1);
assert.equal(unified.evolutionDomain.name, 'wish_willow_p1');
assert.equal(unified.evolutionDomain.version, 1);
assert.notEqual(unified.productDomain.name, unified.evolutionDomain.name, 'the two historical domains must stay separate');
const hostCode = await readFile(new URL('../src/host.js', import.meta.url), 'utf8');
assert.match(hostCode, /from '\.\/p0\/host\.js'/);
assert.match(hostCode, /from '\.\.\/packages\/p1\/src\/host\.js'/);

// The frozen legacy companion bundle stays installable so existing installs keep working
// and the documented rollback path is not a dead end.
const p1 = JSON.parse(await readFile(new URL('../packages/p1/package.json', import.meta.url), 'utf8'));
assert.equal(p1.name, 'dsh-wish-willow-p1');
assert.equal(p1.version, '0.2.0-p1.1');
assert.equal(p1.license, 'MIT');
assert.equal(p1.author, 'wangxiaow');
assert.equal(p1.repository.url, 'git+https://github.com/wangxiaow/dsh-wish-willow.git');
assert.equal(p1.dsh.client.platform, 'web');
assert.equal(p1.dsh.bundle.patch, './cordis.patch.yml');
assert.equal(p1.scripts?.prepare, undefined, 'Git install must not need lifecycle build scripts');
assert.equal(p1.peerDependencies['@deepseek-ai/dsh'], '0.2.0-rc.2');
for (const entry of ['src/', 'client.js', 'cordis.patch.yml', 'README.md', 'LICENSE']) assert.ok(p1.files.includes(entry), `legacy companion must ship ${entry}`);
const p1Patch = await readFile(new URL('../packages/p1/cordis.patch.yml', import.meta.url), 'utf8');
assert.match(p1Patch, /id: wish-willow-p1/);
assert.match(p1Patch, /name: dsh-wish-willow-p1/);
let p1Declaration;
new vm.Script(await readFile(new URL('../packages/p1/client.js', import.meta.url), 'utf8')).runInNewContext({
  window: { __ModuleLoader__: { load: row => { p1Declaration = row; } } },
});
assert.equal(p1Declaration.id, p1.name, 'legacy lazy Client factory id must equal its package name');
for (const path of ['packages/p1/src/state.js', 'packages/p1/src/artifacts.js', 'packages/p1/src/delivery.js', 'packages/p1/src/delivery-runner.js', 'packages/p1/src/quality-gate.js', 'packages/p1/src/reviewer.js', 'packages/p1/src/orchestrator.js', 'packages/p1/src/host.js', 'packages/p1/client.js']) {
  const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
  assert.equal(result.status, 0, `syntax: ${path}`);
}

// F1 (0.3.2): delivery collection is exclusion based, so every legitimate entry point is shipped
// while credentials, dependency trees and build output stay out and are recorded instead of dropped.
const artifacts = await import('../packages/p1/src/artifacts.js');
for (const name of ['index.html', 'app.js', 'start.ps1', 'run.sh', 'start.cmd', 'start.bat', 'app.py', 'server.rb', 'main.go', '.env.example', 'logo.png', 'data.json']) {
  assert.equal(artifacts.classifyDeliverable(name).include, true, `0.3.2 must deliver ${name}`);
}
for (const name of ['.env', '.env.local', '.env.production.local', '.env.development.local', 'credentials.txt',
  '.credentials.yaml', 'secrets.md', 'server.pem', 'private.key', 'credentials.json', 'id_rsa', 'app.exe', 'lib.dll',
  'bundle.zip', 'debug.log']) {
  assert.equal(artifacts.classifyDeliverable(name).include, false, `0.3.2 must never deliver ${name}`);
  assert.ok(artifacts.classifyDeliverable(name).reason, `the exclusion of ${name} must carry a reason`);
}
assert.equal(artifacts.detectCredentialContent(Buffer.from('-----BEGIN RSA PRIVATE KEY-----\n')), 'credential-content');
assert.equal(artifacts.detectCredentialContent(Buffer.from('const a = 1\n')), null);
assert.equal(artifacts.runnableSource.test('start.ps1'), true);
assert.equal(artifacts.snapshotPolicy, 'wish-willow-source-snapshot/2');
const delivery = await import('../packages/p1/src/delivery.js');
assert.deepEqual(delivery.commandFileReferences('powershell -NoProfile -ExecutionPolicy Bypass -File .\\start.ps1'), ['start.ps1']);
assert.equal(delivery.resolveStartEntry('node server.js'), 'server.js');
assert.equal(typeof delivery.verifyDeliveryIntegrity, 'function');
// F1-A (0.3.2): only a complete foreground exit DTO can prove a command passed. An environment
// block, a promotion to a background job, a timeout or an abort never counts as success.
assert.equal(delivery.commandPassed({ kind: 'foreground', exitCode: 0 }), true);
for (const blocked of [{ kind: 'foreground', exitCode: 0, timedOut: true }, { kind: 'foreground', exitCode: 0, aborted: true },
  { kind: 'foreground', exitCode: 0, denied: true }, { kind: 'foreground', exitCode: 0, runnerFailed: true },
  { kind: 'foreground', exitCode: 7 }, { kind: 'promoted', exitCode: null }, { kind: 'background', exitCode: null },
  { kind: 'error', exitCode: null }]) assert.equal(delivery.commandPassed(blocked), false, JSON.stringify(blocked));
assert.equal(delivery.validateHealthCheck(undefined), undefined);
assert.throws(() => delivery.validateHealthCheck({ url: 'http://example.com:80/', contains: 'x' }), /loopback HTTP port/);
assert.throws(() => delivery.validateHealthCheck({ url: 'http://127.0.0.1:80/', contains: ' ' }), /loopback HTTP port/);
assert.deepEqual(delivery.validateHealthCheck({ url: 'http://127.0.0.1:8099/', contains: 'Hello World' }),
  { url: 'http://127.0.0.1:8099/', contains: 'Hello World' });
// F1-C (0.3.2): snapshot paths are canonical, bounded and never escape their root.
for (const bad of ['../x', 'a/../x', '/x', 'C:/x', 'C:x', 'a\\b', 'x:stream', 'a//b', './x', 'a/', 'a.', 'a ']) {
  assert.throws(() => artifacts.validateRelativePath(bad), `invalid snapshot path must be refused: ${JSON.stringify(bad)}`);
}
for (const good of ['assets/icon.png', 'index.html', 'a/b/c.txt']) assert.equal(artifacts.validateRelativePath(good), good);
assert.throws(() => artifacts.validateSnapshotEntries([]), /non-empty/);
assert.throws(() => artifacts.validateSnapshotEntries([{ path: '../escape.js', bytes: 1, sha256: 'a'.repeat(64) }]), /Invalid snapshot relative path/);
assert.throws(() => artifacts.validateSnapshotEntries([{ path: 'a.js', bytes: -1, sha256: 'a'.repeat(64) }]), /Invalid snapshot byte count/);
assert.throws(() => artifacts.validateSnapshotEntries([{ path: 'a.js', bytes: 1, sha256: 'nope' }]), /Invalid snapshot SHA256/);
assert.deepEqual(artifacts.validateSnapshotEntries([{ path: 'a.js', bytes: 3, sha256: artifacts.sha256(Buffer.from('abc')) }]),
  { files: 1, bytes: 3 });
const legacyHost = await import('../packages/p1/src/host.js');
assert.equal(legacyHost.evolutionDomain.name, 'wish_willow_p1');
assert.equal(legacyHost.evolutionDomain.version, 1);
const p1Readme = await readFile(new URL('../packages/p1/README.md', import.meta.url), 'utf8');
assert.match(p1Readme, /wish_willow_p1/);
console.log('Build PASS: one installable Wish Willow bundle (composition root, P0 + P1 internal modules, single Client entry) with the frozen legacy companion retained for rollback. No transpilation needed.');

