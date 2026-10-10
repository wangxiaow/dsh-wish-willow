# Wish Willow — P0 最终独立验收报告

> **最终结论：P0 验收通过，建议正式关闭 P0。**
>
> **T1–T6：6 PASS / 0 FAIL / 0 UNVERIFIED / 0 BLOCKED。**
>
> 原有回归实测 **14/14 通过，退出码 0**；本次仅补 T4/T5，最终真实浏览器证据校验 **20/20 通过，退出码 0**。两种计数分开，不合并为“34 项回归”。
>
> Web/Desktop 已有分别执行的真实 UI 证据；两个真实浏览器客户端的旧 revision 冲突、胜者保护和败方草稿保留已补齐。结论限于下述版本、平台与单写入 Host 边界，不代表跨 Host 共写或所有平台兼容。

更新日期：**2026-10-10**，补验及清理完成于当日 18:15（UTC+08:00）。初次验收始于 2026-10-09。

本次依用户要求**仅补测原 UNVERIFIED 的 T4 与 T5**，没有重跑 T1/T2/T3/T6 或完整回归，没有修改产品功能、DSH 核心或既有测试。此前“有条件通过”的[原报告完整存档](<docs/evidence/web-supplement/initial-acceptance-report.md>)保留，SHA256 `bc53b5af4f6ae3bfc7bfe206e5944b5c78dad4386c80ec8a747dac5cfeba97ee`；其中的未验证结论由本次证据取代。

## 1. 环境、工具与验收边界

| 项目 | 核验结果 |
|---|---|
| OS | Windows 11 专业版，10.0.26300，build 26300 |
| DSH / Cordis | **0.2.0-rc.2 / 4.0.4**；版本来源为当前安装 ASAR 内 manifest，不仅依赖 EXE 文件版本 |
| Wish Willow | **0.1.0-p0.1** |
| Git | `main`，`d72ab3c6ae6808aef9337f648acffa37459b8b4f` |
| 仓库 | `G:\dsh\Wish-Willow` |
| 原 Desktop | PID `5932`；Host PID `29280`，`127.0.0.1:19387` |
| 用户原 Web | Host PID `8860`，`127.0.0.1:3080`；其 Web profile 未选择 Wish Willow，未修改 |
| 本次隔离 Web | 用户明确批准后启动；Host PID **29872**，`http://127.0.0.1:3081`；结束时正常停止、退出码 **0** |
| 隔离 home | `G:\dsh\Wish-Willow\.test-data\final-github-home-20261009`，复用前轮已安装固定 Commit 的 Web profile |
| 隔离产品存储 | [wish_willow.json](<.test-data/final-github-home-20261009/storages/wish_willow.json>)；与原 Desktop 的产品文件完全分离 |
| 两个真实客户端 | Chrome PID `9908` 的两个独立窗口/页面；窗口句柄 **21497424 / 395682**，均验证 origin 为 `http://127.0.0.1:3081` |
| 执行工具 | Windows UI Automation、目标窗口 PrintWindow、带前台保护的键盘输入；bundled Node 24.21.0、pnpm 11.7.0、Python |
| 记录方式 | 浏览器真实控件的 accessibility/DOM 投影、截图、动作日志及只读磁盘快照；不是 SSR、mock UI 或接口调用替代页面交互 |

证据：[原环境/进程](<docs/evidence/final-acceptance/environment-after-restart.json>)、[版本与入口校验](<docs/evidence/final-acceptance/verified-environment.json>)、[隔离 Host](<docs/evidence/web-supplement/isolated-host.json>)、[两个浏览器窗口](<docs/evidence/web-supplement/browser-targets.json>)、[清理核验](<docs/evidence/web-supplement/cleanup.json>)。

当前安装 ASAR SHA256：

```text
983CA71114E6DFD353FC79AF5A1F9481A250EE64C2A3C757673029B811B23BC2
```

已读取的项目契约与说明：[AGENTS.md](<AGENTS.md>)、[README.md](<README.md>)、[PRD.md](<docs/PRD.md>)、[ARCHITECTURE.md](<docs/ARCHITECTURE.md>)、[COMPATIBILITY.md](<docs/COMPATIBILITY.md>)、[API-EVIDENCE.md](<docs/API-EVIDENCE.md>)、[P0-REPORT.md](<docs/P0-REPORT.md>)、[P0.md](<tasks/P0.md>)。主 Agent、规划/看板、自动编程、Reviewer、跨模型接管均不在本次范围。

