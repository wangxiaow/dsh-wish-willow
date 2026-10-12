import { Context, Service } from '@deepseek-ai/cordis';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import * as Wish from '../../src/p0/host.js';
import * as WishP1 from '../../packages/p1/src/host.js';
import { assertTestRoot, assertNoLinks, controlledPath, runFixtureCommand } from './isolation.mjs';

/** Restricted fixture file tools, NOT the DSH OS sandbox. Shell execution defaults off. */
function codingTools(root, workspace, commandRunner) {
  const cwdFor = args => controlledPath(root, workspace, args.workdir ?? '.');
  const targetFor = async args => {
    const cwd = await cwdFor(args);
    if (typeof args.path !== 'string' || !args.path.trim()) throw Error('A fixture file path is required');
    return controlledPath(root, workspace, path.resolve(cwd, args.path), { allowWorkspace: false });
  };
  const write = async (args, exec) => {
    const target = await targetFor(args);
    exec.signal.throwIfAborted();
    await mkdir(path.dirname(target), { recursive: true });
    await targetFor(args); // recheck newly created ancestors before opening the file
    exec.signal.throwIfAborted();
    await writeFile(target, args.content, { signal: exec.signal });
    return { written: args.path };
  };
  return [
    { name: 'write', execute: write },
    { name: 'edit', execute: async (args, exec) => { const value = await write(args, exec); return { edited: value.written }; } },
    { name: 'read', execute: async (args, exec) => ({ text: await readFile(await targetFor(args), { encoding: 'utf8', signal: exec.signal }) }) },
    { name: 'glob', execute: async () => ({ paths: [] }) },
    { name: 'grep', execute: async () => ({ matches: [] }) },
    { name: 'todo_write', execute: async () => ({ todos: [] }) },
    { name: 'pwsh', execute: async (args, exec) => runFixtureCommand(commandRunner, {
      command: args.command, workdir: await cwdFor(args), timeoutMs: args.timeoutMs, signal: exec.signal,
    }) },
  ];
}

