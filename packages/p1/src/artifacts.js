import { createHash } from 'node:crypto';
import { mkdir, readdir, lstat, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';

/**
 * Deliverable selection policy.
 *
 * 0.3.1 selected deliverable files with an extension *allowlist* and silently skipped everything
 * else (`F1`: the delivered `start.ps1` never reached the immutable snapshot, so the snapshot could
 * not reproduce the documented start command). The policy is now *exclusion based*: everything a
 * delivery legitimately consists of is kept — source files, start scripts, configuration, assets and
 * binaries of any language — and only four well-understood classes are removed, each with a reason
 * that is recorded in the manifest instead of being dropped in silence:
 *
 *   1. dependency, VCS and build-output directories;
 *   2. compiled/archive build output (`.exe`, `.dll`, `.zip`, …);
 *   3. credential, environment and private-key material (by name and by content);
 *   4. anything beyond the count/size limits, which is refused rather than truncated.
 *
 * Exclusions are data, not side effects: `manifest.excluded` records every removed path and why,
 * and the release gate refuses a delivery whose documented start command depends on one of them.
 */
export const snapshotPolicy = 'wish-willow-source-snapshot/2';
export const snapshotLimits = Object.freeze({ maxFiles: 500, maxFileBytes: 2_000_000, maxTotalBytes: 20_000_000 });
export const maxRecordedExclusions = 500;

/** A file that can be started or is itself a runnable web entry. */
export const runnableSource = /\.(?:html?|js|mjs|cjs|jsx|ts|tsx|py|pyw|ps1|psm1|sh|bash|zsh|ksh|cmd|bat|rb|pl|php|go|rs|java|kt|kts|swift|lua|r|ex|exs|groovy|scala|cs|vb|fs)$/i;

/** Directories that hold dependencies, VCS metadata, Host control data or build/cache output. */
const excludedDirectories = new Set([
  'node_modules', 'bower_components', 'jspm_packages', 'vendor', '.pnpm-store', '.yarn', '.npm',
  '.git', '.hg', '.svn', '.bzr', '.wish-willow', '.dsh', '.test-data', '.research',
  'dist', 'build', 'out', 'coverage', '.nyc_output', '.cache', '.parcel-cache', '.next', '.nuxt',
  '.svelte-kit', '.turbo', '.vite', '.angular', 'target', '__pycache__', '.venv', 'venv', '.tox',
  '.pytest_cache', '.mypy_cache', '.ruff_cache', '.gradle', '.m2', '.idea', '.vscode', '.vs',
]);

/** Compiled output, installers and archives: build products, never delivery sources. */
const excludedExtensions = new Set([
  '.exe', '.dll', '.so', '.dylib', '.o', '.obj', '.a', '.lib', '.pdb', '.pyd', '.node', '.class',
  '.jar', '.war', '.ear', '.pyc', '.pyo', '.beam', '.rlib', '.msi', '.dmg', '.iso', '.img', '.apk',
  '.ipa', '.deb', '.rpm', '.app', '.zip', '.tar', '.tgz', '.gz', '.bz2', '.xz', '.7z', '.rar', '.cab',
  '.log', '.swp', '.swo', '.tmp',
]);

const excludedNames = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', 'ehthumbs.db']);

/** Key material by extension. */
const credentialExtensions = new Set(['.pem', '.key', '.pfx', '.p12', '.jks', '.keystore', '.ppk', '.asc', '.gpg', '.kdbx']);

/** Whole files whose purpose is a credential or private configuration. */
const credentialNames = /^(?:\.env(?:\.[A-Za-z0-9_-]+)*|\.envrc|\.npmrc|\.netrc|_netrc|\.git-credentials|\.htpasswd|\.pgpass|\.dockercfg|\.pypirc|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.[A-Za-z0-9_-]+)*|\.?(?:credentials|secrets)(?:\.[A-Za-z0-9_-]+)*|\.aws[\\/]credentials)$/i;

/** Only an explicit final placeholder suffix is exempt; its content is still scanned. */
const credentialTemplate = /[._-](?:example|sample|template)$/i;

/** High-confidence credential material found inside otherwise ordinary files. */
const credentialContent = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bya29\.[0-9A-Za-z_-]{20,}\b/,
];

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Reject redirected existing components before any snapshot read/write. Missing suffixes are
 * allowed only for a new destination. This is a preflight, not an atomic filesystem lock:
 * callers must also use a fresh controlled root, recheck after mkdir and never overwrite files.
 */
