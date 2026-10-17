import { apply as applyP0, productDomain } from './p0/host.js';
import { apply as applyP1, evolutionDomain } from '../packages/p1/src/host.js';
import { applyNativeIntake } from './native-intake.js';

/**
 * Wish Willow — the single installable Bundle entry point.
 *
 * One loader row loads one Host plugin, which composes the internal modules:
 *   - `wish-willow-p0` module: Domain `wish_willow` v1 / `products` + Service `wishWillow`
 *     (legacy product state; unchanged schema, so existing P0 files stay byte-compatible).
 *   - `wish-willow-p1` module: Domain `wish_willow_p1` v1 / `projects` + Service `wishWillowP1`
 *     (authoritative product evolution state, orchestration and evidence gating).
 *   - `native-intake` adapter: DSH native Agent tools and prompt, no additional Domain.
 *
 * The modules keep their own files, services, storage domains and tests. Only the
 * installation unit and the user-facing entry are unified: users install `dsh-wish-willow`
 * once and see one Wish Willow workspace.
 */
export const name = 'wish-willow';

/** Services required by the internal modules and native conversation adapter. */
export const inject = ['storageDomain', 'typertGateway', 'agents', 'agentDefaultModel', 'agentPresets', 'sandboxPolicy', 'sessions', 'sessionQuery', 'tools', 'systemPrompt', 'userQuestions'];

/** Domain descriptors, re-exported so tooling and tests can assert the storage contract. */
export { productDomain, evolutionDomain };

export async function apply(ctx, config = {}) {
  // The legacy product-state module is opened first so the evolution module can
  // read it through `ctx.get('wishWillow')` for explicit, user-initiated imports.
  // Cordis owns the return value of `apply`, so nothing is returned here: both
  // modules register their Services and disposal effects on this plugin's fiber.
  await applyP0(ctx);
  await applyP1(ctx, config, service => applyNativeIntake(ctx, service));
}
