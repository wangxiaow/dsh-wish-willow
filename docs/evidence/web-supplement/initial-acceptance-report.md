# Wish Willow — P0 最终独立验收报告

> **结论：建议有条件通过 P0；暂不建议正式关闭 P0。**
>
> T1–T6：**4 PASS / 0 FAIL / 2 UNVERIFIED / 0 BLOCKED**。本轮自动化回归：**14 通过 / 0 失败 / 0 跳过，退出码 0**。
>
> 独立 Bundle、真实 Desktop 编辑与持久化、跨应用进程重启恢复、固定 Commit GitHub 隔离安装已有实际证据。Service CAS 通过，但真实 Web 表单 E2E 和双真实客户端冲突/草稿保留尚未充分验证。不能宣布 Web/Desktop 双端全部通过。

验收时间：2026-10-09 22:20 起，2026-10-10 继续并完成（UTC+08:00）。仅验收 P0；未修改产品功能或 DSH 核心，未进入 P1。

## 1. 验收环境与前提

### 1.1 固定环境

| 项目 | 本次实际结果 |
|---|---|
| 操作系统 | Microsoft Windows 11 专业版，10.0.26300，build 26300 |
| DSH | **0.2.0-rc.2**；从当前安装的 ASAR 内部根 manifest、Desktop runtime manifest、CLI manifest 读取，非仅凭 EXE 的 `0.2.0.0` 文件版本 |
| Cordis | **4.0.4**，从当前 ASAR 内 manifest 读取 |
| Wish Willow | **0.1.0-p0.1** |
| Git | `main`；`d72ab3c6ae6808aef9337f648acffa37459b8b4f`；开始时工作树干净 |
| 工作目录 | `G:\dsh\Wish-Willow`，确为独立源码仓库 |
| Host | 官方 Desktop profile；原 Web URL `http://127.0.0.1:19387`，未启动替代服务器 |
| 客户端 | 官方 Electron 原生 Desktop 窗口；真实 Web 已认证客户端未取得 |
| 当前验收会话 | `session-2e9f015d-7a71-4e5c-ad19-a30ebc12e16f`；原生 UI 显示“标准模式”，与侧栏中的此前开发会话分列；继续任务时仍为同一验收会话 |
| 工具 | 文件读取/搜索、Git、PowerShell、Windows UI Automation、Win32 PrintWindow、前台窗口校验后的键盘输入；bundled Node **24.21.0**、pnpm **11.7.0**、Python |
| 测试框架 | Node test runner；实际 Cordis / Storage Domain / JSON / Typert Gateway；React SSR、react-test-renderer；原生窗口 UI 自动化 |
| 回归依赖来源 | 现有依赖 junction 指向仓库忽略目录中的 DSH 依赖副本；本次不是全新机器依赖安装测试 |

当前 ASAR SHA256：

```text
983CA71114E6DFD353FC79AF5A1F9481A250EE64C2A3C757673029B811B23BC2
```

与此前记录及本次开始、继续后的读取一致。当前 Desktop 已安装包的 Host/model/Client/patch/locale 文件逐字节等于仓库源码。其 manifest 是许可证/仓库元数据更新之前的安装代际，**不声称整个已安装 manifest 等于当前仓库**，也没有为此覆盖安装。

证据：[环境与新进程](<docs/evidence/final-acceptance/environment-after-restart.json>)、[ASAR 版本/源码/重启数据校验](<docs/evidence/final-acceptance/verified-environment.json>)、[初始标准模式 UIA 记录](<docs/evidence/final-acceptance/desktop-accessibility.json>)、[执行边界与异常记录](<docs/evidence/final-acceptance/execution-notes.json>)。

### 1.2 必读资料

已实际读取，无缺失：

