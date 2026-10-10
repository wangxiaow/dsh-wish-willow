import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createEvolutionStore, projectSchema } from '../packages/p1/src/state.js';

function fixture() {
  const records = new Map(); let chain = Promise.resolve(); let broken = false;
  const table = { entries: () => records.entries(), get: id => records.get(id),
    put: async (id, value) => { if (broken) throw Error('disk failure'); records.set(id, value); },
    update(id, fn) {
      const result = chain.then(() => { const next = fn(records.get(id)); if (broken) throw Error('disk failure'); records.set(id, next); return next; });
      chain = result.catch(() => {}); return result;
    },
  };
  return { table, store: createEvolutionStore(table, { uuid: randomUUID, now: () => new Date().toISOString(), workspaceFor: id => `C:\\controlled\\${id}`,
    failure: (code, message) => Object.assign(Error(message), { code }) }), breakDisk: () => { broken = true; } };
}
const fields = () => ({ requestId: randomUUID(), title: '产品', wish: '一个普通软件愿望' });

test('P1 persistent idempotent creation and change, snapshots, stable task association', async () => {
  const { store } = fixture(); const input = fields();
  const [a, b] = await Promise.all([store.create(input), store.create(input)]);
  assert.equal(a.id, b.id); assert.equal(store.list().length, 1);
  a.title = 'tamper'; assert.equal(store.read(a.id).title, input.title);
  const request = { projectId: b.id, expectedRevision: 1, requestId: randomUUID(), wish: '创建软件' };
  const p = await store.submit(request); const repeated = await store.submit(request);
  assert.deepEqual(p, repeated); assert.equal(p.changes.length, 1); assert.equal(p.tasks[0].projectId, p.id);
  assert.equal(p.requirements[0].confirmation, 'confirmed'); assert.equal(p.versions[0].status, 'Planned');
  await assert.rejects(store.submit({ ...request, wish: 'different' }), { code: 'idempotency-conflict' });
  await assert.rejects(store.create({ ...input, wish: 'different' }), { code: 'idempotency-conflict' });
});

test('P1 CAS and durable failure protect authoritative state', async () => {
  const { store, breakDisk } = fixture(); const p = await store.create(fields());
  const results = await Promise.allSettled(['A', 'B'].map(wish => store.submit({ projectId: p.id, expectedRevision: p.revision, requestId: randomUUID(), wish })));
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.find(x => x.status === 'rejected').reason.code, 'conflict');
  const before = store.read(p.id); breakDisk();
  await assert.rejects(store.mutate(p.id, 'fail', { kind: 'runtime', ref: 'test' }, next => { next.status = 'failed'; }), /disk failure/);
  assert.deepEqual(store.read(p.id), before);
});

test('P1 imports P0 without changing a byte or losing any legacy fields', async () => {
  const { store } = fixture();
  const old = { id: randomUUID(), schemaVersion: 1, revision: 3, title: 'P0 confirmed', wish: '保留旧愿望', status: 'confirmed',
    createdAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' };
  const bytes = JSON.stringify(old);
  const first = await store.importLegacy(old, randomUUID()); const second = await store.importLegacy(old, randomUUID());
  assert.equal(JSON.stringify(old), bytes); assert.equal(first.legacy.snapshot, bytes); assert.equal(first.id, old.id);
  assert.deepEqual(first, second); assert.equal(store.list().length, 1);
});

test('P1 restart marks incomplete work uncertain, never succeeds or automatically repeats', async () => {
  const { store } = fixture(); const p = await store.create(fields());
  await store.submit({ projectId: p.id, expectedRevision: 1, requestId: randomUUID(), wish: '创建' });
  await store.recover(); const recovered = store.read(p.id);
  assert.equal(recovered.status, 'uncertain'); assert.equal(recovered.tasks[0].status, 'uncertain');
  assert.equal(recovered.changes[0].status, 'uncertain'); assert.equal(recovered.releases.length, 0);
  const rev = recovered.revision; await store.recover(); assert.equal(store.read(p.id).revision, rev);
});

test('P1 confirmed facts protected; claims without build/test/run evidence cannot become delivery', async () => {
  const { store } = fixture(); const created = await store.create(fields());
  const p = await store.submit({ projectId: created.id, expectedRevision: 1, requestId: randomUUID(), wish: '用户确认的核心愿望' });
  await assert.rejects(store.mutate(p.id, 'overwrite', { kind: 'agent', ref: 'test' }, next => { next.requirements[0].text = 'lost'; }), { code: 'confirmed-fact' });
  const invalid = structuredClone(p); invalid.versions[0].status = 'Released';
  assert.equal(projectSchema.safeParse(invalid).success, false);
  const invalidTask = structuredClone(p); invalidTask.tasks.push({ ...invalidTask.tasks[0], id: randomUUID(), phase: 'code', status: 'completed' });
  assert.equal(projectSchema.safeParse(invalidTask).success, false);
});