/** Scripted orchestration fixture; neither its policy stub nor its runner proves OS isolation. */
export function createScriptedAgent({ root, workspace, turns = [], reviewTurns = [], reviewTurn, commandRunner }) {
  const state = { disposed: 0, modelDisposed: 0, validationDisposed: 0, reviewDisposed: 0, cancelled: [], createCount: 0,
    modelCreateCount: 0, validationCreateCount: 0, reviewCreateCount: 0, concluded: 0, reviewConcluded: 0, creations: [] };
  const sessions = new Map(), handles = new Set();
  let last = null, closing = false;
  async function create(options) {
    if (closing) throw Error('Scripted runtime is closing');
    const cwd = await controlledPath(root, path.resolve(workspace, options.meta?.cwd ?? '.'), '.');
    if (sessions.has(options.sessionId)) throw Error('Duplicate scripted Session id');
    const validation = options.sessionId.startsWith('wish-replay-');
    const reviewer = options.sessionId.startsWith('wish-review-');
    const reviewIndex = state.reviewCreateCount;
    if (reviewer && state.reviewCreateError) throw Error(state.reviewCreateError);
    state.createCount += 1;
    state[validation ? 'validationCreateCount' : reviewer ? 'reviewCreateCount' : 'modelCreateCount'] += 1;
    state.creations.push({ sessionId: options.sessionId, meta: options.meta, seed: options.seed ?? null, coderDisposed: state.modelDisposed });
    const controller = new AbortController();
    const listeners = new Map(), tools = new Map(), guards = [], events = [], inFlight = new Set();
    const session = { id: options.sessionId, header: { cwd, isSeeded: false }, seq: 0,
      append(type, data) { events.push({ type, seq: this.seq++, data }); return { type, data }; } };
    const agent = { id: options.sessionId, session };
    let turnIndex = 0, callSeq = 0, running = false, activeTurn = Promise.resolve(), disposal, reviewRequest;
    const followups = [], localNames = new Set();
    let allowedGlobals;
    const emit = (name, ...args) => {
      if (name === 'session/event') events.push(args[1]); // committed fixture log, not just an observer notification
      for (const handler of listeners.get(name) ?? []) handler(...args);
    };
    const execute = exec => {
      const operation = (async () => {
        const token = { exec };
        const signal = exec.signal ? AbortSignal.any([controller.signal, exec.signal]) : controller.signal;
        let result;
        try {
          signal.throwIfAborted();
          if (exec.arguments && typeof exec.arguments === 'object' && 'sandbox_permissions' in exec.arguments) throw Error('Scripted fixture cannot widen sandbox permissions');
          const denied = guards.map(guard => guard({ ...exec, token, signal })).find(Boolean);
          if (denied) { const error = Error(denied); error.name = 'WishWillowGuard'; throw error; }
          if (allowedGlobals && !localNames.has(exec.name) && !allowedGlobals.has(exec.name)) throw Error('Tool is outside the fixture scope allowlist');
          const definition = tools.get(exec.name);
          if (!definition) throw Error(`unknown tool ${exec.name}`);
          const value = await definition.execute(exec.arguments, { ...exec, token, signal, deferContext() {}, concludeTurn() { state[reviewer ? 'reviewConcluded' : 'concluded'] += 1; } });
          signal.throwIfAborted();
          result = { isError: false, value, content: [{ type: 'text', text: reviewer && exec.name === 'read' && state.truncateReviewReads ? 'SCRIPTED truncated body' : JSON.stringify(value) }] };
        } catch (error) {
          result = { isError: true, error: { name: error.name ?? 'Error', message: String(error.message ?? error) }, content: [] };
        }
        for (const handler of listeners.get('tools/result') ?? []) handler({ ...exec, token, signal }, result);
        events.push({ type: 'tool/result', seq: session.seq++, data: { message: { toolCallId: exec.callId, isError: result.isError === true, content: result.content },
          ...(result.isError ? { error: result.error } : {}) } });
        return result;
      })();
      inFlight.add(operation);
      operation.then(() => inFlight.delete(operation), () => inFlight.delete(operation));
      return operation;
    };
    const tool = async (name, args) => {
      const result = await execute({ callId: `call-${++callSeq}`, name, arguments: args, agent, signal: controller.signal });
      if (result.isError) { const error = Error(result.error.message); error.code = result.error.name; throw error; }
      return result.value;
    };
    const agentCtx = {
      systemPrompt: { section: () => () => {}, getSectionOrder: () => 10200 },
      on(name, handler) { const list = listeners.get(name) ?? []; list.push(handler); listeners.set(name, list); return () => {}; },
      tools: { presentAs: () => () => {},
        restrict(filter) {
          if (!filter.allow?.length || filter.allow.some(name => !tools.has(name))) throw Error('Unknown/empty fixture global restriction');
          allowedGlobals = new Set(filter.allow); return () => {};
        },
        register(definition) { localNames.add(definition.name); tools.set(definition.name, definition); return () => {}; },
        guard(handler) { guards.push(handler); return () => {}; }, execute },
    };
    for (const definition of codingTools(root, cwd, commandRunner)) tools.set(definition.name, definition);
    async function runTurn() {
      const index = turnIndex++;
      try {
        controller.signal.throwIfAborted();
        if (validation) throw Error('Replay fixture handles must not invoke model turns');
        const selected = reviewer ? reviewTurns[reviewIndex] ?? reviewTurn : turns[index];
        if (typeof selected !== 'function') throw Error(`scripted turn ${index} is missing`);
        for (const handler of listeners.get('agent/pre-step') ?? []) {
          const decision = await handler({ agent, messages: [], turn: index + 1, step: 1, signal: controller.signal },
            async () => ({ kind: 'enter', messages: [] }));
          if (decision?.kind === 'reject') return;
        }
        const requestStep = async step => {
          for (const handler of listeners.get('agent/pre-step') ?? []) {
            const decision = await handler({ agent, messages: [], turn: index + 1, step, signal: controller.signal }, async () => ({ kind: 'enter', messages: [] }));
            if (decision?.kind === 'reject') throw Error('Fixture step rejected by the real hook');
          }
        };
        await selected({ tool, execute, workspace: cwd, agentCtx, agent: handle.agent, signal: controller.signal, reviewRequest, requestStep });
        controller.signal.throwIfAborted();
        emit('session/event', session, { type: 'assistant/message', seq: session.seq++, data: { usage: { inputTokens: 120, outputTokens: 40 } } });
        emit('session/event', session, { type: 'turn/end', seq: session.seq++, data: { reason: { kind: 'completed' } } });
      } catch (error) {
        state.lastTurnError = String(error.message ?? error);
        emit('session/event', session, { type: 'turn/end', seq: session.seq++,
          data: { reason: { kind: 'error', error: { message: state.lastTurnError, code: error.code ?? 'test' } } } });
      } finally { running = false; }
    }
    const cancel = cause => {
      if (controller.signal.aborted) return;
      state.cancelled.push(cause);
      controller.abort(Error('Scripted execution cancelled'));
    };
    const whenIdle = async () => {
      await activeTurn;
      while (inFlight.size) await Promise.allSettled([...inFlight]);
    };
    const handle = {
      agent: { ...agent,
        followup(message) {
          followups.push(structuredClone(message));
          if (reviewer) reviewRequest = JSON.parse(message.content[0].text);
          controller.signal.throwIfAborted();
          if (running) throw Error('Scripted turn already running');
          running = true; activeTurn = runTurn();
        }, whenIdle, cancel },
      dispose: () => disposal ??= (async () => {
        cancel({ kind: 'disposed' });
        await whenIdle(); // do not resolve idle or detach a turn just because it was cancelled
        state.disposed += 1;
        state[validation ? 'validationDisposed' : reviewer ? 'reviewDisposed' : 'modelDisposed'] += 1;
        handles.delete(handle);
      })(),
    };
    const record = { agent, session, events, followups };
    sessions.set(session.id, record);
    if (!validation && !reviewer) last = record;
    handles.add(handle);
    try { await options.setup?.(agentCtx, agent); }
    catch (error) { await handle.dispose(); throw error; }
    return handle;
  }
  return { create, state, sessions, get last() { return last; },
    getSession(id) { const record = sessions.get(id); if (!record) throw Error(`Unknown scripted Session: ${id}`); return record; },
    close: async () => {
      closing = true;
      for (const handle of handles) handle.agent.cancel({ kind: 'disposed' });
      await Promise.all([...handles].map(handle => handle.dispose()));
    } };
}

