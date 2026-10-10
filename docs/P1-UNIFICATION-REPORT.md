# P1 统一 Bundle 整合报告

**结论：Wish Willow 已从两个独立安装单元整合为一个可安装 Bundle（`dsh-wish-willow` 0.3.1）、一个统一用户入口，并保留 P0/P1 全部历史存储与交付历史。单 Bundle 装载、旧版本升级、真实 Web UI 双轮 DeepSeek V4.1 软件演化、独立交付复验与 50 项自动化回归均已实际执行并通过；真实 Desktop profile 已完成安装级升级，可视化验收需重启 Desktop 后完成（见「未完成项」）。**

报告日期：2026-10-10。所有数字与路径来自本次真实执行记录；未执行或被阻塞的项目单列，不计为通过。

---

## 1. 阶段 A：基线与双 Bundle 架构审查

### 1.1 实测基线

| 项目 | 实测值 |
|---|---|
| 仓库 | `G:\dsh\Wish-Willow`，起始分支 `p1/minimal-loop`，HEAD `9ed80164f0f64eff74a98f1bf80bbf4b8e91bfd5` |
| 整合开发分支 | `p1/unified-bundle`（本次提交见文末） |
| DSH / Cordis | `0.2.0-rc.2` / `4.0.4`（官方 Desktop 安装，`app.asar` 未修改） |
| Node / pnpm | 24.21.0 / 11.7.0 |
| 整合前回归 | `32 pass / 0 fail`（`docs/evidence/p1-unification/baseline/test.txt`） |
| 整合前哈希 | `docs/evidence/p1-unification/baseline/pre-integration-hashes.json`（含 P0/P1 源码与 tgz） |
| 用户实时数据 | `~/.dsh/storages/wish_willow.json` SHA256 `dbbb88bf…9ecbcc`、`wish_willow_p1.json` SHA256 `6b714957…eb8839` |
| 已装 Bundle | `dsh-wish-willow` 0.1.0-p0.1（row `wish-willow-p0`）+ `dsh-wish-willow-p1` 0.2.0-p1.1（row `wish-willow-p1`） |
| 真实 Client Slot | `settings.section` occupants 同时含 `wish-willow-p0`(order 30) 与 `wish-willow-p1`(order 31) — 两个用户可见页面 |

### 1.2 双 Bundle 为何存在（复核结论，与 P1 报告一致）

P0 的 `products` 是 `strictObject`；给旧记录加字段会让旧 schema 无法回读，向同一 JSON unit 增表会被旧后端按已声明表重新序列化而丢数据，替换已安装的 P0 包需要完整重启当前 Host。因此 P1 选择新增 companion Bundle，而不是修改已验收的 P0。

### 1.3 注册面核对

| 维度 | P0 模块 | P1 模块 | 是否冲突 |
|---|---|---|---|
| Loader row | `wish-willow-p0` → `dsh-wish-willow` | `wish-willow-p1` → `dsh-wish-willow-p1` | 无（id 不同） |
| Service | `wishWillow` | `wishWillowP1` | 无 |
| Storage Domain | `wish_willow` v1 / `products` | `wish_willow_p1` v1 / `projects` | 无，独立文件 |
| Client module id | `dsh-wish-willow` | `dsh-wish-willow-p1` | 无 |
| Client Slot | `settings.section#wish-willow-p0` order 30 | `settings.section#wish-willow-p1` order 31 | 无，但有两个页面 |
| RPC namespace | `wishWillow/*` | `wishWillowP1/*` | 无 |

- **P1 对 P0 的运行时依赖**：唯一一处是 `EvolutionService.legacy()` 读取 `this.ctx.get('wishWillow')?.list() ?? []`，属于可选读取；P1 的 Orchestrator 与状态层不依赖 P0 模块。
- **加载顺序与生命周期**：两个 Bundle 各自一层 patch，按 `dsh.profile.bundles` 顺序 insert；两个 plugin 都挂在同一个 Host fiber 树下，卸载任一个只关闭自己的 Domain 与 Slot。
- **卸载风险**：卸载 P1 不会改写 P0 文件（`dispose` 不写盘，集成测试覆盖）。

