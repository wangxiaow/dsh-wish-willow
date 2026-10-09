import test from 'node:test';
import assert from 'node:assert/strict';
import { HostConnectionService } from '@deepseek-ai/dsh-client-connection';
import { runtime } from '../helpers/runtime.mjs';
import { temporary } from '../helpers/temp.mjs';

test('real DSH shared Fetch carrier dispatches Remote envelopes; trust fence is retained', async t => {
  const host = await runtime(await temporary(t)); t.after(host.close);
  let authenticated = false;
  // Fake authentication owner only in this isolated transport test; production never supplies one.
  const connectionFiber = host.ctx.plugin({ name: 'test-connection', apply(ctx) {
    new HostConnectionService(ctx, [], { isAuthenticated: () => authenticated });
  } });
  await connectionFiber; t.after(() => connectionFiber.dispose());
  const connection = host.ctx.connection;
  assert.equal(connection.requestRejection({ headers: { host: '127.0.0.1:19387' } }), 401);
  authenticated = true;
  assert.equal(connection.requestRejection({ headers: { host: '127.0.0.1:19387', origin: 'https://evil.example' } }), 403);
  assert.equal(connection.requestRejection({ headers: { host: '127.0.0.1:19387', origin: 'http://127.0.0.1:19387' } }), undefined);
  const handler = connection.createSharedFetchHandler('/api');
  async function send(method, args, rpcId = 'p0-test') {
    const response = await handler.fetch(new Request(`http://127.0.0.1:19387/api/wishWillow/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId, method: `wishWillow/${method}`, payload: { args } }),
    }));
    assert.equal(response.status, 200); const envelope = await response.json(); assert.equal(envelope.rpcId, rpcId); return envelope.result;
  }
  const created = await send('create', { input: { title: 'Carrier', wish: 'Shared transport', status: 'draft' } });
  assert.equal(created.ok, true);
  assert.deepEqual((await send('list', {})).value, [created.value]);
  const bad = await send('create', { input: { title: '' } });
  assert.equal(bad.ok, false); assert.equal(bad.error.code, 'wish-willow/invalid-input');
  await host.wish.dispose();
  const response = await handler.fetch(new Request('http://127.0.0.1:19387/api/wishWillow/list', { method: 'POST' }));
  assert.equal(response.status, 404);
});
