import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { temporary } from './helpers/temp.mjs';
import { createFixtureRunner, fixtureEnvironment } from './helpers/runner.mjs';
import { acceptanceParent, assertIsolatedPath, assertNoLinks, assertTestRoot, controlledPath,
  fixtureParent, liveHomePaths, runFixtureCommand } from './helpers/isolation.mjs';
import { p1Runtime, settle } from './helpers/p1-runtime.mjs';

test('the real DSH home is resolved the way the pinned DSH resolver does', () => {
  // explicit DSH_HOME > non-blank DSH_HOME > OS home/.dsh, with ~ expansion; the default OS home
  // is protected as well, so a test can never be pointed at the developer's own DSH home.
  const home = join('C:', 'fake-user');
  assert.deepEqual(liveHomePaths({}, home), [join(home, '.dsh')]);
  assert.deepEqual(liveHomePaths({ DSH_HOME: join('C:', 'iso') }, home), [join('C:', 'iso'), join(home, '.dsh')]);
  assert.deepEqual(liveHomePaths({ DSH_HOME: '   ' }, home), [join(home, '.dsh')]);
  assert.deepEqual(liveHomePaths({ DSH_HOME: '~/dsh-iso' }, home), [join(home, 'dsh-iso'), join(home, '.dsh')]);
  assert.deepEqual(liveHomePaths({ DSH_HOME: join('C:', 'iso'), DSH_PROFILE_DIR: join('C:', 'p') }, home),
    [join('C:', 'iso'), join(home, '.dsh'), join('C:', 'p')]);
});

test('an acceptance home is only ever a strict child of the declared isolation parent', async () => {
  // The historical `startsWith` bug accepted a prefix sibling such as
  // `...acceptance-backup` as if it were inside `...acceptance`.
  await assert.rejects(assertIsolatedPath(`${acceptanceParent}-backup${join('/', 'x')}`, { parent: acceptanceParent }),
    /not inside the dedicated isolation parent/);
  await assert.rejects(assertIsolatedPath(acceptanceParent, { parent: acceptanceParent }), /not inside the dedicated isolation parent/);
  assert.equal(await assertIsolatedPath(join(acceptanceParent, 'nested', 'home'), { parent: acceptanceParent }),
    join(acceptanceParent, 'nested', 'home'));
});

test('a fixture root is a new marked directory that is deliberately never deleted', async t => {
  const root = await temporary(t);
  assert.equal(await assertTestRoot(root), root);
  const marker = await readFile(join(root, '.wish-willow-test-owner'), 'utf8');
  assert.equal(marker.includes('"kind":"fixture"'), true);
  // Retention is intentional: this task does not authorize recursive deletion of fixtures.
  assert.equal((await readFile(join(root, '.wish-willow-test-owner'), 'utf8')), marker);
  // The parent itself, the real homes, the OS temp root and an outside path are all refused.
  for (const candidate of [fixtureParent, tmpdir(), homedir(), join(homedir(), '.dsh')]) {
    await assert.rejects(assertIsolatedPath(candidate, { parent: fixtureParent }), /Unsafe test path/);
  }
  // A directory inside the parent but lacking this process's ownership marker is still refused.
  const unmarked = join(root, 'unmarked');
  await mkdir(unmarked);
  await assert.rejects(assertTestRoot(unmarked), /Unsafe test path/);
  await assert.rejects(assertIsolatedPath(join(dirname(fixtureParent), 'wish-willow-outside'), { parent: fixtureParent }),
    /not inside the dedicated isolation parent/);
});

test('dangerous roots and redirected paths are refused before any fixture runs', async t => {
  const root = await temporary(t);
  const alias = join(root, 'alias');
  await symlink(fixtureParent, alias, 'junction');
  await assert.rejects(assertNoLinks(alias), /link or junction/);
  // A fixture path reached through a junction is refused even though it resolves somewhere real.
  await assert.rejects(assertIsolatedPath(join(alias, 'wish-willow-test-nested'), { parent: fixtureParent }), /Unsafe test path/);
});

