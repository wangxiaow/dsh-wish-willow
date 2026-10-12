import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import * as Wish from '../../src/p0/host.js';
import { join } from 'node:path';
import { assertTestRoot, assertNoLinks } from './isolation.mjs';

export async function runtime(root) {
  root = await assertTestRoot(root);
  await assertNoLinks(join(root, 'wish_willow.json'));
  const ctx = new Context();
  const fibers = [];
  async function mount(plugin, config = {}) {
    const fiber = ctx.plugin(plugin, config);
    fibers.push(fiber); await fiber;
    if (fiber.state !== 2) throw new Error(`Plugin did not activate: ${fiber.name}, state=${fiber.state}`);
    return fiber;
  }
  let closing;
  const close = () => closing ??= (async () => {
    const failures = [];
    for (const fiber of [...fibers].reverse()) try { await fiber.dispose(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Fixture runtime teardown failed; directory retained');
  })();
  try {
    await mount(Storage);
    await mount(Json, { root });
    await mount(Domain, { backend: 'json' });
    await mount(Typert);
    await mount(Gateway);
    const wish = await mount(Wish);
    return {
      ctx, wish, close,
      call: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillow', method, args }),
    };
  } catch (error) {
    try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Fixture startup and cleanup failed'); }
    throw error;
  }
}
