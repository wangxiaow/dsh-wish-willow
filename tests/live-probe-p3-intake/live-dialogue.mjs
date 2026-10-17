// One real, user-operated Task03 run. Reuses installed bundle; never sends chat or calls its tools.
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { repositoryRoot, assertAcceptanceHome, assertNoLinks, isolatedEnvironment, within } from '../helpers/isolation.mjs';
const [ledgerPath] = process.argv.slice(2); assert.ok(ledgerPath);
const r = JSON.parse(await readFile(ledgerPath, 'utf8'));
await assertAcceptanceHome(r.paths.home);
assert.ok(within(r.paths.home, r.paths.evidence)); await assertNoLinks(r.paths.evidence);
const save = (name, value) => writeFile(path.join(r.paths.evidence, name), JSON.stringify(value, null, 2), { flag: 'wx' });
await save('host-start-claim.json', { pid: process.pid, startsAllowed: 1, startedAt: new Date().toISOString() });
const startedAt = Date.now();
const env = { ...isolatedEnvironment(r.paths.home), ...r.envOverrides };
for (const key of Object.keys(process.env)) delete process.env[key]; Object.assign(process.env, env);
process.chdir(r.paths.invocation);
const load = name => import(pathToFileURL(path.join(repositoryRoot, '.research/installed/dsh/node_modules', name)).href);
const observerPath = path.join(repositoryRoot, 'tests/live-probe-p3-intake/live-observer.mjs');
const guardPath = path.join(repositoryRoot, 'tests/live-probe-p3-intake/guard.mjs');
const observer = await import(pathToFileURL(observerPath));
const port = await new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => { const p = s.address().port; s.close(e => e ? reject(e) : resolve(p)); }); });
assert.notEqual(port, 19387);
const yaml = value => JSON.stringify(value.replaceAll('\\', '/'));
const overlay = path.join(r.paths.evidence, 'live.patch.yml');
await writeFile(overlay, `# Single user-operated real dialogue only; no credential values.\n- id: wish-willow\n  config:\n    workspaceRoot: ${yaml(r.paths.projects)}\n    maxSteps: 0\n    maxRunMs: 10000\n- id: wish-willow-p3-intake-acceptance-guard\n  name: ${yaml(guardPath)}\n- id: web-runtime\n  config:\n    openBrowser: true\n    printUrl: false\n    surfaceContext: false\n    trustedHosts: []\n- id: agent-loop\n  config:\n    agents: []\n- id: agent-preset-registry\n  config:\n    default: cordis\n- id: agent-default-model\n  config:\n    provider: command\n    model: deepseek/deepseek-v4.1-flash\n- id: approval\n  config:\n    policy: never\n- id: permission\n  config:\n    defaultPreset: p3-intake-only\n    presets:\n      p3-intake-only:\n        sandbox: workspace-write\n        approval: never\n- id: llm-deepseek\n  disabled: true\n- id: llm-deepseek-account\n  disabled: true\n- id: deepseek-account\n  disabled: true\n- id: session-title-llm\n  disabled: true\n- id: llm-retry\n  disabled: true\n- id: goal-round-driver\n  disabled: true\n- id: command-compact\n  disabled: true\n- id: compaction-basic\n  config:\n    auto: false\n    compactionRetries: 0\n    maxOverflowRetries: 0\n# Model values are owned by the official editable Profile, never this overlay.\n- id: llm-pi-ai\n  disabled: false\n- insert:\n    - id: wish-willow-p3-live-observer\n      name: ${yaml(observerPath)}\n      config:\n        evidence: ${yaml(r.paths.evidence)}\n        conversation: ${yaml(r.paths.invocation)}\n        startedAt: ${startedAt}\n`, { flag: 'wx' });
let booted = false;
let outcome = { state: 'BLOCKED', reason: 'startup-not-completed' };
try {
  const { runCli } = await load('@deepseek-ai/dsh/lib/bin.js');
  process.argv = [process.execPath, r.cli, 'web', '--patch', path.join(repositoryRoot, 'tests/live-probe-p3-intake/acceptance.patch.yml'), '--patch', overlay, '--host', '127.0.0.1', '--port', String(port)];
  await runCli(); booted = true;
  const ctx = observer.context; assert.ok(ctx);
  const { readPluginInventory } = await load('@deepseek-ai/dsh-host-plugin-inventory/lib/index.js');
  const inventory = await readPluginInventory(ctx);
  for (const suffix of ['permission', 'wish-willow', 'wish-willow-p3-intake-acceptance-guard', 'wish-willow-p3-live-observer', 'llm-pi-ai']) {
    const e = inventory.entries.find(e => e.entryId.endsWith(':' + suffix)); assert.equal(e?.fiberPhase, 'active', suffix);
  }
  assert.equal(ctx.wishWillowP1.orchestrator.config.maxSteps, 0);
  assert.ok(ctx.llm.listProviders().every(p => p.id === 'command'), 'only the authorized route may already be configured');
  assert.equal(observer.state.anomaly, null, 'no unauthorized activity during preparation');
  assert.equal(observer.state.sessionId, null, 'empty prepared Sessions do not authorize a dialogue');
  assert.equal(observer.state.streams.length, 0, 'preparation must not invoke a model');
  observer.state.ready = true;
  // The existing observer validates route, authorization and retry policy before EVERY stream.
  // Empty provider settings at boot are valid: the official UI owns their creation.
  await save('ready.json', { origin: `http://127.0.0.1:${port}`, pid: process.pid, sessionId: null, waitingForUserModelConfigurationAndSession: true, home: r.paths.home, evidence: r.paths.evidence, provider: 'command', model: 'deepseek/deepseek-v4.1-flash', credentialConfigured: (await ctx.credentials.describe('COMMAND_API_KEY')).configured, guard: 'active', permission: 'active', engineeringMaxSteps: 0, visibleInteractions: 3, backendHardCapClaimed: false, browserHandoff: 'official default-browser; authenticated URL not recorded' });
  console.log(JSON.stringify({ liveHost: 'ready', origin: `http://127.0.0.1:${port}`, evidence: r.paths.evidence, requiresUserAuthorizationAndChat: true }));
  const deadline = Date.now() + 30 * 60 * 1000;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  let idleAt = null;
  while (Date.now() < deadline) {
    const state = observer.state;
    if (state.anomaly) { outcome = { state: state.streams.length ? 'PARTIAL' : 'BLOCKED', reason: state.anomaly }; break; }
    try { await lstat(path.join(r.paths.evidence, 'STOP')); outcome = { state: state.streams.length ? 'PARTIAL' : 'BLOCKED', reason: 'operator-stop' }; break; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const agent = state.sessionId ? ctx.agents.get(state.sessionId) : null;
    if (state.streams.length && state.streams.every(s => s.endedAt) && agent?.status === 'idle') {
      idleAt ??= Date.now();
      if (Date.now() - idleAt > 2000) {
        const project = ctx.wishWillowP1.list().find(p => p.history.some(h => h.action === 'submit-native-wish' && h.source.ref.startsWith(state.sessionId + '#')));
        outcome = { state: project ? 'PERSISTED-PENDING-COLD-VERIFICATION' : 'PARTIAL', reason: project ? 'model-submitted-native-wish' : 'model-finished-without-persisted-submit', projectId: project?.id ?? null }; break;
      }
    } else idleAt = null;
    await wait(1000);
  }
  if (outcome.reason === 'startup-not-completed') outcome = { state: 'BLOCKED', reason: 'user-interaction-timeout' };
  const actor = observer.state.sessionId ? ctx.agents.get(observer.state.sessionId) : null;
  // Record observed behavior before the durability checkpoint, so a checkpoint error cannot hide it.
  await save('dialogue-outcome.json', { ...outcome, origin: `http://127.0.0.1:${port}`, pid: process.pid, sessionId: observer.state.sessionId, observations: observer.state, backendRequests: 'observable DSH stream attempts only; gateway internals not claimed', inputTokenHardCap: false });
  if (actor && actor.status === 'idle') {
    assert.equal(ctx.sessions.get(actor.id), actor.session, 'checkpoint requires the exact live Session');
    assert.equal(await ctx.sessions.flush(actor.session), true, 'a durability listener must complete');
  }
} catch (e) {
  outcome = { state: 'BLOCKED', reason: 'runtime-check-failed', errorName: e.name };
  await save('runtime-blocked.json', { ...outcome, message: String(e.message).replace(/https?:\/\/\S+\?\S+/g, '[URL query omitted]'), observations: observer.state });
} finally {
  if (booted) {
    await save('shutdown-requested.json', { pid: process.pid, port, outcome, ownedHostOnly: true });
    process.emit('SIGTERM'); // official controller drains this profile only
  }
}