test('tool paths resolve against the Session workspace, never the process working directory', async t => {
  const root = await temporary(t);
  const workspace = join(root, 'workspace');
  await mkdir(join(workspace, 'nested'), { recursive: true });
  await writeFile(join(workspace, 'nested', 'file.txt'), 'inside\n');
  assert.equal(await controlledPath(root, workspace, 'nested/file.txt'), join(workspace, 'nested', 'file.txt'));
  for (const escape of ['.', '..', '../outside', join(root, 'elsewhere'), 'nested/../..']) {
    await assert.rejects(controlledPath(root, workspace, escape, { allowWorkspace: false }), /Unsafe test path/);
  }
  assert.equal(await controlledPath(root, workspace, '.'), workspace);
});

test('no shell exists unless a test explicitly constructs the fixture runner', async () => {
  await assert.rejects(runFixtureCommand(null, { command: 'Write-Output hi' }), /Scripted shell disabled/);
  await assert.rejects(runFixtureCommand({ commands: ['Write-Output hi'], run: async () => ({}) }, { command: 'Write-Output hi' }),
    /Scripted shell disabled/);
  const root = await temporary(null);
  const workdir = join(root, 'work');
  await mkdir(workdir);
  const runner = createFixtureRunner({ root });
  // The runner receives OS launch essentials only; model/cloud credentials and NODE_OPTIONS never leak.
  const env = fixtureEnvironment(root, { PATH: 'C:\\fake', SYSTEMROOT: 'C:\\Windows', SECRET_TOKEN: 'do-not-leak',
    DSH_HOME: 'C:\\fake\\.dsh', NODE_OPTIONS: '--require something' });
  assert.equal(env.PATH, 'C:\\fake');
  assert.equal(env.SECRET_TOKEN, undefined);
  assert.equal(env.DSH_HOME, undefined);
  assert.equal(env.NODE_OPTIONS, '');
  assert.equal(env.TEMP.startsWith(root), true);
  assert.equal(env.USERPROFILE.startsWith(root), true);
  // A real command runs inside the fixture and returns a real exit code, including real failures.
  const ok = await runner.run({ command: 'Write-Output fixture-ok; exit 0', workdir });
  assert.equal(ok.kind, 'foreground');
  assert.equal(ok.exitCode, 0, ok.stderr);
  assert.match(ok.stdout, /fixture-ok/);
  assert.equal((await runner.run({ command: 'exit 7', workdir })).exitCode, 7);
  // A workdir outside the owned fixture is refused; a cancelled command reports the abort.
  await assert.rejects(runner.run({ command: 'exit 0', workdir: fixtureParent }), /Unsafe test path/);
  const controller = new AbortController();
  const pending = runner.run({ command: 'Start-Sleep -Seconds 30', workdir, timeoutMs: 25000, signal: controller.signal });
  await new Promise(resolve => setTimeout(resolve, 500));
  controller.abort();
  assert.equal((await pending).aborted, true);
});

test('a delivery whose commands are never executed cannot be released', async t => {
  const root = await temporary(t);
  const plan = async ({ tool }) => {
    await tool('wish_state', {});
    await tool('wish_plan', { requirements: ['可以通过 node 启动'], constraints: ['仅本地运行'], decisions: [],
      tasks: [{ description: '实现最小应用与启动方式', category: 'technical' }] });
  };
  const code = async ({ tool }) => {
    const { workspace } = await tool('wish_state', {});
    await tool('write', { path: 'app.js', content: 'console.log("ok")\n', workdir: workspace });
    for (const [kind, command] of [['build', 'node --check app.js'], ['test', 'node --check app.js'], ['run', 'node app.js']]) {
      await tool('wish_verify', { kind, command, description: kind });
    }
    await tool('wish_deliver', { startCommand: 'node app.js', summary: '不应交付' });
  };
  // No commandRunner: every shell call must fail closed instead of silently succeeding.
  const host = await p1Runtime(root, { turns: [plan, code] });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: '90000000-0000-4000-8000-000000000001', title: '无 Shell', wish: '必须真实执行命令。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: '90000000-0000-4000-8000-000000000002', wish: created.goal } });
  const project = await settle(host, created.id);

  assert.equal(project.releases.length, 0);
  assert.equal(project.builds.length, 0);
  assert.equal(project.evidence.filter(row => row.success && row.exitCode === 0).length, 0);
  for (const row of project.evidence.filter(entry => ['build', 'test', 'run'].includes(entry.kind))) {
    assert.equal(row.success, false);
    assert.match(row.summary, /Scripted shell disabled/);
  }
  assert.equal(host.scripted.state.validationCreateCount, 0, 'the delivery gate never ran without evidence');
});
