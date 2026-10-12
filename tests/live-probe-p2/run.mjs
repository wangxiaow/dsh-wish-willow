// Explicit isolated acceptance CLI, not a plugin/RPC. Bare invocation fails before mutation or DSH import.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { repositoryRoot, acceptanceParent, assertIsolatedPath, assertAcceptanceHome, captureAcceptanceHome, assertNoLinks, within, isolatedEnvironment } from '../helpers/isolation.mjs';
import { fixedInputs, inputLedger, sha256 } from './inputs.mjs';
import { detectCredentialContent } from '../../packages/p1/src/artifacts.js';
import { fullyRead } from '../../packages/p1/src/quality-gate.js';

const coreFiles = ['package.json', 'src/host.js', 'packages/p1/src/host.js', 'packages/p1/src/orchestrator.js',
  'packages/p1/src/delivery-runner.js', 'packages/p1/src/delivery.js', 'packages/p1/src/artifacts.js',
  'packages/p1/src/reviewer.js', 'packages/p1/src/quality-gate.js', 'packages/p1/src/state.js'];
const driverFiles = ['tests/live-probe-p2/run.mjs', 'tests/live-probe-p2/fixed-candidate.mjs', 'tests/live-probe-p2/inputs.mjs',
  'tests/helpers/isolation.mjs', 'tests/live-probe-unified/install.mjs', 'tests/live-probe-unified/runtime.patch.yml'];
const hashPattern = /^[a-f0-9]{64}$/i;
const noSecrets = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/sk-|Bearer\s|(?:api.?key|password|secret)\s*[=:]/i.test(value);

