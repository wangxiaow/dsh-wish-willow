import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { temporary } from './helpers/temp.mjs';
import { assertPlainPath, collectDeliverables, snapshotSources, snapshotLimits, snapshotPolicy,
  validateRelativePath, validateSnapshotEntries } from '../packages/p1/src/artifacts.js';

const sha256 = async path => (await import('node:crypto')).createHash('sha256').update(await readFile(path)).digest('hex');

test('F1: an entry point whose extension is not HTML/JS is captured in the immutable snapshot', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(workspace, { recursive: true });
  // The exact shape of the delivered product that reproduced F1: a static page whose only
  // documented start command is a PowerShell script next to it.
  const delivered = {
    'index.html': '<!doctype html>\n<title>Hello World</title>\n',
    'README.md': 'Start: powershell -NoProfile -ExecutionPolicy Bypass -File .\\start.ps1\n',
    'start.ps1': 'param([int]$Port = 8080)\nWrite-Output "listening"\n',
    'run.sh': '#!/bin/sh\nexec node server.js\n',
    'start.cmd': '@echo off\r\nnode server.js\r\n',
    'start.bat': '@echo off\r\nnode server.js\r\n',
    'app.py': 'print("hello")\n',
    'server.js': 'console.log("ok")\n',
    'style.css': 'body { margin: 0 }\n',
    'data.json': '{ "ok": true }\n',
    'notes.txt': 'plain text\n',
  };
  for (const [name, content] of Object.entries(delivered)) await writeFile(join(workspace, name), content);

  const snapshot = await snapshotSources(workspace, join(root, 'deliveries'), 'version-1');
  const manifest = JSON.parse(await readFile(snapshot.manifestPath, 'utf8'));
  assert.deepEqual(manifest.entries.map(row => row.path).sort(), Object.keys(delivered).sort());
  assert.equal(manifest.complete, true);
  assert.equal(manifest.policy, snapshotPolicy);
  assert.equal(manifest.format, 2);
  assert.equal(manifest.totals.files, Object.keys(delivered).length);
  assert.equal(manifest.totals.bytes, Object.values(delivered).reduce((total, content) => total + Buffer.byteLength(content), 0));
  // F1 itself: the PowerShell entry point must be inside the snapshot, byte for byte.
  assert.equal(manifest.entries.find(row => row.path === 'start.ps1').sha256, await sha256(join(workspace, 'start.ps1')));
  assert.equal((await readFile(join(snapshot.snapshotPath, 'start.ps1'), 'utf8')), delivered['start.ps1']);
  for (const entry of manifest.entries) {
    assert.equal(await sha256(join(snapshot.snapshotPath, entry.path)), entry.sha256, entry.path);
  }
});

test('binary assets of a delivery are captured while build output stays out', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(join(workspace, 'assets'), { recursive: true });
  await writeFile(join(workspace, 'index.html'), '<title>asset</title>\n');
  // A real PNG header plus payload: a deliverable asset, not build output.
  await writeFile(join(workspace, 'assets', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]));
  await writeFile(join(workspace, 'assets', 'app.css'), 'body{}\n');
  for (const [name, file] of [['node_modules/dep/index.js'], ['dist/bundle.js'], ['build/out.js'], ['out/out.js'],
    ['coverage/lcov.js'], ['.next/server.js'], ['__pycache__/a.pyc'], ['target/debug/app.rs'], ['.git/config'], ['.wish-willow/replay/old/index.html']]) {
    await mkdir(join(workspace, name, '..'), { recursive: true });
    await writeFile(join(workspace, name), 'x\n');
  }
  const collected = await collectDeliverables(workspace);
  assert.deepEqual(collected.entries.map(row => row.path), ['assets/app.css', 'assets/logo.png', 'index.html']);
  for (const directory of ['node_modules', 'dist', 'build', 'out', 'coverage', '.next', '__pycache__', 'target', '.git', '.wish-willow']) {
    assert.ok(collected.excluded.some(row => row.path === directory || row.path.startsWith(`${directory}/`)), `exclusion of ${directory} must be recorded, never silent`);
  }
  assert.equal(collected.excludedTruncated, false);
});

