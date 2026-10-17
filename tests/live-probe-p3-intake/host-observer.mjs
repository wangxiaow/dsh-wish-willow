// Task 03 deployment-only observer. Explicitly loaded only by the owned test overlay.
export const name = 'wish-willow-p3-no-model-observer';
export const inject = ['tools', 'agents', 'llm', 'wishWillowP1', 'agentPresets', 'sessionPersistence', 'sessions', 'systemPrompt', 'sandboxPolicy', 'loader'];
export let context;
export const counts = { agentRequests: 0, llmStreams: 0, disposed: false };
export function apply(ctx) {
  context = ctx;
  ctx.on('agent/request', () => { counts.agentRequests++; throw Error('P3 deployment prohibits all model requests'); });
  ctx.on('llm/stream', async function* () { counts.llmStreams++; throw Error('P3 deployment prohibits all LLM streams'); });
  ctx.effect(() => () => { counts.disposed = true; });
}
