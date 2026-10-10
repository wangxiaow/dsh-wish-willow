import { Context, Service } from '@deepseek-ai/cordis';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import * as Wish from '../../src/p0/host.js';
import * as WishP1 from '../../packages/p1/src/host.js';

/** Real Coding tools without a model: real writes inside the workspace and real commands with real exit codes. */
function codingTools(workspace) {
  return [
    { name: 'write', execute: async args => { await writeFile(path.join(args.workdir ?? workspace, args.path), args.content); return { written: args.path }; } },
    { name: 'edit', execute: async args => { await writeFile(path.join(args.workdir ?? workspace, args.path), args.content); return { edited: args.path }; } },
    { name: 'read', execute: async args => ({ text: await readFile(path.join(args.workdir ?? workspace, args.path), 'utf8') }) },
    { name: 'glob', execute: async () => ({ paths: [] }) },
    { name: 'grep', execute: async () => ({ matches: [] }) },
    { name: 'todo_write', execute: async () => ({ todos: [] }) },
    { name: 'pwsh', execute: async args => {
      const proc = spawnSync(args.command, { cwd: args.workdir, shell: true, encoding: 'utf8', timeout: 60000 });
      return { kind: 'foreground', exitCode: proc.status, signal: null, timedOut: false, aborted: false,
        stdout: { text: proc.stdout ?? '', truncated: false }, stderr: { text: proc.stderr ?? '', truncated: false } };
    } },
  ];
}

/** Scripted stand-in for the real DSH Agent: real Host orchestration, real guards, real command execution, no model. */
export function createScriptedAgent({ workspace, turns = [] }) {
  const state = { disposed: 0, cancelled: [], createCount: 0, concluded: 0 };
  let last = null;
  async function create(options) {
    state.createCount += 1;
    const listeners = new Map();
    const tools = new Map();
    const guards = [];
    const events = [];
    const session = { id: options.sessionId, header: { cwd: options.meta?.cwd ?? workspace }, seq: 0,
      append(type, data) { events.push({ type, seq: this.seq++, data }); return { type, data }; } };
    const agent = { id: options.sessionId, session };
    let turnIndex = 0, callSeq = 0, idleResolve = null, idle = null, idleSettled = true;
    const emit = (name, ...args) => { for (const handler of listeners.get(name) ?? []) handler(...args); };
    const execute = async exec => {
      const token = { exec };
      const denied = guards.map(guard => guard({ ...exec, token })).find(Boolean);
      let result;
      if (denied) result = { isError: true, error: { name: 'WishWillowGuard', message: denied }, content: [] };
      else {
        const definition = tools.get(exec.name);
        if (!definition) result = { isError: true, error: { name: 'UNKNOWN_TOOL', message: `unknown tool ${exec.name}` }, content: [] };
        else {
          try {
            const value = await definition.execute(exec.arguments, { ...exec, token, deferContext() {}, concludeTurn() { state.concluded += 1; } });
            result = { isError: false, value, content: [{ type: 'text', text: JSON.stringify(value) }] };
          } catch (error) { result = { isError: true, error: { name: error.name ?? 'Error', message: String(error.message ?? error) }, content: [] }; }
        }
      }
      for (const handler of listeners.get('tools/result') ?? []) handler({ ...exec, token }, result);
      events.push({ type: 'tool/result', seq: session.seq++, data: { message: { toolCallId: exec.callId, isError: result.isError === true },
        ...(result.isError ? { error: result.error } : {}) } });
      return result;
    };
    const tool = async (name, args) => {
      const result = await execute({ callId: `call-${++callSeq}`, name, arguments: args, agent, signal: new AbortController().signal });
      if (result.isError) { const error = new Error(result.error.message); error.code = result.error.name; throw error; }
      return result.value;
    };
    const agentCtx = {
      systemPrompt: { section: () => () => {}, getSectionOrder: () => 10200 },
      on(name, handler) { const list = listeners.get(name) ?? []; list.push(handler); listeners.set(name, list); return () => {}; },
      tools: { presentAs: () => () => {},
        register(definition) { tools.set(definition.name, definition); return () => {}; },
        guard(handler) { guards.push(handler); return () => {}; },
        execute },
    };
    for (const definition of codingTools(workspace)) tools.set(definition.name, definition);
    async function step() {
      for (const handler of listeners.get('agent/pre-step') ?? []) {
        const decision = await handler({ agent, messages: [], turn: turnIndex + 1, step: 1, signal: new AbortController().signal },
          async () => ({ kind: 'enter', messages: [] }));
        if (decision?.kind === 'reject') return false;
      }
      return true;
    }
    async function runTurn() {
      const index = turnIndex++;
      try {
        if (typeof turns[index] !== 'function') throw new Error(`scripted turn ${index} is missing`);
        if (!await step()) return;
        await turns[index]({ tool, execute, workspace, agentCtx, agent });
        emit('session/event', session, { type: 'assistant/message', seq: session.seq++,
          data: { usage: { inputTokens: 120, outputTokens: 40 } } });
        emit('session/event', session, { type: 'turn/end', seq: session.seq++, data: { reason: { kind: 'completed' } } });
      } catch (error) {
        state.lastTurnError = String(error.message ?? error);
        emit('session/event', session, { type: 'turn/end', seq: session.seq++,
          data: { reason: { kind: 'error', error: { message: state.lastTurnError, code: error.code ?? 'test' } } } });
      } finally { idleSettled = true; idleResolve?.(); idleResolve = null; }
    }
    last = { agent, session, events };
    await options.setup(agentCtx, agent);
    return {
      agent: { ...agent,
        followup: () => { idleSettled = false; idle = new Promise(resolve => { idleResolve = resolve; }); void runTurn(); },
        whenIdle: async () => { while (!idleSettled) await (idle ?? Promise.resolve()); },
        cancel: cause => { state.cancelled.push(cause); idleSettled = true; idleResolve?.(); idleResolve = null; } },
      dispose: async () => { state.disposed += 1; },
    };
  }
  return { create, state, get last() { return last; } };
}

