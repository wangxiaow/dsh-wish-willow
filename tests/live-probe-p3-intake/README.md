# P3 Task 03：入口验收专用硬限制与本地证据

本轮仅处理工程自动执行及创造模式根 Agent 能力两个阻断。没有真实模型、官方 Host 启动、安装、打包、安装脚本、ACL/安全标签修改或 P2-C 重跑。本目录不是新的 P3 规划，也不属于默认产品入口。

## 1. 实际限制与启用条件

[guard.mjs](<tests/live-probe-p3-intake/guard.mjs>) 是独立的验收插件。默认 [Bundle patch](<cordis.patch.yml>)和[组合根](<src/host.js>)均不加载它；必须另行显式传入 [验收 overlay](<tests/live-probe-p3-intake/acceptance.patch.yml>)，且 `authorize` 必须精确为 `p3-task03-entry-only`。

- 工程配置必须为 `maxSteps: 0`。已修正[夹具](<tests/helpers/unified-runtime.mjs>)过去因 truthy 判断而丢弃 `0` 的问题，生产配置解析没有改变。
- **0 步不是零个 Session**：生产 Orchestrator 仍可保存运行记录、创建空工程目录并尝试构造 Agent。单独使用 0 步时，本地证明模型体、规划/编码/验证/交付工具均没有运行；它不单独限制根 Agent 或直接工具执行。
- 验收插件在官方、串行、awaited 的 `agent/created` 边界拒绝工程、Reviewer、Replay、被其他 Agent 拥有的子级及非预期工作区/preset 的实例。工厂必须按官方约定在监听器完成后才释放输入；拒绝会导致创建回滚。本地使用真实 AgentRegistry 的 enter/announce/detach 验证该边界，执行驱动器仍明确为脚本化夹具。
- 仅精确存活、属于批准工作区且 `agentPreset === 'cordis'` 的根 Agent 可使用原始 `wish_willow_context`、`wish_willow_submit`。不是只检查工具名：同名 scoped 替换也因定义身份不同被拒绝。
- 官方 `tools.restrict` 过滤继承工具；它不隐藏 Agent 自身注册的 scoped 工具。另用 `system-prompt/assemble` 收窄模型工具呈现，**同步单调 `tools.guard` 则拒绝所有其他直接调用**。因此即便工具仍可由 `tools.get` 查到、晚注册、处在 PTC 运输层，或 pre-execute 返回 allow，也不能触达执行体。
- 文件读取/搜索也不放行，以避免从模型工具访问私人数据。写入、Shell、网络、委派、插件管理、权限扩大、依赖路径、目标自动续跑及工程工具都不放行。
- 每个验收根 Agent 存活生命周期最多接受 12 个步骤；第 13 步起拒绝。重开后的新生命周期重新计数，因此这不是整个验收的 Token/金额硬上限。overlay 禁用标题模型和 llm-retry；真实 Provider 自己的重试/计费仍需另行确认。
- 根 Agent 自身持有 guard 和 pre-step effect；验收插件卸载时闭锁，旧根也不能恢复权限。关闭这些测试 Session 并停止测试 Host 后再结束验收；不要在生产 Profile 热插拔它。

原生 submit 仍返回真实的 `persisted / dispatch / changeStatus`。`dispatch=requested` 表示 Orchestrator 接受了请求，之后可因验收门禁而失败；不是工程模型已调用或软件已完成的证据。必须再读 context/正式状态，解释工程执行被验收限制拒绝。未改写历史、状态枚举或审计含义，也没有替换业务工具、mock dispatcher 或手工制造 Release。

## 2. 官方接口依据

本轮实际调用 Host Inspect，核对 `tools`、`agents` Service 及 `agent/created`、`agent/pre-step`、`system-prompt/assemble` Event。

使用的是：`tools.get/restrict/guard`、`agents.get/list/roots`、Agent 的 scoped `ctx`、上述三个 Event。测试另外使用官方 `createScope`、`scopeTarget`、AgentRegistry `enter/announce`、真实 Session、ToolRuntime、SystemPrompt、JSON Domain/RPC；没有复制通用沙箱或模型循环。