- [AGENTS.md](<AGENTS.md>)、[README.md](<README.md>)。
- [COMPATIBILITY.md](<docs/COMPATIBILITY.md>)、[P0-REPORT.md](<docs/P0-REPORT.md>)。
- [ARCHITECTURE.md](<docs/ARCHITECTURE.md>)、[API-EVIDENCE.md](<docs/API-EVIDENCE.md>)。
- 按工程规范补读 [PRD.md](<docs/PRD.md>)、[P0.md](<tasks/P0.md>)。

历史报告仅用于定位待验证事实；本报告的通过结论来自本次运行。主 Agent、规划/看板、自动编程、Reviewer、跨模型接管不在本次范围，不作为失败理由。

### 1.3 重启前提的实际变化

**第一次检查不能证明重启。** 2026-10-09 的 Desktop / Host 仍为 PID `31400 / 31800`；Host 启动于 `21:12:37.497+08:00`，早于历史产品创建时间，且与历史报告中的 Host PID 相同。当时仅能确认当前加载与数据存在，未判重启恢复通过。

**用户继续任务后，获得了新的跨进程证据：**

- 旧 PID `31400 / 31800` 均已不存在。
- 新 Desktop PID `5932`，启动于 `2026-10-10T07:53:06.704+08:00`。
- 新 Host PID `29280`，启动于 `2026-10-10T07:53:08.551+08:00`，父进程为 `5932`，监听原端口 `19387`。
- 新原生窗口打开 Wish Willow，读取同一 UUID、revision、文本与状态；完整产品存储文件 SHA256 与中断前一致。

因此最终可以确认**跨完整应用进程更换后的加载和状态恢复**，不是把 Domain 重开当重启。Agent 没有退出、终止或重启 DSH；退出操作的具体方式与关闭序列未被观测，不宣称验证了优雅退出机制或断电恢复。

## 2. 验收结果矩阵

父项状态按完整范围判断；子项通过不能自动提升父项。

| 项目 | 状态 | 实际执行内容 | 主要证据 | 问题和边界 |
|---|---|---|---|---|
| **T1 重启后恢复** | **PASS** | 核验安装、启用；新进程原生插件清单显示运行中；设置入口与真实表单正常；历史及本轮产品跨应用进程更换后保持一致 | [新进程](<docs/evidence/final-acceptance/environment-after-restart.json>)、[运行状态截图](<docs/evidence/final-acceptance/desktop-wish-runtime-details.png>)、[恢复 UI](<docs/evidence/final-acceptance/after-restart-wish.png>)、[数据比对](<docs/evidence/final-acceptance/verified-environment.json>) | 初次检查未证实重启；继续后才满足。未观测具体退出方式 |
| **T2 产品持久化** | **PASS** | 真实 Desktop 新建标记记录、编辑名称和愿望、键盘修改手动状态、保存；revision `1→2→3`；实际 JSON 对照、页面重新读取、重开页面与后续重启恢复 | [创建](<docs/evidence/final-acceptance/live-created.json>)、[更新](<docs/evidence/final-acceptance/live-updated.json>)、[状态更新](<docs/evidence/final-acceptance/live-status.json>)、[重新读取](<docs/evidence/final-acceptance/live-reloaded.json>) | 没有直接编辑在线 JSON；历史产品完全未变 |
| **T3 真实 Desktop UI** | **PASS** | 对真实 Electron 窗口执行设置导航、新建、编辑、保存、重开；Home/Down/Tab 操作状态；亮/暗主题实际加载表单，最后恢复“跟随系统” | [原生动作日志](<docs/evidence/final-acceptance/desktop-actions.jsonl>)、[保存截图](<docs/evidence/final-acceptance/desktop-created.png>)、[重新读取截图](<docs/evidence/final-acceptance/desktop-reloaded.png>)、[亮色](<docs/evidence/final-acceptance/desktop-light-ready.png>)、[暗色](<docs/evidence/final-acceptance/desktop-dark-ready.png>) | 基础可用性通过，不外推为完整读屏、全部快捷键或所有分辨率测试 |
| **T4 真实 Web E2E** | **UNVERIFIED** | 探查已安装浏览器能力，尝试打开原 URL；匿名真实 GET / RPC POST 均为 HTTP401 | [Web 访问记录](<docs/evidence/final-acceptance/web-access.json>) | 未取得已认证、可可靠控制的 DSH 浏览器目标；未完成 DOM 创建/编辑/刷新/错误提示/窄屏/中英文测试。401 不是插件功能 FAIL |
| **T5 Revision 冲突保护** | **UNVERIFIED** | 同一隔离实际 DSH Host 的两个 Service 读取快照均 revision 1；A 保存为 2，B 旧版本请求收到冲突；A 内容及磁盘状态保留；组件冲突草稿测试也通过 | [真实 Service CAS](<docs/evidence/final-acceptance/github-load-and-service-cas.json>)、[回归日志](<docs/evidence/final-acceptance/regression-check.txt>) | **Service：PASS；真实双客户端 UI：UNVERIFIED**。组件测试使用受控冲突回调，不冒充两真实页面 |
| **T6 GitHub 安装** | **PASS** | 核验已记录授权的远程；查询 main；官方 DSH CLI 在全新隔离 home 从完整 Commit 下载、安装并选入 Bundle；加载下载包的真实 Host 入口、调用 Gateway、写盘及 Domain 重开；比较入口字节 | [远程 Commit](<docs/evidence/final-acceptance/github-remote.log>)、[安装日志](<docs/evidence/final-acceptance/github-install.log>)、[加载结果](<docs/evidence/final-acceptance/github-load-and-service-cas.json>)、[本地包检查](<docs/evidence/final-acceptance/artifacts.log>) | 未重新安装当前 Desktop；加载阶段为实际 Cordis/DSH 服务组件，不是第二个完整 Web/Desktop 应用；没有新服务器或共享在线写入 root |

