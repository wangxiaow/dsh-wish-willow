import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { runtime } from './runtime.mjs';
const [stage, root] = process.argv.slice(2);
const host = await runtime(root);
try {
  if (stage === 'seed') {
    const row = await host.call('create', { input: { title: '进程恢复测试', wish: '保存跨进程愿望', status: 'draft' } });
    const next = await host.call('update', { input: { title: '重启后仍存在', wish: row.wish, status: 'confirmed', id: row.id, expectedRevision: 1 } });
    await writeFile(join(root, 'expected.json'), JSON.stringify(next));
  } else {
    const expected = JSON.parse(await readFile(join(root, 'expected.json'), 'utf8'));
    assert.deepEqual(await host.call('list'), [expected]);
    await writeFile(join(root, 'restart-proof.json'), JSON.stringify({ stage, pid: process.pid, recovered: true, id: expected.id, revision: expected.revision }));
  }
  console.log(`Process ${process.pid}: ${stage} PASS`);
} finally { await host.close(); }
