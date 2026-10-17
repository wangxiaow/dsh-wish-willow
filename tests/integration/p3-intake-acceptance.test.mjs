import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createScope, scopeTarget } from '@deepseek-ai/dsh-scope';
import { Session } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { temporary } from '../helpers/temp.mjs';
import { unifiedRuntime } from '../helpers/unified-runtime.mjs';
import { settle } from '../helpers/p1-runtime.mjs';
import { isolatedEnvironment } from '../helpers/isolation.mjs';
import * as Guard from '../live-probe-p3-intake/guard.mjs';

const permitted = ['wish_willow_context', 'wish_willow_submit'];
const forbidden = ['write', 'edit', 'read', 'glob', 'grep', 'pwsh', 'bash', 'web_fetch', 'web_search',
  'subagent', 'subagent_fork', 'send_message', 'workflow', 'plugin_manager', 'load_workspace_dependencies',
  'create_goal', 'resume', 'wish_state', 'wish_plan', 'wish_verify', 'wish_deliver', 'future_tool'];
const definition = (name, body) => ({ name, description: name, parameters: { type: 'object' },
  output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
  execute: async (args, exec) => { body?.(args, exec); return { trapReached: true }; } });
const mountGuard = async (host, root, supplied = {}) => {
  const fiber = host.ctx.plugin(Guard, { authorize: 'p3-task03-entry-only', home: root,
    conversationWorkspace: host.workspace, ...supplied });
  await fiber;
  if (fiber.state !== 2) throw Error(`Acceptance guard inactive: ${fiber.error?.message ?? fiber.state}`);
  return fiber;
};

// Real Cordis scope, AgentRegistry publication and ToolRuntime. No AgentLoop or model driver.
async function conversation(host, logs, { id = randomUUID(), cwd = host.workspace, preset = 'cordis', owner, setup } = {}) {
  const old = logs.get(id), base = Session.create(id);
  const session = Session.create(id, old?.events, old?.header ?? { ...base.header, cwd, agentPreset: preset }, old?.inheritedEventCount ?? 0);
  const log = old ?? { header: session.header, events: [], inheritedEventCount: 0 }; logs.set(id, log);
  const agent = { id, session, cancel() {} }, scope = createScope(host.agentScopeContext, agent); agent.ctx = scope.ctx;
  let detach;
  try {
    setup?.(scope.ctx);
    detach = host.ctx.agents.enter(agent, owner);
    await host.ctx.agents.announce(agent, old ? 'resume' : 'startup');
  } catch (error) { detach?.(); await scope.dispose(); throw error; }
  const raw = (name, args = {}, signal = new AbortController().signal) => host.ctx.tools.execute({ name, arguments: args, agent, signal, callId: randomUUID() });
  return { agent, raw, close: async () => { detach(); await scope.dispose(); },
    user(text) {
      const event = session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }), { surfaceOp: 'append' });
      log.events.push(event); return event.seq;
    },
    async tool(name, args = {}) { const result = await raw(name, args); if (result.isError) throw Error(result.error.message); return result.value; },
  };
}

const fixture = async (t, options = {}) => {
  const root = await temporary(t), logs = new Map();
  let scriptedBodyCalls = 0;
  const host = await unifiedRuntime(root, { maxSteps: 0, realAgentRegistry: true, nativeSessions: logs,
    turns: [async () => { scriptedBodyCalls++; throw Error('No engineering model body may run'); }], ...options });
  t.after(host.close);
  return { root, logs, host, scriptedBodyCalls: () => scriptedBodyCalls };
};

function assertNoEngineering(p, host, bodyCalls) {
  assert.equal(bodyCalls, 0);
  assert.equal(host.scripted.state.validationCreateCount, 0); assert.equal(host.scripted.state.reviewCreateCount, 0);
  assert.equal(p.builds.length, 0); assert.equal(p.releases.length, 0);
  assert.ok(p.tasks.every(t => t.phase === 'plan'));
  assert.ok(p.runs.every(r => r.modelCalls === 0 && r.toolCalls === 0));
  assert.ok(!host.ctx.agents.list().some(a => /^wish-(?:willow|review|replay)-/.test(a.id)));
}

