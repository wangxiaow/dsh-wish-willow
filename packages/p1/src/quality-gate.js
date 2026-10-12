import { createHash } from 'node:crypto';
import { z } from 'zod';

const id = z.uuid(), time = z.iso.datetime(), text = z.string().min(1).max(10000);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const riskSchema = z.enum(['low', 'medium', 'high']);
export const reviewStatusSchema = z.enum(['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED']);
const ranks = { low: 0, medium: 1, high: 2 };
export const hashJson = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const sameBinding = (a, b) => Boolean(a && b) && hashJson(a) === hashJson(b);
export const bindingSchema = z.strictObject({ candidateId: id, projectId: id, changeId: id, versionId: id, buildId: id,
  snapshotHash: hashSchema, materialsHash: hashSchema, contractHash: hashSchema });
export const materialSchema = z.strictObject({ id: z.string().min(1).max(200), kind: z.enum(['requirements', 'source', 'test', 'diff', 'evidence', 'integrity', 'risk', 'claim']),
  path: z.string().max(2000).optional(), sha256: hashSchema, chars: z.number().int().nonnegative(), required: z.boolean(), verifiable: z.boolean() });
export const readSchema = z.strictObject({ materialId: z.string().min(1).max(200), sha256: hashSchema,
  offset: z.number().int().nonnegative(), end: z.number().int().nonnegative(), callId: z.string().min(1).max(200) });
const checkName = z.enum(['requirements', 'evidence', 'tests', 'change-impact', 'risk-scope']);
export const reportSchema = z.strictObject({ binding: bindingSchema, status: reviewStatusSchema, risk: riskSchema,
  riskReasons: z.array(text).max(20), checks: z.array(z.strictObject({ name: checkName, status: reviewStatusSchema,
    reason: text, materialIds: z.array(z.string().min(1).max(200)).max(600) })).max(5),
  issues: z.array(z.strictObject({ severity: z.enum(['must-fix', 'suggestion']), description: text,
    materialIds: z.array(z.string().min(1).max(200)).max(100), location: z.string().max(2000).optional() })).max(50), summary: text });
export const candidateSchema = z.strictObject({ id, binding: bindingSchema, createdAt: time, sourceArtifactId: id, integrityArtifactId: id,
  materialsArtifactId: id, evidenceIds: z.array(id).min(1).max(100), snapshotPath: z.string().min(1).max(2000),
  startCommand: text, summary: text, risk: riskSchema, riskReasons: z.array(text).min(1).max(30),
  baselineReleaseId: id.optional(), materials: z.array(materialSchema).min(1).max(1100) });
export const attemptSchema = z.strictObject({ id, candidateId: id, number: z.number().int().min(1).max(2), requestId: id,
  sessionId: z.string().min(1).max(200), startedAt: time });
export const reviewSchema = z.strictObject({ id, attemptId: id, binding: bindingSchema, sessionId: z.string().min(1).max(200),
  status: reviewStatusSchema, report: reportSchema.optional(), reads: z.array(readSchema).max(1000), reason: text, endedAt: time,
  artifactId: id.optional(), execution: z.strictObject({ persisted: z.boolean(), endReason: z.string().max(200),
    steps: z.number().int().nonnegative(), toolCalls: z.number().int().nonnegative(), failures: z.number().int().nonnegative(),
    provider: z.string().max(200).optional(), model: z.string().max(200).optional(),
    inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional() }) });
export const approvalSchema = z.strictObject({ id, candidateId: id, reviewId: id, requestId: id, at: time,
  bindingHash: hashSchema, riskHash: hashSchema, scope: z.literal('local-delivery-only'), accepted: z.boolean() });
export const gateSchema = z.strictObject({ id, candidateId: id, reviewId: id.optional(), approvalId: id.optional(), at: time,
  verdict: z.enum(['ALLOW', 'NEEDS_CHANGES', 'REVIEW_INCOMPLETE', 'AWAITING_APPROVAL', 'REJECTED']), reason: text });
export const qualitySchema = z.strictObject({ policy: z.literal('wish-willow-quality/1'), candidates: z.array(candidateSchema).max(100),
  attempts: z.array(attemptSchema).max(200), reviews: z.array(reviewSchema).max(200), approvals: z.array(approvalSchema).max(200), gates: z.array(gateSchema).max(600) });
export const emptyQuality = () => ({ policy: 'wish-willow-quality/1', candidates: [], attempts: [], reviews: [], approvals: [], gates: [] });

