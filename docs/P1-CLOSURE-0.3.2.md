# Wish Willow P1 / 0.3.2 正式结项归档

**P1 Status: CLOSED WITH ACCEPTED EXCEPTION**  
**Closure Decision: Approved by User, 2026-10-11**

## 1. 决定、版本与适用边界

决策来源：用户在本次「P1 正式结项归档与 P2 准备」请求中明确批准 P1 以验收例外方式关闭。本文件记录用户的管理决定，不是开发 Agent 自行宣布通过，也不替代技术证据。

- 项目：Wish Willow；仓库 `G:\dsh\Wish-Willow`。
- Git 基线：`b9d3017e6a8b5877e11fc7e3b2d86b53974037c0`（简称 `b9d3017`）；既有证据记录分支为 `p1/unified-bundle`。
- 版本：**0.3.2，未正式发布**。既有[构建记录](<../artifacts/BUILD-INFO-0.3.2.json>)记载 F1 改动未提交、产物仅本地保存，没有正式发布完成的独立证据；结项不等于 commit、tag、安装包发布或产品 Release。
- [本地安装包](<../artifacts/dsh-wish-willow-0.3.2.tgz>)既有独立核验值：186679 bytes；SHA-256 `84209e23156fb76572dcf5467bd12630a5d9711048123bc3631c3184c063bb08`。本轮未重新打包或计算哈希。

**三类事实分别保留：** §2 为已完成开发及已验证能力；§3 为唯一明确接受、仍未验证的验收例外；§4 为非阻断性技术债及已知限制。任何一类都不得替代另一类。

[独立验收报告](<evidence/p1-final-independent-032-a/P1-0.3.2-INDEPENDENT-ACCEPTANCE.md>)当时的 **ACCEPTANCE BLOCKED** 结论和[0.3.1 历史验收报告](<P1-FINAL-ACCEPTANCE.md>)均原样保留。用户现在接受例外并关闭 P1，不追溯改写它们的技术结论；P2 尚未获实施授权。

## 2. 已完成的 P1 能力与通过证据

下表复用既有源码、测试日志、哈希比对、持久化状态及工具事件；不是仅以开发报告自述判定通过。本轮不执行任何测试或真实模型。