test('maxSteps: 0 is actually passed through: scripted model body and every execution tool stay uncalled', async t => {
  const { root, host, scriptedBodyCalls } = await fixture(t);
  assert.equal(host.ctx.wishWillowP1.orchestrator.config.maxSteps, 0);
  const created = await host.call('create', { input: { requestId: randomUUID(), title: 'zero budget', wish: '记录本地待办愿望' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: randomUUID(), wish: '记录本地待办愿望' } });
  const p = await settle(host, created.id);
  assert.equal(host.scripted.state.createCount, 1, 'zero budget alone constructs one scripted handle, NOT one model call');
  assert.equal(host.scripted.last.followups.length, 1);
  assert.ok(!host.scripted.last.events.some(e => e.type === 'assistant/message' || e.type === 'tool/result'));
  assertNoEngineering(p, host, scriptedBodyCalls());
  assert.deepEqual(await readdir(p.workspace), []);
  assert.ok((await readFile(join(root, 'wish_willow_p1.json'), 'utf8')).includes('记录本地待办愿望'));
});

test('root denies hidden globals, visible preset-owned tools, later tools, PTC and attempted force-allow; no trap body runs', async t => {
  const { root, host, logs } = await fixture(t);
  let bodies = 0;
  for (const name of forbidden) host.ctx.tools.register(definition(name, () => bodies++));
  const guard = await mountGuard(host, root); t.after(() => guard.dispose());
  const chat = await conversation(host, logs, { setup: ctx => {
    // Own scoped registrations evade restrict(), as the shipped Creator preset does.
    for (const name of forbidden) ctx.tools.register(definition(name, () => bodies++));
  } }); t.after(chat.close);
  assert.ok(host.ctx.tools.get('pwsh', chat.agent), 'visible scoped tool exercises the HARD guard, not hiding');
  assert.deepEqual((await host.ctx.systemPrompt.assemble({ scope: chat.agent })).tools.map(t => t.name).sort(), permitted);
  host.ctx.on('tools/pre-execute', async () => ({ kind: 'allow' }));
  for (const name of [...forbidden, 'run_code']) {
    const denied = await chat.raw(name, { command: 'must never execute', sandbox_permissions: 'danger-full-access' });
    assert.equal(denied.isError, true, name);
    const plain = await chat.raw(name);
    assert.equal(plain.isError, true, `${name}: ordinary direct dispatch`);
    if (name !== 'run_code') assert.match(plain.error.message, /P3 intake acceptance/, `${name}: actual guard rejection`);
  }
  const hidden = host.ctx.tools.register(definition('hidden_global', () => bodies++));
  assert.equal(host.ctx.tools.get('hidden_global', chat.agent), undefined);
  assert.equal((await chat.raw('hidden_global')).isError, true, 'direct call of hidden global must fail');
  const late = chat.agent.ctx.tools.register(definition('late_scoped', () => bodies++));
  assert.equal((await chat.raw('late_scoped')).isError, true);
  chat.agent.ctx.tools.presentAs('both');
  assert.equal((await chat.raw('run_code', { code: 'tools.pwsh({command: "forbidden"})' })).isError, true);
  assert.equal(bodies, 0);
  assert.equal(host.scripted.state.createCount, 0);
  await late(); await hidden();
});

test('same-name replacements, forged caller, agentless call and unknown publication all fail closed', async t => {
  const { root, host, logs } = await fixture(t);
  const guard = await mountGuard(host, root); t.after(() => guard.dispose());
  let shadowCalls = 0;
  const chat = await conversation(host, logs, { setup: ctx => ctx.tools.register(definition('wish_willow_submit', () => shadowCalls++)) }); t.after(chat.close);
  assert.equal((await chat.raw('wish_willow_submit')).isError, true);
  assert.equal(shadowCalls, 0);
  const noAgent = await host.ctx.tools.execute({ name: 'wish_willow_context', arguments: {}, callId: randomUUID(), signal: new AbortController().signal });
  assert.equal(noAgent.isError, true);
  const forged = await host.ctx.tools.execute({ name: 'wish_willow_context', arguments: {}, agent: { ...chat.agent }, callId: randomUUID(), signal: new AbortController().signal });
  assert.equal(forged.isError, true);
  for (const options of [{ owner: chat.agent }, { id: `wish-willow-${randomUUID()}` }, { id: `wish-review-${randomUUID()}` },
    { id: `wish-replay-${randomUUID()}` }, { preset: 'standard' }, { cwd: root }]) {
    await assert.rejects(conversation(host, logs, options), /refuses.*Agent publication/);
  }
  assert.deepEqual(host.ctx.agents.list(), [chat.agent]);
});