export function argumentsFor(argv) {
  const [mode, ...a] = argv;
  if (mode === 'hash-inputs' && a.length === 2 && a[1] === '--authorize-c-input-hashes') return { mode, file: path.resolve(a[0]) };
  if (mode === 'install' && a.length === 4 && a[3] === '--authorize-c-isolated-install' && hashPattern.test(a[2])) return { mode, home: path.resolve(a[0]), archive: path.resolve(a[1]), archiveHash: a[2].toLowerCase() };
  if (mode === 'prepare' && a.length === 5 && a[4] === '--authorize-c-tool-preparation' && hashPattern.test(a[3])) return { mode, home: path.resolve(a[0]), evidence: path.resolve(a[1]), port: Number(a[2]), archiveHash: a[3].toLowerCase() };
  if (mode === 'review' && a.length === 7 && a[5] === '--authorize-c-reviewers' && a[6] === '--acknowledge-no-hard-money-cap' && noSecrets(a[3]) && noSecrets(a[4])) return { mode, home: path.resolve(a[0]), evidence: path.resolve(a[1]), port: Number(a[2]), provider: a[3], model: a[4] };
  throw Error('usage: run.mjs hash-inputs <new-ledger.json> --authorize-c-input-hashes | install <new-home> <new-tgz> <sha256> --authorize-c-isolated-install | prepare <owned-home> <new-evidence-dir> <port> <archive-sha256> --authorize-c-tool-preparation | review <owned-home> <prepared-evidence-dir> <port> <provider> <model> --authorize-c-reviewers --acknowledge-no-hard-money-cap');
}
async function absent(file) {
  await assertNoLinks(file);
  try { await lstat(file); throw Error('Refusing existing acceptance target; retain it and stop'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function writeNew(file, value) {
  await assertNoLinks(file);
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (bytes.length > 5000000 || detectCredentialContent(bytes)) throw Error('Evidence export is too large or contains credential material');
  await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  assert.deepEqual(await readFile(file), bytes);
  return { path: file, sha256: sha256(bytes) };
}
// Deterministic parsed-JSON identity: recursively sort object keys (UTF-16 order),
// preserve array order/types/string values, and emit compact JSON as UTF-8. No fields are omitted.
const manifestNormalization = 'wish-willow-manifest-sorted-json/1';
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw Error('Manifest contains a non-finite JSON number');
    if (Object.is(value, -0)) return '-0';
  }
  return JSON.stringify(value);
}
function parseManifest(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const value = JSON.parse(text);
  // JSON.parse would otherwise silently discard duplicate fields (including escaped aliases).
  const stack = [];
  for (const [token] of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]/gs)) {
    const parent = stack.at(-1);
    if (token === '{') stack.push({ keys: new Set(), key: true });
    else if (token === '[') stack.push({});
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && parent?.keys) parent.key = true;
    else if (token === ':' && parent?.keys) parent.key = false;
    else if (token.startsWith('"') && parent?.keys && parent.key) {
      const key = JSON.parse(token);
      if (parent.keys.has(key)) throw Error('Manifest contains duplicate JSON fields');
      parent.keys.add(key); parent.key = false;
    }
  }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw Error('Manifest must be a JSON object');
  assert.equal(value.name, 'dsh-wish-willow', 'Installed Bundle name changed');
  assert.equal(value.version, '0.3.2', 'Installed Bundle version changed');
  return value;
}
export function productionFileIdentity(name, bytes) {
  const identity = { name, sha256: sha256(bytes) }; // always the actual RAW byte hash, never canonicalized
  if (name !== 'package.json') return identity;
  const manifestJson = canonicalJson(parseManifest(bytes));
  return { ...identity, manifestNormalization, manifestJson, manifestSha256: sha256(Buffer.from(manifestJson, 'utf8')) };
}
export function assertProductionIdentity(actual, current) {
  const comparable = entries => entries.map(entry => {
    if (entry.name !== 'package.json') return entry; // all nine production byte hashes remain strict
    const { sha256: _rawHash, ...semantic } = entry;
    assert.equal(entry.manifestNormalization, manifestNormalization);
    assert.equal(typeof entry.manifestJson, 'string');
    assert.equal(entry.manifestSha256, sha256(Buffer.from(entry.manifestJson, 'utf8')));
    return semantic;
  });
  assert.deepEqual(comparable(actual), comparable(current), 'Installed production source/manifest semantics differ from the reviewed worktree');
}
async function hashes(root, files) {
  return Promise.all(files.map(async name => {
    const file = await realpath(path.join(root, name));
    if (!within(root, file)) throw Error('Source pin escapes its reviewed package/worktree');
    return productionFileIdentity(name, await readFile(file));
  }));
}
async function installed(home) {
  const manifest = JSON.parse(await readFile(path.join(home, 'profiles/web/package.json'), 'utf8'));
  assert.deepEqual(manifest.dsh.profile.bundles.filter(x => x.startsWith('dsh-wish-willow')), ['dsh-wish-willow']);
  // pnpm package links may resolve inside this owned Home, never to a real profile/worktree.
  const root = await realpath(path.join(home, 'profiles/web/node_modules/dsh-wish-willow'));
  if (!within(home, root)) throw Error('Installed bundle escapes the owned Home');
  const current = await hashes(repositoryRoot, coreFiles), actual = await hashes(root, coreFiles);
  assertProductionIdentity(actual, current);
  // Keep actual installed RAW hashes AND canonical manifest identity in the receipt.
  // The unchanged prepare/review deep comparison rechecks both against the installation receipt.
  return { root, core: actual, driver: await hashes(repositoryRoot, driverFiles) };
}
async function homeForC(home) {
  home = await assertIsolatedPath(home, { parent: acceptanceParent });
  if (!/^wish-willow-p2-c-[0-9a-f-]{36}$/i.test(path.basename(home))) throw Error('Use a fresh C Home UUID, not retained B state');
  return home;
}
async function freePort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 19387) throw Error('Invalid approved loopback port');
  await new Promise((ok, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(error => error ? reject(error) : ok()));
  });
}
async function boot(args, checkAcceptanceHome, operation) {
  await checkAcceptanceHome(args.home); // original protection paths, before replacing env/cwd
  await freePort(args.port);
  const env = { ...isolatedEnvironment(args.home), DSH_PROFILE: 'web' };
  env.PATH = `${path.dirname(process.execPath)}${process.platform === 'win32' ? ';' : ':'}${env.PATH ?? ''}`;
  for (const dir of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) { await assertNoLinks(dir); await mkdir(dir, { recursive: true }); }
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, env); process.chdir(args.home);
  await checkAcceptanceHome(args.home); // same protected roots, not the newly isolated HOME/DSH_HOME
  const dshModules = path.join(repositoryRoot, '.research/installed/dsh/node_modules');
  const load = name => import(pathToFileURL(path.join(dshModules, name)).href);
  const { loadLayeredEnv } = await load('@deepseek-ai/dsh-app-boot/lib/index.js');
  const { runProfile } = await load('@deepseek-ai/dsh/lib/profile-boot.js');
  const application = await runProfile({ environment: loadLayeredEnv('dsh'), profile: 'web',
    patchFiles: [path.join(repositoryRoot, 'tests/live-probe-unified/runtime.patch.yml')], args: ['--no-open', '--port', String(args.port)] });
  let code = 1;
  try {
    assert.equal(application.ctx.profileContext.home, args.home); assert.equal(application.ctx.webServer.port, args.port);
    const service = application.ctx.get('wishWillowP1');
    if (!service || typeof service.orchestrator.verifyCommand !== 'function' || typeof service.orchestrator.stageDelivery !== 'function') throw Error('New production preparation methods are not installed');
    assert.equal(service.orchestrator.config.workspaceRoot, path.join(args.home, 'wish-willow'));
    const value = await operation(application.ctx, service); code = 0; return value;
  } finally { await application.shutdown.shutdown(code); }
}
export async function run(argv) {
  const args = argumentsFor(argv); // no DSH import, process launch, Home adoption or mutation on a bare invocation
  if (Number(process.versions.node.split('.')[0]) < 22 || process.env.NODE_OPTIONS || process.env.NODE_PATH) throw Error('Node >=22 and clean NODE_OPTIONS/NODE_PATH required');
  const inputs = await fixedInputs(), ledger = inputLedger(inputs);
  if (args.mode === 'hash-inputs') {
    if (!within(path.join(repositoryRoot, '.test-data/packages'), args.file) || !/^p2-c-[0-9a-f-]{36}$/i.test(path.basename(path.dirname(args.file))) || !args.file.endsWith('.json')) throw Error('New hash ledger must be in a new C UUID package directory, never a retained B directory');
    await absent(args.file); await assertNoLinks(path.dirname(args.file)); await mkdir(path.dirname(args.file), { recursive: true });
    const result = await writeNew(args.file, ledger); console.log(JSON.stringify(result)); return;
  }
  const runtime = JSON.parse(await readFile(path.join(repositoryRoot, '.research/installed/dsh/node_modules/@deepseek-ai/dsh/package.json'), 'utf8'));
  assert.equal(runtime.version, '0.2.0-rc.2', 'Use only the audited pinned DSH SDK, no peer exemptions');
  args.home = await homeForC(args.home);
  if (args.mode === 'install') {
    await absent(args.home);
    if (!within(path.join(repositoryRoot, '.test-data/packages'), args.archive) || !/^p2-c-[0-9a-f-]{36}$/i.test(path.basename(path.dirname(args.archive))) || !args.archive.endsWith('.tgz')) throw Error('Use a new C archive directory; never adopt the retained B package');
    await assertNoLinks(args.archive);
    assert.equal(sha256(await readFile(args.archive)), args.archiveHash);
    const { install } = await import('../live-probe-unified/install.mjs');
    const exit = await install([args.home, args.archive, 'web', 'add', '--authorize-isolated-profile-change']);
    if (exit !== 0) throw Error('Official isolated installation failed; retain Home and stop');
    const binding = await installed(args.home);
    await writeNew(path.join(args.home, 'c-install.json'), { format: 1, home: args.home, archive: args.archive, archiveHash: args.archiveHash,
      inputLedger: ledger, ...binding, sdkVersion: runtime.version, at: new Date().toISOString(), node: process.execPath });
    console.log('C isolated installation recorded; no Host/model started'); return;
  }
  await assertAcceptanceHome(args.home);
  const receiptFile = path.join(args.home, 'c-install.json'); await assertNoLinks(receiptFile);
  const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
  const binding = await installed(args.home);
  assert.equal(receipt.home, args.home); assert.deepEqual(receipt.core, binding.core); assert.deepEqual(receipt.driver, binding.driver); assert.deepEqual(receipt.inputLedger, ledger);
  assert.equal(sha256(await readFile(receipt.archive)), receipt.archiveHash);
  if (!within(path.join(args.home, 'evidence'), args.evidence)) throw Error('Evidence must be a child of the C Home/evidence');
  await assertNoLinks(args.evidence);
  await absent(path.join(args.home, 'probe-host-started')); await absent(path.join(args.home, 'stop-host'));
  // UUID/path, ownership, installed source/driver, receipt and archive checks above all succeeded.
  // Capture real protection paths now, before boot changes HOME/USERPROFILE/DSH_HOME/AppData/cwd.
  const checkAcceptanceHome = await captureAcceptanceHome(args.home);
  if (args.mode === 'prepare') {
    assert.equal(receipt.archiveHash, args.archiveHash);
    await absent(args.evidence); await mkdir(path.dirname(args.evidence), { recursive: true }); await mkdir(args.evidence);
    await writeNew(path.join(args.home, 'c-prepare-started.json'), { evidence: args.evidence, archiveHash: args.archiveHash, inputLedger: ledger });
    return boot(args, checkAcceptanceHome, async (ctx, service) => {
      ctx.on('agent/pre-step', async () => ({ kind: 'reject' })); // whole preparation has no model steps
      assert.equal(service.store.list().length, 0); assert.equal((await ctx.sessionQuery.listSessions()).length, 0);
      const { prepareFixedCandidate } = await import('./fixed-candidate.mjs');
      const candidates = [], signal = AbortSignal.timeout(600000);
      for (let index = 0; index < 2; index++) {
        const prepared = await prepareFixedCandidate(service, index, args.home, args.evidence, signal, checkAcceptanceHome);
        candidates.push(prepared);
        await writeNew(path.join(args.evidence, `prepared-${index}.json`), prepared);
      }
      await writeNew(path.join(args.evidence, 'prepared.json'), { format: 1, home: args.home, archiveHash: receipt.archiveHash,
        inputLedger: ledger, candidates, at: new Date().toISOString() });
      console.log('Two actual fixed candidates prepared; no Reviewer invoked');
    });
  }
  const preparedFile = path.join(args.evidence, 'prepared.json'); await assertNoLinks(preparedFile);
  const prepared = JSON.parse(await readFile(preparedFile, 'utf8'));
  assert.equal(prepared.home, args.home); assert.equal(prepared.archiveHash, receipt.archiveHash); assert.deepEqual(prepared.inputLedger, ledger); assert.equal(prepared.candidates.length, 2);
  await writeNew(path.join(args.home, 'c-review-started.json'), { evidence: args.evidence, provider: args.provider, model: args.model,
    maxReviewerAttempts: 2, maxStepsEach: 20, maxMsEach: 300000, totalMaxSteps: 40, totalMaxMs: 600000, moneyCap: 'NOT ENFORCED; explicitly acknowledged', retry: false });
  return boot(args, checkAcceptanceHome, async (ctx, service) => {
    const actual = ctx.agentDefaultModel.currentSelection(); assert.equal(actual.provider, args.provider); assert.equal(actual.model, args.model);
    const allowed = new Set(), created = new Set();
    ctx.on('agent/pre-step', async ({ agent }, next) => allowed.has(agent.id) ? next() : { kind: 'reject' });
    ctx.on('agent/created', ({ agent }) => {
      if (!allowed.has(agent.id) || created.has(agent.id) || created.size >= 2) throw Error('Only the two claimed fresh Reviewers may be created');
      created.add(agent.id);
    });
    const totals = { steps: 0, inputTokens: 0, outputTokens: 0, inputTokensAvailable: true, outputTokensAvailable: true };
    const deadline = AbortSignal.timeout(600000), results = [];
    for (const [index, target] of prepared.candidates.entries()) {
      deadline.throwIfAborted();
      const before = service.store.read(target.projectId), candidate = before.quality?.candidates.find(c => c.id === target.candidateId);
      assert.deepEqual(candidate?.binding, target.binding);
      assert.equal(before.releases.length, 0); assert.equal(before.quality.attempts.length, 0); assert.equal(before.quality.reviews.length, 0);
      const selection = ctx.agentDefaultModel.currentSelection(); assert.equal(selection.provider, args.provider); assert.equal(selection.model, args.model);
      const { attempt } = await service.store.beginReview(before.id, candidate.id, randomUUID(), before.revision);
      await writeNew(path.join(args.evidence, `review-claim-${index}.json`), { attempt, binding: candidate.binding }); // failure consumes this claim; no retry
      allowed.add(attempt.sessionId);
      const operation = { handle: null, controller: new AbortController(), promise: null };
      const abort = () => { operation.controller.abort(); operation.handle?.agent.cancel({ kind: 'user' }); };
      deadline.addEventListener('abort', abort, { once: true });
      if (deadline.aborted) abort();
      const orchestrator = service.orchestrator;
      if (orchestrator.closing || orchestrator.isActive(before.id)) throw Error('Host is busy');
      operation.promise = orchestrator.reviewCandidate(before.id, candidate.id, attempt, operation);
      orchestrator.active.set(before.id, operation);
      try { await operation.promise; } finally { allowed.delete(attempt.sessionId); deadline.removeEventListener('abort', abort); orchestrator.active.delete(before.id); }
      const after = service.store.read(before.id), review = after.quality.reviews.at(-1), gate = after.quality.gates.at(-1);
      await writeNew(path.join(args.evidence, `result-${index}.json`), { project: after, session: await ctx.sessionQuery.readSession(attempt.sessionId) });
      assert.equal(review.sessionId, attempt.sessionId); assert.equal(review.execution.provider, args.provider); assert.equal(review.execution.model, args.model);
      assert.equal(review.execution.persisted, true); assert.equal(review.execution.endReason, 'completed');
      assert.equal(review.execution.failures, 0); assert.ok(review.execution.steps <= 20 && review.execution.toolCalls <= 120);
      totals.steps += review.execution.steps;
      for (const name of ['inputTokens', 'outputTokens']) {
        if (review.execution[name] === undefined) totals[`${name}Available`] = false; else totals[name] += review.execution[name];
      }
      // External acceptance oracle only AFTER real review; never sent in material/prompt/path.
      if (index === 0) { assert.equal(review.status, 'PASS'); assert.equal(review.report?.status, 'PASS'); assert.equal(gate.verdict, 'ALLOW'); assert.equal(after.releases.length, 1); }
      else {
        assert.equal(review.status, 'FAIL'); assert.equal(review.report?.status, 'FAIL'); assert.equal(gate.verdict, 'NEEDS_CHANGES'); assert.equal(after.releases.length, 0);
        const source = candidate.materials.find(m => m.path === 'candidate:app.mjs'), test = candidate.materials.find(m => m.path === 'candidate:app.test.mjs');
        for (const material of [source, test]) assert.ok(material && fullyRead(material, review.reads));
        assert.ok(review.report.checks.some(c => c.name === 'requirements' && c.status === 'FAIL' && c.materialIds.includes(source.id)));
        assert.ok(review.report.issues.some(i => i.severity === 'must-fix' && i.materialIds.includes(source.id) && i.location && /app\.mjs/.test(i.location) && /减|subtract|a\s*-\s*b/i.test(i.description)));
      }
      results.push({ projectId: after.id, candidateId: candidate.id, reviewId: review.id, sessionId: attempt.sessionId, verdict: review.status, gate: gate.verdict, releases: after.releases.length });
    }
    assert.equal(created.size, 2); assert.ok(totals.steps <= 40);
    await writeNew(path.join(args.evidence, 'acceptance.json'), { results, totals, provider: args.provider, model: args.model,
      modelFee: 'NOT AVAILABLE; no hard monetary cap', at: new Date().toISOString(), scope: 'P2-C only; no P1 exception closure or publication' });
    console.log('Two real Reviewer outcomes and production gates recorded; inspect retained evidence before human acceptance');
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await run(process.argv.slice(2)); }
  catch (error) {
    const detail = String(error?.message ?? error).slice(0, 9000);
    console.error('C acceptance driver stopped; retain owned Home/evidence. No automatic retry.');
    console.error(detectCredentialContent(Buffer.from(detail)) ? 'Error detail withheld: possible credential content.' : detail);
    process.exitCode = 2;
  }
}
