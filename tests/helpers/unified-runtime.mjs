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

/**
 * Real Cordis + Storage + JSON + Domain + Typert + Gateway over one storage root.
 * `modules: 'unified'` mounts the single installed Bundle row; `'legacy'` mounts the two
 * historical companion plugins instead, so upgrade paths can be exercised against real data.
 */
export async function unifiedRuntime(root, { workspaceRoot, turns = [], modules = 'unified', maxSteps } = {}) {
  const ctx = new Context();
  const fibers = [];
  const mount = async (plugin, config = {}) => {
    const fiber = ctx.plugin(plugin, config);
    fibers.push(fiber); await fiber;
    if (fiber.state !== 2) throw new Error(`Plugin inactive: ${fiber.name}`);
    return fiber;
  };
  await mount(Storage);
  await mount(Json, { root });
  await mount(Domain, { backend: 'json' });
  await mount(Typert);
  await mount(Gateway);
  const workspace = workspaceRoot ?? path.join(root, 'workspace');
  // Keep product workspaces and delivery snapshots inside the test root: a test run must
  // never write into the developer's real DSH home.
  const productsRoot = path.join(root, 'products');
  await mkdir(workspace, { recursive: true });
  const scripted = createScriptedAgent({ workspace, turns });
  const stub = values => ({ name: `unified-test-stub-${Math.random().toString(16).slice(2)}`,
    apply(inner) {
      for (const [key, value] of Object.entries(values)) {
        class Stub extends Service { constructor(context) { super(context, key); Object.assign(this, value); } }
        new Stub(inner);
      }
    } });
  await mount(stub({ agentDefaultModel: { currentSelection: () => ({ provider: 'unified-test', model: 'unified-test-model' }) },
    agentPresets: { resolve: async () => ({ id: 'test-preset' }), mount: async () => ({ id: 'test-preset' }) },
    sandboxPolicy: { defaultMode: 'workspace-write', resolve: () => ({ mode: 'workspace-write', workspaceRoot: workspace }) },
    sessions: { flush: async () => true },
    sessionQuery: { readSession: async () => ({ session: scripted.last.session, events: scripted.last.events }) },
    agents: { create: options => scripted.create(options) } }));
  let mounted;
  if (modules === 'legacy') {
    await mount(P0);
    mounted = await mount(P1, { workspaceRoot: productsRoot, ...(maxSteps ? { maxSteps } : {}) });
  } else {
    mounted = await mount(Unified, { workspaceRoot: productsRoot, ...(maxSteps ? { maxSteps } : {}) });
  }
  return {
    ctx, mounted, fibers, scripted, workspace,
    call: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillowP1', method, args }),
    callP0: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillow', method, args }),
    /** Unload one plugin fiber (disable), leaving the rest of the Host running. */
    unload: async fiber => { await fiber.dispose(); },
    close: async () => { for (const fiber of [...fibers].reverse()) { if (fiber.state === 2) await fiber.dispose(); } },
  };
}
