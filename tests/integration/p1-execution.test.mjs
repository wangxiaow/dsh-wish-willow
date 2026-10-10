import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { temporary } from '../helpers/temp.mjs';
import { p1Runtime, settle } from '../helpers/p1-runtime.mjs';

const APP = `#!/usr/bin/env node
const tasks = [];
const [command, value] = process.argv.slice(2);
if (command === 'add') tasks.push({ value, done: false });
console.log(JSON.stringify({ count: tasks.length, command: command ?? null, value: value ?? null }));
`;

const planTurn = observed => async ({ tool }) => {
  const state = await tool('wish_state', {});
  observed.push({ kind: 'initial-state', projectId: state.id, requirements: state.requirements.length, versions: state.versions.length });
  await tool('wish_plan', {
    requirements: ['可以添加任务', '可以标记完成', '可以删除任务'],
    constraints: ['仅本地运行，不部署公网服务'],
    decisions: [],
    tasks: [{ description: '实现待办事项应用的最小功能', category: 'technical' }],
  });
  for (const [label, args, expected] of [
    ['plan-stage coding', { path: 'app.js', content: APP, workdir: state.workspace }, /Plan first/],
    ['sandbox escalation', { path: 'app.js', content: APP, sandbox_permissions: 'danger-full-access' }, /widen sandbox permissions/],
  ]) {
    await tool('write', args).then(() => observed.push({ kind: 'guard', label, denied: false }),
      error => observed.push({ kind: 'guard', label, denied: true, message: error.message, expected: expected.source }));
  }
};

const happyCodeTurn = observed => async ({ tool }) => {
  const { workspace } = await tool('wish_state', {});
  await tool('write', { path: 'app.js', content: APP, workdir: join(dirname(workspace), 'outside') }).then(
    () => observed.push({ kind: 'guard', label: 'outside workdir', denied: false }),
    error => observed.push({ kind: 'guard', label: 'outside workdir', denied: true, message: error.message, expected: 'outside controlled product workspace' }));
  await tool('write', { path: 'app.js', content: APP, workdir: workspace });
  await tool('write', { path: 'app.test.js', content: 'process.exit(0);\n', workdir: workspace });
  for (const [kind, command] of [['build', 'node --check app.js'], ['test', 'node app.test.js'], ['run', 'node app.js add milk']]) {
    const value = await tool('wish_verify', { kind, command, description: `${kind} check` });
    observed.push({ kind, success: value.success, exitCode: value.exitCode });
  }
  observed.push({ kind: 'deliver', value: await tool('wish_deliver', { startCommand: 'node app.js add milk', summary: '待办事项应用已构建、测试并冒烟运行。' }) });
};

