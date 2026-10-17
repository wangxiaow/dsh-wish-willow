import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Session } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { temporary } from '../helpers/temp.mjs';
import { unifiedRuntime } from '../helpers/unified-runtime.mjs';
import { settle } from '../helpers/p1-runtime.mjs';

function conversation(host, logs, id = randomUUID()) {
  const old = logs.get(id), session = old ? Session.create(id, old.events, old.header, old.inheritedEventCount ?? 0) : Session.create(id);
  const log = old ?? { header: session.header, events: [], inheritedEventCount: 0 }; logs.set(id, log);
  const agent = { id, session }; host.nativeAgents.set(id, agent);
  const raw = (name, args, signal = new AbortController().signal) => host.ctx.tools.execute({ name, arguments: args, agent, signal, callId: randomUUID() });
  return { agent, log, raw,
    user(text) {
      const event = session.append('user/message', createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }), { surfaceOp: 'append' });
      log.events.push(event); return event.seq;
    },
    async tool(name, args) { const result = await raw(name, args); if (result.isError) throw Error(result.error.message); return result.value; },
  };
}
const plan = async ({ tool }) => {
  const p = await tool('wish_state', {});
  assert.ok(p.currentWish);
  await tool('wish_plan', { requirements: [], constraints: [], decisions: [{ text: '重大方案待用户确认', risk: 'major' }],
    tasks: [{ description: '按正式愿望实施', category: 'technical' }] });
};
const context = chat => chat.tool('wish_willow_context', {});
const submit = (chat, input) => chat.tool('wish_willow_submit', input);

test('native Agent sees actual registered tools/prompt; first wish persists and enters the existing gated workflow', async t => {
  const root = await temporary(t), logs = new Map(), host = await unifiedRuntime(root, { turns: [plan], nativeSessions: logs }); t.after(host.close);
  const chat = conversation(host, logs);
  const assembled = await host.ctx.systemPrompt.assemble({ scope: chat.agent });
  assert.ok(assembled.tools.some(t => t.name === 'wish_willow_submit'));
  assert.ok(assembled.sections.some(s => s.name === 'wish-willow:native-intake' && /不要要求用户到插件设置页/.test(s.text)));
  chat.user('你好，先聊聊天。');
  assert.equal((await host.call('list')).length, 0, 'ordinary chat is not collected or auto-submitted');
  assert.equal((await context(chat)).project, null);
  assert.equal((await host.call('list')).length, 0, 'context is read-only');
  const wish = '请做一个本地待办工具，可以添加和完成任务。';
  chat.user(`今天心情不错。\n${wish}`);
  const read = await context(chat);
  const result = await submit(chat, { sourceSeq: read.sourceSeq, wish });
  assert.equal(result.persisted, true); assert.equal(result.dispatch, 'requested'); assert.equal(result.changeStatus, 'pending');
  assert.match(result.message, /不代表已开始、完成或交付/);
  const p = await settle(host, result.project.id);
  assert.equal(p.goal, wish); assert.equal(p.currentWish, wish); assert.equal(p.changes.length, 1);
  assert.equal(p.requirements[0].text, wish); assert.equal(p.changes[0].requestId, result.requestId);
  assert.equal(p.status, 'blocked'); assert.equal(p.decisions[0].status, 'proposed');
  assert.equal(p.runs.length, 1); assert.equal(host.scripted.state.modelCreateCount, 1); assert.equal(p.releases.length, 0);
  assert.equal(p.history.find(h => h.action === 'submit-native-wish').source.ref, `${chat.agent.id}#${read.sourceSeq}`);
  const bytes = await readFile(join(root, 'wish_willow_p1.json'), 'utf8');
  assert.ok(bytes.includes(wish)); assert.ok(!bytes.includes('今天心情不错')); assert.ok(!bytes.includes('你好，先聊聊天'));
});

