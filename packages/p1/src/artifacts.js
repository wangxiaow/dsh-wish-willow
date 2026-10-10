import { createHash } from 'node:crypto';
import { mkdir, readdir, lstat, readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const excluded = new Set(['node_modules', '.git', '.wish-willow', '.env', '.credentials.yaml']);
const extensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.md', '.txt', '.svg', '.yml', '.yaml', '.lock']);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** Bounded, link-free immutable source snapshot outside the Coding Agent's workspace. */
export async function snapshotSources(workspace, deliveryRoot, versionId) {
  const root = await realpath(workspace);
  if (root.toLowerCase() !== path.resolve(workspace).toLowerCase()) throw Error('Workspace contains a redirected path');
  const entries = []; let total = 0;
  async function walk(dir) {
    for (const name of await readdir(dir)) {
      if (excluded.has(name) || name.startsWith('.env') || /credential|secret|\.pem$|\.key$/i.test(name)) continue;
      const full = path.join(dir, name); const stat = await lstat(full);
      if (stat.isSymbolicLink()) throw Error('Source snapshot refuses symbolic links');
      if (stat.isDirectory()) { await walk(full); continue; }
      if (!stat.isFile() || !extensions.has(path.extname(name).toLowerCase())) continue;
      if (stat.size > 2_000_000 || entries.length >= 500 || (total += stat.size) > 20_000_000) throw Error('Source snapshot exceeds P1 limits');
      const bytes = await readFile(full);
      entries.push({ path: path.relative(root, full).split(path.sep).join('/'), sha256: sha256(bytes), bytes: bytes.length, content: bytes.toString('base64') });
    }
  }
  await walk(root);
  if (!entries.some(x => /\.(?:html|js|mjs|ts|tsx|jsx)$/.test(x.path))) throw Error('No runnable source files found');
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = JSON.stringify({ format: 1, versionId, entries }, null, 2) + '\n';
  const snapshotPath = path.join(deliveryRoot, versionId);
  await mkdir(snapshotPath, { recursive: true });
  const manifestPath = path.join(snapshotPath, 'source-snapshot.json');
  try { await writeFile(manifestPath, manifest, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST' || await readFile(manifestPath, 'utf8') !== manifest) throw Error('Immutable source snapshot conflict');
  }
  for (const entry of entries) {
    const target = path.join(snapshotPath, 'source', entry.path);
    if (!inside(snapshotPath, target)) throw Error('Invalid snapshot path');
    await mkdir(path.dirname(target), { recursive: true });
    const bytes = Buffer.from(entry.content, 'base64');
    try { await writeFile(target, bytes, { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST' || sha256(await readFile(target)) !== entry.sha256) throw Error('Immutable source file conflict'); }
  }
  return { manifestPath, snapshotPath: path.join(snapshotPath, 'source'), sha256: sha256(manifest), bytes: Buffer.byteLength(manifest), files: entries.length };
}
