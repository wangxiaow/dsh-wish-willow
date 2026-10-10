// Temporary live probe: drives the real Wish Willow P1 service inside the running Host so a real
// DSH Agent plans, codes, builds, tests and delivers. It never fabricates results: every recorded
// field comes from the persisted product state written by the Host after real execution.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';

export const inject = ['wishWillowP1'];
const WISH_ONE = '我想做一个简单的待办事项应用，可以添加任务、标记完成、删除任务。';
const WISH_TWO = '给待办事项增加优先级，并且能够按优先级筛选。';
const ROUND_MS = 30 * 60 * 1000;
const POLL_MS = 5000;

export async function apply(ctx, config) {
  if (!isAbsolute(config.outputDir)) throw new Error('probe outputDir must be absolute');
  await mkdir(config.outputDir, { recursive: true });
  const statePath = join(config.outputDir, 'probe-state.json');
  const write = async (name, value) => {
    const target = join(config.outputDir, name);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(value, null, 2));
    await rename(temporary, target);
  };
  const readState = async () => {
    try { return JSON.parse(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  };
  const saveState = async state => {
    await write('probe-state.json', state);
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const api = ctx.wishWillowP1;
  let state = await readState();
  if (!state) {
    state = { startedAt: new Date().toISOString(), phase: 'create', pid: process.pid };
    await saveState(state);
  }
  if (state.phase === 'done' || state.phase === 'blocked') return;
  void (async () => {
    try {
      if (!state.projectId) {
        const project = await api.create({ requestId: randomUUID(), title: '[P1 E2E TEST] 待办事项应用', wish: WISH_ONE });
        state = { ...state, projectId: project.id, projectCreatedAt: project.createdAt, revision: project.revision, phase: 'round1' };
        await saveState(state);
      }
      for (const round of [1, 2]) {
        if (state[`round${round}Done`]) continue;
        let project = await api.read({ projectId: state.projectId });
        let change = project.changes.at(-1);
        if (!change || change.status === 'completed' || ['failed', 'uncertain'].includes(change?.status)) {
          const requestId = randomUUID();
          project = await api.submit({ projectId: state.projectId, expectedRevision: project.revision, requestId, wish: round === 1 ? WISH_ONE : WISH_TWO });
          change = project.changes.at(-1);
          state = { ...state, [`round${round}RequestId`]: requestId, [`round${round}ChangeId`]: change.id, phase: `round${round}` };
          await saveState(state);
        }
        const started = Date.now();
        let retried = false;
        while (Date.now() - started < ROUND_MS) {
          await sleep(POLL_MS);
          project = await api.read({ projectId: state.projectId });
          const current = project.changes.find(row => row.id === state[`round${round}ChangeId`]);
          if (!current || ['pending', 'running'].includes(current.status)) continue;
          if (current.status === 'failed' && current.attempt < 2 && !retried) {
            retried = true;
            await write(`round${round}-first-attempt.json`, { project, change: current, pid: process.pid, at: new Date().toISOString() });
            project = await api.retry({ projectId: state.projectId, expectedRevision: project.revision, requestId: randomUUID(),
              changeId: current.id, acknowledgeUncertain: false });
            state = { ...state, [`round${round}ChangeId`]: project.changes.at(-1).id, [`round${round}Retried`]: true };
            await saveState(state);
            continue;
          }
          const summary = {
            round, wish: round === 1 ? WISH_ONE : WISH_TWO, pid: process.pid, at: new Date().toISOString(),
            project: { id: project.id, title: project.title, workspace: project.workspace, revision: project.revision, status: project.status },
            change: current,
            requirements: project.requirements, constraints: project.constraints, decisions: project.decisions,
            tasks: project.tasks.filter(row => row.changeId === current.id),
            runs: project.runs.filter(row => row.changeId === current.id),
            evidence: project.evidence.filter(row => row.changeId === current.id),
            artifacts: project.artifacts.filter(row => row.changeId === current.id),
            builds: project.builds.filter(row => row.changeId === current.id),
            versions: project.versions.filter(row => row.changeId === current.id),
            releases: project.releases.filter(row => row.changeId === current.id),
            totals: { changes: project.changes.length, releases: project.releases.length, versions: project.versions.length,
              agentRuns: project.runs.length, elapsedMs: Date.now() - started, retried },
          };
          await write(`round${round}.json`, summary);
          if (current.status === 'completed') {
            state = { ...state, [`round${round}Done`]: true, phase: round === 2 ? 'done' : `round${round}-delivered` };
            await saveState(state);
            if (round === 2) return;
            break;
          }
          state = { ...state, phase: 'blocked', blockedRound: round, blockedStatus: current.status, blockedReason: current.result ?? null };
          await saveState(state);
          await write('blocked.json', { round, change: current, projectStatus: project.status, pid: process.pid, at: new Date().toISOString() });
          return;
        }
        if (!state[`round${round}Done`]) {
          state = { ...state, phase: 'blocked', blockedRound: round, blockedStatus: 'timeout' };
          await saveState(state);
          await write('timeout.json', { round, pid: process.pid, at: new Date().toISOString(), elapsedMs: Date.now() - started });
          return;
        }
      }
    } catch (error) {
      state = { ...state, phase: 'error', error: String(error?.message ?? error), at: new Date().toISOString() };
      await saveState(state);
      await write('error.json', { phase: state.phase, error: state.error, projectId: state.projectId, pid: process.pid, at: state.at });
    }
  })();
}
