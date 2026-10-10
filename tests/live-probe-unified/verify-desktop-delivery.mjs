// Independent verification of the Desktop-restart acceptance delivery.
//
// Runs in its own process against the REAL delivered files and the REAL persisted release
// record. It never reads the agent's narration as evidence: it hashes files, parses the
// PowerShell entry point, starts the documented server and drives it over real HTTP, then
// checks the release metadata and the untouched original product.
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
const mediaPath = option('media');
const projectTitleMarker = option('marker') ?? 'P1 DESKTOP RESTART TEST';
const outPath = resolve(option('out') ?? join(here, 'desktop-delivery-verification.json'));
const port = Number(option('port') ?? 8080);
const report = { at: new Date().toISOString(), checks: [], commands: [] };
const check = (name, ok, detail) => { report.checks.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${detail}` : ''}`); return Boolean(ok); };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const media = JSON.parse(readFileSync(mediaPath, 'utf8'));
const projects = Object.values(media.tables.projects);
const project = projects.find(p => p.title.includes(projectTitleMarker));
const original = projects.find(p => !p.title.includes(projectTitleMarker) && p.releases.length > 0);
if (!project) throw new Error(`no project matching '${projectTitleMarker}'`);
const release = project.releases.at(-1);
const versionDir = dirname(release.snapshotPath);
const manifest = JSON.parse(readFileSync(join(versionDir, 'source-snapshot.json'), 'utf8'));
const workspace = project.workspace;
report.project = { id: project.id, title: project.title, revision: project.revision, status: project.status, workspace, release };
report.original = { id: original.id, title: original.title, revision: original.revision, status: original.status,
  releases: original.releases.map(r => r.releasedAt) };

// A. The immutable manifest must hold on disk for every recorded entry.
let manifestOk = manifest.entries.length > 0;
for (const entry of manifest.entries) {
  const live = join(release.snapshotPath, entry.path);
  if (!existsSync(live)) { manifestOk = false; break; }
  const bytes = readFileSync(live);
  if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.bytes) { manifestOk = false; break; }
  if (Buffer.from(entry.content, 'base64').toString('utf8') !== bytes.toString('utf8')) { manifestOk = false; break; }
}
check('snapshot manifest hashes, byte counts and embedded content match the release snapshot', manifestOk, `${manifest.entries.length} entries`);

// B. Every recorded snapshot file must still equal the live product workspace.
let workspaceOk = true;
for (const entry of manifest.entries) {
  const live = join(workspace, entry.path);
  if (!existsSync(live) || sha256(readFileSync(live)) !== entry.sha256) { workspaceOk = false; break; }
}
check('released snapshot files equal the live product workspace', workspaceOk);

// C. Completeness: every file the product actually needs must be inside the snapshot.
const listFiles = root => {
  const out = [];
  const walk = dir => { for (const name of readdirSync(dir)) {
    const full = join(dir, name); const stat = statSync(full);
    if (stat.isDirectory()) { if (!['node_modules', '.git'].includes(name)) walk(full); continue; }
    out.push(full.slice(root.length + 1).split('\\').join('/'));
  } };
  walk(root); return out.sort();
};
const workspaceFiles = listFiles(workspace);
const snapshotFiles = listFiles(release.snapshotPath);
const missing = workspaceFiles.filter(path => !snapshotFiles.includes(path));
report.inventory = { workspaceFiles, snapshotFiles, missingFromSnapshot: missing };
check('delivery snapshot contains every file of the delivered product', missing.length === 0,
  missing.length ? `missing: ${missing.join(', ')} (snapshot records a deliverable that cannot be run from the snapshot)` : `${snapshotFiles.length} files`);

// D. Build-equivalent gate: the PowerShell entry point must parse without errors.
const entry = workspaceFiles.find(path => extname(path).toLowerCase() === '.ps1');
if (entry) {
  const command = `$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${join(workspace, entry).replace(/'/g, "''")}',[ref]$null,[ref]$e); if($e.Count -gt 0){$e|ForEach-Object{$_.Message}; exit 1}; 'parse ok: ${entry}'`;
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 60000 });
  report.commands.push({ command: `ParseFile ${entry}`, status: result.status, stdout: result.stdout?.trim() });
  check('build gate: the delivered PowerShell entry point parses without errors', result.status === 0, result.stdout?.trim()?.slice(0, 120));
} else {
  check('build gate: the delivered PowerShell entry point parses without errors', false, 'no .ps1 entry point in the delivery');
}

