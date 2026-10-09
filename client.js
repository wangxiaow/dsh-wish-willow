window.__ModuleLoader__.load({
  id: 'dsh-wish-willow',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'wishWillow.p0';
    const dictionaries = {
      zh: {
        title: 'Wish Willow · P0', description: '独立于 DSH 会话的产品状态。此阶段仅保存数据，不执行自动编程。',
        name: '产品名称', wish: '软件愿望', status: '手动产品状态', draft: '草稿', confirmed: '已确认', archived: '已归档',
        new: '新建产品', save: '保存', saving: '处理中…', reload: '重新读取（放弃未保存修改）',
        loading: '读取中…', empty: '尚无产品，请创建第一条记录。', unsaved: '有未保存修改', saved: '已持久化保存',
        conflict: '此产品已被其他页面修改。你的草稿已保留，请重新读取后再编辑。',
        invalid: '请检查名称（1–120 字符）与愿望（最多 10000 字符）。', failure: '操作失败；草稿已保留。请检查连接或插件状态后重试。',
        id: '稳定产品 ID', revision: '修订号', updated: '更新时间', productList: '产品列表',
      },
      en: {
        title: 'Wish Willow · P0', description: 'Product state independent of DSH sessions. This phase stores data only; no autonomous coding.',
        name: 'Product name', wish: 'Software wish', status: 'Manual product status', draft: 'Draft', confirmed: 'Confirmed', archived: 'Archived',
        new: 'New product', save: 'Save', saving: 'Working…', reload: 'Reload (discard unsaved edits)',
        loading: 'Loading…', empty: 'No products yet. Create your first record.', unsaved: 'Unsaved edits', saved: 'Durably saved',
        conflict: 'Another page changed this product. Your draft is preserved; reload before editing again.',
        invalid: 'Check the name (1–120 characters) and wish (up to 10000 characters).', failure: 'Operation failed; draft preserved. Check connection or plugin status and retry.',
        id: 'Stable product ID', revision: 'Revision', updated: 'Updated', productList: 'Products',
      },
    };
    const css = `
      .ww-p0 { color:var(--dsw-alias-label-primary); max-width:860px; padding:20px; margin:auto; }
      .ww-p0 * { box-sizing:border-box; }
      .ww-p0 h2 { font-size:20px; margin:0 0 12px; }
      .ww-p0 p { color:var(--dsw-alias-label-secondary); line-height:1.6; }
      .ww-p0 .ww-columns { display:grid; grid-template-columns:minmax(130px,220px) minmax(0,1fr); gap:20px; }
      .ww-p0 .ww-list { display:flex; flex-direction:column; gap:8px; }
      .ww-p0 button,.ww-p0 input,.ww-p0 textarea,.ww-p0 select { font:inherit; color:inherit; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-1); padding:8px 12px; }
      .ww-p0 button { cursor:pointer; text-align:left; overflow-wrap:anywhere; }
      .ww-p0 button[aria-pressed=true] { border-color:var(--dsw-alias-brand-primary); }
      .ww-p0 :focus-visible { outline:2px solid var(--dsw-alias-brand-primary); outline-offset:2px; }
      .ww-p0 :disabled { opacity:.55; cursor:default; }
      .ww-p0 label { display:block; font-weight:500; margin:12px 0 6px; }
      .ww-p0 input,.ww-p0 textarea,.ww-p0 select { width:100%; }
      .ww-p0 textarea { resize:vertical; min-height:140px; }
      .ww-p0 .ww-actions { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0; }
      .ww-p0 dl { font-size:12px; overflow-wrap:anywhere; color:var(--dsw-alias-label-secondary); }
      .ww-p0 dd { margin:2px 0 8px; }
      .ww-p0 [role=alert] { color:var(--dsw-alias-state-error-primary); }
      @media(max-width:640px) { .ww-p0 { padding:12px; } .ww-p0 .ww-columns { grid-template-columns:1fr; } }
    `;

    /** Uses the actual DSH carrier; no raw fetch, custom server, or Desktop globals. */
    function createApi(connection) {
      return async function call(method, input, signal) {
        const result = await connection.rpc.call('/api', `wishWillow/${method}`,
          { args: method === 'list' ? {} : { input } }, signal);
        if (!result.ok) {
          const error = new Error(result.error.message);
          error.code = result.error.code;
          throw error;
        }
        return result.value;
      };
    }
    const blank = () => ({ title: '', wish: '', status: 'draft' });
    const fieldsOf = row => ({ title: row.title, wish: row.wish, status: row.status });

    function ProductPanel({ t, call }) {
      const [rows, setRows] = React.useState([]);
      const [base, setBase] = React.useState(null);
      const [draft, setDraft] = React.useState(blank);
      const [busy, setBusy] = React.useState(true);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const active = React.useRef(null);
      const dirty = JSON.stringify(draft) !== JSON.stringify(base ? fieldsOf(base) : blank());
      function showError(cause) {
        if (cause.name === 'AbortError') return;
        setError(cause.code === 'wish-willow/conflict' ? 'conflict' :
          cause.code === 'wish-willow/invalid-input' ? 'invalid' : 'failure');
      }
      function select(row) {
        setBase(row); setDraft(row ? fieldsOf(row) : blank()); setError(''); setNotice('');
      }
      async function reload(preferredId) {
        const controller = new AbortController();
        active.current?.abort(); active.current = controller;
        setBusy(true); setError(''); setNotice('');
        try {
          const next = await call('list', undefined, controller.signal);
          if (controller.signal.aborted) return;
          setRows(next); select(next.find(row => row.id === preferredId) ?? next[0] ?? null);
        } catch (cause) { if (!controller.signal.aborted) showError(cause); }
        finally { if (!controller.signal.aborted) setBusy(false); }
      }
      React.useEffect(() => {
        reload();
        return () => active.current?.abort();
      }, []);
      async function save(event) {
        event.preventDefault();
        if (busy) return;
        const controller = new AbortController(); active.current = controller;
        setBusy(true); setError(''); setNotice('');
        try {
          const value = await call(base ? 'update' : 'create', base ?
            { ...draft, id: base.id, expectedRevision: base.revision } : draft, controller.signal);
          if (controller.signal.aborted) return;
          setRows(previous => [value, ...previous.filter(row => row.id !== value.id)]);
          setBase(value); setDraft(fieldsOf(value)); setNotice('saved');
        } catch (cause) { if (!controller.signal.aborted) showError(cause); }
        finally { if (!controller.signal.aborted) setBusy(false); }
      }
      function edit(key, value) { setDraft(previous => ({ ...previous, [key]: value })); setNotice(''); }
      return h('section', { className: 'ww-p0', 'aria-label': t('title'), 'aria-busy': busy },
        h('style', null, css), h('h2', null, t('title')), h('p', null, t('description')),
        h('div', { className: 'ww-columns' },
          h('nav', { className: 'ww-list', 'aria-label': t('productList') },
            h('button', { type: 'button', disabled: busy || dirty, onClick: () => select(null) }, t('new')),
            rows.map(row => h('button', { type: 'button', key: row.id, disabled: busy || dirty,
              'aria-pressed': base?.id === row.id, onClick: () => select(row) }, row.title)),
            !rows.length && h('p', null, t(busy ? 'loading' : 'empty'))),
          h('form', { onSubmit: save },
            h('label', { htmlFor: 'ww-title' }, t('name')),
            h('input', { id: 'ww-title', value: draft.title, required: true, maxLength: 120, disabled: busy,
              onChange: event => edit('title', event.target.value) }),
            h('label', { htmlFor: 'ww-wish' }, t('wish')),
            h('textarea', { id: 'ww-wish', value: draft.wish, maxLength: 10000, disabled: busy,
              onChange: event => edit('wish', event.target.value) }),
            h('label', { htmlFor: 'ww-status' }, t('status')),
            h('select', { id: 'ww-status', value: draft.status, disabled: busy,
              onChange: event => edit('status', event.target.value) },
              ['draft', 'confirmed', 'archived'].map(status => h('option', { value: status, key: status }, t(status)))),
            h('div', { className: 'ww-actions' },
              h('button', { type: 'submit', disabled: busy || !draft.title.trim() || !dirty }, t(busy ? 'saving' : 'save')),
              h('button', { type: 'button', disabled: busy, onClick: () => reload(base?.id) }, t('reload'))),
            error && h('p', { role: 'alert' }, t(error)),
            h('p', { role: 'status', 'aria-live': 'polite' }, t(notice || (dirty ? 'unsaved' : busy ? 'loading' : ''))),
            base && h('dl', null,
              h('dt', null, t('id')), h('dd', null, base.id),
              h('dt', null, t('revision')), h('dd', null, String(base.revision)),
              h('dt', null, t('updated')), h('dd', null, base.updatedAt)))));
    }
    return {
      inject: ['slots', 'locale', 'connection'],
      createApi, ProductPanel, dictionaries,
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'wish-willow: dictionaries');
        const call = createApi(ctx.connection);
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'wish-willow-p0', order: 30,
          label: () => ctx.locale.bind(NS)('title'), locale: NS, inject: () => ({ call }),
        }, ProductPanel));
      },
    };
  },
});
