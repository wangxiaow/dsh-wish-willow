# Wish Willow P2 A1 验证报告

## 最新执行结论：路径元数据补充授权后

**A1 BLOCKED — DSH Agent Shell 启动前发生 Win32 5，Node 与全部 A1 检查均 NOT RUN。**

用户已明确允许隔离所需的最小根路径/祖先元数据读取，前次授权差异已解除。现有隔离检查保留、未放宽。本次执行尝试的阻断是实际 Shell 环境错误，不再是路径元数据授权不足。

### 1. Node 与实际执行环境

- 工具工作区及本次 `pwsh` 的显式 workdir 为 `G:\dsh\Wish-Willow`。`pwd` 没有成功启动，不能记为进程内 cwd 核验通过。
- 当前文件策略 `workspace-write`，审批策略 `ask`；没有请求扩大权限或使用 danger-full-access。
- 依赖定位工具再次返回 `C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`。**实际 Node 版本、可执行性和依赖运行可用性均 NOT VERIFIED。**
- 已知 P1 保全副本由此前只读清单/glob 确认仍存在；本次未重新计算 hash，没有修改、覆盖或清理它。P1 已接受例外不变。

### 2. 实际执行请求、错误与退出码

本次只有 **1 次 pwsh 请求**，用于只读环境预检；Shell/Node 进程未成功启动，没有后台 job。

显式 workdir：`G:\dsh\Wish-Willow`。提交的完整命令：

```powershell
$ErrorActionPreference = 'Stop'; pwd; if ($env:NODE_OPTIONS -or $env:NODE_PATH) { throw 'Node preflight stopped: NODE_OPTIONS or NODE_PATH is set; no Node process started.' }; $Node = 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'; Get-Item -LiteralPath $Node | Select-Object FullName, Length, Attributes; & $Node --version; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

工具实际返回：

```text
Error: SetNamedSecurityInfoW failed (Win32 5): grantWrite(G:\dsh\Wish-Willow)
```

**进程退出码：N/A（启动前阻断，没有 Node/Shell 退出码）。** Win32 `5` 是工具启动/权限准备错误码，不是 Node 测试退出码。`pwd`、`Get-Item`、`--version` 和环境变量检查都不能记录为已经运行。

出现错误后立即停止：未重试、未更换入口绕过、未修复 DSH/ACL/所有权、未提权。没有运行任何 A1 Node 命令。

### 3. 11 条语法检查

| 获批原始命令 | 实际退出码 | 结果 |
|---|---|---|
| `node --check packages/p1/src/quality-gate.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/reviewer.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/state.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/orchestrator.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/host.js` | N/A | NOT RUN / BLOCKED |
| `node --check client.js` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/p1-runtime.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/unified-runtime.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/p2-reviewer.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/p2-state.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check scripts/check.mjs` | N/A | NOT RUN / BLOCKED |

**总体：0/11 实际执行，语法状态 BLOCKED。** 没有运行[check 脚本](<../scripts/check.mjs>)。

### 4. 三个专项测试的实际结果

`node --test tests/p2-quality-gate.test.mjs tests/p2-reviewer.test.mjs tests/p2-client.test.mjs` **NOT RUN，退出码 N/A**。

| 文件 | 已知静态定义数 | 本次实际执行数 | 实际 PASS / FAIL |
|---|---:|---:|---|
| [状态门禁测试](<../tests/p2-quality-gate.test.mjs>) | 10 | 0 | 无运行结果 |
| [Reviewer 测试](<../tests/p2-reviewer.test.mjs>) | 8 | 0 | 无运行结果 |
| [UI 测试](<../tests/p2-client.test.mjs>) | 3 | 0 | 无运行结果 |
| 合计 | 21 | 0 | 无运行结果 |

静态定义数沿用前次 grep/源码阅读，不是本次 Node runner 的统计。Reviewer 独立性、工具拒绝、报告完整性、Host Release/审批/CAS、历史兼容及当前 UI 状态的既有覆盖见下方历史记录第 4 节；全部仍未执行。模拟 PASS 不是真实 Reviewer 验收证据。