export function contractHash(project, changeId) {
  const runIds = project.runs.filter(r => r.changeId === changeId).map(r => r.id);
  return hashJson({ change: project.changes.find(c => c.id === changeId)?.wish,
    requirements: project.requirements, constraints: project.constraints,
    decisions: project.decisions.filter(d => runIds.includes(d.source.ref) || d.source.ref === changeId) });
}
export const requiredChecks = risk => ['requirements', 'evidence', 'tests', ...(risk !== 'low' ? ['change-impact'] : []), ...(risk === 'high' ? ['risk-scope'] : [])];

/** Conservative, explainable rules; not a general security scanner or a probabilistic score. */
export function classifyRisk({ wish, decisions = [], changes, baseline, commands = [], changedText = '' }) {
  const reasons = [];
  if (decisions.some(d => d.risk === 'major')) reasons.push('本次变更包含重大产品决策');
  const intent = `${wish}\n${decisions.map(d => d.text).join('\n')}`;
  if (/凭据|隐私|敏感权限|个人信息|删除数据|清空数据|不可逆|公网发布|对外发布|credential|private data|destructive|public release/i.test(intent)) reasons.push('需求涉及敏感数据、权限、破坏性行为或外部发布');
  if (/Remove-Item|\brm\s+-[rf]|\bDROP\s+(?:TABLE|DATABASE)|\bTRUNCATE\s+|Set-Acl|icacls|chmod|\bDELETE\s+FROM|process\.env\.(?:TOKEN|PASSWORD|SECRET)|readFile[^\n]*\.(?:env|credentials)/i.test(`${commands.join('\n')}\n${changedText}`)) reasons.push('实际变更或命令出现敏感/破坏性操作标记，需明确授权');
  if (reasons.length) return { level: 'high', reasons };
  // Low risk needs a real baseline and *only* non-executable Markdown/plain documentation.
  if (baseline && changes.length && changes.every(c => /^(?:README(?:\.[^/]+)?\.(?:md|txt)|docs\/(?:[^/]+\/)*[^/]+\.md)$/i.test(c.path))) {
    return { level: 'low', reasons: ['有可核实基线，差异限 README/docs 说明且入口及验证命令未变；Reviewer 仍须确认无执行行为影响'] };
  }
  return { level: 'medium', reasons: [baseline ? '功能、测试、入口、配置或其他变更默认采用中风险' : '首次交付或没有可比较基线，默认中风险'] };
}
export function fullyRead(material, reads) {
  const ranges = reads.filter(r => r.materialId === material.id && r.sha256 === material.sha256).sort((a, b) => a.offset - b.offset);
  if (!ranges.length) return false;
  let end = 0;
  for (const range of ranges) {
    if (range.offset > end || range.end < range.offset || range.end > material.chars) return false;
    end = Math.max(end, range.end);
  }
  return end >= material.chars;
}
export function validateReport(candidate, input, reads) {
  const report = reportSchema.parse(input);
  if (!sameBinding(candidate.binding, report.binding)) throw Error('Report targets a different candidate/build/snapshot/contract');
  if (ranks[report.risk] < ranks[candidate.risk]) throw Error('Reviewer cannot lower the Host risk floor');
  if (report.risk !== candidate.risk && !report.riskReasons.length) throw Error('Risk escalation needs reasons');
  if (new Set(report.checks.map(c => c.name)).size !== report.checks.length) throw Error('Duplicate review check');
  const byId = new Map(candidate.materials.map(m => [m.id, m]));
  for (const read of reads) {
    const m = byId.get(read.materialId);
    if (!m || m.sha256 !== read.sha256 || read.offset > read.end || read.end > m.chars) throw Error('Read receipt is outside candidate materials');
  }
  for (const item of [...report.checks, ...report.issues]) {
    if (item.materialIds.some(key => !byId.has(key) || !reads.some(r => r.materialId === key))) throw Error('Report cites unread or foreign material');
  }
  if (report.status === 'PASS') {
    if (report.issues.some(i => i.severity === 'must-fix') || report.checks.some(c => c.status !== 'PASS')) throw Error('PASS contradicts failed/unverified checks or must-fix issues');
    if (candidate.materials.some(m => m.required && (!m.verifiable || !fullyRead(m, reads)))) throw Error('Necessary candidate material was not fully verified/read');
    const kinds = { requirements: ['requirements', 'source'], evidence: ['evidence', 'integrity'], tests: ['test'], 'change-impact': ['diff'], 'risk-scope': ['risk'] };
    for (const name of requiredChecks(report.risk)) {
      const check = report.checks.find(c => c.name === name);
      if (!check || !check.materialIds.length || check.materialIds.some(key => !fullyRead(byId.get(key), reads)) ||
        !kinds[name].every(kind => check.materialIds.some(key => byId.get(key).kind === kind))) throw Error(`Necessary check missing or unsupported: ${name}`);
    }
  }
  return report;
}
export function effectiveRisk(candidate, review) {
  const level = review?.report && ranks[review.report.risk] > ranks[candidate.risk] ? review.report.risk : candidate.risk;
  const reasons = [...candidate.riskReasons, ...(review?.report?.riskReasons ?? [])];
  return { level, reasons, scope: 'local-delivery-only', hash: hashJson({ level, reasons, scope: 'local-delivery-only' }) };
}
export function latestReview(project, candidateId) { return project.quality?.reviews.filter(r => r.binding.candidateId === candidateId).at(-1); }
export function assertCandidateCurrent(project, candidate) {
  const b = candidate.binding, change = project.changes.at(-1), version = project.versions.find(v => v.id === b.versionId);
  if (candidate.id !== b.candidateId || project.id !== b.projectId || change?.id !== b.changeId || change.versionId !== b.versionId ||
    !version || version.changeId !== b.changeId || version.buildId !== b.buildId || !['Built', 'Released'].includes(version.status) ||
    contractHash(project, b.changeId) !== b.contractHash) throw Error('Candidate is stale or has a changed contract/version/build');
  const build = project.builds.find(x => x.id === b.buildId && x.changeId === b.changeId && x.versionId === b.versionId && x.status === 'passed');
  const artifact = (key, kind) => project.artifacts.find(a => a.id === key && a.kind === kind && a.changeId === b.changeId && a.versionId === b.versionId);
  if (!build || ![candidate.sourceArtifactId, candidate.integrityArtifactId].every(key => build.artifactIds.includes(key)) ||
    artifact(candidate.sourceArtifactId, 'source-snapshot')?.sha256 !== b.snapshotHash || artifact(candidate.materialsArtifactId, 'review-materials')?.sha256 !== b.materialsHash ||
    !artifact(candidate.integrityArtifactId, 'delivery-manifest')) throw Error('Candidate lacks bound build/material artifacts');
  const proof = project.evidence.filter(e => build.evidenceIds.includes(e.id) && e.changeId === b.changeId && e.success && e.exitCode === 0);
  if (!['build', 'test', 'run'].every(kind => proof.some(e => e.kind === kind)) || !candidate.evidenceIds.some(key => project.evidence.some(e => e.id === key && e.kind === 'code' && e.success && e.changeId === b.changeId)) || candidate.evidenceIds.some(key => !project.evidence.some(e => e.id === key && e.changeId === b.changeId))) throw Error('Candidate execution evidence is missing');
  return build;
}
export function evaluateGate(project, candidate) {
  const no = (verdict, reason, extra = {}) => ({ verdict, reason, ...extra });
  try { assertCandidateCurrent(project, candidate); } catch (error) { return no('REVIEW_INCOMPLETE', error.message); }
  const review = latestReview(project, candidate.id);
  const attempt = project.quality.attempts.filter(a => a.candidateId === candidate.id).at(-1);
  if (!review || attempt?.id !== review.attemptId) return no('REVIEW_INCOMPLETE', '独立审查未结束或新一次审查尚未产生有效结论');
  const extra = { reviewId: review.id };
  if (review.status === 'FAIL') return no('NEEDS_CHANGES', review.reason, extra);
  if (review.status !== 'PASS' || review.report?.status !== 'PASS' || !review.execution.persisted || review.execution.endReason !== 'completed' ||
    review.execution.failures !== 0 || review.execution.steps > 20 || review.execution.toolCalls > 120 || !review.artifactId ||
    !project.artifacts.some(a => a.id === review.artifactId && a.kind === 'review-report' && a.changeId === candidate.binding.changeId && a.versionId === candidate.binding.versionId)) return no('REVIEW_INCOMPLETE', review.reason, extra);
  try { validateReport(candidate, review.report, review.reads); } catch (error) { return no('REVIEW_INCOMPLETE', error.message, extra); }
  if (review.sessionId !== attempt.sessionId || project.runs.some(r => r.sessionId === review.sessionId) || !sameBinding(review.binding, candidate.binding)) return no('REVIEW_INCOMPLETE', 'Reviewer 身份或目标关联无效', extra);
  const risk = effectiveRisk(candidate, review);
  if (risk.level === 'high') {
    const approval = project.quality.approvals.filter(a => a.candidateId === candidate.id && a.reviewId === review.id).at(-1);
    if (!approval) return no('AWAITING_APPROVAL', '高风险候选必须获得绑定本次审查和操作范围的用户批准', extra);
    const more = { ...extra, approvalId: approval.id };
    if (!approval.accepted) return no('REJECTED', '用户拒绝本候选；记录保留，不释放', more);
    if (approval.bindingHash !== hashJson(candidate.binding) || approval.riskHash !== risk.hash || approval.scope !== risk.scope) return no('REVIEW_INCOMPLETE', '批准已过期或风险/操作范围不匹配', more);
    return no('ALLOW', 'P1 完整性、独立审查和本候选用户授权均满足', more);
  }
  return no('ALLOW', 'P1 完整性与独立审查均满足，可以本地交付', extra);
}

