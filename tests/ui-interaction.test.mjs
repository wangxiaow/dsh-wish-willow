import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
let declaration;
new vm.Script(await readFile(new URL('../client.js', import.meta.url), 'utf8')).runInNewContext({
  window: { __ModuleLoader__: { load: row => { declaration = row; } } }, AbortController,
});
const client = declaration.factory(() => React);
const original = { id: 'fbdb1e1d-65cc-40e7-a06e-22d21d2d7fb1', title: 'Original', wish: 'Wish', status: 'draft', revision: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
const t = key => client.dictionaries.en[key] ?? key;
function button(view, text) { return view.root.findAllByType('button').find(node => node.children[0] === text); }

test('mounted React form creates, updates with CAS, preserves conflict draft, and explicitly reloads', async () => {
  const records = []; const calls = []; let conflict = false;
  const call = async (method, input) => {
    calls.push({ method, input });
    if (method === 'list') return [...records];
    if (conflict) throw Object.assign(new Error('stale'), { code: 'wish-willow/conflict' });
    const row = { ...original, ...input, revision: method === 'create' ? 1 : 2 };
    delete row.expectedRevision; records.splice(0, records.length, row); return row;
  };
  let view; await act(async () => { view = TestRenderer.create(React.createElement(client.ProductPanel, { t, call })); });
  await act(async () => { view.root.findByProps({ id: 'ww-title' }).props.onChange({ target: { value: 'Created' } }); });
  await act(async () => { await view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(calls.at(-1).method, 'create'); assert.equal(view.root.findByProps({ role: 'status' }).children[0], 'Durably saved');
  await act(async () => { view.root.findByProps({ id: 'ww-title' }).props.onChange({ target: { value: 'Updated' } }); });
  assert.equal(button(view, 'New product').props.disabled, true);
  await act(async () => { await view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(calls.at(-1).input.expectedRevision, 1);
  assert.equal(calls.at(-1).input.id, original.id);
  conflict = true;
  await act(async () => { view.root.findByProps({ id: 'ww-title' }).props.onChange({ target: { value: 'Preserve me' } }); });
  await act(async () => { await view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(view.root.findByProps({ id: 'ww-title' }).props.value, 'Preserve me');
  assert.match(view.root.findByProps({ role: 'alert' }).children[0], /draft is preserved/);
  await act(async () => { await button(view, 'Reload (discard unsaved edits)').props.onClick(); });
  assert.equal(view.root.findByProps({ id: 'ww-title' }).props.value, 'Updated');
  assert.equal(view.root.findAllByProps({ role: 'alert' }).length, 0);
  await act(async () => { view.unmount(); });
});

test('unmount aborts a pending DSH request and ignores late response', async () => {
  let signal; let resolve;
  const call = (_method, _input, received) => { signal = received; return new Promise(done => { resolve = done; }); };
  let view; await act(async () => { view = TestRenderer.create(React.createElement(client.ProductPanel, { t, call })); });
  assert.equal(signal.aborted, false);
  await act(async () => { view.unmount(); }); assert.equal(signal.aborted, true);
  await act(async () => { resolve([original]); });
});
