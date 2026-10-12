// Explicitly authorized isolated installation only. No credentials are copied, no
// private profile is read/hashed, no ACL is changed, and no directory is removed.
// This launcher is NOT an OS sandbox; review the local bundle before authorizing it.
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repositoryRoot, assertNoLinks, within, createAcceptanceHome, assertAcceptanceHome,
  isolatedEnvironment } from '../helpers/isolation.mjs';

export function installArguments(argv) {
  const [home, target, profile, operation, authorization, ...extra] = argv;
  if (!home || !target || !/^[a-z0-9][a-z0-9_-]*$/i.test(profile ?? '') ||
      !['add', 'remove'].includes(operation) || authorization !== '--authorize-isolated-profile-change' || extra.length) {
    throw Error('usage: install.mjs <new-owned-home> <local-tgz|package-name> <profile> <add|remove> --authorize-isolated-profile-change');
  }
  if (operation === 'remove' && !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(target)) throw Error('remove expects one package name');
  return { home: resolve(home), target, profile, operation };
}

async function createOrMatch(file, content) {
  await assertNoLinks(file);
  try { await writeFile(file, content, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if (error.code !== 'EEXIST' || await readFile(file, 'utf8') !== content) throw error;
  }
}

export async function install(argv) {
  const args = installArguments(argv); // no filesystem mutation without explicit authorization
  let specifier = args.target;
  if (args.operation === 'add') {
    specifier = resolve(args.target);
    if (!within(repositoryRoot, specifier) || !specifier.toLowerCase().endsWith('.tgz')) throw Error('add requires a reviewed local repository .tgz');
    await assertNoLinks(specifier);
    if (!(await lstat(specifier)).isFile()) throw Error('bundle is not a regular file');
  }
  // remove must never create a new home as a side effect.
  const home = args.operation === 'add' ? await createAcceptanceHome(args.home) : await assertAcceptanceHome(args.home);
  for (const file of ['package.json', 'cordis.patch.yml', 'cordis.yml']) await assertNoLinks(join(home, 'profiles', args.profile, file));
  const env = isolatedEnvironment(home);
  for (const dir of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, join(home, 'bin')]) {
    await assertNoLinks(dir); await mkdir(dir, { recursive: true });
  }
  await createOrMatch(env.npm_config_userconfig, '');
  // The official CLI resolves `pnpm` from PATH, so the isolated home gets a shim that points at a
  // pnpm that actually exists on this machine. No path is invented: every candidate is checked.
  const pnpmCandidates = [process.env.WISH_WILLOW_TEST_PNPM,
    'D:\\Program Files\\DeepSeek Harness\\resources\\runtime\\pnpm\\bin\\pnpm.mjs',
    join(homedir(), '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs')]
    .filter(Boolean).map(value => resolve(value));
  const bundledPnpm = pnpmCandidates.find(candidate => existsSync(candidate));
  if (!bundledPnpm) throw Error(`no pnpm launcher found; checked ${pnpmCandidates.join(', ')} (set WISH_WILLOW_TEST_PNPM)`);
  const shimDir = join(home, 'bin');
  await createOrMatch(join(shimDir, 'pnpm.cmd'), `@echo off\r\n"${process.execPath}" "${bundledPnpm}" %*\r\n`);
  console.log(JSON.stringify({ isolatedHome: home, profile: args.profile, operation: args.operation,
    pnpm: bundledPnpm, node: process.execPath, credentialsCopied: false, fixtureRetained: true }));
  const cli = join(repositoryRoot, '.research/installed/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js');
  // Recheck the writable root/ancestors immediately before crossing into the official CLI.
  await assertAcceptanceHome(home);
  const result = spawnSync(process.execPath, [cli, 'plugin', '--profile', args.profile, args.operation, specifier], {
    cwd: home, stdio: 'inherit', shell: false,
    env: { ...env, PATH: `${shimDir}${process.platform === 'win32' ? ';' : ':'}${env.PATH ?? ''}` },
  });
  if (result.error) throw result.error;
  console.log(JSON.stringify({ isolatedHome: home, profile: args.profile, operation: args.operation,
    exitCode: result.status, credentialsCopied: false, fixtureRetained: true }));
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await install(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