### 1.4 官方扩展机制是否支持「一个 Bundle 多个内部组件」

依据官方实现（`.research/installed/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js`）：

- `dsh.bundle.patch` 可以是**一个文件或文件数组**，每个 patch 的 `insert` 可插入**多行**；`name` 允许子路径（官方自带 `@deepseek-ai/dsh-tool-subagent-control/list-agents`、`@deepseek-ai/dsh-plugin-manager/tools` 即为例证）。
- **但 Client 侧一行只对应一个 client 资源**：`dsh-client-modules` 按 Loader row 扫描声明了 `dsh.client` 的包，client 文件由包的 `exports["./client"]` 定位，模块 id 必须等于 package name。同一个包插入两行会让同一个 client 文件被当作两个资源装载、两次执行 `__ModuleLoader__.load({ id: 'dsh-wish-willow' })`，属于重复注册。

**因此本次整合采用：一行 + 一个 Client 模块 + 内部两个源码模块。** 这既满足「用户只安装一个、只看到一个入口」，又不把两个 Host 文件机械合并成一个大文件。

### 1.5 整合设计（选择 / 原因 / 影响）

| 决策 | 选择 | 原因 | 影响 |
|---|---|---|---|
| 安装单元 | 1 个 Bundle `dsh-wish-willow` 0.3.1 | 用户只安装一次 | 旧的两个 Bundle 需从 profile 移除 |
| Loader 行 | 1 行 `id: wish-willow` | 避免 client 模块重复注册 | 内部仍可继续加模块（如 P2 Reviewer）到组合根 |
| 内部模块 | `src/p0/*`（P0 服务与 Domain）+ `packages/p1/src/*`（P1 状态与编排），由 `src/host.js` 组合 | 保留稳定模块边界与既有测试 | 两个 Service、两个 Domain、两份存储完全不变 |
| Client | 单个 `client.js`，Slot `settings.section#wish-willow` order 30 | 一个入口；P0 编辑能力并入同一页面 | 旧的两个页面移除 |
| 正式产品状态来源 | P1 聚合记录（`wish_willow_p1/projects`）为权威；`wish_willow/products` 保留为可编辑、可导入的旧数据源 | 不重写历史存储，符合「受控迁移优于强行合并」 | P0 记录保持字节不变，用户显式导入 |
| 兼容层 | 不改任何 Domain 名称/版本/表/schema | 旧文件直接可用 | 升级不需要数据迁移 |
| 回退 | 保留冻结的旧 companion 包与两个旧 tgz | 可回退到双 Bundle | 旧包与新包不可同时安装（见限制） |

---

## 2. 阶段 B：单一 Wish Willow Bundle 实现

### 2.1 源码组织

```text
dsh-wish-willow@0.3.1（可安装 Bundle）
├─ cordis.patch.yml          # 唯一 insert：id wish-willow → name dsh-wish-willow
├─ package.json              # dsh.bundle.patch / dsh.client(web, immediately)
├─ client.js                 # 唯一 Client 模块（id=dsh-wish-willow），统一工作台
├─ src/host.js               # 组合根：name=wish-willow，inject=两个模块所需服务并集
├─ src/p0/host.js            # P0 模块：Domain wish_willow v1 / products + Service wishWillow
├─ src/p0/model.js           # P0 schema 与 store（逻辑与已验收版本一致）
├─ packages/p1/src/host.js   # P1 模块：Domain wish_willow_p1 v1 / projects + Service wishWillowP1
├─ packages/p1/src/{state,orchestrator,artifacts}.js
└─ packages/p1/*             # 冻结的旧 companion 包（回退路径，未改动）
```

`src/host.js` 只做组合与生命周期归属，不复制任何业务逻辑：

```js
export const name = 'wish-willow';
export const inject = ['storageDomain', 'typertGateway', 'agents', 'agentDefaultModel',
  'agentPresets', 'sandboxPolicy', 'sessions', 'sessionQuery'];
export async function apply(ctx, config = {}) {
  await applyP0(ctx);          // 先打开旧 Domain，供显式导入读取
  await applyP1(ctx, config);  // 再打开演化 Domain 与 Orchestrator
}
```

