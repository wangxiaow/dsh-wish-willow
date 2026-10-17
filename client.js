window.__ModuleLoader__.load({
  id: 'dsh-wish-willow',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'wishWillow';
    const dictionaries = {
      zh: {
        title: '许愿柳', description: '一个入口：许愿、执行、证据与交付。提交自然语言愿望，由真实 DSH Agent 规划、开发、构建、测试并交付可运行软件；产品状态独立于会话并持久保存。',
        productList: '产品', newProduct: '新建产品', name: '产品名称', wish: '软件愿望', create: '创建产品', creating: '创建中…',
        reload: '重新读取', loading: '读取中…', empty: '尚无产品。请先新建产品并写下你的愿望。',
        goal: '产品目标', currentWish: '当前愿望', workspace: '工作目录', revision: '修订号', productStatus: '产品状态',
        requirements: '已确认需求', inferredRequirements: 'Agent 推断需求（未确认）', constraints: '核心约束', decisions: '需要你决策的事项',
        confirmed: '用户确认', inferred: 'Agent 推断', accept: '接受', reject: '拒绝', accepted: '已接受', rejected: '已拒绝', proposed: '待决策', major: '重大', ordinary: '普通',
        plan: '当前任务及执行状态', pending: '待执行', running: '执行中', completed: '已完成', failed: '失败', blocked: '阻塞', uncertain: '状态待确认',
        draft: '草稿', delivered: '已交付',
        taskId: '任务 ID', category: '类别', technical: '技术类', experience: '体验类', phase: '阶段', dependencies: '依赖', result: '实际结果', evidence: '证据', noTasks: '尚无任务',
        agentRuns: 'Agent 执行记录', noRuns: '尚无执行记录', provider: 'Provider', model: '模型', session: 'Session ID', started: '开始', ended: '结束',
        modelCalls: '模型调用', toolCalls: '工具调用', failures: '记录失败', tokens: 'Tokens（输入/输出）', duration: '耗时', reason: '原因', notAvailable: '—',
        outcomes: '构建、测试与交付证据', build: '最近构建', tests: '测试状态', noBuild: '尚无构建记录', exitCode: '退出码', evidenceKinds: '证据类型',
        artifacts: '交付产物', snapshot: '不可覆盖源码快照', noArtifacts: '尚无产物', recordedAt: '记录时间', code: '源码', passed: '通过', failedBuild: '失败', passedMark: '✓', missingMark: '—',
        versionHistory: '版本历史与运行方式', version: '当前版本', startCommand: '启动方式', releasedAt: '交付时间', summary: '交付说明', noRelease: '尚未交付版本', planned: '计划中', built: '已构建', released: '正式交付', sourcePath: '源码目录', snapshotPath: '快照目录',
        submit: '提交下一轮愿望', submitting: '已提交，正在执行…', wishPlaceholder: '用自然语言描述你希望这个软件接下来变成什么样；已确认需求与历史版本会保留。',
        unsafeDecisionState: '无法安全恢复：旧决策关联不完整，或执行可能已经开始。已保留原状态，未自动重放；请人工核查，不要反复重试。',
        reviseDecision: '提交修改后的方案（需重新批准）', revisionText: '修改意见与完整替代方案', resumePlan: '继续已批准计划',
        decisionPaused: '计划已暂停并持久保存，可直接离开以保持暂停。拒绝不会授权执行；请填写替代方案、重新提交并明确批准，再继续；也可取消本次计划。',
        retry: '重试本次变更', retryAck: '我已检查工作目录并确认可以重试（可能有未知副作用）', retrying: '已提交重试…', cancel: '取消执行',
        failedExplanation: '本次执行失败：不会产生新版本，也不会改写已交付历史。可查看失败任务后重试，或提交修订愿望。',
        uncertainExplanation: 'Host 在执行中中断。为避免重复副作用，系统没有自动重跑：请检查工作目录，确认后再重试。',
        noEvidence: '没有真实构建、测试与运行证据时不会标记为已交付。',
        legacyArea: '旧版 P0 产品（独立存储，可编辑与升级）', legacyHint: 'P0 数据保存在独立 Domain（wish_willow）中，字节不变。可在此直接编辑，或按 UUID 导入到统一产品状态继续演化。',
        legacyEmpty: '没有旧版 P0 产品。', importP0: '导入到统一产品', imported: '已导入（再次导入返回同一产品）', legacyNew: '新建旧版 P0 产品', legacySave: '保存 P0 产品', legacySaved: 'P0 产品已保存',
        legacyTitle: 'P0 产品名称', legacyWish: 'P0 软件愿望', legacyStatus: 'P0 手动状态', statusDraft: '草稿', statusConfirmed: '已确认', statusArchived: '已归档',
        conflict: '此产品已被其他页面修改。你的草稿已保留，请重新读取后再编辑。', failure: '操作失败；草稿已保留。请检查连接或插件状态后重试。',
        invalid: '请检查名称（1–120 字符）与愿望（1–10000 字符）。', busy: '当前变更尚未结束。请先等待、取消或处理，再提交新的愿望。',
        saved: '已持久化保存', submitted: '愿望已提交，Agent 开始执行', retried: '已提交重试', cancelled: '已请求取消执行', decided: '决策已保存', unsaved: '有未保存修改',
        suggestion: { deliver: '已交付。可用“启动方式”在本地运行；如需改动，继续提交新的愿望。', running: 'Agent 正在执行。看板会自动刷新。', blocked: '存在重大决策，需要你先接受或拒绝后才能继续。', failed: '上次执行失败，请查看失败任务后重试或提交修订愿望。', uncertain: '执行状态待确认，请检查工作目录后显式重试。', draft: '尚未提交愿望。写下愿望即可开始。' },
        language: '语言', stageNote: '统一 Bundle：新交付同时受 P1 完整性验证、独立 Reviewer 和 Host 质量门禁约束；历史交付不补造审查。',
        quality: '独立审查与质量门禁', noCandidate: '当前变更尚无可审查候选；不能视为 Reviewer PASS。', candidate: '当前候选', riskLevel: '风险等级', low: '低风险', medium: '中风险', high: '高风险',
        reviewStatus: 'Reviewer 结论', reviewHistory: '不可覆盖的审查历史', reviewEvidence: '审查材料与实际读取', mustFix: '必须处理', suggestionIssue: '非阻断建议',
        PASS: 'PASS · 审查通过', FAIL: 'FAIL · 有缺陷', BLOCKED: 'BLOCKED · 无法执行', UNVERIFIED: 'UNVERIFIED · 未验证', REVIEW_RUNNING: '独立审查进行中',
        ALLOW: 'Host 允许本地交付', NEEDS_CHANGES: '需要修改，禁止释放', REVIEW_INCOMPLETE: '审查或证据未完成，禁止释放', AWAITING_APPROVAL: '等待本候选的用户批准', REJECTED: '用户拒绝，禁止释放',
        approveLocal: '明确批准此候选的本地交付', rejectCandidate: '拒绝此候选', reReview: '显式重审一次（使用模型）', resumeCandidate: '重新核对并继续本候选交付（不调用模型）',
        approvalScope: '批准仅绑定显示的候选、审查和风险事项；不授权删除数据、修改权限或对外发布。', historicRelease: '最近已交付版本（不是当前候选）', legacyReview: 'P1 历史交付；未进行 P2 审查',
        reviewStarted: '已显式提交独立重审', gateChecked: 'Host 已核对候选门禁', candidateDecisionSaved: '已保存绑定本候选的决定；是否释放由 Host 校验',
      },
      en: {
        title: 'Wish Willow', description: 'One entry point: wish, execution, evidence and delivery. Submit a natural-language wish; a real DSH Agent plans, codes, builds, tests and delivers running software. Product state persists independently of sessions.',
        productList: 'Products', newProduct: 'New product', name: 'Product name', wish: 'Software wish', create: 'Create product', creating: 'Creating…',
        reload: 'Reload', loading: 'Loading…', empty: 'No products yet. Create one and write your wish.',
        goal: 'Product goal', currentWish: 'Current wish', workspace: 'Workspace', revision: 'Revision', productStatus: 'Product status',
        requirements: 'Confirmed requirements', inferredRequirements: 'Agent-inferred (unconfirmed)', constraints: 'Core constraints', decisions: 'Decisions needed from you',
        confirmed: 'Confirmed by user', inferred: 'Agent-inferred', accept: 'Accept', reject: 'Reject', accepted: 'Accepted', rejected: 'Rejected', proposed: 'Proposed', major: 'Major', ordinary: 'Ordinary',
        plan: 'Current tasks and execution status', pending: 'Pending', running: 'Running', completed: 'Completed', failed: 'Failed', blocked: 'Blocked', uncertain: 'Unconfirmed',
        draft: 'Draft', delivered: 'Delivered',
        taskId: 'Task ID', category: 'Category', technical: 'Technical', experience: 'Experience', phase: 'Phase', dependencies: 'Depends on', result: 'Actual result', evidence: 'Evidence', noTasks: 'No tasks yet',
        agentRuns: 'Agent runs', noRuns: 'No runs yet', provider: 'Provider', model: 'Model', session: 'Session ID', started: 'Started', ended: 'Ended',
        modelCalls: 'Model calls', toolCalls: 'Tool calls', failures: 'Recorded failures', tokens: 'Tokens (in/out)', duration: 'Duration', reason: 'Reason', notAvailable: '—',
        outcomes: 'Build, test and delivery evidence', build: 'Latest build', tests: 'Test status', noBuild: 'No build yet', exitCode: 'Exit code', evidenceKinds: 'Evidence kinds',
        artifacts: 'Deliverables', snapshot: 'Immutable source snapshot', noArtifacts: 'No artifacts yet', recordedAt: 'Recorded at', code: 'Source', passed: 'passed', failedBuild: 'failed', passedMark: '✓', missingMark: '—',
        versionHistory: 'Version history and how to run', version: 'Current version', startCommand: 'Start command', releasedAt: 'Released at', summary: 'Delivery summary', noRelease: 'No release yet', planned: 'Planned', built: 'Built', released: 'Released', sourcePath: 'Source directory', snapshotPath: 'Snapshot directory',
        submit: 'Submit the next wish', submitting: 'Submitted; running…', wishPlaceholder: 'Describe in natural language what this software should become next; confirmed requirements and released history are preserved.',
        unsafeDecisionState: 'Cannot safely resume: legacy decision links are incomplete or execution may have started. State was preserved and nothing replayed. Inspect it manually; do not repeatedly retry.',
        reviseDecision: 'Submit revised proposal (approval required)', revisionText: 'Feedback and complete replacement proposal', resumePlan: 'Continue approved plan',
        decisionPaused: 'Plan paused and saved; leave it here to stay paused. Rejection never authorizes execution. Submit a replacement, explicitly approve it, then continue; or cancel this plan.',
        retry: 'Retry this change', retryAck: 'I inspected the workspace and confirm retry (side effects may be unknown)', retrying: 'Retry submitted…', cancel: 'Cancel run',
        failedExplanation: 'This run failed: no new version is produced and released history is unchanged. Inspect failed tasks, then retry or submit a revised wish.',
        uncertainExplanation: 'The Host was interrupted mid-run. Nothing was re-run automatically to avoid duplicate side effects; inspect the workspace, then retry explicitly.',
        noEvidence: 'Nothing is marked delivered without real build, test and run evidence.',
        legacyArea: 'Legacy P0 products (separate storage, editable and upgradable)', legacyHint: 'P0 data lives in its own Domain (wish_willow) with unchanged bytes. Edit it here, or import by UUID into the unified product state to continue evolving it.',
        legacyEmpty: 'No legacy P0 products.', importP0: 'Import into unified products', imported: 'Imported (importing again returns the same product)', legacyNew: 'New legacy P0 product', legacySave: 'Save P0 product', legacySaved: 'P0 product saved',
        legacyTitle: 'P0 product name', legacyWish: 'P0 software wish', legacyStatus: 'P0 manual status', statusDraft: 'Draft', statusConfirmed: 'Confirmed', statusArchived: 'Archived',
        conflict: 'Another page changed this product. Your draft is preserved; reload before editing again.', failure: 'Operation failed; draft preserved. Check connection or plugin state and retry.',
        invalid: 'Check the name (1–120 characters) and wish (up to 10000 characters).', busy: 'The current change is unfinished. Wait, cancel or resolve it before submitting another wish.',
        saved: 'Durably saved', submitted: 'Wish submitted; the Agent started', retried: 'Retry submitted', cancelled: 'Cancellation requested', decided: 'Decision saved', unsaved: 'Unsaved edits',
        suggestion: { deliver: 'Delivered. Run it locally with the start command; submit a new wish for further changes.', running: 'The Agent is working. The board refreshes automatically.', blocked: 'Major decisions are pending; accept or reject them to continue.', failed: 'The last run failed. Inspect failed tasks, then retry or submit a revised wish.', uncertain: 'Execution needs confirmation; inspect the workspace, then retry explicitly.', draft: 'No wish submitted yet. Write one to begin.' },
        language: 'Language', stageNote: 'One bundle: new Releases require P1 integrity verification, an independent Reviewer and the Host quality gate. Historical deliveries get no invented reviews.',
        quality: 'Independent review and quality gate', noCandidate: 'No reviewable candidate for this change; this is not Reviewer PASS.', candidate: 'Current candidate', riskLevel: 'Risk level', low: 'Low', medium: 'Medium', high: 'High',
        reviewStatus: 'Reviewer conclusion', reviewHistory: 'Append-only review history', reviewEvidence: 'Materials and actual reads', mustFix: 'Must fix', suggestionIssue: 'Non-blocking suggestion',
        PASS: 'PASS · reviewed', FAIL: 'FAIL · defects', BLOCKED: 'BLOCKED · cannot execute', UNVERIFIED: 'UNVERIFIED · not verified', REVIEW_RUNNING: 'Independent review in progress',
        ALLOW: 'Host allows local delivery', NEEDS_CHANGES: 'Changes required; release denied', REVIEW_INCOMPLETE: 'Review/evidence incomplete; release denied', AWAITING_APPROVAL: 'Awaiting approval for this candidate', REJECTED: 'User rejected; release denied',
        approveLocal: 'Explicitly approve this candidate for local delivery', rejectCandidate: 'Reject this candidate', reReview: 'Explicitly re-review once (uses a model)', resumeCandidate: 'Recheck and resume this candidate (no model)',
        approvalScope: 'Approval binds this candidate, review and listed risks only. It does not authorize data deletion, permission changes or external publication.', historicRelease: 'Latest delivered version (not the current candidate)', legacyReview: 'Historical P1 delivery; no P2 review',
        reviewStarted: 'Independent re-review explicitly requested', gateChecked: 'Host candidate gate checked', candidateDecisionSaved: 'Candidate-bound decision saved; release remains a Host decision',
      },
    };
    const css = `
      .ww { color:var(--dsw-alias-label-primary); max-width:1180px; padding:20px; margin:auto; }
      .ww * { box-sizing:border-box; }
      .ww h2 { font-size:20px; margin:0 0 8px; }
      .ww h3 { font-size:15px; margin:18px 0 8px; }
      .ww h4 { font-size:13px; margin:12px 0 6px; }
      .ww p { color:var(--dsw-alias-label-secondary); line-height:1.6; margin:6px 0; }
      .ww .ww-columns { display:grid; grid-template-columns:minmax(210px,300px) minmax(0,1fr); gap:20px; align-items:start; }
      .ww .ww-list { display:flex; flex-direction:column; gap:8px; }
      .ww button,.ww input,.ww textarea,.ww select { font:inherit; color:inherit; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); padding:8px 12px; }
      .ww button { cursor:pointer; text-align:left; overflow-wrap:anywhere; }
      .ww button[aria-pressed=true] { border-color:var(--dsw-alias-brand-primary); }
      .ww :focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .ww :disabled { opacity:.55; cursor:default; }
      .ww label { display:block; font-weight:500; margin:10px 0 6px; }
      .ww input,.ww textarea,.ww select { width:100%; }
      .ww textarea { resize:vertical; min-height:84px; }
      .ww .ww-actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
      .ww dl { font-size:12px; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); margin:4px 0; }
      .ww dd { margin:2px 0 8px; }
      .ww [role=alert] { color:var(--dsw-alias-state-error-primary); }
      .ww .ww-card { border:1px solid var(--dsw-alias-border-l2); border-radius:10px; padding:12px; margin:8px 0; background:var(--dsw-alias-bg-layer-1); }
      .ww .ww-task { border-left:3px solid var(--dsw-alias-border-l2); padding-left:10px; margin:8px 0; }
      .ww .ww-tag { display:inline-block; font-size:12px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; padding:1px 8px; margin-right:6px; }
      .ww code { overflow-wrap:anywhere; font-size:12px; }
      .ww ul { margin:6px 0 6px 18px; padding:0; }
      .ww li { line-height:1.6; overflow-wrap:anywhere; }
      .ww table { border-collapse:collapse; width:100%; font-size:12px; }
      .ww th,.ww td { border:1px solid var(--dsw-alias-border-l2); padding:4px 6px; text-align:left; overflow-wrap:anywhere; vertical-align:top; }
      .ww .ww-hint { font-size:12px; }
      .ww .ww-sep { border-top:1px solid var(--dsw-alias-border-l2); margin:18px 0 0; }
      @media(max-width:720px) { .ww { padding:12px; } .ww .ww-columns { grid-template-columns:1fr; } }
    `;

    /** Uses the actual DSH carrier; no raw fetch, custom server or Desktop globals. */
    function createApi(connection) {
      async function call(namespace, method, input, signal) {
        const noInput = method === 'list' || method === 'legacy';
        const result = await connection.rpc.call('/api', `${namespace}/${method}`, { args: noInput ? {} : { input } }, signal);
        if (!result.ok) {
          const error = new Error(result.error.message);
          error.code = result.error.code;
          throw error;
        }
        return result.value;
      }
      return {
        /** Authoritative product state (Domain wish_willow_p1 / Service wishWillowP1). */
        evolution: (method, input, signal) => call('wishWillowP1', method, input, signal),
        /** Legacy P0 product state (Domain wish_willow / Service wishWillow). */
        products: (method, input, signal) => call('wishWillow', method, input, signal),
      };
    }

    const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const short = value => String(value ?? '').slice(0, 8);
    const blankLegacy = () => ({ title: '', wish: '', status: 'draft' });
    const legacyFields = row => ({ title: row.title, wish: row.wish, status: row.status });
    const blankDraft = () => ({ ...blankLegacy(), newTitle: '', newWish: '' });
    const groupOf = task => ['completed', 'running', 'uncertain', 'blocked', 'failed'].includes(task.status) ? task.status : 'pending';

    function QualityPanel({ t, project, busy, act }) {
      const requests = React.useRef({});
      const q = project.quality, change = project.changes.at(-1);
      const candidate = q?.candidates.filter(c => c.binding.changeId === change?.id).at(-1);
      if (!candidate) return h('section', { id: 'ww-quality' }, h('h3', null, t('quality')), h('p', null, t('noCandidate')),
        q?.reviews.length ? h('details', { id: 'ww-review-history' }, h('summary', null, t('reviewHistory')),
          q.reviews.map(r => h('p', { key: r.id }, `${r.id} · Candidate ${r.binding.candidateId} · ${r.status} · ${r.reason}`))) : null);
      const attempt = q.attempts.filter(a => a.candidateId === candidate.id).at(-1);
      const review = q.reviews.filter(r => r.binding.candidateId === candidate.id).at(-1);
      const active = attempt && attempt.id !== review?.attemptId;
      const gate = q.gates.filter(g => g.candidateId === candidate.id).at(-1);
      const gateCurrent = !gate?.reviewId || gate.reviewId === review?.id;
      const verdict = active || !gateCurrent ? 'REVIEW_INCOMPLETE' : gate?.verdict ?? 'REVIEW_INCOMPLETE';
      const riskRanks = { low: 0, medium: 1, high: 2 };
      const risk = review?.report && riskRanks[review.report.risk] > riskRanks[candidate.risk] ? review.report.risk : candidate.risk;
      const reasons = [...candidate.riskReasons, ...(review?.report?.riskReasons ?? [])];
      const released = project.releases.some(r => r.buildId === candidate.binding.buildId);
      const request = method => {
        const key = `${method}:${candidate.id}:${review?.id}:${project.revision}`;
        requests.current[key] ??= newId();
        return { projectId: project.id, candidateId: candidate.id, requestId: requests.current[key], expectedRevision: project.revision };
      };
      const approve = accepted => act('approveCandidate', { ...request(accepted ? 'approve' : 'reject'), accepted,
        reviewId: review.id, binding: candidate.binding, risk, riskReasons: reasons, scope: 'local-delivery-only' });
      return h('section', { className: 'ww-card', id: 'ww-quality' },
        h('h3', null, t('quality')),
        h('p', { id: 'ww-candidate' }, `${t('candidate')}: ${candidate.id} · ChangeSet ${candidate.binding.changeId} · Version ${candidate.binding.versionId} · Build ${candidate.binding.buildId}`),
        h('p', null, `${t('snapshot')}: ${candidate.snapshotPath} · SHA256 ${candidate.binding.snapshotHash}`),
        h('p', { id: 'ww-risk' }, `${t('riskLevel')}: ${t(risk)}`), h('ul', null, reasons.map((reason, index) => h('li', { key: index }, reason))),
        h('p', { id: 'ww-review-status' }, `${t('reviewStatus')}: ${t(active ? 'REVIEW_RUNNING' : review?.status ?? 'UNVERIFIED')}`),
        h('p', { id: 'ww-gate-result', role: verdict === 'ALLOW' ? 'status' : 'alert' }, t(verdict)),
        gate && !active && gateCurrent ? h('p', null, gate.reason) : null,
        review ? h('p', null, `${review.reason} · Session ${review.sessionId}`) : null,
        review?.report?.checks.length ? h('ul', { id: 'ww-review-checks' }, review.report.checks.map(check => h('li', { key: check.name },
          `${check.name}: ${check.status} · ${check.reason} · ${check.materialIds.join(', ')}`))) : null,
        review?.report?.issues.length ? h('ul', { id: 'ww-review-issues' }, review.report.issues.map((issue, index) => h('li', { key: index },
          `${t(issue.severity === 'must-fix' ? 'mustFix' : 'suggestionIssue')}: ${issue.description} ${issue.location ?? ''} · ${issue.materialIds.join(', ')}`))) : null,
        h('details', { id: 'ww-review-materials' }, h('summary', null, t('reviewEvidence')),
          h('ul', null, candidate.materials.map(m => h('li', { key: m.id }, `${m.id} · ${m.kind} · ${m.path ?? ''} · SHA256 ${m.sha256} · ${m.chars} chars${m.verifiable ? '' : ' · UNVERIFIED'}`))),
          h('ul', null, (review?.reads ?? []).map((r, index) => h('li', { key: index }, `${r.materialId} · ${r.offset}–${r.end} · ${r.callId} · ${r.sha256}`)))),
        verdict === 'AWAITING_APPROVAL' && !active && !released ? h('div', null, h('p', null, t('approvalScope')),
          h('div', { className: 'ww-actions' },
            h('button', { type: 'button', id: 'ww-approve-candidate', disabled: busy, onClick: () => approve(true) }, t('approveLocal')),
            h('button', { type: 'button', id: 'ww-reject-candidate', disabled: busy, onClick: () => approve(false) }, t('rejectCandidate')))) : null,
        !released && !active && review && review.status !== 'PASS' && q.attempts.filter(a => a.candidateId === candidate.id).length === 1
          ? h('button', { type: 'button', id: 'ww-rereview', disabled: busy, onClick: () => act('reReview', request('reReview')) }, t('reReview')) : null,
        !released && !active && review?.status === 'PASS' && ['ALLOW', 'REVIEW_INCOMPLETE'].includes(verdict)
          ? h('button', { type: 'button', id: 'ww-resume-candidate', disabled: busy, onClick: () => act('resumeCandidate', request('resumeCandidate')) }, t('resumeCandidate')) : null,
        h('details', { id: 'ww-review-history' }, h('summary', null, t('reviewHistory')),
          q.reviews.map(r => h('div', { key: r.id }, `${r.id} · Candidate ${r.binding.candidateId} · Version ${r.binding.versionId} · ${r.status} · ${r.endedAt} · ${r.reason}`)),
          q.approvals.map(a => h('div', { key: a.id }, `${a.candidateId} · Review ${a.reviewId} · ${a.accepted ? t('accepted') : t('rejected')} · ${a.scope} · ${a.at}`)),
          q.gates.map(g => h('div', { key: g.id }, `${g.candidateId} · ${t(g.verdict)} · ${g.at} · ${g.reason}`))));
    }

    function ProductWorkspace({ t, project, busy, act, onReload, acked, setAcked, wish, setWish }) {
      const change = project.changes.at(-1);
      const [revisions, setRevisions] = React.useState({});
      const revisionRequests = React.useRef(new Map());
      const refs = new Set([change?.id, ...project.runs.filter(r => r.changeId === change?.id).map(r => r.id)]);
      // Expand only explicit persisted links; the Host validates associations authoritatively.
      for (let i = 0; i < project.decisions.length; i++) for (const d of project.decisions) if (refs.has(d.source?.ref)) refs.add(d.id);
      const majorDecisions = project.decisions.filter(d => d.risk === 'major' && refs.has(d.id));
      const unresolved = majorDecisions.filter(d => d.status !== 'accepted' && !majorDecisions.some(n => n.source?.kind === 'user' && n.source.ref === d.id));
      const decisionPaused = change?.status === 'blocked' && majorDecisions.length > 0 && !project.builds.some(b => b.changeId === change.id);
      const pendingDecisions = decisionPaused ? unresolved.filter(d => d.status === 'proposed') : [];
      const rejectedDecisions = decisionPaused ? unresolved.filter(d => d.status === 'rejected') : [];
      const running = change && ['pending', 'running'].includes(change.status);
      const stuck = change && ['failed', 'uncertain', 'blocked'].includes(change.status);
      const groups = { pending: [], running: [], completed: [], failed: [], blocked: [], uncertain: [] };
      for (const task of project.tasks) groups[groupOf(task)].push(task);
      const release = project.releases.at(-1);
      const build = project.builds.filter(b => b.changeId === change?.id).at(-1);
      const version = project.versions.at(-1);
      const currentTests = project.evidence.filter(e => e.changeId === change?.id && e.kind === 'test');
      const lastTest = currentTests.at(-1);
      const currentCandidate = project.quality?.candidates.filter(c => c.binding.changeId === change?.id).at(-1);
      const waitingApproval = !running && currentCandidate && project.quality.gates.filter(g => g.candidateId === currentCandidate.id).at(-1)?.verdict === 'AWAITING_APPROVAL';
      const evidenceFor = ids => project.evidence.filter(e => ids.includes(e.id));
      const confirmed = project.requirements.filter(r => r.confirmation === 'confirmed');
      const inferred = project.requirements.filter(r => r.confirmation === 'inferred');
      React.useEffect(() => {
        if (!running) return undefined;
        const timer = setInterval(onReload, 4000);
        return () => clearInterval(timer);
      }, [running, onReload]);
      const taskRow = task => h('div', { className: 'ww-task', key: task.id, id: `ww-task-${short(task.id)}` },
        h('div', null, h('span', { className: 'ww-tag' }, task.phase), h('span', { className: 'ww-tag' }, t(task.category)),
          h('span', { className: 'ww-tag' }, t(groupOf(task))), task.description),
        h('dl', null,
          h('dt', null, t('taskId')), h('dd', null, task.id),
          task.dependencies.length ? h('dt', null, t('dependencies')) : null,
          task.dependencies.length ? h('dd', null, task.dependencies.map(short).join(', ')) : null,
          task.result ? h('dt', null, t('result')) : null,
          task.result ? h('dd', null, task.result) : null,
          evidenceFor(task.evidenceIds).length ? h('dt', null, t('evidence')) : null,
          evidenceFor(task.evidenceIds).length ? h('dd', { id: `ww-task-evidence-${short(task.id)}` },
            evidenceFor(task.evidenceIds).map(e => `${t(e.kind)} exit=${e.exitCode ?? 'n/a'} ${e.success ? t('passedMark') : '✗'}`).join('; ')) : null));
      const bucket = (key, items) => items.length
        ? h('div', { key }, h('h4', null, `${t(key)} (${items.length})`), items.map(taskRow))
        : null;
      return h('section', { id: 'ww-workspace' },
        h('h3', { id: 'ww-product-title' }, project.title),
        h('p', null, `${t('workspace')}: ${project.workspace}`),
        h('dl', { id: 'ww-overview' },
          h('dt', null, t('productStatus')), h('dd', { id: 'ww-status-label' }, t(project.status)),
          h('dt', null, t('revision')), h('dd', { id: 'ww-revision' }, String(project.revision)),
          h('dt', null, t('goal')), h('dd', { id: 'ww-goal' }, project.goal || '—'),
          h('dt', null, t('currentWish')), h('dd', { id: 'ww-current-wish' }, project.currentWish || '—'),
          h('dt', null, t('version')), h('dd', { id: 'ww-version' }, version ? `${version.label} · ${t(version.status.toLowerCase())}${release?.versionId === version.id ? ` · ${t('releasedAt')} ${release.releasedAt}` : ''}` : '—')),

        h('h3', null, t('requirements')),
        h('ul', { id: 'ww-requirements-confirmed' }, confirmed.map(r => h('li', { key: r.id }, r.text))),
        inferred.length ? h('div', { id: 'ww-requirements-inferred' }, h('h4', null, t('inferredRequirements')),
          h('ul', null, inferred.map(r => h('li', { key: r.id }, r.text)))) : null,

        project.constraints.length ? h('div', { id: 'ww-constraints' }, h('h3', null, t('constraints')),
          h('ul', null, project.constraints.map(c => h('li', { key: c.id }, `${c.text} (${t(c.confirmation)})`)))) : null,

        pendingDecisions.length ? h('div', { className: 'ww-card', id: 'ww-decisions' },
          h('h3', null, t('decisions')),
          pendingDecisions.map(d => h('div', { key: d.id },
            h('p', null, `${d.text} — ${t('major')}`),
            h('div', { className: 'ww-actions' },
              h('button', { type: 'button', id: 'ww-accept', disabled: busy,
                onClick: () => act('decide', { projectId: project.id, decisionId: d.id, expectedRevision: project.revision, accepted: true }) }, t('accept')),
              h('button', { type: 'button', id: 'ww-reject', disabled: busy,
                onClick: () => act('decide', { projectId: project.id, decisionId: d.id, expectedRevision: project.revision, accepted: false }) }, t('reject')))))) : null,
        decisionPaused ? h('div', { id: 'ww-decision-paused', className: 'ww-card' },
          h('p', null, t('decisionPaused')),
          rejectedDecisions.map(d => h('div', { key: d.id },
            h('label', { htmlFor: `ww-revision-${d.id}` }, `${t('revisionText')}: ${d.text}`),
            h('textarea', { id: `ww-revision-${d.id}`, maxLength: 10000, disabled: busy, value: revisions[d.id] ?? '',
              onChange: e => setRevisions({ ...revisions, [d.id]: e.target.value }) }),
            h('button', { type: 'button', id: `ww-revise-${d.id}`, disabled: busy || !(revisions[d.id] ?? '').trim() || revisions[d.id]?.trim() === d.text.trim(),
              onClick: () => {
                const text = revisions[d.id].trim(), key = `${d.id}:${text}`;
                if (!revisionRequests.current.has(key)) revisionRequests.current.set(key, newId());
                act('reviseDecision', { projectId: project.id, decisionId: d.id, expectedRevision: project.revision, requestId: revisionRequests.current.get(key), text });
              } }, t('reviseDecision'))))) : null,
        project.decisions.length ? h('div', { id: 'ww-decision-history', className: 'ww-hint' },
          h('h4', null, t('decisions')),
          h('ul', null, project.decisions.map(d => h('li', { key: d.id, id: `ww-decision-${short(d.id)}` }, `${d.text} — ${t(d.risk)} · ${t(d.status)}`)))) : null,

        h('h3', null, t('plan')),
        project.tasks.length ? h('div', { id: 'ww-tasks' },
          bucket('pending', groups.pending), bucket('running', groups.running), bucket('completed', groups.completed),
          bucket('failed', groups.failed), bucket('blocked', groups.blocked), bucket('uncertain', groups.uncertain)) : h('p', { id: 'ww-tasks' }, t('noTasks')),

        h('h3', null, t('agentRuns')),
        project.runs.length ? h('table', { id: 'ww-runs' },
          h('thead', null, h('tr', null, ['session', 'provider', 'model', 'started', 'ended', 'modelCalls', 'toolCalls', 'failures', 'tokens', 'duration', 'reason'].map(key => h('th', { key }, t(key))))),
          h('tbody', null, project.runs.map(run => h('tr', { key: run.id, id: `ww-run-${short(run.id)}` },
            h('td', null, short(run.sessionId)), h('td', null, run.provider ?? t('notAvailable')), h('td', null, run.model ?? t('notAvailable')),
            h('td', null, run.startedAt), h('td', null, run.endedAt ?? '—'),
            h('td', null, String(run.modelCalls)), h('td', null, String(run.toolCalls)), h('td', null, String(run.failures)),
            h('td', null, `${run.inputTokens ?? '—'}/${run.outputTokens ?? '—'}`),
            h('td', null, run.durationMs === undefined ? '—' : `${run.durationMs} ms`),
            h('td', null, run.status === 'completed' ? t('completed') : `${t(run.status)}${run.reason ? `: ${run.reason}` : ''}`))))) : h('p', { id: 'ww-runs' }, t('noRuns')),

        h('h3', null, t('outcomes')),
        h('div', { className: 'ww-card', id: 'ww-build' },
          h('p', { id: 'ww-build-status' }, `${t('build')}: ${build ? `${t(build.status === 'passed' ? 'passed' : 'failedBuild')} · ${build.createdAt}` : t('noBuild')}`),
          build ? h('p', { id: 'ww-evidence-kinds' }, `${t('evidenceKinds')}: ${evidenceFor(build.evidenceIds).map(e => `${t(e.kind)} exit=${e.exitCode ?? 'n/a'}`).join('; ')}`) : null,
          h('p', { id: 'ww-test-status' }, `${t('tests')}: ${lastTest ? lastTest.success && lastTest.exitCode === 0 ? t('passedMark') : '✗' : t('missingMark')}`),
          h('p', { id: 'ww-artifacts' }, `${t('artifacts')}: ${project.artifacts.length ? project.artifacts.map(a => `${a.path} (${a.sha256.slice(0, 12)}…)`).join('; ') : t('noArtifacts')}`),
          release ? h('p', { id: 'ww-snapshot' }, `${t('snapshot')}: ${release.snapshotPath}`) : null,
          h('p', null, t('noEvidence'))),
        project.evidence.length ? h('table', { id: 'ww-evidence' },
          h('thead', null, h('tr', null, ['phase', 'exitCode', 'result', 'recordedAt', 'evidence'].map(key => h('th', { key }, t(key))))),
          h('tbody', null, project.evidence.map(e => h('tr', { key: e.id, id: `ww-evidence-${short(e.id)}` },
            h('td', null, t(e.kind)), h('td', null, e.exitCode === undefined ? '—' : String(e.exitCode)),
            h('td', null, e.success ? t('passedMark') : '✗'), h('td', null, e.recordedAt),
            h('td', null, e.summary))))) : null,

        h(QualityPanel, { t, project, busy, act }),
        h('h3', null, t('versionHistory')),
        h('div', { className: 'ww-card', id: 'ww-versions' },
          project.versions.length ? h('table', null,
            h('thead', null, h('tr', null, ['version', 'productStatus', 'releasedAt', 'startCommand'].map(key => h('th', { key }, t(key))))),
            h('tbody', null, project.versions.map(v => {
              const rel = project.releases.find(r => r.versionId === v.id);
              return h('tr', { key: v.id, id: `ww-version-${short(v.id)}` },
                h('td', null, v.label), h('td', null, t(v.status.toLowerCase()), rel && !rel.qualityGateId ? ` · ${t('legacyReview')}` : ''),
                h('td', null, rel ? rel.releasedAt : '—'),
                h('td', null, rel ? h('code', null, rel.startCommand) : '—'));
            }))) : h('p', null, t('noRelease')),
          release ? h('div', null,
            h('p', null, `${t('historicRelease')}: ${project.versions.find(v => v.id === release.versionId)?.label ?? release.versionId}`),
            h('p', { id: 'ww-start-command' }, `${t('startCommand')}: `, h('code', null, release.startCommand)),
            h('p', { id: 'ww-release-path' }, `${t('sourcePath')}: ${release.sourcePath}`),
            h('p', { id: 'ww-release-summary' }, `${t('summary')}: ${release.summary}`)) : null),

        h('h3', null, t('submit')),
        h('p', { id: 'ww-suggestion' }, decisionPaused ? t('decisionPaused') : waitingApproval ? t('AWAITING_APPROVAL') : t('suggestion')[project.status === 'delivered' ? 'deliver' : project.status] ?? t('suggestion').draft),
        stuck && !waitingApproval ? h('div', { className: 'ww-card', id: 'ww-stuck' },
          h('p', { role: 'alert' }, t(decisionPaused ? 'decisionPaused' : change.status === 'uncertain' ? 'uncertainExplanation' : 'failedExplanation')),
          change.status === 'uncertain' ? h('label', { htmlFor: 'ww-ack' }, h('input', { id: 'ww-ack', type: 'checkbox', checked: acked, onChange: e => setAcked(e.target.checked) }), ` ${t('retryAck')}`) : null,
          h('div', { className: 'ww-actions' },
            h('button', { type: 'button', id: 'ww-retry', disabled: busy || (decisionPaused && unresolved.length > 0) || (change.status === 'uncertain' && !acked),
              onClick: () => act('retry', { projectId: project.id, expectedRevision: project.revision, requestId: newId(), changeId: change.id, acknowledgeUncertain: acked }) }, t(decisionPaused ? 'resumePlan' : 'retry')))) : null,
        running || decisionPaused ? h('div', { className: 'ww-actions' }, h('button', { type: 'button', id: 'ww-cancel', disabled: busy, onClick: () => act('cancel', { projectId: project.id, changeId: change.id, expectedRevision: project.revision }) }, t('cancel'))) : null,
        h('label', { htmlFor: 'ww-wish' }, t('submit')),
        h('textarea', { id: 'ww-wish', value: wish, maxLength: 10000, disabled: busy || !!running, placeholder: t('wishPlaceholder'),
          onChange: e => setWish(e.target.value) }),
        h('div', { className: 'ww-actions' },
          h('button', { type: 'button', id: 'ww-submit', disabled: busy || !!running || change?.status === 'blocked' || change?.status === 'uncertain' || !!waitingApproval || !wish.trim(),
            onClick: () => act('submit', { projectId: project.id, expectedRevision: project.revision, requestId: newId(), wish }) }, t('submit'))));
    }

    function LegacyArea({ t, legacy, legacyActive, legacyDraft, setLegacyDraft, busy, onSelect, onCreate, onSave, onReload, onImport, dirty }) {
      const statusKey = value => value === 'draft' ? 'statusDraft' : value === 'confirmed' ? 'statusConfirmed' : 'statusArchived';
      return h('div', { id: 'ww-legacy-area' },
        h('h3', null, t('legacyArea')),
        h('p', { className: 'ww-hint' }, t('legacyHint')),
        h('nav', { className: 'ww-list', id: 'ww-legacy-list', 'aria-label': t('legacyArea') },
          legacy.map((row, index) => h('button', { type: 'button', key: row.id, id: `ww-legacy-product-${index}`, disabled: busy,
            'aria-pressed': legacyActive?.id === row.id, onClick: () => onSelect(row) }, row.title)),
          legacy.length ? null : h('p', null, t('legacyEmpty'))),
        legacyActive ? h('div', { className: 'ww-card' },
          h('label', { htmlFor: 'ww-legacy-title' }, t('legacyTitle')),
          h('input', { id: 'ww-legacy-title', value: legacyDraft.title, maxLength: 120, disabled: busy, onChange: e => setLegacyDraft({ ...legacyDraft, title: e.target.value }) }),
          h('label', { htmlFor: 'ww-legacy-wish' }, t('legacyWish')),
          h('textarea', { id: 'ww-legacy-wish', value: legacyDraft.wish, maxLength: 10000, disabled: busy, onChange: e => setLegacyDraft({ ...legacyDraft, wish: e.target.value }) }),
          h('label', { htmlFor: 'ww-legacy-status' }, t('legacyStatus')),
          h('select', { id: 'ww-legacy-status', value: legacyDraft.status, disabled: busy, onChange: e => setLegacyDraft({ ...legacyDraft, status: e.target.value }) },
            ['draft', 'confirmed', 'archived'].map(value => h('option', { value, key: value }, t(statusKey(value))))),
          h('div', { className: 'ww-actions' },
            h('button', { type: 'button', id: 'ww-legacy-save', disabled: busy || !legacyDraft.title.trim() || !dirty, onClick: onSave }, t('legacySave')),
            h('button', { type: 'button', id: 'ww-legacy-reload', disabled: busy, onClick: onReload }, t('reload')),
            h('button', { type: 'button', id: 'ww-legacy-import', disabled: busy, onClick: () => onImport(legacyActive.id) }, t('importP0')))) : null,
        h('form', { onSubmit: onCreate },
          h('h4', null, t('legacyNew')),
          h('label', { htmlFor: 'ww-legacy-new-title' }, t('legacyTitle')),
          h('input', { id: 'ww-legacy-new-title', value: legacyDraft.newTitle ?? '', maxLength: 120, disabled: busy, onChange: e => setLegacyDraft({ ...legacyDraft, newTitle: e.target.value }) }),
          h('label', { htmlFor: 'ww-legacy-new-wish' }, t('legacyWish')),
          h('textarea', { id: 'ww-legacy-new-wish', value: legacyDraft.newWish ?? '', maxLength: 10000, disabled: busy, onChange: e => setLegacyDraft({ ...legacyDraft, newWish: e.target.value }) }),
          h('div', { className: 'ww-actions' }, h('button', { type: 'submit', id: 'ww-legacy-create', disabled: busy || !(legacyDraft.newTitle ?? '').trim() }, t('legacyNew')))));
    }

    function Panel({ t, api }) {
      const [products, setProducts] = React.useState([]);
      const [legacy, setLegacy] = React.useState([]);
      const [active, setActive] = React.useState(null);
      const [legacyActive, setLegacyActive] = React.useState(null);
      const [legacyDraft, setLegacyDraft] = React.useState(blankDraft);
      const [form, setForm] = React.useState({ title: '', wish: '' });
      const [wish, setWish] = React.useState('');
      const [acked, setAcked] = React.useState(false);
      const [busy, setBusy] = React.useState(true);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const controller = React.useRef(null);
      const fail = cause => {
        if (cause.name === 'AbortError') return;
        setError(cause.code === 'wish-willow-p1/conflict' || cause.code === 'wish-willow/conflict' ? 'conflict'
          : cause.code === 'wish-willow-p1/invalid-input' || cause.code === 'wish-willow/invalid-input' ? 'invalid'
          : cause.code === 'wish-willow-p1/unsafe-decision-state' ? 'unsafeDecisionState'
          : cause.code === 'wish-willow-p1/busy' ? 'busy' : 'failure');
      };
      const run = React.useCallback(async (fn, { quiet = false } = {}) => {
        controller.current?.abort();
        const next = new AbortController();
        controller.current = next;
        if (!quiet) setBusy(true);
        try { return await fn(next.signal); }
        catch (cause) { fail(cause); return null; }
        finally { if (!next.signal.aborted && !quiet) setBusy(false); }
      }, []);
      const refresh = React.useCallback(async (preferredId, quiet) => run(async signal => {
        const list = await api.evolution('list', undefined, signal);
        setLegacy(await api.evolution('legacy', undefined, signal));
        setProducts(list);
        const wanted = preferredId ?? active?.id;
        const next = wanted ? await api.evolution('read', { projectId: wanted }, signal) : (list[0] ? await api.evolution('read', { projectId: list[0].id }, signal) : null);
        setActive(next);
        setError('');
        return next;
      }, { quiet }), [run, api, active?.id]);
      React.useEffect(() => { refresh(); return () => controller.current?.abort(); }, []);
      const act = async (method, input) => {
        const result = await run(signal => api.evolution(method, input, signal));
        if (result) {
          setNotice(method === 'submit' ? 'submitted' : method === 'retry' ? 'retried' : method === 'cancel' ? 'cancelled' : method === 'reReview' ? 'reviewStarted' : method === 'resumeCandidate' ? 'gateChecked' : method === 'approveCandidate' ? 'candidateDecisionSaved' : 'decided');
          if (['submit', 'retry'].includes(method)) setWish('');
          setAcked(false);
          await refresh(result.id, true);
        }
      };
      async function createProduct(event) {
        event.preventDefault();
        if (busy) return;
        const value = await run(signal => api.evolution('create', { requestId: newId(), title: form.title, wish: form.wish }, signal));
        if (value) { setForm({ title: '', wish: '' }); setNotice('saved'); await refresh(value.id, true); }
      }
      function selectLegacy(row) {
        setLegacyActive(row);
        setLegacyDraft({ ...legacyFields(row), newTitle: legacyDraft.newTitle ?? '', newWish: legacyDraft.newWish ?? '' });
        setError(''); setNotice('');
      }
      const legacyDirty = legacyActive
        ? JSON.stringify(legacyFields(legacyActive)) !== JSON.stringify({ title: legacyDraft.title, wish: legacyDraft.wish, status: legacyDraft.status })
        : false;
      async function saveLegacy() {
        if (!legacyActive) return;
        const value = await run(signal => api.products('update', { id: legacyActive.id, expectedRevision: legacyActive.revision,
          title: legacyDraft.title, wish: legacyDraft.wish, status: legacyDraft.status }, signal));
        if (value) {
          setLegacyActive(value);
          setLegacyDraft({ ...legacyFields(value), newTitle: legacyDraft.newTitle ?? '', newWish: legacyDraft.newWish ?? '' });
          setNotice('legacySaved');
          await refresh(active?.id, true);
        }
      }
      async function createLegacy(event) {
        event.preventDefault();
        if (busy) return;
        const value = await run(signal => api.products('create', { title: legacyDraft.newTitle, wish: legacyDraft.newWish ?? '', status: 'draft' }, signal));
        if (value) {
          setLegacyActive(value);
          setLegacyDraft({ ...legacyFields(value), newTitle: '', newWish: '' });
          setNotice('legacySaved');
          await refresh(active?.id, true);
        }
      }
      async function importLegacy(productId) {
        const value = await run(signal => api.evolution('importLegacy', { productId, requestId: newId() }, signal));
        if (value) { setNotice('imported'); await refresh(value.id, true); }
      }
      function reloadLegacy() {
        if (!legacyActive) return run(async signal => {
          setLegacy(await api.evolution('legacy', undefined, signal));
          return null;
        });
        return run(async signal => {
          const rows = await api.evolution('legacy', undefined, signal);
          setLegacy(rows);
          const fresh = rows.find(row => row.id === legacyActive.id);
          if (fresh) {
            setLegacyActive(fresh);
            setLegacyDraft({ ...legacyFields(fresh), newTitle: legacyDraft.newTitle ?? '', newWish: legacyDraft.newWish ?? '' });
          }
          setError(''); setNotice('');
          return fresh ?? null;
        });
      }
      return h('section', { className: 'ww', id: 'ww-app', 'aria-label': t('title'), 'aria-busy': busy },
        h('style', null, css),
        h('h2', null, t('title')), h('p', null, t('description')), h('p', { className: 'ww-hint' }, t('stageNote')),
        h('div', { className: 'ww-columns' },
          h('nav', { className: 'ww-list', id: 'ww-product-list', 'aria-label': t('productList') },
            products.map((row, index) => h('button', { type: 'button', key: row.id, id: `ww-product-${index}`, disabled: busy,
              'aria-pressed': active?.id === row.id, onClick: () => setActive(row) },
              `${row.title} · ${(row.versions.at(-1) ?? { label: '—' }).label}`)),
            products.length ? null : h('p', null, t(busy ? 'loading' : 'empty')),
            h('form', { onSubmit: createProduct },
              h('label', { htmlFor: 'ww-title' }, t('name')),
              h('input', { id: 'ww-title', value: form.title, required: true, maxLength: 120, disabled: busy, onChange: e => setForm({ ...form, title: e.target.value }) }),
              h('label', { htmlFor: 'ww-new-wish' }, t('wish')),
              h('textarea', { id: 'ww-new-wish', value: form.wish, maxLength: 10000, disabled: busy, onChange: e => setForm({ ...form, wish: e.target.value }) }),
              h('div', { className: 'ww-actions' }, h('button', { type: 'submit', id: 'ww-create', disabled: busy || !form.title.trim() || !form.wish.trim() }, t('create')))),
            h('div', { className: 'ww-actions' }, h('button', { type: 'button', id: 'ww-reload', disabled: busy, onClick: () => refresh(active?.id) }, t('reload')))),
          active
            ? h(ProductWorkspace, { t, project: active, busy, act, onReload: () => refresh(active.id, true), acked, setAcked, wish, setWish })
            : h('p', { id: 'ww-workspace-empty' }, t(busy ? 'loading' : 'empty'))),
        h('div', { className: 'ww-sep' }),
        h(LegacyArea, { t, legacy, legacyActive, legacyDraft, setLegacyDraft, busy,
          onSelect: selectLegacy, onCreate: createLegacy, onSave: saveLegacy, onReload: reloadLegacy, onImport: importLegacy, dirty: legacyDirty }),
        error && h('p', { role: 'alert', id: 'ww-error' }, t(error)),
        h('p', { role: 'status', id: 'ww-notice', 'aria-live': 'polite' },
          t(busy ? 'loading' : legacyDirty ? 'unsaved' : notice)));
    }
    return {
      inject: ['slots', 'locale', 'connection'],
      createApi, Panel, ProductWorkspace, QualityPanel, LegacyArea, dictionaries,
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'wish-willow: dictionaries');
        const api = createApi(ctx.connection);
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'wish-willow', order: 30,
          label: () => ctx.locale.bind(NS)('title'), locale: NS, inject: () => ({ api }),
        }, Panel));
      },
    };
  },
});

