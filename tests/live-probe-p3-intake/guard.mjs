// P3 Task 03 ONLY. Not referenced by the production bundle patch or Host entry.
import path from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { z } from 'zod';
import { acceptanceParent, assertNoLinks, assertTestRoot, within } from '../helpers/isolation.mjs';

export const name = 'wish-willow-p3-intake-acceptance-guard';
export const inject = ['tools', 'agents', 'systemPrompt', 'wishWillowP1'];
export const Config = z.strictObject({
  authorize: z.literal('p3-task03-entry-only'),
  home: z.string().min(1),
  conversationWorkspace: z.string().min(1),
});
const names = ['wish_willow_context', 'wish_willow_submit'];
const deny = 'P3 intake acceptance: only the original Wish Willow context/submit tools are permitted; engineering, file access, shell, network, delegation and permission changes are disabled';
const worker = /^wish-(?:willow|review|replay)-/;

async function preflight(ctx, supplied) {
  const config = Config.parse(supplied);
  const { home, conversationWorkspace } = config;
  if (!path.isAbsolute(home) || !path.isAbsolute(conversationWorkspace) ||
    !within(home, conversationWorkspace) || !within(home, ctx.wishWillowP1.orchestrator.config.workspaceRoot)) {
    throw Error('Acceptance requires absolute conversation and product workspaces strictly inside its owned Home');
  }
  // Fixture roots are already exclusively claimed by the existing helper. Live Homes must be
  // new P3-owned repository children, never P1/P2 evidence or a private Home/Profile.
  if (path.basename(home).startsWith('wish-willow-test-')) await assertTestRoot(home);
  else {
    if (path.dirname(home) !== acceptanceParent || !/^wish-willow-p3-intake-[0-9a-f-]{36}$/i.test(path.basename(home)) ||
      path.resolve(process.env.DSH_HOME ?? '.') !== home || process.cwd() !== conversationWorkspace) {
      throw Error('Live acceptance requires its dedicated P3 Home, explicit DSH_HOME and isolated invocation cwd');
    }
    await assertNoLinks(home);
    const marker = path.join(home, '.wish-willow-test-owner');
    await assertNoLinks(marker);
    const stat = await lstat(marker);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 4096) throw Error('Invalid acceptance ownership marker');
    const record = JSON.parse(await readFile(marker, 'utf8'));
    if (record.format !== 1 || record.kind !== 'acceptance' || record.root !== home || !/^[0-9a-f-]{36}$/i.test(record.id)) {
      throw Error('Acceptance ownership marker does not match Home');
    }
  }
  await assertNoLinks(conversationWorkspace);
  await assertNoLinks(ctx.wishWillowP1.orchestrator.config.workspaceRoot);
  if (ctx.agents.list().length) throw Error('Acceptance guard must mount before any Agent exists');
  if (ctx.wishWillowP1.orchestrator.config.maxSteps !== 0) throw Error('Acceptance requires Wish Willow maxSteps: 0');
  if (ctx.wishWillowP1.list().some(p => !within(home, p.workspace))) throw Error('Acceptance contains a project outside its owned Home');
  return config;
}

export async function apply(ctx, supplied) {
  const config = await preflight(ctx, supplied);
  const originals = new Map(names.map(name => [name, ctx.tools.get(name)]));
  if ([...originals.values()].some(value => !value)) throw Error('Both original Wish Willow tools must already be registered');
  const enrolled = new WeakSet();
  let closed = false;
  const native = agent => agent && !worker.test(agent.id) && ctx.agents.get(agent.id) === agent &&
    ctx.agents.roots().includes(agent) && agent.session?.header?.cwd === config.conversationWorkspace &&
    agent.session.header.agentPreset === 'cordis';
  const reason = exec => {
    if (closed || !native(exec.agent) || !enrolled.has(exec.agent)) return deny;
    // Compare definitions, not just names: even a scoped same-name replacement is denied.
    if (!originals.has(exec.name) || ctx.tools.get(exec.name, exec.agent) !== originals.get(exec.name)) return deny;
    if (exec.arguments && typeof exec.arguments === 'object' && 'sandbox_permissions' in exec.arguments) return deny;
  };
  ctx.tools.guard(reason); // fail closed before enrollment; applies to global AND scoped direct dispatch
  ctx.on('agent/created', ({ agent, signal }) => {
    signal?.throwIfAborted();
    if (closed || !native(agent)) throw Error('P3 intake acceptance refuses engineering/delegated/non-Creator Agent publication');
    agent.ctx.tools.restrict({ allow: names });
    // These effects deliberately belong to the Agent, not this guard fiber: unloading the
    // guard cannot reopen a live test Agent's capabilities. The closed latch then denies all.
    agent.ctx.tools.guard(reason);
    let steps = 0;
    agent.ctx.on('agent/pre-step', async (_payload, next) => {
      if (closed || !native(agent) || ++steps > 12) return { kind: 'reject' };
      return next();
    });
    enrolled.add(agent);
  });
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const result = await next();
    if (!enrolled.has(context.scope)) return result;
    // restrict() does not hide a preset's OWN scoped registrations. Filter presentation too;
    // the monotonic guard remains authoritative even for tools still visible via schemas().
    return { ...result, tools: result.tools.filter(t => originals.has(t.name) &&
      ctx.tools.get(t.name, context.scope) === originals.get(t.name)) };
  });
  ctx.effect(() => () => { closed = true; });
}
