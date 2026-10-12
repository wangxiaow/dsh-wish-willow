# P2-C 最小内部入口修正交接

> **最新归档状态：P2 CLOSED — VERIFIED, NO EXCEPTION。** 成功现场证据已从磁盘只读交叉核验，用户明确批准正式关闭归档；见[后续成功验收补记（第 10 节）](<P2-C-ENTRY-REPORT.md#10-后续成功验收补记>)。
>
> 第 1–8 节的入口交接及[第 9 节的 Win32 5 阻断](<P2-C-ENTRY-REPORT.md#9-真实环境阻断归档最新状态>)均保留为当时历史事实。成功发生于另一个全新 C Home，不将旧失败改为 PASS、不解除 P1 例外。本轮仅归档：不重跑 Prepare/Reviewer/Host，不执行新 Release；P3 **NOT STARTED**。

**历史交接状态：C ENTRY PREPARED — AWAITING TARGETED VALIDATION AUTHORIZATION**

仅源码、测试驱动与说明准备完成；不是 C PASS，不关闭 P2，不进入 P3。A1/A2/B 的用户接受结果保留为历史证据，不覆盖本次修改。P1 保持 **CLOSED WITH ACCEPTED EXCEPTION**，`EX-P1-032-01` 仍 **NOT VERIFIED**。

## 1. 文件与必要性

- [Orchestrator](<../packages/p1/src/orchestrator.js>)：将 `wish_verify` 的真实执行/证据入库提取为内部 `verifyCommand`，将 `wish_deliver` 的快照、独立 replay、完整性拒绝与 Build 暂存提取为内部 `stageDelivery`。原 Coder handlers 改为调用它们；不是 Remote 方法。
- [replay runner](<../packages/p1/src/delivery-runner.js>)：仅 opt-in 审计分支核对真实最终 observer 与返回 DTO 的对象身份，暴露真实 Session/call ID，完成 flush/dispose 后从持久存储读回无模型身份。默认 Coder 不要求新审计分支。
- [固定内部准备](<../tests/live-probe-p2/fixed-candidate.mjs>)、[CLI](<../tests/live-probe-p2/run.mjs>)、[固定输入/哈希记录](<../tests/live-probe-p2/inputs.mjs>)、[有限回归](<../tests/live-probe-p2/entry.test.mjs>)：只支持原两例；无通用 importer、Agent factory、DTO runner、公开 RPC、Domain、依赖、版本或 Bundle 变动。
- [正例测试](<../tests/live-probe-p2/good/app.test.mjs>)与[反例测试](<../tests/live-probe-p2/bad/app.test.mjs>)只将日志统一为 `Arithmetic assertions completed`；减法实现、零输入唯一断言及原共同契约保留。输入在驱动中用确切文本固定；不能传入新源码、命令、success、Build、verdict 或完成标记。
- [执行说明](<../tests/live-probe-p2/README.md>)与相关历史报告补充最新状态；保留旧报告和旧 A/B/P1 证据，不重写历史结论。

## 2. 普通 Coder 语义

正常 Coder 仍要求实际成功 write/edit、同一 run/change 的分别 build/test/run foreground exit 0、无 deny/runner failure/timeout/abort、独立干净副本 replay/start、不可覆盖快照及原 Build 关联。仍执行正常 `whenIdle → flush → completed turn/end → durable successful final wish_deliver tool/result → dispose writer` 核验后才准备 Reviewer。

固定入口不调用 submit RPC 或 Coder followup。只复用 store 的真实用户提交事实及上述内部生产操作，来源明确为 **fixed-tool-only / 用户确认固定输入准备，不是模型 Coder turn**。不会 append 或 emit 合成 Session `tool/call`、`tool/result`、`turn/end`，不会借 flush 假装模型正常结束。

## 3. 实际证据的生产与完成证明

未来执行时：原版 AgentFactory 创建 fresh tool-only Agent；预设可用、权限只收窄、approval never；同步 guard 只允许确切三次 write 与三次 foreground 验证。`tools.execute` 的真实返回值必须与 `tools/result` 最终 observer 同对象、同调用身份/参数；完整原始 DTO 写入 Host 的 `wx` 审计文件并读回/哈希核验。拒绝 DTO、缺审计、非 foreground、未退出、超时/取消均不能准备成功 Build。

原生写入者必须 flush 为真并 dispose，且实时 Agent/Session 都不存在；之后 `sessionQuery.readSession` 核对真正持久 header/事件，不接受 seeded、parent 或模型请求/assistant 事件。已停止的工作区字节、实际不可覆盖 snapshot manifest 必须恰好等于固定三文件；replay 必须有四个真实 foreground 结果和自己已结束的持久 Session。完成证据嵌入已有 delivery-manifest，再由原生产路径入库 Evidence/Build；无新 Artifact 类型。准备失败仅保留现场，自己的 promoted job 才能以真实 job tools 清理，不能把它转成成功。

以上是**源码中的执行条件，不是本轮已取得的运行证据**。Host 审计文件是 runtime provenance，不冒充 DSH 模型循环事件；同进程特权 Host 插件仍是可信边界，这不是新 OS 安全平台。

## 4. Reviewer 独立、盲审与只读

完整顺序仍是 `prepareReviewCandidate → registerCandidate → beginReview → reviewCandidate → releaseCandidate`。准备后释放写入者；review 模式调用已安装 Bundle 的原 Orchestrator/Reviewer，不替换其 factory、报告、read receipts 或规则。fresh Reviewer 无 seed/parent/fork，read-only、approval never、opaque material-ID reader、持久正常结束与报告读回要求不变。

材料只含确认契约、三文件实际字节、真实执行/完整性及风险/差异/claim；目录均为 Host UUID/中性文件名。输入 index、原 good/bad 路径、期望 PASS/FAIL 与外部 oracle 不进入材料。外部预期断言仅在真实审查之后执行，不能注入结论。日志中性化不改变反例缺陷。失败例还检查实际 source/test 完整读收据和需求违反的具体 must-fix 定位。

## 5. Host gate 不可绕过

[Reviewer](<../packages/p1/src/reviewer.js>)、[质量 gate](<../packages/p1/src/quality-gate.js>)、[状态/私有 Release 许可](<../packages/p1/src/state.js>)、[Host RPC](<../packages/p1/src/host.js>)均未编辑。驱动不能手工 append Release、approve、resume、re-review 或 lowered risk；release 仍只由原 reviewCandidate 调用原 releaseCandidate，必须经过现有物理核验、最新绑定/审批、取消检查、私有一次许可及 revision CAS。历史 Release 不覆盖。C 如进入 AWAITING_APPROVAL 就停止，不自动审批。

## 6. 唯一 C 入口与参数

准确入口为[run.mjs](<../tests/live-probe-p2/run.mjs>)；完整顺序与 PowerShell argv 见[README](<../tests/live-probe-p2/README.md>)。四个命令分别是 `hash-inputs`、`install`、`prepare`、`review`。缺显式授权 flag/多余参数直接拒绝；源码/命令不可配置，case index 仅 0/1，Host 自行产生产品/候选/restore 路径。

新 C Home 必须首次不存在、匹配 C UUID 名称、处于仓库 acceptance 父目录；安装只接受新 C UUID package 子目录中的新归档/hash。后续必须匹配 owned marker、安装 receipt、源/驱动/输入 hashes、原版 DSH `0.2.0-rc.2`，不能借用已接受 B Home/归档。CLI 只启动自己的官方 runProfile 生命周期，不再同时调用旧 start-host，不开浏览器，不打印认证 URL，不继承或复制 model/cloud keys。用户自行配置隔离模型。

两个 preparation claim 和总 review claim 都不可覆盖、失败不回收。Reviewer 最多两次创建/每例一次，20 步/300 秒/120 tool calls，合计 40 步/600 秒；额外 Agent/模型步拒绝。无 Coder 模型、重试、修复、多模型比较或递归审查。必须明确 provider/model 和 `--acknowledge-no-hard-money-cap`；时间/步骤不是 Provider 请求、Token、费用硬 cap，底层 retry/外部 Provider 限额仍需用户另行确认。cancel/drain 不是无法响应底层 driver 的硬 kill。

## 7. 最小下一授权（当前不要执行）

先单独批准：改动文件 Node syntax、[新增三项有限测试](<../tests/live-probe-p2/entry.test.mjs>)、既有 P2 Reviewer/gate 与 P1 execution/delivery/unified 必要回归、确切输入 SHA256 记录。只有通过后，才另行批准新归档/hash、新 C Home 官方安装及无模型 prepare。最后展示真实 Provider/model/preset、支持的 Token/请求/金额限额及底层 retry 行为，并另行批准仅两例 review。安装可能联网、脚本权限不扩大；不授权 DSH/ACL、旧 B/私人 Home、Git、浏览器、P3 或发布。

旧 B 归档不能代表新源代码；新 pack/install/prepare/review 均未执行，也未创建占位 Home、候选、Session、Build、Review、Gate 或 Release。

## 8. 检查事实、哈希未完成与风险

已完成人工静态阅读、grep、公开 Inspect 契约核验和文本改动；未运行 Node syntax/tests/build/pack/install/Host/browser/model/Git，未启动 subagent/workflow/background job。本轮唯一新的 Shell 请求是六输入文件的只读 `Get-FileHash`/工作目录查询，**在进程启动前**被 `SetNamedSecurityInfoW failed (Win32 5): grantWrite(G:\\dsh\\Wish-Willow)` 阻止；无进程 exit、无 Hash 结果，不记为测试失败，不重试/提权/改 ACL。

**中性化后的实测 SHA256 尚未记录。** [hash-inputs 记录步骤](<../tests/live-probe-p2/inputs.mjs>)已实现，未来对确切文本固定且实际读取的六文件计算 SHA256，写新不可覆盖 ledger；安装 receipt、snapshot 与 integrity 再绑定这些真实 hashes。不得把旧输入 hash 当成新 hash，也未填入推算或虚构数值。

尚未验证：新代码语法/有限回归、实际 SDK observer 对象身份与空 tool-only Session 持久化、实际 sandbox/命令/干净 replay、真实 Reviewer/full material read/准确 semantic FAIL、Provider 费用/重试/限额、实际风险与 Release 次数、安装/新归档/hash，以及 Web/Desktop 视觉。存在的源文件与调用契约不等于已可运行通过。到此停止等待 targeted validation 授权。

## 9. 真实环境阻断归档（最新状态）

> **历史冻结说明：** 本节“最新”指阻断报告形成时的状态，以下原文保留；此后全新 Home 的成功验收及正式关闭见[第 10 节](<P2-C-ENTRY-REPORT.md#10-后续成功验收补记>)。不复用或修改本节失败现场。

### 证据来源与阶段边界

本节仅归档用户本次明确确认的真实执行日志和原生工具审计结论；助手本轮没有重跑、重新计算 hash 或独立读取现场原始日志。`VERIFIED` 表示有用户提供的真实执行/测试证据支持，不表示助手进行了独立复测。旧“入口未实现”“待定点验证”“输入 hash 未取得”等记录保留为各自时间点事实，不再作为最新阻断原因。

P1 已于 **2026-10-11** 以 **CLOSED WITH ACCEPTED EXCEPTION** 关闭；不重开 P1，不将 `EX-P1-032-01` 自动继承为 P2 例外。错误类别相同不等于例外授权相同。

| 类别 | 本次可确认的事项 | 结论边界 |
|---|---|---|
| VERIFIED | P2 A1/A2/B 在其既定范围内通过；A2 曾取得 `113/113 PASS` | 不是最终 C 的真实模型验收，也不是本轮重跑全套测试 |
| VERIFIED | C 入口限定回归 `38/38 PASS`；Manifest 定点回归 `6/6 PASS`；隔离上下文定点回归 `10/10 PASS` | 分别记录，不合并成一次测试总数；不能替代真实 Reviewer |
| VERIFIED | 六份固定输入 SHA-256 与既定记录一致 | 不虚构或重算本次未列出的六个具体 hash |
| VERIFIED | 最后一轮全新 C 归档及隔离 Web Home 安装成功，安装收据核验完成，未继承私人凭据 | 安装成功不等于候选 Prepare 完成 |
| VERIFIED | 无模型 Prepare 真实进程退出码 `2`；原生审计为三次 `write` 成功、一次 `pwsh` 的 `isError: true` | 最后一次 Prepare 已发生真实工具调用；不与本轮仅文档归档混淆；`2` 是驱动进程退出码 |
| BLOCKED | 该 `pwsh` 审计含 `SetNamedSecurityInfoW` / `Win32 5` 类错误特征；前台验证未取得成功结果 | 原始 DSH Shell 环境阻断；不是业务断言失败，不把 Win32 `5` 当作子进程退出码，也不推断未提供的底层权限细节 |
| VERIFIED | 驱动以 `Actual foreground validation failed; retain native audit and stop` 停止并保留现场 | 失败关闭生效，不将失败改为 PASS |
| NOT VERIFIED | 两个候选完整准备、build/test/run/start 独立回放、真实 Reviewer 及其正确/缺陷区分能力 | 首例尚未准备完成；第二候选未开始；真实 Reviewer 从未执行 |
| DECISION PENDING | 是否接受单独 P2 例外、是否正式关闭 P2 | **NO EXCEPTION ACCEPTED**；本节不是例外批准或关闭记录 |

### 最后一次执行的身份与保留现场

- 最后归档 SHA-256（用户实测记录）：`CD87546383C70EFA4DBB7370A3A79E9EAECC5F9A9DCCC30E83B3393A1A8DF914`。
- 最后 [C Home](<../.test-data/acceptance/wish-willow-p2-c-ea22156f-f4d8-428c-aff6-c1cd14152e70>)：`G:\dsh\Wish-Willow\.test-data\acceptance\wish-willow-p2-c-ea22156f-f4d8-428c-aff6-c1cd14152e70`。
- 最后 [Evidence](<../.test-data/acceptance/wish-willow-p2-c-ea22156f-f4d8-428c-aff6-c1cd14152e70/evidence/c-423f6cba-2bd7-48d1-bdc6-d1f81392195f>)：上述 Home 下的 `evidence/c-423f6cba-2bd7-48d1-bdc6-d1f81392195f`。
- [安装收据](<../.test-data/acceptance/wish-willow-p2-c-ea22156f-f4d8-428c-aff6-c1cd14152e70/c-install.json>)核验完成；[Prepare 总 claim](<../.test-data/acceptance/wish-willow-p2-c-ea22156f-f4d8-428c-aff6-c1cd14152e70/c-prepare-started.json>)与[首候选 claim](<../.test-data/acceptance/wish-willow-p2-c-ea22156f-f4d8-428c-aff6-c1cd14152e70/evidence/c-423f6cba-2bd7-48d1-bdc6-d1f81392195f/preparation-claim-0.json>)存在。
- 用户已确认不存在：`preparation-claim-1.json`、`prepared-0.json`、`prepared-1.json`、`prepared.json`、`c-review-started.json`。不存在的文件不是待补写收据，不创建占位文件。

证据链为：限定回归与输入身份核验 → 新归档/新隔离安装及收据 → Prepare 总 claim/首例 claim → 三次原生成功写入 → 首次原生 pwsh 错误 → 驱动 exit 2 并停止 → 没有候选准备完成记录、没有第二候选 claim、没有审查启动记录。它支持**前台验证及后续 Prepare 被阻断**，不支持两例完成、完整 replay、Reviewer PASS/FAIL 或 Host 成功 Release 的真实验收结论。

全部失败 C Home、Evidence、claim、原生审计、日志、归档及旧 B/P1 资产原样保留；不删除、覆盖、修补、重试或复用。本轮仅改现有 P2 文档，不修改生产/测试代码、固定输入、门禁；不调用 Shell/Node/测试/打包/安装/Host/模型，不改 ACL/DSH/Profile/凭据，不做 Git 或 P3。

### 尚缺的真实 Reviewer 验收与关闭条件

**NOT VERIFIED：** 两例真实 build/test/run/start 与干净独立副本完整回放；停止写入者后的可靠持久证据与完整候选绑定；fresh、无父/seed/fork 的只读盲审 Reviewer 实际完整读取必要材料、持久读收据/报告及正常结束；正例合法 PASS 后原 Host gate 恰好一次本地 Release；反例虽命令可 exit 0，仍根据实际减法源码和零输入弱测试给出具体需求违反 FAIL、无 Release。模拟测试或三次 write 成功不能填补这些要求。

正式关闭前，须二选一并形成明确的人类决定：

1. **完整验收路径：** 在另行明确授权、具备真实执行能力且不复用失败现场的环境中补足上述证据，由用户审阅后决定是否关闭。本轮不尝试修复环境、不提出自动重试或执行计划。
2. **独立例外路径：** 用户明确批准一项专属于 P2 的例外，记录证据引用、未验证范围、风险/影响、接受边界与后续处置，并明确决定是否以该例外关闭。不得沿用 P1 例外、默认为已接受、降低门禁或将未测项目写成 PASS。目前没有此批准，P2 仍为 **CLOSURE PENDING**。

### 证据不足与可追溯性限制

当前事实足以记录 Shell 错误类别、驱动失败关闭及 Reviewer 未执行；不足以证明真实 Reviewer 能力或 P2 完整验收。用户本次摘要未逐项提供最后归档的文件路径、六输入具体 hash、原生审计文件名/Session ID/call ID 和完整错误堆栈，本节不猜填，也不声称已独立复核这些原件。原件按上述现场保留；任何后续正式关闭决定应引用原始证据，而不是把摘要当作补测或新收据。

**P2-C PREPARE BLOCKED — ORIGINAL DSH SHELL WIN32 5**  
**P2 REVIEWER LIVE ACCEPTANCE NOT VERIFIED**  
**P2 CLOSURE PENDING — NO EXCEPTION ACCEPTED**

## 10. 后续成功验收补记

### 10.1 签收来源与证据身份

用户已完成后续真实隔离验收，并明确批准将 P2 归档为 **CLOSED — VERIFIED, NO EXCEPTION**。本补记依据磁盘上的既有收据、Prepared、原生工具审计、Review Claim、结果及汇总交叉核验，不是新一次验收。成功证据时间为 **2026-10-12 UTC**；[Prepared 汇总](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/prepared.json>)时间 `2026-10-12T05:26:11.313Z`，[验收汇总](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/acceptance.json>)时间 `2026-10-12T05:53:29.856Z`。它们与第 9 节失败现场不同。

- 成功 [C Home](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2>)：`G:\dsh\Wish-Willow\.test-data\acceptance\wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2`。
- 成功 [Evidence](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3>)：该 Home 下 `evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3`。
- 实际安装 [归档](<../.test-data/packages/p2-c-eafe7ecc-3dfc-4b8b-a560-82244219225e/dsh-wish-willow-0.3.2.tgz>)：磁盘 SHA-256 重新只读计算为 `CD87546383C70EFA4DBB7370A3A79E9EAECC5F9A9DCCC30E83B3393A1A8DF914`，与[安装收据](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/c-install.json>)、[Prepare 总 claim](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/c-prepare-started.json>)和 Prepared 汇总一致。归档 hash 相同不表示可复用第 9 节失败 Home；两次现场身份严格区分。
- 所有权 marker 与物理 Home 匹配；已安装 `dsh-wish-willow@0.3.2`、SDK `0.2.0-rc.2`。安装收据的十项生产文件原始字节 hash 与六项已安装驱动 hash 均匹配磁盘；manifest 的完整规范化 JSON/独立规范化 hash 也匹配。没有将工作树与归档 manifest 的格式差异伪记为字节相等。

### 10.2 从环境阻断到成功准入

历史路径分为两项用户执行的 ACL 修复，不能合并：先由官方 ACL 技能定位**仓库根目录**缺少有效 `WRITE_OWNER`，用户授权添加后复核、普通 DSH Shell 单次 exit `0`；随后嵌套隔离项目仍受 Win32 5 阻断，定位根目录新增 FullControl ACE 的继承标志为 `None`。之后为**本次全新 C Home**先保存原始 DACL，仅对该 Home 添加可继承 `(OI)(CI)(WDAC,WO)`，并核查现有子目录继承；随后的单次 Prepare 和真实双 Reviewer 才取得成功结果。这一操作顺序由用户已核验的执行记录确认；本轮没有查询或修改当前 ACL、没有再次调用 ACL 技能。

本次 Home [原始 DACL 备份](<G:/dsh/wish-willow-acl-recovery-c-18c35cf9-3f2c-46e4-8778-1690b6e99690/original-home-dacl.acl>)的磁盘 SHA-256 为 `34B7E03D6CB968B8687216E95E56AC66CCE5CB5EFD4C1A130047D30C005216D3`，与用户记录一致；[本次恢复目录](<G:/dsh/wish-willow-acl-recovery-c-18c35cf9-3f2c-46e4-8778-1690b6e99690>)及此前[仓库根恢复目录](<G:/dsh/wish-willow-acl-recovery-03b3d5df-a272-4aa7-af62-76fd7b7e91f9>)分别保留。第 9 节及其他失败 C/B 现场、claim、日志、归档均继续冻结，不清理、不修补、不覆盖；旧失败 Home 不复用，成功安装归档另以本次收据身份明确引用。

### 10.3 无模型 Prepare 与身份绑定

用户确认无模型 Prepare exit `0`、Reviewer 驱动 exit `0`；本轮没有重跑进程来测这些退出码。磁盘上两份 [Prepared-0](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/prepared-0.json>)、[Prepared-1](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/prepared-1.json>)与 Prepared 汇总一致，两例 delivery integrity 均 `ok: true`，原生审计 **20/20 无工具错误**：6 write、6 初始检查 pwsh、8 独立 Replay pwsh；14 次 pwsh 均 foreground exit `0`，Win32 5 错误 **0**。六输入的收据/claim/快照及实际快照、Replay 文件字节一致；详细准备证据见[准备报告后续补记](<P2-C-PREPARATION-REPORT.md#10-后续成功验收补记>)。

两例完整 binding 的 `candidateId/projectId/changeId/versionId/buildId/snapshotHash/materialsHash/contractHash` 在 Prepared、[Review Claim-0](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/review-claim-0.json>)、[Review Claim-1](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/review-claim-1.json>)及各结果的 candidate/review/report 中一致；Gate 绑定实际 candidate/review，唯一 Release 绑定正例 Gate 及相同 build/version/change。没有手补证据或新增 Release。

### 10.4 两个真实 Reviewer 的最终结果

[Review 总 claim](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/c-review-started.json>)与两份结果均记录 Provider **`command`**、Model **`deepseek/deepseek-v4.1-flash`**。两例各有一次 attempt、一次 review、一次 gate；实际 Review ID 与 Session ID 均不同，持久 Session header 无 parent/seed/继承，cwd 对应各自候选快照；执行元数据均 `persisted: true`、`endReason: completed`、`failures: 0`。

| 候选 | Project ID | Candidate ID | Review ID | Reviewer Session ID | Verdict / Gate / Local Releases / Status |
|---|---|---|---|---|---|
| [0：正例结果](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/result-0.json>) | `9bcd4a4b-a050-4217-aae3-5500b4682084` | `1e01e0b1-751c-4eb1-a5b7-d33988a35220` | `5a1984fb-32c6-4464-8ed9-f7017160548a` | `wish-review-e4940942-d13e-4568-98cd-2f92bdc3a799` | PASS / ALLOW / 1 / delivered |
| [1：反例结果](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/result-1.json>) | `fc29d407-b03c-4a1d-9485-e4f5914fd2f9` | `98d08873-171c-4b27-b521-c66b93104530` | `0a33c069-1203-440d-9587-12dcf03b7d4b` | `wish-review-662eae17-400e-4f04-b845-0282cf127cd7` | FAIL / NEEDS_CHANGES / 0 / failed |

正例 Gate ID `ef037efd-0d9a-4a1a-9326-fa160d5d1f23`，唯一 Local Release ID `cc4f3b25-9987-4a22-83d6-1bbe819a4b8e`；反例 Gate ID `e0b3a904-62a7-484e-a565-4a8122e8b06c`，没有 Release。Review Claim 的 attempt ID 分别为 `742c136d-1ca3-4454-b64b-1361ba3790ad`、`9e89956a-8f9a-4b40-8e88-e21349ec67c4`；它们不是 Review ID，报告 Artifact 文件按 attempt ID 命名，不构成身份矛盾。

正例必需材料读收据完整；两例实际源码和测试材料均有匹配 hash 的完整读收据。反例的结构化报告引用实际减法实现与唯一零输入弱断言，需求检查 FAIL，并定位 `app.mjs:2` 的 must-fix；这是对已通过命令的语义缺陷作出正确阻断，**不是 P2-C 验收失败**。不把反例 FAIL 扩写成所有材料都已完整读取或命令失败。

两份实际执行统计合计 **9 步（6 + 3）**、**Input Tokens 41,752（24,619 + 17,133）**、**Output Tokens 6,784（3,162 + 3,622）**、**Local Releases 1**，与验收汇总一致，Token 可用标记均为 true。原 claim 明示无硬金额上限，汇总 `modelFee` 为不可用；不猜测账单金额、不承诺费用封顶。

### 10.5 核验边界与关闭

本轮只对既有证据做有文件大小/总读取量边界的只读 Node JSON 解析与 hash 计算，未全文输出模型原始记录、未读取凭据配置；所有关键身份、计数、hash 和汇总核验一致，无缺失或待签收矛盾。A1 `21/21`、A2 `113/113`/check PASS、B 安装及官方 Host exit `0`、历史 ACL 操作过程和驱动退出码按用户已核验事实记录，未重跑或冒充本轮独立复测。没有发现要求另建最终签收文件的文档约束，本轮仅修改用户指定的三份现有文档。

**P2 CLOSED — VERIFIED, NO EXCEPTION。** 正式阶段记录见[执行计划后续关闭补记](<P2-EXECUTION-PLAN.md#后续成功验收补记>)。P0 已完成；P1 保持 **CLOSED WITH ACCEPTED EXCEPTION**，`EX-P1-032-01` 不删除、不改写、不自动解除、不重开；P3 **NOT STARTED**。不将有限两例验收扩展为 Web/Desktop UI 视觉、任意软件质量或 P1 原始模型交付的补验，也不代表公开发布。本轮不运行新验收、Host、Reviewer、模型或 Release，不改 ACL/DSH 配置、代码、测试、输入、Git 或历史资产；归档后停止。
