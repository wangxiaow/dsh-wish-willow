import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const code = await readFile(new URL('../client.js', import.meta.url), 'utf8');
let declaration;
// The browser provides these globals; the unified workspace uses them for live refresh.
new vm.Script(code).runInNewContext({
  window: { __ModuleLoader__: { load: row => { declaration = row; } } },
  AbortController, crypto: globalThis.crypto, setInterval, clearInterval, setTimeout, clearTimeout,
});
const client = declaration.factory(() => React);
const t = key => client.dictionaries.en[key] ?? key;
const uuid = () => globalThis.crypto.randomUUID();

/** In-memory stand-in for the two real services, keeping the same envelope and CAS semantics. */
function services({ legacy = [], conflictLegacy = false } = {}) {
  const projects = []; const calls = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const find = id => projects.find(row => row.id === id);
  const api = {
    async evolution(method, input, signal) {
      signal?.throwIfAborted();
      calls.push({ namespace: 'wishWillowP1', method, input });
      if (method === 'list') return clone(projects);
      if (method === 'legacy') return clone(legacy);
      if (method === 'read') { const row = find(input.projectId); if (!row) throw Object.assign(new Error('missing'), { code: 'wish-willow-p1/not-found' }); return clone(row); }
      if (method === 'create') {
        const row = { id: uuid(), schemaVersion: 1, revision: 1, title: input.title, goal: input.wish, currentWish: input.wish,
          workspace: 'G:\\ws', status: 'draft', creationRequestId: input.requestId, requirements: [], constraints: [], decisions: [],
          tasks: [], runs: [], changes: [], evidence: [], artifacts: [], builds: [], versions: [], releases: [], history: [] };
        projects.push(row); return clone(row);
      }
      if (method === 'importLegacy') {
        const source = legacy.find(row => row.id === input.productId);
        if (!source) throw Object.assign(new Error('missing'), { code: 'wish-willow-p1/not-found' });
        const existing = find(source.id);
        if (existing) return clone(existing);
        const row = { id: source.id, schemaVersion: 1, revision: 1, title: source.title, goal: source.wish, currentWish: source.wish,
          workspace: 'G:\\ws', status: 'draft', creationRequestId: input.requestId, legacy: { productId: source.id, revision: source.revision, snapshot: JSON.stringify(source) },
          requirements: [{ id: uuid(), text: source.wish, confirmation: 'confirmed', source: { kind: 'migration', ref: source.id } }],
          constraints: [], decisions: [], tasks: [], runs: [], changes: [], evidence: [], artifacts: [], builds: [], versions: [], releases: [], history: [] };
        projects.push(row); return clone(row);
      }
      const row = find(input.projectId);
      if (!row) throw Object.assign(new Error('missing'), { code: 'wish-willow-p1/not-found' });
      if (method === 'submit') { row.revision += 1; row.status = 'running'; row.currentWish = input.wish;
        row.changes.push({ id: uuid(), requestId: input.requestId, wish: input.wish, createdAt: '2026-10-10T00:00:00.000Z', status: 'running', versionId: uuid(), attempt: 1 });
        row.versions.push({ id: uuid(), changeId: uuid(), label: '0.1.0', status: 'Planned' }); }
      if (method === 'cancel') { row.status = 'failed'; }
      return clone(row);
    },
    async products(method, input, signal) {
      signal?.throwIfAborted();
      calls.push({ namespace: 'wishWillow', method, input });
      if (method === 'list') return clone(legacy);
      if (method === 'create') { const row = { id: uuid(), title: input.title, wish: input.wish, status: input.status, schemaVersion: 1, revision: 1, createdAt: '2026-10-10T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' }; legacy.push(row); return clone(row); }
      if (conflictLegacy) throw Object.assign(new Error('stale'), { code: 'wish-willow/conflict' });
      const row = legacy.find(item => item.id === input.id);
      Object.assign(row, { title: input.title, wish: input.wish, status: input.status, revision: row.revision + 1 });
      return clone(row);
    },
  };
  return { api, projects, legacy, calls };
}