设计细节（已由测试与真实运行验证）：

- `apply` **不返回任何值**：Cordis 会把返回值当作 effect 处理，返回对象会报 `Invalid effect`（本次实测踩到并修正）。
- 两个模块的 `ctx.effect` 都注册在组合根 fiber 上，卸载顺序为「先取消并等待真实 Agent → 再关闭两个 Domain」。
- `inject` 取两个模块的并集，避免 P0 侧因缺少 Agent 服务而无法装载。

### 2.2 统一用户界面（一个入口）

`client.js` 注册**唯一** `settings.section` 条目（`id: wish-willow`、order 30），页面内容覆盖任务书 5.2 的全部要求：

| 要求 | 实现 |
|---|---|
| 产品列表与创建 | `#ww-product-list` + `#ww-title`/`#ww-new-wish`/`#ww-create` |
| 自然语言愿望输入 | 新建产品愿望 + `#ww-wish` 下一轮愿望 |
| 已确认/推断需求 | `#ww-requirements-confirmed` / `#ww-requirements-inferred` |
| 约束与重大决策 | `#ww-constraints`、`#ww-decision-history`、`#ww-decisions`（接受/拒绝） |
| 当前任务及执行状态 | `#ww-tasks`，按 待执行/执行中/已完成/失败/阻塞/待确认 分组，无伪造百分比 |
| Agent 执行记录 | `#ww-runs`：provider、model、session、模型/工具调用数、失败数、tokens、耗时、结束原因 |
| 构建、测试与交付证据 | `#ww-build-status`、`#ww-test-status`、`#ww-evidence-kinds`、`#ww-artifacts`、`#ww-evidence` |
| 版本历史与运行方式 | `#ww-versions`（每个 Release 的时间与 startCommand）、`#ww-start-command`、`#ww-snapshot` |
| 下一轮愿望入口 | `#ww-wish` + `#ww-submit`，失败/待确认时 `#ww-retry`/`#ww-ack`/`#ww-cancel` |
| 保留 P0 基础编辑能力 | `#ww-legacy-*`：旧 P0 产品列表、名称/愿望/状态编辑（CAS 保存）、按 UUID 导入统一状态 |

未引入任何新 UI 框架，仍只依赖平台 React 与 DSH 主题 token，未引入 iframe/外部脚本。

---

## 3. 阶段 C：完整工程与安全回归

命令：`node scripts/check.mjs && node --test tests/*.test.mjs tests/integration/*.test.mjs`

| 执行 | 结果 | 证据 |
|---|---|---|
| 整合前基线 | 32 pass / 0 fail | `docs/evidence/p1-unification/baseline/test.txt` |
| 整合后完整回归 | **50 pass / 0 fail / 0 skip / 0 cancelled** | `docs/evidence/p1-unification/check-full.txt` |
| 构建校验 | PASS | `docs/evidence/p1-unification/check.txt` |

新增（18 项，未删除或放宽任何旧断言）：

| 测试文件 | 覆盖 |
|---|---|
| `tests/unified-bundle.test.mjs` (5) | 单一安装面（1 manifest / 1 patch 行 / 1 Client 入口）、官方 `composeEntries` 组合层核对、内部模块身份与 Domain 不变、inject 并集、冻结 companion 仍可安装、兼容窗口 |
| `tests/integration/unified-runtime.test.mjs` (6) | 1 行同时开两个 Domain、停用/重载保留全部事实且不丢弃 Domain、Failure-closed（两 Domain 各 3 类坏介质）、中断恢复为 uncertain 且不自动重跑、**跨进程重开**、真实编排交付 |
| `tests/integration/upgrade.test.mjs` (3) | 仅 P0 环境升级（字节不变/按 UUID 幂等导入）、**已交付 P0+P1 环境升级 + 第二轮演化**（旧 Release 与快照不被改写）、全新安装无需迁移 |
| `tests/client.test.mjs` (5) | 统一 Client：仅 1 个 Slot、双 namespace RPC、双语 SSR、真实状态渲染、旧 P0 编辑区 |
| `tests/ui-interaction.test.mjs` (4) | 统一工作台挂载交互：创建产品、提交愿望（CAS）、旧 P0 冲突保留草稿与显式重载、UUID 导入、卸载中止请求 |