### 2.1 T1：安装、加载与 UI 注册的区分

- **安装/选择：** 当前 Desktop profile 的 manifest 包含 `dsh-wish-willow`；安装源指向本地正式 Bundle，版本 `0.1.0-p0.1`。
- **Host 运行：** 重启后原生只读清单展开 `include:wish-willow-p0`，显示“配置状态：已启用”“运行状态：运行中”。不是只看依赖存在。
- **Client/UI：** 实际设置导航存在 Wish Willow 项，表单通过既有 Connection 成功读取产品。注册检查以真实挂载页面为证据；本轮未调用历史 Creator 模式的 `Slots.listSubTree`，不伪造原始 Slot 查询响应。
- **数据：** 两条产品及完整文件哈希均完成重启前后对比；不是仅看旧 JSON 文件还在。

[Host 状态 UIA 记录](<docs/evidence/final-acceptance/desktop-wish-runtime-details.json>)与[重启后页面 UIA 记录](<docs/evidence/final-acceptance/after-restart-wish.json>)可独立复核。

### 2.2 T2：产品记录与实际落盘

真实存储：[wish_willow.json](<C:/Users/wangw/.dsh/storages/wish_willow.json>)；Domain `wish_willow`，version `1`，table `products`。从文件只读取证，全部生产数据写入均通过原生表单及现有 Host 完成，不写 Session 代替产品状态。

**历史记录未变：** UUID `61dce9a9-7ec2-414f-84a2-7b5f3f7e11bf`，revision `2`，名称 `[P0 TEST] Wish Willow 加载验证`，状态 `draft`。本次脚本将整条记录与历史 [live-reloaded.json](<docs/evidence/live-reloaded.json>)深比较，包括愿望及两个时间戳。

**新增且保留的唯一在线验收产品：**

