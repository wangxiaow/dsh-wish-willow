import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const code = await readFile(new URL('../packages/p1/client.js', import.meta.url), 'utf8');
function load() {
  let declaration;
  new vm.Script(code).runInNewContext({ window: { __ModuleLoader__: { load: row => { declaration = row; } } }, AbortController });
  return declaration.factory(name => { assert.equal(name, 'react'); return React; });
}
const project = overrides => ({ id: '11111111-1111-4111-8111-111111111111', schemaVersion: 1, revision: 4, title: '待办事项应用', goal: '做一个待办事项应用。',
  currentWish: '增加优先级筛选。', createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:10:00.000Z',
  workspace: 'G:\\dsh\\Wish-Willow\\.research\\p1\\projects\\1111', status: 'running', creationRequestId: '22222222-2222-4222-8222-222222222222',
  requirements: [{ id: 'a1', text: '可以添加任务', confirmation: 'confirmed', source: { kind: 'user', ref: 'c1' } },
    { id: 'a2', text: '使用原生 HTML', confirmation: 'inferred', source: { kind: 'agent', ref: 'r1' } }],
  constraints: [{ id: 'b1', text: '仅本地运行', confirmation: 'inferred', source: { kind: 'agent', ref: 'r1' } }],
  decisions: [{ id: 'd1', text: '是否公网部署？', risk: 'major', status: 'proposed', source: { kind: 'agent', ref: 'r1' } }],
  tasks: [{ id: 't1', projectId: '11111111-1111-4111-8111-111111111111', changeId: 'c1', description: '实现最小待办功能', category: 'technical',
    phase: 'code', dependencies: ['t0'], status: 'completed', runId: 'r1', result: '源码已修改', evidenceIds: ['e1'] },
    { id: 't2', projectId: '11111111-1111-4111-8111-111111111111', changeId: 'c1', description: '执行验证', category: 'technical',
      phase: 'verify', dependencies: ['t1'], status: 'failed', runId: 'r1', result: '测试失败', evidenceIds: [] }],
  runs: [{ id: 'r1', changeId: 'c1', sessionId: 'wish-willow-session', status: 'failed', startedAt: '2026-10-10T00:00:00.000Z', endedAt: '2026-10-10T00:05:00.000Z',
    modelCalls: 3, toolCalls: 12, failures: 1, provider: 'p', model: 'm', inputTokens: 100, outputTokens: 20, durationMs: 300000, reason: '测试失败' }],
  changes: [{ id: 'c1', requestId: '33333333-3333-4333-8333-333333333333', wish: '增加优先级筛选。', createdAt: '2026-10-10T00:00:00.000Z',
    status: 'failed', versionId: 'v1', attempt: 1, result: '开发未交付' }],
  evidence: [{ id: 'e1', changeId: 'c1', runId: 'r1', kind: 'test', sessionId: 's', callId: 'call-1', tool: 'pwsh', exitCode: 0, success: true, summary: 'ok', recordedAt: '2026-10-10T00:01:00.000Z' }],
  artifacts: [], builds: [], versions: [{ id: 'v1', changeId: 'c1', label: '0.1.0', status: 'Planned' }], releases: [],
  history: [{ id: 'h1', at: '2026-10-10T00:00:00.000Z', action: 'create-product', source: { kind: 'user', ref: 'x' }, revision: 1 }], ...overrides });

test('P1 lazy client registers an additive root Slot with locale and disposal ownership', () => {
  const client = load(); const effects = []; const injections = []; const registrations = [];
  const ctx = {
    locale: { register: (ns, dict) => { assert.ok(dict.zh && dict.en); return () => {}; }, bind: () => key => key },
    connection: { rpc: {} }, effect: setup => { effects.push(setup()); },
    slots: { inject: (key, callback) => { injections.push(key); return callback(); },
      register: (options, component) => { registrations.push({ options, component }); return () => {}; } },
  };
  client.apply(ctx);
  assert.deepEqual(injections, ['settings.section']);
  assert.equal(registrations[0].options.id, 'wish-willow-p1');
  assert.equal(registrations[0].options.order, 31);
  assert.equal(registrations[0].options.locale, 'wishWillow.p1');
  assert.equal(typeof effects[0], 'function');
  assert.equal(registrations[0].component, client.Panel);
  assert.deepEqual(Object.keys(client.dictionaries.en).sort(), Object.keys(client.dictionaries.zh).sort());
  assert.ok(client.dictionaries.zh.suggestion && client.dictionaries.en.suggestion);
});

