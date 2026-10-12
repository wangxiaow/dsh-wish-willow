# P2-C 两例固定候选：内部验收入口

**C ENTRY PREPARED — AWAITING TARGETED VALIDATION AUTHORIZATION**

[本次八项交接](<../../docs/P2-C-ENTRY-REPORT.md>)说明修改、真实证据条件与未验证项；[先前阻断报告](<../../docs/P2-C-PREPARATION-REPORT.md>)保留为历史。用户已接受的 A1/A2/B 不覆盖本次变更。当前没有运行 syntax/tests/build/pack/install/Host/browser/model，也没有 C PASS。P1 例外不变，P2 未关闭。

## 固定契约与输入

> 本地 ES module 导出 `sum(a, b)`，两个有限 JavaScript Number 按标准 Number 加法返回结果，支持非零、负数、小数；不要求非法输入校验、UI、持久化、网络或外部依赖。提供相关实际断言及本地冒烟入口。

| 输入（仅外部 oracle） | 模块 | 测试 | 冒烟入口 | 真实审查后的预期 |
|---|---|---|---|---|
| 正例 | [加法](<good/app.mjs>) | [有关断言](<good/app.test.mjs>) | [入口](<good/smoke.mjs>) | 合法 PASS → 原 Host gate → 恰好一次本地 Release |
| 反例 | [减法](<bad/app.mjs>) | [唯一零输入断言](<bad/app.test.mjs>) | [入口](<bad/smoke.mjs>) | 三命令可 exit 0，但实际读源码/测试并具体 FAIL，无 Release |

两例日志现均为 `Arithmetic assertions completed`，没有人工 `Weak`/结论提示；反例减法与零输入断言未修复。只有原两例，[固定输入](<inputs.mjs>)核对确切文本并计算实际 SHA256。来源目录名/index/期望 verdict/本 README 与 oracle 不进 Reviewer 材料；材料只有 Host UUID 路径和中性三文件名。

每例准确的逻辑命令（尚 **NOT RUN**）：

```powershell
node --check app.mjs
node app.test.mjs
node smoke.mjs
```

验证通过原生产 `verifyCommand` 执行真实 DSH pwsh；使用已存在的 isolatedCommand 关闭 NODE_OPTIONS/NODE_PATH 并保留真实退出。交付通过原 `stageDelivery` 创建 immutable snapshot、干净副本 replay 的 build/test/run/start、完整性 Artifact 与 Build；不是运行普通 Node 后手拼成功 DTO。

## 准备/审查分离

[内部固定准备](<fixed-candidate.mjs>)只接受 `0|1`、owned C Home/证据目录与 signal；必须有 CLI 总 admission 和每例 `wx` claim，不能传源码、命令、成功/完成标记、Build 或 verdict。使用官方 fresh 无模型 Agent、受控原生 write/pwsh、真实最终 observer/返回值身份、完整原始 DTO 审计文件。flush/dispose 后检查不再 live 并从持久存储读 header/events，核对实际三文件 hashes；无模型循环合成事件。

[CLI](<run.mjs>)再复用 `prepareReviewCandidate → registerCandidate → beginReview → reviewCandidate → releaseCandidate`。生产 [Reviewer](<../../packages/p1/src/reviewer.js>)、[gate](<../../packages/p1/src/quality-gate.js>)、[state](<../../packages/p1/src/state.js>)与 [Remote](<../../packages/p1/src/host.js>)未改。真实 fresh Reviewer 仍 read-only/never、无父/seed/fork、仅 opaque 材料 read/report、原报告和 durable 完成检查。不能手工 append Release 或自动审批/重审。

## 准确入口与未来 argv（本轮不要执行）

入口仅为[run.mjs](<run.mjs>)，下列 flags 是脚本防误操作，不代替会话中的新执行授权。由用户核实 `$Node` 是 Node ≥22 的实际路径；从仓库工作目录运行，拒绝 inherited NODE_OPTIONS/NODE_PATH，不将 DSH_HOME 指向待验收 C Home。

`$PkgUUID`、`$HomeUUID` 为新的 UUID；归档目录为仓库 `.test-data/packages/p2-c-<UUID>`，C Home 为 `.test-data/acceptance/wish-willow-p2-c-<UUID>`。第一次安装要求 Home 不存在；后续仅同一 owned Home/receipt。不得采用旧 B Home/包/claim。`$NewEvidence` 是该 C Home/evidence 下的新 UUID 子目录；端口必须是另行批准的空闲 loopback 端口且非 19387。

