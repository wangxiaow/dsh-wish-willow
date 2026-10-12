# P2-C 准备报告：固定候选的生产入口阻断

> **最新状态：P2 CLOSED — VERIFIED, NO EXCEPTION。** 后续全新隔离 C Home 的无模型 Prepare、20 份原生审计与独立 Replay 已有真实成功证据，随后两例真实 Reviewer/Gate 也满足验收；详见[第 10 节成功验收补记](<P2-C-PREPARATION-REPORT.md#10-后续成功验收补记>)及[入口报告成功证据链](<P2-C-ENTRY-REPORT.md#10-后续成功验收补记>)。
>
> **历史报告保留。** 下文为早期入口缺口及当时交接，不伪装这些问题从未发生；另保留[后来 Win32 5 失败现场归档](<P2-C-ENTRY-REPORT.md#9-真实环境阻断归档最新状态>)。成功使用全新 Home，旧失败现场不改写。P1 例外保持原样，P3 **NOT STARTED**；本轮只读核验证据并更新指定文档，不重跑验收。

**历史状态：C PREPARATION BLOCKED。仅静态准备，不是 C 执行失败或 P2 验收结论。**

后续基线来自用户报告：A1 `21/21 PASS`；A2 `113/113 PASS` 且 `node scripts/check.mjs` exit `0`；B1 本地打包、B2 新隔离 Web Home 安装、B3 官方 `runProfile` 启动及正常退出 `0` 均已接受。助手本轮没有重跑或独立重新测量这些结果。B 不包含浏览器视觉或真实 Reviewer 验收。

## 1. 文件与功能

本轮只增加本报告，并更新[候选说明](<../tests/live-probe-p2/README.md>)、[分项计划](<P2-EXECUTION-PLAN.md>)和[研发报告](<P2-DEVELOPMENT-REPORT.md>)的后续状态链接。未新增一个假装可执行 C 的启动器；六个固定输入、生产代码、测试断言、package/lock、P1 保全和 B 资产未修改。

已静态阅读指定生产模块、固定六文件、官方隔离安装/Host 驱动及其隔离 helper；先列 Inspect Providers，再查询公开 Service/Tool 契约。Inspect 是只读能力发现，不是业务调用，也不是隔离 Host 的实测结果。补充核对了仓库内锁定的 DSH SDK 源码，未修改 DSH。

## 2. 入口与参数：当前不存在合规的完整 C 入口

[公开 RPC 清单](<../packages/p1/src/host.js#L105-L106>)只有 create/submit/retry、既有候选审批/重审/恢复等操作，没有固定候选的无模型准备入口。

- [submit](<../packages/p1/src/host.js#L38-L41>)在创建 ChangeSet 后立即启动 Orchestrator；[两阶段 followup](<../packages/p1/src/orchestrator.js#L258-L269>)分别调用规划和编码模型。它不符合“只调用两次真实 Reviewer、固定反例不编码/不修复”的范围。
- [reReview](<../packages/p1/src/host.js#L81-L90>)需要已持久候选，不提供初次候选/Build/Evidence 入库；[resumeCandidate](<../packages/p1/src/host.js#L93-L101>)只复核既有候选并尝试释放，不产生候选、不调用 Reviewer。
- [prepareReviewCandidate](<../packages/p1/src/reviewer.js#L53-L60>)要求已经存在的 Build、source-snapshot 与 delivery-manifest；它不是固定源文件导入/执行证据生成器。

因此目前没有可以给出的真实 C CLI 命令或已实现参数。禁止虚构 `run-c.mjs`、调用 submit 后中断 Coder、劫持 followup、伪造 AgentFactory 或从 fixture 导入状态来填补入口。

## 3. 真实证据与精确的最小阻断

唯一现有生产准备链在 [Orchestrator](<../packages/p1/src/orchestrator.js#L170-L286>) 的模型 Coder 执行内部：

1. `wish_verify` 的 handler 依赖 `stage === 'code'`，实际通过 scoped DSH `pwsh` 执行并保存 Evidence。
2. `wish_deliver` 的 handler 依赖该闭包的 `wroteCode`、当前 run 的真实 build/test/run 成功证据；随后快照、干净副本 replay、记录 Build/Artifact，产生 `stagedDelivery`。
3. [最终完成性核验](<../packages/p1/src/orchestrator.js#L270-L285>)要求正常 Coder turn/end、可靠 flush、最终交付 tool/result，dispose 写入者后才冻结候选并进入 Reviewer。

这些 handler/完成性核验没有暴露成可由无模型固定候选驱动安全调用的生产操作。[createReplayRunner](<../packages/p1/src/delivery-runner.js#L12-L46>)确实提供无模型真实工具执行，且不 followup；但它只提供副本验证的 run/close，不负责源码写入、生产 Build/Evidence 入库或上面的完成性证明。其规范化返回值也[不返回 caller 需要的 Session/call 身份](<../packages/p1/src/delivery-runner.js#L48-L55>)，不能把它的 DTO 填成一段 Coder 历史。

补充 SDK 静态依据：[tools.execute](<../.research/installed/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js#L3116-L3127>)是工具执行 pipeline；[tools/result](<../.research/installed/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js#L3408-L3426>)是 observer 通知，不等于自动产生 Coder 的持久 Session tool/result 和正常 turn/end。这些原生 loop 事件由 [AgentLoop 调度器](<../.research/installed/dsh/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js#L681-L706>)和 [turn 生命周期](<../.research/installed/dsh/node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js#L938-L1029>)记录。`sessions.flush()` 不会把不存在的事件变成存在。

**最小阻断：Wish Willow 缺少一个复用现有生产准备逻辑、以真实无模型工具审计及停止写入证明为前提的固定候选准备入口。不是 DSH 没有 tool-only 能力，也不是 Reviewer/Release gate 缺失。** 直接以 `store.mutate()` 手拼 passed Build/完成 run 即便符合 schema，仍替代了上述生产准备与完成性核验，本轮不采用。不能把执行过普通 Node 命令、fixture DTO 或“看起来可用”提升为正式证据。

### 所需最小修正——仅建议，未授权、未实施

需先批准一项 Wish Willow 内部小范围调整：从 Coder 闭包抽取共同的真实验证/快照/replay/Build 入库部分，为固定三文件提供显式 opt-in 的 Host 无模型准备分支；只接受固定输入、Host 派生新目录和固定命令，不接受调用方 supplied success/exit/report/Build。记录真实 scoped 工具的完整结果与 Session/call 身份、flush/停止及 dispose 成功；明确这是 runtime 固定候选准备，不冒充 Coder 正常模型 turn，不合成假 tool/result/end。若所需审计/完成证明无法用公开能力真实形成，继续停止。

两种准备来源随后共用现有 `prepareReviewCandidate → registerCandidate → beginReview → reviewCandidate → releaseCandidate`，不得改 Reviewer verdict、风险规则或 Release 私有许可。无需新 Agent 框架、Domain/Client、DSH 核心或 ACL 改动。本轮不抽取、不增加接口；批准后还需静态复核和另行授权的有限回归、全新打包/隔离安装，不能偷偷改 B 已安装包。

## 4. 独立 Session 与实读证明

可复用的生产 Reviewer 已存在：[runReviewer](<../packages/p1/src/reviewer.js#L168-L245>)使用 fresh `wish-review-*`，不 seed/fork/继承 Coder，对 Session ID/cwd/parent/isSeeded 作核验；只读、approval never；全局 mask + scoped opaque-ID read + 同步守卫限制能力。

[读回及终结校验](<../packages/p1/src/reviewer.js#L211-L258>)比较真实成功 value、完整模型可见正文、匹配 call ID 的持久 tool/result 和正常 turn/end；PASS 还要求[必要材料完整覆盖与相关 checks](<../packages/p1/src/quality-gate.js#L75-L98>)。未来必须保留两例真实 Session、读收据、报告 Artifact、绑定 hash；FAIL 要另核验确实实读源码/测试，并给出违反加法契约的具体位置，不能仅凭 verdict 字符串接受。

盲审要求：Reviewer 只见同一加法契约、中性产品/快照路径、实际字节与工具证据；仓库 good/bad 名称、输入顺序映射、验收 oracle 和本报告只能由外部验收者保有，不进入 prompt、材料或 stdout。另发现原[反例测试:5](<../tests/live-probe-p2/bad/app.test.mjs#L5>)输出 `Weak zero-only assertion passed`，其人为评价词会进入源码及执行证据；未来盲审前需明确只中和此类日志提示、不改减法或零输入断言，并重新固定/hash 输入。本轮保留原六文件字节，未送审，不将它们声称为已就绪的盲审包。

## 5. 生产门禁与 Release

[reviewCandidate](<../packages/p1/src/orchestrator.js#L67-L83>)调用原 Reviewer、写报告、finishReview，并进入唯一状态层释放入口。[evaluateGate](<../packages/p1/src/quality-gate.js#L121-L143>)要求合法 PASS/读证据/持久正常结束/绑定；FAIL 为 NEEDS_CHANGES，不完整为 REVIEW_INCOMPLETE，高风险还需绑定批准。

[releaseCandidate](<../packages/p1/src/state.js#L237-L274>)重新核验物理候选/报告，使用私有许可、revision CAS 与幂等 append；[generic mutate](<../packages/p1/src/state.js#L105-L127>)不能新增未授权 Release。未来合格加法候选必须增加恰好一个本地 Release，减法候选必须语义 FAIL 且零 Release；UNVERIFIED/BLOCKED/等待高风险批准均不是 C 接受。不允许高风险自动批准、重审或 resume 来凑结果。

## 6. 隔离根、历史与保留

建议未来 C 使用**全新 Home**，不沿用或重启 B Home。新 Home 模板为工作区 `.test-data/acceptance/wish-willow-p2-c-<新UUID>`，其 `web` profile 单写入 Host；以下都是模板，未创建：

- evidence：`<C_HOME>/evidence/<新运行UUID>`；Host single-use claim 与失败现场均保留。
- 产品：`<C_HOME>/wish-willow/projects/<projectId>`。
- 快照/材料/报告：`<C_HOME>/wish-willow/deliveries/<projectId>/candidates/<candidateId>/<versionId>`。
- 干净 replay：`<C_HOME>/wish-willow/restores/<candidateId>`；创建前必须不存在。
- 原生 Session 与 Product State 在该 Home 的官方存储位置，不复制到真实 Home。

[隔离 helper](<../tests/helpers/isolation.mjs#L64-L105>)已有所有权/规范路径/祖先重解析点/真实 Home 重叠保护；但 [createAcceptanceHome](<../tests/helpers/isolation.mjs#L124-L135>)允许复用既有 owned Home。未来 C 驱动必须额外要求首次准备 Home 不存在，以及 evidence、产品/restore/快照目标新建；模型由用户之后在这个已声明 C Home 配置，执行阶段只认同一个所有权与安装记录、无既有 C claim/产品/Session 的 Home，不另行创建第二个“空 Home”冒充已配置环境。以上限制尚无 C 驱动实现。

只允许真实 Home/祖先根的必要 `realpath/lstat` 元数据保护，不读取其内容/配置/凭据或递归扫描。用户在 C 隔离环境直接配置模型；助手不读取/复制/输出 Key。沿用官方隔离环境过滤，不修改真实 profile、PATH/包管理全局设置或 ACL。当前 `19387` GUI 不更新、不替换，浏览器不开启。

保留用户已接受的 [B 归档](<../.test-data/packages/p2-f01aea6d9ab64313b4ace46cfb2a5a0f/dsh-wish-willow-0.3.2.tgz>)和 B Home `.test-data/acceptance/wish-willow-p2-f01aea6d9ab64313b4ace46cfb2a5a0f`，不覆盖、不清理、不启动。归档 SHA256 `0CB6690AE7BA13385A87B99EE7436D58F6C967C49AFDE8B42EDD048392B7268F` 是用户已有记录，未重算。若修正生产入口，必须生成新归档/新 hash，B 归档不能代表新代码。全部 P1 保全/历史结论不变。

## 7. 预算与费用

未来只有两次 Reviewer 创建额度，正常完整验收恰好两次、每候选一次；失败/中断可以提前停止，**不能保证必须消耗两次额度**。每例最多 20 步/300 秒，合计最多 40 步/600 秒；每例现有工具上限 120。准备/独立 replay 无模型；禁止 Coder 模型、自动修复、自动 retry、重审、Reviewer-of-Reviewer、多模型比较。驱动须在创建前 durable claim 对应额度，失败额度不得回收，重启不得重放；本轮尚无此 C 计数器实现。

现有 Reviewer 会请求取消并等待 drain，不是底层失控模型/进程的强杀保证；预检必须在任何准备模型相关行为或 Agent 创建前失败关闭。逻辑步数/时间不等于 Provider HTTP 请求次数、Token 或金额上限。

实际 Provider/model、默认 preset、Provider 内部重试行为与可支持的 Token/费用限额本轮均未读取运行值/未确认。未来执行前需展示不含凭据的准确选择与限额支持情况，由用户明确授权；若不支持硬金额 cap，必须说明而不是承诺费用封顶，不能静默放宽预算或换模型。实际可得 usage 记录与缺失项分别报告，不预填费用。

## 8. 未来人工步骤与准确命令边界

**当前不要执行。模型执行授权本身不足以解除本报告的代码入口阻断。** 顺序必须是：批准最小 Wish Willow 调整与日志去提示范围 → 完成驱动静态复核 → 另行授权有限回归/新归档 → 确认新 Home 与官方隔离安装/模型配置方案 → 确认实际模型及费用 → 再授权 C。

现有官方 B 入口可供后续新环境准备复用，以下仅是其准确 argv 模板，不是 C Launcher，不是本轮批准，也不能证明 Reviewer 预算计数生效。`$Node` 必须为已核实绝对 Node 路径，`$NewCHome/$NewArchive/$NewEvidence` 必须先确定为该次批准的实际新隔离路径；`$ApprovedFreePort` 为已批准且未占用的 loopback 端口，不能为 19387：

```powershell
& $Node tests/live-probe-unified/install.mjs "$NewCHome" "$NewArchive" web add --authorize-isolated-profile-change
if ($LASTEXITCODE -ne 0) { throw 'Isolated install failed; retain state and stop.' }
& $Node tests/live-probe-unified/start-host.mjs "$ApprovedFreePort" none "$NewCHome" "$NewEvidence" unified --authorize-isolated-host
```

未来最终 C 驱动若拥有自己的 `runProfile` 生命周期，就不能再同时用这个 start-host 入口启动同 Home；只复用其核实过的 boot/环境/overlay 逻辑。启动需要 managed job，收集/停止仅限本次自己启动的 Host，保留 claim，不自动重启。模型配置由用户在批准的隔离环境完成；不自动打开浏览器/复制 Key。不得现在执行安装或启动来探索入口。

**两例 C 的手动执行命令：目前不可提供，因为合规入口不存在。** 补齐入口后必须再提交真实脚本、准确参数、最终路径/hash/Provider/model/支持的限额与证据位置，不能用上述 B 启动命令或候选目录里的普通 Node 命令冒充 C 执行。

## 9. 静态审阅与未验证事项

本轮完成：只读源码/文档/Inspect 契约核对、对生产准备/审查/状态 gate 的调用顺序审阅、记录精确入口缺口与盲审提示风险、说明新 Home/预算/历史保护要求。未执行 Shell/Node（含 syntax/tests）、build/pack/install、Host、浏览器、模型、子 Agent/Workflow、Git/hash/ACL 操作；未重试历史 `grantWrite` 命令；未创建候选、Session、Build、Review、Gate 或 Release，没有后台 job。

未验证：新准备接口与 C 驱动（未实现）、真实写入/命令/独立 replay 与持久审计、SDK 实际生命周期/沙箱、真实 Reviewer 判断/读回/费用、实际风险等级和 Release 次数、隔离模型配置/限额、Web 视觉。脚本化测试只证明 plumbing；用户接受 A/B 不填补这些 C 空白。

到此停止，等待是否批准最小 Wish Willow 准备入口调整，不自行改核心或开始执行。P1 保持 **CLOSED WITH ACCEPTED EXCEPTION**，`EX-P1-032-01` 仍 **NOT VERIFIED**；P2 未关闭，不进入 P3。

---

**后续修正交接（不改写上述历史）：** 用户随后明确批准最小 Wish Willow 内部入口提取、两例驱动、日志去提示和静态检查。本次源代码准备见[入口八项报告](<P2-C-ENTRY-REPORT.md>)，状态为 **C ENTRY PREPARED — AWAITING TARGETED VALIDATION AUTHORIZATION**；旧“入口未实现/日志未改”描述是本报告形成时的事实。真实验收未执行；中性化后实测 SHA256 仍因只读哈希请求在进程前遭 Win32 5 阻止而未记录，不伪填数值。未改 DSH/ACL/Reviewer/gate/state/RPC/历史 B，仍待单独 targeted validation 授权。

## 10. 后续成功验收补记

### 成功准备现场与核验来源

后续真实验收已由用户完成并批准关闭归档。本节只读解析磁盘上的既有证据、计算 hash，不新建候选或执行验证命令。用户确认无模型 Prepare **exit 0**；[Prepared 汇总](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/prepared.json>)时间为 `2026-10-12T05:26:11.313Z`，两候选及相关完整性证据确实存在且交叉一致，不由退出码或用户给定数值单独推断成功。

成功 [C Home](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2>)为 `G:\dsh\Wish-Willow\.test-data\acceptance\wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2`；[Evidence](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3>)为其下 `evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3`。所有权 marker 记录的物理根一致。[安装收据](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/c-install.json>)与[Prepare 总 claim](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/c-prepare-started.json>)、Prepared 汇总的 Home/Evidence/归档/输入 ledger 身份均核验通过；实际[已安装归档](<../.test-data/packages/p2-c-eafe7ecc-3dfc-4b8b-a560-82244219225e/dsh-wish-willow-0.3.2.tgz>) SHA-256 为 `CD87546383C70EFA4DBB7370A3A79E9EAECC5F9A9DCCC30E83B3393A1A8DF914`。两个单例 [Prepared-0](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/prepared-0.json>)、[Prepared-1](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/prepared-1.json>)与汇总中的各项记录完全一致；两个不可覆盖 preparation claim 均存在并绑定相应 index 与同一 ledger。

### 六份固定输入与实际字节

以下 hash 直接来自安装收据，且已逐项与 Prepare/Prepared/两例 claim、preparation inputs、快照条目及**磁盘实际快照和 Replay 文件**交叉核验，6/6 一致。共同输入契约 hash 为 `fa1ebdd0402991890050f40aa074491f72065ca9fc3cee4e9ee79749a080e340`；它是 input ledger 的契约 hash，不与包含项目身份的各候选 binding contractHash 混为一项。

| 候选 | 快照文件 | 字节 | SHA-256 |
|---|---|---:|---|
| 0 | [app.mjs](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/9bcd4a4b-a050-4217-aae3-5500b4682084/candidates/1e01e0b1-751c-4eb1-a5b7-d33988a35220/5e37fd07-b6ea-408f-b5cd-150d7161062e/source/app.mjs>) | 116 | `83b3cdc5f707f54e665e75e41a7cc1503465d269d9c584f5ed419c0f07bbd637` |
| 0 | [app.test.mjs](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/9bcd4a4b-a050-4217-aae3-5500b4682084/candidates/1e01e0b1-751c-4eb1-a5b7-d33988a35220/5e37fd07-b6ea-408f-b5cd-150d7161062e/source/app.test.mjs>) | 263 | `58dc3f00245ca423eafbfcb1939f46040bac1822fc7086c125f32ab65b3e52fc` |
| 0 | [smoke.mjs](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/9bcd4a4b-a050-4217-aae3-5500b4682084/candidates/1e01e0b1-751c-4eb1-a5b7-d33988a35220/5e37fd07-b6ea-408f-b5cd-150d7161062e/source/smoke.mjs>) | 85 | `633fb3ab571d917de85a65b2409cabf1e3184b8e12e52970d55c7193352c6a8f` |
| 1 | [app.mjs](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/fc29d407-b03c-4a1d-9485-e4f5914fd2f9/candidates/98d08873-171c-4b27-b521-c66b93104530/5235911e-d052-435a-87f6-8218e80cb74b/source/app.mjs>) | 116 | `08bfe49b474205614edd68fef28352bcedd40e874be9a3b1da9d128fbee5e971` |
| 1 | [app.test.mjs](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/fc29d407-b03c-4a1d-9485-e4f5914fd2f9/candidates/98d08873-171c-4b27-b521-c66b93104530/5235911e-d052-435a-87f6-8218e80cb74b/source/app.test.mjs>) | 198 | `93f74e0540aa4a58beb84f6cf3b0ce6fc61611352bdf5d7d362492e0ab225529` |
| 1 | [smoke.mjs](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/fc29d407-b03c-4a1d-9485-e4f5914fd2f9/candidates/98d08873-171c-4b27-b521-c66b93104530/5235911e-d052-435a-87f6-8218e80cb74b/source/smoke.mjs>) | 85 | `9780feaae7c2497d1de1f9d3f908b1980a1bc3c241a48e3f53ba67ea447ed8f5` |

### 原生审计、停止写入与独立 Replay

[候选 0 审计目录](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/9bcd4a4b-a050-4217-aae3-5500b4682084>)与[候选 1 审计目录](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/evidence/c-b4e2e0ea-40cc-4f69-8d86-f5aeff3f10a3/fc29d407-b03c-4a1d-9485-e4f5914fd2f9>)各含 10 份真实工具审计，20 个 call ID 唯一；`source` 均为 `dsh-tool-pipeline`，与两份 delivery integrity 嵌入的 native calls 一致。

| 审计类别 | 每例 | 总数 | 磁盘核验结果 |
|---|---:|---:|---|
| write | 3 | 6 | `isError: false`，对应停止前固定三文件写入 |
| 初始验证 pwsh | 3 | 6 | foreground、exit 0、无超时/取消/拒绝/runner failure |
| 独立 Replay pwsh | 4 | 8 | build/test/run/start 各一次，foreground exit 0 |
| 工具错误 / Win32 5 特征 | 0 | 0 | 20/20 无工具错误，原生结果中无该错误特征 |

[候选 0 完整性与准备记录](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/9bcd4a4b-a050-4217-aae3-5500b4682084/candidates/1e01e0b1-751c-4eb1-a5b7-d33988a35220/5e37fd07-b6ea-408f-b5cd-150d7161062e/delivery-integrity.json>)、[候选 1 完整性与准备记录](<../.test-data/acceptance/wish-willow-p2-c-cbdbe52b-0361-4d84-9910-bc3b1651feb2/wish-willow/deliveries/fc29d407-b03c-4a1d-9485-e4f5914fd2f9/candidates/98d08873-171c-4b27-b521-c66b93104530/5235911e-d052-435a-87f6-8218e80cb74b/delivery-integrity.json>)均 `ok: true`，所有记录的完整性 checks 为真；每例四项 Replay 均 passed。准备来源为 `fixed-tool-only`，writer 和 replay 的 `modelCalls` 均 0；持久 header 无 seed/parent，均有 disposedAt，没有 request/assistant 模型事件。两例 source-snapshot、delivery-manifest、review-materials、review-report Artifact 的物理 bytes/SHA-256 与结果中的记录匹配。此处只读证据证明此前已完成的准备，不冒充本轮新执行或普通模型 Coder 正常 turn。

### 两项 ACL 修复与恢复资产

必须分别记录用户已核验的过程：

1. **仓库根目录修复：** 原始 DSH workspace-write pwsh 出现 `SetNamedSecurityInfoW failed (Win32 5)`；官方 ACL 技能发现根目录缺有效 `WRITE_OWNER`，用户授权添加并复核后，普通 DSH Shell 单次 exit 0。[仓库根 ACL 恢复目录](<G:/dsh/wish-willow-acl-recovery-03b3d5df-a272-4aa7-af62-76fd7b7e91f9>)独立保留。
2. **本次全新 C Home 继承修复：** 嵌套项目仍报错，发现根目录新增 FullControl ACE 继承标志为 `None`，不是对子目录有效的继承授权。对新 C Home 先保存原始 DACL，再仅对该 Home 添加可继承 `(OI)(CI)(WDAC,WO)`，核查已有子目录继承；之后无模型 Prepare 和真实 Reviewer 单次验收成功。

本次 [Home DACL 恢复目录](<G:/dsh/wish-willow-acl-recovery-c-18c35cf9-3f2c-46e4-8778-1690b6e99690>)中的[原始 DACL 备份](<G:/dsh/wish-willow-acl-recovery-c-18c35cf9-3f2c-46e4-8778-1690b6e99690/original-home-dacl.acl>)已只读计算 SHA-256：`34B7E03D6CB968B8687216E95E56AC66CCE5CB5EFD4C1A130047D30C005216D3`。操作顺序/权限复核和进程退出码来自用户的已核验执行记录；本轮只核对备份 hash 与成功工具证据，没有再操作 ACL、DSH 或真实 Profile。历史 Win32 5 失败 Home、claim、Evidence、日志及归档仍冻结，未删除、覆盖、修改或复用失败 Home。

### Reviewer 前条件及最终边界

两个固定候选已完成真实准备，三文件实际快照/Replay 字节一致，写入者停止，原生无模型证据完整，才进入原生产 Reviewer。完整候选 binding 已与 Review Claim、结果及报告逐项匹配；fresh Reviewer 的实际源码/测试完整读收据已核对，正例必需材料完整覆盖；反例由真实减法与弱测试的语义问题得到 FAIL，而非 hash 篡改或命令错误。

最终真实 Reviewer 与 Gate 结果、不同 Review/Session ID 及 Token 统计见[入口报告第 10 节](<P2-C-ENTRY-REPORT.md#10-后续成功验收补记>)与[正式阶段关闭补记](<P2-EXECUTION-PLAN.md#后续成功验收补记>)。**P2 CLOSED — VERIFIED, NO EXCEPTION**；P1 保持 **CLOSED WITH ACCEPTED EXCEPTION**，`EX-P1-032-01` 原样保留，不因 P2 成功自动解除；P3 **NOT STARTED**。用户批准的是本轮文档归档，不是重跑、修改权限、公开发布或下一阶段实现授权。
