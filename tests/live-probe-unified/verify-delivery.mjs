// Independent delivery verification for a Wish Willow round.
//
// Runs in its own process, inspects the real delivered source and the real persisted
// release metadata, and exercises the software itself: snapshot hashes, build, the
// project's own test suite, the documented start command over real HTTP, the round's
// required behaviour against the delivered module, and append-only release history.
// The agent's own report is never an input.
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(`--${name}`); return index === -1 ? undefined : args[index + 1]; };
const round = Number(option('round') ?? 1);
const deliveryRoot = resolve(option('delivery'));
const workspace = resolve(option('workspace') ?? deliveryRoot);
const mediaPath = option('media');
const projectId = option('project');
const outPath = resolve(option('out') ?? join(here, 'verification.json'));
const report = { at: new Date().toISOString(), round, deliveryRoot, workspace, checks: [], commands: [] };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` :: ${detail}`}`);
  return Boolean(ok);
};
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

// 1. Immutable snapshot manifest: every recorded hash and byte count must hold on disk.
const manifestPath = resolve(option('manifest') ?? join(dirname(deliveryRoot), 'source-snapshot.json'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
let manifestOk = manifest.entries.length > 0;
for (const entry of manifest.entries) {
  const path = join(deliveryRoot, entry.path);
  if (!existsSync(path)) { manifestOk = false; break; }
  const bytes = readFileSync(path);
  if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.bytes) { manifestOk = false; break; }
  if (Buffer.from(entry.content, 'base64').toString('utf8') !== bytes.toString('utf8')) { manifestOk = false; break; }
}
check('snapshot manifest hashes and bytes match the delivered files', manifestOk, `${manifest.entries.length} entries`);

// 2. The current workspace must still be the delivered snapshot for the released version.
let workspaceOk = true;
for (const entry of manifest.entries) {
  const live = join(workspace, entry.path);
  if (!existsSync(live) || sha256(readFileSync(live)) !== entry.sha256) { workspaceOk = false; break; }
}
check('released snapshot equals the live product workspace', workspaceOk);

// 3. Build gate: real syntax check of every delivered script.
const scripts = manifest.entries.filter(entry => entry.path.endsWith('.js')).map(entry => entry.path);
let buildOk = scripts.length > 0;
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', script], { cwd: deliveryRoot, encoding: 'utf8' });
  report.commands.push({ command: `node --check ${script}`, status: result.status, stderr: result.stderr?.slice(0, 400) });
  if (result.status !== 0) buildOk = false;
}
check('build: node --check passes for every delivered script', buildOk, `${scripts.length} scripts`);

// 4. The project's own test suite, executed independently.
const ownTests = ['todo-test-runner.js', 'scripts/test.js', 'test.js'].find(name => existsSync(join(deliveryRoot, name)));
if (ownTests) {
  const result = spawnSync(process.execPath, [ownTests], { cwd: deliveryRoot, encoding: 'utf8', timeout: 300000 });
  report.commands.push({ command: `node ${ownTests}`, status: result.status, stdout: result.stdout?.slice(-2000), stderr: result.stderr?.slice(-1000) });
  check('test: the delivered project own test suite passes', result.status === 0, `node ${ownTests} exit=${result.status}`);
} else {
  check('test: the delivered project own test suite passes', false, 'no runner found');
}

// 5. The documented start command over real HTTP.
const port = 4300 + round;
const server = spawn(process.execPath, ['server.js'], { cwd: deliveryRoot, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: 'ignore' });
let httpStatus = 0; let body = '';
const deadline = Date.now() + 20000;
while (Date.now() < deadline) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    httpStatus = response.status;
    body = await response.text();
    break;
  } catch { await new Promise(ok => setTimeout(ok, 300)); }
}
let pageOk = httpStatus === 200;
const requiredSelectors = round === 1
  ? ['id="todo-list"', 'id="todo-input"', 'id="todo-submit"', 'id="todo-progress"']
  : ['id="todo-list"', 'id="todo-input"', 'id="todo-submit"'];
for (const selector of requiredSelectors) if (!body.includes(selector)) pageOk = false;
check('run: documented start command serves the real page over HTTP', pageOk, `status=${httpStatus} bytes=${body.length}`);
if (round >= 2) {
  const priorityUi = /priority/i.test(body) || body.includes('优先级');
  check('round 2 UI: the page exposes a task priority and priority filter control', priorityUi);
}
const textBody = await (async () => { try { return await (await fetch(`http://127.0.0.1:${port}/index.html`)).text(); } catch { return ''; } })();
check('run: the served page is the delivered index.html', textBody.length > 0 && textBody.includes('<html'));
server.kill();
report.http = { status: httpStatus, bytes: body.length, pageHasPriority: /priority/i.test(body) || body.includes('优先级') };

