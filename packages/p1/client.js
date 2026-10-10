window.__ModuleLoader__.load({
  id: 'dsh-wish-willow-p1',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'wishWillow.p1';
    const dictionaries = {
      zh: {
        title: 'Wish Willow · P1', description: '许愿式编程：提交愿望，由真实 DSH Agent 规划、开发、构建并交付可运行软件。产品事实独立于会话并持久保存。',
        productList: '产品', newProduct: '新建产品', name: '产品名称', wish: '软件愿望', submit: '提交愿望', submitting: '已提交，正在执行…',
        reload: '重新读取', loading: '读取中…', empty: '尚无产品。请先新建产品并写下你的愿望。', importP0: '从 P0 产品导入', saving: '保存中…',
        goal: '产品目标', currentWish: '当前愿望', requirements: '已确认需求', confirmed: '用户确认', inferred: 'Agent 推断（未确认）', constraints: '核心约束', code: '源码',
        decisions: '需要你决策的事项', accept: '接受', reject: '拒绝', accepted: '已接受', rejected: '已拒绝', major: '重大',
        plan: '执行计划', pending: '待执行', running: '执行中', completed: '已完成', failed: '失败', blocked: '阻塞', uncertain: '状态待确认',
        taskId: '任务 ID', category: '类别', technical: '技术类', experience: '体验类', phase: '阶段', run: '运行记录', evidence: '证据', result: '实际结果', dependencies: '依赖',
        outcomes: '产品成果', version: '当前产品版本', build: '最近构建', tests: '测试状态', artifacts: '交付产物', startCommand: '启动方式', snapshot: '不可覆盖源码快照',
        workspace: '工作目录', released: '正式交付', planned: '计划中', built: '已构建', nextStep: '下一步建议', noBuild: '尚无构建记录', noRelease: '尚未交付版本',
        conflict: '此产品已被其他页面修改。你的草稿已保留，请重新读取后再编辑。', failure: '操作失败；草稿已保留。请检查连接或插件状态后重试。',
        invalid: '请检查名称（1–120 字符）与愿望（1–10000 字符）。', busy: '当前变更尚未结束，请先等待或处理，再提交新的愿望。',
        retry: '重试本次变更', retryAck: '我已检查工作目录并确认可以重试（可能有未知副作用）', retrying: '已提交重试…', cancel: '取消执行',
        failedExplanation: '执行失败会影响本次交付：不会产生新版本，也不会改写已交付历史。可查看失败任务、修复后重试，或提交修订愿望。',
        uncertainExplanation: 'Host 在执行中中断。为避免重复副作用，系统没有自动重跑：请检查工作目录，确认后再重试。',
        noEvidence: '没有真实构建、测试与运行证据时不会标记为已交付。',
        releasedAt: '交付时间', evidenceKinds: '证据类型', exitCode: '退出码', sources: '源码文件数',
        suggestion: { deliver: '愿望已交付，可在“启动方式”中本地运行；如需改动，继续提交新的愿望。', running: 'Agent 正在执行。可稍后刷新查看任务与证据。', blocked: '存在重大决策，需要你先接受或拒绝后再继续。', failed: '上次执行失败，请查看失败任务后重试或提交修订愿望。', uncertain: '执行状态待确认，请检查工作目录后显式重试。', draft: '尚未提交愿望。写下愿望即可开始。' },
      },
      en: {
        title: 'Wish Willow · P1', description: 'Wish-driven programming: submit a wish; a real DSH Agent plans, codes, builds and delivers running software. Product facts persist independently of sessions.',
        productList: 'Products', newProduct: 'New product', name: 'Product name', wish: 'Software wish', submit: 'Submit wish', submitting: 'Submitted; running…',
        reload: 'Reload', loading: 'Loading…', empty: 'No products yet. Create one and write your wish.', importP0: 'Import P0 product', saving: 'Saving…',
        goal: 'Product goal', currentWish: 'Current wish', requirements: 'Confirmed requirements', confirmed: 'Confirmed by user', inferred: 'Agent-inferred (unconfirmed)', constraints: 'Core constraints', code: 'Source',
        decisions: 'Decisions needed from you', accept: 'Accept', reject: 'Reject', accepted: 'Accepted', rejected: 'Rejected', major: 'Major',
        plan: 'Execution plan', pending: 'Pending', running: 'Running', completed: 'Completed', failed: 'Failed', blocked: 'Blocked', uncertain: 'Unconfirmed',
        taskId: 'Task ID', category: 'Category', technical: 'Technical', experience: 'Experience', phase: 'Phase', run: 'Agent run', evidence: 'Evidence', result: 'Actual result', dependencies: 'Depends on',
        outcomes: 'Product outcomes', version: 'Current version', build: 'Latest build', tests: 'Test status', artifacts: 'Deliverables', startCommand: 'Start command', snapshot: 'Immutable source snapshot',
        workspace: 'Workspace', released: 'Released', planned: 'Planned', built: 'Built', nextStep: 'Next step', noBuild: 'No build yet', noRelease: 'No release yet',
        conflict: 'Another page changed this product. Your draft is preserved; reload before editing.', failure: 'Operation failed; draft preserved. Check connection or plugin state and retry.',
        invalid: 'Check the name (1–120 characters) and wish (up to 10000 characters).', busy: 'The current change is unfinished. Wait or resolve it before submitting another wish.',
        retry: 'Retry this change', retryAck: 'I inspected the workspace and confirm retry (side effects may be unknown)', retrying: 'Retry submitted…', cancel: 'Cancel run',
        failedExplanation: 'The failure affects this delivery: no new version is produced and released history is unchanged. Inspect failed tasks, then retry or submit a revised wish.',
        uncertainExplanation: 'The Host was interrupted mid-run. Nothing was re-run automatically to avoid duplicate side effects; inspect the workspace, then retry explicitly.',
        noEvidence: 'Nothing is marked delivered without real build, test and run evidence.',
        releasedAt: 'Released at', evidenceKinds: 'Evidence kinds', exitCode: 'Exit code', sources: 'Source files',
        suggestion: { deliver: 'Delivered. Run it locally with the start command; submit a new wish for further changes.', running: 'The Agent is working. Refresh later to see tasks and evidence.', blocked: 'Major decisions are pending; accept or reject them to continue.', failed: 'The last run failed. Inspect failed tasks, then retry or submit a revised wish.', uncertain: 'Execution needs confirmation; inspect the workspace, then retry explicitly.', draft: 'No wish submitted yet. Write one to begin.' },
      },
    };
    const css = `
      .ww-p1 { color:var(--dsw-alias-label-primary); max-width:1040px; padding:20px; margin:auto; }
      .ww-p1 * { box-sizing:border-box; }
      .ww-p1 h2 { font-size:20px; margin:0 0 8px; }
      .ww-p1 h3 { font-size:15px; margin:20px 0 8px; }
      .ww-p1 p { color:var(--dsw-alias-label-secondary); line-height:1.6; margin:6px 0; }
      .ww-p1 .ww-columns { display:grid; grid-template-columns:minmax(150px,240px) minmax(0,1fr); gap:20px; align-items:start; }
      .ww-p1 .ww-list { display:flex; flex-direction:column; gap:8px; }
      .ww-p1 button,.ww-p1 input,.ww-p1 textarea,.ww-p1 select { font:inherit; color:inherit; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); padding:8px 12px; }
      .ww-p1 button { cursor:pointer; text-align:left; overflow-wrap:anywhere; }
      .ww-p1 button[aria-pressed=true] { border-color:var(--dsw-alias-brand-primary); }
      .ww-p1 :focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .ww-p1 :disabled { opacity:.55; cursor:default; }
      .ww-p1 label { display:block; font-weight:500; margin:10px 0 6px; }
      .ww-p1 input,.ww-p1 textarea { width:100%; }
      .ww-p1 textarea { resize:vertical; min-height:90px; }
      .ww-p1 .ww-actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
      .ww-p1 dl { font-size:12px; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); margin:4px 0; }
      .ww-p1 dd { margin:2px 0 8px; }
      .ww-p1 [role=alert] { color:var(--dsw-alias-state-error-primary); }
      .ww-p1 .ww-card { border:1px solid var(--dsw-alias-border-l2); border-radius:10px; padding:12px; margin:8px 0; background:var(--dsw-alias-bg-layer-1); }
      .ww-p1 .ww-task { border-left:3px solid var(--dsw-alias-border-l2); padding-left:10px; margin:8px 0; }
      .ww-p1 .ww-tag { display:inline-block; font-size:12px; border:1px solid var(--dsw-alias-border-l2); border-radius:999px; padding:1px 8px; margin-right:6px; }
      .ww-p1 code { overflow-wrap:anywhere; font-size:12px; }
      .ww-p1 ul { margin:6px 0 6px 18px; padding:0; }
      .ww-p1 li { line-height:1.6; overflow-wrap:anywhere; }
      @media(max-width:640px) { .ww-p1 { padding:12px; } .ww-p1 .ww-columns { grid-template-columns:1fr; } }
    `;
    function createApi(connection) {
      return async function call(method, input, signal) {
        const result = await connection.rpc.call('/api', `wishWillowP1/${method}`, { args: method === 'list' || method === 'legacy' ? {} : { input } }, signal);
        if (!result.ok) { const error = new Error(result.error.message); error.code = result.error.code; throw error; }
        return result.value;
      };
    }
    const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const short = value => String(value).slice(0, 8);
    const groupOf = task => task.status === 'completed' ? 'completed'
      : task.status === 'running' ? 'running'
      : ['failed', 'blocked'].includes(task.status) ? 'failed'
      : task.status === 'uncertain' ? 'uncertain' : 'pending';

    function Board({ t, call, project, onReload, busy, act }) {
      const pendingDecisions = project.decisions.filter(d => d.risk === 'major' && d.status === 'proposed');
      const change = project.changes.at(-1);
      const running = change && ['pending', 'running'].includes(change.status);
      const stuck = change && ['failed', 'uncertain', 'blocked'].includes(change.status);
      const [wish, setWish] = React.useState('');
      const [acked, setAcked] = React.useState(false);
      const groups = { pending: [], running: [], completed: [], failed: [], uncertain: [] };
      for (const task of project.tasks) groups[groupOf(task)].push(task);
      const release = project.releases.at(-1);
      const build = project.builds.at(-1);
      const version = release ? project.versions.find(v => v.id === release.versionId) : project.versions.at(-1);
      const evidenceFor = task => project.evidence.filter(e => task.evidenceIds.includes(e.id));
      React.useEffect(() => { if (running) { const timer = setInterval(onReload, 4000); return () => clearInterval(timer); } }, [running, onReload]);
      const taskRow = task => h('div', { className: 'ww-task', key: task.id },
        h('div', null, h('span', { className: 'ww-tag' }, task.phase), h('span', { className: 'ww-tag' }, t(task.category)), h('span', { className: 'ww-tag' }, t(groupOf(task))), task.description),
        h('dl', null,
          h('dt', null, t('taskId')), h('dd', null, task.id),
          task.dependencies.length ? h('dt', null, t('dependencies')) : null,
          task.dependencies.length ? h('dd', null, task.dependencies.map(short).join(', ')) : null,
          task.result ? h('dt', null, t('result')) : null, task.result ? h('dd', null, task.result) : null,
          evidenceFor(task).length ? h('dt', null, t('evidence')) : null,
          evidenceFor(task).length ? h('dd', null, evidenceFor(task).map(e => `${t(e.kind)} exit=${e.exitCode ?? 'n/a'} ${e.success ? '✓' : '✗'}`).join('; ')) : null));
      const bucket = (key, items) => items.length ? h('div', null, h('h3', null, `${t(key)} (${items.length})`), items.map(taskRow)) : null;
      return h('section', null,
        h('h2', null, project.title),
        h('p', null, `${t('workspace')}: ${project.workspace}`),
        h('h3', null, t('goal')), h('p', null, project.goal),
        h('h3', null, t('currentWish')), h('p', null, project.currentWish || '—'),
        h('h3', null, t('version')), h('p', null, version ? `${version.label} · ${t(version.status.toLowerCase())}${release ? ` · ${t('releasedAt')} ${release.releasedAt}` : ''}` : '—'),
        h('h3', null, t('requirements')),
        h('ul', null, project.requirements.filter(r => r.confirmation === 'confirmed').map(r => h('li', { key: r.id }, r.text))),
        project.requirements.some(r => r.confirmation === 'inferred')
          ? h('div', null, h('h3', null, t('inferred')), h('ul', null, project.requirements.filter(r => r.confirmation === 'inferred').map(r => h('li', { key: r.id }, r.text)))) : null,
        project.constraints.length ? h('div', null, h('h3', null, t('constraints')), h('ul', null, project.constraints.map(c => h('li', { key: c.id }, `${c.text} (${t(c.confirmation)})`)))) : null,
        pendingDecisions.length ? h('div', { className: 'ww-card' },
          h('h3', null, t('decisions')),
          pendingDecisions.map(d => h('div', { key: d.id },
            h('p', null, `${d.text} — ${t('major')}`),
            h('div', { className: 'ww-actions' },
              h('button', { type: 'button', disabled: busy, onClick: () => act('decide', { projectId: project.id, decisionId: d.id, expectedRevision: project.revision, accepted: true }) }, t('accept')),
              h('button', { type: 'button', disabled: busy, onClick: () => act('decide', { projectId: project.id, decisionId: d.id, expectedRevision: project.revision, accepted: false }) }, t('reject')))))) : null,
        h('h3', null, t('plan')),
        bucket('pending', groups.pending), bucket('running', groups.running), bucket('completed', groups.completed),
        bucket('failed', groups.failed), bucket('uncertain', groups.uncertain),
        h('h3', null, t('outcomes')),
        h('div', { className: 'ww-card' },
          h('p', null, `${t('build')}: ${build ? `${t(build.status)} · ${build.createdAt}` : t('noBuild')}`),
          build ? h('p', null, `${t('evidenceKinds')}: ${project.evidence.filter(e => build.evidenceIds.includes(e.id)).map(e => `${t(e.kind)} exit=${e.exitCode ?? 'n/a'}`).join('; ')}`) : null,
          build ? h('p', null, `${t('tests')}: ${project.evidence.some(e => e.kind === 'test' && e.success) ? '✓' : '—'}`) : null,
          h('p', null, `${t('artifacts')}: ${project.artifacts.length ? project.artifacts.map(a => `${a.path} (${a.sha256.slice(0, 12)}…)`).join('; ') : '—'}`),
          release ? h('p', null, `${t('snapshot')}: ${release.snapshotPath}`) : null,
          release ? h('p', null, `${t('startCommand')}: `, h('code', null, release.startCommand)) : h('p', null, t('noRelease')),
          h('p', null, t('noEvidence'))),
        h('h3', null, t('nextStep')),
        h('p', null, t('suggestion')[release ? 'deliver' : project.status] ?? t('suggestion').draft),
        stuck ? h('div', { className: 'ww-card' },
          h('p', { role: 'alert' }, t(change.status === 'uncertain' ? 'uncertainExplanation' : 'failedExplanation')),
          change.status === 'uncertain' ? h('label', null, h('input', { type: 'checkbox', checked: acked, onChange: e => setAcked(e.target.checked) }), ` ${t('retryAck')}`) : null,
          h('div', { className: 'ww-actions' },
            h('button', { type: 'button', disabled: busy || (change.status === 'uncertain' && !acked),
              onClick: () => act('retry', { projectId: project.id, expectedRevision: project.revision, requestId: newId(), changeId: change.id, acknowledgeUncertain: acked }) }, t('retry')))) : null,
        running ? h('div', { className: 'ww-actions' }, h('button', { type: 'button', disabled: busy, onClick: () => act('cancel', { projectId: project.id }) }, t('cancel'))) : null,
        h('h3', null, t('submit')),
        h('textarea', { id: 'ww-p1-wish', value: wish, maxLength: 10000, disabled: busy || !!running, onChange: e => setWish(e.target.value), 'aria-label': t('wish') }),
        h('div', { className: 'ww-actions' },
          h('button', { type: 'button', id: 'ww-p1-submit', disabled: busy || !!running || !wish.trim(),
            onClick: async () => { await act('submit', { projectId: project.id, expectedRevision: project.revision, requestId: newId(), wish }); setWish(''); } }, t('submit'))));
    }

    function Panel({ t, call }) {
      const [rows, setRows] = React.useState([]);
      const [legacy, setLegacy] = React.useState([]);
      const [active, setActive] = React.useState(null);
      const [form, setForm] = React.useState({ title: '', wish: '' });
      const [busy, setBusy] = React.useState(true);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const controller = React.useRef(null);
      const fail = cause => { if (cause.name === 'AbortError') return; setError(cause.code === 'wish-willow-p1/conflict' ? 'conflict' : cause.code === 'wish-willow-p1/invalid-input' ? 'invalid' : cause.code === 'wish-willow-p1/busy' ? 'busy' : 'failure'); };
      const run = React.useCallback(async (fn, { quiet = false } = {}) => {
        controller.current?.abort(); const next = new AbortController(); controller.current = next;
        if (!quiet) setBusy(true);
        try { return await fn(next.signal); } catch (cause) { fail(cause); return null; } finally { if (!next.signal.aborted && !quiet) setBusy(false); }
      }, []);
      const refresh = React.useCallback(async (preferredId, quiet) => run(async signal => {
        const list = await call('list', undefined, signal);
        setLegacy(await call('legacy', undefined, signal));
        setRows(list);
        const id = preferredId ?? active?.id;
        const selected = id ? await call('read', { projectId: id }, signal) : (list[0] ?? null);
        setActive(selected ? await call('read', { projectId: selected.id }, signal) : null);
        setError(''); return selected;
      }, { quiet }), [run, call, active?.id]);
      React.useEffect(() => { refresh(); return () => controller.current?.abort(); }, []);
      const act = async (method, input) => {
        const result = await run(signal => call(method, input, signal));
        if (result) { setNotice(method); setActive(result); await refresh(result.id, true); }
      };
      async function createProduct(event) {
        event.preventDefault(); if (busy) return;
        const value = await run(signal => call('create', { requestId: newId(), title: form.title, wish: form.wish }, signal));
        if (value) { setForm({ title: '', wish: '' }); setActive(value); setNotice('create'); await refresh(value.id, true); }
      }
      return h('section', { className: 'ww-p1', 'aria-label': t('title'), 'aria-busy': busy },
        h('style', null, css), h('h2', null, t('title')), h('p', null, t('description')),
        h('div', { className: 'ww-columns' },
          h('nav', { className: 'ww-list', 'aria-label': t('productList') },
            rows.map(row => h('button', { type: 'button', key: row.id, disabled: busy, 'aria-pressed': active?.id === row.id,
              onClick: () => setActive(row) }, `${row.title} · ${(row.versions.at(-1) ?? { label: '—' }).label}`)),
            !rows.length && h('p', null, t(busy ? 'loading' : 'empty')),
            h('form', { onSubmit: createProduct },
              h('label', { htmlFor: 'ww-p1-title' }, t('name')),
              h('input', { id: 'ww-p1-title', value: form.title, required: true, maxLength: 120, disabled: busy, onChange: e => setForm({ ...form, title: e.target.value }) }),
              h('label', { htmlFor: 'ww-p1-new-wish' }, t('wish')),
              h('textarea', { id: 'ww-p1-new-wish', value: form.wish, maxLength: 10000, disabled: busy, onChange: e => setForm({ ...form, wish: e.target.value }) }),
              h('div', { className: 'ww-actions' }, h('button', { type: 'submit', disabled: busy || !form.title.trim() || !form.wish.trim() }, t('newProduct')))),
            legacy.length ? h('div', null, h('label', null, t('importP0')),
              legacy.map(row => h('button', { type: 'button', key: row.id, disabled: busy,
                onClick: async () => { const value = await run(signal => call('importLegacy', { productId: row.id, requestId: newId() }, signal)); if (value) { setActive(value); await refresh(value.id, true); } } }, row.title))) : null,
            h('div', { className: 'ww-actions' }, h('button', { type: 'button', disabled: busy, onClick: () => refresh(active?.id) }, t('reload')))),
          active ? h(Board, { t, call, project: active, busy, act, onReload: () => refresh(active.id, true) })
            : h('p', null, t(busy ? 'loading' : 'empty'))),
        error && h('p', { role: 'alert' }, t(error)),
        h('p', { role: 'status', 'aria-live': 'polite' }, t(busy ? 'loading' : notice ? 'saving' : '')));
    }
    return {
      inject: ['slots', 'locale', 'connection'],
      createApi, Panel, Board, dictionaries,
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'wish-willow: p1 dictionaries');
        const call = createApi(ctx.connection);
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'wish-willow-p1', order: 31,
          label: () => ctx.locale.bind(NS)('title'), locale: NS, inject: () => ({ call }),
        }, Panel));
      },
    };
  },
});