test('replay/concurrent calls/reopened conversation preserve one request, one project, one execution and durable association', async t => {
  const root = await temporary(t), logs = new Map(), first = await unifiedRuntime(root, { turns: [plan], nativeSessions: logs }); t.after(first.close);
  const chat = conversation(first, logs), wish = '请创建一个本地日记软件。';
  const request = { sourceSeq: chat.user(wish), wish, newProjectTitle: '日记' };
  const results = await Promise.all([submit(chat, request), submit(chat, request)]);
  assert.equal(results[0].project.id, results[1].project.id); assert.equal(results[1].replayed, true);
  const p = await settle(first, results[0].project.id);
  assert.equal(p.changes.length, 1); assert.equal(p.versions.length, 1); assert.equal(first.scripted.state.modelCreateCount, 1);
  await first.close();
  const host = await unifiedRuntime(root, { nativeSessions: logs }); t.after(host.close);
  const reopened = conversation(host, logs, chat.agent.id);
  const read = await context(reopened);
  assert.equal(read.project.id, p.id); assert.equal(read.project.goal, wish); assert.equal(read.changes[0].wish, wish);
  const replay = await submit(reopened, request);
  assert.equal(replay.replayed, true); assert.equal(replay.dispatch, 'not-requested');
  assert.equal(host.scripted.state.createCount, 0); assert.deepEqual(await host.call('read', { input: { projectId: p.id } }), p);
  await assert.rejects(submit(reopened, { ...request, newProjectTitle: '错误重复项目' }), /idempotency-conflict/);
  assert.equal((await host.call('list')).length, 1);
});

test('later wish associates with the same project; blocked/rejected decisions cannot be bypassed by native submit', async t => {
  const root = await temporary(t), logs = new Map(), host = await unifiedRuntime(root, { turns: [plan], nativeSessions: logs }); t.after(host.close);
  const chat = conversation(host, logs), wish = '创建记录工具。';
  const first = await submit(chat, { sourceSeq: chat.user(wish), wish });
  let p = await settle(host, first.project.id);
  p = await host.call('decide', { input: { projectId: p.id, expectedRevision: p.revision, decisionId: p.decisions[0].id, accepted: false } });
  const nextWish = '给记录工具增加标签。', sourceSeq = chat.user(nextWish);
  await assert.rejects(submit(chat, { sourceSeq, wish: nextWish, expectedRevision: p.revision }), /Resolve current change/);
  await assert.rejects(submit(chat, { sourceSeq, wish: nextWish, newProjectTitle: '不能借新项目绕过拒绝' }), /No scripted human answerer/);
  assert.equal((await host.call('list')).length, 1);
  assert.equal(host.scripted.state.modelCreateCount, 1); assert.equal((await context(chat)).decisions[0].status, 'rejected');
  p = await host.call('reviseDecision', { input: { projectId: p.id, decisionId: p.decisions[0].id, expectedRevision: p.revision, requestId: randomUUID(), text: '修改为本地存储方案' } });
  assert.deepEqual(p.decisions.map(d => d.status), ['rejected', 'proposed']);
  p = await host.call('cancel', { input: { projectId: p.id, changeId: p.changes[0].id, expectedRevision: p.revision } });
  const next = await submit(chat, { sourceSeq, wish: nextWish, expectedRevision: p.revision });
  assert.equal(next.project.id, p.id); p = await settle(host, p.id);
  assert.equal(p.changes.length, 2); assert.equal(p.goal, wish); assert.equal(p.currentWish, nextWish);
  assert.equal(p.decisions[0].status, 'rejected'); assert.equal(p.changes[0].status, 'failed');
  assert.equal((await host.call('list')).length, 1);
});

