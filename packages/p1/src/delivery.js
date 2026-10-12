import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { inside, runnableSource, sha256, snapshotPolicy, snapshotLimits,
  assertPlainPath, validateRelativePath, validateSnapshotEntries } from './artifacts.js';

/**
 * Delivery completeness gate (0.3.2).
 *
 * 0.3.1 released on a self-consistent snapshot hash alone. A snapshot can be perfectly
 * self-consistent and still be an incomplete deliverable: `F1` shipped a release whose only
 * documented start command (`powershell … -File .\start.ps1`) pointed at a file the collector had
 * silently dropped. A release must therefore prove more than "the hashes agree":
 *
 *   1. the snapshot matches its manifest and holds exactly the recorded files;
 *   2. the snapshot carries a runnable source and a non-empty start entry;
 *   3. every file the delivered start command references is inside the snapshot — and when one is
 *      not, the refusal names the policy reason that removed it;
 *   4. the snapshot restores byte for byte into a directory outside the product working directory;
 *   5. the recorded build/test/run evidence commands are re-executed in that independent copy
 *      (with the product path rebound) so the snapshot itself is proven to start and work;
 *   6. the delivered start command is launched there for a bounded window;
 *   7. any missing entry or necessary runtime file fails the release instead of being assumed usable.
 *
 * Execution always travels through the same DSH sandboxed tool chain the Coding Agent uses, so the
 * gate never widens sandbox or approval authority.
 */
export class DeliveryIntegrityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DeliveryIntegrityError';
    this.code = 'wish-willow-p1/delivery-incomplete';
    this.details = details;
  }
}