## 3. 已执行证据

执行环境：Node **v24.21.0**；DSH/Cordis 依赖为工作区已有的锁定安装，不是新安装的 Host。

最终命令（`$Node` 为本轮实际使用的 bundled Node；均已执行）：

```powershell
$Node = 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $Node --check tests/live-probe-p3-intake/guard.mjs
& $Node --test --test-isolation=none tests/integration/p3-intake-acceptance.test.mjs tests/integration/p3-native-intake.test.mjs tests/integration/p3-decision-recovery.test.mjs tests/unified-bundle.test.mjs
& $Node scripts/check.mjs
git diff --check
```

结果：**32/32 PASS，0 fail，0 skipped**。组成分别为本次限制 **10**、Task 02 原生接入 **11**、Task 01 恢复 **6**、Bundle **5**；不把这些夹具结果算成真实 Host 验收。guard syntax、现有 check 脚本、whitespace 检查均成功，组合命令正常 exit 0。

本次 10 项限制测试的实际断言：

1. maxSteps 0 实际传入；脚本化工程模型体调用 0，工具结果/assistant 事件 0，工程目录为空。
2. 可见 scoped 禁止工具逐个直接调用失败，错误为验收 guard 拒绝；隐藏 global、晚注册工具、PTC、force-allow 也失败。陷阱执行体计数 0。
3. 同名替换、伪造实例、agentless 调用、工程/Reviewer/Replay/owned child 发布全部拒绝。
4. 愿望及 `submit-native-wish` 审计真实写入 JSON；原生项目确认走 Host 问答；工程创建因 guard 失败，模型体/验证/Reviewer 计数均 0。重开读回同一关联，同一来源重放不增加创建/派发。
5. 提交前取消无新增项目/工程；卸载门禁后旧根的 write/submit 仍失败，pre-step 拒绝。
6. 第 1–12 步可进入，第 13/14 步实际被拒绝。
7. 用户原生选择“暂不提交”，原项目文件字节不变，工程创建尝试 0。
8. 错误授权、越界路径、非零工程预算、已有活跃 Agent 阻止插件启用。
9. 未加载验收插件时，正常 Creator 工具可执行；默认预算仍为 60，正常脚本化规划仍派发并到达原重大决策暂停。
10. 使用 dummy 环境测试既有 `isolatedEnvironment`，模型/云 Key、代理、NODE_OPTIONS/NODE_PATH 不被继承，Home/AppData/临时路径指向测试目录；未读取真实凭据。

开发中首轮失败源于夹具的 scope owner 未声明 tools inject，已按官方 scoped 依赖约定修正；另一失败与下节的严格 schema 投影限制有关。之后定向组合曾为 31/31；补入有限根步骤断言后的**最终**组合为上面的 32/32。没有无限修复/重试，未修改 DSH 来消除错误。

本轮只修改夹具并新增验收代码/测试/配置/说明。只读复核以下八文件的 SHA-256 与本任务第一阶段相同：组合根、原生 intake、P1 Host/Orchestrator/State、原有 Task 02 测试、package manifest、默认 Bundle patch；生产源码和正常配置未因本轮变化。

## 4. 已复现的额外限制（未擅自修复）

严格官方 `tools.schemas()` 查询报：

```text
tool "wish_willow_context" parameters must be lossless JSON before schema projection
```

最小只读诊断确认：现有 Zod `toJSONSchema` 的对象含非 JSON 元信息 `~standard`，`Reflect.ownKeys` 能见到它，官方 `snapshotJsonValue` 返回 undefined。正常 `systemPrompt.assemble()` 和本次直接工具执行夹具可用；严格 detached schema 投影失败。可见 scoped 工具的硬拒绝证据使用同一官方 `tools.get` 确认其确实可见，并直接执行得到 guard 错误，不是删除拒绝断言或只靠隐藏。

