# P1 交付与验收报告

**结论：P1-A/P1-B/P1-C 的代码、独立 Bundle、状态兼容、真实 Agent 两轮交付与独立验证均已完成；P1 开发到此停止，等待独立验收。开发完成不等于验收通过，未进入 P2。**

报告日期：2026-10-10（UTC+08:00）。所有数字来自真实执行记录；未执行的项目在「未验证」中列出，不写成通过。

## 1. 完成范围

| 范围 | 状态 | 对应验收项 |
|---|---|---|
| P1-A 持久产品状态（Project/Requirement/Constraint/Decision/Task/AgentRun/ChangeSet/Evidence/Artifact/Build/Version/Release/History） | 已实现、已测试 | 四.1 |
| P0 数据兼容（P0 文件字节不变、按 UUID 只读导入、失败关闭） | 已实现、已测试、真实运行验过 | 四.1 |
| 最小 Orchestrator + 真实 DSH Agent 规划 → 编码 | 已实现、已测试、**已真实执行两轮** | 四.2 |
| 产品演化看板（真实状态/证据/版本/启动方式，无伪造百分比） | 已实现、已测试、真实页面已注册 | 五 |
| P1-C 真实软件开发闭环（两轮、真实构建/测试/运行、可重复启动） | **已真实交付两轮并独立复验** | 六 |
| 版本语义 Planned/Built/Released 与不可无痕改写 | 已实现、已测试、真实运行验过 | 六.3 |
| 权限收窄、执行失败可见、有界重试、中断待确认 | 已实现、已测试 | 七 |
| P2/P3 能力 | 未实现（不在范围） | 八 |

## 2. 代码与产物（真实路径）

- 分支 `p1/minimal-loop`，开发起点 `main` / `d72ab3c6ae6808aef9337f648acffa37459b8b4f`。P0 跟踪文件未修改。
- P0（保持原样）：`src/host.js`、`src/model.js`、`client.js`、`cordis.patch.yml`。
- P1（新增）：
  - [packages/p1/src/state.js](<packages/p1/src/state.js>)：聚合状态 schema、幂等创建、CAS 变更、恢复、证据门禁。
  - [packages/p1/src/orchestrator.js](<packages/p1/src/orchestrator.js>)：最小主 Agent 与 5 个 scoped 私有工具。
  - [packages/p1/src/artifacts.js](<packages/p1/src/artifacts.js>)：不可覆盖源码快照。
  - [packages/p1/src/host.js](<packages/p1/src/host.js>)：`wishWillowP1` Service 与 `wish_willow_p1` Domain。
  - [packages/p1/client.js](<packages/p1/client.js>)：真实 DSH 页面里的产品演化看板（`settings.section`，order 31）。
  - [packages/p1/package.json](<packages/p1/package.json>)、[packages/p1/cordis.patch.yml](<packages/p1/cordis.patch.yml>)、[packages/p1/README.md](<packages/p1/README.md>)。
- 测试新增：[tests/p1-state.test.mjs](<tests/p1-state.test.mjs>)、[tests/p1-client.test.mjs](<tests/p1-client.test.mjs>)、[tests/integration/p1-runtime.test.mjs](<tests/integration/p1-runtime.test.mjs>)、[tests/integration/p1-execution.test.mjs](<tests/integration/p1-execution.test.mjs>)、[tests/helpers/p1-runtime.mjs](<tests/helpers/p1-runtime.mjs>)。
- 真实运行辅助（可复现，非产品代码）：[tests/live-probe-p1/](<tests/live-probe-p1/>)（临时 Host 探针、只读证据提取器、只读交付校验器）。
- 独立 Bundle：`artifacts/dsh-wish-willow-p1-0.2.0-p1.1.tgz`，22,821 bytes，SHA256 `C48D4555C2B8F4C856A512CC73BE023FFB59ABBE4680D81147C7D75CD4F70476`（`docs/evidence/p1/pack-p1.txt`）。
- 安装方式：官方 `plugin_manager.install_bundle`，`target` = 该 tgz 绝对路径或 `G:\dsh\Wish-Willow\packages\p1`；本次安装返回 `application: applied`。

## 3. 验证证据

### 3.1 自动化（通过）

命令：`node scripts/check.mjs && node --test tests/*.test.mjs tests/integration/*.test.mjs`（bundled Node 24.21.0 / pnpm 11.7.0）

| 执行 | 退出码 | 结果 | 证据 |
|---|---:|---|---|
| 开发前 P0 基线 | 0 | 14 pass / 0 fail / 0 skip | [baseline-check.txt](<docs/evidence/p1/baseline-check.txt>) |
| 最终完整回归 | **0** | **32 pass / 0 fail / 0 skip / 0 cancelled** | [check-final.txt](<docs/evidence/p1/check-final.txt>) |

