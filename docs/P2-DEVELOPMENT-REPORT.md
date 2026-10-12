# P2 开发报告：实现与执行边界

> **后续状态补充：** 下文保留原研发交接时的 NOT RUN/未授权事实，不代表最新执行状态。用户后来确认 A1 `21/21 PASS`、A2 `113/113 PASS` 且 check exit `0`，B1/B2/B3 打包、全新隔离安装与官方 Host 正常退出 `0` 已接受；助手未重跑，B 不含浏览器视觉/真实 Reviewer。[先前 C 阻断](<P2-C-PREPARATION-REPORT.md>)之后，用户批准最小内部准备入口/驱动及日志修正；源码交接现为 **C ENTRY PREPARED — AWAITING TARGETED VALIDATION AUTHORIZATION**，见[八项入口报告](<P2-C-ENTRY-REPORT.md>)。真实工具/Reviewer/Release 仍未验证，中性化后哈希实测也未取得；P1 例外和 P2 未关闭结论不变。

## 1. 完成范围

**本报告是源码开发交接，不是 P2 验收结论。** 用户已批准的 P2 方案已增量接入；当前授权仅源码/测试/文档写入。P2 未关闭，不进入 P3，不重开 P1 或修复 DSH。

| 项目 | 状态 | 已完成 / 尚缺 |
|---|---|---|
| 阶段 0 P1 保全 | 完成、已接受 | 用户执行 70 文件逐项 SHA256/Git 检查，助手读清单；未独立运行哈希 |
| P2-A 独立 Reviewer | IMPLEMENTED，运行 NOT VERIFIED | 新 Session、受限实际读材料工具、报告/读回/结束/持久化验证、有限预算与失败关闭 |
| P2-B 风险/状态/RPC/UI | IMPLEMENTED，运行 NOT VERIFIED | 三级策略、不可覆盖历史、候选绑定审批、状态层 Release 私有许可与文件/CAS 复核、重开后待审批候选、当前状态 UI |
| P2-C 测试与候选准备 | IMPLEMENTED（代码），执行 NOT RUN | 九类正反例、显式脚本化 Reviewer、固定真实正/反输入、执行授权计划 |
| 真实隔离模型验收驱动 | NOT IMPLEMENTED / 未启动 | 后续在实际模型执行前准备并静态审核必要驱动；当前只有固定候选与精确范围方案 |
| 构建、测试、打包、安装、真实模型、UI/平台验收 | NOT RUN | 必须另行明确授权；源码人工阅读不等于通过 |

P1 的 [关闭记录](<P1-CLOSURE-0.3.2.md>) 与 `EX-P1-032-01` 原结论不变：真实 0.3.2 成功 DSH 交付仍 NOT VERIFIED；历史 `92/92` 是旧证据，不是本次 P2 通过数。

## 2. P1 保全与 Git

- 最后用户核实的分支为 `p1/unified-bundle`，HEAD `b9d3017e6a8b5877e11fc7e3b2d86b53974037c0`，当时 staged 为空。保留全部既有未提交 F1 代码/测试/文档，不 reset/stash/commit/push，不将原有变更冒充本次新修改。
- 接受的[清单](<../.p1-preservation-before-p2-98df24b943a449d7a5018619a45d159e/preservation.json>) 计划/复制均为 70；用户普通 PowerShell 核验全部 SHA256、复制前后 Git 状态不变。清单 SHA256 为 `42A0BAFD3DF4F3D7D5C8E4EFCA80F0BB12809169B7E28F90E490610CF74E6330`。
- 首次[失败清单](<../.p1-preservation-before-p2-4cd248eebd714dd7971a5b98394247d1/preservation.json>) 只有 1 文件，被拒收。它及[更早的保全](<../.p1-preservation-032-756c12151daa4663ac0563560adb2961/preservation.json>) 均原样留下，无 cleanup。成功保全接受前没有 P2 源码写入。
- 本轮未重新执行 Git/hash 命令，因此上面的 Git/SHA 是用户已经提供的保全基线，不是声称刚测量的当前工作树 hash。没有新的 Commit/Build/Release ID 或已打包归档。

## 3. 主要代码与产物