### 1.1 对此前连接建议的纠正

“两个客户端连接同一 Host”**不要求**“浏览器必须连接 Desktop 的 19387”。两个浏览器页面连接同一个 Web Host 同样满足 T5。

用户打开 3080 的方式是正常 Web 使用方式；其 [Web profile](<C:/Users/wangw/.dsh/profiles/web/package.json>)只有基础与 Web Bundle，没有 Wish Willow，因此缺失设置入口属于环境配置差异，**不是插件功能 FAIL**。Desktop 的认证 URL 由内部启动流程交给 Electron，裸开端口不会自动认证；没有提取该认证信息或放宽安全边界。

经用户明确选择“允许，按隔离方案完成补验”，采用[启动器](<docs/evidence/web-supplement/start-web.mjs>)调用同版本官方 `runProfile`，加载完整 Web profile；普通[配置 overlay](<docs/evidence/web-supplement/runtime.patch.yml>)仅关闭认证 URL 的日志输出和默认浏览器交接。官方新实例生成的认证 URL 直接交给 Chrome，随后使用正常签名 cookie。**没有伪造认证、mock carrier 或关闭认证**，也没有把两个 Host 指向同一产品文件。启动过程不需要模型 Key，使用了内置“稍后配置”。

官方资料与具体依据见[连接方式核对记录](<docs/evidence/web-supplement/DSH-WEB-ACCESS.md>)。

## 2. 最终结果矩阵

| 项目 | 最终状态 | 实际测试及证据 | 结论边界 |
|---|---|---|---|
| **T1 重启后恢复** | **PASS** | 沿用前轮实测：旧 Desktop/Host `31400/31800` 消失，新进程 `5932/29280` 启动；插件清单显示启用、运行中；真实页面与完整产品文件恢复一致。[运行状态](<docs/evidence/final-acceptance/desktop-wish-runtime-details.png>)、[恢复 UI](<docs/evidence/final-acceptance/after-restart-wish.png>)、[字节比较](<docs/evidence/final-acceptance/verified-environment.json>) | 不是 Domain 重开代替应用重启；未独立观测具体退出方式，本次未主动重启 |
| **T2 产品持久化** | **PASS** | 沿用前轮实测：原生 UI 新建、编辑、改状态，revision `1→2→3`，UUID/createdAt 稳定，重新读取和跨进程恢复一致，历史产品未变。[创建](<docs/evidence/final-acceptance/live-created.json>)、[状态保存](<docs/evidence/final-acceptance/live-status.json>)、[恢复数据](<docs/evidence/final-acceptance/after-restart.json>) | 没有直接编辑在线 JSON |
| **T3 真实 Desktop UI** | **PASS** | 沿用前轮真实 Electron 操作：创建/编辑/保存/重开、Home/Down/Tab、亮暗主题；恢复“跟随系统”。[动作](<docs/evidence/final-acceptance/desktop-actions.jsonl>)、[亮色](<docs/evidence/final-acceptance/desktop-light-ready.png>)、[暗色](<docs/evidence/final-acceptance/desktop-dark-ready.png>) | 不外推为全部读屏或所有分辨率 |
| **T4 真实 Web E2E** | **PASS（本次补齐）** | 实际 Chrome 表单创建、编辑、状态保存、整页刷新；空/空白名称不可保存；超长名称和愿望显示错误且不写盘；640px 窗口布局、中英文真实渲染。[刷新恢复](<docs/evidence/web-supplement/a-refreshed.png>)、[窄窗口](<docs/evidence/web-supplement/a-narrow.png>)、[英文](<docs/evidence/web-supplement/a-english.png>)、[错误反馈](<docs/evidence/web-supplement/a-invalid-title.png>) | 已认证完整 Web，不再以匿名 401 或共享代码代替验证；逐键截断不作额外保证 |
| **T5 Revision 冲突保护** | **PASS（本次补齐）** | 两个独立真实页面均读 revision 2；A 保存为 3；B 旧版本保存出现冲突，B 草稿保留，A 的整条记录和磁盘字节保持；B 显式重读才替换草稿。[B 冲突](<docs/evidence/web-supplement/b-conflict.png>)、[B 重读](<docs/evidence/web-supplement/b-reloaded.png>)、[冲突后磁盘](<docs/evidence/web-supplement/after-b-conflict.json>) | Service CAS 和真实双客户端 UI **均 PASS**；不宣称跨 Host CAS |
| **T6 GitHub 安装** | **PASS** | 沿用前轮固定 Commit 的官方 CLI 隔离下载/安装、实际下载包加载及源码比对。[安装日志](<docs/evidence/final-acceptance/github-install.log>)、[加载与 CAS](<docs/evidence/final-acceptance/github-load-and-service-cas.json>)。本次直接使用该已安装 profile，未重装 | 原 Desktop 未覆盖安装；不宣称其他机器/版本已验证 |

