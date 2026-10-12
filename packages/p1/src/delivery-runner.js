import { randomUUID } from 'node:crypto';
import { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy';
import { setApprovalPolicy } from '@deepseek-ai/dsh-user-approval';
import { assertPlainPath } from './artifacts.js';
import { commandPassed, validateHealthCheck } from './delivery.js';

const quote = value => `'${String(value).replaceAll("'", "''")}'`;
// The isolated copy must not inherit the Host's module search configuration; an empty NODE_PATH
// and a cleared NODE_OPTIONS keep a preload or a stray path list out of the replayed command.
export const isolatedCommand = command => `$ErrorActionPreference='Stop'; $env:NODE_PATH=''; $env:NODE_OPTIONS=''; $global:LASTEXITCODE=0; ${command}\nif ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }`;

/** Tool-only validation session; no followup/model call, no new execution backend or wider mode. */
export function createReplayRunner(ctx, { workspace, model, preset, signal, redact = value => String(value).slice(0, 9000), audit }) {
  let handle, scope, owner, creating, closed = false;
  const observed = new Map();
  const admitted = new Set(), jobs = new Set();
  const ensure = async () => {
    if (!creating) creating = (async () => {
      await assertPlainPath(workspace);
      handle = await ctx.agents.create({ sessionId: `wish-replay-${randomUUID()}`, agentOptions: model, ...(audit ? { signal } : {}),
        meta: { cwd: workspace, agentPreset: preset.id },
        setup: async (agentCtx, agent) => {
          scope = agentCtx; owner = agent;
          await ctx.agentPresets.mount(agentCtx, preset.id);
          setSandboxMode(agent.session, ctx.sandboxPolicy.defaultMode === 'read-only' ? 'read-only' : 'workspace-write');
          setApprovalPolicy(agent.session, 'never');
          // Job completion must not wake an LLM in this tool-only scope.
          agentCtx.on('agent/pre-step', async () => ({ kind: 'reject' }));
          if (audit) agentCtx.on('tools/result', (exec, result) => {
            if (exec.agent !== agent || !admitted.has(exec.callId) || observed.has(exec.callId)) return;
            observed.set(exec.callId, { exec, result });
          });
          agentCtx.tools.guard(exec => {
            if (!admitted.has(exec.callId) || !['pwsh', 'job_output', 'job_kill'].includes(exec.name)) return 'Host-owned delivery validation calls only';
            if (exec.arguments?.sandbox_permissions !== undefined) return 'Delivery validation cannot widen permissions';
            if (exec.name === 'pwsh' && exec.arguments?.workdir !== workspace) return 'Delivery validation must stay in its independent copy';
            if (exec.name !== 'pwsh' && !jobs.has(exec.arguments?.job_id)) return 'Not a delivery-owned job';
          });
        },
      });
    })();
    await creating;
  };
  const call = async (name, args, callSignal = signal) => {
    if (closed) throw Error('Delivery validation runner is closed');
    await ensure();
    const callId = `wish-replay-call-${randomUUID()}`;
    admitted.add(callId);
    try {
      const result = await scope.tools.execute({ callId, name, arguments: args, agent: owner,
        signal: callSignal ?? new AbortController().signal });
      if (name === 'pwsh' && !result.isError && result.value?.jobId) jobs.add(result.value.jobId);
      if (audit) {
        const actual = observed.get(callId);
        if (!actual || actual.result !== result || actual.exec.name !== name || JSON.stringify(actual.exec.arguments) !== JSON.stringify(args)) throw Error('Replay tool has no matching final observer identity');
        await audit({ source: 'dsh-tool-pipeline', sessionId: owner.session.id, callId, name,
          arguments: actual.exec.arguments, result });
      }
      return result;
    } finally { admitted.delete(callId); observed.delete(callId); }
  };
  const normalize = result => {
    if (result.isError) return { kind: 'error', exitCode: null, runnerFailed: true, stderr: redact(result.error?.message ?? 'tool error') };
    const value = result.value;
    return { kind: value?.kind ?? 'unknown', exitCode: value?.exitCode ?? null,
      timedOut: Boolean(value?.timedOut), aborted: Boolean(value?.aborted), signal: value?.signal ?? null,
      denied: Boolean(value?.sandbox?.denied), runnerFailed: Boolean(value?.sandbox?.runnerFailed),
      ...(value?.jobId ? { jobId: value.jobId } : {}),
      stdout: redact(value?.stdout?.text ?? ''), stderr: redact(value?.stderr?.text ?? '') };
  };
  const stop = async jobId => {
    // Cleanup has its own bounded signal; a cancelled validation must still drain its job.
    const cleanupSignal = AbortSignal.timeout(15000);
    const killed = await call('job_kill', { job_id: jobId, reason: 'Wish Willow bounded delivery validation ended' }, cleanupSignal);
    const read = await call('job_output', { job_id: jobId, wait: true, timeout_ms: 10000 }, cleanupSignal);
    if (read.isError || !['completed', 'killed', 'failed'].includes(read.value?.job?.status)) {
      throw Error(`Delivery job did not stop: ${jobId}; ${redact(read.error?.message ?? killed.error?.message ?? read.value?.job?.status)}`);
    }
    jobs.delete(jobId);
    return { jobId, status: read.value.job.status, output: redact(read.value.text ?? '') };
  };
  const pwsh = async (command, timeoutMs, background = false) => {
    const result = normalize(await call('pwsh', { command: isolatedCommand(command), workdir: workspace,
      description: 'Verify independent Wish Willow delivery snapshot', timeoutMs, ...(background ? { run_in_background: true } : {}) }));
    if (result.jobId) jobs.add(result.jobId);
    return result;
  };
  return {
    async run(command, workdir, timeoutMs, { healthCheck } = {}) {
      if (workdir !== workspace) throw Error('Unexpected replay workspace');
      const health = validateHealthCheck(healthCheck);
      if (!health) {
        const result = await pwsh(command, timeoutMs);
        if (result.jobId) { result.cleanup = await stop(result.jobId); result.stopped = true; }
        // A promoted command lacks a foreground exit DTO. Cleanup never turns it into a PASS.
        return result;
      }
      const url = new URL(health.url);
      // A pre-existing listener cannot be credited to this launch.
      const preflight = await pwsh(`$c=[System.Net.Sockets.TcpClient]::new(); try { $p=$c.ConnectAsync(${quote(url.hostname.replace(/^\[|\]$/g, ''))},${Number(url.port)}); if (-not $p.Wait(1500)) { exit 1 }; if ($c.Connected) { exit 1 }; exit 0 } catch { if ($c.Connected) { exit 1 }; exit 0 } finally { $c.Dispose() }`, 5000);
      if (!commandPassed(preflight)) {
        if (preflight.jobId) preflight.cleanup = await stop(preflight.jobId);
        return { ...preflight, exitCode: preflight.exitCode === 0 ? null : preflight.exitCode, stderr: `Health port is occupied or could not be checked. ${preflight.stderr}` };
      }
      const launched = await pwsh(command, timeoutMs, true);
      if (!launched.jobId || !['background', 'promoted'].includes(launched.kind)) return { ...launched, healthy: false };
      let result, failure;
      try {
        const duration = Math.min(Math.max(timeoutMs - 4000, 1000), 25000);
        const probe = `$end=[DateTime]::UtcNow.AddMilliseconds(${duration}); do { try { $r=Invoke-WebRequest -UseBasicParsing -Uri ${quote(health.url)} -TimeoutSec 2 -MaximumRedirection 0; if ([int]$r.StatusCode -eq 200 -and ([string]$r.Content).Contains(${quote(health.contains)})) { Write-Output 'WISH_WILLOW_HEALTH_OK'; exit 0 } } catch { }; Start-Sleep -Milliseconds 200 } while ([DateTime]::UtcNow -lt $end); Write-Error 'Health check failed'; exit 1`;
        const checked = await pwsh(probe, timeoutMs);
        if (checked.jobId) checked.cleanup = await stop(checked.jobId);
        const live = await call('job_output', { job_id: launched.jobId });
        const running = !live.isError && live.value?.job?.status === 'running';
        result = { ...checked, jobId: launched.jobId, healthy: commandPassed(checked) && running, healthCheck: health,
          serviceStatus: live.value?.job?.status ?? 'unknown',
          stderr: redact(`${checked.stderr}\n${live.isError ? live.error?.message : live.value?.text ?? ''}`) };
      } catch (error) { failure = error; }
      // The launch must be stopped again, and that outcome is part of the evidence.
      try {
        const cleanup = await stop(launched.jobId);
        if (result) { result.cleanup = cleanup; result.stopped = true; }
      } catch (error) {
        if (result) { result.stopped = false; result.runnerFailed = true; result.stderr = redact(`${result.stderr}\n${error.message}`); }
        else failure ??= error;
      }
      if (failure) throw failure;
      return result;
    },
    async close() {
      let failure;
      for (const jobId of [...jobs]) { try { await stop(jobId); } catch (error) { failure ??= error; } }
      try { if (handle && !await ctx.sessions.flush(handle.agent.session)) throw Error('Delivery validation session was not persisted'); }
      catch (error) { failure ??= error; }
      finally { try { await handle?.dispose(); } finally { closed = true; } }
      if (failure) throw failure;
      if (audit) {
        if (!owner || ctx.agents.get(owner.id) || ctx.sessions.get(owner.id)) throw Error('Audited replay did not dispose its live writer');
        // Read AFTER disposal, so this cannot be satisfied by sessionQuery's live-preferred view.
        const persisted = await ctx.sessionQuery.readSession(owner.id);
        if (persisted.session.id !== owner.id || persisted.session.parentSession !== undefined || persisted.session.isSeeded !== false ||
          persisted.session.cwd !== workspace || persisted.events.some(e => e.type.startsWith('assistant/') || e.type.startsWith('request/'))) throw Error('Replay has no genuine persisted tool-only identity');
        return { source: 'fixed-tool-only-replay', sessionId: owner.id, session: persisted.session,
          events: persisted.events, disposedAt: new Date().toISOString(), modelCalls: 0 };
      }
    },
  };
}