test('ambiguous or unbound project requires native clarification; original wish need not be retyped', async t => {
  let humanSelection; const questions = [];
  const root = await temporary(t), logs = new Map(), host = await unifiedRuntime(root, { turns: [plan], nativeSessions: logs,
    answerQuestion: async request => {
      questions.push(request);
      const label = request.questions[0].options.find(o => humanSelection && o.label.includes(humanSelection))?.label;
      if (!label) throw Error('project-selection-required: no human selection');
      return { answers: [{ id: 'wish-willow-project', selected: [label] }] };
    } }); t.after(host.close);
  const a = await host.call('create', { input: { requestId: randomUUID(), title: '项目A', wish: 'A目标' } });
  const b = await host.call('create', { input: { requestId: randomUUID(), title: '项目B', wish: 'B目标' } });
  const chat = conversation(host, logs), wish = '给软件增加搜索功能。', sourceSeq = chat.user(wish);
  assert.equal((await context(chat)).selectionRequired, true);
  await assert.rejects(submit(chat, { sourceSeq, wish }), /project-selection-required/);
  assert.equal(host.scripted.state.createCount, 0);
  humanSelection = `[${b.id}]`; // Human answers the Host-owned native question, not a model-supplied claim.
  const selected = await chat.tool('wish_willow_context', { projectId: b.id });
  const result = await submit(chat, { sourceSeq, wish, projectId: b.id, expectedRevision: selected.project.revision });
  assert.equal(result.project.id, b.id); await settle(host, b.id);
  assert.deepEqual(await host.call('read', { input: { projectId: a.id } }), a);
  await assert.rejects(submit(chat, { sourceSeq, wish, projectId: a.id, expectedRevision: a.revision }), /idempotency-conflict/);
  assert.equal(questions.at(-1).agent, chat.agent); assert.equal(questions.at(-1).questions[0].detail, wish);
  humanSelection = '新建项目：';
  const thirdWish = '另外创建一个新的计时软件。';
  const third = await submit(chat, { sourceSeq: chat.user(thirdWish), wish: thirdWish, newProjectTitle: '计时' });
  await settle(host, third.project.id);
  assert.equal((await context(chat)).selectionRequired, true, 'two explicitly linked projects remain ambiguous, never pick last');
  assert.equal((await host.call('list')).length, 3);
});

test('model-supplied project ID/new title is not human authorization; native refusal leaves all projects untouched', async t => {
  const root = await temporary(t), logs = new Map(), questions = [];
  const host = await unifiedRuntime(root, { turns: [plan], nativeSessions: logs, answerQuestion: async request => {
    questions.push(request); return { answers: [{ id: 'wish-willow-project', selected: ['暂不提交'] }] };
  } }); t.after(host.close);
  const a = await host.call('create', { input: { requestId: randomUUID(), title: 'A', wish: 'A目标' } });
  const b = await host.call('create', { input: { requestId: randomUUID(), title: 'B', wish: 'B目标' } });
  const chat = conversation(host, logs), wish = '给软件增加搜索。', sourceSeq = chat.user(wish);
  await assert.rejects(submit(chat, { sourceSeq, wish, projectId: a.id, expectedRevision: a.revision }), /没有取得明确项目选择/);
  await assert.rejects(submit(chat, { sourceSeq, wish, newProjectTitle: '绕过原项目' }), /没有取得明确项目选择/);
  assert.equal(questions.length, 2); assert.ok(questions[0].questions[0].options[0].label.includes(a.id));
  assert.deepEqual(await host.call('read', { input: { projectId: a.id } }), a);
  assert.deepEqual(await host.call('read', { input: { projectId: b.id } }), b);
  assert.equal((await host.call('list')).length, 2); assert.equal(host.scripted.state.createCount, 0);
});

test('unbound caller without native answerer cannot force an existing project or a new one', async t => {
  const root = await temporary(t), logs = new Map(), host = await unifiedRuntime(root, { nativeSessions: logs }); t.after(host.close);
  const p = await host.call('create', { input: { requestId: randomUUID(), title: '已有项目', wish: '保留' } });
  const chat = conversation(host, logs), wish = '改进软件。', sourceSeq = chat.user(wish);
  for (const proposal of [{ projectId: p.id, expectedRevision: p.revision }, { newProjectTitle: '猜测新项目' }]) {
    await assert.rejects(submit(chat, { sourceSeq, wish, ...proposal }), /No scripted human answerer/);
  }
  assert.equal((await host.call('list')).length, 1); assert.equal(host.scripted.state.createCount, 0);
  assert.deepEqual(await host.call('read', { input: { projectId: p.id } }), p);
});