新增覆盖：
- 状态层（5）：幂等创建/提交、异输入 `idempotency-conflict`、CAS 冲突、持久写失败不改内存、P0 快照逐字符串保留、确认事实不可覆盖、中断后待确认不重跑、无 build/test/run 证据不可交付。
- 客户端（4）：lazy factory 与 package name 一致、additive Slot + locale + 卸载所有权、`/api` + `wishWillowP1/<method>` RPC、看板真实渲染任务/证据/决策/版本/启动方式且不含伪造数据。
- 数据与兼容集成（3，真实 Cordis/Storage/JSON/Domain/Typert/Gateway）：两个 Domain 真实落盘、导入前后 P0 文件**字节完全不变**、同 UUID 导入、新 Host 代际重开一致、坏 JSON/外来版本/非法记录失败关闭且保留字节。
- 执行集成（6，脚本化 Agent 驱动真实编排/真实守卫/真实命令）：证据门禁通过路径；无证据交付被拒；真实非零退出码留证；失败后重试成功并演化出第二个版本；3 次重试上限；步数上限后失败而不是循环；plan 阶段编码、`sandbox_permissions` 提权、工作目录之外写入三类调用均被真实守卫拒绝。

### 3.2 真实运行时（通过）

- 安装：`plugin_manager.install_bundle(G:\dsh\Wish-Willow\packages\p1)` → `application: applied`，**未重启当前 Host**。随后客户端 Inspect `Slots.listSubTree(root=settings.section)` occupants 实测包含 `wish-willow-p1`（order 31、active=true），与 P0 页面并存。
- 真实端到端：临时探针在真实 Host（PID 29280，DSH 0.2.0-rc.2）中调用 `wishWillowP1` 完成两轮愿望，全部结果来自真实模型与真实工具：

| 轮次 | 版本 | ChangeSet | 任务 | 模型调用 | 工具调用 | 记录失败 | 输入 tokens | 输出 tokens | 耗时 | 交付 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1（待办事项应用） | 0.1.0 Released | 1（attempt 1） | 9 | 18 | 39 | 1 | 418,649 | 38,907 | 292,494 ms | Build passed，4 条证据，`npm start` |
| 2（增加优先级与筛选） | 0.2.0 Released | 1（attempt 1） | 10 | 45 | 63 | 4 | 912,452 | 42,121 | 406,785 ms | Build passed，3 条证据，`npm start` |

  - 两轮 `build`/`test`/`run` 均存在真实 `exitCode 0` 证据（`hasBuildTestRunZero=true`）；第一轮的 `test exit=1` 与第二轮的 `run exit=1` 是执行中真实发生并被保留的失败证据（`allSuccessful=false`），随后由真实修复取得 exit 0，未被隐藏或删除。
  - 交付版本各绑定独立且不可覆盖的源码快照目录；Release 记录只追加（32 条 revision 历史，含 `submit-wish`→`start-agent-run`→`record-agent-plan`→`task-status`→`start-validation`→`validation-result`→`build-version`→`release-version`→`finish-agent-run`）。
  - 证据：[summary.json](<docs/evidence/p1/live/summary.json>)、[round1-evidence.json](<docs/evidence/p1/live/round1-evidence.json>)、[round2-evidence.json](<docs/evidence/p1/live/round2-evidence.json>)、探针即时快照 [round1.json](<docs/evidence/p1/live/round1.json>) / [round2.json](<docs/evidence/p1/live/round2.json>)、探针状态 [probe-state.json](<docs/evidence/p1/live/probe-state.json>)。
- 真实源码：`C:\Users\wangw\.dsh\profiles\desktop\wish-willow\projects\72e73806-11ac-44f4-b58a-01ff32153e00`（11 个文件，零第三方依赖）；第 1 版快照 `...\deliveries\<projectId>\85c5989f-…\source`，第 2 版快照 `...\deliveries\<projectId>\3147cf4c-…\source`。

### 3.3 交付物独立复验（由本 Agent 另行执行，不是复用 Agent 自述）

- 在交付目录真实执行：`node scripts/build.js` → **exit 0，73 项静态检查**；`node --test-isolation=none --test tests/todos.test.js` → **exit 0，42/42 通过**；`node scripts/smoke.js` → **exit 0，29 项烟测通过**。
- 真实启动 `node scripts/serve.js`（即交付的 `npm start`），`GET http://127.0.0.1:4173/` → **HTTP 200，2012 bytes**，页面含 `id="todo-list"` 与第二轮新增的 `id="priority-filter"`；随后停止该进程。
- 快照与版本核验（[delivery-verification.json](<docs/evidence/p1/live/delivery-verification.json>)）：两个版本记录的 manifest SHA256 与磁盘一致；每个快照内 11 个文件逐一与 manifest 哈希一致；第 2 版快照与当前工作目录逐文件一致；**第 1 版快照不含 `priority-filter`、第 2 版含**，两版本可实际区分；两个 Release 的快照路径不同、时间有序，历史不可无痕改写。
- 数据安全：P0 文件 `wish_willow.json` SHA256 安装前后均为 `DBBB88BFB5C4D723F6803F63F8F942EF0B48A22DD4238C0ECEC0362C9B9ECBCC`；P1 使用独立文件 `wish_willow_p1.json`。