T1/T2/T3/T6 的完整步骤、时间戳、产物哈希、警告及逐项回归列表保存在[初次报告](<docs/evidence/web-supplement/initial-acceptance-report.md>)，本次没有把它们重新计为新执行。

## 3. T4 补验详情

### 3.1 创建、编辑与刷新

隔离新增的唯一 Web 测试产品：

| 字段 | 结果 |
|---|---|
| UUID | **`cbfe4850-a928-4b32-8af8-cb95dfe5db8c`** |
| 首次标题 | `[P0 ACCEPTANCE TEST] Web supplement` |
| 首次愿望 | 仅验收数据，不代表正式需求。Real authenticated Web E2E. |
| 创建 | revision **1**，status `draft`；createdAt/updatedAt 为 `2026-10-10T08:52:56.660Z` |
| 编辑标题 | `[P0 ACCEPTANCE TEST] Web edited` |
| 编辑愿望 | Web 第二次保存；UUID stable. 中文与 English 均可编辑。 |
| 编辑保存 | revision **2**，status `confirmed`；createdAt 不变，updatedAt 更新 |
| Ctrl+R 整页刷新 | 重新进入插件，UUID、名称、愿望、状态、revision **2** 与磁盘一致 |

证据：[创建记录](<docs/evidence/web-supplement/created.json>)、[编辑记录](<docs/evidence/web-supplement/edited.json>)、[刷新后实际控件](<docs/evidence/web-supplement/a-refreshed.json>)。

### 3.2 校验、布局与语言

- 空名称、仅空格名称：实际 Save 控件禁用，不能创建错误记录。
- 通过浏览器 accessibility 设置超长名称、10001 字符愿望并点击真实 Save：显示名称/愿望长度错误；已提交记录与磁盘哈希不变，未用直接 RPC 制造反馈。
- 实际窗口宽度 **1935、1280、640 px**；640px 下列表和表单改为上下排列，已检查字段横向边界及截图，没有发现妨碍基本编辑的横向溢出。纵向内容通过容器滚动显示。
- 通过 DSH 语言选择器切换英文，验证真实标签、按钮、说明及错误文本；中文/英文混合产品内容保持。结束前恢复中文。

证据：[空白名称](<docs/evidence/web-supplement/a-whitespace.json>)、[非法名称未落盘](<docs/evidence/web-supplement/invalid-title-rejected.json>)、[非法愿望反馈](<docs/evidence/web-supplement/a-wish-after-save.png>)、[非法愿望未落盘](<docs/evidence/web-supplement/wish-boundary-rejected.json>)、[中文恢复](<docs/evidence/web-supplement/a-restored.json>)。

**测量边界：** UIA `ValuePattern` 对所供应的 10001 字符 textarea 内容只返回 10000 个可见字符；不能将其假定为无损 DOM 字符串。最终用提交前后**实际可见草稿完全相同**、存在校验错误、磁盘不变作为断言。另两次键盘计数/截断探针分别观察到 60 和 122，与初始假设不符；没有伪称浏览器逐键 `maxLength` 截断通过。普通有效编辑和无效提交保护分别已有独立实证。

## 4. T5 双真实客户端补验详情

使用同一隔离 Web Host 的两个 Chrome 窗口。即使浏览器主进程 PID 相同，它们仍是两个独立加载的页面，具有不同窗口句柄和独立表单状态；证据显示其同时持有不同草稿和 revision。

