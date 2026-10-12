import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { unifiedRuntime } from './unified-runtime.mjs';
import { assertTestRoot, assertNoLinks } from './isolation.mjs';

// A second real Node process reopening the same storage root through the unified
// bundle: this is the restart half of the install/enable/disable/recover lifecycle.
const [stage, rootArg] = process.argv.slice(2);
if (!['seed', 'recover'].includes(stage)) throw Error('Expected seed or recover stage');
const root = await assertTestRoot(rootArg);
for (const name of ['unified-expected.json', 'unified-restart-proof.json']) await assertNoLinks(join(root, name));
const host = await unifiedRuntime(root);
try {
  if (stage === 'seed') {
    const legacy = await host.callP0('create', { input: { title: '跨进程旧产品', wish: '旧愿望', status: 'draft' } });
    const updated = await host.callP0('update', { input: { id: legacy.id, expectedRevision: 1, title: '跨进程旧产品', wish: '重启后仍存在', status: 'confirmed' } });
    const created = await host.call('create', { input: { requestId: '3f1a1c0e-0000-4000-8000-000000000301', title: '跨进程统一产品', wish: '统一愿望' } });
    await host.call('importLegacy', { input: { productId: legacy.id, requestId: '3f1a1c0e-0000-4000-8000-000000000302' } });
    await writeFile(join(root, 'unified-expected.json'), JSON.stringify({ legacy: updated, project: created }));
  } else {
    const expected = JSON.parse(await readFile(join(root, 'unified-expected.json'), 'utf8'));
    assert.deepEqual(await host.callP0('list'), [expected.legacy]);
    const rows = await host.call('list');
    assert.equal(rows.length, 2);
    assert.equal(rows.find(row => row.id === expected.project.id).title, expected.project.title);
    assert.equal(rows.find(row => row.id === expected.legacy.id).legacy.snapshot, JSON.stringify(expected.legacy));
    await writeFile(join(root, 'unified-restart-proof.json'), JSON.stringify({ stage, pid: process.pid, recovered: true,
      legacyRevision: expected.legacy.revision, projects: rows.length }));
  }
  console.log(`Unified process ${process.pid}: ${stage} PASS`);
} finally { await host.close(); }
