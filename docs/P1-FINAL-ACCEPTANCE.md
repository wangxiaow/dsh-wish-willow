# P1 最终验收记录（统一 Bundle）

验收对象：`dsh-wish-willow` **0.3.1**（单一可安装 Bundle，统一用户入口）
验收日期：2026-10-10
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
| E | 真实 Desktop UI | **UNVERIFIED** | 已装并加载、入口已统一、面板控件已渲染；**面板数据加载与真实 Agent 执行需重启 Desktop 后复验**（`application: restart-required`） |
| F | 真实 Web UI | **PASS** | 真实 DSH Web Host + 真实 Chrome 完成创建产品、提交愿望、观察任务、查看证据与版本、刷新保持、键盘与主题检查 |
| G | 真实 UI → Agent 执行链路 | **PASS（Web）** | 两轮均由真实 UI 输入触发真实 DeepSeek V4.1 Agent；Desktop 侧待重启复验 |
| H | 两轮自然语言软件演化 | **PASS** | 同一产品同一工作目录：0.1.0 → 0.2.0 两次 Released，旧 Release 与快照未被改写 |
| I | 独立软件构建、运行与功能复验 | **PASS** | 独立进程：快照哈希、构建、项目自带测试、HTTP 启动、第一轮功能、第二轮新增与回归、Release 元数据 —— 11/11 与 15/15 全通过 |
| J | 安全权限、执行限制与故障恢复 | **PASS** | 提权/越界/plan 阶段编码被真实守卫拒绝；无三类 exit 0 证据不可交付；环境故障时 Agent 拒绝伪造证据；中断恢复为 uncertain 且不自动重跑；预算上限生效 |
| K | 升级、回退和旧 Bundle 替换方案 | **UNVERIFIED** | 隔离升级（含真实历史数据）PASS 且数据零改写；真实 Desktop profile 已完成安装级替换（旧 P1 已卸载、0.3.1 已安装、数据未变）；**重启后可用性待复验**，回退手册已交付 |

**建议：完成附录 A 的重启复验并把 E、K 转为 PASS 后，正式关闭 P1；不进入 P2。**

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

### E — 真实 Desktop UI — UNVERIFIED（阻塞于一次重启）

已完成：安装并加载统一 Bundle（`desktop/upgrade-actions-live.json`）、**只出现一个 Wish Willow 入口**（`desktop/desktop-settings.json`）、面板控件在真实 Desktop 窗口渲染（`desktop/desktop-wish-willow.json`、`desktop/desktop-wish-willow.png`）。

未通过：面板调用 `wishWillowP1/list` 失败（`desktop/desktop-panel-check.json` 显示「操作失败…」），因为 Host 内存中仍是升级前的旧 row（`plugin_list`：`include:wish-willow-p0`, `moduleName=dsh-wish-willow`, `fiberPhase=active`），插件管理器明确返回 `application: restart-required`。

复验步骤见 **附录 A**。该步骤无法在本会话内完成：本会话本身运行在被重启的 Host 内。

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

### I — 独立软件构建、运行与功能复验 — PASS

命令：`node tests/live-probe-unified/verify-delivery.mjs --round <1|2> --delivery <snapshot> --workspace <project> --media <wish_willow_p1.json> --project <id>`

第一轮 11/11、第二轮 15/15 全通过（快照哈希/构建/自带测试/HTTP 启动/第一轮功能/第二轮优先级与筛选/原功能回归/Release 元数据/证据门禁）。证据：`web/round1-verification.json`、`web/round2-verification.json`。

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

### K — 升级、回退和旧 Bundle 替换方案 — UNVERIFIED（隔离部分 PASS）

| 场景 | 结果 | 证据 |
|---|---|---|
| 全新安装 | PASS（无需迁移） | `tests/integration/upgrade.test.mjs` |
| 仅 P0 环境升级 | PASS（字节不变、UUID 保留、幂等导入） | 同上 |
| P0+P1 且含真实交付历史升级 | PASS（两文件字节一致，revision/Release/确认需求全保留） | `upgrade/*` |
| 停用/重载/恢复 | PASS | `tests/integration/unified-runtime.test.mjs` |
| 真实 Desktop profile 安装级替换 | 已执行（先 remove 旧 P1，再 install 0.3.1），数据未变、入口已统一 | `desktop/upgrade-actions-live.json`、`desktop/live-profile-package.json` |
| 真实 Desktop 重启后可用性 | **待复验**（`application: restart-required`） | 附录 A |
| 回退手册 | 已交付 | `docs/WISH-WILLOW-UPGRADE.md` |

## 3. 未验证 / 未完成 / 需授权

| 项 | 状态 | 说明 |
|---|---|---|
| Desktop 面板数据加载与真实 Agent 执行 | 未完成 | 需重启 Desktop（已获授权），步骤见附录 A |
| Desktop 双轮演化 | 未执行 | 任务书允许另一端只验证「UI → 真实 Agent」最小链路；本轮以 Web 完成完整双轮 |
| macOS / Linux / 其它 DSH 版本 / 其它浏览器 | 未验证 | 不在本次范围 |
| 远程推送 | 已获授权 | 执行情况见附录 C |
| P2 / P3 | 未开始 | 按阶段边界，需另行授权 |

## 附录 A：Desktop 重启后复验步骤（待执行）

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
| 本次提交 | 见 `artifacts/BUILD-INFO.json` 的 `commit` 字段与本报告对应提交 |
| 安装产物 | `artifacts/dsh-wish-willow-0.3.1.tgz`（134,687 bytes / `0e54729c…3e16`） |
| 回退产物 | `artifacts/dsh-wish-willow-0.1.0-p0.1.tgz`、`artifacts/dsh-wish-willow-p1-0.2.0-p1.1.tgz` |
| 忽略但保留的本地数据 | `.test-data/`（隔离 home、真实数据副本、Desktop 备份）、`.research/`（官方 DSH 只读提取）、`artifacts/*.tgz` |
| 远程推送 | 用户已授权；推送结果见本报告提交说明 |

### A.1 版本与产物说明

验收记录基于 0.3.0 构建；最终发布产物为 **0.3.1**，与验收构建的运行时代码逐文件 SHA256 一致（仅版本号与界面版本标签不同），且已重跑构建校验与 50 项回归、并在隔离 Web home 重新安装复验。详见 `docs/P1-UNIFICATION-REPORT.md` §12.1 与 `artifacts/BUILD-INFO.json`。