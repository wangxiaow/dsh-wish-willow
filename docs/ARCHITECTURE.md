# 架构与决策（统一 Bundle 0.3.2 工作树，P2 未验收）

P1 按[关闭记录](<P1-CLOSURE-0.3.2.md>)保持 CLOSED WITH ACCEPTED EXCEPTION。当前 P2 源码增量与旧阶段运行证据分开，测试/build/安装/真实模型均未执行；[任务](<../tasks/P2.md>)与[开发报告](<P2-DEVELOPMENT-REPORT.md>)为当前范围。

## 产品形态

**用户只安装一个 Wish Willow（`dsh-wish-willow` 0.3.2（尚未公开发布）），只看到一个统一工作台。** 内部仍由多个模块、多个 Service、多个存储 Domain 组成，P2/P3 继续在同一架构内扩展（新增内部模块），而不是每阶段新增一个插件。

```text
统一 Bundle：dsh-wish-willow@0.3.2（开发工作树）
  cordis.patch.yml  → 唯一 insert：id wish-willow / name dsh-wish-willow
        │
  src/host.js（组合根，Cordis plugin row）
        ├─ 先 applyP0(ctx)  → src/p0/*    Domain wish_willow v1 / products + Service wishWillow
        └─ 再 applyP1(ctx)  → packages/p1/* Domain wish_willow_p1 v1 / projects + Service wishWillowP1
                                      └─ Orchestrator → Coder → P1 验证/固定候选 → 独立 Reviewer → Host 状态门禁

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
| P1 模块 | `packages/p1/src/{host,state,orchestrator,artifacts,delivery,delivery-runner}.js` | 正式产品演化状态（Domain `wish_willow_p1` v1 / `projects`，Service `wishWillowP1`）、最小 Orchestrator、证据门禁、排除式不可覆盖快照、独立副本交付验证 | 一个产品一条聚合记录；只通过 CAS 串行变换写入 |
| 组合根 | `src/host.js` | `name='wish-willow'`、`inject=两模块并集`、按序调用两个模块的 `apply` | **不复制业务逻辑、不返回任何值**（Cordis 会把返回值当 effect） |
| Client | `client.js` | 唯一 `settings.section` 条目 `wish-willow`，双语字典，主题 token CSS，RPC 适配 | 不引入新 UI 框架、不做 RPC 之外的数据旁路 |

## 关键决策及依据

1. **一个 Bundle、一行 Loader、一个 Client 模块**：官方 `dsh.bundle.patch` 支持多行与子路径，但 `dsh-client-modules` 按 Loader row 扫描声明了 `dsh.client` 的包，同一个包插入两行会让同一个 `client.js` 被装载两次（模块 id 必须等于 package name），属于重复注册。因此「用户层面统一 + 内部模块独立」由**一行 + 组合根 + 单 Client**实现，而不是把两个 Host 文件合并成一个大文件。
2. **存储 Domain/旧事实不迁移**：`wish_willow` 与 `wish_willow_p1` 的名称、版本、表名不变，P0 strict schema 不变。P2 仅给 P1 聚合增加 optional `quality`、新 Artifact kinds 和 optional Release gate ID；旧已完成记录读取时不补数据、不 eager rewrite，历史事实不可覆盖。旧 strict 二进制可能拒绝新增字段，降级必须显式保全/隔离读取，不能静默删掉 P2 信息。
3. **正式产品状态来源唯一**：统一后权威状态是 P1 聚合记录；P0 记录保留为可编辑、可导入的旧数据源，导入按 UUID 幂等（重复导入返回同一产品，源文件字节不变）。这样既统一入口，又不把两种历史强行拼接。
4. **组合顺序**：先开 P0 模块（供 `legacy()` 读取），再开 P1 模块（Orchestrator 需要 agent 等服务）；`inject` 取并集，避免 P0 侧因缺 Agent 服务而无法装载。
5. **真实 Agent 用官方接口**：`ctx.agents.create` + `setup` + `followup`/`whenIdle`，模型与 preset 继承用户默认；不复制模型调用框架、不使用 Teams/Workflow。
6. **权限只收窄**：新 Session 固定为不高于部署默认的 `workspace-write`（只读来源保持只读）与 `approval: never`；工具守卫拒绝任何 `sandbox_permissions` 与工作目录之外的 `workdir`。
7. **证据门禁在 Host**：只有同一 ChangeSet 内确有 `code` 修改且 `build`/`test`/`run` 三类真实前台 exit 0，`wish_deliver` 才被允许；Built 与 Released 分离，Release 只追加。判定只看完整的 `kind==='foreground'` 退出 DTO：`denied`/`runnerFailed`/`timedOut`/`aborted`/被提升为后台 job 的命令一律记为 `unverified` 并保留真实原因，但**不进入 Built/Released**（0.3.2 / F1-A）。
8. **交付以不可覆盖快照为准**：源码复制到受控目录之外的快照目录并记录逐文件 SHA256；快照已存在但内容不同即失败。每次未通过的尝试使用独立候选目录，历史 Release 永不被覆盖（0.3.2 / F1-B）。
9. **交付验证在工作区外的干净副本中执行**：快照先按 manifest 逐文件校验，再物化到一个**新建且调用前必须不存在**的副本目录；该目录不得与原产品工作目录或快照目录重叠。回放（build/test/run + 启动）通过一个专用、只暴露 `pwsh`/`job_output`/`job_kill` 的**无模型 DSH Agent 会话**在该副本内执行，权限沿用部署默认且不放大（0.3.2 / F1-B）。HTTP 服务型交付必须传 `healthCheck`（loopback + 期望文本）：Host 先确认端口未被占用，再启动、轮询 HTTP 200 与内容、并确认本次进程已停止；启动超时或无法确认一律视为未验证并拒绝 Release（0.3.2 / F1-A）。
10. **依赖来源限定**：当前补丁只验证**无第三方依赖**的 Node/PowerShell 交付。拒绝条件：(a) 快照内任何 `package.json` 出现非空 `dependencies`/`devDependencies`/`optionalDependencies`/`peerDependencies`/`bundledDependencies`/`workspaces`；(b) 独立副本到**受控隔离根**（生产为 `$DSH_HOME/wish-willow`）之间任何一层存在 `node_modules`；(c) Node 的按用户全局目录 `~/.node_modules`、`~/.node_libraries` 存在。**隔离根之上**的祖先目录只记录在 `dependencies.ambientAboveIsolationRoot` 中而**不**拒绝——本机 OS 临时目录就存在无关的 `node_modules`，把它当成交付失败不是交付本身的属性；这是明确写出的限制，不是静默忽略。回放命令清空 `NODE_PATH`/`NODE_OPTIONS`。这不是通用依赖闭包分析，也不承诺隔离硬编码绝对路径、网络下载或 PowerShell profile 外部模块（0.3.2 / F1-B）。
11. **快照与恢复的安全边界**：快照路径只接受规范 POSIX 相对路径（拒绝 `..`、绝对路径、盘符、ADS、反斜杠、Windows 尾点/尾空格与设备名）；已有祖先或目标为符号链接/junction/重解析点一律拒绝；manifest 的路径、数量、单文件与总字节、哈希在写入与读取两侧都校验；凭据类文件按名称（含多段 `.env.*`、`.credentials.*`、`secrets.*`，仅显式 `example|sample|template` 结尾豁免）与高置信内容双重排除，排除项写入 manifest 而不是静默丢弃（0.3.2 / F1-C）。
12. **中断不自动重跑**：Host 启动时把遗留 pending/running 标为 `uncertain`，重试需显式确认且上限 3 次；执行有步数（60）与时限（900 s）上限。
13. **升级顺序**：必须先移除旧 `dsh-wish-willow-p1` 再安装统一 Bundle，否则同一 Host 会出现重复的 `wishWillowP1` 注册。插件管理器返回 `restart-required` 时，Host 侧 row 需重启 DSH 才生效（Client 入口通常立即更新）。

## 生命周期与部署约束

- Cordis Service/locale/Slot/effect 随 fiber 卸载撤销；组合根把 P1 的 domain close 与 Orchestrator 关闭串在同一 effect 中：**先取消并等待真实 Agent，再关闭两个 Domain**。停用或卸载不写任何产品数据。
- **同一存储 root 只允许一个写入 Host**：JSON 后端没有跨进程写锁，revision CAS 只保证同一 Host 内并发页面不静默覆盖。验收时 Desktop 与 Web 使用完全隔离的 `$DSH_HOME`。
- 工作目录为 `$DSH_HOME/wish-willow/projects/<projectId>`，交付快照在 `$DSH_HOME/wish-willow/deliveries/<projectId>/candidates/<candidateId>/<versionId>/source`（0.3.2 起每个未通过的尝试有独立候选目录），独立验证副本在 `$DSH_HOME/wish-willow/restores/<candidateId>`（该目录在创建前必须不存在）。
- Windows 沙箱的写入授权（`grantWrite`）要求工作目录对当前用户具备 WRITE_OWNER；用户 profile 下的默认目录满足，受限目录会在执行前失败并如实记录（见 `docs/P1-UNIFICATION-REPORT.md` §4.3）。

## P2 增量（代码已接入，运行未验证）

- [reviewer.js](<../packages/p1/src/reviewer.js>)：独立 fresh Session，无 seed/parent/fork；Coder 的正常完成与最终 tool result 必须已持久化，dispose 写入者后才组装实际材料。受限 scoped `read` 遮蔽通用文件读取，仅按 Host 材料 ID 分页；全局 allow mask + 同步 guard，禁止写/Shell/网络/其他 Agent/审批/释放。
- [quality-gate.js](<../packages/p1/src/quality-gate.js>)：确定性风险下限与必要检查；来源、候选/版本/构建/快照/材料/契约完整绑定；实际读收据、正常终结与 Session 持久化不齐不能 PASS。Reviewer 仅能提高风险。
- [state.js](<../packages/p1/src/state.js>)：quality/证据/产物/历史只追加；每次文件复核获得私有一次性释放许可，泛用 mutate 没有许可，无法制造新 Release。低/中风险 PASS；高风险再核对明确用户、最新审查、风险 hash 和 local-only 范围。释放前复核当前/基线快照及报告/材料，再 revision CAS。
- 新材料与报告是候选 sidecar Artifact，不回写已记录的 Build。候选与审批 durable；启动后等待审批不变，中断审查追加 BLOCKED，不自动重跑模型或 Coder。一次显式重审最多为第二次，保留旧结论。
- [host.js](<../packages/p1/src/host.js>) 新 RPC 为 `approveCandidate` / `reReview` / `resumeCandidate`；继续原候选不调用模型。高风险 pending 不通过普通 retry 重启 Coder。
- [client.js](<../client.js>) 仍唯一 Client/Slot；显示当前版本/测试、Reviewer/Host 判定、问题/材料/历史与绑定操作，另标最近已交付历史。
- 默认 Reviewer 20 步/300 秒/120 tool calls；仅明确定义的 UTF-8 必要材料可验证。二进制必要内容、大候选、错误/取消/预算不足不自动降标准放行。预算请求取消并 drain，不承诺强制杀死底层失控驱动。
- 当前 package 版本未提升；共享内部源码已经增加 P2，不能用旧 companion manifest 重打当前源码并声称纯历史版本。回退只依据实际保全/历史归档，不静默抹去新 quality 字段。

P2 的[有限测试与真实候选计划](<P2-EXECUTION-PLAN.md>)另需授权，既有 F1 实测不作为 P2 运行证据。真实 Web/Desktop/SDK 生命周期和限制工具仍待验证。

## 证据与文档索引

- 整合报告：[P1-UNIFICATION-REPORT.md](<P1-UNIFICATION-REPORT.md>)
- 最终验收： [P1-FINAL-ACCEPTANCE.md](<P1-FINAL-ACCEPTANCE.md>)
- 升级/回退： [WISH-WILLOW-UPGRADE.md](<WISH-WILLOW-UPGRADE.md>)
- 状态兼容： [P1-STATE-COMPATIBILITY.md](<P1-STATE-COMPATIBILITY.md>)
- 接口依据： [API-EVIDENCE.md](<API-EVIDENCE.md>)
- 历史报告： [P0-REPORT.md](<P0-REPORT.md>)、[P1-REPORT.md](<P1-REPORT.md>)
