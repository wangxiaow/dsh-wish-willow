import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
export async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'wish-willow-test-'));
  t.after(async () => {
    const target = resolve(dir);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('wish-willow-test-')) throw new Error('Unsafe test cleanup target');
    await rm(target, { recursive: true, force: true });
  });
  return dir;
}
