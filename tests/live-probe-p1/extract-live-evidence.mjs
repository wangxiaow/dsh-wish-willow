// Read-only extractor: turns the persisted Wish Willow P1 product state into per-ChangeSet evidence
// files. It never writes to the storage file and never invents values: every field is copied from the
// state the Host wrote after real Agent execution.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const storage = resolve(process.argv[2] ?? '');
const outputDir = resolve(process.argv[3] ?? '');
const projectId = process.argv[4];
if (!storage || !outputDir || !projectId) throw new Error('usage: extract-live-evidence.mjs <storage.json> <outputDir> <projectId>');

const document = JSON.parse(await readFile(storage, 'utf8'));
if (document.unit?.name !== 'wish_willow_p1' || document.unit.version !== 1) throw new Error('unexpected unit');
const project = document.tables.projects[projectId];
if (!project) throw new Error('project not found');

const writeJson = async (name, value) => {
  const target = join(outputDir, name);
  await writeFile(`${target}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${target}.tmp`, target);
};

const rounds = [];
for (const [index, change] of project.changes.entries()) {
  const pick = key => project[key].filter(row => row.changeId === change.id);
  const run = project.runs.find(row => row.changeId === change.id);
  const release = project.releases.find(row => row.changeId === change.id);
  const build = project.builds.find(row => row.changeId === change.id);
  const evidence = pick('evidence');
  const round = {
    round: index + 1,
    change,
    tasks: pick('tasks'),
    run: run ?? null,
    evidence,
    artifacts: pick('artifacts'),
    builds: build ? [build] : [],
    versions: pick('versions'),
    releases: release ? [release] : [],
    facts: { confirmedRequirements: project.requirements.filter(row => row.confirmation === 'confirmed').map(row => [row.id, row.text]),
      inferredRequirements: project.requirements.filter(row => row.confirmation === 'inferred' && row.source.ref === run?.id).length,
      majorDecisions: project.decisions.filter(row => row.risk === 'major').map(row => [row.id, row.status, row.text]) },
    verification: { kinds: [...new Set(evidence.map(row => row.kind))].sort(),
      exitCodes: evidence.filter(row => row.kind !== 'code').map(row => [row.kind, row.exitCode, row.success]),
      allSuccessful: evidence.every(row => row.success),
      hasBuildTestRunZero: ['build', 'test', 'run'].every(kind => evidence.some(row => row.kind === kind && row.success && row.exitCode === 0)) },
  };
  rounds.push(round);
  await writeJson(`round${index + 1}-evidence.json`, round);
}

await writeJson('summary.json', {
  extractedAt: new Date().toISOString(), projectId, revision: project.revision, status: project.status,
  changes: project.changes.length, releases: project.releases.length, versions: project.versions.length, agentRuns: project.runs.length,
  userDecisions: project.decisions.filter(row => row.risk === 'major').length,
  rounds: rounds.map(round => ({ round: round.round, changeStatus: round.change.status, attempt: round.change.attempt,
    version: round.versions[0] ? [round.versions[0].label, round.versions[0].status] : null,
    startCommand: round.releases[0]?.startCommand ?? null, snapshotPath: round.releases[0]?.snapshotPath ?? null,
    buildStatus: round.builds[0]?.status ?? null, buildEvidence: round.builds[0]?.evidenceIds.length ?? 0,
    tasks: round.tasks.length, runStatus: round.run?.status ?? null, modelCalls: round.run?.modelCalls ?? null,
    toolCalls: round.run?.toolCalls ?? null, failures: round.run?.failures ?? null, inputTokens: round.run?.inputTokens ?? null,
    outputTokens: round.run?.outputTokens ?? null, durationMs: round.run?.durationMs ?? null,
    verification: round.verification })),
  history: project.history.map(row => [row.revision, row.action, row.source.kind]),
});
console.log(`extracted ${rounds.length} rounds for ${projectId}`);
