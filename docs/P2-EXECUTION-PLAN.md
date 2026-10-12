# P2 分项执行授权计划（历史计划与 C 准备边界）

> **最终阶段状态：P2 CLOSED — VERIFIED, NO EXCEPTION。** 用户已完成并批准真实隔离验收归档，成功现场的收据、原生审计、Prepared/Review Claim/结果绑定、Gate/Local Release 和汇总已从磁盘交叉核验一致；详见本文[后续成功验收补记](<P2-EXECUTION-PLAN.md#后续成功验收补记>)及[入口报告成功证据链](<P2-C-ENTRY-REPORT.md#10-后续成功验收补记>)。
>
> **历史冻结、执行停止。** 原始 [Win32 5 阻断](<P2-C-ENTRY-REPORT.md#9-真实环境阻断归档最新状态>)与旧计划/待决记录保留，不把失败现场改为 PASS。本轮只修改指定三份文档，不重跑验收、Host、Reviewer、模型或 Release，不改 ACL/DSH/Git；P1 仍 CLOSED WITH ACCEPTED EXCEPTION，P3 **NOT STARTED**。

> 后续用户已接受 A1/A2/B；本文前半保留原执行计划，不表示这些步骤仍未执行，也不是再次授权。用户随后批准的最小 C 内部入口已完成源码/驱动准备，见[八项入口报告](<P2-C-ENTRY-REPORT.md>)；[先前阻断报告](<P2-C-PREPARATION-REPORT.md>)保留为历史。本轮未运行下列测试/构建/打包/Host/模型命令；只读输入哈希请求在进程启动前被 Win32 5 阻止。

**以下保留原待批准计划，不是新的执行证据或整体授权。** 目前只完成源码/测试/文档写入与人工静态阅读。四项可分别批准；批准 A1 不代表批准 A2/B/C。所有源码编辑继续限定原批准 P2 范围。

## 通用前置与停止条件

- 工作区固定为 `G:\dsh\Wish-Willow`；先核实 Node ≥22 的实际可执行文件和现有锁定依赖。缺依赖就停止并请求安装授权，不自动 install、更换 registry、允许 lifecycle scripts 或 peer 版本豁免。
- 测试只在新建、有所有权标记的 OS 临时 fixture 中写入；pack/隔离安装另用工作区内新的 UUID 子目录，拒绝已有目标和重解析点。均保留失败现场，不清理、删除、覆盖旧备份、旧快照或私有数据。
- 不访问/复制真实 DSH Home/Profile/凭据/Session/Storage；不改 ACL/WRITE_OWNER/DSH 核心。与当前 GUI `http://127.0.0.1:19387` 的部署独立，不能把另一服务器的运行当成当前 GUI 已更新。
- 已知 shell 启动曾因 `SetNamedSecurityInfoW ... grantWrite(G:\dsh\Wish-Willow)` / Win32 5 在进程开始前失败。不得重复试绕过、改权限、修复 DSH、提权或将它转成 P2 修复。若执行入口仍不可用，保留事实，等待用户决定执行方式；不把没启动的命令记录为测试 fail 或 pass。
- 首次检查失败先定位有限原因；不删断言、skip 测试、降低门禁。最多两轮与当前 P2 变更有关的必要修正/重验，仍不收敛就报告实际失败。不自动扩大验收范围。

## A1 — 推荐先批准：语法与有限 P2 接线测试（无模型、无 Shell 子进程）

在上述工作区、已核实的 Node 路径下执行下列命令，逐条检查退出码；每条只执行一次初始检查：

```powershell
node --check packages/p1/src/quality-gate.js
node --check packages/p1/src/reviewer.js
node --check packages/p1/src/state.js
node --check packages/p1/src/orchestrator.js
node --check packages/p1/src/host.js
node --check client.js
node --check tests/helpers/p1-runtime.mjs
node --check tests/helpers/unified-runtime.mjs
node --check tests/helpers/p2-reviewer.mjs
node --check tests/helpers/p2-state.mjs
node --check scripts/check.mjs
node --test tests/p2-quality-gate.test.mjs tests/p2-reviewer.test.mjs tests/p2-client.test.mjs
```

范围：状态层、受限 Reviewer 生命周期/材料/结构化报告、真实 Cordis/JSON Storage/RPC 的隔离 fixture、React SSR/renderer、九类有限正反例。新 P2 测试的 Agent 和成功 command DTO 全部脚本化，未启动 PowerShell 或模型；测试进程会创建并保留新的临时产品/Session stand-in/快照文件。

产出：逐条命令、真实 exit code、完整失败/通过摘要、fixture 路径及必要错误日志。不因此声称真实独立 Reviewer 或 OS 沙箱验收通过。

## A2 — 完整构建校验与必要回归（仍无模型，包含真实测试子进程）

A1 通过后，另行批准：

```powershell
node scripts/check.mjs
node --test tests/*.test.mjs tests/integration/*.test.mjs
```

这是[现有 check 脚本](<../package.json>)的两部分，先 build/schema/统一入口检查，再全部有限测试。既有 P1 集成 fixture 会使用[显式 runner](<../tests/helpers/runner.mjs>)启动真实 PowerShell/Node 命令，也有跨进程 storage fixture；它们不是实际 DSH OS 沙箱。无需安装、联网、模型、修改 profile 或打包。

重点比较：原 F1 排除/不可覆盖快照、foreground DTO、独立 replay、路径/重解析点/凭据保护、P0/P1 兼容与历史版本、统一 UI 断言仍在；P2 的新行为不能把旧正例偷偷当成真实 Reviewer 接受。

P1 历史 `92/92` 是旧证据，当前全部结果必须重新实际取得；新总数不得预填。

## B — 本地 pack、全新隔离安装与启动检查（无模型；安装可能联网）

A1/A2 通过后，再批准以下**具体权限类别**：

1. 在工作区创建全新 `.test-data/packages/p2-<UUID>`，核对 package 白名单与凭据排除后本地 pack；不覆写任何既有 0.3.2 归档。当前 manifest 版本仍为 0.3.2，只把它标记为 P2 工作树开发归档，不代表发布新 0.3.2。
2. 创建全新 `.test-data/acceptance/wish-willow-p2-<UUID>`。通过[已有隔离安装入口](<../tests/live-probe-unified/install.mjs>)与官方 CLI，仅修改该 Home 的 `web` profile，不用当前 profile 的 plugin_manager 去安装/卸载。依赖下载需要另行确认网络/registry；不运行未批准 build scripts，不读/复制原 profile 凭据。
3. 经授权在新的 managed job 启动[隔离 Host](<../tests/live-probe-unified/start-host.mjs>)，先证明 loopback 19389 空闲（占用即停止，不 kill），使用 `none` 禁用浏览器/CDP。它不是替换当前 19387 GUI。检查 peer 版本、唯一 Bundle/Client、原 Domain、P2 文件与 RPC、初始旧状态可读。

参数模板仅在授权后分配实际 UUID、Node/pnpm 路径和 archive SHA256：

```powershell
# $P2Archive、$P2Home、$P2Evidence 必须先被核实为新建隔离路径，不能取现有私人 Home。
# 用工具返回并核实的 Node 与 pnpm launcher 运行 pnpm，不修改全局 PATH 或包管理设置。
node <verified-pnpm-launcher> pack --pack-destination <new-p2-package-directory>
node tests/live-probe-unified/install.mjs "$P2Home" "$P2Archive" web add --authorize-isolated-profile-change
node tests/live-probe-unified/start-host.mjs 19389 none "$P2Home" "$P2Evidence" unified --authorize-isolated-host
```

模板不是已创建路径/已存在归档的声明。pack/install/boot 任何一步失败都留现场并停止，禁止从真实 Home 借环境、降版本/授予豁免或修改 ACL。只停止自己创建的 managed job；既有 single-use claim 不自动删掉再试。不声明 Web/Desktop 双端通过；浏览器/桌面视觉验收需额外明确授权。

## C — 仅两例真实独立 Reviewer（收费模型，单独批准）

后续状态（用户报告）：A1 `21/21 PASS`、A2 `113/113 PASS` 且 check exit `0`，B1/B2/B3 打包、全新隔离安装及官方 Host 正常退出已接受；助手未重跑。B 不含浏览器视觉或真实 Reviewer。用户后续批准的最小内部生产验证/交付暂存提取、两例 CLI 与日志去提示源码已准备，**C ENTRY PREPARED — AWAITING TARGETED VALIDATION AUTHORIZATION**，见[入口报告](<P2-C-ENTRY-REPORT.md>)及[准确 argv](<../tests/live-probe-p2/README.md>)。不能用 submit 额外调用 Coder，不能合成 Session 结果/结束事件或传成功 DTO；新增代码尚未 syntax/回归/真实执行，不能把先前 A/B 当成本次新代码通过。中性化后实测输入哈希未取得，不预填。

未来前提：补齐并静态审核必要入口与驱动，隔离 Home 具有**用户明确配置并授权使用**的默认模型。助手不获取 Key 明文、不复制旧凭据。执行前展示实际 provider/model、支持的限额、最终隔离路径、源码/归档 SHA256 和驱动步骤；无法获取/不符批准范围就停止。采用全新 C Home，保留 B 资产；不运行驱动来“试一下”。

- 输入：两个独立的本地、无第三方依赖、三文件 Node 候选，见[候选准备说明](<../tests/live-probe-p2/README.md>)。产品契约同为：输入有限 JavaScript Number，输出按标准 Number 加法相加；必须支持非零、负数与小数；不要求非法输入校验、UI、网络或持久化。
- 正例：实际加法 + 有关断言。反例：实际减法 + 仅 `0,0` 的弱测试。禁止 Coder/自动修复把反例改好；不能只测哈希篡改导致的完整性拒绝，必须让 Reviewer 读取源码和实际弱测试发现需求违反。
- 驱动必须在新隔离产品目录落地固定文件，经原 P1 真实 DSH 工具与干净副本 replay 取得 build/test/run/start 证据；记录实际 tool-call/Session ID，不伪造 exit 或 Coding 会话结束事件。固定候选准备可用明确标记的无模型 tool-only Agent，真实 Reviewer 本身必须是原生产入口的新模型 Agent，不能用脚本替代。
- 候选固定后停止/释放写入者；生产材料/报告验证、状态层 gate 与 Release append 完整复用。Reviewer 不获得父会话、ground-truth 的 good/bad 目录标签、期望 verdict 或测试 oracle，只有确认契约、实际字节与证据。Coder 自述不作证据。
- **预算：恰好两次 Reviewer 创建、每例最多 20 步/300 秒，合计最多 40 模型步骤/600 秒；不自动重试、不额外重审、不 Coder 修复、不 Reviewer-of-Reviewer、不多模型比较。** 默认模型可相同；这不是固定 Token/金额承诺。费用上限若需金额控制，先明确并使用实际支持的限额，否则不自动扩大开销。
- 预期：正例合法 PASS 后仅一次本地 Release；反例即使全部执行命令 exit 0，也应 FAIL 且有实际源码/测试定位，无 Release。UNVERIFIED/BLOCKED 不算接受，也不自动更换模型或修复环境。
- 输出：两个候选与 hash、真实工具证据、独立 Session/读收据、结构化报告、Host gate/Release 关联、费用/使用量（实际可得时）和未验证事项。保留失败现场。不能用它补写 P1 `EX-P1-032-01` 为已解决，也不能公开发布。

如果原 P1 的真实 sandbox/tool 仍因已接受 Win32 5 等环境条件无法形成证据，就记录 C 为 NOT VERIFIED 并停止；不把修复 P1/DSH 当成当前任务，不用 A1 的模拟 DTO 替换真实执行。

## 历史请求的决定（已由后续执行与本次归档更新）

原“先授权 A1”及“是否批准内部入口”的建议已分别由用户后续接受/授权推进，但没有授权新代码执行。当前建议仅批准[入口报告第 7 节](<P2-C-ENTRY-REPORT.md>)的 syntax、必要 targeted regression 与真实输入哈希记录；通过后再分别批准新归档/新 C Home 安装、无模型 Host/tool preparation 和准确 Provider/model/费用边界下的仅两例 review。不直接启动模型。Git commit/push、公开 Release、P3、DSH 核心/ACL 和私人 profile 操作仍未授权。

## 历史关闭待决记录：DECISION PENDING（原文保留）

上段为旧请求，不再要求继续执行 C。用户确认的最新现场证明原始 DSH Shell Win32 5 类错误阻断了首例前台验证与后续 Prepare；不能把它写成 Reviewer FAIL，更不能写成 Reviewer PASS。未开始第二候选或真实 Reviewer，相关完整回放、盲审区分及生产 Release 结果均 **NOT VERIFIED**。

P2 正式关闭须有完整真实验收证据及用户关闭决定，或由用户**单独明确批准 P2 例外并明确关闭决定**，记录未测范围、风险、证据引用和后续处置。目前 **NO EXCEPTION ACCEPTED**；不继承 P1 于 2026-10-11 的例外，不把 A/B 或有限回归扩展为真实验收。后续任何新环境验证仍须另行授权；本轮没有执行授权，不重试、不补写收据，所有失败现场保持原样。详见[证据与关闭条件](<P2-C-ENTRY-REPORT.md#9-真实环境阻断归档最新状态>)。

## 后续成功验收补记

### 正式关闭决定与阶段状态

用户后续在全新隔离 C Home 完成真实验收，并明确批准本轮根据磁盘证据正式关闭归档。既有成功证据时间为 **2026-10-12 UTC**；本轮完成的是文档签收归档，不是新一次 Prepare/Reviewer/Release。上节 DECISION PENDING 和 Win32 5 阻断记录只保留其当时事实；采用**完整真实验收路径**关闭，不接受或继承任何 P2 例外。

| 阶段 | 最终状态 | 边界 |
|---|---|---|
| P0 | 已完成 | 不重跑、不改写历史 |
| P1 | CLOSED WITH ACCEPTED EXCEPTION | 2026-10-11 关闭；`EX-P1-032-01` 和旧版 0.3.2 `92/92 PASS` 历史原样保留，原始模型交付的例外不自动解除、不重开 |
| **P2** | **CLOSED — VERIFIED, NO EXCEPTION** | 既定 A/B 与两例真实独立 Reviewer/Gate/Local Release 验收完成；本轮用户批准正式归档 |
| P3 | **NOT STARTED** | 没有实现、任务执行或阶段推进授权 |

### 已完成验证与证据来源

- A1 **21/21 PASS**；A2 **113/113 PASS**、`node scripts/check.mjs` PASS；B 隔离安装及官方 `runProfile` PASS、exit **0**：用户已经核验并接受，未在本轮重跑；不扩写为 UI 视觉验收。
- C 入口限定 **38/38**、Manifest **6/6**、隔离上下文 **10/10** 是先前已接受的定点回归，不合并为本轮一次测试总数。
- 成功 [C Home](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2>)及 [Evidence](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3>)和[安装收据](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/c-install.json>)已只读核验。实际[已安装归档](<../.test-data/packages/p2-c-eafe7ecc-3dfc-4b8b-a560-82244219225e/dsh-wish-willow-0.3.2.tgz>) SHA-256：`CD87546383C70EFA4DBB7370A3A79E9EAECC5F9A9DCCC30E83B3393A1A8DF914`。
- 六固定输入 **6/6** 绑定与实际快照/Replay 字节一致；两份 Prepared 与汇总一致。用户确认无模型 Prepare exit **0**；磁盘上的两例完整性检查和 build/test/run/start 独立 Replay 均 passed，**20/20** 原生审计无错误：6 write、6 初始验证 pwsh、8 Replay pwsh，Win32 5 **0 次**。详细证据与固定 hash 见[准备报告后续补记](<P2-C-PREPARATION-REPORT.md#10-后续成功验收补记>)。
- Provider **`command`**、Model **`deepseek/deepseek-v4.1-flash`**。用户确认真实 Reviewer 驱动 exit **0**；两例实际 Session header 无 parent/seed/继承，执行元数据均 persisted/completed、failures 0。两个实际 Review ID、Session ID 不同；Prepared、Review Claim、结果 candidate/review/report 的完整 binding 一致，Gate 和唯一 Release 关联一致。

### 真实正反例与生产门禁签收

| 候选与结果 | 实际 Review ID | 实际 Reviewer Session ID | Verdict | Gate | Local Releases | Project Status |
|---|---|---|---|---|---:|---|
| [0：正确加法](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/result-0.json>) | `5a1984fb-32c6-4464-8ed9-f7017160548a` | `wish-review-e4940942-d13e-4568-98cd-2f92bdc3a799` | PASS | ALLOW | 1 | delivered |
| [1：减法/零输入弱测试](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/result-1.json>) | `0a33c069-1203-440d-9587-12dcf03b7d4b` | `wish-review-662eae17-400e-4f04-b845-0282cf127cd7` | FAIL | NEEDS_CHANGES | 0 | failed |

正例必需材料的完整读收据满足 PASS；反例实际源码/测试完整读回，结构化报告明确定位减法需求违反与零输入弱测试。**反例 FAIL 是预设缺陷被正确阻断的预期成功结果，不是阶段验收失败。** 两例命令 exit 0 没有替代语义审查；唯一 Local Release 在正例 Gate ALLOW 后生成，反例零 Release，无自动批准或补造成功记录。更完整的 project/candidate/attempt/gate/release 身份见[入口报告后续补记](<P2-C-ENTRY-REPORT.md#10-后续成功验收补记>)。

[验收汇总](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/acceptance.json>)与两份实际结果独立求和一致：**Local Releases 1；Reviewer 总步骤 9；Input Tokens 41,752；Output Tokens 6,784**，Token 用量可用。claim 明示没有硬金额上限，实际账单金额未提供，不估算、不宣称费用封顶。

### 环境修复、资产保留与核验边界

历史 Win32 5 失败没有被覆盖。用户执行的**仓库根目录有效 WRITE_OWNER 修复**与后续**新隔离 Home 可继承 `(OI)(CI)(WDAC,WO)` 修复**是两项独立操作；根目录 FullControl ACE 继承标志 `None` 解释了为何前者成功后嵌套项目仍失败。本轮未再查询或操作 ACL；详见[准备报告 ACL 证据补记](<P2-C-PREPARATION-REPORT.md#10-后续成功验收补记>)。

[本次 Home 恢复目录](<G:/dsh/wish-willow-acl-recovery-c-18c35cf9-3f2c-46e4-8778-1690b6e99690>)的[原始 DACL 备份](<G:/dsh/wish-willow-acl-recovery-c-18c35cf9-3f2c-46e4-8778-1690b6e99690/original-home-dacl.acl>) SHA-256 已从磁盘只读核验为 `34B7E03D6CB968B8687216E95E56AC66CCE5CB5EFD4C1A130047D30C005216D3`；此前[仓库根恢复目录](<G:/dsh/wish-willow-acl-recovery-03b3d5df-a272-4aa7-af62-76fd7b7e91f9>)单独保留。所有历史 B/C Home、失败 claim、审计、日志、归档及恢复资产不清理、不覆盖、不修改，旧失败 Home 不复用。

本轮只做有边界的磁盘证据解析/hash 核验及这三份现有文档更新。没有缺失或矛盾导致待人工确认的关键证据；历史测试、ACL 修复和驱动退出码的来源仍明确区分为用户已核验事实，不将只读解析器的 exit 0 冒充验收驱动 exit 0。未全文输出模型原始记录或凭据。正式关闭仅覆盖 P2 既定范围；不扩大为 Web/Desktop 视觉、任意质量保证、P1 原始模型交付补验或公开发布。

**P2：CLOSED — VERIFIED, NO EXCEPTION。P1：CLOSED WITH ACCEPTED EXCEPTION（EX-P1-032-01 原样保留）。P3：NOT STARTED。** 归档完成即停止；本轮不提供重跑命令，不自动创建或执行任何 P3 工作，等待用户另行明确授权。
