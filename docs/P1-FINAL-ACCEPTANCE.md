# P1 最终验收记录（统一 Bundle）

验收对象：`dsh-wish-willow` **0.3.1**（单一可安装 Bundle，统一用户入口）
验收日期：2026-10-10（含当日 21:29 Desktop 重启后的 E/K 复验）
DSH `0.2.0-rc.2` / Cordis `4.0.4` / Node 24.21.0 / pnpm 11.7.0 / Windows 11
执行者：Wish Willow 开发 Agent（不代表用户已完成正式验收）

> 状态口径：**PASS / FAIL / UNVERIFIED / BLOCKED**。下表每一行都给出可复核证据路径与复现方式；未实际执行的项目不写成通过。

## 1. 结论总表

| 编号 | 验收主题 | 结论 | 一句话依据 |
|---|---|---|---|
| A | 一个可安装的 Wish Willow Bundle | **PASS** | `artifacts/dsh-wish-willow-0.3.1.tgz`（134,687 bytes，SHA256 `0e54729c…3e16`）在隔离 Web profile 与真实 Desktop profile 均由官方插件管理器安装成功；patch 只 insert 一行 |
| B | 一个统一用户入口 | **PASS** | 真实 Desktop 设置导航只剩一个 `Wish Willow`；隔离 Web 实测 `wishWillowEntries: 1`；两个旧页面消失 |
| C | P0/P1 历史数据与版本兼容 | **PASS** | 用户真实两个 storage 文件升级前后 SHA256 完全一致；真实 P1 项目（revision 32、两个 Release）与两个 P0 产品在统一入口可读可编辑 |
| D | 完整自动化回归 | **PASS** | `50 pass / 0 fail / 0 skip`（整合前 32 项全部保留） |
| E | 真实 Desktop UI | **PASS** | 真实 Desktop 窗口：设置只有一个 `Wish Willow` 入口；面板加载出真实历史产品（revision 32、0.2.0 正式交付）；经 UI 创建隔离测试产品 → 提交愿望 → 真实 Agent 执行 → 0.1.0 正式交付；无「操作失败」；重开面板状态恢复（见 §4） |
| F | 真实 Web UI | **PASS** | 真实 DSH Web Host + 真实 Chrome 完成创建产品、提交愿望、观察任务、查看证据与版本、刷新保持、键盘与主题检查 |
| G | 真实 UI → Agent 执行链路 | **PASS（Web + Desktop）** | Web 两轮 + Desktop 一轮均由真实 UI 输入触发真实 Agent：Desktop 侧实际使用 `command` / `deepseek/deepseek-v4.1-flash` |
| H | 两轮自然语言软件演化 | **PASS** | 同一产品同一工作目录：0.1.0 → 0.2.0 两次 Released，旧 Release 与快照未被改写 |
| I | 独立软件构建、运行与功能复验 | **PASS（含 1 项发现）** | Web 两轮独立复验 11/11 与 15/15 全通过；Desktop 那轮独立复验 11 PASS / **1 FAIL**：交付快照缺少入口脚本 `start.ps1`（详见 §5 F1，软件本体可运行且证据真实） |
| J | 安全权限、执行限制与故障恢复 | **PASS** | 提权/越界/plan 阶段编码被真实守卫拒绝；无三类 exit 0 证据不可交付；环境故障时 Agent 拒绝伪造证据；中断恢复为 uncertain 且不自动重跑；预算上限生效 |
| K | 升级、回退和旧 Bundle 替换方案 | **PASS（隔离回退已实测；真实 profile 仅升级方向已验证）** | 隔离：P0-only → 统一、P0+P1（含真实历史）→ 统一、统一 → 双 Bundle 回退，三向存储字节不变；真实 Desktop profile：卸载旧 P1 + 安装 0.3.1 后重启，面板加载真实数据并完成一次真实交付（见 §4、§6） |

**发现（不改变上表结论，但必须在关闭 P1 前处理）**：F1 —— 交付快照的扩展名白名单会静默丢弃非白名单入口文件（本次为 `start.ps1`），使「不可覆盖快照」无法复现交付物的启动方式。详见 §5。

**建议：E、K 现已具备实际证据。若接受 F1 作为「已记录、待修复的 P1 遗留缺陷」，可正式关闭 P1；建议以一次 0.3.2 补丁修复 F1 后再签署（不进入 P2）。**

