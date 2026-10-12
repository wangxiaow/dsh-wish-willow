import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { temporary } from './helpers/temp.mjs';
import { commandFileReferences, rebindWorkspacePath, resolveStartEntry, verifyDeliveryIntegrity } from '../packages/p1/src/delivery.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const START = 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\start.ps1';

/** Build the on-disk shape of an existing release snapshot, so the gate can be driven directly. */
async function craftSnapshot(root, files, { excluded = [], versionId = 'version-1' } = {}) {
  const versionDir = join(root, 'deliveries', versionId);
  const snapshotPath = join(versionDir, 'source');
  const entries = [];
  for (const [name, content] of Object.entries(files)) {
    const bytes = Buffer.from(content);
    await mkdir(dirname(join(snapshotPath, name)), { recursive: true });
    await writeFile(join(snapshotPath, name), bytes);
    entries.push({ path: name, sha256: sha256(bytes), bytes: bytes.length, content: bytes.toString('base64') });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = { format: 2, policy: 'wish-willow-source-snapshot/2', versionId, complete: true,
    limits: { maxFiles: 500, maxFileBytes: 2000000, maxTotalBytes: 20000000 }, totals: { files: entries.length, bytes: entries.reduce((total, entry) => total + entry.bytes, 0) },
    excluded, excludedCount: excluded.length, excludedTruncated: false, entries };
  const manifestPath = join(versionDir, 'source-snapshot.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifestPath, manifest, snapshotPath, versionDir };
}

const okRun = () => async () => ({ kind: 'foreground', exitCode: 0, timedOut: false, denied: false, runnerFailed: false, stdout: '', stderr: '' });

function options(root, snapshot, startCommand, runCommand = okRun(), evidence) {
  // The recorded commands name the product directory absolutely, exactly like the real
  // PowerShell verification commands of the Desktop acceptance delivery did.
  const absolute = join(root, 'workspace');
  return { manifestPath: snapshot.manifestPath, manifest: snapshot.manifest, snapshotPath: snapshot.snapshotPath,
    workspace: absolute, startCommand,
    evidence: evidence ?? [{ kind: 'build', command: `Set-Location -LiteralPath '${absolute}'; node --check app.js`, success: true, exitCode: 0 },
      { kind: 'test', command: `Set-Location -LiteralPath '${absolute}'; node --check app.js`, success: true, exitCode: 0 },
      { kind: 'run', command: `Set-Location -LiteralPath '${absolute}'; node app.js`, success: true, exitCode: 0 }],
    // The fixture root is the Host-controlled tree for a unit test, so a `node_modules` directly
    // inside it is refused while an unrelated ancestor above it is only recorded.
    isolationRoot: root,
    restoreRoot: join(root, 'restores', 'version-1'), replayRoot: join(root, 'replays', 'version-1'),
    runCommand };
}

test('F1: a release whose start command names a file the snapshot lost is refused', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'index.html': '<title>Hello World</title>\n', 'README.md': '# readme\n' });
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, START)), error => {
    assert.equal(error.code, 'wish-willow-p1/delivery-incomplete');
    assert.match(error.message, /start\.ps1/);
    assert.match(error.message, /start command/);
    // The manifest itself was consistent; only the completeness gate can catch this.
    assert.ok(snapshot.manifest.entries.every(entry => entry.path !== 'start.ps1'));
    return true;
  });
});

test('the refusal names the policy reason when the entry was filtered out of the snapshot', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'index.html': '<title>x</title>\n' },
    { excluded: [{ path: 'start.ps1', reason: 'credential-file' }] });
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, START)), /excluded from the snapshot \(credential-file\)/);
});

test('a start command pointing into a policy-excluded directory is refused with the reason', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'index.html': '<title>x</title>\n' },
    { excluded: [{ path: 'build', reason: 'dependency-or-build-directory' }] });
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, 'node build/server.js')),
    /excluded from the snapshot \(dependency-or-build-directory\)/);
});