1. **A、B 均加载同一 UUID，revision 2。** [A 基线](<docs/evidence/web-supplement/a-before-conflict.json>)、[B 基线](<docs/evidence/web-supplement/b-before-conflict.json>)。
2. B 修改但暂不保存：标题 `[P0 ACCEPTANCE TEST] Web losing draft B`，愿望 `B local draft / 冲突后必须保留，不得覆盖 A`。
3. A 保存：标题 `[P0 ACCEPTANCE TEST] Web winner A`，愿望 `A committed winner / 成功写入，B 不可覆盖`；成功持久化为 **revision 3**。[A 保存界面](<docs/evidence/web-supplement/a-winner.png>)、[A 磁盘记录](<docs/evidence/web-supplement/winner-a.json>)。
4. B 仍持有 revision **2** 和自己的草稿，点击 Save。[B 提交前快照](<docs/evidence/web-supplement/b-stale-draft.json>)。
5. B 真实页面显示：**“Another page changed this product. Your draft is preserved; reload before editing again.”** 标题和愿望逐字等于提交前草稿，base revision 仍为 2。[B 冲突截图](<docs/evidence/web-supplement/b-conflict.png>)、[完整控件值](<docs/evidence/web-supplement/b-conflict.json>)。
6. B 失败后，磁盘整条产品及 SHA256 与 A 成功时相等，revision 仍为 **3**。[拒绝后磁盘](<docs/evidence/web-supplement/after-b-conflict.json>)。
7. B 主动点击 Reload 后，才显示 A 的标题、愿望及 revision **3**。[显式重读](<docs/evidence/web-supplement/b-reloaded.json>)。

这不是两个 Service 调用冒充两个 UI，也不是 mocked callback。前轮[实际 Service CAS](<docs/evidence/final-acceptance/github-load-and-service-cas.json>)仍有效，本次补足真实页面反馈和草稿保护证据。

## 5. 自动化结果、失败记录与证据完整性

| 执行 | 范围 | 退出码 | 结果 | 证据 |
|---|---|---:|---|---|
| 前轮 `pnpm run check`，2026-10-10 07:58 | build + 单元/组件/集成；本次未重跑 | **0** | **14 pass / 0 fail / 0 skip / 0 cancelled** | [原始实测日志](<docs/evidence/final-acceptance/regression-check.txt>) |
| 本次[初版校验器](<docs/evidence/web-supplement/verify-results-initial.py>) | 真实浏览器/磁盘证据复核 | **1** | **19 pass / 1 fail**；textarea UIA 长度假设错误 | [原失败结果](<docs/evidence/web-supplement/results.json>)、[原失败日志](<docs/evidence/web-supplement/verification.log>)、[原校验器](<docs/evidence/web-supplement/verify-results-initial.py>) |
| 本次[最终校验器](<docs/evidence/web-supplement/verify-results.py>) | T4 **10** 项、T5 **8** 项、安全/恢复 **2** 项 | **0** | **20 pass / 0 fail** | [最终结构化结果](<docs/evidence/web-supplement/results-final.json>)、[完整日志](<docs/evidence/web-supplement/verification-final.log>) |
| 隔离 Web 生命周期 | 官方完整 profile 启动、使用、正常关闭 | **0** | 测试端口已释放；原两个 Host 保持 | [清理核验](<docs/evidence/web-supplement/cleanup.json>) |

实际最终校验命令：

```powershell
& 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe' `
  docs/evidence/web-supplement/verify-results.py