export async function assertPlainPath(target, { allowMissing = false } = {}) {
  if (typeof target !== 'string' || target.length === 0 || target.includes('\0')) throw Error('Invalid snapshot filesystem path');
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;
  let current = root;
  for (let index = -1; index < parts.length; index += 1) {
    if (index >= 0) current = path.join(current, parts[index]);
    let stat;
    try { stat = await lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT' && allowMissing) return absolute;
      throw error;
    }
    if (stat.isSymbolicLink()) throw Error(`Snapshot path refuses symbolic links or junctions: ${current}`);
    if (index < parts.length - 1 && !stat.isDirectory()) throw Error(`Snapshot path ancestor is not a directory: ${current}`);
    if (comparable(path.resolve(await realpath(current))) !== comparable(current)) throw Error(`Snapshot path is redirected: ${current}`);
  }
  return absolute;
}

/** A canonical portable file path, never a drive, ADS, traversal or Windows filename alias. */
export function validateRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || /[\\:\x00-\x1f\x7f<>"|?*]/.test(value)
    || value.split('/').some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part))) {
    throw Error(`Invalid snapshot relative path: ${JSON.stringify(value)}`);
  }
  return value;
}

/** Validate the bounded manifest file set before using any of its paths or embedded bytes. */
export function validateSnapshotEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw Error('Snapshot entries must be a non-empty array');
  if (entries.length > snapshotLimits.maxFiles) throw Error('Source snapshot exceeds P1 limits');
  const seen = new Set(); let total = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('Invalid snapshot entry');
    const relative = validateRelativePath(entry.path);
    const key = process.platform === 'win32' ? relative.toLowerCase() : relative;
    if (seen.has(key)) throw Error(`Duplicate snapshot path: ${relative}`);
    seen.add(key);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw Error(`Invalid snapshot byte count: ${relative}`);
    if (entry.bytes > snapshotLimits.maxFileBytes || total + entry.bytes > snapshotLimits.maxTotalBytes) throw Error('Source snapshot exceeds P1 limits');
    if (typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error(`Invalid snapshot SHA256: ${relative}`);
    if ('content' in entry) {
      if (typeof entry.content !== 'string' || entry.content.length !== Math.ceil(entry.bytes / 3) * 4) throw Error(`Invalid snapshot content: ${relative}`);
      const bytes = Buffer.from(entry.content, 'base64');
      if (bytes.length !== entry.bytes || bytes.toString('base64') !== entry.content || sha256(bytes) !== entry.sha256) throw Error(`Snapshot content does not match its entry: ${relative}`);
    }
    total += entry.bytes;
  }
  return { files: entries.length, bytes: total };
}

/** Decide whether one file name is a deliverable, and if not, exactly why not. */
export function classifyDeliverable(name) {
  const lower = name.toLowerCase();
  if (excludedNames.has(lower)) return { include: false, reason: 'temporary-system-file' };
  const extension = path.extname(lower);
  if (excludedExtensions.has(extension)) return { include: false, reason: 'build-output-or-archive' };
  if (credentialExtensions.has(extension)) return { include: false, reason: 'credential-file' };
  if (credentialNames.test(name) && !credentialTemplate.test(name)) return { include: false, reason: 'credential-file' };
  return { include: true };
}

/** Detect credential material inside a file without ever copying that material anywhere. */
export function detectCredentialContent(bytes) {
  if (bytes.includes(0)) return null;
  const text = bytes.toString('utf8');
  if (text.includes('\uFFFD')) return null;
  return credentialContent.some(pattern => pattern.test(text)) ? 'credential-content' : null;
}

/**
 * Walk a product workspace and return the delivery file set plus every recorded exclusion.
 * Symbolic links and paths that escape the workspace are refused; count/size overruns are refused.
 */
