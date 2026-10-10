# 架构与决策（统一 Bundle 0.3.1）

## 产品形态

**用户只安装一个 Wish Willow（`dsh-wish-willow` 0.3.1），只看到一个统一工作台。** 内部仍由多个模块、多个 Service、多个存储 Domain 组成，P2/P3 继续在同一架构内扩展（新增内部模块），而不是每阶段新增一个插件。

```text
统一 Bundle：dsh-wish-willow@0.3.1
  cordis.patch.yml  → 唯一 insert：id wish-willow / name dsh-wish-willow
        │
  src/host.js（组合根，Cordis plugin row）
        ├─ 先 applyP0(ctx)  → src/p0/*    Domain wish_willow v1 / products + Service wishWillow
        └─ 再 applyP1(ctx)  → packages/p1/* Domain wish_willow_p1 v1 / projects + Service wishWillowP1
                                      └─ Orchestrator → 真实 DSH Agent（官方 ctx.agents.create）

Client：client.js（唯一模块，id=dsh-wish-willow）
  settings.section#wish-willow (order 30) —— 统一工作台
    ├─ 统一产品状态：愿望、已确认/推断需求、约束、决策、任务、AgentRun、证据、Build、Version、Release、下一步
    └─ 旧 P0 产品：查看/编辑（CAS）/按 UUID 幂等导入
        ↓ ctx.connection.rpc.call('/api', 'wishWillow*/<method>')
```

## 模块边界

| 模块 | 文件 | 职责 | 不可越界 |
|---|---|---|---|
| P0 模块 | `src/p0/host.js`、`src/p0/model.js` | 旧产品状态（Domain `wish_willow` v1 / `products`，Service `wishWillow`，list/create/update） | 逻辑与已验收 P0 一致；`products` 为 strict schema，不加字段 |
| P1 模块 | `packages/p1/src/{host,state,orchestrator,artifacts}.js` | 正式产品演化状态（Domain `wish_willow_p1` v1 / `projects`，Service `wishWillowP1`）、最小 Orchestrator、证据门禁、不可覆盖快照 | 一个产品一条聚合记录；只通过 CAS 串行变换写入 |
| 组合根 | `src/host.js` | `name='wish-willow'`、`inject=两模块并集`、按序调用两个模块的 `apply` | **不复制业务逻辑、不返回任何值**（Cordis 会把返回值当 effect） |
| Client | `client.js` | 唯一 `settings.section` 条目 `wish-willow`，双语字典，主题 token CSS，RPC 适配 | 不引入新 UI 框架、不做 RPC 之外的数据旁路 |

## 关键决策及依据

1. **一个 Bundle、一行 Loader、一个 Client 模块**：官方 `dsh.bundle.patch` 支持多行与子路径，但 `dsh-client-modules` 按 Loader row 扫描声明了 `dsh.client` 的包，同一个包插入两行会让同一个 `client.js` 被装载两次（模块 id 必须等于 package name），属于重复注册。因此「用户层面统一 + 内部模块独立」由**一行 + 组合根 + 单 Client**实现，而不是把两个 Host 文件合并成一个大文件。
2. **存储 Domain 一律不动**：`wish_willow` 与 `wish_willow_p1` 的名称、版本、表名、schema 全部保持原样，旧文件可直接被统一 Bundle 读取，升级不需要数据迁移，也不改写任何已交付历史。
3. **正式产品状态来源唯一**：统一后权威状态是 P1 聚合记录；P0 记录保留为可编辑、可导入的旧数据源，导入按 UUID 幂等（重复导入返回同一产品，源文件字节不变）。这样既统一入口，又不把两种历史强行拼接。
4. **组合顺序**：先开 P0 模块（供 `legacy()` 读取），再开 P1 模块（Orchestrator 需要 agent 等服务）；`inject` 取并集，避免 P0 侧因缺 Agent 服务而无法装载。
5. **真实 Agent 用官方接口**：`ctx.agents.create` + `setup` + `followup`/`whenIdle`，模型与 preset 继承用户默认；不复制模型调用框架、不使用 Teams/Workflow。
6. **权限只收窄**：新 Session 固定为不高于部署默认的 `workspace-write`（只读来源保持只读）与 `approval: never`；工具守卫拒绝任何 `sandbox_permissions` 与工作目录之外的 `workdir`。
7. **证据门禁在 Host**：只有同一 ChangeSet 内确有 `code` 修改且 `build`/`test`/`run` 三类真实前台 exit 0，`wish_deliver` 才被允许；Built 与 Released 分离，Release 只追加。
8. **交付以不可覆盖快照为准**：源码复制到受控目录之外的快照目录并记录逐文件 SHA256；快照已存在但内容不同即失败。
9. **中断不自动重跑**：Host 启动时把遗留 pending/running 标为 `uncertain`，重试需显式确认且上限 3 次；执行有步数（60）与时限（900 s）上限。
10. **升级顺序**：必须先移除旧 `dsh-wish-willow-p1` 再安装统一 Bundle，否则同一 Host 会出现重复的 `wishWillowP1` 注册。插件管理器返回 `restart-required` 时，Host 侧 row 需重启 DSH 才生效（Client 入口通常立即更新）。

## 生命周期与部署约束

- Cordis Service/locale/Slot/effect 随 fiber 卸载撤销；组合根把 P1 的 domain close 与 Orchestrator 关闭串在同一 effect 中：**先取消并等待真实 Agent，再关闭两个 Domain**。停用或卸载不写任何产品数据。
- **同一存储 root 只允许一个写入 Host**：JSON 后端没有跨进程写锁，revision CAS 只保证同一 Host 内并发页面不静默覆盖。验收时 Desktop 与 Web 使用完全隔离的 `$DSH_HOME`。
- 工作目录为 `$DSH_HOME/wish-willow/projects/<projectId>`，交付快照在 `$DSH_HOME/wish-willow/deliveries/<projectId>/<versionId>/source`。
- Windows 沙箱的写入授权（`grantWrite`）要求工作目录对当前用户具备 WRITE_OWNER；用户 profile 下的默认目录满足，受限目录会在执行前失败并如实记录（见 `docs/P1-UNIFICATION-REPORT.md` §4.3）。

## 证据与文档索引

- 整合报告：[P1-UNIFICATION-REPORT.md](<P1-UNIFICATION-REPORT.md>)
- 最终验收： [P1-FINAL-ACCEPTANCE.md](<P1-FINAL-ACCEPTANCE.md>)
- 升级/回退： [WISH-WILLOW-UPGRADE.md](<WISH-WILLOW-UPGRADE.md>)
- 状态兼容： [P1-STATE-COMPATIBILITY.md](<P1-STATE-COMPATIBILITY.md>)
- 接口依据： [API-EVIDENCE.md](<API-EVIDENCE.md>)
- 历史报告： [P0-REPORT.md](<P0-REPORT.md>)、[P1-REPORT.md](<P1-REPORT.md>)