```

最终校验器读取本次真实 UIA/磁盘记录做一致性断言，**不是另造模拟场景，也不能单独替代前面的 UI 操作**。[动作日志](<docs/evidence/web-supplement/actions.jsonl>)记录了两个目标窗口的逐次动作。

初版失败没有删掉或掩盖：调查发现 UIA 文本表示与供应字符串长度不同，随后仅重复该负面输入场景，补录了[Save 前可见值](<docs/evidence/web-supplement/a-wish-before-save.json>)及[Save 后可见值](<docs/evidence/web-supplement/a-wish-after-save.json>)。最终仍要求真实错误提示、草稿一致和不写盘，并未删除校验标准或修改产品。

另有控件模式不匹配、初始 PowerShell 字符串编码、引导页切换未就绪等测试辅助命令失败；均先观察后按真实控件继续，未盲输到其他窗口。完整说明见[探针与边界记录](<docs/evidence/web-supplement/probe-notes.json>)。

## 6. 问题、风险和未覆盖范围

| 编号 | 严重程度 / 状态 | 复现或观察 | 影响与建议 |
|---|---|---|---|
| QA-01 | 原高优先级证据缺口，**已关闭** | 原 T4/T5 缺真实页面；本次实际执行并留证 | 不再阻止 P0 正式关闭 |
| ENV-02 | 低，环境差异，**已安全解决** | 3080 Web profile 没有 Wish Willow，刷新仍无入口 | 不算插件 FAIL；采用授权隔离环境。不能直接给现有两个 Host 安装后共写同一产品文件 |
| LIMIT-01 | 中，**保留的部署边界** | JSON/Domain 无跨 Host 写锁与变更推送 | 必须单写入 Host 或分离存储 roots；本次未做危险共写试验，也未开发新锁 |
| TOOL-02 | 低，**自动化测量限制已说明** | UIA 值长度与供应字符串不完全一致；计数假设导致探针失败 | 不承诺全部辅助输入路径或逐键截断；以真实校验反馈、可见草稿前后比较、无非法落盘核验功能 |
| TRACE-01 | 低，保留 | Desktop 安装 manifest 早于仓库许可证/仓库元数据更新；运行入口已验证相同 | 不影响已测功能；不声称整个安装 manifest 同代，本次未覆盖安装 |

没有发现尚未解决、足以否决所列 P0 验收范围的产品功能缺陷。保留此前已知限制：固定 DSH rc.2、JSON 明文、无自动迁移/备份、删除、分页、离线写入、跨页面实时更新；提交成功但响应丢失时存在提交状态不确定，创建重试无持久幂等键。

**仍未覆盖但不属于本次 P0 通过承诺：** 其他 DSH 版本、macOS/Linux、其他浏览器引擎、全部移动端尺寸/读屏路径、真实断电/磁盘故障、跨 Host CAS。不能据本报告宣称这些场景全部兼容。

## 7. 数据安全、环境恢复与最终建议

补验结束时：

- 原 Desktop 产品文件 SHA256 仍为 `dbbb88bfb5c4d723f6803f63f8f942ef0b48a22dd4238c0ecec0362c9b9ecbcc`，与补验前完全相同；历史产品和前轮 Desktop 验收记录均未改动。
- Web 仅在隔离 root 新增 **1 条**明确标记的产品，最终 UUID `cbfe4850-a928-4b32-8af8-cb95dfe5db8c`、revision **3**，保留 A 的胜者内容。[最终数据](<docs/evidence/web-supplement/final-data.json>)。
- 中文已恢复；未更改原 3080/19387 的配置。临时 Host PID 29872 正常关闭、退出码 0、3081 不再监听；原 Host PID 8860/29280 仍监听原端口。测试窗口可保留为断开连接状态，不再有写入服务器。
- 未重装现有插件、未改产品/DSH 核心/已有测试、未放宽认证、未 push 或发 Release。既有跟踪文件的 `git diff --exit-code` 为 **0**；新增仅为验收报告与证据，隔离运行数据位于忽略目录。
- 没有读取或记录用户已有 Token/密码/凭据文件。新测试实例的官方认证 URL 只作浏览器启动交接，不写入日志；截图遮蔽浏览器工具栏。

| 最终问题 | 回答 |
|---|---|
| P0 核心功能是否通过？ | **通过。T1–T6 均有对应范围的实测证据。** |
| Web/Desktop 双端兼容证据是否充分？ | **对本报告版本、Windows 与最小编辑器范围充分。** Desktop 原生和 Chrome Web 分别实测，不是由共享代码推断 |
| 是否有阻止后续 P1 的已知技术问题？ | 未发现 P0 核心加载/数据完整性方面的未解决阻断；单 Host 等边界必须继续遵守 |
| 是否可以正式关闭 P0？ | **建议正式关闭 P0；无需再以 T4/T5 未验证作为结项条件。** |
| 是否开始 P1？ | **不开始。** 验收通过不等于获得下一阶段开发授权，等待用户决定 |

**验收与补验到此结束。最终建议：P0 通过，可正式关闭；不自动修复或开发新功能，不进入 P1。**