test('a complete snapshot passes the gate, is restored outside the product workspace and is replayed in an isolated copy', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, {
    'app.js': 'console.log("ok")\n', 'index.html': '<title>Hello World</title>\n', 'start.ps1': 'Write-Output "up"\n',
  });
  const calls = [];
  const runCommand = async (command, workdir) => { calls.push({ command, workdir }); return { kind: 'foreground', exitCode: 0, timedOut: false, denied: false, runnerFailed: false }; };
  const report = await verifyDeliveryIntegrity(options(root, snapshot, START, runCommand));

  assert.equal(report.ok, true);
  assert.equal(report.startEntry, 'start.ps1');
  assert.deepEqual(report.references, ['start.ps1']);
  assert.equal(report.replay.status, 'passed');
  assert.equal(report.entries, 3);
  assert.ok(report.checks.length >= 6);
  assert.ok(report.checks.every(entry => entry.ok));

  // Restored and byte-identical in a directory that is NOT the product working directory.
  assert.equal(relative(join(root, 'workspace'), report.restorePath).startsWith('..'), true, report.restorePath);
  assert.equal(await readFile(join(report.restorePath, 'start.ps1'), 'utf8'), 'Write-Output "up"\n');

  // Every replay ran inside the isolated copy, never in the product working directory.
  const replayDir = join(root, 'replays', 'version-1');
  assert.ok(calls.length >= 4, `build/test/run plus the bounded start launch: ${calls.length}`);
  for (const call of calls) assert.equal(call.workdir, replayDir);
  assert.deepEqual(report.replay.commands.map(row => row.kind).sort(), ['build', 'run', 'start', 'test']);
  // The original product directory operand was rebound to the isolated copy in every recorded command.
  for (const row of report.replay.commands) {
    assert.equal(row.command.includes(`-LiteralPath '${join(root, 'workspace')}'`), false, row.command);
    assert.equal(row.workdir, replayDir);
    if (row.kind !== 'start') assert.ok(row.command.includes(replayDir), row.command);
  }
  assert.equal(await readFile(join(replayDir, 'start.ps1'), 'utf8'), 'Write-Output "up"\n');
});

test('a failing isolated replay blocks the release and keeps the real exit code', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n', 'start.ps1': 'Write-Output "up"\n' });
  const runCommand = async command => (command.includes('app.js')
    ? { kind: 'foreground', exitCode: 7, timedOut: false, denied: false, runnerFailed: false, stderr: 'boom' }
    : { kind: 'foreground', exitCode: 0, timedOut: false, denied: false, runnerFailed: false });
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, START, runCommand)), error => {
    assert.equal(error.code, 'wish-willow-p1/delivery-incomplete');
    assert.match(error.message, /exit 7|7/);
    assert.ok(error.details.checks.some(entry => entry.ok === false));
    return true;
  });
});

test('a start timeout alone never proves a healthy service', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'server.js': 'console.log("ok")\n' });
  const runCommand = async (_command, _workdir, _timeout, { kind }) => kind === 'start'
    ? { kind: 'foreground', exitCode: null, timedOut: true }
    : { kind: 'foreground', exitCode: 0 };
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, 'node server.js', runCommand)), /timedOut=true/);
});

test('a snapshot whose bytes were changed after the manifest was written is refused', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n', 'start.ps1': 'Write-Output "up"\n' });
  await writeFile(join(snapshot.snapshotPath, 'app.js'), 'console.log("tampered")\n');
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, START)), /app\.js/);

  const other = await temporary(t);
  const second = await craftSnapshot(other, { 'app.js': 'console.log("ok")\n', 'start.ps1': 'Write-Output "up"\n' });
  await writeFile(join(second.snapshotPath, 'unrecorded.js'), 'console.log("extra")\n');
  await assert.rejects(verifyDeliveryIntegrity(options(other, second, START)), /exactly the recorded files/);
});

test('the snapshot is refused when it cannot be restored outside the product workspace', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n', 'start.ps1': 'Write-Output "up"\n' });
  const broken = options(root, snapshot, START);
  broken.restoreRoot = join(root, 'workspace', 'inside');
  await assert.rejects(verifyDeliveryIntegrity(broken), /outside the product working directory/);
});

