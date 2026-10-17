// Single-use P3 Task 03 pack/offline-install preparation. No Host/model/ACL operation.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, lstat, readFile, writeFile, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import { repositoryRoot, acceptanceParent, assertNoLinks, createAcceptanceHome, isolatedEnvironment, within } from '../helpers/isolation.mjs';

const [mode, ledger] = process.argv.slice(2);
assert.ok(['prepare', 'check', 'pack', 'install'].includes(mode) && ledger, 'prepare|check|pack|install <new-ledger.json>');
const node = process.execPath;
const pnpm = 'C:\\Users\\wangw\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\pnpm\\bin\\pnpm.mjs';
const cli = path.join(repositoryRoot, '.research/installed/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js');
const hash = b => createHash('sha256').update(b).digest('hex');
const save = async (file, value) => { await assertNoLinks(file); await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };
const run = (args, cwd, env, log) => {
  // File descriptors, not captured pipe stdio; no sandbox permission expansion.
  const fd = log ? openSync(log, 'wx') : null;
  let r;
  try { r = spawnSync(node, args, { cwd, env, stdio: fd === null ? 'inherit' : ['inherit', fd, fd], shell: false, timeout: 120000 }); }
  finally { if (fd !== null) closeSync(fd); }
  if (r.error) throw r.error;
  return { args, cwd, exitCode: r.status, signal: r.signal, log };
};
if (mode === 'prepare') {
  await assert.rejects(lstat(path.resolve(ledger)), { code: 'ENOENT' });
  const id = path.basename(ledger).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  assert.ok(id, 'Prepare requires an explicit UUID in the new ledger name; permission retries must use the identical target');
  const home = path.join(acceptanceParent, `wish-willow-p3-intake-${id}`);
  await assertNoLinks(home);
  await assert.rejects(lstat(home), { code: 'ENOENT' });
  await createAcceptanceHome(home);
  const paths = { home, invocation: path.join(home, 'conversation'), projects: path.join(home, 'wish-willow'),
    packages: path.join(home, 'packages'), evidence: path.join(home, 'evidence'), logs: path.join(home, 'logs'), store: path.join(home, 'pnpm-store') };
  for (const dir of Object.values(paths)) if (dir !== home) await mkdir(dir);
  await mkdir(path.join(paths.invocation, '.git'));
  const env = { ...isolatedEnvironment(home), npm_config_cache: path.join(home, 'process-data/npm-cache'),
    npm_config_store_dir: paths.store, npm_config_auto_install_peers: 'false', npm_config_offline: 'true',
    XDG_CACHE_HOME: path.join(home, 'process-data/xdg-cache'), XDG_CONFIG_HOME: path.join(home, 'process-data/xdg-config'),
    XDG_DATA_HOME: path.join(home, 'process-data/xdg-data'), PNPM_HOME: path.join(home, 'bin'), CI: 'true' };
  for (const dir of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.npm_config_cache, env.XDG_CACHE_HOME, env.XDG_CONFIG_HOME, env.XDG_DATA_HOME, env.PNPM_HOME]) await mkdir(dir, { recursive: true });
  await writeFile(env.npm_config_userconfig, '', { flag: 'wx' });
  await writeFile(path.join(home, 'bin/pnpm.cmd'), `@echo off\r\n"${node}" "${pnpm}" %*\r\n`, { flag: 'wx' });
  env.PATH = `${path.join(home, 'bin')};${env.PATH ?? ''}`;
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'dsh-wish-willow'); assert.equal(manifest.version, '0.3.2');
  for (const script of ['prepack', 'prepare', 'postpack', 'preinstall', 'install', 'postinstall']) assert.equal(manifest.scripts?.[script], undefined);
  const zodRoot = await realpath(path.join(repositoryRoot, 'node_modules/zod'));
  assert.ok(within(repositoryRoot, zodRoot));
  const zod = JSON.parse(await readFile(path.join(zodRoot, 'package.json'), 'utf8'));
  assert.equal(zod.version, '4.6.5'); assert.equal(zod.dependencies, undefined);
  for (const script of ['prepack', 'prepare', 'postpack', 'preinstall', 'install', 'postinstall']) assert.equal(zod.scripts?.[script], undefined);
  const sourceFiles = ['package.json', 'cordis.patch.yml', 'client.js', 'src/host.js', 'src/native-intake.js',
    'packages/p1/src/host.js', 'packages/p1/src/state.js', 'packages/p1/src/orchestrator.js', 'packages/p1/src/quality-gate.js', 'packages/p1/src/reviewer.js',
    'tests/live-probe-p3-intake/guard.mjs', 'tests/live-probe-p3-intake/acceptance.patch.yml',
    'tests/integration/p3-decision-recovery.test.mjs', 'tests/integration/p3-native-intake.test.mjs', 'tests/integration/p3-native-schema.test.mjs'];
  const source = await Promise.all(sourceFiles.map(async file => ({ file, sha256: hash(await readFile(path.join(repositoryRoot, file))) })));
  const envOverrides = Object.fromEntries(Object.entries(env).filter(([key]) => !['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH'].includes(key)));
  const record = { id, paths, envOverrides, node, pnpm, cli, zodRoot, source, archive: path.join(paths.packages, 'dsh-wish-willow-0.3.2.tgz'), zodArchive: path.join(paths.packages, 'zod-4.6.5.tgz'), modelsAuthorized: false };
  // Env contains only launch essentials and owned test paths; never copied keys/tokens.
  await save(path.resolve(ledger), record);
  console.log(JSON.stringify({ preparation: 'ok', ledger: path.resolve(ledger), paths, sourceFiles: source.length, offline: true, ignoreScripts: true }));
} else {
  const r = JSON.parse(await readFile(ledger, 'utf8'));
  assert.ok(r.paths.home.startsWith(acceptanceParent + path.sep)); await assertNoLinks(r.paths.home);
  const env = { ...isolatedEnvironment(r.paths.home), ...r.envOverrides };
  env.PATH = `${path.join(r.paths.home, 'bin')};${env.PATH ?? ''}`;
  if (mode === 'check') {
    const checks = [];
    for (const [args, logName] of [
      [[r.pnpm, '--config.ignore-scripts=true', '--config.offline=true', 'config', 'get', 'ignore-scripts'], 'pnpm-ignore-scripts.txt'],
      [[r.pnpm, 'pack', '--config.ignore-scripts=true', '--help'], 'pnpm-pack-help.txt'],
    ]) {
      const log = path.join(r.paths.evidence, logName);
      const result = run(args, r.paths.invocation, env, log); checks.push(result);
      assert.equal(result.exitCode, 0, 'Interface-only check failed; do not pack');
      if (logName === 'pnpm-ignore-scripts.txt') assert.equal((await readFile(log, 'utf8')).trim(), 'true');
    }
    await save(path.join(r.paths.evidence, 'pack-interface-check.json'), { checks, ignoreScripts: true, offline: true, packageHooks: 'none' });
    console.log(JSON.stringify({ check: 'passed', packFlag: '--config.ignore-scripts=true', ignoreScripts: true }));
  } else if (mode === 'pack') {
    await readFile(path.join(r.paths.evidence, 'pack-interface-check.json'), 'utf8');
    await save(path.join(r.paths.evidence, 'pack-attempt.json'), { attemptsAllowed: 1, at: new Date().toISOString(), ignoreScripts: true, offline: true });
    for (const target of [r.archive, r.zodArchive]) await assert.rejects(lstat(target), { code: 'ENOENT' });
    const results = [];
    for (const [cwd, out] of [[repositoryRoot, r.archive], [r.zodRoot, r.zodArchive]]) {
      const result = run([r.pnpm, 'pack', '--config.ignore-scripts=true', '--config.offline=true', '--out', out], cwd, env, path.join(r.paths.logs, `pack-${path.basename(out)}.txt`));
      results.push(result);
      if (result.exitCode !== 0) { await save(path.join(r.paths.evidence, 'pack-failed.json'), results); throw Error('Pack failed; retain scene and stop'); }
    }
    await save(path.join(r.paths.evidence, 'pack.json'), { results, archives: await Promise.all([r.archive, r.zodArchive].map(async file => ({ file, sha256: hash(await readFile(file)) }))) });
  } else {
    const dir = path.join(r.paths.home, 'profiles/web'); await assert.rejects(lstat(dir), { code: 'ENOENT' });
    await mkdir(dir, { recursive: true });
    // New isolated pnpm config pins the only runtime dependency to a NEW local tarball.
    // No override of production package metadata or runtime peers is made.
    const zodFile = r.zodArchive.replaceAll('\\', '/');
    await writeFile(path.join(dir, 'pnpm-workspace.yaml'), `packages: []\noverrides:\n  zod: "file:${zodFile}"\nautoInstallPeers: false\nignoreScripts: true\noffline: true\nstoreDir: "${r.paths.store.replaceAll('\\', '/')}"\n`, { flag: 'wx' });
    const result = run([r.cli, 'plugin', '--profile', 'web', 'add', r.archive, '--offline', '--ignore-scripts', '--config.auto-install-peers=false', `--store-dir=${r.paths.store}`], r.paths.invocation, env);
    await save(path.join(r.paths.evidence, result.exitCode === 0 ? 'install-command.json' : 'install-failed.json'), result);
    assert.equal(result.exitCode, 0, 'Offline official install failed; retain scene and stop');
    const installed = await realpath(path.join(dir, 'node_modules/dsh-wish-willow'));
    const source = await Promise.all(r.source.map(async entry => ({ ...entry, installedSha256: hash(await readFile(path.join(installed, entry.file))) })));
    // pnpm may normalize package.json formatting; exact archive bytes are checked separately.
    for (const entry of source.filter(e => e.file !== 'package.json')) assert.equal(entry.sha256, entry.installedSha256, entry.file);
    assert.deepEqual(JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8')), JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')));
    await save(path.join(r.paths.evidence, 'installation.json'), { installed, source, manifestVersion: '0.3.2', offline: true, scripts: false });
  }
}