```powershell
# 阶段 0：只计算六个真实输入 hash，写新的不可覆盖 ledger；不执行候选/SDK/模型。
& $Node tests/live-probe-p2/run.mjs hash-inputs "$NewHashLedger" --authorize-c-input-hashes

# 阶段 1：必要回归和新 pack/hash 获批并通过后，官方 CLI 全新隔离安装。
& $Node tests/live-probe-p2/run.mjs install "$NewCHome" "$NewArchive" "$ArchiveSHA256" --authorize-c-isolated-install

# 用户自行配置这个 Home 的准确默认 Provider/model/preset/费用控制，不复制旧 Key。
# 阶段 2：另获准后，仅实际工具准备；不调用任何 Coder/Reviewer 模型。
& $Node tests/live-probe-p2/run.mjs prepare "$NewCHome" "$NewEvidence" "$ApprovedFreePort" "$ArchiveSHA256" --authorize-c-tool-preparation

# 阶段 3：只有准备证据成功且 Provider/model/限额/费用另获确认后，执行两例真实 Reviewer。
& $Node tests/live-probe-p2/run.mjs review "$NewCHome" "$NewEvidence" "$ApprovedFreePort" "$ProviderID" "$ModelID" --authorize-c-reviewers --acknowledge-no-hard-money-cap
```

每条结束必须检查 `$LASTEXITCODE`；非 0 保留现场立即停止，不继续下一条。任何 claim 失败不回收，不能自动重启/补跑。Hash ledger 必须位于新的 C UUID package 目录；不预填未测值。SDK 固定 `0.2.0-rc.2`；安装源码、驱动、六输入与归档 hashes 必须一致，旧 B 包无法代表本次修改。

prepare/review 都拥有自己的一次官方 `runProfile` 生命周期，结束正常 shutdown；不要同时再启动 [旧 start-host](<../live-probe-unified/start-host.mjs>)，不要并行写同一个 Home。助手未来启动时须使用 managed job 并收集自己的 job 结果；当前没有后台 job。不开浏览器、不打印认证 URL、不继承模型/云 Key、不读或复制真实 Home/Profile/Storage/Session。路径检查不是万能 OS 隔离声明。

预算只允许每例一次、最多两个 Reviewer 创建，20 steps/300 秒/120 tool calls 各自上限，合计 40 steps/600 秒；无自动 retry/repair/Coder/多模型/递归审查。失败可以早停少于两次，但不得把未用/失败额度换成补跑。Provider request 内部 retry、Token/金额 cap 并未因此硬限制：执行前确认实际 preset 与支持的外部限额；当前 CLI 只支持明确接受“没有费用硬 cap”，若用户要求硬 cap，应先停止等待确切支持方案，不能把时间限额说成费用限额。cancel/drain 不保证硬杀无法响应的底层请求。

## 最小 targeted validation 建议（单独批准）

1. 对[两处生产修改](<../../packages/p1/src/orchestrator.js>)、[replay](<../../packages/p1/src/delivery-runner.js>)及四个新增脚本分别 `node --check`；运行[新增三项静态/plumbing 测试](<entry.test.mjs>)与下列既有有限回归，不用它冒充 C。
2. 准确测试命令模板：

```powershell
& $Node --test tests/live-probe-p2/entry.test.mjs tests/p2-quality-gate.test.mjs tests/p2-reviewer.test.mjs tests/integration/p1-execution.test.mjs tests/integration/p1-delivery-gate.test.mjs tests/integration/unified-runtime.test.mjs
```

既有 P1 集成包含真实本地 fixture 子进程，需明确批准；其脚本化 Agent/Reviewer DTO 不是 DSH C 验收。必要更大 check/build、pack、安装、Host/工具与模型预算均分别授权，不自动扩大。

本轮只读六文件 Get-FileHash 被 **进程启动前**的 `grantWrite` Win32 5 阻止；无 Hash/exit 结果，不重试、不改 ACL。中性化后**实测 SHA256 仍待记录**。Syntax/回归、新包/安装、native 工具/持久审计、真实 Reviewer、费用、风险、Release 数量及 Web/Desktop 均未验证；所有失败保留现场，不伪造成功。