### 3.4 权限与安全实测

- 新 Session 在 setup 阶段被固定为 `workspace-write`（部署默认只读时保持只读）与 `approval: never`；不修改用户既有 Session。
- 三类越权调用被真实守卫拒绝：规划阶段编码、携带 `sandbox_permissions` 的提权、工作目录之外的 `workdir`。
- 未读取任何凭据/Token；未修改 DSH 核心（`app.asar` SHA256 前后均为 `983CA711…23BC2`）；未推送远程、未创建 Release、未部署公网服务、未新增替代 DSH 服务器。

## 4. 限制与风险

1. **UI 真实点击链路未验证**：本会话没有浏览器/桌面自动化通道可用，因此只在真实运行页面确认了 P1 面板的 Slot 注册（`wish-willow-p1`，order 31，active）与 RPC 契约；Web 与原生 Desktop 的**表单单点击验收标记为 UNVERIFIED**，须按 `docs/P1-ACCEPTANCE.md` D 节由独立验收者执行。真实两轮执行是经临时 Host 探针调用同一公开服务完成的，不是页面点击。
2. **模型成本**：两轮真实执行消耗约 1.33M 输入 / 81K 输出 tokens（DSH 报告的 provider 累计值，非账单金额）。P1 未实现成本上限，只有步数（60）与时间（15 分钟）预算。
3. **单写入 Host**：JSON 后端无跨进程写锁，P0 与 P1 都由同一 Host 写入；不能两个 Host 共写同一存储 root。
4. **重试语义**：失败/待确认的 ChangeSet 可重试（≤3 次）；重试会重新规划，因此该尝试的推断需求会追加到产品历史中（已确认需求始终保留且不可覆盖）。重试一个已被后续成功交付取代的旧失败 ChangeSet 是允许的，会产生新的 Attempt。
5. **工作目录位置**：Desktop profile 下实测工作目录为 `...\profiles\desktop\wish-willow\projects\<id>`（`$DSH_HOME` 在该 Host 中指向 profile 目录），不属于仓库，不会被 Git 跟踪。
6. **快照上限**：源码快照限制 500 个文件 / 单文件 2 MB / 合计 20 MB，超限即失败而非静默截断；不含 `node_modules`、`.git`、`.env*` 与凭据类文件名。
7. **并发能力有限**：同一产品同时只允许一个执行中的 ChangeSet；不同产品可并行，但未做压力与配额验证。
8. **未覆盖平台**：仅 Windows 11 实测；未验证 macOS/Linux、其他 DSH 版本、其他浏览器引擎。

## 5. 未验证 / 未实现

- 未验证：Web 端独立浏览器的完整表单 E2E；原生 Desktop 的键盘/视觉/读屏验收；完整 DSH 应用重启后的 UI 状态；跨 Host 并发 CAS；真实断电/磁盘故障。
- 未实现（按阶段边界）：P2 的独立 Reviewer 体系、跨模型交叉评审、多层质量门禁；P3 的跨模型任务接管、通用断点续跑、多模型动态调度。P1 仍执行了基础构建/测试/验收，未因 Reviewer 属于 P2 而省略质量验证。
- 未实现：云部署、应用商店发布、复杂发布基础设施。

## 6. 需要用户决定的事项

1. 是否接受当前 UI 点击验收为 UNVERIFIED，并按 `docs/P1-ACCEPTANCE.md` 自行/另行安排独立验收。
2. 是否保留已安装的 `dsh-wish-willow-p1`（0.2.0-p1.1）在当前 Desktop profile 中继续使用；如需移除可用官方插件管理器卸载，不删除任何产品数据（真实演示数据 `[P1 E2E TEST] 待办事项应用` 保留在 `wish_willow_p1.json` 与上述工作目录中）。
3. 是否要为本仓库的 P1 提交创建远程推送/Release（本次**未**执行）。

## 7. 下一阶段建议（仅建议）

建议先完成 D 节双端 UI 验收，再考虑 P2：把当前“Host 证据门禁”升级为独立 Reviewer 与分级质量门禁，并复用本次记录的调用/耗时/token/失败/重试数据作为基准对照。未经授权不实施。