| 字段/步骤 | 实际值 |
|---|---|
| UUID | `7dee98d3-e9f1-4441-a917-8a5175967fc8` |
| 首次标题 | `[P0 ACCEPTANCE TEST] Desktop 2026-10-09` |
| 首次愿望 | 独立验收测试数据，不代表正式需求。Native Desktop persistence acceptance. |
| 创建 | revision `1`，status `draft`；createdAt = updatedAt = `2026-10-09T14:31:41.867Z` |
| 修改名称和愿望 | `[P0 ACCEPTANCE TEST] Desktop edited`；独立验收测试数据；第二次保存。UUID unchanged; revision must increment. |
| 第二次保存 | revision `2`，updatedAt `2026-10-09T14:32:59.794Z`，createdAt 不变 |
| 键盘修改状态并保存 | status `confirmed`，revision `3`，updatedAt `2026-10-09T14:33:21.122Z` |
| 重新读取、重开页面、应用新进程恢复 | 同一 UUID、revision `3`、文本、状态及时间戳保持一致 |

存储在页面恢复后与应用新进程恢复后的相同 SHA256：

```text
dbbb88bfb5c4d723f6803f63f8f942ef0b48a22dd4238c0ecec0362c9b9ecbcc
```

证据：[重新读取前后](<docs/evidence/final-acceptance/live-reloaded.json>)、[应用重启之后](<docs/evidence/final-acceptance/after-restart.json>)。未发现本轮已保存数据丢失、意外覆盖或错误状态；没有删除测试记录或用户记录。

### 2.3 T3：真实原生窗口的操作与局限

自动化目标是官方 `DeepSeek Harness.exe` 的原生窗口，不是 jsdom、React SSR 或另建页面。使用 Windows UI Automation 的 Value / Invoke / Toggle / ExpandCollapse 模式；键盘输入前确认目标窗口为前台，截图采用只针对该窗口的 PrintWindow。

已执行：

1. 账号菜单 → 设置 → Wish Willow，显示已有产品。
2. 新建标记产品，填写双语内容、保存并在磁盘找到对应 UUID。
3. 修改名称和愿望，保存 revision 2。
4. 聚焦原生状态控件，输入 Home、Down、Tab，保存为 `confirmed` / revision 3；这是实际键盘输入，不是仅调用 React handler。
5. 重新读取、重新打开设置页；后续新 Desktop 进程再次读取同一记录。
6. 分别切换浅色/深色，等待已保存产品加载完成后取图；文字、表单、按钮、选择与焦点基本可见。最后恢复原“跟随系统”。

[主题恢复记录](<docs/evidence/final-acceptance/desktop-themes.json>)。早期加载中截图不用于最终亮暗主题通过结论；最终使用带 `ready` 的两张截图。没有进行完整读屏测试，也不将这项 Desktop 结果复制为 Web 结果。

### 2.4 T5：Service 与 UI 必须分开

隔离安装所得实际 Host 插件使用真实 DSH JSON / Domain / Gateway；同一 Host 的两个逻辑读取快照为 revision `1`：

- A 更新成功，revision `2`，标题 `[P0 ACCEPTANCE TEST] Service winner A`。
- B 携带 `expectedRevision: 1` 更新，收到 `wish-willow/conflict`，details 的 `actualRevision: 2`。
- 再 list 及磁盘结果均严格等于 A，Domain 重开之后也相等。

隔离测试产品 UUID `0b711aa3-2390-42c1-a138-ab055f189516`，与在线产品不同；仅一个写入 Host，且 root 与生产完全分离。

已有 React 交互测试实际运行并通过草稿保留/冲突提示断言，但其 `call` 是受控回调；**没有证据证明两真实客户端下的完整反馈与草稿保留**。因此 T5 父项仍为 UNVERIFIED，不因实现和 Service 通过而降低标准。

### 2.5 T6：固定 Git Commit 的真实下载与安装

远程授权来源为项目 [P0 契约](<tasks/P0.md>)及[交付记录](<docs/P0-REPORT.md>)中的既有用户授权；本次 remote 与其一致。未创建或修改任何 GitHub 资源。

安装地址：

```text
https://github.com/wangxiaow/dsh-wish-willow.git#d72ab3c6ae6808aef9337f648acffa37459b8b4f
```

实际隔离位置：