// E. Run the documented command and drive it over real HTTP, exactly as the README says.
const startCommand = release.startCommand;
const started = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(workspace, entry ?? 'start.ps1')],
  { cwd: workspace, stdio: 'ignore', shell: false });
let body = ''; let status = 0;
const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  try { const response = await fetch(`http://127.0.0.1:${port}/`); status = response.status; body = await response.text(); break; }
  catch { await new Promise(ok => setTimeout(ok, 300)); }
}
const smoke = spawnSync('powershell', ['-NoProfile', '-Command',
  `$r = Invoke-WebRequest 'http://127.0.0.1:${port}/' -UseBasicParsing; "$($r.StatusCode);$($r.Content -match '<title>Hello World</title>');$($r.Content -match 'Hello World')"`],
  { encoding: 'utf8', timeout: 60000 });
report.commands.push({ command: 'documented smoke (Invoke-WebRequest)', status: smoke.status, stdout: smoke.stdout?.trim() });
const smokeOut = (smoke.stdout ?? '').trim();
check('run: documented start command serves the page over real HTTP', status === 200 && body.includes('Hello World'),
  `status=${status} bytes=${body.length} title=${/<title>Hello World<\/title>/.test(body)} body=${body.includes('Hello World')}`);
check('run: the documented smoke command reports 200/True/True', smokeOut.replace(/\s+/g, '') === '200;True;True', smokeOut.replace(/\s+/g, ' '));
const notFound = await fetch(`http://127.0.0.1:${port}/definitely-missing.txt`).then(r => r.status).catch(() => 0);
const traversal = await fetch(`http://127.0.0.1:${port}/..%2f..%2fpackage.json`).then(r => r.status).catch(() => 0);
check('run: missing path answers 404 and traversal is refused', notFound === 404 && [400, 403, 404].includes(traversal), `missing=${notFound} traversal=${traversal}`);
started.kill();
await new Promise(ok => setTimeout(ok, 1500));
const released = await fetch(`http://127.0.0.1:${port}/`).then(() => true).catch(() => false);
check('run: stopping releases the port (repeatable start command)', released === false, `listening after stop=${released}`);

// F. Release metadata: append-only, evidence-gated and consistent.
const gate = ['build', 'test', 'run'].every(kind => project.evidence.some(e => e.kind === kind && e.success && e.exitCode === 0));
const linked = project.builds.every(b => b.status !== 'passed' || (project.versions.find(v => v.id === b.versionId)?.status !== undefined));
const versionReleased = project.versions.every(v => v.status !== 'Released' || project.releases.some(r => r.versionId === v.id && r.buildId === v.buildId));
const ordered = project.releases.every((r, i) => i === 0 || project.releases[i - 1].releasedAt <= r.releasedAt);
check('release metadata: real build+test+run exit 0 evidence backs the passed build', gate,
  project.evidence.map(e => `${e.kind}:${e.exitCode}:${e.success}`).join(','));
check('release metadata: every Released version links its build and release record', linked && versionReleased && ordered);
check('run record: the Agent run that produced this release is completed with real counters',
  project.runs.at(-1)?.status === 'completed' && project.runs.at(-1)?.modelCalls > 0 && project.runs.at(-1)?.toolCalls > 0,
  JSON.stringify({ model: project.runs.at(-1)?.model, provider: project.runs.at(-1)?.provider, modelCalls: project.runs.at(-1)?.modelCalls, toolCalls: project.runs.at(-1)?.toolCalls, failures: project.runs.at(-1)?.failures }));

// G. The pre-existing product and its released history must be untouched.
check('existing product untouched: revision and both release timestamps unchanged',
  original.revision === 32 && original.releases.length === 2
  && original.releases[0].releasedAt === '2026-10-10T11:11:19.590Z' && original.releases[1].releasedAt === '2026-10-10T11:18:09.263Z',
  `revision=${original.revision} releases=${original.releases.map(r => r.releasedAt).join(',')}`);

report.passed = report.checks.every(entry => entry.ok);
report.startCommand = startCommand;
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nverification ${report.passed ? 'PASS' : 'FAIL'} -> ${outPath}`);
process.exit(report.passed ? 0 : 1);
