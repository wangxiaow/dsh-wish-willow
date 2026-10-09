# P0 架构与决策

## 结构

- `src/model.js`：唯一 Zod 输入/记录 schema 和产品读写适配器，无 Session/模型耦合。
- `src/host.js`：标准 Cordis apply/inject；打开 `wish_willow` Domain 并拥有 close effect；`WishWillowService` 的公开 Remote list/create/update。
- `client.js`：官方 lazy ModuleLoader factory，仅 require 平台 React。additive `settings.section` 页面、locale 字典、主题 token CSS 与 Connection RPC。
- `cordis.patch.yml`：Bundle 插入唯一行，不 override DSH 内置插件。
- 数据：DSH Storage Domain → 既有路由 → JSON 后端。只增加领域，不自建存储/服务器/鉴权/Agent。

```text
Web / Desktop 共用 React 页面
    ↓ ctx.connection.rpc.call('/api', 'wishWillow/<method>', {args})
DSH Connection + Typert Gateway（既有信任、认证、载体）
    ↓ 已标记的公开 Remote 方法
WishWillowService → 严格 Zod 校验
    ↓ table.put / table.update（内部 CAS）
DSH Storage Domain → 原子 JSON 发布
```

## 决策及依据

1. **普通 JS 单 Bundle，而非核心 Fork/新服务**：官方 decoration template 已证明 manifest 和 factory 形式。没有证据需要改核心。
2. **根级设置页，而非会话 Sidebar**：运行时 `settings.section` 是 root/list/additive；没有 Session 时仍可使用，符合产品事实独立性。P0 页面规模很小，专用主面板推迟到 P1 决策。
3. **Storage Domain，而非 Session JSONL 或 LocalStorage**：官方明确将非会话数据放 Domain；复用写队列/持久性及卸载生命周期。源码显示 put/update 不自动 schema 校验，因此所有插件写入显式 parse。
4. **版本 + 乐观 CAS**：在 DSH table.update 的串行变换函数内比较 expectedRevision。读取/结果副本防止引用绕过持久写入。没有跨表事务需求。
5. **公开 Remote 装饰器 + 文档化 SRC 路径**：P0 用标准装饰器调用形式免转译、不手写私有 marker，不自建 RPC。Gateway 校验具名 JSON 参数；业务 schema 由插件严格校验。Client 直接用 Connection carrier，不声称有未生成的 `ctx.remote.wishWillow` 接口。SRC 是官方开发回退，不是严格生成的调用契约；如后续长期分发，优先迁移到官方 Typert 生成链并验证，但本次不实现下一阶段。
6. **不自建跨进程锁/迁移/后台刷新**：官方后端无多进程写锁、domain 无迁移；P0 明确单 Host、手动重读、坏数据失败关闭。未来是否采用官方更适合的后端由真实规模需求决定。
7. **手动标签**：draft/confirmed/archived 只描述产品记录，不产生 Agent/任务/版本流水线。

## 生命周期与安全

Cordis Service/locale/Slot effect 随 fiber 卸载撤销；领域 close 等待排队写入后释放。UI 请求随组件卸载取消，未保存草稿不自动被服务端覆盖。服务器方法只暴露三项，参数严格白名单；没有文件路径输入、shell、模型、私有文件访问或新凭据。

DSH Host 代码不受 Agent 工作区沙箱限制，安装应由用户信任代码后进行。RPC 复用 DSH 操作者身份，而非新增多租户授权系统。revision 仅保护单进程，JSON 写入原子性不是多进程互斥。

数据格式固定版本 1，不允许本版自动迁移/清空未知数据；禁用和卸载保留数据。存储路径属于 DSH_HOME，不随仓库/Session 生命周期改变。