既有 P0（14 项）与 P1（18 项）测试全部保留并通过；旧的 P1 companion client 测试仍验证冻结回退包可用。

关键安全/一致性验证点（全部有自动化或真实运行证据）：

- 持久化与重启恢复：两进程真实恢复（`unified-runtime.test.mjs`、`runtime.test.mjs`）。
- CAS revision 冲突、`requestId` 幂等、异输入拒绝：`wish-willow*/conflict`、`idempotency-conflict`。
- 失败写入不产生假成功：store 层失败保留旧内存值。
- 用户确认需求不可被推断覆盖：`confirmed-fact` 守卫。
- 任务 ↔ AgentRun ↔ 证据 ↔ Build ↔ Version ↔ Release 关联与「无 build/test/run exit 0 不得交付」门禁。
- 中断任务不标记成功：新 Host 代际把 pending/running 标为 uncertain，且不自动创建 Agent（实测 `createCount=0`）。
- 工作目录隔离与提权拒绝：plan 阶段编码、`sandbox_permissions`、工作目录之外 `workdir` 三类调用被守卫拒绝（沿用 P1 集成测试，本次全部通过）。
- 单写入 Host 限制提示保留：不进行两个 Host 共写同一存储 root 的实验。

---

## 4. 阶段 D：隔离环境安装、升级与真实 UI 验收

### 4.1 安装与升级（官方路径，隔离 home）

| 场景 | 执行 | 结果 | 证据 |
|---|---|---|---|
| 全新安装 | 官方 CLI `dsh plugin --profile web add <tgz>`（内部走 `@deepseek-ai/dsh-plugin-manager`） | profile bundles = `[…, dsh-wish-willow]`，Host `fiberState=2` | `docs/evidence/p1-unification/isolated-install.txt`、`web/host.json` |
| 仅 P0 环境升级 | 隔离 home 装 0.1.0-p0.1 → 换装 0.3.1 | `wish_willow.json` 字节不变，产品可读、可按 UUID 幂等导入 | `tests/integration/upgrade.test.mjs`（真实存储）+ 用例 1 |
| 已装 P0+P1 且含真实交付历史的环境升级 | 隔离 home 先装两个旧 Bundle，注入**用户真实** `wish_willow.json`/`wish_willow_p1.json` 副本，再 `add 0.3.1` + `remove dsh-wish-willow-p1` | 升级前后两文件 SHA256 完全一致；真实项目 revision 32、两个 Release（0.1.0 `npm start` 11:11:19Z、0.2.0 `npm start` 11:18:09Z）、两条已确认需求、两个旧 P0 产品全部保留 | `upgrade/manifest-after-upgrade.json`、`upgrade/storage-before-upgrade.txt`、`upgrade/storage-after-upgrade.txt`、`upgrade/upgrade-panel.json`、`upgrade/upgrade-panel.png` |
| 用户入口数量 | 升级前 2 个（`Wish Willow · P0`、`Wish Willow · P1`）→ 升级后 **1 个**（`Wish Willow`） | 实测 | `upgrade/web/pre-upgrade-nav.json`、`upgrade/post-upgrade-nav.json` |
| 停用/重载 | 卸载统一行 → 事实保留 → 重挂载 | 两 Domain、两 Service、全部记录一致 | `unified-runtime.test.mjs` |
| 失败关闭 | 坏 JSON / 外来版本 / 非法记录（两个 Domain 各 3 例） | 拒绝加载且原字节保留 | `unified-runtime.test.mjs` |

### 4.2 真实 Web 客户端验收

真实 Host：官方 `runProfile(profile='web')`，隔离 `DSH_HOME`（`C:\Users\wangw\AppData\Local\dsh-wish-willow-acceptance\home-unified`），端口 3081，官方认证 URL 交给浏览器，**URL 不落盘**；Storage Root 与 Desktop 完全隔离。

