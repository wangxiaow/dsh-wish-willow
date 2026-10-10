# 架构与决策（P0 + P1）

## 结构

### P0（已验收，保持不变）

- `src/model.js`：P0 唯一 Zod 输入/记录 schema 和产品读写适配器，无 Session/模型耦合。
- `src/host.js`：标准 Cordis apply/inject；打开 `wish_willow` Domain 并拥有 close effect；`WishWillowService` 的公开 Remote list/create/update。
- `client.js`：官方 lazy ModuleLoader factory，仅 require 平台 React。additive `settings.section` 页面、locale 字典、主题 token CSS 与 Connection RPC。
- `cordis.patch.yml`：Bundle 插入唯一行，不 override DSH 内置插件。

### P1（本次新增，独立 companion Bundle）

- `packages/p1/src/state.js`：一个产品的完整正式状态（Project/Requirement/Constraint/Decision/Task/AgentRun/ChangeSet/Evidence/Artifact/Build/Version/Release/History）的 Zod schema、持久幂等创建、CAS 变更、恢复语义、证据门禁。
- `packages/p1/src/orchestrator.js`：最小主 Agent。同一个真实 DSH root Agent 顺序执行「规划 → 编码」，通过 scoped 私有工具写入产品状态并采集真实证据。
- `packages/p1/src/artifacts.js`：受控工作目录的不可覆盖源码快照（大小/数量上限、拒绝符号链接与凭据类文件）。
- `packages/p1/src/host.js`：`wishWillowP1` Service 与 `wish_willow_p1` Domain 的 apply/inject、Remote 方法与生命周期。
- `packages/p1/client.js`：additive `settings.section` 产品演化看板（order 31），与 P0 页面并存。
- `packages/p1/cordis.patch.yml`：P1 唯一插件行。

```text
Web / Desktop 共用 React 看板
    ↓ ctx.connection.rpc.call('/api', 'wishWillowP1/<method>', {args})
Wish Willow P1 Service（严格 Zod 校验）
    ↓ table.put / table.update（内部 CAS 串行变换）
DSH Storage Domain wish_willow_p1（JSON 原子发布）
    ↓ 正式状态
Orchestrator ── ctx.agents.create(setup) ──> 真实 DSH Agent（默认 preset + 默认模型）
    │                 ├─ scoped systemPrompt 段 + 私有产品工具
    │                 ├─ session log（sandbox/mode、approval/policy、turn、tool）
    │                 └─ 既有 fs / pwsh / 沙箱 / 审批 / Session 持久化
    └─ 真实工具退出码 → Evidence → Build → Version → Release
```

## 关键决策及依据

1. **P1 作为独立 Bundle，不修改已验收 P0 包**：P0 的 `products` 是 strict schema，加字段会让旧 schema 不能回读；同一 JSON unit 增表会被旧后端按已声明表重新序列化而丢数据；替换已装包需要完整重启当前 Host。因此新增 `packages/p1`，P0 记录只在用户显式导入时按 UUID 复制只读快照（`legacy.snapshot` 逐字符串保留）。见 [P1 状态兼容](<P1-STATE-COMPATIBILITY.md>)。
2. **一个产品的全部正式状态放在一条聚合记录里**：DSH Domain 只有单表串行写链，没有跨表事务。聚合记录让「用户愿望 + 需求 + 任务 + 运行 + 证据 + 版本」在同一个 CAS 变换内保持一致，也避免 P1 自建事务层。
3. **真实 Agent 用公开 `ctx.agents.create` + `setup` + `followup`/`whenIdle`**：官方已核实的唯一驱动接口；不复制模型调用框架，不使用 Teams/Workflow/subagents，也不虚构多 Agent 分工。模型与 preset 显式继承用户默认（`agentDefaultModel.currentSelection()`、`agentPresets.resolve()` + `mount`），因为 `parentAgent` 只表示运行时所有权。
4. **权限只收窄、不扩大**：在 setup 用官方 `setSandboxMode` 把新 Session 固定为不高于部署默认的 `workspace-write`（只读来源保持只读），并用 `setApprovalPolicy(session,'never')` 保持 fail-closed；不修改用户既有 Session。scoped guard 拒绝任何 `sandbox_permissions` 参数与工作目录之外的 `workdir`。
5. **证据门禁在 Host，不在模型自述**：`wish_verify` 实际调用 DSH 的 `pwsh` 工具并读取结构化前台结果（exitCode/aborted/timedOut/sandbox.denied）。只有同一 ChangeSet 内 `code` 修改 + `build`/`test`/`run` 三类真实 exit 0，`wish_deliver` 才被允许；Built 与 Released 分离，Release 记录只追加。
6. **交付以不可覆盖快照为准**：源码在提交交付时被复制到受控目录之外的快照目录，并记录逐文件 SHA256；快照已存在但内容不同即失败，不静默覆盖历史交付。
7. **任务级状态，不编造百分比**：看板按 待执行/执行中/已完成/失败/待确认 分组，展示任务 ID、阶段、类别、依赖、运行记录与证据；没有可靠进度事件就不显示百分比。
8. **中断不自动重跑**：Host 启动时把遗留的 pending/running 任务、运行与 ChangeSet 标为 `uncertain`，重试需要显式操作；重试有 3 次上限，不确定状态还需先确认。
9. **重大决策显式阻塞**：Agent 只能通过 `wish_plan` 提出 `major` 决策；产品进入 blocked，只有用户通过看板 `decide` 才能接受或拒绝，之后才允许继续。

## 生命周期与安全

- Cordis Service/locale/Slot effect 随 fiber 卸载撤销；P1 的 domain close 与 Orchestrator 关闭按顺序串在同一个 effect 里，先取消并等待真实 Agent，再关闭 Domain。
- Orchestrator 有步数上限（默认 60 步）与运行时限（默认 15 分钟），触发即取消该 Agent 并把 ChangeSet 记为失败，不做无限重试。
- 凭据类文本在写入产品状态前做模式化遮蔽；源码快照排除 `node_modules`、`.git`、`.env*`、凭据文件名模式；不读取 DSH 凭据文件。
- Host 代码不受 Agent 工作区沙箱限制，安装应由用户信任代码后进行；RPC 复用 DSH 操作者身份。
- P0 与 P1 都由**同一个 Host** 写入；JSON 后端没有跨进程写锁。
