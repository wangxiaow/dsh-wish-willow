// Test/probe preflight only. These path checks are NOT an OS sandbox.
// No function in this module removes a directory or reads/copies credentials.
import { lstat, realpath, readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Capture once: later environment changes must not silently redirect a fixture root.
export const fixtureParent = path.resolve(tmpdir());
export const acceptanceParent = path.join(repositoryRoot, '.test-data', 'acceptance');
const markerName = '.wish-willow-test-owner';
/** Brand carried only by runners constructed in-process by the fixture helper. */
export const fixtureRunnerBrand = 'wish-willow-fixture-command-runner';
const fail = message => { throw new Error(`Unsafe test path: ${message}`); };
export const within = (parent, candidate, allowEqual = false) => {
  const rel = path.relative(path.resolve(parent), path.resolve(candidate));
  return (allowEqual && rel === '') || (rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
};
const overlaps = (a, b) => within(a, b, true) || within(b, a, true);

/** Match the pinned DSH resolver: nonblank DSH_HOME, else OS home/.dsh; expand ~. */
export function liveHomePaths(env = process.env, userHome = homedir()) {
  const configured = typeof env.DSH_HOME === 'string' && env.DSH_HOME.trim() ? env.DSH_HOME : path.join(userHome, '.dsh');
  const expand = value => value === '~' ? userHome : /^~[\\/]/.test(value) ? path.join(userHome, value.slice(2)) : value;
  return [...new Set([path.resolve(expand(configured)), path.resolve(userHome, '.dsh'),
    ...(env.DSH_PROFILE_DIR ? [path.resolve(expand(env.DSH_PROFILE_DIR))] : [])])];
}

/** Resolve the existing ancestor; absence is allowed, any other error fails closed. */
async function canonical(candidate) {
  let current = path.resolve(candidate);
  const missing = [];
  for (;;) {
    try { return path.join(await realpath(current), ...missing.reverse()); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.push(path.basename(current)); current = parent;
    }
  }
}

/** Refuse links/junctions in every existing component, including the leaf. */
export async function assertNoLinks(candidate) {
  const resolved = path.resolve(candidate);
  const volume = path.parse(resolved).root;
  const segments = path.relative(volume, resolved).split(path.sep).filter(Boolean);
  let current = volume;
  for (let index = -1; index < segments.length; index += 1) {
    if (index >= 0) current = path.join(current, segments[index]);
    let stat;
    try { stat = await lstat(current); }
    catch (error) { if (error.code === 'ENOENT') break; throw error; }
    if (stat.isSymbolicLink()) fail(`link or junction component: ${current}`);
    if (stat.isFile() && stat.nlink !== 1) fail(`hard-linked file: ${current}`);
    if (index < segments.length - 1 && !stat.isDirectory()) fail(`non-directory ancestor: ${current}`);
  }
  return resolved;
}

/** Shared preflight; injectable policy values let tests use dummy protected directories. */
export async function assertIsolatedPath(candidate, { parent, allowParent = false, env = process.env, userHome = homedir() } = {}) {
  if (typeof candidate !== 'string' || !candidate.trim() || !parent) fail('an explicit path and isolation parent are required');
  const target = path.resolve(candidate), base = path.resolve(parent);
  if (!within(base, target, allowParent)) fail('path is not inside the dedicated isolation parent');
  // A dedicated repository child is allowed under a user home, never the home itself,
  // a filesystem root, AppData, or any overlapping live DSH tree.
  const protectedRoots = [path.parse(target).root, path.resolve(userHome), repositoryRoot];
  if (protectedRoots.some(root => within(target, root, true))) fail('dangerous root or ancestor');
  for (const appData of [env.APPDATA, env.LOCALAPPDATA].filter(Boolean)) {
    // Windows OS Temp normally lives below LocalAppData. Only the captured tmpdir
    // boundary is exempt; AppData itself (or an ancestor) is never a fixture parent.
    const osTemp = base === fixtureParent && within(path.resolve(appData), fixtureParent) &&
      within(fixtureParent, target, allowParent);
    if (overlaps(target, path.resolve(appData)) && !osTemp) fail('AppData is not an allowed fixture location');
  }
  await assertNoLinks(base);
  await assertNoLinks(target);
  const canonicalTarget = await canonical(target), canonicalBase = await canonical(base);
  if (!within(canonicalBase, canonicalTarget, allowParent)) fail('canonical path escaped its isolation parent');
  for (const home of liveHomePaths(env, userHome)) {
    if (overlaps(target, home) || overlaps(canonicalTarget, await canonical(home))) fail('path overlaps a real DSH home/profile');
  }
  return target;
}

async function mark(root, kind) {
  await assertNoLinks(root);
  const record = { format: 1, kind, id: randomUUID(), root: await realpath(root) };
  await writeFile(path.join(root, markerName), `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
}
async function assertOwned(root, kind, parent, protection = {}) {
  root = await assertIsolatedPath(root, { ...protection, parent });
  if (!(await lstat(root)).isDirectory()) fail('root is not a directory');
  const marker = path.join(root, markerName);
  await assertNoLinks(marker);
  const stat = await lstat(marker);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096) fail('invalid ownership marker');
  const record = JSON.parse(await readFile(marker, 'utf8'));
  if (record.format !== 1 || record.kind !== kind || typeof record.id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(record.id) || typeof record.root !== 'string' ||
      path.relative(record.root, await realpath(root)) !== '') fail('ownership marker does not match this directory');
  return root;
}

export async function createFixtureRoot() {
  await assertIsolatedPath(fixtureParent, { parent: fixtureParent, allowParent: true });
  await mkdir(fixtureParent, { recursive: true });
  await assertNoLinks(fixtureParent);
  const root = await mkdtemp(path.join(fixtureParent, 'wish-willow-test-'));
  await assertIsolatedPath(root, { parent: fixtureParent });
  await mark(root, 'fixture');
  return root;
}
export async function assertTestRoot(root) {
  if (typeof root !== 'string' || path.dirname(path.resolve(root)) !== fixtureParent ||
      !path.basename(root).startsWith('wish-willow-test-')) fail('not a generated fixture root');
  return assertOwned(root, 'fixture', fixtureParent);
}

/** A new acceptance home is claimed only by the explicitly authorized installer. */
export async function createAcceptanceHome(root) {
  root = await assertIsolatedPath(root, { parent: acceptanceParent });
  try { await lstat(root); return assertAcceptanceHome(root); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(path.dirname(root), { recursive: true });
  await assertNoLinks(path.dirname(root));
  await mkdir(root); // exclusive claim: never adopt a pre-existing unmarked home
  await mark(root, 'acceptance');
  return root;
}
export const assertAcceptanceHome = root => assertOwned(root, 'acceptance', acceptanceParent);

/** Capture BEFORE isolatedEnvironment replaces process.env/cwd. Only this exact owned Home
 * may be rechecked with the original protection context; this is not a general path exemption.
 * Injectable env/userHome are for dummy-path tests, never CLI arguments or persisted receipts.
 */
export async function captureAcceptanceHome(root, { env = process.env, userHome = homedir() } = {}) {
  const originalHome = path.resolve(userHome);
  const expand = value => path.resolve(value === '~' ? originalHome
    : /^~[\\/]/.test(value) ? path.join(originalHome, value.slice(2)) : value);
  // Copy only protection paths (no credentials). Resolve relative paths before chdir as well.
  const originalEnv = Object.freeze({ DSH_HOME: liveHomePaths(env, originalHome)[0],
    ...(env.DSH_PROFILE_DIR ? { DSH_PROFILE_DIR: expand(env.DSH_PROFILE_DIR) } : {}),
    ...(env.APPDATA ? { APPDATA: path.resolve(env.APPDATA) } : {}),
    ...(env.LOCALAPPDATA ? { LOCALAPPDATA: path.resolve(env.LOCALAPPDATA) } : {}) });
  const protection = Object.freeze({ env: originalEnv, userHome: originalHome });
  const ownedHome = await assertOwned(root, 'acceptance', acceptanceParent, protection);
  return async candidate => {
    if (typeof candidate !== 'string' || !path.isAbsolute(candidate) || path.relative(ownedHome, path.resolve(candidate)) !== '') {
      fail('path is not the captured acceptance home');
    }
    // Re-read marker and re-run all root, overlap, canonical and link checks on every call.
    return assertOwned(candidate, 'acceptance', acceptanceParent, protection);
  };
}

/** Resolve all tool paths relative to the actual Session cwd, not process.cwd(). */
export async function controlledPath(root, workspace, value = '.', { allowWorkspace = true } = {}) {
  await assertTestRoot(root);
  const cwd = path.resolve(root, workspace);
  if (!within(root, cwd)) fail('workspace escaped the fixture root');
  if (typeof value !== 'string' || !value.trim()) fail('tool path must be a nonempty string');
  const target = path.resolve(cwd, value);
  if (!within(cwd, target, allowWorkspace)) fail('tool path escaped the Session workspace');
  await assertNoLinks(cwd);
  await assertNoLinks(target);
  return target;
}

/** Explicit probes receive OS launch essentials only, never the caller's model/cloud keys. */
export function isolatedEnvironment(home, source = process.env) {
  const out = {};
  for (const key of ['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'PATH']) {
    const entry = Object.entries(source).find(([name]) => name.toUpperCase() === key);
    if (entry) out[key] = entry[1];
  }
  return { ...out, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1', HOME: home, USERPROFILE: home,
    APPDATA: path.join(home, 'process-data', 'roaming'), LOCALAPPDATA: path.join(home, 'process-data', 'local'),
    TEMP: path.join(home, 'process-data', 'temp'), TMP: path.join(home, 'process-data', 'temp'),
    npm_config_ignore_scripts: 'true', npm_config_userconfig: path.join(home, 'process-data', 'empty.npmrc') };
}

/** No shell by default. Only an explicitly constructed fixture runner may execute a command. */
export async function runFixtureCommand(runner, request) {
  if (!runner || runner.brand !== fixtureRunnerBrand || typeof runner.run !== 'function') {
    throw new Error('Scripted shell disabled: construct an explicit fixture runner to execute fixture commands');
  }
  request.signal?.throwIfAborted();
  const result = await runner.run({ ...request, env: Object.freeze({}), fixtureOnly: true });
  request.signal?.throwIfAborted();
  return result;
}