test('environment, credential and private configuration files never reach the snapshot', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, 'index.html'), '<title>secrets</title>\n');
  const secrets = ['.env', '.env.local', '.env.production', '.npmrc', '.netrc', 'credentials.json', 'secrets.yaml',
    'server.pem', 'private.key', 'store.pfx', 'id_rsa', '.htpasswd', '.pgpass', '.env.production.local',
    '.env.development.local', '.env.example.local', '.env.sample.production', '.credentials.yaml',
    'credentials.txt', 'secrets.md', 'secrets.template.yaml'];
  for (const name of secrets) await writeFile(join(workspace, name), 'SUPER-SECRET-VALUE\n');
  await writeFile(join(workspace, 'config.json'), '{\n  "note": "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n"\n}\n');
  const templates = ['.env.example', '.env.production.example', '.credentials.sample', 'secrets.template'];
  for (const name of templates) await writeFile(join(workspace, name), 'API_BASE=http://127.0.0.1:8080\n');
  // A placeholder name is never permission to ship credential-shaped content.
  await writeFile(join(workspace, '.env.sample'), `TOKEN=sk-${'a'.repeat(24)}\n`);

  const collected = await collectDeliverables(workspace);
  assert.deepEqual(collected.entries.map(row => row.path).sort(), [...templates, 'index.html'].sort());
  for (const name of secrets) assert.ok(collected.excluded.some(row => row.path === name && row.reason === 'credential-file'), name);
  for (const name of ['config.json', '.env.sample']) assert.ok(collected.excluded.some(row => row.path === name && row.reason === 'credential-content'), name);
  const snapshot = await snapshotSources(workspace, join(root, 'deliveries'), 'version-secrets');
  const manifestBytes = await readFile(snapshot.manifestPath, 'utf8');
  assert.doesNotMatch(manifestBytes, /SUPER-SECRET-VALUE/);
  assert.doesNotMatch(manifestBytes, /BEGIN RSA PRIVATE KEY/);
});

test('file count, per-file and total size limits still refuse oversized deliveries', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, 'index.html'), '<title>limit</title>\n');
  await writeFile(join(workspace, 'big.bin'), Buffer.alloc(snapshotLimits.maxFileBytes + 1, 1));
  await assert.rejects(collectDeliverables(workspace), /Source snapshot exceeds P1 limits/);

  const many = join(root, 'many');
  await mkdir(many, { recursive: true });
  await writeFile(join(many, 'index.html'), '<title>many</title>\n');
  for (let index = 0; index < snapshotLimits.maxFiles; index += 1) await writeFile(join(many, `file-${index}.js`), 'x\n');
  await assert.rejects(collectDeliverables(many), /Source snapshot exceeds P1 limits/);

  const total = join(root, 'total');
  await mkdir(total, { recursive: true });
  const payload = Buffer.alloc(snapshotLimits.maxFileBytes, 1);
  for (let index = 0; index < snapshotLimits.maxTotalBytes / snapshotLimits.maxFileBytes; index += 1) {
    await writeFile(join(total, `asset-${index}.bin`), payload);
  }
  await writeFile(join(total, 'index.html'), '<title>over total limit</title>\n');
  await assert.rejects(collectDeliverables(total), /Source snapshot exceeds P1 limits/);
});

test('the snapshot refuses symbolic links and a workspace with no runnable source', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, 'index.html'), '<title>link</title>\n');
  // A junction is the Windows way to create a directory link without elevation, and Node reports
  // it through lstat as a symbolic link, which is exactly the escape the collector must refuse.
  await mkdir(join(root, 'outside-dir'), { recursive: true });
  await writeFile(join(root, 'outside-dir', 'external.js'), 'console.log("outside")\n');
  await symlink(join(root, 'outside-dir'), join(workspace, 'linked-dir'), 'junction');
  await assert.rejects(collectDeliverables(workspace), /Source snapshot refuses symbolic links/);

  const empty = join(root, 'empty');
  await mkdir(empty, { recursive: true });
  await writeFile(join(empty, 'LICENSE'), 'MIT\n');
  await writeFile(join(empty, 'notes.md'), 'documentation only\n');
  await assert.rejects(snapshotSources(empty, join(root, 'deliveries'), 'version-empty'), /No runnable source files found/);
});

test('a repeated snapshot of the same version stays immutable and rejects conflicting content', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(workspace, { recursive: true });
  await writeFile(join(workspace, 'index.html'), '<title>immutable</title>\n');
  const deliveries = join(root, 'deliveries');
  const first = await snapshotSources(workspace, deliveries, 'version-immutable');
  const again = await snapshotSources(workspace, deliveries, 'version-immutable');
  assert.equal(again.manifestPath, first.manifestPath);
  assert.equal(again.sha256, first.sha256);
  await writeFile(join(workspace, 'index.html'), '<title>changed</title>\n');
  await assert.rejects(snapshotSources(workspace, deliveries, 'version-immutable'), /Immutable source snapshot conflict/);
});

