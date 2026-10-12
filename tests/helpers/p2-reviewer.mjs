// Scripted Reviewer fixtures ONLY. They exercise plumbing/Host contracts, not real model judgment.
import { requiredChecks } from '../../packages/p1/src/quality-gate.js';

export async function readFixtureMaterials({ tool, reviewRequest }, { skip = [] } = {}) {
  const contents = new Map();
  for (const m of reviewRequest.materials.filter(m => m.required && !skip.includes(m.id))) {
    let text = '', offset = 0;
    do {
      const result = await tool('read', { materialId: m.id, offset, limit: 16000 });
      text += result.content; offset = result.end;
    } while (offset < m.chars);
    contents.set(m.id, text);
  }
  return contents;
}
export function fixtureReport(request, { status = 'PASS', risk = request.riskFloor, issues = [], summary = 'SCRIPTED REVIEWER FIXTURE ONLY', checks } = {}) {
  const ids = request.materials.filter(m => m.required).map(m => m.id);
  return { binding: request.binding, status, risk, riskReasons: risk === request.riskFloor ? [] : ['SCRIPTED risk escalation fixture'],
    checks: checks ?? requiredChecks(risk).map(name => ({ name, status, reason: 'SCRIPTED contract assertion, not genuine model evaluation', materialIds: ids })), issues, summary };
}
export async function passingFixtureReview(context) {
  await readFixtureMaterials(context);
  await context.tool('wish_review_submit', fixtureReport(context.reviewRequest));
}
