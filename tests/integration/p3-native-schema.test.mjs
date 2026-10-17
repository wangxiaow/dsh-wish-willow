import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import { Session, canonicalHeader } from '@deepseek-ai/dsh-session';
import { createScope } from '@deepseek-ai/dsh-scope';
import { snapshotJsonValue } from '@deepseek-ai/dsh-util-values';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { z } from 'zod';
import { temporary } from '../helpers/temp.mjs';
import { unifiedRuntime } from '../helpers/unified-runtime.mjs';
import { settle } from '../helpers/p1-runtime.mjs';
import * as Guard from '../live-probe-p3-intake/guard.mjs';

const names = ['wish_willow_context', 'wish_willow_submit'];
const config = { provider: 'schema-test-no-adapter', model: 'not-a-real-model' };
const toolDefinition = parameters => ({ name: 'schema_probe', description: 'Local schema reproduction only', parameters,
  output: { schema: { type: 'object', additionalProperties: true }, render: () => [] }, execute: async () => ({ called: true }) });

async function native(t, guarded = false) {
  const root = await temporary(t), logs = new Map();
  const host = await unifiedRuntime(root, { maxSteps: 0, realAgentRegistry: true, nativeSessions: logs }); t.after(host.close);
  let guard;
  if (guarded) {
    guard = host.ctx.plugin(Guard, { authorize: 'p3-task03-entry-only', home: root, conversationWorkspace: host.workspace });
    await guard; assert.equal(guard.state, 2); t.after(() => guard.dispose());
  }
  const id = randomUUID(), base = Session.create(id);
  const session = Session.create(id, undefined, { ...base.header, cwd: host.workspace, agentPreset: 'cordis' });
  const log = { header: session.header, events: [], inheritedEventCount: 0 }; logs.set(id, log);
  const agent = { id, session }, scope = createScope(host.agentScopeContext, agent); agent.ctx = scope.ctx;
  t.after(() => scope.dispose());
  const detach = host.ctx.agents.enter(agent); t.after(detach);
  await host.ctx.agents.announce(agent, 'startup');
  const raw = (name, args) => host.ctx.tools.execute({ name, arguments: args, agent, signal: new AbortController().signal, callId: randomUUID() });
  return { root, host, agent, raw, user(text) {
    const event = session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }), { surfaceOp: 'append' });
    log.events.push(event); return event.seq;
  } };
}

function assertInputContract(rows) {
  assert.deepEqual(rows.map(t => t.name).sort(), names);
  for (const row of rows) {
    assert.equal(Object.hasOwn(row.parameters, '~standard'), false);
    assert.deepEqual(snapshotJsonValue(row), row, `${row.name}: fully lossless JSON`);
    assert.equal(row.parameters.type, 'object'); assert.equal(row.parameters.additionalProperties, false);
    assert.equal(row.parameters.$schema, 'https://json-schema.org/draft/2020-12/schema');
    const id = row.parameters.properties.projectId;
    assert.equal(id.type, 'string'); assert.equal(id.format, 'uuid');
    assert.ok(new RegExp(id.pattern).test(randomUUID())); assert.ok(!new RegExp(id.pattern).test('not-a-uuid'));
  }
  const context = rows.find(t => t.name === names[0]).parameters;
  assert.deepEqual(Object.keys(context.properties), ['projectId']); assert.equal(context.required, undefined);
  const submit = rows.find(t => t.name === names[1]).parameters;
  assert.deepEqual(submit.required, ['sourceSeq', 'wish']);
  assert.deepEqual(Object.keys(submit.properties), ['sourceSeq', 'wish', 'projectId', 'expectedRevision', 'newProjectTitle']);
  assert.equal(submit.properties.sourceSeq.type, 'integer'); assert.equal(submit.properties.sourceSeq.minimum, 0);
  assert.equal(submit.properties.wish.minLength, 1); assert.equal(submit.properties.wish.maxLength, 10000);
  assert.equal(submit.properties.expectedRevision.type, 'integer'); assert.equal(submit.properties.expectedRevision.exclusiveMinimum, 0);
  assert.equal(submit.properties.newProjectTitle.minLength, 1); assert.equal(submit.properties.newProjectTitle.maxLength, 120);
  for (const name of Object.keys(submit.properties)) assert.ok(submit.properties[name].description);
}