### 5. 修改、数据访问及 fixture

- **生产代码、测试、helper、依赖：无修改。修复/复验 0/2。** 唯一变更为本报告，前次静态预检记录在下方原样保留并标为历史。
- 测试未启动，没有运行对真实 DSH Home/Profile 的 `realpath`/`lstat` 调用；依赖定位工具仅返回公开运行时位置。没有读取真实配置、凭据、Session、Storage 或产品内容，没有修改用户数据。Shell 授权准备发生错误；没有自行进行 ACL 修复或改变权限。
- **本次 fixture 创建数 0，实际新路径无。** 没有清理任何现有 fixture。未来测试只允许在已核实 OS TEMP 下创建带所有权标记的新 fixture；本次不能把该设计路径写成已经生成的证据。
- 无安装、网络、真实模型、真实 DSH Host、构建打包、Git 写入或发布；无新的 Commit/Build/Release ID。

### 6. 真正的阻断与下一步

**已证实的是执行环境阻断，不是 P2 功能缺陷。** 尚无可复现的实际 P2 测试失败，也无语法通过/失败证据；不得据此宣布代码没有缺陷。

当前不建议进入 A2。可以由用户在普通、非管理员 PowerShell 中执行下方原定 A1 范围，并回传实际完整输出/退出码；尚未回传的结果一律 NOT RUN。助手不自行尝试另一入口。仅在 A1 得到真实全通过、没有阻断后，才可提出 A2 授权；不自动进入 A2/B/C，不宣布 P2 验收。

### 7. 供用户普通 PowerShell 执行（助手未执行）

以下保持原 A1 文件顺序，用已定位的 Node 绝对路径替代 PATH 中的 `node`。预检只做版本和现有模块路径解析，不导入业务插件、不安装。每条输出实际退出码，非零立即停止；遇到失败请回传，不自行删断言或扩大执行范围。测试生成的新 fixture 全部保留，不做清理。

```powershell
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'G:\dsh\Wish-Willow'
if ((Get-Location).Path -ne 'G:\dsh\Wish-Willow') { throw 'Unexpected working directory' }
$Node = 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
Get-Item -LiteralPath $Node | Select-Object FullName, Length, Attributes
if ($env:NODE_OPTIONS -or $env:NODE_PATH) { throw 'NODE_OPTIONS/NODE_PATH is set; stop before Node execution' }
$NodeVersion = & $Node --version
$Code = $LASTEXITCODE
Write-Output "COMMAND: Node --version; EXIT: $Code; VERSION: $NodeVersion"
if ($Code -ne 0) { throw 'Node version command failed' }
if ([version]($NodeVersion -replace '^v','') -lt [version]'22.0.0') { throw 'Node >=22 required' }

# Resolve installed public dependencies only; no plugin import, model, network or install.
& $Node --input-type=module -e "for (const name of ['zod','@deepseek-ai/cordis','@deepseek-ai/dsh-storage','@deepseek-ai/dsh-storage-json','@deepseek-ai/dsh-storage-domain','@deepseek-ai/dsh-typert-registry','@deepseek-ai/dsh-typert-protocol','@deepseek-ai/dsh-api-gateway','@deepseek-ai/dsh-llm','@deepseek-ai/dsh-sandbox-policy','@deepseek-ai/dsh-user-approval','react','react-dom/server','react-test-renderer']) console.log(name, import.meta.resolve(name)); console.log('OS_TEMP', (await import('node:os')).tmpdir());"
$Code = $LASTEXITCODE
Write-Output "COMMAND: Node dependency-path preflight; EXIT: $Code"
if ($Code -ne 0) { throw 'Existing dependency resolution failed; do not install' }

$Checks = @(
  'packages/p1/src/quality-gate.js',
  'packages/p1/src/reviewer.js',
  'packages/p1/src/state.js',
  'packages/p1/src/orchestrator.js',
  'packages/p1/src/host.js',
  'client.js',
  'tests/helpers/p1-runtime.mjs',
  'tests/helpers/unified-runtime.mjs',
  'tests/helpers/p2-reviewer.mjs',
  'tests/helpers/p2-state.mjs',
  'scripts/check.mjs'
)
foreach ($File in $Checks) {
  Write-Output "COMMAND: $Node --check $File"
  & $Node --check $File
  $Code = $LASTEXITCODE
  Write-Output "EXIT: $Code"
  if ($Code -ne 0) { throw "Syntax check failed: $File" }
}
Write-Output "COMMAND: $Node --test tests/p2-quality-gate.test.mjs tests/p2-reviewer.test.mjs tests/p2-client.test.mjs"
& $Node --test tests/p2-quality-gate.test.mjs tests/p2-reviewer.test.mjs tests/p2-client.test.mjs
$Code = $LASTEXITCODE
Write-Output "EXIT: $Code"
if ($Code -ne 0) { throw 'P2 tests failed; preserve fixtures and return output' }
```