test('P1 RPC adapter uses the shared /api carrier with named args and propagated errors', async () => {
  const client = load(); const requests = [];
  const call = client.createApi({ rpc: { call: async (...params) => { requests.push(params); return { ok: true, value: [] }; } } });
  await call('list'); await call('legacy'); await call('submit', { projectId: 'p' });
  assert.equal(requests[0][0], '/api'); assert.equal(requests[0][1], 'wishWillowP1/list');
  assert.equal(JSON.stringify(requests[0][2]), '{"args":{}}');
  assert.equal(requests[1][1], 'wishWillowP1/legacy');
  assert.equal(JSON.stringify(requests[2][2]), '{"args":{"input":{"projectId":"p"}}}');
  const failed = client.createApi({ rpc: { call: async () => ({ ok: false, error: { code: 'wish-willow-p1/conflict', message: 'conflict' } }) } });
  await assert.rejects(failed('submit', {}), { code: 'wish-willow-p1/conflict' });
});

test('P1 board renders real task, evidence, decision and delivery state without fabricated numbers', () => {
  const client = load();
  for (const lang of ['zh', 'en']) {
    const html = renderToStaticMarkup(React.createElement(client.Panel, { t: key => client.dictionaries[lang][key] ?? key, call: async () => [] }));
    assert.match(html, /id="ww-p1-title"/); assert.match(html, /id="ww-p1-new-wish"/);
    assert.match(html, /aria-busy="true"/); assert.match(html, /--dsw-alias-bg-layer-1/);
    assert.doesNotMatch(html, /<iframe|<script/);
  }
});

test('P1 board reports execution, failure, decision and delivery evidence from persisted state', () => {
  const client = load();
  const t = key => client.dictionaries.zh[key] ?? key;
  const board = doc => renderToStaticMarkup(React.createElement(client.Board, { t, call: async () => null, act: () => {}, busy: false, onReload: () => {}, project: doc }));
  const running = board(project());
  assert.match(running, /待办事项应用/);
  assert.match(running, /可以添加任务/);
  assert.match(running, /使用原生 HTML/);
  assert.match(running, /仅本地运行/);
  assert.match(running, /是否公网部署？/);
  assert.match(running, /t1/);
  assert.match(running, /测试失败/);
  assert.match(running, /exit=0/);
  assert.match(running, /失败/);
  assert.match(running, /重试本次变更/);
  assert.match(running, /接受/);
  const delivered = board(project({ status: 'delivered',
    releases: [{ id: 'x1', versionId: 'v1', buildId: 'b1', changeId: 'c1', releasedAt: '2026-10-10T01:00:00.000Z',
      sourcePath: 'G:\\ws', snapshotPath: 'G:\\snap\\v1', startCommand: 'node app.js', summary: '已交付', evidenceIds: ['e1'] }],
    builds: [{ id: 'b1', changeId: 'c1', versionId: 'v1', status: 'passed', evidenceIds: ['e1'], artifactIds: [], createdAt: '2026-10-10T00:30:00.000Z' }],
    versions: [{ id: 'v1', changeId: 'c1', label: '0.1.0', status: 'Released', buildId: 'b1', releaseId: 'x1' }],
    changes: [{ id: 'c1', requestId: 'r', wish: 'w', createdAt: '2026-10-10T00:00:00.000Z', status: 'completed', versionId: 'v1', attempt: 1, result: '已交付' }] }));
  assert.match(delivered, /node app\.js/);
  assert.match(delivered, /0\.1\.0/);
  assert.match(delivered, /正式交付/);
  assert.match(delivered, /G:\\snap\\v1/);
  assert.doesNotMatch(delivered, /重试本次变更/);
  const uncertain = board(project({ status: 'uncertain', tasks: [{ ...project().tasks[0], status: 'uncertain', evidenceIds: [] }],
    changes: [{ id: 'c1', requestId: 'r', wish: 'w', createdAt: '2026-10-10T00:00:00.000Z', status: 'uncertain', versionId: 'v1', attempt: 1 }] }));
  assert.match(uncertain, /状态待确认/);
  assert.match(uncertain, /Host 在执行中中断/);
  assert.match(uncertain, /我已检查工作目录并确认可以重试/);
  assert.match(uncertain, /disabled=""/);
});
