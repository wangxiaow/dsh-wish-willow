import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductStore, productSchema } from '../src/model.js';
const id = 'fbdb1e1d-65cc-40e7-a06e-22d21d2d7fb1';
const fields = { title: '测试产品', wish: '一个简单应用', status: 'draft' };
function fixture() {
  const rows = new Map(); let failWrite = false; let chain = Promise.resolve();
  const table = {
    get: key => rows.get(key), entries: () => rows.entries(),
    async put(key, value) { if (failWrite) throw new Error('disk failure'); rows.set(key, value); },
    update(key, fn) {
      const result = chain.then(async () => {
        const next = fn(rows.get(key));
        if (failWrite) throw new Error('disk failure'); rows.set(key, next); return next;
      });
      chain = result.catch(() => {}); return result;
    },
  };
  return { store: createProductStore(table, {
    uuid: () => id, now: () => '2026-01-01T00:00:00.000Z',
    failure: (code, message, details) => Object.assign(new Error(message), { code, details }),
  }), fail: () => { failWrite = true; } };
}
test('creation, trim, independent ID, defensive snapshots and revision', async () => {
  const { store } = fixture();
  const row = await store.create({ ...fields, title: ' 产品 ' });
  assert.equal(row.title, '产品'); assert.equal(row.revision, 1);
  row.title = 'tamper'; store.list()[0].wish = 'tamper';
  assert.equal(store.list()[0].title, '产品'); assert.equal(store.list()[0].wish, fields.wish);
  const next = await store.update({ ...fields, id, expectedRevision: 1 });
  assert.equal(next.revision, 2); assert.equal(next.createdAt, row.createdAt);
});
test('reject invalid and unknown fields without persistence', async () => {
  const { store } = fixture();
  for (const input of [null, { ...fields, title: ' ' }, { ...fields, title: 'x'.repeat(121) },
    { ...fields, wish: 'x'.repeat(10001) }, { ...fields, status: 'running' }, { ...fields, sessionId: 'invented' }]) {
    await assert.rejects(store.create(input), { code: 'invalid-input' });
  }
  assert.deepEqual(store.list(), []);
  await assert.rejects(store.update({ ...fields, id: '../../evil', expectedRevision: 1 }), { code: 'invalid-input' });
  await assert.rejects(store.update({ ...fields, id, expectedRevision: 1 }), { code: 'not-found' });
});
test('concurrent CAS accepts exactly one write; stale write cannot overwrite', async () => {
  const { store } = fixture(); await store.create(fields);
  const results = await Promise.allSettled(['A', 'B'].map(title => store.update({ ...fields, title, id, expectedRevision: 1 })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'conflict');
  assert.equal(store.list()[0].revision, 2);
});
test('failed durable write preserves previous memory; ID collision never overwrites', async () => {
  const fixture1 = fixture(); await fixture1.store.create(fields);
  await assert.rejects(fixture1.store.create(fields), { code: 'id-collision' });
  fixture1.fail();
  await assert.rejects(fixture1.store.update({ ...fields, title: 'lost', id, expectedRevision: 1 }), /disk failure/);
  assert.equal(fixture1.store.list()[0].title, fields.title); assert.equal(fixture1.store.list()[0].revision, 1);
});
test('schema rejects corrupted records and unsupported state versions', () => {
  assert.throws(() => productSchema.parse({ ...fields, id, schemaVersion: 2, revision: 1, createdAt: 'bad', updatedAt: 'bad' }));
});