test('command reference parsing only treats real file operands as delivery dependencies', () => {
  assert.deepEqual(commandFileReferences(START), ['start.ps1']);
  assert.deepEqual(commandFileReferences('node server.js'), ['server.js']);
  assert.deepEqual(commandFileReferences('node app.js add milk'), ['app.js']);
  assert.deepEqual(commandFileReferences('python app.py --port 8090'), ['app.py']);
  assert.deepEqual(commandFileReferences('cmd /c start.bat'), ['start.bat']);
  assert.deepEqual(commandFileReferences('sh ./run.sh --quiet'), ['run.sh']);
  assert.deepEqual(commandFileReferences('node --check app.test.js'), ['app.test.js']);
  assert.deepEqual(commandFileReferences('node -e "process.exit(0)"'), []);
  assert.deepEqual(commandFileReferences('npm start'), []);
  assert.deepEqual(commandFileReferences('powershell -File C:\\tools\\serve.ps1'), ['C:/tools/serve.ps1']);
  assert.deepEqual(commandFileReferences(undefined), []);
});

test('start entry resolution picks the script the delivered command actually runs', () => {
  assert.equal(resolveStartEntry(START), 'start.ps1');
  assert.equal(resolveStartEntry('node server.js'), 'server.js');
  assert.equal(resolveStartEntry('sh scripts/dev/run.sh'), 'scripts/dev/run.sh');
  assert.equal(resolveStartEntry('npm start'), null);
  assert.equal(resolveStartEntry('node --check app.js && node server.js'), 'server.js');
});

test('rebinding replaces the original product directory wherever the recorded command names it', () => {
  const from = 'C:\\a b\\projects\\p1';
  const to = 'C:\\c\\replay';
  assert.equal(rebindWorkspacePath(`Set-Location 'C:\\a b\\projects\\p1'`, from, to), `Set-Location 'C:\\c\\replay'`);
  assert.equal(rebindWorkspacePath('cd C:/a b/projects/p1 && node app.js', from, to), 'cd C:/c/replay && node app.js');
  assert.equal(rebindWorkspacePath('node app.js', from, to), 'node app.js');
});

test('rebinding a replay root nested below the product directory replaces it exactly once', () => {
  // The production shape: the independent copy lives under the product directory, so every
  // replacement form is a prefix of the replacement itself. A second pass would duplicate it.
  const from = 'C:\\work\\p1';
  const to = 'C:\\work\\p1\\.wish-willow\\replay\\v1';
  assert.equal(rebindWorkspacePath(`node 'C:\\work\\p1\\app.js'`, from, to), `node 'C:\\work\\p1\\.wish-willow\\replay\\v1\\app.js'`);
  assert.equal(rebindWorkspacePath(`node 'C:/work/p1/app.js'`, from, to), `node 'C:/work/p1/.wish-willow/replay/v1/app.js'`);
  assert.equal((rebindWorkspacePath('C:\\work\\p1\\x.js', from, to).match(/replay/g) ?? []).length, 1);
});