export async function collectDeliverables(workspace) {
  const root = await assertPlainPath(workspace);
  const entries = []; const excluded = []; let total = 0; let excludedTruncated = false;
  const exclude = (relative, reason) => {
    if (excluded.length >= maxRecordedExclusions) { excludedTruncated = true; return; }
    excluded.push({ path: relative, reason });
  };
  async function walk(dir) {
    await assertPlainPath(dir);
    for (const name of (await readdir(dir)).sort()) {
      const full = path.join(dir, name);
      const relative = validateRelativePath(path.relative(root, full).split(path.sep).join('/'));
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw Error('Source snapshot refuses symbolic links');
      if (stat.isDirectory()) {
        if (excludedDirectories.has(name.toLowerCase())) { exclude(relative, 'dependency-or-build-directory'); continue; }
        await walk(full); continue;
      }
      if (!stat.isFile()) { exclude(relative, 'not-a-regular-file'); continue; }
      const verdict = classifyDeliverable(name);
      if (!verdict.include) { exclude(relative, verdict.reason); continue; }
      if (stat.size > snapshotLimits.maxFileBytes) throw Error('Source snapshot exceeds P1 limits');
      await assertPlainPath(full);
      const bytes = await readFile(full);
      await assertPlainPath(full);
      // Metadata can change between stat and read; limits and the manifest use the actual bytes.
      if (bytes.length > snapshotLimits.maxFileBytes) throw Error('Source snapshot exceeds P1 limits');
      const credential = detectCredentialContent(bytes);
      if (credential) { exclude(relative, credential); continue; }
      if (entries.length >= snapshotLimits.maxFiles || total + bytes.length > snapshotLimits.maxTotalBytes) throw Error('Source snapshot exceeds P1 limits');
      total += bytes.length;
      entries.push({ path: relative, sha256: sha256(bytes), bytes: bytes.length, content: bytes.toString('base64') });
    }
  }
  await walk(root);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  excluded.sort((a, b) => a.path.localeCompare(b.path));
  const totals = entries.length ? validateSnapshotEntries(entries) : { files: 0, bytes: 0 };
  return { root, entries, excluded, excludedTruncated, totals };
}

/**
 * Bounded, link-free immutable source snapshot outside the Coding Agent's workspace.
 * Returns the manifest it wrote so the delivery gate can verify the exact recorded bytes.
 */
export async function snapshotSources(workspace, deliveryRoot, versionId) {
  validateRelativePath(versionId);
  if (versionId.includes('/')) throw Error('Snapshot version ID must be a single path segment');
  const sourceWorkspace = await assertPlainPath(workspace);
  const destination = await assertPlainPath(deliveryRoot, { allowMissing: true });
  if (inside(sourceWorkspace, destination) || inside(destination, sourceWorkspace)) throw Error('Snapshot delivery root must not overlap the workspace');
  const collected = await collectDeliverables(sourceWorkspace);
  const { entries, excluded, excludedTruncated, totals } = collected;
  if (!entries.some(x => runnableSource.test(x.path))) throw Error('No runnable source files found');
  const manifestValue = { format: 2, policy: snapshotPolicy, versionId, complete: true,
    limits: snapshotLimits, totals, excluded, excludedCount: excluded.length, excludedTruncated, entries };
  const manifest = Buffer.from(JSON.stringify(manifestValue, null, 2) + '\n');
  const snapshotPath = path.join(destination, versionId);
  const sourceRoot = path.join(snapshotPath, 'source');
  const manifestPath = path.join(snapshotPath, 'source-snapshot.json');
  // Preflight every existing target before creating even the manifest. An excluded source
  // directory must never become an unchecked redirected destination on the Host side.
  await assertPlainPath(manifestPath, { allowMissing: true });
  await assertPlainPath(sourceRoot, { allowMissing: true });
  for (const entry of entries) await assertPlainPath(path.join(sourceRoot, entry.path), { allowMissing: true });
  const writeImmutable = async (target, bytes, conflict) => {
    await assertPlainPath(target, { allowMissing: true });
    await mkdir(path.dirname(target), { recursive: true });
    await assertPlainPath(target, { allowMissing: true });
    try { await writeFile(target, bytes, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await assertPlainPath(target);
      if (!(await lstat(target)).isFile()) throw Error(conflict);
      const existing = await readFile(target);
      if (existing.length !== bytes.length || sha256(existing) !== sha256(bytes)) throw Error(conflict);
    }
  };
  await writeImmutable(manifestPath, manifest, 'Immutable source snapshot conflict');
  for (const entry of entries) {
    const target = path.join(sourceRoot, entry.path);
    if (!inside(sourceRoot, target)) throw Error('Invalid snapshot path');
    await writeImmutable(target, Buffer.from(entry.content, 'base64'), 'Immutable source file conflict');
  }
  return { manifestPath, snapshotPath: sourceRoot, sha256: sha256(manifest),
    bytes: manifest.length, files: entries.length, manifest: manifestValue, excluded, excludedTruncated, totals };
}