## 2. 逐项证据

### A — 一个可安装的 Wish Willow Bundle — PASS

| 检查 | 观察 | 证据 |
|---|---|---|
| 单一安装面 | manifest `dsh.bundle.patch` 1 个、`dsh.client` 1 个、patch 只 insert 1 行 `id: wish-willow` | `tests/unified-bundle.test.mjs`；`docs/evidence/p1-unification/check.txt` |
| 官方组合层 | 用官方 `composeEntries` 组合后仅剩 `wish-willow` 一行，无旧 row | 同上 |
| 隔离安装 | 官方 CLI `dsh plugin --profile web add <tgz>` → bundles 含 `dsh-wish-willow`，Host `fiberState=2` | `docs/evidence/p1-unification/isolated-install.txt`、`web/host.json` |
| 真实 Desktop 安装 | `plugin_manager.install_bundle` → `changed:true`、package exit 0、已装版本 0.3.1 | `desktop/upgrade-actions-live.json`、`desktop/live-profile-package.json` |
| 产物哈希 | 134,687 bytes，SHA256 `0e54729ca7ecb57660c46adae92fabb6787f445e31e6ac7b7deff98bc1863e16` | `artifacts/BUILD-INFO.json` |

### B — 一个统一用户入口 — PASS

| 检查 | 观察 | 证据 |
|---|---|---|
| 旧状态（升级前） | 两个页面：`Wish Willow · P0`、`Wish Willow · P1` | `upgrade/web/pre-upgrade-nav.json` |
| 隔离 Web 升级后 | 唯一 `Wish Willow`（`wishWillowEntries: 1`，无 P0/P1 页面） | `upgrade/post-upgrade-nav.json`、`web/settings-nav-entries.json` |
| 真实 Desktop | 设置导航：通用设置/模型/内置插件/Agent 预设/**Wish Willow** | `desktop/desktop-settings.json` |
| 统一面板内容 | 产品列表/创建、愿望输入、已确认与推断需求、约束与决策、任务分组、Agent 执行记录、证据、版本与启动方式、下一轮入口、旧 P0 编辑区 | `web/round2-delivered.json`、`client.js` |
| 未新增 UI 框架 | 仅平台 React + DSH 主题 token，无 iframe/外部脚本 | `tests/client.test.mjs` |

### C — P0/P1 历史数据与版本兼容 — PASS

| 检查 | 观察 | 证据 |
|---|---|---|
| Domain 不变 | `wish_willow` v1/`products`、`wish_willow_p1` v1/`projects` 名称、版本、表、schema 全部未改 | `tests/unified-bundle.test.mjs`、`tests/integration/unified-runtime.test.mjs` |
| 真实数据零改写 | 升级前后 `wish_willow.json` = `dbbb88bf…9ecbcc`、`wish_willow_p1.json` = `6b714957…eb8839` | `upgrade/storage-before-upgrade.txt` vs `storage-after-upgrade.txt` |
| 已有 P1 项目可用 | 真实项目在统一入口显示：revision 32、已交付、两个 Release（0.1.0 `npm start` 11:11:19Z / 0.2.0 `npm start` 11:18:09Z）、两条已确认需求 | `upgrade/upgrade-panel.json` |
| 旧 P0 可查看/编辑/导入 | 两个真实 P0 产品出现在旧版区；按 UUID 导入幂等（重复导入返回同一产品） | `upgrade/upgrade-panel.json`、`tests/integration/upgrade.test.mjs` |
| 状态语义 | CAS 冲突、requestId 幂等、确认需求不可被推断覆盖、Release 只追加 | `tests/p1-state.test.mjs`、`tests/integration/upgrade.test.mjs` |
| 失败关闭 | 坏 JSON/外来版本/非法记录（两 Domain 各 3 例）拒绝加载且字节保留 | `tests/integration/unified-runtime.test.mjs` |

### D — 完整自动化回归 — PASS

```powershell
node scripts/check.mjs
node --test tests/*.test.mjs tests/integration/*.test.mjs
```

`50 pass / 0 fail / 0 skip / 0 cancelled`（`docs/evidence/p1-unification/check-full.txt`）。整合前基线 32 项全部保留，未删除或放宽任何断言。

### E — 真实 Desktop UI — PASS

前置（重启前）：安装并加载统一 Bundle（`desktop/upgrade-actions-live.json`）；面板 RPC 因 `application: restart-required` 暂时失败（`desktop/desktop-panel-check.json`）。

重启后复验（2026-10-10 21:29 重启，21:30–21:46 执行；证据目录 `docs/evidence/p1-unification/desktop-after-restart/`）：

| 检查 | 结果 | 证据 |
|---|---|---|
| 运行中的 Host 已加载统一模块 | PASS：`plugin_manager.list_bundles` 只有一个 `dsh-wish-willow@0.3.1`，且行是 `{rowId: wish-willow, moduleName: dsh-wish-willow, entryId: include:wish-willow}`（旧 `wish-willow-p0`/`wish-willow-p1` 行不存在）；`Config.listConfigs(name=dsh-wish-willow)` 只返回 `include:wish-willow` | `desktop-after-restart/plugin-inventory-after.json` |
| 设置页只有一个 Wish Willow 入口 | PASS：导航为 通用设置 / 模型 / 内置插件 / Agent 预设 / **Wish Willow** | `01-settings-nav.json`、`03-settings-nav.json` |
| 面板加载真实历史数据、无「操作失败」 | PASS：`panelPresent=true`、`errorElement=false`；产品列表含真实项目，概览为「已交付 / 修订号 32 / 0.2.0 · 正式交付 2026-10-10T11:18:09.263Z」；runs=2、evidence=11、versions=2、旧 P0 产品 2 个 | `04-panel-after-restart.json`、`05`…`08-panel-summary.json`、`04-panel-after-restart.png` |
| 经 UI 创建产品 | PASS：`ww-title`/`ww-new-wish` 输入后点击 `ww-create` → 草稿、revision 1（`09-product-created.json`） | 同上目录 |
| 经 UI 提交愿望 → 真实 Agent | PASS：设置 `ww-wish` 后点击 `ww-submit` → 执行中、revision 3、runs=1、version `0.1.0 · 计划中`（`11-wish-submitted.json`） | `11-wish-submitted.json` |
| 任务/证据/版本推进 | PASS：执行中 revision 5→10、evidence 0→3（`16-run-poll.json`） | `desktop-run-timeline.jsonl`、`run-progress.jsonl` |
| 交付结果在 UI 呈现 | PASS：状态 已交付、revision 18、`0.1.0 · 正式交付 · 交付时间 2026-10-10T13:43:22.174Z`、runs=1、evidence=6、versions=1 | `18-panel-settled.json` |
| 重新打开后状态恢复 | PASS：面板被关闭后重新走 账号菜单 → 设置 → Wish Willow，状态与交付结果完整重现 | `18-panel-settled.json` |
| 原产品未被改动 | PASS：`[P1 E2E TEST] 待办事项应用` 仍为 revision 32、两个 Release 时间戳不变 | `19-delivery-info.json`、`20-desktop-delivery-verification.json` |

### F — 真实 Web UI — PASS

真实 Host：`runProfile(profile='web')` + 隔离 `DSH_HOME`（`%LOCALAPPDATA%\dsh-wish-willow-acceptance\home-unified`），端口 3081，官方认证 URL 直接交给浏览器且不落盘；Storage Root 与 Desktop 隔离。
真实浏览器：Chrome 独立 `--user-data-dir`；页面 origin 经浏览器自身 debug 端点复核（`web/browser-targets.json`）。
操作方式：CDP `Input.dispatchMouseEvent`/`dispatchKeyEvent`（真实输入事件，非产品 RPC、非 mock、非 SSR）。

| 步骤 | 结果 | 证据 |
|---|---|---|
| 进入统一入口 | PASS | `web/settings-nav-entries.json` |
| 创建产品 | PASS（草稿/rev 1） | `web/web-product-created.json` |
| 提交愿望 | PASS（执行中 → 已交付） | `web/web-round1-submitted.json`、`round1-final.json`、`round2-final.json` |
| 任务状态与 Agent 记录 | PASS | `web/round2-delivered.json` |
| 构建/测试/交付证据 | PASS | `web/round2-delivered.json`、`web/round2-version-history.json` |
| 版本与运行方式 | PASS（0.1.0、0.2.0 均 `node server.js`） | `web/round2-version-history.json` |
| 刷新后状态保持 | PASS | `web/web-after-refresh.json` |
| 键盘操作 | PASS（TAB 焦点序列） | `web/web-keyboard-focus.json` |
| 主题适配 | PASS（深/浅色均正常） | `web/round2-delivered.png`、`web/web-theme-light.png` |
| 错误提示 | PASS（失败时显示错误并保留草稿与失败证据） | `web/web-round1-failed.json` |

### G — 真实 UI → Agent 执行链路 — PASS（Web）

- 两次提交都来自真实 UI 点击（`#ww-submit`），Orchestrator 通过官方 `ctx.agents.create` 创建真实 root Agent。
- Provider / 模型：`deepseek-official` / `deepseek-flash`（显示名 **DeepSeek-V41-Flash**）。
- 真实工具调用：`write/edit/read/glob/grep/pwsh/wish_*`；真实 `exitCode` 证据。
- 未使用脚本化 Agent、未使用预置答案、未针对愿望硬编码模板。

### H — 两轮自然语言软件演化 — PASS

| 项 | 第一轮 | 第二轮 |
|---|---|---|
| 产品/工作目录 | 同一产品 `b41b8242…`，同一 workspace | 复用 |
| 愿望 | 个人待办事项应用 | 增加优先级与筛选，不破坏原功能 |
| 版本 | 0.1.0 Released 12:45:55Z | 0.2.0 Released 12:50:24Z |
| 快照 | `…/f901cfff…/source` | `…/1e79d8f8…/source`（不同目录） |
| 优先级相关代码 | 0 次出现 | 91 次出现 |
| 旧快照完整性 | — | 逐文件哈希仍与自身 manifest 一致 |
| 已确认需求 | 1 → 2（保留） | 2 |

证据：`web/round1-verification.json`、`web/round2-verification.json`、`web/round2-version-history.json`。

### I — 独立软件构建、运行与功能复验 — PASS（含 1 项发现）

命令：`node tests/live-probe-unified/verify-delivery.mjs --round <1|2> …`（Web 两轮）与 `node tests/live-probe-unified/verify-desktop-delivery.mjs --media <wish_willow_p1.json>`（Desktop 那轮）。

- Web 第一轮 11/11、第二轮 15/15 全通过（快照哈希/构建/自带测试/HTTP 启动/第一轮功能/第二轮优先级与筛选/原功能回归/Release 元数据/证据门禁）。证据：`web/round1-verification.json`、`web/round2-verification.json`。
- Desktop 那轮 12 项检查：**11 PASS / 1 FAIL**，证据 `desktop-after-restart/20-desktop-delivery-verification.json`。

Desktop 那轮通过的独立检查（在独立进程、真实文件与真实 HTTP 上执行）：

| 检查 | 结果 |
|---|---|
| 快照 manifest 逐文件 SHA256/字节/内嵌内容一致 | PASS（2 条） |
| 快照文件 = 当前工作目录 | PASS |
| `start.ps1` 语法解析（PowerShell Parser） | PASS |
| README 记录的启动命令 → HTTP 200 且 `<title>`/正文含 `Hello World`（809 bytes） | PASS |
| README 记录的烟测命令输出 `200;True;True` | PASS |
| 缺失路径 404、目录穿越 403 | PASS |
| 停止后端口释放（启动命令可重复执行） | PASS |
| 通过构建绑定真实 build+test+run exit 0 证据（且保留了 1 次真实 test exit 1 失败） | PASS |
| Released 版本 ↔ Build ↔ Release 记录绑定、时间有序 | PASS |
| AgentRun 真实计数（`command` / `deepseek/deepseek-v4.1-flash`，22 次模型调用 / 31 次工具调用 / 0 失败） | PASS |
| 原产品未被改动（revision 32、两个 Release 时间戳不变） | PASS |
| **交付快照包含交付物的全部文件** | **FAIL：缺少 `start.ps1`**（见 §5 F1） |

### J — 安全权限、执行限制与故障恢复 — PASS

| 检查 | 结果 | 证据 |
|---|---|---|
| 新 Session 权限只收窄 | `workspace-write` + `approval: never`，不修改用户既有 Session | P1 集成测试（本次仍通过） |
| plan 阶段编码 / `sandbox_permissions` / 工作目录外 `workdir` | 三类调用被真实守卫拒绝 | `tests/integration/p1-execution.test.mjs` |
| 无真实证据不得交付 | 仅写代码文本无法交付；缺 build/test/run exit 0 被拒 | 同上 + `web/round1-failed-media.json` |
| 失败证据保留 | 第一轮 test/run 各 1 次真实失败（exit 1）保留在证据链中 | `web/round2-verification.json`（runs.failures=2/1） |
| 中断恢复 | pending/running → `uncertain`，不自动重跑（`createCount=0`） | `tests/integration/unified-runtime.test.mjs` |
| 预算上限实际生效 | 步数 60 / 时限 900,000 ms / 重试 ≤3 触发即终止并标记失败 | `tests/integration/p1-execution.test.mjs` |
| 环境故障不伪造成功 | ACL 故障时 Agent 拒绝用静态自查冒充证据，Host 未交付 | `web/round1-failed-media.json` 中 verify 任务说明 |
| 未修改 DSH 核心 | 只读检查；`app.asar` 未改动 | 官方安装只读提取于 `.research/installed/dsh` |
| 未绕过认证/审批 | 未读取凭据内容；隔离 home 仅按官方机制复用操作者凭据 | `web/host.json`（`authenticatedUrlRecorded: false`） |

### K — 升级、回退和旧 Bundle 替换方案 — PASS（隔离三向 + 真实 profile 升级方向）

| 场景 | 结果 | 证据 |
|---|---|---|
| 全新安装 | PASS（无需迁移） | `tests/integration/upgrade.test.mjs` |
| 仅 P0 环境升级 | PASS（字节不变、UUID 保留、幂等导入） | 同上 |
| P0+P1 且含真实交付历史升级 | PASS（两文件字节一致，revision/Release/确认需求全保留） | `upgrade/*` |
| **统一 Bundle → 双 Bundle 回退（隔离实测）** | PASS：隔离 home 复制真实 P1 数据后卸载 0.3.1、装回 0.1.0-p0.1 + 0.2.0-p1.1；profile bundles 回到两个旧包；Host 启动后设置页重新出现 `Wish Willow · P0` 与 `Wish Willow · P1`；旧 P1 面板读出原项目 `待办事项应用 · 0.2.0`；存储文件字节不变 | `upgrade/rollback-storage-before.txt` / `rollback-storage-after.txt`、`upgrade/rollback-web/rollback-nav.json`、`rollback-legacy-p1-panel.json`、`rollback-legacy-p1.png` |
| 停用/重载/恢复 | PASS | `tests/integration/unified-runtime.test.mjs` |
| 真实 Desktop profile 安装级替换 | 已执行（先 remove 旧 P1，再 install 0.3.1），数据未变、入口已统一 | `desktop/upgrade-actions-live.json`、`desktop/live-profile-package.json` |
| 真实 Desktop 重启后可用性 | **PASS**：重启后单一入口、面板加载真实数据、经 UI 完整跑通一次真实交付 | §4、`desktop-after-restart/*` |
| 回退手册真实性 | 已区分：升级方向（官方管理器 + 官方 CLI）已实测；回退方向已在隔离环境实测；**真实 Desktop profile 上的回退未实测**（本次约定不重装插件） | §6 |
| 回退手册 | 已交付 | `docs/WISH-WILLOW-UPGRADE.md` |

## 3. 未验证 / 未完成 / 需授权

| 项 | 状态 | 说明 |
|---|---|---|
| Desktop 面板数据加载与真实 Agent 执行 | **已完成（2026-10-10 重启后）** | 见 §4 |
| Desktop 双轮演化 | 未执行 | 任务书允许另一端只验证「UI → 真实 Agent」最小链路；双轮演化由 Web 端完整完成 |
| 交付快照完整性（F1：非白名单入口文件） | **发现、未修复** | 修复与重新打包/重装属新的变更，需另行授权；见 §5 |
| macOS / Linux / 其它 DSH 版本 / 其它浏览器 | 未验证 | 不在本次范围 |
| 真实 Desktop profile 上的「回退」操作 | 未实测 | 回退方向已在隔离环境实测（§6）；真实 profile 上的回退本次约定不执行 |
| 远程推送 | 已完成（用户授权） | 见附录 C |
| P2 / P3 | 未开始 | 按阶段边界，需另行授权 |

## 4. Desktop 重启后复验执行记录（2026-10-10）

环境：真实 Desktop，重启后 Host 监听 `127.0.0.1:19387`（PID 31676，21:29:29 启动），窗口 PID 20368；统一 Bundle 已装 `dsh-wish-willow@0.3.1`。
方式：Windows UIA（ExpandCollapse/Invoke/ValuePattern/坐标点击 + PrintWindow 截图）；面板状态与持久化记录交叉核对。
证据目录：`docs/evidence/p1-unification/desktop-after-restart/`。

| 序号 | 要求 | 结果 |
|---|---|---|
| 1 | Host 已加载统一版 0.3.1（非旧模块） | PASS —— 插件管理器只剩一行 `wish-willow`（moduleName `dsh-wish-willow`）；`Config.listConfigs(name=dsh-wish-willow)` 只返回 `include:wish-willow`；面板能加载需要 `wishWillowP1` 的产品数据，只有统一组合根能提供 |
| 2 | 只有一个 Bundle、一个入口 | PASS —— `dsh-wish-willow@0.3.1` 唯一且 enabled；设置导航只有一个 `Wish Willow` |
| 3 | 创建新记录前核对原数据 | PASS —— 两个存储文件 SHA256 与升级前备份逐字节一致（`data-integrity-after-restart.json`），真实项目 revision 32 / 2 条确认需求 / 0.1.0 与 0.2.0 两个 Release 完整 |
| 4 | 真实 UI 检查看板/任务/版本/证据，无「操作失败」 | PASS —— `errorElement=false`；概览/需求/决策/任务分组/runs=2/evidence=11/versions=2 均在真实窗口呈现 |
| 5 | UI 创建隔离测试产品 + 提交愿望 + 真实 Agent 执行 | PASS —— 产品 `[P1 DESKTOP RESTART TEST] Hello World 静态页`（草稿 rev1）→ 提交 → 执行中 → **已交付**（revision 18、`0.1.0 · 正式交付`、runs=1、evidence=6、tasks=8）；重开面板后状态完整恢复 |
| 6 | 独立命令核验交付物（不凭自述/RPC） | 11 PASS / **1 FAIL** —— 见 §5；软件本体的启动命令、HTTP 行为、构建门禁、Release 元数据与原产品不变性均独立通过 |
| 7 | 不改原产品/Release、不重装、不重启、不改核心、不进 P2 | 遵守 —— **未执行任何安装/卸载操作**；未触碰 DSH 核心；未进入 P2；本次由用户自行重启。原项目逐字段未变：revision 32、两个 Release 时间戳（11:11:19.590Z / 11:18:09.263Z）、2 条确认需求、history 32 条且首条不变。说明：存储文件 SHA256 由 `6b714957…eb8839` 变为 `b936881f…2d09` 是**本轮新增一个明确标记的测试产品所致**，属预期；原记录逐字段比对见 `21-data-integrity-after-test-product.json` | `data-integrity-after-restart.json`（创建测试产品前）、`21-data-integrity-after-test-product.json`（之后） |

本次真实 Agent 运行（Desktop 端，`command` / `deepseek/deepseek-v4.1-flash`）：22 次模型调用、31 次工具调用、0 次记录失败、590,047 输入 / 49,602 输出 tokens、487,090 ms；交付 3 个文件（index.html / README.md / start.ps1），启动命令 `powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1`。

## 5. 发现（F1）：交付快照会静默丢弃非白名单入口文件

| 项 | 内容 |
|---|---|
| 现象 | Desktop 那轮的交付快照 `…/a3813888…/source` 只有 `index.html`、`README.md`；工作目录的第三个文件 `start.ps1`（9,075 bytes，**正是启动命令的目标**）不在快照中 |
| 复现 | `node tests/live-probe-unified/verify-desktop-delivery.mjs --media "$env:USERPROFILE\.dsh\storages\wish_willow_p1.json"` → `FAIL delivery snapshot contains every file of the delivered product`；`docs/evidence/p1-unification/desktop-after-restart/20-desktop-delivery-verification.json` |
| 根因 | `packages/p1/src/artifacts.js:6` 定义扩展名白名单（`.js/.mjs/.cjs/.ts/.tsx/.jsx/.html/.css/.json/.md/.txt/.svg/.yml/.yaml/.lock`），第 24 行对不在白名单内的文件直接 `continue`。`.ps1` 不在其中，因此被静默跳过；manifest 仍自洽，第 31 行的「必须存在可运行源码」门禁因 `index.html` 而通过，所以 Host 的证据门禁不会报错 |
| 影响 | 「不可覆盖源码快照」对该交付并不完整：快照无法复现交付物本身（`start.ps1` 缺失 → 快照内无法执行交付的启动命令）。Build/Release 记录、UI 链路、软件在工作目录中的真实可运行性均不受影响（已独立验证通过） |
| 影响的交付类型 | 入口为非白名单扩展名的交付（`.ps1/.sh/.cmd/.bat/.py/.rb/.go/.rs/…`）。Web 两轮实验交付为纯 JS/HTML/CSS/MD，未受影响，其快照已独立验证为完整 |
| 建议修复（未实施） | 方案 A（推荐）：白名单改为「排除名单 + 二进制度/大小/凭据模式」策略，凡非排除项都纳入快照，并在 manifest 记录 `truncated:false` 与总数；方案 B（最小改动）：把 `.ps1/.sh/.cmd/.bat/.py` 等常见入口扩展名加入白名单，并新增「启动命令引用的文件必须在快照中」一致性断言。二者都需要新版本（如 0.3.2）+ 重新打包 + 重新安装 + 重启，属新变更，本次未执行 |
| 是否需要阻塞 P1 | 不阻塞 E/F/G/H/J；建议在关闭 P1 前修复并重新验收 I（该项本次已如实记为 PASS 含 1 项 FAIL） |

## 6. 升级 / 回退说明的真实性核对（已实测 vs 仅文档）

`docs/WISH-WILLOW-UPGRADE.md` 中的每条操作按「本次是否实际执行过」分类：

| 说明中的操作 | 实际状态 | 证据 |
|---|---|---|
| 升级前备份 profile 清单与产品数据 | **已实测**（真实 Desktop profile） | `.test-data/desktop-backup-20261010/` |
| 升级前记录存储 SHA256 | **已实测** | `desktop/upgrade-actions-live.json` |
| 「先移除旧 P1，再安装统一 Bundle」顺序 | **已实测**（隔离 + 真实 profile 均按此顺序） | `upgrade-actions-live.json`、`upgrade/manifest-after-upgrade.json` |
| `plugin_manager.remove_bundle` / `install_bundle` 用法与回执语义 | **已实测**（含 `applied` 与 `restart-required` 两种回执；同版本重打包被 `ambiguous-install` 拒绝也实测到） | `upgrade-actions-live.json` |
| 官方 CLI `dsh plugin --profile <非 desktop> add/remove` | **已实测**（隔离 home 多次执行；`.test-data/*install*.log`、`.research/iso-install*.log`） | `isolated-install.txt`、`pack/` 与安装日志 |
| 「Desktop profile 由 Electron 管理、CLI 不适用」 | 已实测旁证（本次未对 desktop 使用 CLI） | — |
| 重启后生效 | **已实测**（本回合即重启后复验） | `desktop-after-restart/*` |
| 升级后校验命令（版本、存储哈希、`scripts/check.mjs`） | **已实测** | `01`…`20` 证据 + `check-full.txt` |
| 回退为双 Bundle（§4 全部步骤） | **隔离环境已实测**；真实 Desktop profile 未执行 | `upgrade/rollback-*`、`rollback-web/*` |
| 「回退同样不改动产品数据」 | **已实测**（隔离回退后存储文件字节不变） | `rollback-storage-before.txt` / `after.txt` |
| 故障恢复表（peer 警告、双入口、面板报错、CAS 冲突、坏介质、彻底回退） | 部分实测：双入口（升级前实测）、面板报错（重启前实测）、CAS 冲突与坏介质（自动化集成测试）；「pnpm peer 警告」在安装日志中实测出现 | 见各项引用 |
| Windows 沙箱 `grantWrite` 需要 WRITE_OWNER（§7 限制 5） | **已实测**（G: 盘失败、用户目录成功） | `web/web-round1-failed.json`、`P1-UNIFICATION-REPORT.md` §4.3 |

## 附录 A：Desktop 重启后复验步骤（已于 2026-10-10 执行，结果见 §4）

```powershell
# 0) 用户重启 DeepSeek Harness Desktop（关闭后重新打开；本会话可在重启后恢复）
cd G:\dsh\Wish-Willow

# 1) 确认 profile 只剩一个 Bundle，且装的是 0.3.1
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
(Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-wish-willow\package.json" -Raw | ConvertFrom-Json).version

# 2) 确认用户数据哈希未变
(Get-FileHash "$env:USERPROFILE\.dsh\storages\wish_willow.json" -Algorithm SHA256).Hash.ToLower()
(Get-FileHash "$env:USERPROFILE\.dsh\storages\wish_willow_p1.json" -Algorithm SHA256).Hash.ToLower()
# 期望：dbbb88bfb5c4d723f6803f63f8f942ef0b48a22dd4238c0ecec0362c9b9ecbcc / 6b714957d9d98541e20dcb55983fed06874d78d186cd1aed868b1cc33ceb8839

# 3) 打开真实 Desktop 设置，确认只有一个 Wish Willow，并确认面板加载出真实产品
powershell -NoProfile -ExecutionPolicy Bypass -File tests\live-probe-unified\desktop-probe.ps1 -Action expand -Name '账号菜单'
powershell -NoProfile -ExecutionPolicy Bypass -File tests\live-probe-unified\desktop-probe.ps1 -Action invoke-name -Name '设置'
powershell -NoProfile -ExecutionPolicy Bypass -File tests\live-probe-unified\desktop-probe.ps1 -Action invoke-name -Name 'Wish Willow'
powershell -NoProfile -ExecutionPolicy Bypass -File tests\live-probe-unified\desktop-probe.ps1 -Action inspect -Label desktop-panel-after-restart
# 期望：无 "操作失败"；ww-product-list 内出现 "[P1 E2E TEST] 待办事项应用 · 0.2.0"；ww-legacy-list 出现两个 P0 产品

# 4) 最小真实 Agent 链路（Desktop 端）
#    a. 在旧版 P0 区或统一区新建一个最小测试产品（名称如 "Desktop UI 验证"），愿望如
#       "请创建一个只包含一行 Hello World 的静态网页，并附带一个可运行的启动命令。"
#    b. 观察任务分组与 Agent 执行记录；等待状态变为已交付或失败（失败同样记录）
#    c. 在 ww-evidence / ww-versions / ww-start-command 中核对真实证据、版本与启动方式
# 说明：Desktop 端只要求验证「UI 提交 → 真实 Agent 执行 → 结果在界面呈现」，双轮演化已由 Web 端完成。
```

## 附录 B：一键复现本次全部自动化证据

```powershell
cd G:\dsh\Wish-Willow
$node = 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node scripts/check.mjs
& $node --test tests/*.test.mjs tests/integration/*.test.mjs
# 隔离 Web 端（需先安装到隔离 home）：
#   tests/live-probe-unified/install.mjs → start-host.mjs → ui-drive.mjs → verify-delivery.mjs
# 真实 Desktop 端：tests/live-probe-unified/desktop-probe.ps1
```

## 附录 C：Git / 产物 / 未提交文件

| 项 | 值 |
|---|---|
| 开发分支 | `p1/unified-bundle`（起点 `p1/minimal-loop` = `9ed8016`） |
| 本次提交 | `693fe17`（分支 `p1/unified-bundle`） |
| 安装产物 | `artifacts/dsh-wish-willow-0.3.1.tgz`（134,687 bytes / `0e54729c…3e16`） |
| 回退产物 | `artifacts/dsh-wish-willow-0.1.0-p0.1.tgz`、`artifacts/dsh-wish-willow-p1-0.2.0-p1.1.tgz` |
| 忽略但保留的本地数据 | `.test-data/`（隔离 home、真实数据副本、Desktop 备份）、`.research/`（官方 DSH 只读提取）、`artifacts/*.tgz` |
| 远程推送 | 用户已授权并完成：交付内容提交 `693fe17`，随后的验收记录补记提交使 `refs/heads/main` 与 `refs/heads/p1/unified-bundle` 同步到同一提交（以 `git ls-remote` 为准） |

### A.1 版本与产物说明

验收记录基于 0.3.0 构建；最终发布产物为 **0.3.1**，与验收构建的运行时代码逐文件 SHA256 一致（仅版本号与界面版本标签不同），且已重跑构建校验与 50 项回归、并在隔离 Web home 重新安装复验。详见 `docs/P1-UNIFICATION-REPORT.md` §12.1 与 `artifacts/BUILD-INFO.json`。