test('a service delivery is only released when its own health probe really answered', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'server.js': 'console.log("ok")\n' });
  const healthCheck = { url: 'http://127.0.0.1:8099/', contains: 'Hello World' };
  const healthy = async (_command, _workdir, _timeout, { kind }) => kind === 'start'
    ? { kind: 'background', jobId: 'job-1', exitCode: null, healthy: true, stopped: true, stdout: 'WISH_WILLOW_HEALTH_OK' }
    : { kind: 'foreground', exitCode: 0 };
  const report = await verifyDeliveryIntegrity({ ...options(root, snapshot, 'node server.js', healthy), healthCheck });
  assert.equal(report.ok, true);
  assert.deepEqual(report.healthCheck, { url: 'http://127.0.0.1:8099/', contains: 'Hello World' });
  assert.equal(report.replay.commands.find(row => row.kind === 'start').status, 'passed');

  // A launch the runner could not confirm as healthy, or could not stop, is never a PASS.
  for (const override of [{ healthy: false, stopped: true }, { healthy: true, stopped: false }]) {
    const second = await temporary(t);
    const other = await craftSnapshot(second, { 'server.js': 'console.log("ok")\n' });
    const runner = async (_command, _workdir, _timeout, { kind }) => kind === 'start'
      ? { kind: 'background', jobId: 'job-2', exitCode: null, ...override } : { kind: 'foreground', exitCode: 0 };
    await assert.rejects(verifyDeliveryIntegrity({ ...options(second, other, 'node server.js', runner), healthCheck }),
      /start command launches from the isolated snapshot copy/);
  }
  // A non-loopback or credential-bearing health URL is refused before anything is launched.
  await assert.rejects(verifyDeliveryIntegrity({ ...options(root, snapshot, 'node server.js', healthy),
    healthCheck: { url: 'http://example.com:80/', contains: 'x' } }), /loopback HTTP port/);
  await assert.rejects(verifyDeliveryIntegrity({ ...options(root, snapshot, 'node server.js', healthy),
    healthCheck: { url: 'http://127.0.0.1:8099/', contains: '  ' } }), /loopback HTTP port/);
});

test('a delivery with third-party dependencies is refused while P1 has no reproduced install source', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n',
    'package.json': '{ "name": "x", "dependencies": { "left-pad": "1.0.0" } }\n' });
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, 'node app.js')), /no independently reproduced dependency source/);
  const scripts = await temporary(t);
  const npmStart = await craftSnapshot(scripts, { 'app.js': 'console.log("ok")\n',
    'package.json': '{ "name": "x", "scripts": { "start": "node app.js" } }\n' });
  const report = await verifyDeliveryIntegrity(options(scripts, npmStart, 'npm start'));
  assert.equal(report.startEntry, 'app.js');
  assert.deepEqual(report.references, ['app.js']);
});

test('ambient node_modules above the independent copy refuses the release', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n' });
  await mkdir(join(root, 'node_modules', 'dep'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'dep', 'index.js'), 'module.exports = 1\n');
  await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, 'node app.js')), /ambient node_modules/);
});

test('a pre-existing restore target is refused and its contents are never overwritten', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n' });
  const restoreRoot = join(root, 'restores', 'version-1');
  await mkdir(restoreRoot, { recursive: true });
  const sentinel = join(restoreRoot, 'app.js');
  await writeFile(sentinel, 'console.log("untouched")\n');
  await assert.rejects(verifyDeliveryIntegrity({ ...options(root, snapshot, 'node app.js'), restoreRoot }), /target already exists/);
  assert.equal(await readFile(sentinel, 'utf8'), 'console.log("untouched")\n');

  // A replay target that already holds an unrecorded file can never become a PASS either.
  const other = await temporary(t);
  const second = await craftSnapshot(other, { 'app.js': 'console.log("ok")\n' });
  const replayRoot = join(other, 'replays', 'version-1');
  await mkdir(replayRoot, { recursive: true });
  await writeFile(join(replayRoot, 'injected.js'), 'console.log("injected")\n');
  await assert.rejects(verifyDeliveryIntegrity({ ...options(other, second, 'node app.js'), replayRoot }), /target already exists/);
  assert.equal(await readFile(join(replayRoot, 'injected.js'), 'utf8'), 'console.log("injected")\n');
});

test('a compound or ambiguous start command cannot stand in for a real entry point', async t => {
  const root = await temporary(t);
  const snapshot = await craftSnapshot(root, { 'app.js': 'console.log("ok")\n', 'other.js': 'console.log("x")\n' });
  for (const startCommand of ['node app.js; Write-Output ok', 'node app.js | Out-Null', 'node missing.js; Write-Output ok', '']) {
    await assert.rejects(verifyDeliveryIntegrity(options(root, snapshot, startCommand)), /supported single invocation/);
  }
});