此脚本只是交接命令，不是已执行成果；Node dependency-path preflight 成功也只证明解析路径可得，不单独证明完整导入或测试通过。

**本次到此停止。以下均为补充授权前的历史预检，不代表当前授权仍不足。**

---

## 历史记录：补充元数据授权前的静态预检

## 结论与完成范围

**A1 BLOCKED — 安全前置未通过，未启动语法检查或测试。**

本轮只完成只读静态预检及本报告。用户已明确授权 A1 和最多两轮有限修复，但同时要求测试不访问真实 DSH Home/Profile，发现越界风险立即停止。实际调用链存在真实目录根路径的只读元数据访问，因此不能在不澄清该边界的情况下执行原命令。这是授权边界阻断，**不是已经运行出的测试 FAIL，也不是本轮发生了 Win32 5**。

未进入 A2/B/C；未安装、构建、打包、启动真实 DSH Host、调用模型、提交或发布。P2 未验收、未关闭；P1 已接受例外不变。

## 1. 执行前安全检查

| 前置事项 | 本轮事实 |
|---|---|
| 工作目录 | 当前运行上下文指定 `G:\dsh\Wish-Willow`；文件工具返回的实际绝对路径与之相符。尚未执行 `pwd` 进程核验，因静态安全预检已触发停止条件。 |
| P1 保全 | 已读[已接受清单](<../.p1-preservation-before-p2-98df24b943a449d7a5018619a45d159e/preservation.json>)；glob 当前找到清单及其 70 个保全文件。副本仍存在。本轮未重新计算哈希，不重述为新一次完整性验收。 |
| Node ≥22 | 依赖定位工具返回 `C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`。仅取得路径，未运行版本命令，**实际版本未确认**。公开运行时可执行文件的定位不等于读取用户 Profile/Session 数据。 |
| 现有依赖可用 | 已读[依赖声明](<../package.json>)；未安装、升级或更换依赖。尚未完成实际模块解析/导入兼容核验，**运行可用性未确认**。 |
| 真实 DSH 数据隔离 | 发现下述根目录 `realpath` 调用；不满足“不会访问真实 DSH Home/Profile”的严格边界，停止。没有执行这些调用。 |
| fixture 所有权/保留 | [temporary](<../tests/helpers/temp.mjs>) 委托[隔离 helper:109–121](<../tests/helpers/isolation.mjs#L109-L121>)：mkdtemp 新目录、`wx` 所有权标记、路径/重解析点/所有权检查；不注册删除清理。尚未运行或创建 fixture。 |
| 额外命令/网络/模型 | [Reviewer 测试:13–14](<../tests/p2-reviewer.test.mjs#L13-L14>) 显式使用只返回 DTO 的 runner；[runtime:219–225](<../tests/helpers/p1-runtime.mjs#L219-L225>) 使用脚本化 Agent、内存 Session 查询及 flush stub。不得将这些模拟机制当作真实模型/OS 沙箱证据。尚未执行，未给出完整运行安全通过结论。 |

### 已确认的阻断调用链

[Reviewer 测试:31–39](<../tests/p2-reviewer.test.mjs#L31-L39>) → [temporary](<../tests/helpers/temp.mjs>) → [createFixtureRoot:109–116](<../tests/helpers/isolation.mjs#L109-L116>) → [assertIsolatedPath:65–86](<../tests/helpers/isolation.mjs#L65-L86>)。

关键行为：

- [liveHomePaths:24–28](<../tests/helpers/isolation.mjs#L24-L28>) 从环境/OS 用户目录计算实际 `DSH_HOME`、默认 `.dsh` 和可选 `DSH_PROFILE_DIR`。
- [隔离 helper:84–85](<../tests/helpers/isolation.mjs#L84-L85>) 为防止路径重叠，对这些真实根路径调用 `canonical(home)`。
- [canonical:32–42](<../tests/helpers/isolation.mjs#L32-L42>) 调用 `realpath`；路径不存在时继续检查存在的祖先。
- 这不是读取 Profile 配置、Session/Storage 内容或凭据，但确实涉及真实目录的只读路径元数据，不能无条件记为“零访问”。该检查是现有安全保护，**没有为了运行测试删除、跳过或放宽它**。
- 此外，P2 fixture 会走 P1 完整性验证；[现有依赖来源检查:172–195](<../packages/p1/src/delivery.js#L172-L195>) 包含用户全局 Node 路径和隔离根祖先的 `lstat` 元数据检查。它们不执行交付命令、不读取凭据，但应在恢复 A1 前一并明确允许的只读元数据范围，不能改写 P1 核心规避检查。

## 2. 实际执行命令与退出码

**实际 Shell/Node 命令：0 条。实际进程退出码：无（N/A）。**

本轮使用 read/glob/grep 检查源码、保全及静态测试定义，并调用依赖定位工具；没有发起 pwsh。没有后台执行 job。本轮没有出现或重试 `SetNamedSecurityInfoW failed (Win32 5)`，历史问题不能记成新测结果。

以下是获批、但因安全前置阻断而**未执行**的原始命令，不是执行日志：

| 原始命令 | 退出码 | 状态 |
|---|---|---|
| `node --check packages/p1/src/quality-gate.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/reviewer.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/state.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/orchestrator.js` | N/A | NOT RUN / BLOCKED |
| `node --check packages/p1/src/host.js` | N/A | NOT RUN / BLOCKED |
| `node --check client.js` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/p1-runtime.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/unified-runtime.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/p2-reviewer.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check tests/helpers/p2-state.mjs` | N/A | NOT RUN / BLOCKED |
| `node --check scripts/check.mjs` | N/A | NOT RUN / BLOCKED |
| `node --test tests/p2-quality-gate.test.mjs tests/p2-reviewer.test.mjs tests/p2-client.test.mjs` | N/A | NOT RUN / BLOCKED |

没有运行[check 脚本](<../scripts/check.mjs>)；也没有执行其语法检查。语法总体状态：**BLOCKED，0/11 已运行**。

## 3. 三个 P2 文件的测试数量与结果

数量来自 grep/源码中的顶层 `test(...)` 定义，**不是 Node test runner 的执行统计**。循环里的变体没有虚增成独立测试数。

| 文件 | 静态定义数 | 实际运行数 | 实际 PASS / FAIL | 结果 |
|---|---:|---:|---|---|
| [状态门禁测试](<../tests/p2-quality-gate.test.mjs>) | 10 | 0 | 无结果 | NOT RUN / BLOCKED |
| [Reviewer 测试](<../tests/p2-reviewer.test.mjs>) | 8 | 0 | 无结果 | NOT RUN / BLOCKED |
| [UI 测试](<../tests/p2-client.test.mjs>) | 3 | 0 | 无结果 | NOT RUN / BLOCKED |
| 合计 | 21 | 0 | 无结果 | NOT RUN / BLOCKED |

## 4. 静态测试覆盖范围（均未执行）

| 范围 | 已存在的测试断言 |
|---|---|
| Reviewer 独立性 | fresh Session、无 seed/parent、候选 cwd、Coder dispose 在先、单次调用与失败不自动重试、一次显式重审不重编码。 |
| 工具限制 | 写/edit/Shell/网络/其他 Agent/审批/交付/越界 read/权限扩张共十类拒绝；材料使用 ID 白名单分页。 |
| 报告验证 | 实际材料读取、缺读/错 binding/畸形/缺报告、完整模型可见正文与截断反例、必要检查/相关引用/must-fix；创建错误、取消、步数及时间耗尽。 |
| Host 放行 | 三级风险与不得降低下限、合法 PASS 恰好一次释放、普通 mutate 旁路拒绝、高风险缺批准/拒绝/错范围/过期、CAS/幂等、物理篡改、最终复核取消。 |
| 历史兼容 | 旧状态/旧 Release 无虚构 quality、不 eager rewrite、待批准重开保留、审查中断一次终结、旧报告保留。 |
| UI | 旧成功不掩盖当前失败/版本/测试、新重审不显示旧 ALLOW、高风险操作发送准确绑定与稳定请求 ID。 |

[状态 fixture](<../tests/helpers/p2-state.mjs>) 是内存数据及模拟物理核验；[Reviewer fixture](<../tests/helpers/p2-reviewer.mjs>) 是显式脚本化报告；[runtime](<../tests/helpers/p1-runtime.mjs>) 的 JSON 数据文件仅计划落在当次新 fixture。模拟 PASS 不证明真实独立模型审查通过。未启动真实 DSH Host，不评价真实工具可见性、OS 沙箱或 Web/Desktop 验收。

## 5. 代码修改及前后结果

- 生产源码、测试、helper、依赖、DSH 核心/权限均 **未修改**。
- 修复与复验轮次：**0/2**；不存在可报告的前后测试差异。
- 唯一新增文件为本报告；未修改或清理保全副本、已有产品、Profile 或 Session。
- 没有 Commit / Build / Release ID。

不能把删除真实根目录隔离检查或改用虚假的受保护目录作为“有限修复”：那会放宽安全保护，而不是解决一个已运行、可复现的 P2 功能错误。

## 6. fixture 路径与保留

**本轮生成 fixture：0；没有新的实际 fixture 路径。**

未来设计路径是 OS 临时目录下随机 `wish-willow-test-*`（所有权标记 `.wish-willow-test-owner`），不是已生成路径。未删除、覆盖或清理任何既有 fixture。P1 保全副本保持原样。

## 7. 真实 DSH 或用户数据接触情况

测试未启动；上述真实根目录 `realpath`/环境 `lstat` 调用没有执行。没有打开真实 Profile、Sessions、Storages 或凭据，没有对真实 DSH 或用户数据做写入。依赖定位工具仅返回公开运行时安装路径；本轮未读取该运行时中的私人数据，也未执行 Node。

不能将“本轮未执行”误写为“已通过测试证明完全不会访问真实根目录”。

## 8. 实际阻断问题

唯一已经证实的 A1 阻断是：**原命令所调用的现有隔离安全 helper 会访问真实 DSH Home/Profile 根路径元数据，而当前 A1 授权禁止该访问；严格安全前置无法确认。**

这不证明 P2 Reviewer/Host 有功能缺陷；尚无任何实际语法或测试结果。Node 版本、依赖兼容及执行入口当前可用性也仍未核验，但不能预先宣称它们失败。没有修复 DSH/ACL，也没有使用 danger-full-access。

## 9. A2 建议及需要用户决定的事项

**现在不建议进入 A2。** 先明确：是否允许仅为隔离防重叠而读取真实 DSH Home/可选 Profile 根目录的规范化路径元数据，以及 P1 依赖来源检查所需的外围路径元数据；不得包含目录内容列举、配置/Session/Storage/凭据读取或任何修改。

未取得上述明确许可前，不改 helper、不重新发起 A1，也不建议用户直接执行同样存在该边界差异的测试命令。若边界获准，再按原 A1 顺序完成 Node/依赖核验、11 条语法检查及三个专项测试；只有获得实际全通过结果且没有阻断，才能给出 `A1 PASS — READY FOR A2 AUTHORIZATION`。A2 仍须另行授权。

**报告提交后停止；本报告不是 P2 验收。**
