// Optional diagnostic Bundle, NOT selected by the production Bundle.
// Uses only Wish Willow's own public service; leaves one explicitly labelled test record.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';
export const inject = ['wishWillow'];
export async function apply(ctx, config) {
  assert.ok(isAbsolute(config.outputDir), 'Set an absolute workspace evidence directory');
  await mkdir(config.outputDir, { recursive: true });
  const expectedPath = join(config.outputDir, 'expected.json');
  let expected;
  try { expected = JSON.parse(await readFile(expectedPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!expected) {
    const row = await ctx.wishWillow.create({ title: '[P0 TEST] Wish Willow 加载验证',
      wish: '自动化测试数据，不代表用户需求。验证独立产品存储与重新加载恢复。', status: 'draft' });
    expected = await ctx.wishWillow.update({ id: row.id, expectedRevision: row.revision,
      title: row.title, wish: row.wish + ' 保存成功。', status: 'draft' });
    await writeFile(expectedPath, JSON.stringify(expected, null, 2));
    await writeFile(join(config.outputDir, 'created.json'), JSON.stringify({ phase: 'created', product: expected, pid: process.pid }, null, 2));
  } else {
    const restored = ctx.wishWillow.list().find(row => row.id === expected.id);
    assert.deepEqual(restored, expected);
    await writeFile(join(config.outputDir, 'reloaded.json'), JSON.stringify({ phase: 'reloaded', product: restored, pid: process.pid }, null, 2));
  }
}
