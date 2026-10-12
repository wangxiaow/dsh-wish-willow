import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { temporary } from '../helpers/temp.mjs';
import { createFixtureRunner } from '../helpers/runner.mjs';
import { unifiedRuntime } from '../helpers/unified-runtime.mjs';
import { settle } from '../helpers/p1-runtime.mjs';
import { passingFixtureReview } from '../helpers/p2-reviewer.mjs'; // explicit plumbing fixture; F1 assertions remain intact

const planTurn = async ({ tool }) => {
  await tool('wish_state', {});
  await tool('wish_plan', { requirements: ['可以通过 PowerShell 启动'], constraints: ['仅本地运行，不部署公网服务'], decisions: [],
    tasks: [{ description: '实现静态网页、启动脚本与验证', category: 'technical' }] });
};

/** The F1 delivery shape: a static page whose only documented entry point is a .ps1 script. */
const codeTurn = ({ startCommand, extra = {} }) => async ({ tool }) => {
  const { workspace } = await tool('wish_state', {});
  await tool('write', { path: 'index.html', content: '<!doctype html>\n<title>Hello World</title>\n<h1>Hello World</h1>\n', workdir: workspace });
  await tool('write', { path: 'start.ps1', content: 'param([int]$Port = 8080)\nWrite-Output "serving on $Port"\nexit 0\n', workdir: workspace });
  await tool('write', { path: 'app.js', content: 'console.log("ok")\n', workdir: workspace });
  await tool('write', { path: '.env', content: 'WISH_WILLOW_TEST_SECRET=do-not-ship\n', workdir: workspace });
  for (const [name, content] of Object.entries(extra)) await tool('write', { path: name, content, workdir: workspace });
  await tool('wish_verify', { kind: 'build', command: 'node --check app.js', description: 'build' });
  await tool('wish_verify', { kind: 'test', command: 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\start.ps1', description: 'test' });
  await tool('wish_verify', { kind: 'run', command: 'node app.js', description: 'run' });
  return tool('wish_deliver', { startCommand, summary: '静态网页与 PowerShell 启动脚本已交付。' });
};

const submit = async (host, requestIds, title) => {
  const created = await host.call('create', { input: { requestId: requestIds[0], title, wish: '创建一个可以通过 PowerShell 启动的简单本地网页应用，提供启动脚本。' } });
  await host.call('submit', { input: { projectId: created.id, expectedRevision: created.revision, requestId: requestIds[1], wish: created.goal } });
  return created.id;
};

test('a delivery whose entry point is a PowerShell script is snapshotted, gated and released', async t => {
  const root = await temporary(t);
  const host = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns: [planTurn, codeTurn({ startCommand: 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\start.ps1' })] });
  t.after(host.close);
  const projectId = await submit(host, ['d1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002'], 'PowerShell 启动的网页应用');
  const project = await settle(host, projectId);

  assert.equal(project.status, 'delivered');
  assert.equal(project.releases.length, 1);
  const release = project.releases[0];
  assert.equal(release.startCommand, 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\start.ps1');

  // (1) The snapshot carries the PowerShell entry point and records every exclusion.
  const snapshotArtifact = project.artifacts.find(row => row.kind === 'source-snapshot');
  const manifest = JSON.parse(await readFile(snapshotArtifact.path, 'utf8'));
  assert.equal(manifest.format, 2);
  assert.equal(manifest.complete, true);
  assert.deepEqual(manifest.entries.map(row => row.path).sort(), ['app.js', 'index.html', 'start.ps1']);
  assert.ok(manifest.excluded.some(row => row.path === '.env' && row.reason === 'credential-file'));
  assert.equal((await readFile(join(release.snapshotPath, 'start.ps1'), 'utf8')).includes('serving on'), true);

  // (2) The delivery integrity report is a durable, hashable artifact of the release.
  const integrityArtifact = project.artifacts.find(row => row.kind === 'delivery-manifest');
  assert.ok(integrityArtifact, 'the release must carry its delivery integrity report');
  assert.equal(project.builds[0].artifactIds.length, 2);
  const integrity = JSON.parse(await readFile(integrityArtifact.path, 'utf8'));
  assert.equal(integrity.ok, true);
  assert.equal(integrity.startEntry, 'start.ps1');
  assert.deepEqual(integrity.references, ['start.ps1']);
  assert.equal(integrity.replay.status, 'passed');
  assert.deepEqual(integrity.replay.commands.map(row => row.kind).sort(), ['build', 'run', 'start', 'test']);
  assert.ok(integrity.checks.every(row => row.ok));
  assert.equal(integrity.excludedCount, manifest.excludedCount);

  // (3) The snapshot was restored outside the product working directory, and the replay ran there,
  //     never inside the Coding Agent's own workspace.
  assert.equal(existsSync(integrity.restorePath), true);
  assert.equal(integrity.restorePath.startsWith(join(project.workspace, '..')), false);
  assert.equal(integrity.replayPath, integrity.restorePath, 'the replay runs in the independent copy itself');
  assert.equal(integrity.replayPath.startsWith(project.workspace), false, 'the replay never runs inside the product workspace');
  assert.equal(existsSync(join(project.workspace, '.wish-willow')), false, 'nothing is materialized inside the product workspace');
  assert.deepEqual((await readdir(integrity.restorePath)).sort(), ['app.js', 'index.html', 'start.ps1']);
  assert.equal(integrity.dependencies.policy, 'dependency-free-runtime');
  for (const row of integrity.replay.commands) {
    assert.equal(row.workdir, integrity.replayPath);
    assert.equal(row.status, 'passed', `${row.kind}: ${row.status}`);
  }
  // The isolated replay must not have been answered from the original product directory.
  for (const row of integrity.replay.commands) {
    if (row.kind === 'start') continue;
    assert.equal(row.command.includes(`-LiteralPath '${project.workspace}'`), false, row.command);
  }

  // (4) The persisted product explains the gate to the user, and the console helper never leaks an excluded secret.
  const codeEvidence = project.evidence.find(row => row.kind === 'code');
  assert.match(codeEvidence.summary, /交付完整性门禁通过/);
  assert.match(codeEvidence.summary, /start\.ps1/);
  assert.equal(JSON.stringify(project).includes('do-not-ship'), false);
});

test('a start command naming a file that was never delivered refuses the release instead of shipping it', async t => {
  const root = await temporary(t);
  const host = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns: [planTurn, codeTurn({ startCommand: 'powershell -NoProfile -ExecutionPolicy Bypass -File .\\missing-start.ps1' })] });
  t.after(host.close);
  const projectId = await submit(host, ['d2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002'], '缺少启动入口');
  const project = await settle(host, projectId);

  assert.equal(project.status, 'failed');
  assert.equal(project.releases.length, 0);
  assert.equal(project.builds.length, 0);
  assert.equal(project.versions[0].status, 'Planned');
  assert.match(project.changes[0].result, /开发未交付/);
  assert.match(project.changes[0].result, /missing-start\.ps1/);
  assert.match(project.changes[0].result, /start command/);
  const refusal = project.evidence.find(row => row.kind === 'code' && row.success === false);
  assert.ok(refusal, 'the refused release must leave a durable reason');
  assert.match(refusal.summary, /交付完整性门禁拒绝 Release/);
  assert.match(refusal.summary, /missing-start\.ps1/);
  assert.equal(project.evidence.some(row => row.kind === 'run' && row.success && row.exitCode === 0), true, 'the real verification evidence is still kept');
});

test('a start command pointing into a directory the policy excludes states the exclusion reason', async t => {
  const root = await temporary(t);
  const host = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns: [planTurn, codeTurn({
    startCommand: 'node build\\server.js',
    extra: { 'build/server.js': 'console.log("built")\n' },
  })] });
  t.after(host.close);
  const projectId = await submit(host, ['d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002'], '被排除的构建目录入口');
  const project = await settle(host, projectId);

  assert.equal(project.status, 'failed');
  assert.equal(project.releases.length, 0);
  assert.match(project.changes[0].result, /build\/server\.js/);
  assert.match(project.changes[0].result, /dependency-or-build-directory/);
});

test('a failing isolated replay blocks the release even though the original verification passed', async t => {
  const root = await temporary(t);
  // The delivery secretly depends on a file that the delivery policy does not ship
  // (`node_modules/marker.txt`). The recorded test command passes in the original directory and
  // must fail in the isolated snapshot copy, which is exactly what the gate has to catch.
  const turns = [planTurn, async ({ tool }) => {
    const { workspace } = await tool('wish_state', {});
    await tool('write', { path: 'index.html', content: '<title>Hello World</title>\n', workdir: workspace });
    await tool('write', { path: 'start.ps1', content: 'Write-Output "up"\nexit 0\n', workdir: workspace });
    await tool('write', { path: 'app.js', content: 'console.log("ok")\n', workdir: workspace });
    await tool('write', { path: 'node_modules/marker.txt', content: 'not part of the delivery\n', workdir: workspace });
    const marker = join(workspace, 'node_modules', 'marker.txt');
    await tool('wish_verify', { kind: 'build', command: 'node --check app.js', description: 'build' });
    await tool('wish_verify', { kind: 'test', command: `powershell -NoProfile -Command "if (Test-Path -LiteralPath '${marker}') { exit 0 } else { exit 1 }"`, description: 'test' });
    await tool('wish_verify', { kind: 'run', command: 'node app.js', description: 'run' });
    return tool('wish_deliver', { startCommand: 'node app.js', summary: '不应交付' });
  }];
  const host = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns });
  t.after(host.close);
  const projectId = await submit(host, ['d4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000002'], '非自包含交付');
  const project = await settle(host, projectId);

  assert.equal(project.changes[0].status, 'failed');
  assert.equal(project.releases.length, 0);
  assert.equal(project.evidence.some(row => row.kind === 'test' && row.success && row.exitCode === 0), true, 'the original verification really passed');
  const refusal = project.evidence.find(row => row.kind === 'code' && row.success === false);
  assert.ok(refusal, 'the refused release must leave a durable reason');
  assert.match(refusal.summary, /交付完整性门禁拒绝 Release/);
  assert.match(refusal.summary, /recorded test command succeeds in the isolated snapshot copy/);
});

test('a missing verification command cannot be replayed, so a release without real evidence stays refused', async t => {
  const root = await temporary(t);
  const host = await unifiedRuntime(root, { commandRunner: createFixtureRunner({ root }), reviewTurn: passingFixtureReview, turns: [planTurn, async ({ tool }) => {
    const { workspace } = await tool('wish_state', {});
    await tool('write', { path: 'index.html', content: '<title>Hello World</title>\n', workdir: workspace });
    await tool('write', { path: 'start.ps1', content: 'Write-Output "up"\nexit 0\n', workdir: workspace });
    await tool('wish_verify', { kind: 'build', command: 'node --check start.ps1', description: 'build' });
    await tool('write', { path: 'index.html', content: '<title>Hello World</title>\n', workdir: workspace });
    return tool('wish_deliver', { startCommand: 'powershell -File .\\start.ps1', summary: '证据不足' });
  }] });
  t.after(host.close);
  const projectId = await submit(host, ['d5000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002'], '缺少三类证据');
  const project = await settle(host, projectId);
  assert.equal(project.releases.length, 0);
  assert.match(project.changes[0].result, /Missing actual code modifications or successful build\/test\/run evidence/);
});