真实浏览器：Chrome，独立 `--user-data-dir`（与用户既有 Chrome 实例隔离），页面 origin 经浏览器自身 debug 端点二次校验（`web/browser-targets.json`）。
操作方式：CDP `Input.dispatchMouseEvent` / `dispatchKeyEvent` 驱动真实渲染控件（与 Playwright 相同的输入路径），**未调用产品 RPC、未注入状态、未使用 mock 页面**。

| 检查 | 结果 | 证据 |
|---|---|---|
| 安装并加载统一 Bundle | PASS（bundles 含 `dsh-wish-willow`，fiberState=2） | `web/host.json` |
| 只有一个 Wish Willow 入口 | PASS（设置导航：通用设置/模型/内置插件/Agent 预设/**Wish Willow**；`wishWillowEntries:1`） | `web/settings-nav-entries.json`、`web/web-settings-open.json`（UIA 112 元素） |
| 创建产品 | PASS（真实点击 `#ww-create`，status=草稿，revision=1） | `web/web-product-created.json` |
| 提交愿望 → 真实任务状态 | PASS（status=执行中，tasks=9，runs=1） | `web/web-round1-submitted.json`、`web/round1-failed-timeline.jsonl` |
| 查看 Agent 执行结果 | PASS（`#ww-runs`：provider/model/调用次数/tokens/耗时/结束原因） | `web/round2-delivered.json` |
| 查看构建、测试与交付证据 | PASS（build 通过、证据类型 exit=0、快照路径、startCommand） | `web/round2-delivered.json`、`web/round2-version-history.json` |
| 查看版本与运行方式 | PASS（0.1.0 与 0.2.0 两次正式交付 + `node server.js`） | `web/round2-version-history.json` |
| 刷新后状态保持 | PASS（reload → 重新进入 → 已交付/1 产品/2 版本） | `web/web-after-refresh.json` |
| 基本键盘操作 | PASS（`#ww-title` tabIndex=0，TAB 依次到 `#ww-reload`） | `web/web-keyboard-focus.json` |
| 主题适配 | PASS（深色 `rgb(21,21,23)` → 切浅色 `rgb(255,255,255)`，`--dsw-alias-bg-layer-1=#fff`，页面正常） | `web/round2-delivered.png`、`web/web-theme-light.png`、`web/web-theme-light.json` |
| 错误提示 | PASS（首次运行因环境 ACL 失败时，界面显示 `操作失败；草稿已保留…`，且看板保留失败任务与失败证据，未伪造成功） | `web/web-round1-failed.json`、`web/round1-failed-media.json` |

### 4.3 首次 Web 真实运行的环境故障与修复（如实记录）

第一次真实运行（G: 盘隔离 home）中，Agent 实际完成了规划与编码（21 次模型调用、33 次工具调用），但 `wish_verify` 的三次真实执行在启动前失败：

```text
SetNamedSecurityInfoW failed (Win32 5): grantWrite(<workspace>)
```

根因（依据官方 `dsh-sandbox-windows-acl` 实现）：Windows 沙箱的 `grantWrite` 需要在工作目录上设置强制完整性标签（SACL），要求调用者拥有该目录的 **WRITE_OWNER**；G: 盘仓库目录继承的 ACE 是 `Modify`（不含 WRITE_OWNER），而用户 profile 下的目录继承 `FullControl`。修复：把隔离验收 home 迁到用户目录下（`%LOCALAPPDATA%\dsh-wish-willow-acceptance`），保持默认的 `$DSH_HOME/wish-willow/projects` 布局不变。

**该失败被完整保留**（`web/round1-failed-media.json`），也顺带验证了安全门禁：Agent 明确拒绝用静态自查或改命令冒充 build/test/run 证据，Host 也拒绝在没有三类 exit 0 证据时交付。

---

## 5. 阶段 E：真实 DeepSeek V4.1 双轮软件演化（Web 端，完整双轮）

- Provider / 模型：`deepseek-official` / `deepseek-flash`（官方目录显示名 **DeepSeek-V41-Flash**，即 DeepSeek V4.1 Flash；本会话本身运行在同一模型上）。运行配置由 `dsh-base` 默认提供，未修改权限或审批策略（新 Session 固定 `workspace-write` + `approval: never`）。
- 执行主体：Wish Willow 最小 Orchestrator 通过官方 `ctx.agents.create` 创建**真实 DSH root Agent**，真实 `read/write/edit/pwsh` 工具链，无脚本化替身、无预置答案。

| 轮次 | 愿望 | 版本 | ChangeSet/任务 | 模型调用 | 工具调用 | 记录失败 | 输入/输出 tokens | 耗时 | 交付 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | 个人待办事项应用（新增/查看/标记完成/删除、数据能保存） | **0.1.0 Released** | 1 / 9 | 31 | 35 | 2（test、run 各 1 次真实失败后修复） | 94,535 / 22,032 | 106,430 ms | build+test+run exit 0，6 条证据，`node server.js` |
| 2 | 增加优先级与按优先级筛选，不破坏新增/完成/删除 | **0.2.0 Released** | 1 / 22（含第二轮 13 项） | 35 | 44 | 1 | 200,245 / 23,636 | 119,901 ms | build+test+run exit 0，10 条证据，`node server.js` |

两轮均由**真实 UI 输入**发起（在 `#ww-wish` 中键入愿望并点击 `#ww-submit`），未经探针或 RPC 触发。

- 快照不可覆盖：两轮快照目录不同（`…/deliveries/<projectId>/f901cfff…/source` 与 `…/1e79d8f8…/source`），第二轮交付后第一轮快照逐文件哈希仍与其 manifest 一致。
- 版本可区分：第一轮快照中 `priority|优先级` 出现 **0** 次，第二轮出现 **91** 次。
- Release 历史只追加：两轮 release 记录时间有序、快照路径唯一，第一轮 release 记录在第二轮后逐字段未变。
- 保留既有确认需求：第二轮后 confirmed 需求 = 2（两条用户愿望），推断需求 19 条。
- 中断与失败语义：失败由任务级状态与证据呈现，Release 不产生；`uncertain` 需显式确认后重试。

---

## 6. 阶段 E（续）：独立交付复验

复验在**独立进程**中执行，输入只有交付目录、源码快照、真实存储记录；不读取任何 Agent 自述。

| 复验项 | 第一轮 | 第二轮 |
|---|---|---|
| 快照 manifest 逐文件 SHA256/字节/内容 | PASS（8 项） | PASS（8 项） |
| 快照 = 当前工作目录 | PASS | PASS |
| 构建（`node --check` 全部脚本） | PASS（5） | PASS（5） |
| 项目自带测试（`node todo-test-runner.js`） | PASS（exit 0） | PASS（exit 0） |
| 文档化启动命令 + 真实 HTTP | PASS（200，1,588 bytes） | PASS（200，2,361 bytes） |
| 第一轮功能（新增/查看/完成/删除/持久化） | PASS | PASS（回归） |
| 第二轮新增（优先级 + 筛选） | — | PASS（`filterByPriority`/`priorityOptions` 等 API 与 UI 控件均存在且行为正确） |
| Release 元数据（有序、唯一快照、Build↔Version↔Release 绑定） | PASS | PASS（2 个 Release） |
| 通过构建必须携带 build+test+run exit 0 证据 | PASS | PASS |
| 每个 Release 快照目录存在且与 manifest 一致 | PASS | PASS（含第一轮快照） |

证据：`web/round1-verification.json`、`web/round2-verification.json`。两版可运行软件与不可覆盖快照位于隔离 home 的 `wish-willow/projects/<projectId>` 与 `wish-willow/deliveries/<projectId>/<versionId>/source`。

---

## 7. 真实 Desktop 验收（已授权，部分完成）

用户于本次会话中明确授权「直接升级当前 Desktop profile」。执行记录：

| 步骤 | 操作 | 结果 | 证据 |
|---|---|---|---|
| 备份 | 复制 live profile `package.json`/`cordis.patch.yml`/`pnpm-lock.yaml` 与两个 storage 文件到 `.test-data/desktop-backup-20261010` | 完成 | 备份目录（含 SHA256） |
| 卸载旧 P1 | `plugin_manager.remove_bundle dsh-wish-willow-p1` | `changed:true, application:applied`，package exit 0 | `desktop/upgrade-actions-live.json` |
| 安装统一 Bundle | `plugin_manager.install_bundle` 0.3.0（验收构建）→ 0.3.1（最终产物） | 两次均 `changed:true, application:restart-required`，package exit 0；同一版本重打包被 `ambiguous-install` 保护性拒绝 | `desktop/upgrade-actions-live.json` |
| profile 结果 | bundles = `[…, dsh-wish-willow]`；依赖指向 0.3.1 tgz；已装包版本 0.3.1（含内部 P1 模块） | PASS | `desktop/live-profile-package.json` |
| 用户数据 | 两个 storage 文件 SHA256 与升级前完全一致 | PASS | `upgrade-actions-live.json` |
| 真实 Desktop 用户入口 | 设置导航实测只剩 **一个** `Wish Willow`（`Wish Willow · P0`/`· P1` 已消失） | PASS | `desktop/desktop-settings.json` |
| 真实 Desktop 面板 | 面板控件在真实 Desktop 窗口中渲染（`ww-app`/`ww-product-list`/`ww-title`/`ww-legacy-*` 等 151 元素） | PASS（渲染） | `desktop/desktop-wish-willow.json`、`desktop/desktop-wish-willow.png` |
| 面板数据加载 | **未通过**：Host 侧旧 row 仍在内存中（`include:wish-willow-p0`, `fiberPhase: active`），新 row 需重启才生效，面板显示「操作失败…」 | 已知阻塞 | `desktop/desktop-panel-check.json` |

**结论：Desktop 已完成安装级升级且用户入口已统一，但「面板可用 + 真实 Agent 执行」需要在重启 Desktop 后复验。** 这属于 `application: restart-required` 的已知语义，不是产品缺陷；本次会话语义上无法自行重启（当前会话运行在该 Host 内），因此交由用户重启后继续（步骤见 `docs/P1-FINAL-ACCEPTANCE.md` 附录）。

---

## 8. 资源消耗（真实计量）

| 运行 | 结果 | 模型调用 | 工具调用 | 记录失败 | 输入 tokens | 输出 tokens | 耗时 |
|---|---|---:|---:|---:|---:|---:|---:|
| 隔离 Web 轮次 1（首次，环境 ACL 失败） | failed（无交付） | 21 | 33 | 7 | 67,979 | 20,853 | ~60 s |
| 隔离 Web 轮次 1（修复环境后） | 0.1.0 Released | 31 | 35 | 2 | 94,535 | 22,032 | 106,430 ms |
| 隔离 Web 轮次 2 | 0.2.0 Released | 35 | 44 | 1 | 200,245 | 23,636 | 119,901 ms |
| **合计** | 2 次交付 | **87** | **112** | **10** | **362,759** | **66,521** | ~5 分钟模型时间 |

（tokens 为 DSH 会话统计口径，非账单金额。用户参与的重大决策：2 次 — Desktop 升级授权、是否推送 GitHub。）

防失控机制全部生效：步数上限 60、运行时限 900,000 ms、ChangeSet 重试上限 3、失败/待确认状态可见、无证据不可交付。

---

## 9. 限制与已知问题

1. **Desktop 面板需重启后可用**（见 §7）；这是本次唯一未完成的验收动作。
2. **统一 Bundle 与旧 companion Bundle 不可同时安装**：两者都会注册 `wishWillowP1` / 提供相同 Slot，属于重复身份；迁移手册要求在安装统一 Bundle 前先移除旧 P1 Bundle（本次已按此顺序执行）。
3. **单写入 Host 限制不变**：JSON 后端没有跨进程写锁，Desktop 与 Web（或任何两个 Host）不得共写同一 storage root。本次 Web 验收使用完全隔离的 home，未做共写实验。
4. **UI 自动化方式**：Web 端用 CDP 真实输入事件（Playwright 同路径）而非人工手点；Desktop 端用 UIA（Expand/Invoke/坐标点击 + PrintWindow 截图）。两者都不使用产品 RPC 或 mock 页面，但仍不等于人工验收。
5. **旧 P1 目录残留**：live profile 的 `node_modules/dsh-wish-willow-p1` 目录仍存在（已不在 bundles 列表中，不会被加载）；`pnpm` 会在下次操作时清理。
6. **未覆盖平台**：仅 Windows 11 + 本机 Chrome；未验证 macOS/Linux、其它 DSH 版本、其它浏览器引擎。
7. **未实现（按阶段边界）**：P2 独立 Reviewer/质量门禁、P3 跨模型接管与调度、云部署与发布基础设施。

## 10. 未完成项 / 需用户操作

1. **重启 DSH Desktop**（唯一阻塞项）：重启后统一 Bundle 的 Host row 才会以 `wish-willow` 生效；随后需复验「面板可加载真实产品 + 一次最小真实 Agent 执行」（命令与步骤已备好）。
2. 正式验收签署（由用户完成，开发者不得自行宣布验收通过）。
3. 若需回退：按 `docs/WISH-WILLOW-UPGRADE.md` §4 执行（同样需要一次重启）。

## 11. 是否建议正式关闭 P1

**建议：在完成 Desktop 重启复验后关闭 P1。** 依据：A/B/C/D/F/G/H/I/J 已通过实际验收；K 的隔离升级与真实 profile 安装级升级已验证，仅剩「重启后 Desktop 面板可用性」这一可复现动作；无未解决的 P1 代码缺陷。不进入 P2。

## 12. Git 与产物

| 项目 | 值 |
|---|---|
| 分支 | `p1/unified-bundle`（起点 `9ed8016`），已推送 |
| 提交 | `693fe17`（`feat(p1): ship the unified Wish Willow bundle 0.3.1 with real acceptance evidence`）; 已推送 `main` 与 `p1/unified-bundle` |
| 可安装产物 | `artifacts/dsh-wish-willow-0.3.1.tgz`，134,687 bytes，SHA256 `0e54729ca7ecb57660c46adae92fabb6787f445e31e6ac7b7deff98bc1863e16` |
| 构建命令 | `node scripts/check.mjs && node --test tests/*.test.mjs tests/integration/*.test.mjs && pnpm pack --pack-destination artifacts` |
| 回退产物 | `artifacts/dsh-wish-willow-0.1.0-p0.1.tgz`、`artifacts/dsh-wish-willow-p1-0.2.0-p1.1.tgz` |
| 未提交文件 | 见 `docs/P1-FINAL-ACCEPTANCE.md` 附录 C |

### 12.1 版本与产物说明（0.3.0 验收构建 → 0.3.1 发布产物）

- 全部验收执行（隔离安装/升级、真实 Web 双轮演化、独立交付复验、真实 Desktop 安装）都发生在 **0.3.0** 构建上。
- 文档定稿后重新打包使同一版本下的产物内容发生变化；官方插件管理器以 `ambiguous-install` **保护性拒绝**在同一版本下替换已安装内容（本次实测，未改动 profile）。因此最终发布产物版本提升为 **0.3.1**。
- 0.3.1 与 0.3.0 构建的**运行时代码逐文件 SHA256 一致**（`client.js`、`cordis.patch.yml`、`src/**`、`packages/p1/src/**`）；唯一差异是 `package.json` 版本号与界面上的版本标签（`client.js` 的 `stageNote`）。
- 最终产物已重新跑通构建校验与 50 项回归，并重新安装到隔离 Web home 做了一次启动与面板复验（`docs/evidence/p1-unification/web/final-031-panel.json`）。
- 两种版本均以 tgz 形式提供；真实 Desktop profile 现为 0.3.1（依赖 `file:G:/dsh/Wish-Willow/artifacts/dsh-wish-willow-0.3.1.tgz`），等待一次重启生效。