// Only the two Task03 fixes. Pure overlay/gate tests + in-memory official Session service.
// No Host, real adapter, credentials, profile file writes or native user-message simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Context } from '@deepseek-ai/cordis';
import Sessions from '@deepseek-ai/dsh-session';
import { markAgentLoopRequest, isAgentLoopRequest } from '@deepseek-ai/dsh-llm';
import { composeEntries } from '../../.research/installed/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js';
import { parse } from '../../.research/installed/dsh/node_modules/yaml/dist/index.js';
const runner = await readFile(new URL('../live-probe-p3-intake/live-dialogue.mjs', import.meta.url), 'utf8');
const observer = await readFile(new URL('../live-probe-p3-intake/live-observer.mjs', import.meta.url), 'utf8');
const literal = runner.match(/await writeFile\(overlay, (`[^`]+`), \{ flag: 'wx' \}\);/);
assert.ok(literal);
const overlay = parse(new Function('yaml', 'r', 'guardPath', 'observerPath', 'startedAt', `return ${literal[1]}`)(JSON.stringify, { paths: { projects: '/owned/projects', evidence: '/owned/evidence', invocation: '/owned/chat' } }, '/guard.mjs', '/observer.mjs', 1000));
const base = [{ insert: [{ id: 'llm-pi-ai', name: '@deepseek-ai/dsh-llm-pi-ai', config: { providers: {} } }] }];
const profile = { providers: { command: { api: 'openai-completions', baseURL: 'https://api.commandcode.ai/provider/v1', apiKeyEnv: 'COMMAND_API_KEY', models: [{ id: 'deepseek/deepseek-v4.1-flash', maxTokens: 2000 }] } } };
const effective = tail => composeEntries([base, [{ id: 'llm-pi-ai', config: profile }], ...tail]).find(e => e.id === 'llm-pi-ai').config;

test('official composition: editable Profile now wins; old overlay would reproduce the Editor refusal', () => {
  const row = overlay.find(e => e.id === 'llm-pi-ai'); assert.equal(row.disabled, false); assert.equal(Object.hasOwn(row, 'config'), false);
  assert.deepEqual(effective([overlay]), profile);
  const old = [{ id: 'llm-pi-ai', config: { providers: { command: { ...profile.providers.command, displayName: 'overlay-owned' } } } }];
  assert.notDeepEqual(effective([old]), profile, 'exact equality used by official ConfigEditor:122 would fail');
  assert.equal(runner.includes('ctx.agents.create('), false, 'no route-required automatic Session before user setup');
});
test('non-model safety settings and original guard remain intact', async () => {
  const byId = id => overlay.find(e => e.id === id);
  assert.equal(byId('wish-willow').config.maxSteps, 0);
  assert.equal(byId('permission').config.defaultPreset, 'p3-intake-only');
  assert.deepEqual(byId('permission').config.presets['p3-intake-only'], { sandbox: 'workspace-write', approval: 'never' });
  for (const id of ['llm-deepseek', 'llm-deepseek-account', 'deepseek-account', 'llm-retry', 'session-title-llm', 'goal-round-driver']) assert.equal(byId(id).disabled, true, id);
  assert.equal(byId('compaction-basic').config.auto, false);
  assert.equal(createHash('sha256').update(await readFile(new URL('../live-probe-p3-intake/guard.mjs', import.meta.url))).digest('hex'), '18ce5773c3f30c10370ffcb864897280dccc4692c03ee2921d0b02aedd6b4fe8');
});

// Evaluate the exact existing stream callback with read-only scalar seams; next is local-only.
const callback = observer.match(/ctx\.on\('llm\/stream', (async function\* \(options, next\) \{[^]*?\n  \})\);/);
assert.ok(callback);
async function gate({ request = {}, route = {}, ready = true, configured = true, retryEnabled = false, prior = 0, loop = true, stateOverrides = {} } = {}) {
  const state = { ready, sessionId: 'local', anomaly: null, directUserMessages: [{}], streams: Array.from({ length: prior }, () => ({ endedAt: 'done' })), ...stateOverrides };
  const boundAgent = {};
  const ctx = { agents: { get: () => boundAgent }, settings: { describe: () => [{ ns: 'llm-pi-ai', value: { providers: { command: { ...profile.providers.command, ...route } } } }] }, credentials: { describe: async () => ({ configured }) } };
  // Session identity/eligibility runs through the full callbacks in p3-live-observer-path.
  const fn = new Function('ctx', 'state', 'publish', 'reject', 'queue', 'isAgentLoopRequest', 'readPluginInventory', 'boundAgent', 'prepared', 'sessionIssues', `return (${callback[1]});`)(ctx, state, () => {}, reason => { throw Error(reason); }, Promise.resolve(), isAgentLoopRequest, async () => ({ entries: [{ entryId: 'include:llm-retry', enabled: retryEnabled, fiberPhase: retryEnabled ? 'active' : null }] }), boundAgent, new WeakSet([boundAgent]), () => []);
  const options = { sessionId: 'local', provider: 'command', model: 'deepseek/deepseek-v4.1-flash', maxTokens: 2000, ...request };
  if (loop) markAgentLoopRequest(options);
  let forwards = 0;
  const chunks = fn(options, async function* () { forwards++; });
  for await (const _chunk of chunks) { /* local seam produces no chunks */ }
  return forwards;
}
test('official UI-shaped route passes without an unused advanced retryPolicy field', async () => { assert.equal(await gate(), 1); });
test('editable model values cannot bypass exact route, authorization, scope, retries or three-interaction gate', async () => {
  const cases = [
    [{ request: { provider: 'other' } }, /unexpected-model/], [{ request: { model: 'other' } }, /unexpected-model/],
    [{ request: { sessionId: 'other' } }, /unexpected-model/], [{ request: { purpose: 'summary' } }, /unexpected-model/],
    [{ loop: false }, /unexpected-model/], [{ ready: false }, /unexpected-model/],
    [{ route: { baseURL: 'https://other.invalid/v1' } }, /subscription-route/], [{ route: { api: 'anthropic-messages' } }, /subscription-route/],
    [{ route: { apiKeyEnv: 'OTHER_API_KEY' } }, /subscription-route/], [{ route: { headers: { Authorization: '[not a credential]' } } }, /subscription-route/],
    [{ configured: false }, /authorization-missing/], [{ retryEnabled: true }, /application-retry-enabled/],
    [{ prior: 3 }, /three-visible/], [{ request: { maxTokens: 2001 } }, /output-token/],
    [{ stateOverrides: { directUserMessages: [] } }, /direct-user-wish/],
    [{ stateOverrides: { streams: [{}] } }, /concurrent-model/],
    [{ stateOverrides: { anomaly: 'already-failed' } }, /already stopped/]
  ];
  for (const [input, reason] of cases) await assert.rejects(gate(input), reason);
});
test('sessions injection grants the actual scoped service; exact live checkpoint remains fail-closed', async t => {
  const inject = new Function(`return ${observer.match(/export const inject = (\[[^;]+\]);/)[1]}`)();
  assert.ok(inject.includes('sessions')); assert.ok(inject.includes('loader'));
  const ctx = new Context(); t.after(() => ctx.fiber.dispose());
  await ctx.plugin(Sessions);
  for (const key of inject.filter(k => k !== 'sessions')) ctx.provide(key, {});
  let inner;
  await ctx.plugin({ name: 'local-observer-dependency', inject, apply: value => { inner = value; } });
  const session = inner.sessions.create('local-checkpoint'); const actor = { id: session.id, session, status: 'idle' };
  const block = runner.match(/  if \(actor && actor\.status === 'idle'\) \{[^]*?\n  \}/); assert.ok(block);
  const flush = new Function('ctx', 'actor', 'assert', `return (async () => { ${block[0]} })()`);
  let completed = false;
  const detach = ctx.on('session/flush', async s => { assert.equal(s, session); await Promise.resolve(); completed = true; });
  await flush(inner, actor, assert); assert.equal(completed, true);
  await assert.rejects(flush(inner, { ...actor, session: {} }, assert), /exact live Session/);
  detach(); await assert.rejects(flush(inner, actor, assert), /durability listener/);
  assert.ok(runner.indexOf("await save('dialogue-outcome.json'") < runner.indexOf('await ctx.sessions.flush(actor.session)'), 'behavior evidence precedes a potentially failing checkpoint');
});