const manifestEntry = (name, text = 'x') => {
  const bytes = Buffer.from(text);
  return { path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), content: bytes.toString('base64') };
};

test('manifest paths refuse traversal, absolute paths, ADS and filename aliases without normalizing them', () => {
  const invalid = ['', '.', '..', '/app.js', 'a/../app.js', 'a/./app.js', 'a//app.js', 'a/',
    'C:/app.js', 'C:app.js', 'a\\app.js', '\\\\server\\share\\app.js', 'app.js:stream',
    'a.', 'a ', 'CON', 'nul.js', 'AUX/app.js', 'a\0b', 'a\nb', 'a?b.js'];
  for (const name of invalid) assert.throws(() => validateRelativePath(name), /Invalid snapshot relative path/, JSON.stringify(name));
  for (const name of ['app.js', 'assets/logo.png', '.well-known/data.json', 'scripts/dev/run.sh']) assert.equal(validateRelativePath(name), name);
});

test('manifest entry validation binds paths, count, byte limits, hashes and embedded bytes', () => {
  const valid = manifestEntry('app.js');
  assert.deepEqual(validateSnapshotEntries([valid, manifestEntry('empty.txt', '')]), { files: 2, bytes: 1 });
  assert.deepEqual(validateSnapshotEntries([{ path: valid.path, bytes: valid.bytes, sha256: valid.sha256 }]), { files: 1, bytes: 1 });
  for (const entries of [null, {}, []]) assert.throws(() => validateSnapshotEntries(entries), /non-empty array/);
  for (const entry of [null, [], { ...valid, path: '../escape.js' }, { ...valid, bytes: -1 },
    { ...valid, bytes: 0.5 }, { ...valid, bytes: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, sha256: 'bad' }, { ...valid, sha256: valid.sha256.toUpperCase() },
    { ...valid, bytes: 0 }, { ...valid, content: 'eB==' }, { ...valid, content: '!!!!' },
    { ...valid, content: null }, { ...valid, content: Buffer.from('y').toString('base64') }]) {
    assert.throws(() => validateSnapshotEntries([entry]), /snapshot|Snapshot/);
  }
  assert.throws(() => validateSnapshotEntries([valid, { ...valid }]), /Duplicate snapshot path/);
  if (process.platform === 'win32') assert.throws(() => validateSnapshotEntries([valid, { ...valid, path: 'APP.JS' }]), /Duplicate snapshot path/);
  const descriptor = { path: 'large.bin', bytes: snapshotLimits.maxFileBytes + 1, sha256: valid.sha256 };
  assert.throws(() => validateSnapshotEntries([descriptor]), /exceeds P1 limits/);
  const overCount = Array.from({ length: snapshotLimits.maxFiles + 1 }, (_, index) => manifestEntry(`file-${index}.js`, ''));
  assert.throws(() => validateSnapshotEntries(overCount), /exceeds P1 limits/);
  const overTotal = Array.from({ length: Math.floor(snapshotLimits.maxTotalBytes / snapshotLimits.maxFileBytes) + 1 },
    (_, index) => ({ path: `file-${index}.bin`, bytes: snapshotLimits.maxFileBytes, sha256: valid.sha256 }));
  assert.throws(() => validateSnapshotEntries(overTotal), /exceeds P1 limits/);
});

test('plain-path preflight allows only missing suffixes and never creates them', async t => {
  const root = await temporary(t);
  const directory = join(root, 'plain');
  await mkdir(directory);
  await writeFile(join(directory, 'file.txt'), 'plain\n');
  assert.equal(await assertPlainPath(directory), resolve(directory));
  const missing = join(directory, 'missing', 'nested');
  assert.equal(await assertPlainPath(missing, { allowMissing: true }), resolve(missing));
  await assert.rejects(lstat(join(directory, 'missing')), { code: 'ENOENT' });
  await assert.rejects(assertPlainPath(missing), { code: 'ENOENT' });
  await assert.rejects(assertPlainPath(join(directory, 'file.txt', 'child'), { allowMissing: true }), /ancestor is not a directory/);
});