test('source validation rejects inferred, non-human, inherited, replaced and cross-session input without persistence', async t => {
  const root = await temporary(t), logs = new Map(), host = await unifiedRuntime(root, { nativeSessions: logs }); t.after(host.close);
  const chat = conversation(host, logs), wish = '请做本地工具。', sourceSeq = chat.user(wish);
  await assert.rejects(submit(chat, { sourceSeq, wish: 'Agent 自行推断的其他产品' }), /wish-source-mismatch/);
  await assert.rejects(submit(chat, { sourceSeq: sourceSeq + 100, wish }), /event unavailable/);
  const original = chat.log.events[0];
  chat.log.events[0] = { ...original, data: { ...original.data, source: { kind: 'tool', callId: 'untrusted' } } };
  await assert.rejects(submit(chat, { sourceSeq, wish }), /user-source-required/);
  chat.log.events[0] = original; chat.log.inheritedEventCount = sourceSeq + 1;
  await assert.rejects(submit(chat, { sourceSeq, wish }), /user-source-required/);
  chat.log.inheritedEventCount = 0; chat.log.events[0] = { ...original, fixtureSurface: 'replaced' };
  await assert.rejects(submit(chat, { sourceSeq, wish }), /stale-user-source/);
  chat.log.events[0] = original;
  const other = conversation(host, logs); other.user('其他会话没有这个软件愿望。');
  await assert.rejects(submit(other, { sourceSeq, wish }), /wish-source-mismatch/);
  const unknownField = await chat.raw('wish_willow_submit', { sourceSeq, wish, accepted: true });
  assert.equal(unknownField.isError, true, 'native entry cannot accept approval flags');
  assert.equal((await host.call('list')).length, 0); assert.equal(host.scripted.state.createCount, 0);
});

test('only the live native root may submit; read-only mode and cancelled calls cannot delegate writable execution', async t => {
  const root = await temporary(t), logs = new Map(), host = await unifiedRuntime(root, { nativeSessions: logs }); t.after(host.close);
  const chat = conversation(host, logs), wish = '创建本地软件。', sourceSeq = chat.user(wish);
  const noAgent = await host.ctx.tools.execute({ name: 'wish_willow_submit', arguments: { sourceSeq, wish }, signal: new AbortController().signal, callId: randomUUID() });
  assert.equal(noAgent.isError, true); assert.match(noAgent.error.message, /native-session-required/);
  chat.agent.fixtureOwned = true;
  await assert.rejects(submit(chat, { sourceSeq, wish }), /native-session-required/); delete chat.agent.fixtureOwned;
  const worker = conversation(host, logs, `wish-willow-${randomUUID()}`); worker.user(wish);
  await assert.rejects(submit(worker, { sourceSeq: 0, wish }), /native-session-required/);
  // The SDK assembly retains named empty sections; the worker must receive no native-intake guidance text.
  assert.equal((await host.ctx.systemPrompt.assemble({ scope: worker.agent })).sections.find(s => s.name === 'wish-willow:native-intake')?.text, '');
  const controller = new AbortController(); controller.abort();
  assert.equal((await chat.raw('wish_willow_submit', { sourceSeq, wish }, controller.signal)).isError, true);
  host.ctx.sandboxPolicy.resolve = () => ({ mode: 'read-only', workspaceRoot: host.workspace });
  await assert.rejects(submit(chat, { sourceSeq, wish }), /read-only/);
  assert.equal((await host.call('list')).length, 0); assert.equal(host.scripted.state.createCount, 0);
});

