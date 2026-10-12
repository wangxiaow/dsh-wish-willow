import { Context, Service } from '@deepseek-ai/cordis';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import * as P0 from '../../src/p0/host.js';
import * as P1 from '../../packages/p1/src/host.js';
import * as Unified from '../../src/host.js';
import { createScriptedAgent } from './p1-runtime.mjs';
import { assertTestRoot, assertNoLinks, controlledPath } from './isolation.mjs';

/** Real storage/services with scripted model/tools. This is not a real DSH sandbox test. */
export async function unifiedRuntime(root, { workspaceRoot, turns = [], reviewTurns = [], reviewTurn, modules = 'unified', maxSteps, commandRunner } = {}) {
  root = await assertTestRoot(root);
  const workspace = await controlledPath(root, path.resolve(root, workspaceRoot ?? 'workspace'), '.');
  const productsRoot = await controlledPath(root, path.join(root, 'products'), '.');
  for (const name of ['wish_willow.json', 'wish_willow_p1.json']) await assertNoLinks(path.join(root, name));
  if (!['unified', 'legacy'].includes(modules)) throw Error('Unknown fixture module selection');
  const ctx = new Context(), fibers = [];
  const scripted = createScriptedAgent({ root, workspace, turns, reviewTurns, reviewTurn, commandRunner });
  let closing;
  const close = () => closing ??= (async () => {
    await scripted.close();
    const failures = [];
    for (const fiber of [...fibers].reverse()) try { await fiber.dispose(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Fixture runtime teardown failed; directory retained');
  })();
  const mount = async (plugin, config = {}) => {
    const fiber = ctx.plugin(plugin, config);
    fibers.push(fiber); await fiber;
    if (fiber.state !== 2) throw Error(`Plugin inactive: ${fiber.name}`);
    return fiber;
  };
  try {
    await mount(Storage);
    await mount(Json, { root });
    await mount(Domain, { backend: 'json' });
    await mount(Typert);
    await mount(Gateway);
    await mkdir(workspace, { recursive: true });
    const stub = values => ({ name: `unified-test-stub-${Math.random().toString(16).slice(2)}`,
      apply(inner) {
        for (const [key, value] of Object.entries(values)) {
          class Stub extends Service { constructor(context) { super(context, key); Object.assign(this, value); } }
          new Stub(inner);
        }
      } });
    await mount(stub({ agentDefaultModel: { currentSelection: () => ({ provider: 'unified-test', model: 'unified-test-model' }) },
      agentPresets: { resolve: async () => ({ id: 'test-preset' }), mount: async () => ({ id: 'test-preset' }) },
      // Metadata only: scripted file tools/command fixtures do not prove OS enforcement.
      sandboxPolicy: { defaultMode: 'workspace-write', resolve: () => ({ mode: 'workspace-write', workspaceRoot: workspace }) },
      sessions: { flush: async () => true },
      sessionQuery: { readSession: async id => scripted.getSession(id) },
      agents: { create: options => scripted.create(options) } }));
    let mounted;
    if (modules === 'legacy') {
      await mount(P0);
      mounted = await mount(P1, { workspaceRoot: productsRoot, ...(maxSteps ? { maxSteps } : {}) });
    } else {
      mounted = await mount(Unified, { workspaceRoot: productsRoot, ...(maxSteps ? { maxSteps } : {}) });
    }
    return { ctx, mounted, fibers, scripted, workspace,
      call: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillowP1', method, args }),
      callP0: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillow', method, args }),
      unload: async fiber => { await fiber.dispose(); }, close };
  } catch (error) {
    try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Fixture startup and cleanup failed'); }
    throw error;
  }
}