```text
DSH_HOME = G:\dsh\Wish-Willow\.test-data\final-github-home-20261009
profile = web
service storage = G:\dsh\Wish-Willow\.test-data\final-github-service-storage-20261009
```

[安装脚本](<docs/evidence/final-acceptance/github-install.mjs>)调用官方同版本 DSH 的 `runCli`，参数等价于：

```sh
dsh plugin --profile web add https://github.com/wangxiaow/dsh-wish-willow.git#d72ab3c6ae6808aef9337f648acffa37459b8b4f --ignore-scripts
```

传入 bundled Node + pnpm，不修改全局 PATH/包管理配置；环境变量仅在子进程中生效。禁止 Git 交互式认证及 credential helper，没有读取凭据。

结果：真实 codeload 下载、安装退出码 `0`、新增两个包；profile 选择了 Wish Willow。[后续加载脚本](<docs/evidence/final-acceptance/verify-github-load.mjs>)直接导入**下载后的包**，不是误导入工作区 Host，验证 fiber state `2`、Remote 调用、持久化与重开。入口与工作区字节相等。

安装警告保留：下载速度低、git-hosted build scripts ignored。没有批准或执行额外构建脚本；源码已包含可加载 JavaScript，后续实际加载证明此路径在本次环境可工作。PowerShell 把官方 CLI 正常 stderr 包装成 NativeCommandError，但进程退出码仍为 `0`；不把格式化噪声当安装失败，也没有删改日志。

本地既有 Bundle/source archive 校验退出码 `0`：

- [Bundle](<artifacts/dsh-wish-willow-0.1.0-p0.1.tgz>)：29423 bytes，SHA256 `7bffe6b7b2d13ff7d4f5139cba0f1dcc90d64e1df915ddeb4326746998d25e77`。
- [源码快照](<artifacts/wish-willow-p0-source.zip>)：131483 bytes，SHA256 `61e30f52804548e54106734bea9757ce91a44b8f277c8ca478f6f8caa8385ffe`。

没有重新打包或发布；没有把本地包检查冒充远程安装。本次也不声称已在另一台干净机器或另一完整 DSH 应用上验证。

## 3. 本轮自动化回归

### 3.1 实际命令与结果

于 `2026-10-10T07:58:30+08:00` 在工作区执行：

```powershell
$env:PATH = 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin;' + $env:PATH
& 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' `
  'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs' run check