test('plain-path preflight and collection reject root and ancestor junctions', async t => {
  const root = await temporary(t);
  const real = join(root, 'real');
  const alias = join(root, 'alias');
  await mkdir(join(real, 'workspace'), { recursive: true });
  await writeFile(join(real, 'workspace', 'index.html'), '<title>real</title>\n');
  await symlink(real, alias, 'junction');
  for (const target of [alias, join(alias, 'workspace'), join(alias, 'missing')]) {
    await assert.rejects(assertPlainPath(target, { allowMissing: true }), /symbolic links|junctions|redirected/);
  }
  await assert.rejects(collectDeliverables(alias), /symbolic links|junctions|redirected/);
  await assert.rejects(collectDeliverables(join(alias, 'workspace')), /symbolic links|junctions|redirected/);
  assert.equal(await readFile(join(real, 'workspace', 'index.html'), 'utf8'), '<title>real</title>\n');
});

test('snapshot version IDs and delivery roots cannot escape or overlap the source workspace', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  const deliveries = join(root, 'deliveries');
  await mkdir(workspace);
  await writeFile(join(workspace, 'index.html'), '<title>bounded</title>\n');
  for (const version of ['../escape', 'nested/version', '/absolute', 'C:drive', 'v:stream', 'v\\nested', '.', '..', 'v.']) {
    await assert.rejects(snapshotSources(workspace, deliveries, version), /snapshot|Snapshot/);
  }
  await assert.rejects(lstat(deliveries), { code: 'ENOENT' });
  for (const destination of [workspace, join(workspace, 'deliveries'), root]) {
    await assert.rejects(snapshotSources(workspace, destination, 'version-overlap'), /must not overlap/);
  }
  // No snapshot directory was ever created: neither the version root nor an external target.
  assert.deepEqual((await readdir(root)).filter(name => name !== '.wish-willow-test-owner'), ['workspace']);
  assert.deepEqual(await readdir(workspace), ['index.html']);
});

test('snapshot destinations reject junctions before creating a manifest or changing an external sentinel', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  const outside = join(root, 'outside');
  await mkdir(workspace);
  await mkdir(outside);
  await writeFile(join(workspace, 'index.html'), '<title>source</title>\n');
  await writeFile(join(outside, 'index.html'), 'external sentinel\n');
  const redirected = join(root, 'redirected');
  await symlink(outside, redirected, 'junction');
  for (const destination of [redirected, join(redirected, 'nested')]) {
    await assert.rejects(snapshotSources(workspace, destination, 'version-link'), /symbolic links|junctions|redirected/);
  }
  const deliveries = join(root, 'deliveries');
  const version = join(deliveries, 'version-link');
  await mkdir(version, { recursive: true });
  await symlink(outside, join(version, 'source'), 'junction');
  await assert.rejects(snapshotSources(workspace, deliveries, 'version-link'), /symbolic links|junctions|redirected/);
  await assert.rejects(lstat(join(version, 'source-snapshot.json')), { code: 'ENOENT' });

  await mkdir(join(workspace, 'assets'));
  await writeFile(join(workspace, 'assets', 'data.json'), '{"ok":true}\n');
  const nestedVersion = join(deliveries, 'version-nested');
  await mkdir(join(nestedVersion, 'source'), { recursive: true });
  await symlink(outside, join(nestedVersion, 'source', 'assets'), 'junction');
  await assert.rejects(snapshotSources(workspace, deliveries, 'version-nested'), /symbolic links|junctions|redirected/);
  await assert.rejects(lstat(join(nestedVersion, 'source-snapshot.json')), { code: 'ENOENT' });
  assert.deepEqual(await readdir(outside), ['index.html']);
  assert.equal(await readFile(join(outside, 'index.html'), 'utf8'), 'external sentinel\n');
});

test('a pre-existing manifest junction is not followed by the immutable-file EEXIST path', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  const deliveries = join(root, 'deliveries');
  const version = join(deliveries, 'version-existing');
  const outside = join(root, 'outside');
  await mkdir(workspace);
  await mkdir(version, { recursive: true });
  await mkdir(outside);
  await writeFile(join(workspace, 'index.html'), '<title>source</title>\n');
  await writeFile(join(outside, 'sentinel.txt'), 'do not touch\n');
  await symlink(outside, join(version, 'source-snapshot.json'), 'junction');
  await assert.rejects(snapshotSources(workspace, deliveries, 'version-existing'), /symbolic links|junctions|redirected/);
  assert.equal(await readFile(join(outside, 'sentinel.txt'), 'utf8'), 'do not touch\n');
  assert.deepEqual(await readdir(outside), ['sentinel.txt']);
  await assert.rejects(lstat(join(version, 'source')), { code: 'ENOENT' });
});