/** Structural associations for old-compatible Product State parsing; no filesystem writes. */
export function assertQualityAssociations(project) {
  const q = project.quality;
  if (!q) return;
  const ids = [...q.candidates, ...q.attempts, ...q.reviews, ...q.approvals, ...q.gates].map(x => x.id);
  if (new Set(ids).size !== ids.length) throw Error('Duplicate quality ID');
  for (const c of q.candidates) {
    if (c.id !== c.binding.candidateId || c.binding.projectId !== project.id ||
      !project.builds.some(b => b.id === c.binding.buildId && b.changeId === c.binding.changeId && b.versionId === c.binding.versionId) ||
      ![c.sourceArtifactId, c.integrityArtifactId, c.materialsArtifactId].every(key => project.artifacts.some(a => a.id === key && a.changeId === c.binding.changeId && a.versionId === c.binding.versionId)) ||
      c.evidenceIds.some(key => !project.evidence.some(e => e.id === key && e.changeId === c.binding.changeId)) ||
      new Set(c.materials.map(m => m.id)).size !== c.materials.length) throw Error('Invalid candidate association');
  }
  for (const a of q.attempts) {
    const siblings = q.attempts.filter(x => x.candidateId === a.candidateId);
    if (!q.candidates.some(c => c.id === a.candidateId) || siblings.length > 2 || siblings.filter(x => x.number === a.number).length !== 1 ||
      project.runs.some(r => r.sessionId === a.sessionId)) throw Error('Invalid independent review attempt');
  }
  for (const r of q.reviews) {
    const a = q.attempts.find(a => a.id === r.attemptId), c = q.candidates.find(c => c.id === r.binding.candidateId);
    if (!a || !c || a.candidateId !== c.id || a.sessionId !== r.sessionId || !sameBinding(c.binding, r.binding) ||
      (r.artifactId && !project.artifacts.some(x => x.id === r.artifactId && x.kind === 'review-report' && x.changeId === r.binding.changeId && x.versionId === r.binding.versionId)) ||
      q.reviews.filter(x => x.attemptId === r.attemptId).length !== 1) throw Error('Invalid review result association');
  }
  for (const a of q.approvals) if (!q.reviews.some(r => r.id === a.reviewId && r.binding.candidateId === a.candidateId)) throw Error('Invalid approval association');
  for (const g of q.gates) {
    const candidate = q.candidates.find(c => c.id === g.candidateId), review = q.reviews.find(r => r.id === g.reviewId);
    if (!candidate || (g.reviewId && review?.binding.candidateId !== g.candidateId) ||
      (g.approvalId && !q.approvals.some(a => a.id === g.approvalId && a.candidateId === g.candidateId && a.reviewId === g.reviewId))) throw Error('Invalid gate association');
    if (g.verdict === 'ALLOW') {
      if (review?.status !== 'PASS' || review.report?.status !== 'PASS' || !review.artifactId || !review.execution.persisted || review.execution.endReason !== 'completed') throw Error('ALLOW requires a complete associated PASS');
      validateReport(candidate, review.report, review.reads);
      const risk = effectiveRisk(candidate, review);
      if (risk.level === 'high' && !q.approvals.some(a => a.id === g.approvalId && a.accepted && a.bindingHash === hashJson(candidate.binding) && a.riskHash === risk.hash && a.scope === risk.scope)) throw Error('ALLOW requires bound high-risk approval');
    }
  }
}
