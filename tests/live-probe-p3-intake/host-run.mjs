// One official CLI Web invocation, no model messages or engineering submissions.
import assert from 'node:assert/strict';
import path from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { repositoryRoot, assertAcceptanceHome, assertNoLinks, isolatedEnvironment, within } from '../helpers/isolation.mjs';
const [ledger] = process.argv.slice(2); assert.ok(ledger);
const r = JSON.parse(await readFile(ledger, 'utf8'));
await assertAcceptanceHome(r.paths.home);
const save = async (name, value) => writeFile(path.join(r.paths.evidence, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const env = { ...isolatedEnvironment(r.paths.home), ...r.envOverrides };
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, env);
process.chdir(r.paths.invocation);
assert.equal(path.resolve(homedir()), r.paths.home);
const port = await new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject);
  s.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => { const p = s.address().port; s.close(error => error ? reject(error) : resolve(p)); }); });
assert.notEqual(port, 19387);
const load = file => import(pathToFileURL(path.join(repositoryRoot, '.research/installed/dsh/node_modules', file)).href);
const observerPath = path.join(repositoryRoot, 'tests/live-probe-p3-intake/host-observer.mjs');
const guardPath = path.join(repositoryRoot, 'tests/live-probe-p3-intake/guard.mjs');
const observer = await import(pathToFileURL(observerPath));
const overlay = path.join(r.paths.evidence, 'deployment.patch.yml'); // each authorized run owns fresh evidence
const jsonPath = value => JSON.stringify(value.replaceAll('\\', '/'));
await writeFile(overlay, `# One owned no-model deployment invocation only.\n- id: wish-willow-p3-intake-acceptance-guard\n  name: ${jsonPath(guardPath)}\n- id: web-runtime\n  config:\n    openBrowser: false\n    printUrl: false\n    surfaceContext: false\n    trustedHosts: []\n- id: agent-loop\n  config:\n    agents: []\n- id: agent-preset-registry\n  config:\n    default: cordis\n- id: approval\n  config:\n    policy: never\n- id: permission\n  config:\n    defaultPreset: p3-intake-only\n    presets:\n      p3-intake-only:\n        sandbox: workspace-write\n        approval: never\n- id: llm-deepseek\n  disabled: true\n- id: llm-deepseek-account\n  disabled: true\n- id: llm-pi-ai\n  disabled: true\n- id: deepseek-account\n  disabled: true\n- id: goal-round-driver\n  disabled: true\n- insert:\n    - id: wish-willow-p3-no-model-observer\n      name: ${jsonPath(observerPath)}\n`, { flag: 'wx' });
const acceptance = path.join(repositoryRoot, 'tests/live-probe-p3-intake/acceptance.patch.yml');
const { runCli } = await load('@deepseek-ai/dsh/lib/bin.js');
process.argv = [process.execPath, r.cli, 'web', '--patch', acceptance, '--patch', overlay, '--no-open', '--host', '127.0.0.1', '--port', String(port)];
let handle;
let booted = false, passed = false;
const summary = { home: r.paths.home, invocation: process.cwd(), profile: 'web', port, origin: `http://127.0.0.1:${port}`, boot: 'official dsh runCli -> web', modelsAuthorized: false };
try {
  await runCli(); booted = true;
  const ctx = observer.context; assert.ok(ctx); assert.equal(ctx.fiber.state, 2);
  assert.equal(ctx.get('profileContext').home, r.paths.home);
  assert.equal(ctx.get('profileContext').dir, path.join(r.paths.home, 'profiles/web'));
  assert.equal(ctx.llm.listProviders().length, 0);
  assert.equal(ctx.agents.list().length, 0, 'no automatic roots or recovered engineering at boot');
  assert.equal(ctx.wishWillowP1.orchestrator.config.maxSteps, 0);
  assert.equal(ctx.wishWillowP1.orchestrator.config.workspaceRoot, r.paths.projects);
  const { readPluginInventory } = await load('@deepseek-ai/dsh-host-plugin-inventory/lib/index.js');
  const inventory = await readPluginInventory(ctx);
  summary.entries = inventory.entries.map(({ entryId, moduleName, enabled, fiberPhase }) => ({ entryId, moduleName, enabled, fiberPhase }));
  for (const suffix of ['wish-willow', 'wish-willow-p3-intake-acceptance-guard', 'wish-willow-p3-no-model-observer', 'permission']) {
    const row = summary.entries.find(e => e.entryId === suffix || e.entryId.endsWith(':' + suffix));
    assert.ok(row, suffix); assert.equal(row.fiberPhase, 'active', suffix);
  }
  const expected = ['wish_willow_context', 'wish_willow_submit'];
  const global = ctx.tools.schemas();
  for (const name of expected) assert.ok(global.some(t => t.name === name), name);
  summary.globalNativeTools = global.filter(t => expected.includes(t.name));
  handle = await ctx.agents.create({ sessionId: `p3-intake-host-${randomUUID()}`, meta: { cwd: r.paths.invocation, agentPreset: 'cordis' },
    agentOptions: { provider: 'disabled-no-model', model: 'never-request' }, setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, 'cordis'); } });
  const agent = handle.agent; assert.equal(agent.status, 'idle');
  const assembly = await ctx.systemPrompt.assemble({ scope: agent });
  assert.deepEqual(assembly.tools.map(t => t.name).sort(), expected);
  // schemas() includes permitted native tools plus any preset-owned entries; guard is authoritative.
  const scoped = ctx.tools.schemas(agent); for (const name of expected) assert.ok(scoped.some(t => t.name === name));
  summary.scopedNativeTools = scoped.filter(t => expected.includes(t.name)); summary.presentedTools = assembly.tools.map(t => t.name);
  summary.denials = [];
  for (const name of ['pwsh', 'bash', 'write', 'edit', 'read', 'web_fetch', 'web_search', 'subagent', 'subagent_fork', 'workflow', 'plugin_manager']) {
    // Invalid empty arguments ensure that even a missing guard cannot perform a real action.
    const result = await ctx.tools.execute({ name, arguments: {}, agent, callId: randomUUID(), signal: new AbortController().signal });
    assert.equal(result.isError, true, name);
    summary.denials.push({ name, code: result.error?.code ?? null, guardRejected: /P3 intake acceptance/.test(result.error?.message ?? '') });
    if (ctx.tools.get(name, agent)) assert.equal(summary.denials.at(-1).guardRejected, true, name);
  }
  let trapBodies = 0;
  const removeTrap = agent.ctx.tools.register({ name: 'p3_deployment_forbidden_probe', description: 'Pure no-side-effect guard check', parameters: { type: 'object' },
    output: { schema: { type: 'object', additionalProperties: true }, render: () => [] }, execute: async () => { trapBodies++; return {}; } });
  const trapped = await ctx.tools.execute({ name: 'p3_deployment_forbidden_probe', arguments: {}, agent, callId: randomUUID(), signal: new AbortController().signal });
  assert.equal(trapped.isError, true); assert.match(trapped.error.message, /P3 intake acceptance/); assert.equal(trapBodies, 0); await removeTrap();
  const context = await ctx.tools.execute({ name: 'wish_willow_context', arguments: {}, agent, callId: randomUUID(), signal: new AbortController().signal });
  assert.equal(context.isError, false);
  // Trusted Host writes one clearly labelled inert draft, never submit/launch/retry/review.
  const draft = await ctx.wishWillowP1.create({ requestId: randomUUID(), title: 'Task03 Host-only storage probe', wish: 'Deployment path check only; no software development requested.' });
  assert.equal(draft.runs.length, 0); assert.equal(draft.changes.length, 0); assert.ok(within(r.paths.projects, draft.workspace));
  const storageFile = path.join(r.paths.home, 'storages/wish_willow_p1.json'); await assertNoLinks(storageFile);
  const storageBytes = await readFile(storageFile); assert.ok(storageBytes.toString().includes(draft.id));
  assert.equal(ctx.sessionPersistence.root, path.join(r.paths.home, 'sessions'));
  // Flush the exact live Session; an ID or detached lookalike is not accepted.
  assert.equal(ctx.sessions.get(agent.id), agent.session, 'Session must still be live');
  assert.equal(await ctx.sessions.flush(agent.session), true, 'A durability listener must complete');
  const stored = await ctx.sessionPersistence.open(agent.id, 'read');
  let slice;
  try { slice = await stored.read(0, 1000); } finally { await stored.close(); }
  const events = slice.events;
  assert.ok(Array.isArray(events));
  assert.ok(!events.some(e => ['request/header', 'request/context', 'assistant/message', 'assistant/attempt', 'turn/start', 'step/start'].includes(e.type)));
  summary.session = { id: agent.id, root: ctx.sessionPersistence.root, eventTypes: events.map(e => e.type), modelEvents: 0 };
  summary.product = { id: draft.id, workspace: draft.workspace, storageFile, storageSha256: createHash('sha256').update(storageBytes).digest('hex'), runs: 0, changes: 0 };
  summary.modelProviders = ctx.llm.listProviders(); summary.counts = { ...observer.counts };
  assert.equal(observer.counts.agentRequests, 0); assert.equal(observer.counts.llmStreams, 0);
  await handle.dispose(); handle = null; assert.equal(ctx.agents.list().length, 0);
  // Only loopback HTTP to this owned Host. Keep authentication entirely in memory.
  const connection = ctx.get('connection');
  const start = await fetch(connection.authenticatedUrl(summary.origin), { redirect: 'manual' });
  const cookies = start.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  const page = await fetch(summary.origin, { headers: { cookie: cookies } });
  assert.equal(page.status, 200); const html = await page.text();
  summary.http = { status: page.status, htmlBytes: Buffer.byteLength(html), authenticatedUrlRecorded: false };
  await save('host-verification.json', summary); passed = true;
  console.log(JSON.stringify({ verification: 'passed', origin: summary.origin, tools: expected, guard: 'effective', modelRequests: 0, evidence: path.join(r.paths.evidence, 'host-verification.json') }));
} catch (error) {
  await save('host-failed.json', { ...summary, error: { name: error.name, message: String(error.message).replace(/https?:\/\/\S+\?\S+/g, '[URL query omitted]') }, counts: observer.counts });
  console.error(JSON.stringify({ verification: 'failed', error: error.name, evidence: path.join(r.paths.evidence, 'host-failed.json') }));
  process.exitCode = 1;
} finally {
  if (handle) await handle.dispose();
  if (booted) {
    await save('shutdown-requested.json', { pid: process.pid, at: new Date().toISOString(), counts: observer.counts, ownHostOnly: true });
    // Official runCli installed this process-local SIGTERM handler; it drains its profile.
    process.emit(passed ? 'SIGTERM' : 'SIGINT');
  }
}