| 能力 / 验证 | 归档结论与边界 | 证据 |
|---|---|---|
| 产品状态、主 Agent、任务契约、最小看板、统一 Bundle | 已提供可复用基础；需求来源区分、稳定 ID、CAS/幂等、执行证据、版本和追加式 Release。历史 Web/Host/模型及演化记录仅证明其对应版本，不外推为 0.3.2 成功交付 | [P1 契约](<../tasks/P1.md>)；[历史验收](<P1-FINAL-ACCEPTANCE.md>) |
| F1-A：Release 错误放行修复 | 已修复并有针对性回归：缺失/失败/未验证执行不得进入 Built/Released；服务交付健康探测有门禁契约测试，但真实端到端成功仍属 §3 | [F1 收敛报告 §2](<evidence/p1-f1-final/P1-0.3.2-FINAL-REPORT.md#L35-L46>)；[回归日志](<evidence/p1-final-independent-032-a/provenance/test-0.3.2.txt.utf8.txt>) |
| F1-B：独立快照验证修复 | 工作区外独立副本的实际命令回放集成验证通过；使用脚本化 Agent/fixture runner，不等同真实 DSH 沙箱或模型交付 | [集成断言](<../tests/integration/p1-delivery-gate.test.mjs#L37-L88>)；[回归日志](<evidence/p1-final-independent-032-a/provenance/test-0.3.2.txt.utf8.txt>) |
| F1-C：快照/恢复安全边界修复 | 路径、重解析点、manifest、不可覆盖及凭据排除已有针对性回归证据 | [F1 收敛报告 §2](<evidence/p1-f1-final/P1-0.3.2-FINAL-REPORT.md>)；[回归日志](<evidence/p1-final-independent-032-a/provenance/test-0.3.2.txt.utf8.txt>) |
| F1-D：测试与安装隔离修复 | 所有权标记、危险路径拒绝、默认不清理、显式执行/安装授权等已有回归及隔离安装证据 | [F1 收敛报告](<evidence/p1-f1-final/P1-0.3.2-FINAL-REPORT.md>)；[构建及隔离安装记录](<../artifacts/BUILD-INFO-0.3.2.json>) |
| 全部自动化回归 | **PASS：92/92**；0 fail / 0 skipped / 0 cancelled，既有 check/test 均 exit 0 | [原始结果的 UTF-8 副本汇总](<evidence/p1-final-independent-032-a/provenance/test-0.3.2.txt.utf8.txt#L97-L104>)；[退出码记录](<evidence/p1-f1-final/verification-summary.json>) |
| 源码与包对应 | 75 个包内文件中 74 个字节相同；根清单差异仅序列化格式/键排序，解析字段等价；0.3.2 包 SHA-256 与构建记录一致 | [逐文件比对](<evidence/p1-final-independent-032-a/provenance/provenance.json>)；[清单等价检查](<evidence/p1-final-independent-032-a/provenance/manifest-equivalence-from-archive.json>) |
| 0.3.1→0.3.2 隔离安装升级 | **PASS**：安装 exit 0；7 个基线文件、测试历史、非空 Release 和快照在升级及真实 Host 重开后保持不变。基线是经用户明确接受的 `UPGRADE FIXTURE ONLY` 数据，不是实际私人历史迁移，也不是模型交付 | [升级前基线](<../.test-data/acceptance/home-p1-final-032-a/evidence/upgrade-before/baseline.json>)；[安装后比对](<../.test-data/acceptance/home-p1-final-032-a/evidence/upgrade-after-install/upgrade.json>)；[真实 Host 重读](<../.test-data/acceptance/home-p1-final-032-a/evidence/live-032/upgrade-host-readback.json>) |
| 真实 Web → Host → 模型调用及失败状态 | **调用已发生**；真实 Shell 启动受阻，源码未生成，项目 failed、版本 Planned、Release 为 0，未错误放行。此项不是成功交付 PASS | [真实项目状态](<evidence/p1-final-independent-032-a/final/real-project.json>)；[执行与最终完整性摘要](<evidence/p1-final-independent-032-a/final/final-evidence.json>)；[原始工具错误摘录](<evidence/p1-final-independent-032-a/final/TOOL-ERROR-EXCERPT.json>) |

独立验收的完整实际命令、退出码、来源与限制见[独立报告 §3–§6](<evidence/p1-final-independent-032-a/P1-0.3.2-INDEPENDENT-ACCEPTANCE.md>)；开发改动背景见[F1 收敛报告](<evidence/p1-f1-final/P1-0.3.2-FINAL-REPORT.md>)。这些证据在本轮均未改写。

## 3. 唯一已接受的验收例外

**EX-P1-032-01：真实 DSH 环境中的 0.3.2 成功交付链路尚未完成端到端验证。**

接受者与日期：**用户，2026-10-11**。接受的是在当前证据下关闭 P1 的管理决定，**不是把以下项目改写为 PASS**。

| 0.3.2 真实成功路径项目 | 保留的技术状态 |
|---|---|
| 真实模型驱动的源码生成 | **NOT VERIFIED** |
| PowerShell `start.ps1` 启动入口的真实交付 | **NOT VERIFIED** |
| 真实 Host 的独立快照启动（含必要运行文件/依赖完整性） | **NOT VERIFIED** |
| HTTP 健康检查端到端执行 | **NOT VERIFIED** |
| 最终成功进入 Released | **NOT VERIFIED** |

### 已发生的失败事实

- Project：`49a97966-1d1e-4c9a-81ad-f475e8f02297`；Session：`wish-willow-306e3489-e29e-4816-971c-00c4db64d861`。
- 模型：`command / deepseek/deepseek-v4.1-flash`。已真实规划和调用工具，但工作目录为空，build/artifact/Release 数量均为 0，状态正确保持 `failed / Planned`。
- 原始最小 Shell 调用仅输出字符串，仍在进程启动前失败；**无进程退出码**，不能记作 exit 1：

```text
Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(G:\dsh\Wish-Willow\.test-data\acceptance\home-p1-final-032-a\wish-willow\projects\49a97966-1d1e-4c9a-81ad-f475e8f02297)
```

[工具事件证据](<evidence/p1-final-independent-032-a/final/TOOL-ERROR-EXCERPT.json>)指向 DSH 执行环境的启动准备阶段；**目前没有证据证明错误由 Wish Willow 产品代码造成，具体根因仍未确定**。后续安全边界静态核验未再次执行 Shell，结论仍为 ENVIRONMENT BLOCKED；P1 管理关闭不表示环境问题已解决。

### 后续补证边界

只需在另行确认具备安全 DSH Shell 执行条件、并获用户明确运行与模型用量授权时，补充**一次真实成功路径验收**。无需重做 P1 或重新运行全部历史测试；不得修改旧证据来消除例外，不自动宣称由 P2 解决，也不把补证设为本次管理关闭的新前置条件。本轮不执行该补证。

## 4. 非阻断性技术债与既有适用限制

以下事项仅交接记录，不新增 P1 阻断标准，不新增验收例外，也不构成本轮开发任务：

- **可追溯性完善**：既有日志与包/当前源码已核对，但原回归执行时没有独立冻结的全量源码哈希清单；不能宣称具备测试时点的密码学绑定。后续若需加强构建追溯，应单独决定范围。依据：[独立报告 §3](<evidence/p1-final-independent-032-a/P1-0.3.2-INDEPENDENT-ACCEPTANCE.md#L47-L60>)。
- **版本与发布归档**：0.3.2 本地未提交改动及未正式发布状态继续保留；历史报告反映不同日期/版本，不统一改写为最新 PASS。提交、发布及后续文档维护均须另行授权。依据：[构建记录](<../artifacts/BUILD-INFO-0.3.2.json>)。
- **适用能力边界**：当前独立交付补丁的已验证场景为无第三方依赖的 Node/PowerShell 程序，不是通用依赖闭包验证；单写入 Host、平台/DSH 版本等既有限制继续有效，不因结项而扩大承诺。依据：[既有架构约束](<ARCHITECTURE.md#L39-L53>)。

Shell 安全执行条件及其未定根因单独保留为 §3 例外的环境依赖，不擅自登记为 Wish Willow 产品修复需求。

## 5. P2 交接准备（仅资料，未实施）

- **可复用基础**：统一 Bundle/工作台、独立产品事实与执行 Session 的关联、稳定标识与状态持久化、需求/决策来源、任务及执行证据、Built/Released 区分、不可覆盖快照、失败关闭门禁、既有回归和隔离升级证据。
- **原计划方向**：独立 Reviewer、分级质量门禁及相应测试证据治理；仅沿用阶段方向，不提前设计完整架构、增加 Agent 角色实现或创建 P2 开发任务。
- **必须携带的未决事项**：§3 唯一已接受例外仍为 NOT VERIFIED，§4 技术债/适用限制保持原口径；实际 DSH Shell 执行条件须单独确认，不能因 P1 已关闭默认已恢复。
- **实施前用户需明确**：P2 的具体产品范围、里程碑与验收口径；Reviewer 的职责/独立性及门禁分级、阻断与人工决策边界；允许修改的代码/数据范围，以及真实模型费用、隔离运行、Git 提交/发布等操作授权。
- **授权状态**：本轮只完成交接资料整理；P2 范围、里程碑及实施均由用户后续单独批准。P1 未验证项不会自动转为“P2 已承诺解决”。

## 6. 本轮归档操作与停止声明

本轮仅新增本文件，并在[P1 任务文档](<../tasks/P1.md>)顶部增加正式状态及引用；历史章节、历史报告、原始证据、Release 和安装包保持原样。

未调用 Shell，未运行回归/构建/打包/安装/模型，未改生产源码或测试，未修改 DSH Home/Profile/ACL/Sessions/Storages，未执行 Git commit/push/reset/clean/checkout 或任何删除清理操作。Git 引用、索引及既有未提交改动未由本轮操作改写；仅这两份授权文档形成新的工作区内容变化。没有运行 Git 检查，因此不宣称工作树洁净或重新核验了 HEAD。

**归档完成后停止。P1 为 CLOSED WITH ACCEPTED EXCEPTION；0.3.2 真实成功交付保持 NOT VERIFIED；0.3.2 未正式发布；不开始 P2，等待用户下一次明确授权。**