test('native persistence/project question/readback survive engineering publication refusal and reopen without redispatch', async t => {
  const questions = [];
  const { root, host, logs, scriptedBodyCalls } = await fixture(t, { answerQuestion: async request => {
    questions.push(request); return { answers: [{ id: 'wish-willow-project', selected: [request.questions[0].options[0].label] }] };
  } });
  const guard = await mountGuard(host, root); t.after(() => guard.dispose());
  const chat = await conversation(host, logs); t.after(chat.close);
  const wish = '请做一个本地待办软件。', sourceSeq = chat.user(wish);
  const before = await chat.tool('wish_willow_context'); assert.equal(before.sourceSeq, sourceSeq);
  const receipt = await chat.tool('wish_willow_submit', { sourceSeq, wish });
  assert.equal(receipt.persisted, true); assert.equal(receipt.dispatch, 'requested');
  const p = await settle(host, receipt.project.id);
  assert.equal(p.changes.length, 1); assert.equal(p.changes[0].status, 'failed');
  assert.match(p.changes[0].result, /refuses.*Agent publication/);
  assert.equal(p.history.find(h => h.action === 'submit-native-wish').source.ref, `${chat.agent.id}#${sourceSeq}`);
  assertNoEngineering(p, host, scriptedBodyCalls());
  assert.deepEqual(await readdir(p.workspace), []);
  const calls = host.scripted.state.createCount;
  const replay = await chat.tool('wish_willow_submit', { sourceSeq, wish });
  assert.equal(replay.replayed, true); assert.equal(replay.dispatch, 'not-requested');
  // A second, unbound real registry root invokes Host-owned project confirmation, not a fake approval flag.
  const second = await conversation(host, logs); t.after(second.close);
  const nextWish = '给这个待办软件添加标签。', nextSeq = second.user(nextWish);
  const linked = await second.tool('wish_willow_submit', { sourceSeq: nextSeq, wish: nextWish });
  await settle(host, p.id);
  assert.equal(linked.project.id, p.id); assert.equal(questions.length, 1); assert.equal(questions[0].agent, second.agent);
  await chat.close(); await second.close(); await guard.dispose(); await host.close();
  const reopenedHost = await unifiedRuntime(root, { maxSteps: 0, realAgentRegistry: true, nativeSessions: logs }); t.after(reopenedHost.close);
  const reopenedGuard = await mountGuard(reopenedHost, root); t.after(() => reopenedGuard.dispose());
  const reopened = await conversation(reopenedHost, logs, { id: chat.agent.id }); t.after(reopened.close);
  const state = await reopened.tool('wish_willow_context');
  assert.equal(state.project.id, p.id); assert.equal(state.changes.length, 2);
  const saved = await reopened.tool('wish_willow_submit', { sourceSeq, wish });
  assert.equal(saved.replayed, true); assert.equal(saved.dispatch, 'not-requested');
  assert.equal(reopenedHost.scripted.state.createCount, 0);
  assert.equal((await reopenedHost.call('list')).length, 1);
  assert.equal(calls, 1);
});

test('cancelled submission persists nothing; guard unload cannot reopen a live root', async t => {
  const { root, host, logs } = await fixture(t);
  let bodies = 0;
  const guard = await mountGuard(host, root);
  const chat = await conversation(host, logs, { setup: ctx => ctx.tools.register(definition('write', () => bodies++)) }); t.after(chat.close);
  const wish = '创建本地软件。', sourceSeq = chat.user(wish), controller = new AbortController(); controller.abort();
  assert.equal((await chat.raw('wish_willow_submit', { sourceSeq, wish }, controller.signal)).isError, true);
  assert.equal((await host.call('list')).length, 0); assert.equal(host.scripted.state.createCount, 0);
  await guard.dispose();
  assert.equal((await chat.raw('write')).isError, true, 'agent-owned guard remains closed after addon unload');
  assert.equal((await chat.raw('wish_willow_submit', { sourceSeq, wish })).isError, true);
  const decision = await host.ctx.waterfall(scopeTarget(chat.agent, chat.agent), 'agent/pre-step',
    { agent: chat.agent, messages: [], turn: 1, step: 1, signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [] }));
  assert.equal(decision.kind, 'reject'); assert.equal(bodies, 0);
  assert.equal((await host.call('list')).length, 0); assert.equal(host.scripted.state.createCount, 0);
});

test('acceptance root has a finite twelve-step lifecycle budget', async t => {
  const { root, host, logs } = await fixture(t);
  const guard = await mountGuard(host, root); t.after(() => guard.dispose());
  const chat = await conversation(host, logs); t.after(chat.close);
  let entered = 0;
  for (let step = 1; step <= 14; step++) {
    const result = await host.ctx.waterfall(scopeTarget(chat.agent, chat.agent), 'agent/pre-step',
      { agent: chat.agent, messages: [], turn: 1, step, signal: new AbortController().signal },
      async () => { entered++; return { kind: 'enter', messages: [] }; });
    assert.equal(result.kind, step <= 12 ? 'enter' : 'reject');
  }
  assert.equal(entered, 12); assert.equal(host.scripted.state.createCount, 0);
});