/** Real storage/services, scripted model and fixture tools: no actual DSH shell sandbox. */
export async function p1Runtime(root, { workspaceRoot, maxSteps, turns = [], reviewTurns = [], reviewTurn, withP0 = false, commandRunner } = {}) {
  root = await assertTestRoot(root);
  const workspace = await controlledPath(root, path.resolve(root, workspaceRoot ?? 'workspace'), '.');
  const productsRoot = await controlledPath(root, path.join(root, 'products'), '.');
  for (const name of ['wish_willow.json', 'wish_willow_p1.json']) await assertNoLinks(path.join(root, name));
  const ctx = new Context(), fibers = [];
  const scripted = createScriptedAgent({ root, workspace, turns, reviewTurns, reviewTurn, commandRunner });
  // Agent Session cwd is independently validated as a strict child of root at create().
  let closing;
  const close = () => closing ??= (async () => {
    await scripted.close();
    const failures = [];
    for (const fiber of [...fibers].reverse()) try { await fiber.dispose(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Fixture runtime teardown failed; directory retained');
  })();
  const mount = async (plugin, config = {}) => { const fiber = ctx.plugin(plugin, config); fibers.push(fiber); await fiber; if (fiber.state !== 2) throw Error(`Plugin inactive: ${fiber.name}`); return fiber; };
  try {
    await mount(Storage);
    await mount(Json, { root });
    await mount(Domain, { backend: 'json' });
    await mount(Typert);
    await mount(Gateway);
    await mkdir(workspace, { recursive: true });
    const stub = values => ({ name: `p1-test-stub-${Math.random().toString(16).slice(2)}`,
      apply(inner) {
        for (const [key, value] of Object.entries(values)) {
          class Stub extends Service { constructor(context) { super(context, key); Object.assign(this, value); } }
          new Stub(inner);
        }
      } });
    await mount(stub({ agentDefaultModel: { currentSelection: () => ({ provider: 'p1-test', model: 'p1-test-model' }) },
      agentPresets: { resolve: async () => ({ id: 'test-preset' }), mount: async () => ({ id: 'test-preset' }) },
      // Metadata stub only. It must never be cited as an OS sandbox verification.
      sandboxPolicy: { defaultMode: 'workspace-write', resolve: () => ({ mode: 'workspace-write', workspaceRoot: workspace }) },
      sessions: { flush: async () => true },
      sessionQuery: { readSession: async id => scripted.getSession(id) },
      agents: { create: options => scripted.create(options) } }));
    if (withP0) await mount(Wish);
    const p1 = await mount(WishP1, { workspaceRoot: productsRoot, ...(maxSteps ? { maxSteps } : {}) });
    return { ctx, p1, scripted, workspace,
      call: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillowP1', method, args }),
      callP0: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillow', method, args }), close };
  } catch (error) {
    try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'Fixture startup and cleanup failed'); }
    throw error;
  }
}

export const settle = async (runtime, projectId) => {
  for (let index = 0; index < 600; index += 1) {
    const rows = await runtime.call('list');
    const row = rows.find(item => item.id === projectId);
    if (!row) throw Error('product vanished');
    const change = row.changes.at(-1);
    if (change && !['pending', 'running'].includes(change.status) && row.runs.every(run => run.status !== 'running') &&
      !(runtime.ctx ?? runtime.app?.ctx)?.wishWillowP1?.orchestrator.isActive(projectId)) return row;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw Error('execution did not settle');
};
