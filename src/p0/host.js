import { randomUUID } from 'node:crypto';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createProductStore, productSchema } from './model.js';

/**
 * Internal Wish Willow module: the accepted P0 product state.
 * Owns Domain `wish_willow` (version 1, table `products`) and the `wishWillow` Service.
 * The unified bundle mounts this module; it is no longer a user-facing install unit,
 * but it stays a valid standalone Cordis plugin so existing P0 tests and behavior are unchanged.
 */
export const name = 'wish-willow-p0';
export const inject = ['storageDomain', 'typertGateway'];
export const productDomain = defineDomain({
  name: 'wish_willow', version: 1, layout: 'single',
  tables: { products: domainTable(productSchema) },
});

const initializers = [];
export class WishWillowService extends TypertRemoteService {
  constructor(ctx, domain) {
    super(ctx, 'wishWillow');
    this.products = createProductStore(domain.table('products'), {
      uuid: randomUUID, now: () => new Date().toISOString(),
      failure: (reason, message, details) => new RemoteError(`wish-willow/${reason}`, message, details),
    });
    for (const initialize of initializers) initialize.call(this);
  }
  list() { return this.products.list(); }
  create(input, signal) {
    signal?.throwIfAborted();
    return this.products.create(input);
  }
  update(input, signal) {
    signal?.throwIfAborted();
    return this.products.update(input);
  }
}

// Standard Stage-3 method decorator invocation, without a compiler or private marker access.
// rc.2 Gateway's documented SRC path checks named JSON args; model.js validates business types.
for (const method of ['list', 'create', 'update']) {
  Remote(WishWillowService.prototype[method], {
    kind: 'method', name: method, static: false, private: false,
    addInitializer: initialize => initializers.push(initialize),
  });
}

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(productDomain);
  // The domain must also close if later Service setup fails.
  ctx.effect(() => () => domain.close(), 'wish-willow: product domain');
  new WishWillowService(ctx, domain);
}
