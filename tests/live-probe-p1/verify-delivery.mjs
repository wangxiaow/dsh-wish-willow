// Read-only independent verification of the delivered artifacts: recorded hashes vs on-disk snapshot
// vs the live workspace, plus the version-distinguishing feature check. Writes only its own report.
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const storage = resolve(process.argv[2]);
const workspace = resolve(process.argv[3]);
const report = resolve(process.argv[4]);
const projectId = process.argv[5];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const document = JSON.parse(await readFile(storage, 'utf8'));
const project = document.tables.projects[projectId];
if (!project) throw new Error('project not found');

const results = { projectId, revision: project.revision, versions: [] };
for (const [index, release] of project.releases.entries()) {
  const artifact = project.artifacts.find(row => row.versionId === release.versionId);
  const manifestBytes = await readFile(artifact.path);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const files = [];
  for (const entry of manifest.entries) {
    const bytes = await readFile(join(release.snapshotPath, entry.path));
    const live = await readFile(join(workspace, entry.path)).then(file => sha256(file)).catch(() => null);
    files.push({ path: entry.path, recorded: entry.sha256, snapshot: sha256(bytes), live,
      snapshotMatches: sha256(bytes) === entry.sha256, liveMatchesSnapshot: live === sha256(bytes) });
  }
  const snapshotIndex = (await readFile(join(release.snapshotPath, 'index.html'), 'utf8'));
  const liveIndex = await readFile(join(workspace, 'index.html'), 'utf8');
  results.versions.push({
    round: index + 1, version: project.versions.find(row => row.id === release.versionId)?.label,
    releaseId: release.id, buildId: release.buildId, releasedAt: release.releasedAt,
    startCommand: release.startCommand, snapshotPath: release.snapshotPath,
    manifestPath: artifact.path, manifestRecorded: artifact.sha256, manifestOnDisk: sha256(manifestBytes),
    manifestMatches: sha256(manifestBytes) === artifact.sha256,
    files, allSnapshotHashesMatch: files.every(file => file.snapshotMatches),
    allLiveFilesMatchSnapshot: files.every(file => file.liveMatchesSnapshot),
    hasPriorityFilterInSnapshot: snapshotIndex.includes('priority-filter'),
    hasPriorityFilterInLiveWorkspace: liveIndex.includes('priority-filter'),
  });
}
results.releaseHistoryImmutable = project.releases.length === 2
  && project.releases[0].releasedAt < project.releases[1].releasedAt
  && project.releases[0].snapshotPath !== project.releases[1].snapshotPath;
results.distinctVersions = results.versions[0].hasPriorityFilterInSnapshot === false
  && results.versions[1].hasPriorityFilterInSnapshot === true;
results.historyRevisions = project.history.map(row => [row.revision, row.action]);
results.actionsPerRound = project.changes.map(change => ({
  changeId: change.id, status: change.status, attempt: change.attempt,
  evidence: project.evidence.filter(row => row.changeId === change.id).map(row => [row.kind, row.exitCode, row.success]),
  run: (() => { const run = project.runs.find(row => row.changeId === change.id); return run ? { modelCalls: run.modelCalls, toolCalls: run.toolCalls, failures: run.failures, inputTokens: run.inputTokens, outputTokens: run.outputTokens, durationMs: run.durationMs, status: run.status } : null; })(),
}));
const counts = await readdir(join(workspace, 'tests')).then(rows => rows.length).catch(() => 0);
results.workspace = { path: workspace, testFiles: counts, fileCount: (await readdir(workspace, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).length,
  sizeBytes: (await Promise.all((await readdir(workspace, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile())
    .map(entry => stat(join(entry.parentPath ?? entry.path, entry.name)).then(info => info.size).catch(() => 0)))).reduce((sum, value) => sum + value, 0) };
await writeFile(report, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ versions: results.versions.map(row => ({ round: row.round, version: row.version, manifestMatches: row.manifestMatches,
  allSnapshotHashesMatch: row.allSnapshotHashesMatch, allLiveFilesMatchSnapshot: row.allLiveFilesMatchSnapshot,
  hasPriorityFilterInSnapshot: row.hasPriorityFilterInSnapshot })), releaseHistoryImmutable: results.releaseHistoryImmutable,
  distinctVersions: results.distinctVersions, files: results.versions[1].files.length }, null, 2));