test('native project refusal leaves original project bytes unchanged and never attempts engineering', async t => {
  const { root, host, logs } = await fixture(t, { answerQuestion: async () => ({
    answers: [{ id: 'wish-willow-project', selected: ['暂不提交'] }],
  }) });
  const p = await host.call('create', { input: { requestId: randomUUID(), title: '已有项目', wish: '保持现有状态' } });
  const before = await readFile(join(root, 'wish_willow_p1.json'), 'utf8');
  const guard = await mountGuard(host, root); t.after(() => guard.dispose());
  const chat = await conversation(host, logs); t.after(chat.close);
  const wish = '增加本地搜索。', sourceSeq = chat.user(wish);
  const denied = await chat.raw('wish_willow_submit', { sourceSeq, wish, projectId: p.id, expectedRevision: p.revision });
  assert.equal(denied.isError, true); assert.match(denied.error.message, /没有取得明确项目选择/);
  assert.equal(await readFile(join(root, 'wish_willow_p1.json'), 'utf8'), before);
  assert.equal(host.scripted.state.createCount, 0);
});

test('invalid authorization, nonzero engineering budget and existing live roots prevent guard activation', async t => {
  const { root, host, logs } = await fixture(t);
  for (const supplied of [{ authorize: 'not-authorized' }, { conversationWorkspace: root }, { home: join(root, '..') }]) {
    await assert.rejects(mountGuard(host, root, supplied));
  }
  const chat = await conversation(host, logs); t.after(chat.close);
  await assert.rejects(mountGuard(host, root), /before any Agent/);
  const otherRoot = await temporary(t), other = await unifiedRuntime(otherRoot, { realAgentRegistry: true }); t.after(other.close);
  await assert.rejects(mountGuard(other, otherRoot), /maxSteps: 0/);
});

test('without the addon ordinary Creator tools and normal planning dispatch remain unchanged', async t => {
  const root = await temporary(t), logs = new Map(); let writes = 0, planning = 0;
  const host = await unifiedRuntime(root, { realAgentRegistry: true, nativeSessions: logs, turns: [async ({ tool }) => {
    planning++; await tool('wish_plan', { requirements: [], constraints: [], decisions: [{ text: '待用户决定', risk: 'major' }],
      tasks: [{ description: '保留正常规划路径', category: 'technical' }] });
  }] }); t.after(host.close);
  const chat = await conversation(host, logs, { setup: ctx => ctx.tools.register(definition('write', () => writes++)) }); t.after(chat.close);
  assert.equal((await chat.raw('write')).isError, false); assert.equal(writes, 1);
  assert.equal(host.ctx.wishWillowP1.orchestrator.config.maxSteps, 60);
  const wish = '请创建本地软件。', receipt = await chat.tool('wish_willow_submit', { sourceSeq: chat.user(wish), wish });
  const p = await settle(host, receipt.project.id);
  assert.equal(receipt.dispatch, 'requested'); assert.equal(planning, 1); assert.equal(p.status, 'blocked');
  assert.equal(p.runs[0].modelCalls, 1, 'scripted assistant counter only, no real model call');
});

test('existing isolated environment excludes model/cloud secrets, proxy overrides and Node injection without reading real credentials', () => {
  const home = join(process.cwd(), '.test-data', 'example-only-no-directory-created');
  const env = isolatedEnvironment(home, { PATH: 'launch-path', SYSTEMROOT: 'system', DEEPSEEK_API_KEY: 'dummy-key', AWS_SECRET_ACCESS_KEY: 'dummy',
    HTTP_PROXY: 'dummy-proxy', NODE_OPTIONS: '--dummy', NODE_PATH: 'dummy-path', DSH_HOME: 'private-dummy-home', USERPROFILE: 'private-dummy-profile' });
  for (const name of ['DEEPSEEK_API_KEY', 'AWS_SECRET_ACCESS_KEY', 'HTTP_PROXY', 'NODE_OPTIONS', 'NODE_PATH']) assert.equal(env[name], undefined);
  assert.equal(env.DSH_HOME, home); assert.equal(env.HOME, home); assert.equal(env.USERPROFILE, home);
  assert.equal(env.DSH_TELEMETRY_DISABLED, '1'); assert.equal(env.npm_config_ignore_scripts, 'true');
});