该诊断没有触发生产 schema/API 改动。真实 Agent 请求头/模型路由与 Inspect 工具目录是否受影响尚未验证，必须在真正验收前明确处理边界；不能从本地 32/32 推断真实 Host 已就绪。

## 5. 将来真实验收的必要配置和授权边界

本轮只写 overlay 模板，没有通过官方 Loader 启动验证它。

未来仍须单独批准：当前源码新归档/hash、全新 `wish-willow-p3-intake-<UUID>` owned Home、隔离 Profile 安装、官方 Web Host 启动及模型/provider/费用预算。现有 `createAcceptanceHome` 可为全新目录创建 marker；本轮没有创建任何真实验收 Home，也不能复用 P1/P2 环境。

- 从该 Home 内新建的独立 conversation 目录启动官方 CLI；选择这个目录和官方创造模式 `cordis`，不在本仓库根/私人目录开模型会话。
- 仅使用既有 `isolatedEnvironment` 的允许列表建立新进程环境；不复制私人 Home/Profile/凭据。调用目录与新 Home 不带旧 `.env`、AGENTS 或附件。在 conversation 内设置独立项目根标记，防止官方 agent-instructions 向祖先搜集指令；所需文件创建属于另行批准的可信准备。
- 确认有效 storage root 为测试 Home/storages、Session root 为测试 Home/sessions、Wish Willow workspaceRoot 为测试 Home/wish-willow；只有一个写入 Host。禁止外部/home 级覆盖把这些路径改回私人位置。
- 官方 Web 使用独立空闲 loopback 端口、`--no-open`，不得替换现有 19387 GUI。任何测试日志中的认证 URL/token 不能作为公开证据输出。
- overlay 只在这个测试进程显式启用；确认实际标题模型与自动重试已禁用。需要 Host 检查 guard entry **确实 active**，且新根的实际工具呈现/直接拒绝有效。官方 Loader 对 optional 插件失败可能继续启动：**没有确认 guard 激活就不得输入愿望或调用模型**，失败应停 Host，不修 ACL、不重新启用模型或继续验收。
- 凭据只由用户另行明确配置到全新测试环境；没有价格、Provider 重试、输出 Token/请求/金额限制的确认，不运行模型。标题禁用/12 步不是硬费用封顶。
- `tools.guard` 只约束模型经官方工具流水线拥有的能力。可信 Host 及已安装插件不受它隔离；路径预检不是抗任意可信代码、竞争换链或内核级读/网络隔离的平台。未来若可信启动层仍读取/暴露私人环境或要求 ACL/安全标签变更，就停止并报告 BLOCKED，不绕过保护。

**当前签收：本地工程/根工具限制 PASS；真实 Host 未执行。整体 PARTIAL，原因是严格 schema 投影兼容性与真实隔离启动配置仍需确认。本轮到此停止。**

## 6. 后续 Schema 兼容性排查签收

前述第 4 节及 PARTIAL 为上一轮的历史判断，保留不覆盖。用户随后单独授权处理 Schema 兼容性；详见[本项准确证据与最小修复](<G:/dsh/Wish-Willow/docs/NATIVE-TOOL-SCHEMA-COMPATIBILITY.md>)。

现已确认：非枚举的 Zod `~standard` 协议使公开 `tools.schemas` 严格投影失败；官方 native `systemPrompt.assemble` 的 structuredClone 会排除它，因此原生注册/直接调用及正常组装请求头并非必然失败。仅在 Wish Willow 两个原生工具注册边界明确排除该根协议描述符，保留所有 JSON Schema 约束与原执行校验。没有放宽 SDK JSON 检查、guard 或权限。

本项新增 Schema 回归 6 项，连同本目录既有 10 项限制和必要回归，最终 **38/38 PASS，0 skipped**；现有检查脚本及 whitespace 检查通过。guard、overlay、本目录原有限制测试的 SHA-256 均未改变。

**本项 Schema 兼容性准入问题 PASS / 已消除；真实 Host 和模型仍未执行、未签收。安装、打包、隔离 Host 与模型费用均仍需单独授权。没有自动开始下一步。**
