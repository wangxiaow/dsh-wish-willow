import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

let declaration;
new vm.Script(await readFile(new URL('../client.js', import.meta.url), 'utf8')).runInNewContext({
  window: { __ModuleLoader__: { load: row => { declaration = row; } } },
  AbortController, crypto: globalThis.crypto, setInterval, clearInterval,
});
const client = declaration.factory(() => React), t = key => client.dictionaries.zh[key] ?? key;
const project = () => ({ id: 'product', title: '决策恢复', revision: 10, goal: '本地工具', currentWish: '本地工具', workspace: 'fixture', status: 'blocked',
  decisions: [{ id: 'old', text: '收费服务', risk: 'major', status: 'rejected', source: { kind: 'agent', ref: 'run' } }],
  changes: [{ id: 'change', status: 'blocked' }], runs: [{ id: 'run', changeId: 'change', sessionId: 'fixture-session', status: 'blocked' }],
  requirements: [], constraints: [], tasks: [], evidence: [], artifacts: [], builds: [], versions: [], releases: [], history: [] });

test('rejected UI exposes revision and cancellation, keeps pause clear, and requires fresh approval before continue', async () => {
  let p = project(), view; const calls = [];
  const props = () => ({ t, project: p, busy: false, act: (method, input) => calls.push({ method, input }),
    onReload: () => {}, acked: false, setAcked: () => {}, wish: '新愿望', setWish: () => {} });
  await act(async () => { view = TestRenderer.create(React.createElement(client.ProductWorkspace, props())); });
  assert.match(JSON.stringify(view.toJSON()), /计划已暂停并持久保存/);
  assert.equal(view.root.findByProps({ id: 'ww-retry' }).props.disabled, true);
  assert.equal(view.root.findByProps({ id: 'ww-submit' }).props.disabled, true);
  assert.equal(view.root.findAllByProps({ id: 'ww-accept' }).length, 0, 'rejected record cannot be accepted in place');
  assert.equal(view.root.findByProps({ id: 'ww-revise-old' }).props.disabled, true);
  await act(async () => { view.root.findByProps({ id: 'ww-revision-old' }).props.onChange({ target: { value: '本地文件，无费用' } }); });
  assert.equal(view.root.findByProps({ id: 'ww-revise-old' }).props.disabled, false);
  await act(async () => { view.root.findByProps({ id: 'ww-revise-old' }).props.onClick(); });
  await act(async () => { view.root.findByProps({ id: 'ww-revise-old' }).props.onClick(); });
  assert.equal(calls[0].method, 'reviseDecision'); assert.equal(calls[0].input.decisionId, 'old');
  assert.equal(calls[0].input.text, '本地文件，无费用'); assert.equal(calls[0].input.expectedRevision, 10);
  assert.equal(calls[0].input.requestId, calls[1].input.requestId);
  assert.equal(view.root.findByProps({ id: 'ww-revision-old' }).props.value, '本地文件，无费用', 'draft remains until durable response');
  await act(async () => { view.root.findByProps({ id: 'ww-cancel' }).props.onClick(); });
  assert.equal(calls[2].method, 'cancel'); assert.equal(calls[2].input.changeId, 'change'); assert.equal(calls[2].input.expectedRevision, 10);
  p = { ...p, revision: 11, decisions: [...p.decisions, { id: 'new', text: '本地文件，无费用', risk: 'major', status: 'proposed', source: { kind: 'user', ref: 'old' } }] };
  await act(async () => { view.update(React.createElement(client.ProductWorkspace, props())); });
  assert.equal(view.root.findByProps({ id: 'ww-retry' }).props.disabled, true);
  assert.equal(view.root.findAllByProps({ id: 'ww-revision-old' }).length, 0);
  await act(async () => { view.root.findByProps({ id: 'ww-accept' }).props.onClick(); });
  assert.equal(calls[3].method, 'decide'); assert.equal(calls[3].input.decisionId, 'new'); assert.equal(calls[3].input.accepted, true);
  p = { ...p, revision: 12, decisions: p.decisions.map(d => d.id === 'new' ? { ...d, status: 'accepted' } : d) };
  await act(async () => { view.update(React.createElement(client.ProductWorkspace, props())); });
  assert.equal(view.root.findByProps({ id: 'ww-retry' }).props.disabled, false);
  assert.deepEqual(view.root.findByProps({ id: 'ww-retry' }).children, ['继续已批准计划']);
  await act(async () => { view.root.findByProps({ id: 'ww-retry' }).props.onClick(); });
  assert.equal(calls[4].method, 'retry'); assert.equal(calls[4].input.changeId, 'change');
  assert.match(JSON.stringify(view.toJSON()), /已拒绝/);
  await act(async () => { view.unmount(); });
});

test('unsafe legacy state is reported explicitly and revision draft survives the refusal', async () => {
  const p = project(); let view;
  const api = { async evolution(method) {
    if (method === 'list') return [p];
    if (method === 'legacy') return [];
    if (method === 'read') return p;
    throw Object.assign(Error('Cannot safely resume'), { code: 'wish-willow-p1/unsafe-decision-state' });
  } };
  await act(async () => { view = TestRenderer.create(React.createElement(client.Panel, { t, api })); });
  await act(async () => { view.root.findByProps({ id: 'ww-revision-old' }).props.onChange({ target: { value: '保留本地方案草稿' } }); });
  await act(async () => { view.root.findByProps({ id: 'ww-revise-old' }).props.onClick(); });
  assert.match(JSON.stringify(view.toJSON()), /无法安全恢复/);
  assert.equal(view.root.findByProps({ id: 'ww-revision-old' }).props.value, '保留本地方案草稿');
  await act(async () => { view.unmount(); });
});

test('reopening rejected persisted UI still offers revision; historical decisions are not actionable in a new change', async () => {
  let p = project(), view;
  const render = () => React.createElement(client.ProductWorkspace, { t, project: p, busy: false, act: () => {},
    onReload: () => {}, acked: false, setAcked: () => {}, wish: '', setWish: () => {} });
  await act(async () => { view = TestRenderer.create(render()); });
  assert.equal(view.root.findByProps({ id: 'ww-revise-old' }).props.disabled, true);
  await act(async () => { view.unmount(); });
  p = { ...p, changes: [...p.changes, { id: 'next', status: 'failed' }], status: 'failed' };
  await act(async () => { view = TestRenderer.create(render()); });
  assert.equal(view.root.findAllByProps({ id: 'ww-revise-old' }).length, 0);
  assert.equal(view.root.findAllByProps({ id: 'ww-decision-history' }).length, 1);
  await act(async () => { view.unmount(); });
});
