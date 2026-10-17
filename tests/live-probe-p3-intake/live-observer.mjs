// One P3 Task03 user-operated acceptance only. No model simulation or credential values.
import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isAgentLoopRequest } from '@deepseek-ai/dsh-llm';
import { readPluginInventory } from '@deepseek-ai/dsh-host-plugin-inventory';
export const name = 'wish-willow-p3-live-observer';
export const inject = ['agents', 'llm', 'settings', 'credentials', 'wishWillowP1', 'sessions', 'loader'];
export const Config = z.strictObject({ evidence: z.string(), conversation: z.string(), startedAt: z.number() });
export let context;
export const wish = '我想做一个简单的本地家庭记账网页，可以记录每天的收入和支出。';
export const state = { ready: false, sessionId: null, directUserMessages: [], questionReplies: [], streams: [], toolCalls: [], toolResults: [], anomaly: null, rejection: null, disposed: false };
let queue = Promise.resolve();
export function saveState() { return queue; }
export function apply(ctx, cfg) {
  context = ctx;
  const publish = () => {
    const snapshot = JSON.stringify(state, null, 2);
    queue = queue.then(() => writeFile(path.join(cfg.evidence, 'live-status.json'), snapshot));
    queue.catch(() => { state.anomaly ??= 'evidence-write-failed'; });
  };
  const reject = (reason, fields = []) => { state.anomaly ??= reason; state.rejection ??= { reason, fields }; publish(); throw Error(`P3 live acceptance stopped: ${reason}`); };
  const prepared = new WeakSet();
  let boundAgent;
  const sessionIssues = agent => {
    const h = agent?.session?.header ?? {};
    return [
      [!agent || ctx.agents.get(agent.id) !== agent || !ctx.agents.roots().includes(agent), 'live-root-agent'],
      [!agent || ctx.sessions.get(agent.id) !== agent.session, 'live-session'],
      [typeof h.cwd !== 'string' || !path.isAbsolute(h.cwd) || !path.isAbsolute(cfg.conversation) || path.resolve(h.cwd) !== path.resolve(cfg.conversation), 'cwd'],
      [h.agentPreset !== 'cordis', 'agentPreset'], [Boolean(h.parentSession), 'parentSession'],
      [h.origin === 'subagent', 'origin'], [h.isSeeded !== false, 'isSeeded'],
      [!Number.isSafeInteger(h.createdAt) || h.createdAt < cfg.startedAt, 'createdAt'],
    ].filter(([failed]) => failed).map(([, field]) => field);
  };
  ctx.on('agent/created', ({ agent, source }) => {
    // Publication/setup (including an empty UI Session) is not model authorization.
    // Unknown/resumed/invalid instances remain unbound; the original tool guard is unchanged.
    if (source === 'startup' && !sessionIssues(agent).length) prepared.add(agent);
  });
  ctx.on('session/event', (session, event) => {
    if (event.type === 'user/message' && event.data.source.kind === 'user') {
      if (state.sessionId && session.id !== state.sessionId) reject('second-session');
      if (!state.sessionId) {
        const agent = ctx.agents.get(session.id);
        const fields = sessionIssues(agent);
        if (!state.ready) fields.push('ready');
        if (!agent || !prepared.has(agent)) fields.push('fresh-startup');
        if (agent?.session !== session) fields.push('event-session-identity');
        if (fields.length) reject('unexpected-session', fields);
        const text = event.data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
        if (text !== wish || event.data.content.some(b => b.type !== 'text')) reject('unexpected-or-duplicate-user-message');
        boundAgent = agent; state.sessionId = session.id;
      }
    }
    if (session.id !== state.sessionId) return;
    if (event.type === 'user/message') {
      if (event.data.source.kind === 'user') {
        const text = event.data.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
        if (text !== wish || event.data.content.some(b => b.type !== 'text') || state.directUserMessages.length) { state.anomaly ??= 'unexpected-or-duplicate-user-message'; }
        else state.directUserMessages.push({ sessionId: session.id, seq: event.seq, messageId: event.data.id, text: wish });
      } else if (event.data.source.kind === 'user-question-reply') state.questionReplies.push({ seq: event.seq, callId: event.data.source.callId, outcome: event.data.source.outcome });
    }
    if (event.type === 'tool/call') state.toolCalls.push({ seq: event.seq, callId: event.data.callId, name: event.data.name });
    if (event.type === 'tool/result') state.toolResults.push({ seq: event.seq, callId: event.data.message.toolCallId, isError: Boolean(event.data.message.isError), code: event.data.error?.code ?? null });
    publish();
  });
  ctx.on('llm/stream', async function* (options, next) {
    if (state.anomaly) throw Error('P3 acceptance already stopped');
    if (!state.ready || !state.sessionId || options.sessionId !== state.sessionId || options.provider !== 'command' || options.model !== 'deepseek/deepseek-v4.1-flash' || options.purpose || !isAgentLoopRequest(options)) reject('unexpected-model-activity');
    if (!boundAgent || ctx.agents.get(state.sessionId) !== boundAgent || !prepared.has(boundAgent) || sessionIssues(boundAgent).length) reject('unexpected-model-activity', ['bound-agent-identity']);
    if (state.directUserMessages.length !== 1) reject('direct-user-wish-required');
    if (state.streams.length >= 3) reject('three-visible-model-interactions-reached');
    if (state.streams.some(s => !s.endedAt)) reject('concurrent-model-activity');
    const desc = ctx.settings.describe({ redactSecrets: true }).find(d => String(d.ns).endsWith('llm-pi-ai'));
    const providers = desc?.value?.providers;
    const p = providers?.command;
    if (!p || Object.keys(providers).length !== 1 || p.api !== 'openai-completions' || p.baseURL !== 'https://api.commandcode.ai/provider/v1' || p.apiKeyEnv !== 'COMMAND_API_KEY' || Object.keys(p.headers ?? {}).length || p.models?.length !== 1 || p.models[0].id !== options.model) reject('subscription-route-changed');
    if ((await ctx.credentials.describe('COMMAND_API_KEY')).configured !== true) reject('subscription-authorization-missing');
    // The official Models page does not edit advanced retryPolicy; an unused policy is not a retry.
    // SDK maxRetries is fixed at 0. Fail closed if the application retry driver becomes enabled.
    const retry = (await readPluginInventory(ctx)).entries.find(e => e.entryId.endsWith(':llm-retry'));
    if (!retry || retry.enabled || retry.fiberPhase === 'active') reject('application-retry-enabled');
    if (options.maxTokens !== undefined && options.maxTokens > 2000) reject('output-token-setting-exceeds-2000');
    const attempt = { index: state.streams.length + 1, sessionId: state.sessionId, provider: options.provider, model: options.model, maxTokens: options.maxTokens ?? null, startedAt: new Date().toISOString(), usage: null, finish: null };
    state.streams.push(attempt); publish();
    await queue; // evidence must exist BEFORE entering the real adapter
    try {
      for await (const chunk of next()) {
        if (chunk.type === 'usage') {
          attempt.usage = Object.fromEntries(Object.entries(chunk.usage).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)));
          publish();
        }
        if (chunk.type === 'finish') { attempt.finish = { kind: chunk.reason.kind, code: chunk.reason.failure?.code ?? null }; publish(); }
        yield chunk;
      }
    } catch (error) { attempt.finish = { kind: 'observer-or-adapter-exception' }; state.anomaly ??= 'model-stream-exception'; publish(); throw Error('P3 model stream failed; no retry permitted'); }
    finally { attempt.endedAt = new Date().toISOString(); publish(); }
  });
  ctx.effect(() => async () => { state.disposed = true; publish(); await queue; });
}
