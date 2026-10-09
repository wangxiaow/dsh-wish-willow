import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const code = await readFile(new URL('../client.js', import.meta.url), 'utf8');
function load() {
  let declaration;
  new vm.Script(code).runInNewContext({ window: { __ModuleLoader__: { load: row => { declaration = row; } } }, AbortController });
  return declaration.factory(name => { assert.equal(name, 'react'); return React; });
}
test('lazy client loads only React and registers additive root Slot and locale with disposal ownership', () => {
  const client = load(); const effects = []; const injections = []; const registrations = [];
  const ctx = {
    locale: { register: (ns, dict) => { assert.ok(dict.zh && dict.en); return () => {}; }, bind: () => key => key },
    connection: { rpc: {} }, effect: setup => { effects.push(setup()); },
    slots: { inject: (key, callback) => { injections.push(key); return callback(); },
      register: (options, component) => { registrations.push({ options, component }); return () => {}; } },
  };
  client.apply(ctx);
  assert.deepEqual(injections, ['settings.section']); assert.equal(registrations[0].options.id, 'wish-willow-p0');
  assert.equal(registrations[0].options.order, 30); assert.equal(typeof effects[0], 'function');
  assert.equal(registrations[0].component, client.ProductPanel);
  assert.deepEqual(Object.keys(client.dictionaries.en).sort(), Object.keys(client.dictionaries.zh).sort());
});
test('RPC adapter uses shared /api carrier, named args and errors without a Desktop-specific transport', async () => {
  const client = load(); const requests = [];
  const call = client.createApi({ rpc: { call: async (...params) => { requests.push(params); return { ok: true, value: [] }; } } });
  await call('list'); await call('create', { title: '测试' });
  assert.equal(requests[0][0], '/api'); assert.equal(requests[0][1], 'wishWillow/list');
  assert.equal(JSON.stringify(requests[0][2]), '{"args":{}}');
  assert.equal(JSON.stringify(requests[1][2]), '{"args":{"input":{"title":"测试"}}}');
  const failed = client.createApi({ rpc: { call: async () => ({ ok: false, error: { code: 'wish-willow/conflict', message: 'conflict' } }) } });
  await assert.rejects(failed('update', {}), { code: 'wish-willow/conflict' });
});
test('React SSR renders bilingual labelled controls, host tokens and no iframe or external DOM', () => {
  const client = load();
  for (const lang of ['zh', 'en']) {
    const html = renderToStaticMarkup(React.createElement(client.ProductPanel, { t: key => client.dictionaries[lang][key] ?? key, call: async () => [] }));
    assert.match(html, /id="ww-title"/); assert.match(html, /for="ww-wish"/);
    assert.match(html, /aria-busy="true"/); assert.match(html, /--dsw-alias-bg-layer-1/);
    assert.doesNotMatch(html, /<iframe|<script/);
  }
});
