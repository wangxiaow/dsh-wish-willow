import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import * as Wish from '../../src/p0/host.js';

export async function runtime(root) {
  const ctx = new Context();
  const fibers = [];
  async function mount(plugin, config = {}) {
    const fiber = ctx.plugin(plugin, config);
    fibers.push(fiber); await fiber;
    if (fiber.state !== 2) throw new Error(`Plugin did not activate: ${fiber.name}, state=${fiber.state}`);
    return fiber;
  }
  async function close() {
    for (const fiber of [...fibers].reverse()) await fiber.dispose();
  }
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
  } catch (error) { await close(); throw error; }
}
