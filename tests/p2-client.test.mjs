import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';

let declaration;
new vm.Script(await readFile(new URL('../client.js', import.meta.url), 'utf8')).runInNewContext({
  window: { __ModuleLoader__: { load: row => { declaration = row; } } },
  AbortController, crypto: globalThis.crypto, setInterval, clearInterval,
});
const client = declaration.factory(() => React), t = key => client.dictionaries.en[key] ?? key;
const candidate = { id: 'candidate-current', binding: { candidateId: 'candidate-current', projectId: 'p', changeId: 'change-current', versionId: 'v-current', buildId: 'b-current', snapshotHash: 'a'.repeat(64), materialsHash: 'b'.repeat(64), contractHash: 'c'.repeat(64) },
  snapshotPath: 'C:\\fixture\\current', risk: 'medium', riskReasons: ['Default medium'], materials: [] };
function project({ status = 'FAIL', verdict = 'NEEDS_CHANGES', risk = 'medium', history = true } = {}) {
  const review = { id: 'review-current', attemptId: 'attempt-current', binding: candidate.binding, sessionId: 'independent-session', status,
    reason: 'Current candidate has a missing requirement', endedAt: '2026-10-11T00:00:00.000Z', reads: [],
    report: { risk, riskReasons: risk === 'high' ? ['Sensitive candidate fixture'] : [], checks: [{ name: 'requirements', status, reason: 'Actual source mismatch', materialIds: [] }],
      issues: status === 'FAIL' ? [{ severity: 'must-fix', description: 'Addition missing', materialIds: [], location: 'app.mjs:1' }] : [] } };
  return { id: 'p', title: 'P2 fixture', revision: 19, goal: 'Addition', currentWish: 'Fix addition', status: verdict === 'AWAITING_APPROVAL' ? 'blocked' : 'failed', workspace: 'C:\\fixture',
    requirements: [], constraints: [], decisions: [], tasks: [], runs: [], artifacts: [], history: [],
    changes: [{ id: 'change-old', versionId: 'v-old', status: 'completed' }, { id: 'change-current', versionId: 'v-current', status: verdict === 'AWAITING_APPROVAL' ? 'blocked' : 'failed' }],
    versions: [{ id: 'v-old', label: '0.1.0', status: 'Released' }, { id: 'v-current', label: '0.2.0', status: 'Built' }],
    builds: [{ id: 'b-old', changeId: 'change-old', status: 'passed', evidenceIds: ['e-old'], artifactIds: [] }, { id: 'b-current', changeId: 'change-current', status: 'passed', evidenceIds: ['e-new'], artifactIds: [] }],
    releases: history ? [{ id: 'r-old', versionId: 'v-old', buildId: 'b-old', startCommand: 'node old.mjs', snapshotPath: 'C:\\fixture\\old', summary: 'Old successful release' }] : [],
    evidence: [{ id: 'e-old', changeId: 'change-old', kind: 'test', success: true, exitCode: 0, summary: 'Old successful test' },
      { id: 'e-new', changeId: 'change-current', kind: 'test', success: false, exitCode: 1, summary: 'Current failed test' }],
    quality: { candidates: [candidate], attempts: [{ id: 'attempt-current', candidateId: candidate.id }], reviews: [review], approvals: [],
      gates: [{ id: 'gate-current', candidateId: candidate.id, reviewId: review.id, verdict, reason: 'Current Host gate blocks release' }] } };
}
const board = value => renderToStaticMarkup(React.createElement(client.ProductWorkspace, { t, project: value, busy: false, act: () => {},
  onReload: () => {}, acked: true, setAcked: () => {}, wish: '', setWish: () => {} }));

test('P2 UI historical delivery/test success cannot conceal current FAIL, current version, failed test and gate', () => {
  const html = board(project());
  assert.match(html, /id="ww-version">0\.2\.0 · Built/);
  assert.match(html, /FAIL · defects/); assert.match(html, /Changes required; release denied/); assert.match(html, /Must fix: Addition missing/);
  assert.match(html, /<p id="ww-test-status">Test status: ✗<\/p>/);
  assert.doesNotMatch(html, /<p id="ww-test-status">Test status: ✓<\/p>/);
  assert.match(html, /Latest delivered version \(not the current candidate\): 0\.1\.0/);
  assert.match(html, /Historical P1 delivery; no P2 review/);
  assert.match(html, /The last run failed/); assert.doesNotMatch(html, /Delivered\. Run it locally/);
});

test('P2 UI pending high approval sends the exact candidate, review, binding, risks and local-only scope, not a global authorization', async () => {
  const value = project({ status: 'PASS', verdict: 'AWAITING_APPROVAL', risk: 'high' }), calls = [];
  let view;
  await act(async () => { view = TestRenderer.create(React.createElement(client.ProductWorkspace, { t, project: value, busy: false,
    act: (method, input) => calls.push({ method, input }), onReload: () => {}, acked: true, setAcked: () => {}, wish: 'next wish', setWish: () => {} })); });
  assert.equal(view.root.findAllByProps({ id: 'ww-retry' }).length, 0, 'approval must not restart Coding');
  assert.equal(view.root.findByProps({ id: 'ww-submit' }).props.disabled, true);
  await act(async () => { view.root.findByProps({ id: 'ww-approve-candidate' }).props.onClick(); });
  await act(async () => { view.root.findByProps({ id: 'ww-approve-candidate' }).props.onClick(); });
  assert.equal(calls[0].method, 'approveCandidate'); assert.equal(calls[0].input.accepted, true);
  assert.equal(calls[0].input.candidateId, candidate.id); assert.equal(calls[0].input.reviewId, 'review-current');
  assert.deepEqual(calls[0].input.binding, candidate.binding); assert.equal(calls[0].input.scope, 'local-delivery-only');
  assert.deepEqual(Array.from(calls[0].input.riskReasons), ['Default medium', 'Sensitive candidate fixture']);
  assert.equal(calls[0].input.expectedRevision, 19); assert.equal(calls[1].input.requestId, calls[0].input.requestId, 'retry is idempotent for unchanged view');
  await act(async () => { view.root.findByProps({ id: 'ww-reject-candidate' }).props.onClick(); });
  assert.equal(calls[2].input.accepted, false); assert.notEqual(calls[2].input.requestId, calls[0].input.requestId);
  await act(async () => { view.unmount(); });
});

test('P2 UI no quality field/old history does not fabricate PASS; a pending re-review cannot display an old PASS as current', () => {
  const old = project(); delete old.quality;
  const legacy = board(old); assert.match(legacy, /No reviewable candidate/); assert.doesNotMatch(legacy, /PASS · reviewed/);
  const ongoing = project({ status: 'PASS', verdict: 'ALLOW' });
  ongoing.quality.attempts.push({ id: 'attempt-second', candidateId: candidate.id });
  const html = board(ongoing); assert.match(html, /Independent review in progress/); assert.match(html, /Review\/evidence incomplete; release denied/);
  assert.doesNotMatch(html, /id="ww-approve-candidate"/); assert.doesNotMatch(html, /id="ww-resume-candidate"/);
});
