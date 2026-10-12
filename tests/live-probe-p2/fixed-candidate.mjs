// Internal opt-in acceptance preparation only. No Remote registration or configurable source/command API.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy';
import { setApprovalPolicy } from '@deepseek-ai/dsh-user-approval';
import { detectCredentialContent } from '../../packages/p1/src/artifacts.js';
import { commandPassed, listSnapshotFiles } from '../../packages/p1/src/delivery.js';
import { isolatedCommand } from '../../packages/p1/src/delivery-runner.js';
import { prepareReviewCandidate } from '../../packages/p1/src/reviewer.js';
import { assertNoLinks, within } from '../helpers/isolation.mjs';
import { contract, commands, startCommand, fixedInputs, inputLedger, sha256 } from './inputs.mjs';
const now = () => new Date().toISOString();

export async function absent(file) {
  await assertNoLinks(file);
  try { await lstat(file); throw Error('Acceptance target already exists; retain it and stop'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
export async function writeRecord(file, value) {
  await assertNoLinks(file);
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (bytes.length > 1000000 || detectCredentialContent(bytes)) throw Error('Audit is too large or contains credential material');
  await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  assert.deepEqual(await readFile(file), bytes);
  return { path: file, bytes: bytes.length, sha256: sha256(bytes) };
}
function auditFiles(directory) {
  const entries = [], ids = new Set();
  return {
    async append(value) {
      if (value.source !== 'dsh-tool-pipeline' || ids.has(value.callId) || entries.length >= 12) throw Error('Unexpected or duplicate native tool audit');
      ids.add(value.callId);
      const record = await writeRecord(path.join(directory, `${value.callId}.json`), { ...value, recordedAt: now() });
      entries.push({ ...record, value: structuredClone(value) });
    },
    async read() {
      const values = [];
      for (const entry of entries) {
        await assertNoLinks(entry.path);
        const bytes = await readFile(entry.path);
        if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.bytes) throw Error('Native tool audit changed');
        const value = JSON.parse(bytes.toString('utf8'));
        const { recordedAt: _at, ...body } = value;
        assert.deepEqual(body, entry.value);
        values.push(value);
      }
      return values;
    },
  };
}
async function persistedToolOnly(ctx, agent, workspace) {
  if (ctx.agents.get(agent.id) || ctx.sessions.get(agent.id)) throw Error('Writer remains live after disposal');
  const log = await ctx.sessionQuery.readSession(agent.id); // persistence, not live-preferred data
  if (log.session.id !== agent.id || log.session.cwd !== workspace || log.session.isSeeded !== false ||
      log.session.parentSession !== undefined || log.events.some(e => e.type.startsWith('assistant/') || e.type.startsWith('request/'))) throw Error('No verifiable persisted tool-only Session');
  return { sessionId: agent.id, session: log.session, events: log.events, disposedAt: now(), modelCalls: 0 };
}

// This entry accepts only a fixed integer index and owned run directory, never files/results/verdict/completion.
export async function prepareFixedCandidate(service, index, home, evidence, signal, checkAcceptanceHome) {
  if (![0, 1].includes(index)) throw Error('Only the two confirmed fixed inputs are supported');
  if (typeof checkAcceptanceHome !== 'function') throw Error('Missing pre-boot owned Home protection context');
  home = await checkAcceptanceHome(home);
  const { orchestrator, store } = service, ctx = orchestrator.ctx;
  assert.equal(orchestrator.config.workspaceRoot, path.join(home, 'wish-willow'));
  if (!within(path.join(home, 'evidence'), evidence) || !path.basename(home).startsWith('wish-willow-p2-c-')) throw Error('Not the explicitly owned C acceptance scope');
  await assertNoLinks(evidence);
  const inputs = await fixedInputs(), input = inputs[index];
  const claimFile = path.join(home, 'c-prepare-started.json'); await assertNoLinks(claimFile);
  const claim = JSON.parse(await readFile(claimFile, 'utf8'));
  assert.equal(claim.evidence, evidence); assert.deepEqual(claim.inputLedger, inputLedger(inputs));
  // Durable once-per-fixed-input admission, retained even if creation/execution fails.
  await writeRecord(path.join(evidence, `preparation-claim-${index}.json`), { source: 'authorized-fixed-tool-only', input: index, inputLedger: inputLedger(inputs) });
  const project = await store.create({ requestId: randomUUID(), title: 'Local arithmetic module', wish: contract });
  const submitted = await store.submit({ projectId: project.id, requestId: randomUUID(), expectedRevision: project.revision, wish: contract });
  const changeId = submitted.changes.at(-1).id, runId = randomUUID(), sessionId = `wish-fixed-${randomUUID()}`;
  const directory = path.join(evidence, project.id);
  await absent(directory); await mkdir(directory);
  const preparationAudit = auditFiles(directory), replayAudit = auditFiles(directory);
  const mutate = (action, fn) => store.mutate(project.id, action, { kind: 'runtime', ref: runId }, fn);
  const operation = { handle: null, controller: new AbortController(), promise: null };
  const abort = () => { operation.controller.abort(); operation.handle?.agent.cancel({ kind: 'user' }); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  if (orchestrator.closing || orchestrator.isActive(project.id)) throw Error('Production Host is busy or closing');
  let handle, owner, scope, phase = 'write', invocation = 0, failure, started = Date.now();
  const observed = new Map(), jobs = new Set();
  operation.promise = (async () => {
    try {
      operation.controller.signal.throwIfAborted();
      await absent(project.workspace); await mkdir(project.workspace, { recursive: true }); await assertNoLinks(project.workspace);
      const model = ctx.agentDefaultModel.currentSelection(), preset = await ctx.agentPresets.resolve();
      if (preset.broken) throw Error('Default preset unavailable');
      handle = await ctx.agents.create({ sessionId, signal: operation.controller.signal, agentOptions: model,
        meta: { cwd: project.workspace, agentPreset: preset.id }, setup: async (agentCtx, agent) => {
          scope = agentCtx; owner = agent;
          await ctx.agentPresets.mount(agentCtx, preset.id);
          if (agent.id !== sessionId || agent.session.header.parentSession !== undefined || agent.session.header.isSeeded !== false || agent.session.header.cwd !== project.workspace) throw Error('Preparation Session is not fresh');
          setSandboxMode(agent.session, ctx.sandboxPolicy.defaultMode === 'read-only' ? 'read-only' : 'workspace-write');
          setApprovalPolicy(agent.session, 'never');
          agentCtx.tools.restrict({ allow: ['write', 'pwsh', 'job_kill', 'job_output'] });
          agentCtx.on('agent/pre-step', async () => ({ kind: 'reject' })); // never followup, never a model Coder turn
          agentCtx.tools.guard(exec => {
            if (exec.agent !== agent || exec.arguments?.sandbox_permissions !== undefined) return 'Fixed preparation cannot expand authority';
            if (phase === 'cleanup' && ['job_kill', 'job_output'].includes(exec.name) && jobs.has(exec.arguments?.job_id)) return;
            if (operation.controller.signal.aborted || ++invocation > 6) return 'Fixed preparation tool budget exhausted or cancelled';
            if (phase === 'write' && exec.name === 'write') {
              const file = input.files.find(f => exec.arguments?.file_path === path.join(project.workspace, f.name));
              if (file && exec.arguments.content === file.content && Object.keys(exec.arguments).length === 2) return;
            }
            if (phase === 'verify' && exec.name === 'pwsh' && /^wish-check-[0-9a-f-]{36}$/i.test(exec.callId) &&
              commands.some(([, command]) => exec.arguments?.command === isolatedCommand(command)) &&
              exec.arguments?.workdir === project.workspace && exec.arguments?.timeoutMs === 120000 &&
              Object.keys(exec.arguments).every(k => ['command', 'description', 'workdir', 'timeoutMs'].includes(k))) return;
            return 'Only the exact three writes and three foreground commands are authorized';
          });
          agentCtx.on('tools/result', (exec, result) => {
            if (exec.agent !== agent || observed.has(exec.callId)) { failure = Error('Unexpected native tool observer identity'); return; }
            if (exec.name === 'pwsh' && result.value?.jobId) jobs.add(result.value.jobId);
            observed.set(exec.callId, { exec, result });
          });
        } });
      operation.handle = handle;
      await mutate('start-fixed-tool-preparation', p => {
        p.changes.find(c => c.id === changeId).status = 'running';
        p.runs.push({ id: runId, changeId, sessionId, startedAt: now(), status: 'running', modelCalls: 0, toolCalls: 0, failures: 0,
          reason: '来源 fixed-tool-only；执行用户确认固定输入，不是模型 Coder turn。' });
        const plan = p.tasks.find(t => t.changeId === changeId && t.phase === 'plan'); plan.status = 'completed';
        plan.result = 'User-confirmed fixed input; no inferred Coding plan.';
        for (const phaseName of ['code', 'verify', 'deliver']) p.tasks.push({ id: randomUUID(), projectId: p.id, changeId,
          description: `Fixed local preparation: ${phaseName}`, category: 'technical', phase: phaseName, dependencies: [plan.id], status: 'pending', evidenceIds: [], runId });
      });
      await ctx.agents.withInitiator(owner, async () => {
        for (const file of input.files) {
          const callId = `wish-fixed-call-${randomUUID()}`;
          const args = { file_path: path.join(project.workspace, file.name), content: file.content };
          const result = await scope.tools.execute({ callId, name: 'write', arguments: args, agent: owner, signal: operation.controller.signal });
          const actual = observed.get(callId);
          if (failure || !actual || actual.result !== result || !Object.isFrozen(result)) throw failure ?? Error('Write has no genuine final tool outcome');
          assert.deepEqual(actual.exec.arguments, args);
          await preparationAudit.append({ source: 'dsh-tool-pipeline', sessionId, callId, name: 'write', arguments: actual.exec.arguments, result });
          observed.delete(callId);
          if (result.isError) throw Error('Actual write failed; native audit retained');
        }
        phase = 'verify';
        for (const [kind, command] of commands) {
          let native;
          const verified = await orchestrator.verifyCommand({ project, changeId, runId, sessionId,
            input: { kind, command: isolatedCommand(command), description: `Verify local arithmetic ${kind}` }, agentCtx: scope, agent: owner,
            exec: { signal: operation.controller.signal }, mutate, audit: async value => {
              const actual = observed.get(value.callId);
              if (failure || !actual || actual.result !== value.result || actual.exec.name !== 'pwsh' || !Object.isFrozen(value.result)) throw failure ?? Error('Validation lacks a matching native final observer');
              assert.deepEqual(actual.exec.arguments, value.arguments);
              await preparationAudit.append(value); native = value.result; observed.delete(value.callId);
            } });
          if (!verified.success || !native || native.isError || !commandPassed(native.value)) throw Error('Actual foreground validation failed; retain native audit and stop');
        }
      });
      phase = 'closed';
      operation.controller.signal.throwIfAborted();
      if (failure || observed.size || jobs.size || invocation !== 6 || await ctx.sessions.flush(owner.session) !== true) throw failure ?? Error('Preparation has no complete durable outcome');
      await handle.dispose(); handle = undefined; operation.handle = null;
      const writer = await persistedToolOnly(ctx, owner, project.workspace);
      const calls = await preparationAudit.read();
      if (calls.length !== 6 || calls.some(c => c.result.isError)) throw Error('Preparation audit incomplete');
      const delivery = await orchestrator.stageDelivery({ projectId: project.id, changeId, runId, sessionId, model, preset,
        input: { startCommand, summary: 'Confirmed local arithmetic input prepared through actual tools; source fixed-tool-only, not a model Coder turn.' },
        wroteCode: calls.filter(c => c.name === 'write').length === 3, signal: operation.controller.signal, mutate,
        replayAudit: value => replayAudit.append(value), fixedPreparation: async (snapshot, replay) => {
          const expected = input.files.map(({ content: _content, name, ...file }) => ({ path: name, ...file })).sort((a, b) => a.path.localeCompare(b.path));
          const entries = snapshot.manifest.entries.map(({ content: _content, ...e }) => e);
          assert.deepEqual(entries, expected);
          assert.deepEqual(await listSnapshotFiles(project.workspace), input.files.map(f => f.name).sort());
          for (const file of input.files) {
            await assertNoLinks(path.join(project.workspace, file.name));
            if (sha256(await readFile(path.join(project.workspace, file.name))) !== file.sha256) throw Error('Stopped writer bytes changed');
          }
          const nativeReplay = await replayAudit.read();
          if (nativeReplay.length !== 4 || nativeReplay.some(c => c.name !== 'pwsh' || c.result.isError || !commandPassed(c.result.value) || c.sessionId !== replay.sessionId)) throw Error('Replay audit incomplete or non-foreground');
          if (nativeReplay.some((c, i) => c.arguments.command !== isolatedCommand(i < 3 ? isolatedCommand(commands[i][1]) : startCommand))) throw Error('Replay command identity changed');
          return { source: 'fixed-tool-only', inputs: expected, writer, calls, replay: { ...replay, calls: nativeReplay } };
        } });
      await mutate('finish-fixed-tool-preparation', p => {
        Object.assign(p.runs.find(r => r.id === runId), { status: 'completed', endedAt: now(), durationMs: Date.now() - started,
          toolCalls: calls.length, failures: 0, reason: 'fixed-tool-only：真实 writes/foreground 证据已审计，Session 持久且写入者已 dispose；独立 replay 通过。无模型 Coder turn。' });
      });
      const prepared = await prepareReviewCandidate(store.read(project.id), delivery, orchestrator.config.workspaceRoot);
      await store.registerCandidate(project.id, prepared.candidate, prepared.materialsArtifact);
      return { projectId: project.id, candidateId: prepared.candidate.id, binding: prepared.candidate.binding, auditDirectory: directory };
    } catch (error) {
      phase = 'closed';
      if (owner) { try { await ctx.sessions.flush(owner.session); } catch { /* retain original failure */ } }
      await mutate('fixed-preparation-failed', p => {
        p.status = 'failed'; const change = p.changes.find(c => c.id === changeId); change.status = 'failed'; change.result = 'Fixed preparation failed; native audit retained, no automatic retry.';
        const run = p.runs.find(r => r.id === runId); if (run) Object.assign(run, { status: 'failed', endedAt: now(), failures: 1, reason: '真实准备未能形成可靠完成证明；无自动重试。' });
        for (const task of p.tasks.filter(t => t.changeId === changeId && ['pending', 'running'].includes(t.status))) task.status = 'failed';
      }); throw error;
    } finally {
      try {
        if (handle && jobs.size) {
          phase = 'cleanup';
          for (const jobId of jobs) {
            for (const [name, argumentsValue] of [['job_kill', { job_id: jobId, reason: 'Fixed acceptance validation stopped' }],
              ['job_output', { job_id: jobId, wait: true, timeout_ms: 15000 }]]) {
              const callId = `wish-fixed-cleanup-${randomUUID()}`;
              const result = await scope.tools.execute({ callId, name, arguments: argumentsValue, agent: owner, signal: AbortSignal.timeout(15000) });
              const actual = observed.get(callId);
              if (!actual || actual.result !== result) throw Error('Cleanup has no matching native observer');
              await preparationAudit.append({ source: 'dsh-tool-pipeline', sessionId, callId, name, arguments: actual.exec.arguments, result });
              observed.delete(callId);
              if (name === 'job_output' && (result.isError || !['completed', 'failed', 'killed'].includes(result.value?.job?.status))) throw Error('Preparation-owned job stop is unverified');
            }
          }
        }
      } finally {
        try { if (owner && handle) await ctx.sessions.flush(owner.session); }
        finally { try { await handle?.dispose(); } finally { operation.handle = null; signal.removeEventListener('abort', abort); } }
      }
    }
  })();
  orchestrator.active.set(project.id, operation);
  try { return await operation.promise; } finally { orchestrator.active.delete(project.id); }
}