test('creation saved before submission failure is recoverable without duplicate initialization or false success', async t => {
  const root = await temporary(t), logs = new Map(), first = await unifiedRuntime(root, { nativeSessions: logs }); t.after(first.close);
  const chat = conversation(first, logs), wish = '创建本地小工具。', request = { sourceSeq: chat.user(wish), wish };
  first.ctx.wishWillowP1.store.submit = async () => { throw Error('fixture disk failure during submit'); };
  const failed = await chat.raw('wish_willow_submit', request);
  assert.equal(failed.isError, true); assert.match(failed.error.message, /未确认本次操作成功/); assert.match(failed.error.message, /disk failure/);
  const rows = await first.call('list'); assert.equal(rows.length, 1); assert.equal(rows[0].goal, wish);
  assert.equal(rows[0].changes.length, 0); assert.equal(rows[0].status, 'draft'); assert.equal(first.scripted.state.createCount, 0);
  await first.close();
  const host = await unifiedRuntime(root, { turns: [plan], nativeSessions: logs }); t.after(host.close);
  const reopened = conversation(host, logs, chat.agent.id);
  const retried = await submit(reopened, request); const p = await settle(host, retried.project.id);
  assert.equal(p.id, rows[0].id); assert.equal((await host.call('list')).length, 1); assert.equal(p.changes.length, 1);
  assert.equal(host.scripted.state.modelCreateCount, 1);
});

test('a durably saved but undispatched wish is reported truthfully and is not automatically replayed after reopen', async t => {
  const root = await temporary(t), logs = new Map(), first = await unifiedRuntime(root, { nativeSessions: logs }); t.after(first.close);
  const chat = conversation(first, logs), wish = '创建本地保存工具。', request = { sourceSeq: chat.user(wish), wish };
  first.ctx.wishWillowP1.orchestrator.closing = true;
  const saved = await submit(chat, request);
  assert.equal(saved.persisted, true); assert.equal(saved.dispatch, 'not-requested'); assert.match(saved.message, /未派发执行/);
  assert.equal(first.scripted.state.createCount, 0); await first.close();
  const host = await unifiedRuntime(root, { nativeSessions: logs }); t.after(host.close);
  const reopened = conversation(host, logs, chat.agent.id), read = await context(reopened);
  assert.equal(read.project.status, 'uncertain');
  const replay = await submit(reopened, request);
  assert.equal(replay.replayed, true); assert.equal(replay.dispatch, 'not-requested'); assert.equal(replay.changeStatus, 'uncertain');
  assert.equal(host.scripted.state.createCount, 0);
});

test('waiting for one native answer does not block another session; unload aborts waits and removes tools/prompts', { timeout: 3000 }, async t => {
  const root = await temporary(t), logs = new Map(); let waitingId, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const host = await unifiedRuntime(root, { nativeSessions: logs, answerQuestion: async request => {
    if (request.agent.id !== waitingId) return { answers: [{ id: 'wish-willow-project', selected: ['暂不提交'] }] };
    entered();
    return new Promise((resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(Error('native question aborted on unload')), { once: true });
    });
  } }); t.after(host.close);
  const p = await host.call('create', { input: { requestId: randomUUID(), title: '现有项目', wish: '保持不变' } });
  const chat = conversation(host, logs); waitingId = chat.agent.id;
  const pending = chat.raw('wish_willow_submit', { sourceSeq: chat.user('改进工具。'), wish: '改进工具。' });
  await started;
  const second = conversation(host, logs);
  const refused = await second.raw('wish_willow_submit', { sourceSeq: second.user('另一个愿望。'), wish: '另一个愿望。' });
  assert.equal(refused.isError, true); assert.match(refused.error.message, /没有取得明确项目选择/);
  const before = await readFile(join(root, 'wish_willow_p1.json'), 'utf8');
  await host.unload(host.mounted);
  assert.equal((await pending).isError, true);
  assert.equal(host.ctx.tools.get('wish_willow_submit'), undefined); assert.equal(host.ctx.tools.get('wish_willow_context'), undefined);
  const assembled = await host.ctx.systemPrompt.assemble({ scope: chat.agent });
  assert.equal(assembled.sections.some(s => s.name === 'wish-willow:native-intake'), false);
  assert.equal(await readFile(join(root, 'wish_willow_p1.json'), 'utf8'), before);
  assert.ok(before.includes(p.id)); assert.equal(host.scripted.state.createCount, 0);
});