test('real orchestration delivers only with real code, build, test and run evidence', async t => {
  const root = await temporary(t);
  const observed = [];
  const host = await p1Runtime(root, { turns: [planTurn(observed), happyCodeTurn(observed)] });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: 'aaaaaaaa-0000-4000-8000-000000000001', title: '待办事项应用', wish: '我想做一个简单的待办事项应用，可以添加任务、标记完成、删除任务。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: 'bbbbbbbb-0000-4000-8000-000000000002', wish: created.goal } });
  const project = await settle(host, created.id);

  assert.equal(project.status, 'delivered');
  assert.equal(project.changes.length, 1);
  assert.equal(project.changes[0].status, 'completed');
  assert.equal(project.requirements.filter(row => row.confirmation === 'confirmed').length, 1);
  assert.equal(project.requirements.filter(row => row.confirmation === 'inferred').length, 3);
  assert.deepEqual(project.constraints.map(row => row.confirmation), ['inferred']);
  assert.equal(project.decisions.length, 0);

  assert.deepEqual(project.tasks.map(row => row.phase), ['plan', 'code', 'verify', 'deliver']);
  assert.deepEqual([...new Set(project.tasks.map(row => row.status))], ['completed']);
  assert.deepEqual(project.tasks.map(row => row.category), ['experience', 'technical', 'technical', 'technical']);
  assert.ok(project.tasks.every(row => row.changeId === project.changes[0].id && row.projectId === project.id && row.runId));
  assert.equal(project.tasks[1].dependencies[0], project.tasks[0].id);
  assert.equal(project.tasks[3].dependencies[0], project.tasks[2].id);

  assert.deepEqual(project.evidence.map(row => row.kind).sort(), ['build', 'code', 'run', 'test']);
  assert.deepEqual(project.evidence.filter(row => row.kind !== 'code').map(row => row.exitCode), [0, 0, 0]);
  assert.ok(project.evidence.every(row => row.success));
  assert.equal(project.evidence.filter(row => row.kind === 'run')[0].command, 'node app.js add milk');
  assert.ok(project.evidence.every(row => row.sessionId === project.runs[0].sessionId));

  assert.equal(project.versions.length, 1);
  assert.equal(project.versions[0].status, 'Released');
  assert.equal(project.builds.length, 1);
  assert.equal(project.builds[0].status, 'passed');
  assert.equal(project.builds[0].versionId, project.versions[0].id);
  assert.equal(project.builds[0].evidenceIds.length, 3);
  assert.equal(project.releases.length, 1);
  assert.equal(project.releases[0].startCommand, 'node app.js add milk');
  assert.equal(project.releases[0].sourcePath, project.workspace);
  assert.equal(project.releases[0].versionId, project.versions[0].id);
  assert.equal(project.releases[0].buildId, project.builds[0].id);

  const artifact = project.artifacts[0];
  const manifest = JSON.parse(await readFile(artifact.path, 'utf8'));
  assert.equal(createHash('sha256').update(await readFile(artifact.path)).digest('hex'), artifact.sha256);
  assert.deepEqual(manifest.entries.map(row => row.path), ['app.js', 'app.test.js']);
  for (const entry of manifest.entries) {
    const bytes = await readFile(join(project.releases[0].snapshotPath, entry.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }

  const run = project.runs.at(-1);
  assert.equal(run.status, 'completed');
  assert.equal(run.modelCalls, 2);
  assert.equal(run.provider, 'p1-test');
  assert.equal(run.inputTokens, 240);
  assert.equal(run.outputTokens, 80);
  assert.ok(run.toolCalls >= 6);
  assert.ok(run.durationMs >= 0);
  assert.ok(project.history.some(row => row.action === 'start-agent-run'));
  assert.ok(project.history.some(row => row.action === 'build-version'));
  assert.ok(project.history.some(row => row.action === 'release-version'));

  const guards = observed.filter(row => row.kind === 'guard');
  assert.equal(guards.length, 3);
  assert.deepEqual(guards.map(row => row.denied), [true, true, true]);
  assert.ok(guards.every(row => new RegExp(row.expected).test(row.message)));
  assert.deepEqual(observed.find(row => row.kind === 'initial-state'), { kind: 'initial-state', projectId: created.id, requirements: 1, versions: 1 });
  assert.deepEqual(observed.filter(row => row.kind !== 'guard' && row.kind !== 'initial-state' && row.kind !== 'deliver').map(row => [row.kind, row.success, row.exitCode]), [['build', true, 0], ['test', true, 0], ['run', true, 0]]);
  assert.equal(host.scripted.state.createCount, 1);
  assert.equal(host.scripted.state.disposed, 1);
  assert.equal(host.scripted.state.concluded, 1);
});

test('claims without real evidence cannot become a delivery', async t => {
  const root = await temporary(t);
  const observed = [];
  const turns = [planTurn(observed), async ({ tool }) => {
    await tool('wish_deliver', { startCommand: 'node app.js', summary: '只看生成文本就宣称完成。' })
      .then(value => observed.push({ kind: 'deliver', value }), error => observed.push({ kind: 'refused', message: error.message }));
    throw new Error('model stopped after refusal');
  }];
  const host = await p1Runtime(root, { turns });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: 'aaaaaaaa-0000-4000-8000-000000000003', title: '文本冒充交付', wish: '生成代码文本即算交付。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: 'bbbbbbbb-0000-4000-8000-000000000004', wish: created.goal } });
  const project = await settle(host, created.id);

  assert.match(observed.find(row => row.kind === 'refused').message, /Missing actual code modifications or successful build\/test\/run evidence/);
  assert.equal(project.status, 'failed');
  assert.equal(project.changes[0].status, 'failed');
  assert.equal(project.releases.length, 0);
  assert.equal(project.builds.length, 0);
  assert.equal(project.versions[0].status, 'Planned');
  assert.equal(project.evidence.length, 0);
  assert.match(project.changes[0].result, /开发未交付/);
  assert.equal(host.scripted.state.concluded, 0);
});

test('a failing command blocks delivery and keeps the real nonzero exit as evidence', async t => {
  const root = await temporary(t);
  const observed = [];
  const turns = [planTurn(observed), async ({ tool }) => {
    const { workspace } = await tool('wish_state', {});
    await tool('write', { path: 'app.js', content: APP, workdir: workspace });
    await tool('wish_verify', { kind: 'build', command: 'node --check app.js', description: 'build' });
    observed.push({ kind: 'failed-test', value: await tool('wish_verify', { kind: 'test', command: 'node -e "process.exit(9)"', description: 'failing test' }) });
    await tool('wish_verify', { kind: 'run', command: 'node app.js', description: 'run' });
    await tool('wish_deliver', { startCommand: 'node app.js', summary: '不应交付' });
  }];
  const host = await p1Runtime(root, { turns });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: 'aaaaaaaa-0000-4000-8000-000000000005', title: '失败测试', wish: '必须有测试。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: 'bbbbbbbb-0000-4000-8000-000000000006', wish: created.goal } });
  const project = await settle(host, created.id);

  const failed = observed.find(row => row.kind === 'failed-test').value;
  assert.equal(failed.success, false);
  assert.equal(failed.exitCode, 9);
  const test = project.evidence.find(row => row.kind === 'test');
  assert.equal(test.success, false);
  assert.equal(test.exitCode, 9);
  assert.equal(project.evidence.filter(row => row.kind === 'build')[0].success, true);
  assert.equal(project.releases.length, 0);
  assert.equal(project.builds.length, 0);
  assert.equal(project.changes[0].status, 'failed');
  assert.equal(project.versions[0].status, 'Planned');
});

test('a failed change can be retried, and a second wish evolves the same product into a second version', async t => {
  const root = await temporary(t);
  const observed = [];
  let attempt = 0;
  const turns = [planTurn(observed), async context => {
    attempt += 1;
    if (attempt === 1) { await context.tool('wish_deliver', { startCommand: 'node app.js', summary: '第一次未验证。' }); return; }
    const state = await context.tool('wish_state', {});
    observed.push({ kind: 'retry-state', value: state.requirements.map(row => row.confirmation), releases: state.releases.length });
    await happyCodeTurn(observed)(context);
  }];
  const host = await p1Runtime(root, { turns });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: 'aaaaaaaa-0000-4000-8000-000000000007', title: '两轮演化', wish: '做一个待办事项应用。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: 'bbbbbbbb-0000-4000-8000-000000000008', wish: created.goal } });
  const failed = await settle(host, created.id);
  assert.equal(failed.changes[0].status, 'failed');
  assert.equal(failed.releases.length, 0);

  const retried = await host.call('retry', { input: { projectId: created.id, expectedRevision: failed.revision, requestId: 'bbbbbbbb-0000-4000-8000-000000000009', changeId: failed.changes[0].id, acknowledgeUncertain: false } });
  assert.equal(retried.changes.length, 2);
  assert.equal(retried.changes[1].retryOf, failed.changes[0].id);
  assert.equal(retried.changes[1].attempt, 2);
  assert.equal(retried.changes[0].status, 'failed');
  const first = await settle(host, created.id);

  assert.equal(first.status, 'delivered');
  assert.equal(first.changes[1].status, 'completed');
  assert.equal(first.releases.length, 1);
  assert.equal(first.releases[0].changeId, first.changes[1].id);
  assert.deepEqual(first.versions.map(row => [row.status, row.changeId === first.changes[1].id]), [['Planned', false], ['Released', true]]);
  assert.equal(first.requirements.filter(row => row.confirmation === 'confirmed').length, 2);
  assert.ok(first.requirements.some(row => row.text === created.goal && row.source.ref === first.changes[1].id));
  const retryState = observed.find(row => row.kind === 'retry-state');
  // Re-planning records this attempt's own inferred facts while the confirmed ones stay first and intact.
  assert.equal(retryState.value.filter(row => row === 'confirmed').length, 2);
  assert.equal(retryState.value[0], 'confirmed');
  assert.deepEqual([...new Set(retryState.value.filter(row => row !== 'confirmed'))], ['inferred']);
  assert.equal(retryState.releases, 0);
  assert.ok(first.history.some(row => row.action === 'link-retry'));
  assert.equal(host.scripted.state.createCount, 2);

  // Round two: a new wish on the SAME product modifies the same sources and delivers a second version.
  const snapshotBefore = first.releases[0].snapshotPath;
  const submitted = await host.call('submit', { input: { projectId: first.id, expectedRevision: first.revision, requestId: 'bbbbbbbb-0000-4000-8000-00000000000a', wish: '给待办事项增加优先级，并且能够按优先级筛选。' } });
  assert.equal(submitted.changes.length, 3);
  assert.equal(submitted.changes[2].status, 'pending');
  const second = await settle(host, created.id);

  assert.equal(second.changes[2].status, 'completed');
  assert.equal(second.releases.length, 2);
  assert.equal(second.versions.length, 3);
  assert.deepEqual(second.versions.filter(row => row.status === 'Released').length, 2);
  assert.notEqual(second.releases[1].snapshotPath, snapshotBefore);
  assert.equal(second.releases[1].changeId, second.changes[2].id);
  assert.equal(second.requirements.filter(row => row.confirmation === 'confirmed').length, 3);
  assert.ok(second.requirements.some(row => row.confirmation === 'confirmed' && row.text === created.goal));
  assert.ok(second.requirements.some(row => row.confirmation === 'confirmed' && row.text.includes('优先级')));
  assert.equal(second.currentWish, '给待办事项增加优先级，并且能够按优先级筛选。');
  assert.equal(second.builds.filter(row => row.status === 'passed').length, 2);
  assert.ok(second.artifacts.every((row, index, list) => index === 0 || row.path !== list[index - 1].path));
  assert.equal(host.scripted.state.createCount, 3);
  assert.equal(host.scripted.state.disposed, 3);

  await assert.rejects(host.call('retry', { input: { projectId: created.id, expectedRevision: second.revision, requestId: 'bbbbbbbb-0000-4000-8000-00000000000c', changeId: second.changes[2].id } }), { code: 'wish-willow-p1/not-retryable' });
  await assert.rejects(host.call('submit', { input: { projectId: created.id, expectedRevision: second.revision - 1, requestId: 'bbbbbbbb-0000-4000-8000-00000000000d', wish: '基于旧版本的提交。' } }), { code: 'wish-willow-p1/conflict' });
});

test('retry is bounded to three attempts and never silently repeats', async t => {
  const root = await temporary(t);
  const observed = [];
  const turns = [planTurn(observed), async context => {
    await context.tool('wish_deliver', { startCommand: 'node app.js', summary: '永远不验证。' });
  }];
  const host = await p1Runtime(root, { turns });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: 'aaaaaaaa-0000-4000-8000-00000000000f', title: '重试预算', wish: '总是失败。' } });
  let project = await host.call('read', { input: { projectId: created.id } });
  project = await host.call('submit', { input: { projectId: created.id, expectedRevision: project.revision, requestId: 'bbbbbbbb-0000-4000-8000-000000000010', wish: created.goal } });
  project = await settle(host, created.id);
  assert.equal(project.changes[0].status, 'failed');
  for (const attempt of [2, 3]) {
    project = await host.call('retry', { input: { projectId: created.id, expectedRevision: project.revision, requestId: `cccccccc-0000-4000-8000-00000000000${attempt}`, changeId: project.changes.at(-1).id } });
    assert.equal(project.changes.at(-1).attempt, attempt);
    project = await settle(host, created.id);
    assert.equal(project.changes.at(-1).status, 'failed');
  }
  assert.equal(project.changes.length, 3);
  await assert.rejects(host.call('retry', { input: { projectId: created.id, expectedRevision: project.revision, requestId: 'cccccccc-0000-4000-8000-000000000004', changeId: project.changes.at(-1).id } }), { code: 'wish-willow-p1/retry-budget' });
  assert.equal(host.scripted.state.createCount, 3);
  assert.equal(project.releases.length, 0);
});

test('the Host bounds execution with steps and marks the change failed instead of looping', async t => {
  const root = await temporary(t);
  const observed = [];
  const host = await p1Runtime(root, { maxSteps: 1, turns: [planTurn(observed), happyCodeTurn(observed)] });
  t.after(host.close);
  const created = await host.call('create', { input: { requestId: 'aaaaaaaa-0000-4000-8000-00000000000d', title: '预算受限', wish: '受步骤预算限制。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: 'bbbbbbbb-0000-4000-8000-00000000000e', wish: created.goal } });
  const project = await settle(host, created.id);

  assert.equal(project.changes[0].status, 'failed');
  assert.equal(project.releases.length, 0);
  assert.equal(project.tasks.filter(row => row.phase === 'plan')[0].status, 'completed');
  assert.equal(project.tasks.filter(row => row.phase === 'code')[0].status, 'failed');
  assert.equal(host.scripted.state.concluded, 0);
  assert.equal(project.runs.length, 1);
  assert.equal(project.runs[0].status, 'failed');
});