const SWITCH = /^[-/][A-Za-z]/;
const UNSUITABLE = /[()=;,`|$&<>*?^%~"']/;
const URL = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

/** Compare two filesystem paths the way Windows itself does. */
export const samePath = (left, right) => {
  const a = path.resolve(String(left ?? '')), b = path.resolve(String(right ?? ''));
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
};

function tokenize(command) {
  const tokens = []; const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g; let match;
  while ((match = pattern.exec(String(command ?? ''))) !== null) tokens.push(match[1] ?? match[2] ?? match[3]);
  return tokens;
}

/** Every file operand a delivered shell/PowerShell command names, as a workspace-relative path. */
export function commandFileReferences(command) {
  const references = [];
  for (const token of tokenize(command).slice(1)) {
    if (!token || SWITCH.test(token) || UNSUITABLE.test(token) || URL.test(token) || /^\d+(?:\.\d+){3}$/.test(token)) continue;
    const cleaned = token.replace(/^\.[\\/]/, '').replace(/\\/g, '/');
    if (!cleaned || cleaned.startsWith('/') || !/\.[A-Za-z0-9]{1,8}$/.test(path.posix.basename(cleaned))) continue;
    if (!references.includes(cleaned)) references.push(cleaned);
  }
  return references;
}

/** The script the delivered start command actually runs, or null when it names no file (e.g. `npm start`). */
export function resolveStartEntry(command) {
  const runnable = commandFileReferences(command).filter(reference => runnableSource.test(reference));
  return runnable.length ? runnable[runnable.length - 1] : null;
}

/** Re-point a recorded command at the isolated copy instead of the original product directory. */
export function rebindWorkspacePath(command, from, to) {
  if (!command || !from || from === to) return command;
  const forms = [...new Set([from, from.replaceAll('\\', '/'), from.replaceAll('/', '\\')])];
  const escaped = forms.sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // A single replacement pass: never rewrite the replacement when it contains `from`.
  const pattern = new RegExp(`(${escaped.join('|')})(?=$|[\\\\/\\s'";])`, process.platform === 'win32' || /^[A-Za-z]:/.test(from) ? 'gi' : 'g');
  return String(command).replace(pattern, match => match.includes('\\') ? to.replaceAll('/', '\\') : to.replaceAll('\\', '/'));
}

/** All files under a directory, as sorted workspace-relative POSIX paths. */
export async function listSnapshotFiles(root) {
  await assertPlainPath(root);
  const files = []; let visited = 0;
  async function walk(dir, depth = 0) {
    if (depth > 64) throw new DeliveryIntegrityError('snapshot directory depth exceeds P1 limits');
    for (const name of (await readdir(dir)).sort()) {
      if (++visited > snapshotLimits.maxFiles * 4) throw new DeliveryIntegrityError('snapshot tree exceeds P1 limits');
      const full = path.join(dir, name);
      await assertPlainPath(full);
      const entry = await lstat(full);
      if (entry.isDirectory()) { await walk(full, depth + 1); continue; }
      if (!entry.isFile()) throw new DeliveryIntegrityError(`snapshot contains a non-regular file: ${name}`);
      files.push(path.relative(root, full).split(path.sep).join('/'));
      if (files.length > snapshotLimits.maxFiles) throw new DeliveryIntegrityError('snapshot file count exceeds P1 limits');
    }
  }
  await walk(root);
  return files.sort();
}

/** Copy a manifest into a target directory and prove the copy still hashes to the same bytes. */
export async function materializeSnapshot(manifest, snapshotPath, targetRoot) {
  validateSnapshotEntries(manifest.entries);
  await assertPlainPath(snapshotPath);
  await assertPlainPath(targetRoot, { allowMissing: true });
  if (inside(snapshotPath, targetRoot) || inside(targetRoot, snapshotPath)) throw new DeliveryIntegrityError('restore and snapshot roots overlap');
  // Refuse ANY pre-existing target, including an empty one. Never repair/overwrite it.
  try { await lstat(targetRoot); throw new DeliveryIntegrityError('restore/replay target already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const contents = [];
  for (const entry of manifest.entries) {
    const source = path.join(snapshotPath, entry.path);
    await assertPlainPath(source);
    const stat = await lstat(source);
    if (!stat.isFile() || stat.size !== entry.bytes) throw new DeliveryIntegrityError(`snapshot size mismatch: ${entry.path}`);
    const bytes = await readFile(source);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw new DeliveryIntegrityError(`snapshot hash mismatch: ${entry.path}`);
    contents.push(bytes);
  }
  await mkdir(path.dirname(targetRoot), { recursive: true });
  await assertPlainPath(path.dirname(targetRoot));
  await mkdir(targetRoot); // exclusive directory creation
  const mismatched = [];
  for (const [index, entry] of manifest.entries.entries()) {
    const target = path.join(targetRoot, entry.path);
    await assertPlainPath(target, { allowMissing: true });
    await mkdir(path.dirname(target), { recursive: true });
    await assertPlainPath(path.dirname(target));
    await writeFile(target, contents[index], { flag: 'wx' });
    const landed = await readFile(target);
    if (sha256(landed) !== entry.sha256 || landed.length !== entry.bytes) mismatched.push(entry.path);
  }
  const onDisk = await listSnapshotFiles(targetRoot);
  const recorded = new Set(manifest.entries.map(entry => entry.path));
  return { files: onDisk.length, mismatched, extra: onDisk.filter(name => !recorded.has(name)), restorePath: targetRoot };
}

export const commandPassed = result => result?.kind === 'foreground' && result.exitCode === 0
  && !result.aborted && !result.timedOut && !result.denied && !result.runnerFailed
  && !result.sandbox?.denied && !result.sandbox?.runnerFailed && !result.signal;

const outcome = result => ({
  executionKind: result?.kind ?? 'unknown', exitCode: result?.exitCode ?? null,
  timedOut: Boolean(result?.timedOut), aborted: Boolean(result?.aborted),
  denied: Boolean(result?.denied || result?.sandbox?.denied),
  runnerFailed: Boolean(result?.runnerFailed || result?.sandbox?.runnerFailed),
  jobId: result?.jobId ?? null, healthy: result?.healthy === true, stopped: result?.stopped === true,
  stdout: result?.stdout ?? '', stderr: result?.stderr ?? '',
});

/**
 * P1's demonstrated Node/PowerShell delivery needs no third-party install, so every path that
 * could silently satisfy an undeclared import is either refused or recorded:
 *
 *   1. a snapshot `package.json` declaring dependencies is refused (no reproduced install source);
 *   2. `node_modules` anywhere between the independent copy and the controlled isolation root is
 *      refused — that is the tree the Host owns, so a stray dependency there is the Agent's own;
 *   3. Node's documented per-user global folders are refused, because Node consults them for every
 *      `require` regardless of the delivery tree;
 *   4. directories ABOVE the isolation root are only *recorded* in the report. Refusing them would
 *      turn unrelated host state (for example a stray `%TEMP%\node_modules`) into a delivery
 *      failure, which is not a property of the delivery. This is a stated limit, not a silent one.
 */
export async function verifyDependencySource(manifest, snapshotPath, replayRoot, isolationRoot) {
  for (const entry of manifest.entries.filter(entry => path.posix.basename(entry.path) === 'package.json')) {
    const pkg = JSON.parse(await readFile(path.join(snapshotPath, entry.path), 'utf8'));
    for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies', 'bundleDependencies', 'workspaces']) {
      if (pkg[key] && Object.keys(pkg[key]).length) throw new DeliveryIntegrityError(`${entry.path}: ${key} has no independently reproduced dependency source; P1 replay currently verifies dependency-free applications`);
    }
  }
  const hasNodeModules = async dir => {
    try { await lstat(path.join(dir, 'node_modules')); return true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; return false; }
  };
  const controlled = [];
  for (let current = path.resolve(replayRoot); ; current = path.dirname(current)) {
    controlled.push(current);
    if (samePath(current, isolationRoot)) break;
    if (path.dirname(current) === current) {
      throw new DeliveryIntegrityError(`the independent copy is not inside the controlled isolation root: ${replayRoot}`);
    }
  }
  for (const dir of controlled) {
    if (await hasNodeModules(dir)) throw new DeliveryIntegrityError(`ambient node_modules would contaminate replay: ${dir}`);
  }
  const globals = ['.node_modules', '.node_libraries'].map(name => path.join(homedir(), name));
  for (const dir of globals) {
    if (await hasNodeModules(dir)) throw new DeliveryIntegrityError(`Node global module folder would contaminate replay: ${dir}`);
  }
  const recorded = [];
  for (let current = path.dirname(path.resolve(isolationRoot)); ; current = path.dirname(current)) {
    if (await hasNodeModules(current)) recorded.push(path.join(current, 'node_modules'));
    if (path.dirname(current) === current) break;
  }
  return { policy: 'dependency-free-runtime', isolationRoot: path.resolve(isolationRoot),
    controlledAncestors: controlled.length, ambientAboveIsolationRoot: recorded,
    runtime: 'installed Node.js / PowerShell; NODE_PATH and NODE_OPTIONS cleared for every replayed command',
    thirdPartyInstall: false };
}

export function validateHealthCheck(value) {
  if (value === undefined) return undefined;
  let url;
  try { url = new globalThis.URL(value.url); } catch { throw new DeliveryIntegrityError('invalid health-check URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || !url.port || url.username || url.password || url.hash
    || typeof value.contains !== 'string' || !value.contains.trim() || value.contains.length > 1000) {
    throw new DeliveryIntegrityError('health check requires an explicit loopback HTTP port and expected response text');
  }
  return { url: url.href, contains: value.contains };
}

/**
 * Verify that one release snapshot is a complete, independently runnable deliverable.
 * Resolves to a durable report; throws `DeliveryIntegrityError` when the delivery must not happen.
 */
export async function verifyDeliveryIntegrity(options) {
  const { manifestPath, manifest, snapshotPath, workspace, startCommand, evidence = [],
    restoreRoot, replayRoot = restoreRoot, isolationRoot, runCommand,
    replayTimeoutMs = 120000, startTimeoutMs = 30000 } = options;
  const healthCheck = validateHealthCheck(options.healthCheck);
  const checks = [], commands = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
    if (!ok) throw new DeliveryIntegrityError(`${name}${detail ? `: ${detail}` : ''}`, { checks, commands });
  };

  // (1) The manifest must describe this snapshot exactly.
  check('the manifest declares a complete 0.3.2-style snapshot',
    Boolean(manifest) && manifest.format === 2 && manifest.complete === true && manifest.policy === snapshotPolicy
    && Array.isArray(manifest.entries) && manifest.entries.length > 0,
    `format=${manifest?.format} policy=${manifest?.policy} entries=${manifest?.entries?.length ?? 0}`);
  const totals = validateSnapshotEntries(manifest.entries);
  check('manifest totals match the bounded entries', manifest.totals?.files === totals.files && manifest.totals?.bytes === totals.bytes);
  await assertPlainPath(snapshotPath);
  for (const entry of manifest.entries) {
    const target = path.join(snapshotPath, entry.path);
    await assertPlainPath(target);
    const stat = await lstat(target);
    check(`snapshot file ${entry.path} is a regular file of the recorded size`, stat.isFile() && stat.size === entry.bytes);
    const bytes = await readFile(target);
    check(`snapshot file ${entry.path} matches the manifest`,
      bytes.length === entry.bytes && sha256(bytes) === entry.sha256,
      `expected ${entry.bytes} bytes / ${entry.sha256}`);
  }
  const onDisk = await listSnapshotFiles(snapshotPath);
  check('the snapshot directory contains exactly the recorded files', onDisk.length === manifest.entries.length
    && onDisk.every(name => manifest.entries.some(entry => entry.path === name)), 
    `on disk=${onDisk.length} recorded=${manifest.entries.length}${onDisk.filter(name => !manifest.entries.some(e => e.path === name)).map(name => ` extra:${name}`).join('')}`);

  // (2) The snapshot must hold something actually runnable.
  check('the snapshot contains a runnable source file', manifest.entries.some(entry => runnableSource.test(entry.path)),
    manifest.entries.map(entry => entry.path).join(', '));

  // (3)/(6) The documented start command must be satisfiable from the snapshot alone.
  check('start command is a supported single invocation', typeof startCommand === 'string' && startCommand.trim().length > 0
    && !/[;|&`$\r\n<>]/.test(startCommand), 'compound or ambiguous start commands cannot prove an entry point');
  let entryCommand = startCommand;
  if (/^npm(?:\.cmd)?\s+start\s*$/i.test(startCommand)) {
    const packageEntry = manifest.entries.find(entry => entry.path === 'package.json');
    check('npm start has a delivered package.json', Boolean(packageEntry));
    const pkg = JSON.parse(await readFile(path.join(snapshotPath, 'package.json'), 'utf8'));
    check('npm start has one explicit delivered start script', typeof pkg.scripts?.start === 'string' && !/[;|&`$\r\n<>]/.test(pkg.scripts.start));
    check('npm start has no implicit lifecycle hooks', !pkg.scripts?.prestart && !pkg.scripts?.poststart);
    entryCommand = pkg.scripts.start;
  }
  const references = commandFileReferences(entryCommand);
  const unsafe = references.filter(reference => { try { validateRelativePath(reference); return false; } catch { return true; } });
  check('every file the delivered start command references is a relative snapshot path', unsafe.length === 0,
    unsafe.map(reference => `${reference} is not reproducible from the snapshot`).join('; '));
  const recorded = new Map(manifest.entries.map(entry => [entry.path.toLowerCase(), entry]));
  const explain = reference => {
    const hit = (manifest.excluded ?? []).find(entry => entry.path.toLowerCase() === reference.toLowerCase()
      || reference.toLowerCase().startsWith(`${entry.path.toLowerCase()}/`));
    return hit ? `${reference} was excluded from the snapshot (${hit.reason})` : `${reference} is absent from the snapshot`;
  };
  const missing = references.filter(reference => !recorded.has(reference.toLowerCase()));
  check('every file the delivered start command references is inside the snapshot', missing.length === 0,
    missing.length ? `the start command cannot run from the snapshot: ${missing.map(explain).join('; ')}`
      : `${references.length} reference(s): ${references.join(', ') || '(none, start command names no file)'}`);
  const startEntry = resolveStartEntry(entryCommand);
  check('start command names a delivered executable entry', Boolean(startEntry), entryCommand);
  if (startEntry) {
    check('the start entry inside the snapshot is a non-empty runnable file',
      (recorded.get(startEntry.toLowerCase())?.bytes ?? 0) > 0, startEntry);
  }

  // (4) The snapshot must restore, byte for byte, outside the product working directory.
  check('the restore target is outside the product working directory', Boolean(restoreRoot)
    && !inside(workspace, restoreRoot) && !inside(restoreRoot, workspace), String(restoreRoot));
  check('the replay target is outside the product working directory', Boolean(replayRoot)
    && !inside(workspace, replayRoot) && !inside(replayRoot, workspace), String(replayRoot));
  await assertPlainPath(workspace, { allowMissing: true });
  await assertPlainPath(replayRoot, { allowMissing: true });
  check('the independent copy is inside the declared controlled isolation root', Boolean(isolationRoot)
    && (inside(isolationRoot, replayRoot) || samePath(isolationRoot, replayRoot)), String(isolationRoot));
  const dependencies = await verifyDependencySource(manifest, snapshotPath, replayRoot, isolationRoot);
  const restored = await materializeSnapshot(manifest, snapshotPath, restoreRoot);
  check('the snapshot restores byte for byte into a directory outside the product working directory',
    restored.files === manifest.entries.length && restored.mismatched.length === 0 && restored.extra.length === 0,
    `restored=${restored.files} mismatched=${restored.mismatched.join(',') || '(none)'} extra=${restored.extra.join(',') || '(none)'}`);

  // (5) Re-execute the recorded evidence in that same independent copy, with the product path rebound.
  const replayMaterialized = samePath(replayRoot, restoreRoot) ? restored
    : await materializeSnapshot(manifest, snapshotPath, replayRoot);
  check('the isolated copy is byte-identical with no extra files', replayMaterialized.mismatched.length === 0
    && replayMaterialized.extra.length === 0 && replayMaterialized.files === manifest.entries.length);

  if (typeof runCommand !== 'function') throw new DeliveryIntegrityError('the delivery gate requires a command runner', { checks, commands });
  const execute = async (kind, command, timeoutMs) => {
    let result;
    try { result = await runCommand(command, replayRoot, timeoutMs, { kind, healthCheck: kind === 'start' ? healthCheck : undefined }); }
    catch (error) { result = { runnerFailed: true, stderr: String(error.message ?? error) }; }
    const blocked = Boolean(result?.denied || result?.sandbox?.denied || result?.runnerFailed || result?.sandbox?.runnerFailed);
    // A service start is proven only by a health probe that really answered AND a launch that was
    // really stopped again. A timeout or a promotion to a background job is never a PASS.
    const passed = kind === 'start' && healthCheck
      ? result?.healthy === true && result?.stopped === true && !blocked
      : commandPassed(result);
    const entry = { kind, command, workdir: replayRoot, ...outcome(result), status: null };
    // `unverified` marks an environment block or a missing foreground exit DTO; it is never a PASS.
    entry.status = passed ? 'passed' : blocked ? 'unverified'
      : kind === 'start' && healthCheck ? 'failed'
        : result?.kind === 'foreground' ? 'failed' : 'unverified';
    commands.push(entry);
    return entry;
  };
  for (const kind of ['build', 'test', 'run']) {
    const record = evidence.find(entry => entry.kind === kind && entry.success && entry.exitCode === 0 && entry.command);
    if (!record) { check(`a real ${kind} command is available for isolated replay`, false, `no successful ${kind} evidence with a recorded command`); continue; }
    const command = rebindWorkspacePath(record.command, workspace, replayRoot);
    const entry = await execute(kind, command, replayTimeoutMs);
    check(`the recorded ${kind} command succeeds in the isolated snapshot copy`, entry.status === 'passed',
      `status=${entry.status} exit=${entry.exitCode} timedOut=${entry.timedOut} aborted=${entry.aborted} denied=${entry.denied} runnerFailed=${entry.runnerFailed}; ${entry.stderr}`);
  }
  const startCommandLine = rebindWorkspacePath(entryCommand, workspace, replayRoot);
  const start = await execute('start', startCommandLine, startTimeoutMs);
  check('the delivered start command launches from the isolated snapshot copy', start.status === 'passed',
    `status=${start.status} exit=${start.exitCode} timedOut=${start.timedOut} aborted=${start.aborted}; ${start.stderr}`);

  return { ok: true, policy: snapshotPolicy, checks, entries: manifest.entries.length, excluded: manifest.excluded ?? [],
    excludedCount: manifest.excludedCount ?? 0, references, startEntry, startCommand, healthCheck, dependencies, restored,
    replay: { status: 'passed', path: replayRoot, commands, reason: null }, 
    restorePath: restored.restorePath, replayPath: replayRoot, manifestPath, snapshotPath,
    verifiedAt: new Date().toISOString() };
}