| 文件 | 内容 |
|---|---|
| [reviewer.js](<../packages/p1/src/reviewer.js>)（新增） | Host 实读/冻结材料、当前与基线哈希校验、新的受限 Reviewer、Session/工具读收据、报告 Artifact |
| [quality-gate.js](<../packages/p1/src/quality-gate.js>)（新增） | strict 质量结构、确定性风险、必要检查与材料覆盖、审批绑定、门禁判定及历史关联 |
| [state.js](<../packages/p1/src/state.js>) | 可选 quality、Artifact/Release 增量字段、append-only 保护、单次私有释放许可、revision CAS、审批与中断记录 |
| [orchestrator.js](<../packages/p1/src/orchestrator.js>) | P1 foreground/replay 门禁保留；Coder 检查/停止写入并 dispose 后才准备材料、独立审查和调用状态层释放 |
| [host.js](<../packages/p1/src/host.js>) | 原 Domain v1/projects 不新增 Domain；新增用户 RPC：批准/拒绝、显式一次重审、原候选继续交付 |
| [统一 Client](<../client.js>) | 最小风险/结论/问题/证据/历史区域及候选绑定操作；旧 Release/旧测试不掩盖当前状态 |
| [check 脚本](<../scripts/check.mjs>) | 纳入两个新增生产模块的后续语法检查，尚未执行 |
| [状态测试](<../tests/p2-quality-gate.test.mjs>)、[Reviewer 测试](<../tests/p2-reviewer.test.mjs>)、[UI 测试](<../tests/p2-client.test.mjs>) | 九类有限正反例；全部 NOT RUN |
| [状态 fixture](<../tests/helpers/p2-state.mjs>)、[Reviewer fixture](<../tests/helpers/p2-reviewer.mjs>) | 标明模拟状态/读材料/报告，不能用作真实模型或执行证据 |
| [P1 runtime helper](<../tests/helpers/p1-runtime.mjs>)、[unified helper](<../tests/helpers/unified-runtime.mjs>) | 独立 Reviewer 计数、显式 fixture、fresh Session、工具限制、步骤/取消测试与完整等待 |
| [P1 执行测试](<../tests/integration/p1-execution.test.mjs>)、[F1 门禁测试](<../tests/integration/p1-delivery-gate.test.mjs>)、[统一运行测试](<../tests/integration/unified-runtime.test.mjs>)、[升级测试](<../tests/integration/upgrade.test.mjs>) | 原断言保留；正例显式加入 Reviewer plumbing fixture，释放动作改为强制受审入口并新增独立关联断言 |
| [固定真实候选说明](<../tests/live-probe-p2/README.md>) | 两组三文件无依赖 Node 正/反例，仅准备，未执行 |
| [P2 任务](<../tasks/P2.md>)、[执行授权计划](<P2-EXECUTION-PLAN.md>) | 契约、状态、有限验证与独立批准边界 |

保留单一 Bundle/Client、现有 P0/P1 Domain、库版本与 package 版本 0.3.2；没有新 Agent 框架、额外依赖、通用安全平台或多模型/递归审查。

## 4. 本轮真实验证事实

**实际做过：** 文件 read/glob/grep、直接源码编辑、对声明/关联/调用顺序/边界的人工静态阅读；先列 Inspect Providers 再查 `agents`/`tools`/Session 和 scoped Event 公共契约，核实全局 `read` 的实际工具 schema。Inspect 只读，未调用业务 Service。发现并静态修正了材料与既有 Build 的关联、Reporter/Host PASS 一致性、当前风险下限（含启动命令与前后实际差异）、完整可见/持久读回正文及正常结束验证、Session 失败保留、最终文件复核期间取消阻断释放、持久候选重开、旧成功 UI 混淆及显式 fixture 等问题。

**没有做过：** Node syntax checker、build/test、真实 Shell/子进程/模型、安装/pack/启动 Host、浏览器/桌面验收、Git 提交、归档重新计算 hash、独立标准模式审查。没有后台 job、子 Agent 或 Workflow。

当前 GUI 未安装/重新加载本工作树，未运行 DSH watcher，不声称 `19387` 页面已自动更新或现在可用。文件工具写入成功不证明 shell/grantWrite、真实 sandbox 或模型接入已工作。

## 5. 限制与风险

1. **尚无执行证据。** 语法、SDK/生命周期、CAS 并发、重开、实际受限工具可见性与真实 Reviewer 判断都必须按计划实测；人工代码自审不是独立验收。
2. **只读能力不是万能沙箱。** scoped `read` 实际遮蔽通用文件读，ID 白名单 + strict 参数 + 全局 mask + guard 均实施；真实 OS 权限仍未测。继续保持单写入 Host，不支持两个进程共写同一 JSON root。
3. **风险规则保守，不是通用扫描器。** Reviewer 可提高风险、不能降 Host 下限；每个新候选必须审查。二进制/不支持编码的必要材料不让 PASS；P1 仍保留原快照文件，不删、不假审。大候选可能超过预算得到 BLOCKED/UNVERIFIED，不能自动截断后 PASS。
4. **旧状态读取与降级不同。** P2 只在新候选操作中增加 optional quality，不补造旧 Review，不 eager 重写已完成记录；P1 未完执行仍按原恢复规则处理。旧 strict 二进制可能拒绝读取新增 quality、Artifact kind、qualityGateId；必须显式安排保全/隔离副本回退，不静默删字段。内部共享源码已经增加 P2，不能把当前 companion 源码重包并称为冻结历史二进制。
5. **脚本化 PASS 不证明产品正确。** 新 P2 runner 仅返回模拟 DTO，既有 P1 runner 才启动真实命令，但都不证明真实模型/OS 沙箱。固定反例须由真实 Reviewer 看源码与弱测试拒绝，不能用 hash 拒绝或预告 FAIL 替代。
6. **已接受 P1 例外仍在。** 若真实工具被 Win32 5 等环境条件挡住，只记录 NOT VERIFIED，不修复 DSH/ACL、不用模拟证据填洞。预算限制会请求取消并 drain Agent，不声称能强制杀死所有底层失控进程。
7. **真实验收驱动仍待准备。** 已提供输入、公共生产接口流程和两次真实调用预算；未创建或声称存在可直接一键跑完的 launcher。执行前还需展示精确模型/路径/驱动与费用范围。

## 6. 需要用户决定的事项 / 下一步

推荐先单独批准[计划 A1](<P2-EXECUTION-PLAN.md>)：语法与九类 P2 接线检查，无模型、无 Shell 子进程、不安装/打包。A2 完整回归（含真实测试子进程）、B 新隔离安装/Host、C 两例真实模型另行批准；commit/push/发布、私人 profile、DSH/ACL、P3 均不包含。

已停在执行授权边界。开发交接不构成 P2 验收或关闭。