test('minimal raw Zod export fails strict directory projection but native assembly/header/direct dispatch succeed, without guard/model/Host', async t => {
  const ctx = new Context(), prompt = ctx.plugin(SystemPrompt); await prompt;
  const tools = ctx.plugin(Tools); await tools;
  t.after(async () => { await tools.dispose(); await prompt.dispose(); });
  const raw = z.toJSONSchema(z.strictObject({ projectId: z.uuid().optional() }));
  const descriptor = Object.getOwnPropertyDescriptor(raw, '~standard');
  assert.equal(descriptor.enumerable, false); assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false);
  assert.equal(typeof descriptor.value.validate, 'function');
  assert.equal(typeof descriptor.value.jsonSchema.input, 'function');
  assert.equal(snapshotJsonValue(raw), undefined);
  const unregister = ctx.tools.register(toolDefinition(raw)); t.after(unregister);
  assert.ok(ctx.tools.get('schema_probe'), 'register/get succeed with the offending raw export');
  assert.throws(() => ctx.tools.schemas(), error => {
    assert.match(error.message, /schema_probe.*parameters must be lossless JSON/);
    assert.match(error.stack, /schemaOf/); t.diagnostic(error.message); return true;
  });
  const assembly = await ctx.systemPrompt.assemble(); assert.equal(assembly.tools.length, 1);
  assert.equal(Object.hasOwn(raw, '~standard'), true, 'original declaration still contains the protocol');
  assert.equal(Object.hasOwn(assembly.tools[0].parameters, '~standard'), false, 'official assemble uses structuredClone, excluding non-enumerable protocol data');
  assert.deepEqual(snapshotJsonValue(assembly.tools), assembly.tools);
  const session = Session.create(randomUUID());
  const event = session.append('request/header', { header: canonicalHeader({ config, tools: assembly.tools }), reason: 'initial' });
  assert.equal(event.type, 'request/header'); t.diagnostic('official native assembly -> Session request/header: accepted, without model dispatch');
  const unassembled = Session.create(randomUUID());
  assert.throws(() => unassembled.append('request/header', { header: canonicalHeader({ config, tools: [{ name: 'schema_probe', description: 'Local schema reproduction only', parameters: raw }] }), reason: 'initial' }), /non-JSON-serializable data/);
  assert.equal(unassembled.seq, 0, 'raw declarations are NOT the official assembled model header');
  const direct = await ctx.tools.execute({ name: 'schema_probe', arguments: {}, callId: randomUUID(), signal: new AbortController().signal });
  assert.equal(direct.isError, false, 'direct dispatch alone does not reveal the model-header failure');
});

test('both actual native declarations project through official global and scoped schemas with every constraint preserved', async t => {
  const { host, agent } = await native(t);
  const globalRows = host.ctx.tools.schemas(), scopedRows = host.ctx.tools.schemas(agent);
  assertInputContract(globalRows); assertInputContract(scopedRows);
  assert.deepEqual(globalRows, scopedRows);
  for (const row of globalRows) {
    const original = host.ctx.tools.get(row.name).parameters;
    assert.deepEqual(row.parameters, original); assert.notEqual(row.parameters, original, 'official projection is detached');
  }
  globalRows[0].parameters.properties.projectId.format = 'changed-test-copy';
  assert.equal(host.ctx.tools.get(names[0]).parameters.properties.projectId.format, 'uuid');
});

test('Creator with the unchanged acceptance guard assembles both schemas and accepts a real Session request header', async t => {
  const { host, agent } = await native(t, true);
  assertInputContract(host.ctx.tools.schemas(agent));
  const assembled = await host.ctx.systemPrompt.assemble({ scope: agent }); assertInputContract(assembled.tools);
  const header = canonicalHeader({ config, tools: assembled.tools });
  assert.deepEqual(snapshotJsonValue(header), header);
  // Exercise the same public Session boundary AgentLoop.buildRequest uses BEFORE provider dispatch.
  // This is an in-memory local header test, not a model turn or real Host persistence claim.
  const event = agent.session.append('request/header', { header, reason: 'initial' });
  assert.equal(event.type, 'request/header'); assert.deepEqual(agent.session.requestHeader().tools, assembled.tools);
  assert.equal(host.scripted.state.createCount, 0);
});

