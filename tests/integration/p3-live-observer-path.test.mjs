// Exact observer callbacks, local-only stream seam; no Host, adapter or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Context } from '@deepseek-ai/cordis';
import Agents from '@deepseek-ai/dsh-agent';
import Sessions from '@deepseek-ai/dsh-session';
import { createScope } from '@deepseek-ai/dsh-scope';
import { markAgentLoopRequest, isAgentLoopRequest, createUserMessage } from '@deepseek-ai/dsh-llm';
const source = await readFile(new URL('../live-probe-p3-intake/live-observer.mjs', import.meta.url), 'utf8');
const callbacks = source.slice(source.indexOf('  const reject ='), source.indexOf('  ctx.effect('));
assert.ok(callbacks.includes("ctx.on('llm/stream'"));
const wish = '我想做一个简单的本地家庭记账网页，可以记录每天的收入和支出。';
const initial = () => ({ ready: true, sessionId: null, directUserMessages: [], questionReplies: [], streams: [], toolCalls: [], toolResults: [], anomaly: null, rejection: null });
const config = { conversation: 'G:/dsh/Wish-Willow/.test-data/owned/conversation', startedAt: 1000 };
function mount(ctx, state, cfg = config) {
  new Function('ctx', 'state', 'cfg', 'path', 'publish', 'queue', 'wish', 'isAgentLoopRequest', 'readPluginInventory', callbacks)(
    ctx, state, cfg, path.win32, () => {}, Promise.resolve(), wish, isAgentLoopRequest,
    async () => ({ entries: [{ entryId: 'include:llm-retry', enabled: false }] }));
}
function scenario(overrides = {}, stateOverrides = {}, cfgOverrides = {}) {
  const state = { ...initial(), ...stateOverrides }, handlers = new Map(), agents = new Map(), sessions = new Map();
  const ctx = { on: (name, fn) => handlers.set(name, fn), agents: { get: id => agents.get(id), roots: () => [...agents.values()] }, sessions: { get: id => sessions.get(id) },
    settings: { describe: () => [{ ns: 'llm-pi-ai', value: { providers: { command: { api: 'openai-completions', baseURL: 'https://api.commandcode.ai/provider/v1', apiKeyEnv: 'COMMAND_API_KEY', models: [{ id: 'deepseek/deepseek-v4.1-flash' }] } } } }] },
    credentials: { describe: async () => ({ configured: true }) } };
  mount(ctx, state, { ...config, ...cfgOverrides });
  const make = (id, meta = {}) => {
    const session = { id, header: { cwd: 'G:\\dsh\\Wish-Willow\\.test-data\\owned\\conversation', agentPreset: 'cordis', createdAt: 2000, isSeeded: false, ...overrides, ...meta } };
    const agent = { id, session }; agents.set(id, agent); sessions.set(id, session); return agent;
  };
  const agent = make('new-root');
  const created = (a = agent, source = 'startup') => handlers.get('agent/created')({ agent: a, source });
  const user = (a = agent, text = wish, kind = 'user') => handlers.get('session/event')(a.session, { type: 'user/message', seq: 0, data: { id: 'message', source: { kind }, content: [{ type: 'text', text }] } });
  let forwards = 0;
  const stream = async (request = {}, loop = true) => {
    const options = { sessionId: agent.id, provider: 'command', model: 'deepseek/deepseek-v4.1-flash', maxTokens: 2000, ...request };
    if (loop) markAgentLoopRequest(options);
    for await (const _ of handlers.get('llm/stream')(options, async function* () { forwards++; })) { /* no adapter */ }
  };
  return { state, agent, make, created, user, stream, agents, forwards: () => forwards };
}
test('same absolute Windows paths remain eligible, but publication alone never binds', () => {
  for (const cwd of ['G:/dsh/Wish-Willow/.test-data/owned/conversation', 'G:\\dsh\\Wish-Willow\\.test-data\\owned\\conversation', 'G:\\dsh\\Wish-Willow\\.test-data\\owned\\x\\..\\conversation']) {
    const s = scenario({ cwd }); s.created(); assert.equal(s.state.sessionId, null);
    s.user(); assert.equal(s.state.sessionId, 'new-root'); assert.equal(s.state.directUserMessages.length, 1);
  }
});
test('empty preparation before/after readiness and additional empty Sessions do not stop or bind', async () => {
  const s = scenario({}, { ready: false }); s.created();
  const other = s.make('empty-other'); s.created(other);
  assert.equal(s.state.anomaly, null); assert.equal(s.state.sessionId, null);
  s.state.ready = true; s.user(other); assert.equal(s.state.sessionId, 'empty-other');
  s.created(s.make('third-empty')); assert.equal(s.state.anomaly, null);
  await s.stream({ sessionId: other.id }); assert.equal(s.forwards(), 1);
});
test('exact dialogue readiness block accepts empty prepared Agents but still refuses unauthorized activity', async () => {
  const runner = await readFile(new URL('../live-probe-p3-intake/live-dialogue.mjs', import.meta.url), 'utf8');
  const block = runner.match(/  assert\.equal\(observer\.state\.anomaly,[^]*?observer\.state\.ready = true;/); assert.ok(block);
  assert.equal(runner.includes('assert.equal(ctx.agents.list().length, 0'), false);
  const ready = new Function('observer', 'assert', block[0]);
  const s = scenario({}, { ready: false }); s.created(); ready({ state: s.state }, assert);
  assert.equal(s.state.ready, true); assert.equal(s.state.sessionId, null);
  for (const invalid of [{ anomaly: 'unexpected-model-activity' }, { sessionId: 'already-bound' }, { streams: [{}] }]) {
    assert.throws(() => ready({ state: { ...initial(), ready: false, ...invalid } }, assert));
  }
});
test('different directory/drive/relative path, wrong preset, parent/subagent, seeded and old Sessions never authorize', async () => {
  const cases = [
    ...['G:/other', 'G:/dsh/Wish-Willow/.test-data/owned/conversation-child', 'H:/dsh/Wish-Willow/.test-data/owned/conversation', 'conversation', undefined].map(cwd => ({ cwd })),
    { agentPreset: 'standard' }, { parentSession: 'parent' }, { origin: 'subagent' }, { isSeeded: true }, { createdAt: 999 }, { createdAt: undefined },
  ];
  for (const meta of cases) {
    const s = scenario(meta); s.created();
    assert.equal(s.state.anomaly, null, 'non-model preparation is not fatal');
    const unbound = scenario(meta); unbound.created();
    await assert.rejects(unbound.stream(), /unexpected-model/); assert.equal(unbound.forwards(), 0);
    assert.throws(() => s.user(), /unexpected-session/); assert.equal(s.state.sessionId, null);
    assert.ok(s.state.rejection.fields.length); await assert.rejects(s.stream()); assert.equal(s.forwards(), 0);
  }
  const relative = scenario({}, {}, { conversation: 'conversation' }); relative.created();
  assert.throws(() => relative.user(), /unexpected-session/); assert.ok(relative.state.rejection.fields.includes('cwd'));
});
test('unready input, resume/clear/compact, missing creation, non-user source and wrong wish cannot bind', async () => {
  for (const source of ['resume', 'clear', 'compact', undefined]) {
    const s = scenario(); if (source) s.created(s.agent, source);
    assert.throws(() => s.user(), /unexpected-session/); assert.equal(s.state.sessionId, null);
    await assert.rejects(s.stream()); assert.equal(s.forwards(), 0);
  }
  const unready = scenario({}, { ready: false }); unready.created(); assert.throws(() => unready.user(), /unexpected-session/);
  const reply = scenario(); reply.created(); reply.user(reply.agent, wish, 'user-question-reply');
  assert.equal(reply.state.sessionId, null); await assert.rejects(reply.stream(), /unexpected-model/);
  const wrong = scenario(); wrong.created(); assert.throws(() => wrong.user(wrong.agent, 'not the authorized wish'), /unexpected-or-duplicate/);
  assert.equal(wrong.state.sessionId, null);
});
test('empty/unbound/foreign Sessions, wrong route/purpose and hand-built requests never reach stream seam', async () => {
  const empty = scenario(); empty.created(); await assert.rejects(empty.stream(), /unexpected-model/); assert.equal(empty.forwards(), 0);
  for (const request of [{ sessionId: 'other' }, { provider: 'other' }, { model: 'other' }, { purpose: 'session-title' }]) {
    const s = scenario(); s.created(); s.user(); await assert.rejects(s.stream(request), /unexpected-model/); assert.equal(s.forwards(), 0);
  }
  const manual = scenario(); manual.created(); manual.user(); await assert.rejects(manual.stream({}, false), /unexpected-model/); assert.equal(manual.forwards(), 0);
});
test('second direct-user Session and duplicate input stop; same-id Agent replacement cannot inherit authority', async () => {
  const s = scenario(); s.created(); s.user(); const other = s.make('other'); s.created(other);
  assert.equal(s.state.anomaly, null); assert.throws(() => s.user(other), /second-session/); assert.equal(s.state.sessionId, 'new-root');
  const duplicate = scenario(); duplicate.created(); duplicate.user(); duplicate.user();
  await assert.rejects(duplicate.stream()); assert.equal(duplicate.forwards(), 0);
  const replacement = scenario(); replacement.created(); replacement.user(); replacement.created(replacement.make('new-root'));
  await assert.rejects(replacement.stream(), /unexpected-model/); assert.equal(replacement.forwards(), 0);
});
test('official SessionStore + serial AgentRegistry preparation stays unbound; committed user event binds exact live root', async t => {
  const ctx = new Context(); t.after(() => ctx.fiber.dispose());
  await ctx.plugin(Agents); await ctx.plugin(Sessions);
  const state = { ...initial(), ready: false }; mount(ctx, state);
  const session = ctx.sessions.create('official-root', { meta: { cwd: config.conversation, agentPreset: 'cordis' } });
  const agent = { id: session.id, session }, scope = createScope(ctx, agent); agent.ctx = scope.ctx;
  t.after(() => scope.dispose()); const detach = ctx.agents.enter(agent, undefined); t.after(detach);
  await ctx.agents.announce(agent, 'startup');
  assert.equal(state.anomaly, null); assert.equal(state.sessionId, null); assert.equal(session.seq, 0);
  state.ready = true;
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text: wish }], source: { kind: 'user' } }), { surfaceOp: 'append' });
  // session/event is post-commit emit; drain its already-queued notification, not a model loop.
  await Promise.resolve(); await Promise.resolve();
  assert.equal(state.sessionId, agent.id); assert.equal(state.directUserMessages.length, 1); assert.equal(state.anomaly, null);
  assert.equal(state.streams.length, 0);
});
