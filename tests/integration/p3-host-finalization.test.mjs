// Local-only contract tests. No CLI boot, AgentLoop, persistence backend, network or shell executor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Context, Service } from '@deepseek-ai/cordis';
import Sessions, { Session } from '@deepseek-ai/dsh-session';
import Projection from '../../.research/installed/dsh/node_modules/@deepseek-ai/dsh-session-projection/lib/index.js';
import Approval from '../../.research/installed/dsh/node_modules/@deepseek-ai/dsh-user-approval/lib/index.js';
import Permission from '../../.research/installed/dsh/node_modules/@deepseek-ai/dsh-permission-presets/lib/index.js';
import { parse } from '../../.research/installed/dsh/node_modules/yaml/dist/index.js';

const runner = await readFile(new URL('../live-probe-p3-intake/host-run.mjs', import.meta.url), 'utf8');
// Evaluate ONLY the source's pure overlay literal and flush block, never import/execute the runner.
const literal = runner.match(/await writeFile\(overlay, (`[^`]+`), \{ flag: 'wx' \}\);/);
assert.ok(literal, 'locate the exact overlay used by the real entry');
const overlay = parse(new Function('jsonPath', 'guardPath', 'observerPath', `return ${literal[1]}`)(JSON.stringify, '/guard.mjs', '/observer.mjs'));
const checkpoint = runner.match(/  \/\/ Flush the exact live Session;[^]*?(?=  const stored =)/);
assert.ok(checkpoint, 'locate the exact corrected checkpoint');
const flush = new Function('ctx', 'agent', 'assert', `return (async () => { ${checkpoint[0]} })()`);
const baseText = await readFile(new URL('../../.research/installed/dsh/node_modules/@deepseek-ai/dsh-base/cordis.patch.yml', import.meta.url), 'utf8');
const basePermission = parse(baseText.slice(baseText.indexOf('    - id: permission\n'), baseText.indexOf('    - id: shell-env\n')))[0].config;
const addition = overlay.find(row => row.id === 'permission').config;
const permissionConfig = { ...basePermission, ...addition, presets: { ...basePermission.presets, ...addition.presets } };

async function memory(t, policy = 'never') {
  const ctx = new Context();
  t.after(() => ctx.fiber.dispose());
  async function mount(plugin, config) {
    const fiber = ctx.plugin(plugin, config); await fiber;
    assert.equal(fiber.state, 2, fiber.error?.message ?? fiber.name); return fiber;
  }
  await mount(Sessions);
  await mount(Projection);
  await mount(Approval, { policy });
  // Metadata seam only: cannot execute shell commands or materialize ACL grants.
  class ShellMetadata extends Service {
    constructor(inner) { super(inner, 'shell'); this.sandboxMode = 'workspace-write'; }
  }
  await mount(ShellMetadata);
  return { ctx, mount };
}

test('official SessionStore reproduces ID refusal; exact runner checkpoint awaits the live Session listener', async t => {
  const { ctx } = await memory(t);
  const session = ctx.sessions.create('p3-local-flush');
  const agent = { id: session.id, session };
  let observed, completed = false;
  ctx.on('session/flush', async value => { observed = value; await Promise.resolve(); completed = true; });
  await assert.rejects(ctx.sessions.flush(agent.id), /not live in this store/);
  await flush(ctx, agent, assert);
  assert.equal(observed, session); assert.equal(completed, true);
  assert.deepEqual(session.ownEvents(), []);
});

test('corrected checkpoint fails closed for detached Session and missing durability listener', async t => {
  const { ctx } = await memory(t);
  const session = ctx.sessions.create('p3-local-no-writer');
  await assert.rejects(flush(ctx, { id: session.id, session }, assert), /durability listener/);
  const detached = Session.create(session.id);
  await assert.rejects(flush(ctx, { id: session.id, session: detached }, assert), /Session must still be live/);
});

test('old approval override reproduces the official unmatched-default failure', async t => {
  const { ctx } = await memory(t);
  const fiber = ctx.plugin(Permission, basePermission);
  await assert.rejects(Promise.resolve(fiber), /composed sandbox and approval defaults match no preset/);
  assert.equal(fiber.state, 3);
});

test('exact acceptance overlay activates official PermissionPreset without broadening either knob', async t => {
  const { ctx, mount } = await memory(t);
  await mount(Permission, permissionConfig);
  assert.equal(ctx.permissionPresets.defaultPreset, 'p3-intake-only');
  assert.deepEqual(ctx.permissionPresets.resolve('p3-intake-only'), { sandbox: 'workspace-write', approval: 'never' });
  assert.equal(ctx.shell.sandboxMode, 'workspace-write');
  assert.equal(ctx.approval.config.policy, 'never');
  const session = ctx.sessions.create('p3-local-permission');
  assert.equal(ctx.permissionPresets.current(session), 'p3-intake-only');
  assert.deepEqual(session.ownEvents().map(e => ({ type: e.type, data: e.data })), [
    { type: 'permission/preset', data: { preset: 'p3-intake-only' } },
    { type: 'sandbox/mode', data: { mode: 'workspace-write' } },
    { type: 'approval/policy', data: { policy: 'never' } },
  ]);
  assert.ok(runner.includes("'wish-willow-p3-no-model-observer', 'permission'"), 'real Host probe must require active permission row');
});

test('official production preset still defaults to workspace-write/ask; acceptance-only extension preserves builtins', async t => {
  const { ctx, mount } = await memory(t, 'ask');
  await mount(Permission, basePermission);
  assert.equal(ctx.permissionPresets.defaultPreset, 'workspace-write');
  for (const [name, spec] of Object.entries(basePermission.presets)) assert.deepEqual(permissionConfig.presets[name], spec);
  assert.equal(basePermission.presets['p3-intake-only'], undefined);
});

test('guard, zero-step overlay and original safety tests remain byte-identical; no model routes enabled', async () => {
  for (const [relative, expected] of [
    ['../live-probe-p3-intake/guard.mjs', '18ce5773c3f30c10370ffcb864897280dccc4692c03ee2921d0b02aedd6b4fe8'],
    ['../live-probe-p3-intake/acceptance.patch.yml', 'c15616297aa97c286e504fba1a7257fb6e4ac20c9fabdc445ae11005d64cff4a'],
    ['./p3-intake-acceptance.test.mjs', '9e5f335fe294dc6d30b5c1471ffcb488beaac2685fcae5ceca421c3d5689ab50'],
  ]) assert.equal(createHash('sha256').update(await readFile(new URL(relative, import.meta.url))).digest('hex'), expected);
  for (const id of ['llm-deepseek', 'llm-deepseek-account', 'llm-pi-ai', 'deepseek-account', 'goal-round-driver']) {
    assert.equal(overlay.find(row => row.id === id).disabled, true);
  }
  assert.deepEqual(overlay.find(row => row.id === 'agent-loop').config.agents, []);
  assert.equal(overlay.find(row => row.id === 'approval').config.policy, 'never');
  assert.ok(runner.includes('orchestrator.config.maxSteps, 0'));
});