```

实际展开：

```sh
node scripts/check.mjs && node --test tests/*.test.mjs tests/integration/*.test.mjs
```

| 检查 | 退出码 | 通过 | 失败 | 跳过/取消 | 日志 |
|---|---:|---:|---:|---:|---|
| `pnpm run check`，含入口/语法/build、单元、组件及集成测试 | **0** | **14** | **0** | **0 / 0** | [完整本轮日志](<docs/evidence/final-acceptance/regression-check.txt>) |
| `python scripts/verify-artifacts.py <bundle> <zip>` | **0** | 产物断言通过，非测试 runner 计数 | 0 | 无 | [产物日志](<docs/evidence/final-acceptance/artifacts.log>) |
| `node docs/evidence/final-acceptance/github-install.mjs` | **0** | 固定 Commit 安装完成，非 runner 计数 | 0 | 无 | [安装日志](<docs/evidence/final-acceptance/github-install.log>) |
| `node docs/evidence/final-acceptance/verify-github-load.mjs` | **0** | 实际下载包加载、CAS、落盘、重开断言通过 | 0 | 无 | [加载日志](<docs/evidence/final-acceptance/github-load.log>) |
| `python docs/evidence/final-acceptance/verify-environment.py` | **0** | 当前 ASAR 版本、源码及重启数据断言通过 | 0 | 无 | [结构化输出](<docs/evidence/final-acceptance/verified-environment.json>) |

主命令已涵盖 build、单元及 integration，所以不重复跑同样的子集并重复计数。pnpm 输出包含其自动 up-to-date 检查；既有源码、测试、锁文件的最终 Git diff 退出码为 `0`。

### 3.2 14 项实际通过的测试

1. lazy Client 的 React 加载、additive Slot 与 locale 生命周期。
2. 共用 RPC adapter 的 channel、具名参数及错误传播。
3. 中英文 React SSR 标签、主题 token 与无 iframe/外部 DOM。
4. 真实 DSH shared Fetch carrier envelope 及认证/Origin 信任边界（隔离测试认证 owner 为测试替身）。
5. 真实 Cordis 加载、Gateway 绑定、JSON 持久化、并发 CAS 与卸载/重开。
6. 两个顺序独立 Node 进程恢复同一产品，本轮 seed/recover PID `12140 / 4592`；非 Desktop 重启证据。
7. 损坏 JSON、版本不匹配和非法存储记录失败关闭、原字节保持。
8. 创建、trim、稳定 ID、防御性副本与 revision。
9. 非法输入/额外字段拒绝，未写盘。
10. 并发 CAS 只接受一个写入。
11. 受控写盘失败不改变已提交内存，ID 冲突不覆盖。
12. schema 拒绝坏记录与不支持版本。
13. mounted React 创建/更新/CAS、冲突草稿保留、显式重读。
14. 组件卸载中止请求并忽略迟到响应。

这些是**本次重新执行**，非复制历史 14/14。未删断言、跳过测试或修改测试标准。受控磁盘错误和组件回调不代表真实断电或双浏览器 E2E。

## 4. 发现的问题与风险

未发现已实际复现、足以判定本轮 P0 功能 FAIL 的缺陷。以下区分验收证据缺口、部署限制及测试工具问题，不把“没测到”当“没有风险”。

| 编号 | 描述与严重程度 | 复现/观察步骤 | 影响 | 推荐方向 |
|---|---|---|---|---|
| QA-01 | **高：双端完整验收证据缺口，非已证实功能缺陷** | 未认证访问原 URL / list 返回 401；没有取得已认证可控浏览器表单 | 无法确认 Web DOM 创建、修改、刷新、错误提示、窄屏、双语及双客户端草稿保护；阻止无条件结项 | 在现有同一 Host 提供已认证浏览器，补 T4 和 T5 UI；不得放宽认证 |
| ENV-01 | **中：最初重启前提不成立；现已补证** | 初次 Host 仍为历史 PID，启动早于历史记录；继续后变为新的 Desktop/Host | 初始不能接受重启结论；最终已由新进程和字节一致性关闭此缺口 | 使用本报告的后续证据；不要求再次重启 |
| LIMIT-01 | **中：单写入 Host 边界** | 架构与实际 DSH JSON 后端无跨进程写锁；本次没有执行危险共写试验 | 两独立 Host 共用 root 不在 CAS 保证范围 | Web/Desktop 共连一个 Host，或彻底隔离 roots；本次未开发新锁 |
| TRACE-01 | **低：本机安装包元数据不是仓库最新代际** | 对比已安装 manifest 与当前仓库；运行入口字节相等 | 不影响本轮已测功能，但不能声称整个包完全同代 | 后续有授权且可恢复时再更新安装来源；当前不重装 |
| TOOL-01 | **低：原生自动化模式/焦点不一致** | 早期 Invoke/选择/前台获取失败、控件尚未就绪；操作被保护检查中止 | 部分探针失败，不是产品保存失败；未输入到其他程序 | 按真实 UIA pattern 操作、明确等待 ready、只对目标窗口截图；成功动作与失败边界均留证 |

辅助探针最初有 PowerShell 语法错误、unsupported pattern、missing target、disabled element、前台获取失败等非零退出；均调查后修正**测试脚本**，未改产品。首张前台获取失败的无效截图及无关账户/菜单临时截取已删除，避免留存无关信息；实际失败描述保留于[执行记录](<docs/evidence/final-acceptance/execution-notes.json>)。

下列已知 P0 限制可以保留，不能扩大为承诺：固定 DSH rc.2；无自动迁移/备份、删除、分页、离线写入或跨页面推送；JSON 明文；提交成功但网络响应丢失时 UI 可能显示失败；创建重试无持久幂等键。这些未被本轮升级为 P1/P3 能力。

## 5. 未验证项目与最小补验

### 必须补齐，才能正式关闭 P0

**只需一项环境准备：** 用户提供/保持一个已认证、允许测试的浏览器，访问现有 `http://127.0.0.1:19387`，连接当前 Desktop Host；不启动第二个共写 root 的 Host，不需要再次重启。

随后：

1. **T4：** 在真实浏览器 Wish Willow 页新建单独的 `[P0 ACCEPTANCE TEST]` 产品，编辑/保存/刷新，核对 UUID、revision；检查空名称/超长输入等表单约束、不同宽度，以及配置支持的中英文。记录实际 DOM/交互证据，不用接口替代。
2. **T5 UI：** 两个同 Host 的真实客户端读取同一测试产品、相同 revision；A 保存，B 旧版本保存；核对冲突提示、A 内容未变、B 草稿仍在。Desktop + 已认证 Web 或两个同 Host Web 页均可。

Service CAS 与组件保留草稿虽已通过，不免除第 2 步。

### 不在本轮通过范围内的其他项目

其他 DSH 版本、macOS/Linux、另一台干净机器的安装、全部读屏/键盘路径、网络提交不确定性及真实磁盘/断电故障。以上不构成本次新增功能需求，也不作为 P1 缺失而判失败。

## 6. 最终验收建议

| 必须回答的问题 | 结论 |
|---|---|
| **P0 核心功能是否通过？** | 独立安装/加载、产品状态持久化、跨应用进程恢复、真实 Desktop 最小编辑器、Service CAS **已通过本次对应验证**。整体验收仍有 Web 与真实双客户端 UI 缺口，不能称全部通过 |
| **Web/Desktop 双端兼容是否证据充分？** | **否。** Desktop 原生已有操作/截图/落盘证据；Web 缺少已认证 DOM E2E。共享代码和 carrier 测试不是双端证明 |
| **是否存在阻止后续 P1 的技术问题？** | 未发现已证实的核心数据完整性或加载技术阻断。仍有 QA 结项门槛与单 Host 部署边界；不能因“未发现”就自动批准 P1 |
| **哪些可以保留为已知限制？** | 上述固定版本、单 Host、明文及无迁移/幂等等明确 P0 边界。Web 和双客户端未验证不能悄悄当成永久豁免 |
| **是否正式关闭 P0？** | **暂不建议。建议有条件通过，补齐 T4 与 T5 UI 后再正式关闭。** 不需要重复重启测试或覆盖当前插件 |

## 7. 交付与停止

- 主报告：[P0-FINAL-ACCEPTANCE.md](<docs/P0-FINAL-ACCEPTANCE.md>)。
- 本次新增仅为验收脚本、截图、日志与报告；未修改现有产品源码、已有测试断言或 DSH 核心；未 push、发 Release、升级、设置版本豁免或扩大安全权限。
- 在线保留 **1 条**明确标记的测试产品，最终 revision `3`；历史记录未改变。隔离 GitHub 安装及其单独测试数据保留在被忽略的测试目录，不接入当前 profile。
- 主题已恢复原“跟随系统”。匿名 HTTP 边界未改变，没有读取认证凭据；没有用第二个 Host 共写生产 JSON。
- 原始部分 PowerShell 日志为 UTF-16，另提供内容等价的 UTF-8 `.log` 阅读副本；未删除原始安装日志或警告。
- 证据路径按仓库工作区根定位。截图是本机实际原生窗口，可能含被设置页遮挡的当前验收会话背景；不等同于 Web 浏览器截图。

**本次 P0 最终独立验收到此停止，等待用户反馈；不自动修复产品、不进入 P1。**