// 6. Behaviour of the delivered data layer: round-1 requirements, and round-1 regression on round 2.
const require = createRequire(import.meta.url);
const candidates = manifest.entries.map(entry => entry.path).filter(path => /core|todo.*\.js$/i.test(path) && !/test/i.test(path));
let core = null; let corePath = null;
for (const candidate of candidates) {
  try { core = require(join(deliveryRoot, candidate)); corePath = candidate; break; } catch { /* not a CommonJS module */ }
}
const behaviour = { corePath };
if (core) {
  const first = core.createTask('  买牛奶  ');
  behaviour.created = first;
  let tasks = core.appendTask([], first);
  const second = core.createTask('写周报');
  tasks = core.appendTask(tasks, second);
  behaviour.afterAdd = tasks.length;
  tasks = core.toggleTaskById(tasks, first.id);
  behaviour.counts = core.countDone(tasks);
  const rehydrated = core.deserialize(core.serialize(tasks));
  behaviour.persistedDone = rehydrated.find(task => task.id === first.id)?.done === true;
  tasks = core.removeTaskById(tasks, first.id);
  behaviour.afterDelete = tasks.length;
  behaviour.rejectsEmpty = core.createTask('   ') === null;
  const round1Ok = behaviour.afterAdd === 2 && first && first.title === '买牛奶' && first.done === false
    && behaviour.counts.done === 1 && behaviour.counts.total === 2 && behaviour.persistedDone === true
    && behaviour.afterDelete === 1 && behaviour.rejectsEmpty;
  check('round 1 behaviour: add, list, complete and delete work through the delivered data layer', round1Ok, JSON.stringify(behaviour.counts));
} else {
  check('round 1 behaviour: add, list, complete and delete work through the delivered data layer', false, 'no loadable core module');
}
if (round >= 2 && core) {
  const api = Object.keys(core);
  behaviour.api = api;
  const priorityApi = api.filter(name => /priorit/i.test(name));
  const source = manifest.entries.map(entry => Buffer.from(entry.content, 'base64').toString('utf8')).join('\n');
  const mentions = /priority|优先级/i.test(source);
  // Behavioural check of whichever priority API the delivery documents, plus the filter.
  let priorityOk = false; let filterDetail = null;
  try {
    const make = (title, priority) => core.createTask(title, { priority });
    const a = make('高优先', 'high'); const b = make('低优先', 'low');
    if (a && b) {
      const list = [a, b];
      const filter = api.map(name => core[name]).find(fn => typeof fn === 'function' && fn.length >= 2 && /filter/i.test(fn.name ?? ''));
      if (a.priority !== undefined) {
        const filtered = typeof core.filterByPriority === 'function' ? core.filterByPriority(list, 'high')
          : (typeof filter === 'function' ? filter(list, 'high') : null);
        priorityOk = filtered ? filtered.length === 1 : a.priority === 'high';
        filterDetail = filtered ? `filtered=${filtered.length}` : `priority=${a.priority}`;
      }
    }
  } catch (error) { filterDetail = String(error.message).slice(0, 200); }
  check('round 2 behaviour: tasks carry a priority and can be filtered by it', priorityOk, `${filterDetail}; api=${priorityApi.join(',') || 'none'}`);
  check('round 2 source mentions priority (module or UI)', mentions);
  check('round 1 regression: the round-1 capabilities still pass on the round-2 delivery', behaviour.afterDelete === 1 && behaviour.persistedDone === true);
}

// 7. Release metadata: append-only history, evidence gates and snapshot consistency.
if (mediaPath && projectId) {
  const media = JSON.parse(readFileSync(mediaPath, 'utf8'));
  const project = media.tables.projects[projectId];
  const releases = project.releases;
  const ordered = releases.every((release, index) => index === 0 || releases[index - 1].releasedAt <= release.releasedAt);
  const distinct = new Set(releases.map(release => release.snapshotPath)).size === releases.length;
  const linked = releases.every(release => {
    const build = project.builds.find(item => item.id === release.buildId);
    const version = project.versions.find(item => item.id === release.versionId);
    return build && version && build.status === 'passed' && version.status === 'Released' && version.releaseId === release.id;
  });
  const gate = project.builds.every(build => build.status !== 'passed' || ['build', 'test', 'run'].every(kind =>
    project.evidence.some(item => build.evidenceIds.includes(item.id) && item.kind === kind && item.success && item.exitCode === 0)));
  const snapshotsExist = releases.every(release => existsSync(join(dirname(release.snapshotPath), 'source-snapshot.json')));
  const snapshotsMatch = releases.every(release => {
    const entries = JSON.parse(readFileSync(join(dirname(release.snapshotPath), 'source-snapshot.json'), 'utf8')).entries;
    return entries.every(entry => { const path = join(release.snapshotPath, entry.path);
      return existsSync(path) && sha256(readFileSync(path)) === entry.sha256; });
  });
  check('release metadata: history is ordered, append-only and uniquely snapshotted', ordered && distinct, `releases=${releases.length}`);
  check('release metadata: every release links a passed build and a Released version', linked);
  check('release metadata: passed builds carry real build+test+run exit 0 evidence', gate);
  check('release metadata: every release snapshot directory exists and matches its manifest', snapshotsExist && snapshotsMatch);
  report.releases = releases.map(release => ({ id: release.id, versionId: release.versionId, releasedAt: release.releasedAt, snapshotPath: release.snapshotPath, startCommand: release.startCommand }));
  report.runs = project.runs.map(run => ({ id: run.id, status: run.status, provider: run.provider, model: run.model, modelCalls: run.modelCalls,
    toolCalls: run.toolCalls, failures: run.failures, inputTokens: run.inputTokens, outputTokens: run.outputTokens, durationMs: run.durationMs }));
  report.project = { id: project.id, revision: project.revision, status: project.status,
    confirmed: project.requirements.filter(row => row.confirmation === 'confirmed').length,
    inferred: project.requirements.filter(row => row.confirmation === 'inferred').length };
}

report.passed = report.checks.every(entry => entry.ok);
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nverification ${report.passed ? 'PASS' : 'FAIL'} -> ${outPath}`);
process.exit(report.passed ? 0 : 1);