test('context and submit validation remain strict; malformed input does not persist or dispatch', async t => {
  const { host, raw, user } = await native(t, true);
  const wish = '请创建本地待办软件。', sourceSeq = user(wish);
  const validContext = await raw(names[0], {}); assert.equal(validContext.isError, false); assert.equal(validContext.value.sourceSeq, sourceSeq);
  for (const args of [{ projectId: 'invalid' }, { projectId: 123 }, { accepted: true }]) assert.equal((await raw(names[0], args)).isError, true);
  const valid = { sourceSeq, wish };
  for (const args of [{ wish }, { sourceSeq }, { ...valid, sourceSeq: -1 }, { ...valid, sourceSeq: 0.5 },
    { ...valid, wish: '' }, { ...valid, wish: 'x'.repeat(10001) }, { ...valid, projectId: 'invalid' },
    { ...valid, expectedRevision: 0 }, { ...valid, newProjectTitle: 'x'.repeat(121) }, { ...valid, accepted: true },
    { ...valid, projectId: randomUUID(), newProjectTitle: 'both targets' }]) {
    assert.equal((await raw(names[1], args)).isError, true);
  }
  assert.equal((await host.call('list')).length, 0); assert.equal(host.scripted.state.createCount, 0);
});

test('projected schema can accompany real native dispatch; provenance and replay survive with no execution capability', async t => {
  const { root, host, agent, raw, user } = await native(t, true);
  const rows = host.ctx.tools.schemas(agent), wish = '请创建一个本地记事工具。', sourceSeq = user(wish);
  const receipt = await host.ctx.tools.execute({ name: names[1], schema: rows.find(t => t.name === names[1]), arguments: { sourceSeq, wish },
    agent, signal: new AbortController().signal, callId: randomUUID() });
  assert.equal(receipt.isError, false); assert.equal(receipt.value.persisted, true);
  const p = await settle(host, receipt.value.project.id);
  assert.equal(p.changes.length, 1); assert.equal(p.builds.length, 0); assert.equal(p.releases.length, 0);
  assert.equal(p.history.find(h => h.action === 'submit-native-wish').source.ref, `${agent.id}#${sourceSeq}`);
  assert.ok((await readFile(join(root, 'wish_willow_p1.json'), 'utf8')).includes(wish));
  const context = await raw(names[0], { projectId: p.id }); assert.equal(context.isError, false); assert.equal(context.value.project.id, p.id);
  const creates = host.scripted.state.createCount;
  const replay = await raw(names[1], { sourceSeq, wish }); assert.equal(replay.isError, false);
  assert.equal(replay.value.replayed, true); assert.equal(replay.value.dispatch, 'not-requested'); assert.equal(host.scripted.state.createCount, creates);
  assert.ok(p.runs.every(r => r.modelCalls === 0 && r.toolCalls === 0));
});

test('strict runtime still rejects other non-JSON declarations; late scoped write and same-name replacements stay denied', async t => {
  const { host, agent, raw } = await native(t, true);
  const broken = { type: 'object' }; Object.defineProperty(broken, 'unrelated-hidden-data', { value: () => 'not JSON' });
  const remove = host.ctx.tools.register({ ...toolDefinition(broken), name: 'unrelated_schema_probe' }); t.after(remove);
  assert.throws(() => host.ctx.tools.schemas(), /unrelated_schema_probe.*parameters must be lossless JSON/);
  assertInputContract(host.ctx.tools.schemas(agent)); // hidden unrelated global cannot poison the permitted root surface
  let forbiddenBodies = 0;
  const trap = name => agent.ctx.tools.register({ ...toolDefinition({ type: 'object' }), name, execute: async () => { forbiddenBodies++; return {}; } });
  trap('write'); trap(names[1]);
  for (const name of ['write', names[1]]) {
    const denied = await raw(name, {}); assert.equal(denied.isError, true); assert.match(denied.error.message, /P3 intake acceptance/);
  }
  assert.equal(forbiddenBodies, 0); assert.equal(host.scripted.state.createCount, 0);
});