const legacyRow = () => ({ id: 'fbdb1e1d-65cc-40e7-a06e-22d21d2d7fb1', title: '旧版产品', wish: '旧愿望', status: 'draft', schemaVersion: 1, revision: 3, createdAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-09T00:00:00.000Z' });

test('the unified workspace creates a product, submits a wish with CAS and keeps one entry point', async () => {
  const runtime = services({ legacy: [] });
  let view;
  await act(async () => { view = TestRenderer.create(React.createElement(client.Panel, { t, api: runtime.api })); });
  assert.equal(view.root.findByProps({ id: 'ww-workspace-empty' }).children[0], 'No products yet. Create one and write your wish.');
  await act(async () => { view.root.findByProps({ id: 'ww-title' }).props.onChange({ target: { value: '待办应用' } }); });
  await act(async () => { view.root.findByProps({ id: 'ww-new-wish' }).props.onChange({ target: { value: '我想做一个待办事项应用' } }); });
  await act(async () => { await view.root.findAllByType('form')[0].props.onSubmit({ preventDefault() {} }); });
  assert.equal(runtime.projects.length, 1);
  assert.equal(view.root.findByProps({ id: 'ww-product-title' }).children[0], '待办应用');
  assert.match(view.root.findByProps({ id: 'ww-notice' }).children[0], /Durably saved/);
  await act(async () => { view.root.findByProps({ id: 'ww-wish' }).props.onChange({ target: { value: '增加任务优先级' } }); });
  await act(async () => { await view.root.findByProps({ id: 'ww-submit' }).props.onClick(); });
  const submitted = runtime.calls.filter(call => call.method === 'submit').at(-1);
  assert.equal(submitted.input.wish, '增加任务优先级');
  assert.equal(submitted.input.expectedRevision, 1, 'the wish carries the revision the page read');
  assert.match(submitted.input.requestId, /^[0-9a-f-]{36}$/);
  assert.match(view.root.findByProps({ id: 'ww-notice' }).children[0], /Agent started/);
  assert.equal(view.root.findByProps({ id: 'ww-wish' }).props.value, '');
  await act(async () => { view.unmount(); });
});

test('the legacy P0 editor preserves the draft on conflict and reloads explicitly', async () => {
  const row = legacyRow();
  const runtime = services({ legacy: [row], conflictLegacy: true });
  let view;
  await act(async () => { view = TestRenderer.create(React.createElement(client.Panel, { t, api: runtime.api })); });
  await act(async () => { view.root.findByProps({ id: 'ww-legacy-product-0' }).props.onClick(); });
  assert.equal(view.root.findByProps({ id: 'ww-legacy-title' }).props.value, '旧版产品');
  await act(async () => { view.root.findByProps({ id: 'ww-legacy-title' }).props.onChange({ target: { value: 'Preserve me' } }); });
  await act(async () => { await view.root.findByProps({ id: 'ww-legacy-save' }).props.onClick(); });
  assert.equal(view.root.findByProps({ id: 'ww-legacy-title' }).props.value, 'Preserve me', 'the draft survives a stale write');
  assert.match(view.root.findByProps({ id: 'ww-error' }).children[0], /draft is preserved/);
  row.title = 'Server value';
  await act(async () => { await view.root.findByProps({ id: 'ww-legacy-reload' }).props.onClick(); });
  assert.equal(view.root.findByProps({ id: 'ww-legacy-title' }).props.value, 'Server value');
  assert.equal(view.root.findAllByProps({ id: 'ww-error' }).length, 0);
  await act(async () => { view.unmount(); });
});

test('the legacy area imports a P0 product by UUID and selects the unified product', async () => {
  const row = legacyRow();
  const runtime = services({ legacy: [row] });
  let view;
  await act(async () => { view = TestRenderer.create(React.createElement(client.Panel, { t, api: runtime.api })); });
  await act(async () => { view.root.findByProps({ id: 'ww-legacy-product-0' }).props.onClick(); });
  await act(async () => { await view.root.findByProps({ id: 'ww-legacy-import' }).props.onClick(); });
  const imported = runtime.calls.filter(call => call.method === 'importLegacy').at(-1);
  assert.equal(imported.input.productId, row.id, 'the P0 UUID is preserved as the unified product id');
  assert.equal(runtime.projects.length, 1);
  assert.equal(view.root.findByProps({ id: 'ww-product-title' }).children[0], '旧版产品');
  assert.match(view.root.findByProps({ id: 'ww-notice' }).children[0], /Imported/);
  await act(async () => { view.unmount(); });
});

test('unmounting the unified workspace aborts a pending DSH request and ignores the late response', async () => {
  let signal; let resolve;
  const api = {
    evolution: (_method, _input, received) => { signal = received; return new Promise(done => { resolve = done; }); },
    products: async () => [],
  };
  let view;
  await act(async () => { view = TestRenderer.create(React.createElement(client.Panel, { t, api })); });
  assert.equal(signal.aborted, false);
  await act(async () => { view.unmount(); });
  assert.equal(signal.aborted, true);
  await act(async () => { resolve([]); });
});