/** Real DSH services plus stubs for the model/preset/session edge a headless test cannot mount. */
export async function p1Runtime(root, { workspaceRoot, maxSteps, turns = [], withP0 = false } = {}) {
  const ctx = new Context();
  const fibers = [];
  const mount = async (plugin, config = {}) => { const fiber = ctx.plugin(plugin, config); fibers.push(fiber); await fiber; if (fiber.state !== 2) throw new Error(`Plugin inactive: ${fiber.name}`); return fiber; };
  await mount(Storage);
  await mount(Json, { root });
  await mount(Domain, { backend: 'json' });
  await mount(Typert);
  await mount(Gateway);
  const workspace = workspaceRoot ?? path.join(root, 'workspace');
  await mkdir(workspace, { recursive: true });
  const scripted = createScriptedAgent({ workspace, turns });
  const stub = values => ({ name: `p1-test-stub-${Math.random().toString(16).slice(2)}`,
    apply(inner) {
      for (const [key, value] of Object.entries(values)) {
        class Stub extends Service { constructor(context) { super(context, key); Object.assign(this, value); } }
        new Stub(inner);
      }
    } });
  await mount(stub({ agentDefaultModel: { currentSelection: () => ({ provider: 'p1-test', model: 'p1-test-model' }) },
    agentPresets: { resolve: async () => ({ id: 'test-preset' }), mount: async () => ({ id: 'test-preset' }) },
    sandboxPolicy: { defaultMode: 'workspace-write', resolve: () => ({ mode: 'workspace-write', workspaceRoot: workspace }) },
    sessions: { flush: async () => true },
    sessionQuery: { readSession: async () => ({ session: scripted.last.session, events: scripted.last.events }) },
    agents: { create: options => scripted.create(options) } }));
  if (withP0) await mount(Wish);
  const p1 = await mount(WishP1, { workspaceRoot, ...(maxSteps ? { maxSteps } : {}) });
  return { ctx, p1, scripted, workspace,
    call: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillowP1', method, args }),
    callP0: (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'wishWillow', method, args }),
    close: async () => { for (const fiber of [...fibers].reverse()) await fiber.dispose(); } };
}

export const settle = async (runtime, projectId) => {
  for (let index = 0; index < 600; index += 1) {
    const rows = await runtime.call('list');
    const row = rows.find(item => item.id === projectId);
    if (!row) throw new Error('product vanished');
    const change = row.changes.at(-1);
    // Wait for the change AND for its AgentRun to reach a terminal state: the run counter is
    // finalized after the change settles, so stopping early would read a half-written record.
    if (change && !['pending', 'running'].includes(change.status) && row.runs.every(run => run.status !== 'running')) return row;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('execution did not settle');
};
