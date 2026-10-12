# 经核实的 DSH 接口依据

验证日期：2026-10-09 至 2026-10-10，本机官方 Desktop 安装 `0.2.0-rc.2`，Cordis `4.0.4`，Node `24.21.0`。P1 章节为 2026-10-10 追加。

官方仓库身份来自安装包 manifest：<https://github.com/deepseek-ai/deepseek-harness>。GitHub 与 raw 内容抓取均被 web_fetch 的非公网 DNS 检查拒绝，没有绕过；实际阅读的是同版本官方随附 README、开发模板与已发布实现源码，而非远程 master。安装包没有可用 Git commit，固定 npm 版本及归档 SHA256：

```text
app.asar SHA256
983CA71114E6DFD353FC79AF5A1F9481A250EE64C2A3C757673029B811B23BC2
```

ASAR 的 `dsh/` 只读提取于被 Git 忽略的 `.research/installed/dsh/`。不修改、不重新分发 DSH 核心。以下原始路径均相对于其中的 `node_modules/@deepseek-ai/`；原始发行物也可在官方同名 npm 包中核对。

## P0（已验收）

| 结论 | 实际读取依据 |
|---|---|
| Bundle 是 manifest.dsh.bundle.patch 指向的 YAML；insert 加唯一插件行 | `dsh-agent-preset/skills/cordis-plugin-development/references/host-plugin.md:3–27` |
| Host export apply/inject，所有注册需 effect 生命周期 | 同文 `49–60`；`cordis/lib/index.js:1594–1640` |
| Client 平台声明仍是 web；lazy factory ID 必须等于 package name | `dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/{package.json,client.js}`；`dsh-client-modules/README.zh.md:28–50` |
| Desktop 可以由 shell carrier 获取同一 bundle | `dsh-client-modules/README.zh.md:12,74–80`；不因此宣称原生完整验收通过 |
| 根级设置页是 additive list，唯一 id 不替换 shipped UI | 运行时 Client `Slots.listSubTree(root=settings.section)`，存在且 owner props.close；`Service.listService(service=slots)` 核实 inject/register 生命周期 |
| Theme/locale 可复用 | 运行时 `Theme.listTokens` 与 `Service.listService(service=locale)`；Client 只用返回的 token 名称 |
| 产品领域独立于 Session，持久写/close | 运行时 Host `Service.listService(service=storageDomain)`；`dsh-storage-domain/README.zh.md:12,49–89` |
| Domain 名称不接受横杠，写入不自动 parse | `dsh-storage/lib/index.js` UNIT_NAME_RE；`dsh-storage-domain/lib/index.js:61–75,257–285,365–383`；首轮导入失败促使 domain 改为 wish_willow |
| JSON 原子发布、单元格式、无跨进程写锁 | `dsh-storage-json/lib/index.js:25–51`；`README.zh.md:76–88,141–143` |
| base 默认 root=$DSH_HOME/storages | `dsh-base/cordis.patch.yml:165–176`；运行时 `Config.listConfigs(entry=include:storage-json)` 核实 root schema（未将表达式当实际路径） |
| Bundle 安装/启停接口和风险 | 运行时 Host `Service.listService(service=pluginManager)`、`plugin_manager.list_bundles`；`dsh-plugin-manager/README.zh.md:31–69,92–94,125–150` |
| 本地路径/git/压缩包可安装；安装不等于激活 | 同 README:46–48,94,134–148；安装必须通过 plugin_manager，不手改 profile |
| RPC 不重造 transport | 运行时 Host `Service.listService(service=connection)`、`service=typertGateway`；`dsh-api-gateway/README.zh.md:27–34,54–56` |
| SRC 可暴露简单参数方法，业务校验由插件承担 | `dsh-api-gateway/lib/index.js:998–1074`；`README.zh.md:29,83–85`；`dsh-typert-protocol/lib/index.js:146–194,239–267` 的公开 Remote 与绑定实现 |
| Client Connection carrier 能共用 Web/原生 transport | `dsh-client-connection/lib/client.js:1209–1231,1365–1369,1423,1477–1490`；公开 README:28–32 |

## P1（真实 Agent 接入）

先 `cordis_inspect_list` 再按需 `cordis_inspect_query`；下表的「运行时」指对当前 0.2.0-rc.2 Host 的 Inspect 精确契约，源码行号指向 `.research/installed/dsh/node_modules/` 下同版本官方实现。

| 结论 | 依据 |
|---|---|
| 创建真实 Agent：`ctx.agents.create(CreateAgentOptions): Promise<AgentHandle>`；唯一必填 `sessionId`；`meta.cwd` 为绝对、不可变工作区边界 | 运行时 `Service.listService(service=agents)`；`dsh-agent/lib/index.js:451–468`；`dsh-agent-loop/lib/index.js:1851–1891` |
| `setup(agentCtx, agent)` 在发布/公告前 await，失败回滚；`signal` 只取消创建 | 同上类型 `CreateAgentOptions`/`AgentSetup`；`dsh-agent/lib/index.js:1851–1891` |
| 驱动接口是 `followup`/`steer`/`inject`/`whenIdle`/`cancel`，**不存在 agents.submit** | `dsh-agent/lib/types/runtime-types.d.ts:138–209`（经 `agentPresets` 同版本 d.ts 核实）；`dsh-agent/README.zh.md:48–59` |
| 消息需 `createUserMessage({content,source})`，自动补 ID/role 并冻结 | `dsh-llm/lib/index.js:29–64` |
| `whenIdle()` 只代表停稳，不代表成功；必须读 `turn/end.reason` | `dsh-agent-loop/lib/index.js:870–899,1008–1030`；`dsh-agent/README.zh.md:61–67` |
| 默认模型：`ctx.agentDefaultModel.currentSelection()` 返回 `{provider,model,reasoningEffort?}`，不读凭据 | 运行时 `Service.listService(service=agentDefaultModel)`；`dsh-agent-default-model/lib/index.js:38–44` |
| 默认 preset：`agentPresets.resolve()` + `mount(agentCtx,id)`；工厂不会自动 mount，`parentAgent` 只表示运行时所有权 | 运行时 `Service.listService(service=agentPresets)`；`dsh-agent-preset-registry/lib/index.js:693–725`；`README.zh.md:42–58` |
| 每 Agent 私有能力注册在 `agentCtx` 上：`systemPrompt.section`、`tools.register/guard/restrict`、`on(...)` | 运行时 `Service.listService(service=systemPrompt)`、`service=tools`；`dsh-system-prompt/lib/index.js:233–250`；`dsh-tools/lib/index.js:2872–2925` |
| `SECTION_ORDERS.DEPLOYMENT_PERSONA_SUFFIX = 10200`，可作为追加段顺序 | `dsh-system-prompt/lib/index.js:10–42,227` |
| 工具定义必须带 `output.schema` + `render`，`execute` 返回 canonical JSON；工具可嵌套调用 `tools.execute`（嵌套调用保留各自策略） | 运行时 `Service.listService(service=tools)` 的 `ToolDefinition`；`dsh-tools/lib/index.js:892,944,953`（嵌套工具与审批等待） |
| 沙箱写入路径：`setSandboxMode(session, mode)`；`ctx.sandboxPolicy.resolve({session})` 给出有效 mode 与 workspace 根 | 运行时 `Service.listService(service=sandboxPolicy)`；`dsh-sandbox-policy/lib/index.js:25–42,141–156` |
| 审批写入路径：`setApprovalPolicy(session,'ask'\|'never')`；`never` 表示需要审批的操作自动拒绝 | 运行时 `Service.listService(service=approval)`；`dsh-user-approval/lib/index.js:36–66`；`NEVER_SENTENCE` 见 `:39` |
| 真实证据：scoped `session/event`（post-commit）与 `tools/result`（冻结最终结果，按 `exec.agent/callId` 关联）；成功 `result.value` 不持久写入普通 `tool/result` | 运行时 `Event.listEvents(event=session/event)`、`event=tools/result`；`dsh-tools/lib/index.js:3408–3426` |
| 持久化确认：`await ctx.sessions.flush(session)` 是唯一 flush 入口 | 运行时 `Service.listService(service=sessions)`；`dsh-session/lib/index.js:1819–1848` |
| 会话读取：`ctx.sessionQuery.readSession(id)`（不激活 Agent）；`session.eventAt/snapshotEvents/ownEvents` 已弃用且禁止新调用 | 运行时 `Service.listService(service=sessionQuery)`；`dsh-session/lib/index.js:1356–1389` |
| pwsh 工具返回结构化前台结果（`exitCode`/`aborted`/`timedOut`/`sandbox.denied`），可区分真实失败 | `dsh-tool-pwsh/lib/index.js:270–291,495–552` |
| 安装新 Bundle 可实时生效：安装后 Client `settings.section` 立即出现 `wish-willow-p1`（order 31、active） | 运行时安装回执 `application: applied`，随后 `Slots.listSubTree(root=settings.section)` occupants 实测包含新行；**未重启 Host** |

## 检查局限

- Client `connection` 由 ctx.provide 提供，Inspect Service catalog 未收录；精准查询返回 provider-error（未猜测接口）。其实际签名由官方实现核实，使用 `rpc.call(channel, endpoint, payload, signal)`，结果 `{ok,value}` 或 `{ok:false,error}`。
- Host `Service.listService` 的目录不索引 `TypertRemoteService` 实例（P0 的 `wishWillow` 同样不在目录中）。因此**不能**用「目录中没有 wishWillowP1」推断插件未激活；激活证据用安装回执、Client Slot 与真实服务调用结果。
- 没有使用任何未查询的 Event，也没有将 Inspect Provider 的方法误当业务 Service 调用。
- 默认 JSON 后端的单 Host 限制不能用 revision CAS 或原子 rename 隐藏。
- 未运行 DSH 源码 watcher；不会承诺改源文件后当前 GUI 自动更新。外部 Bundle 更新须重装/重启并刷新原 URL，不能新起 Vite 替代当前 GUI。
- 未使用 `session.eventAt/snapshotEvents/ownEvents` 等已弃用同步读取；P1 只使用 scoped `session/event` 与 `sessionQuery.readSession`。

自动化与实际管理器运行结果分别见验收报告，源码依据不替代实际平台验收。

## P1 统一 Bundle（2026-10-10 追加）

先 `cordis_inspect_list` 再按需 `cordis_inspect_query`；源码行号指向同版本官方实现。

| 结论 | 依据 |
|---|---|
| `dsh.bundle.patch` 可以是字符串**或文件数组**；每层 patch 的 `insert` 可插入**多行**；行的 `name` 允许**子路径** | `.research/installed/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:489–509`（`bundlePatchFiles`/`bundlePatchPaths`）；官方自带子路径行 `@deepseek-ai/dsh-tool-subagent-control/list-agents`、`@deepseek-ai/dsh-plugin-manager/tools` |
| 一个包只能提供**一个** Client 模块：client 资源按 Loader row 扫描，client 文件由包 `exports["./client"]` 定位，资源 id 为 row id，模块 id 必须等于 package name | `dsh-client-modules/lib/index.js:104–105`（Node 半边扫描 row）、`:700–720`（`resolveMeta` → `clientExportOf(packageName, pkg.exports)`）、`:204`（`/plugins/<rowId>/client.js` 组合 URL）；`dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/client.js` 的 lazy factory 约定 |
| 同一个包插入两行会导致同一 client 文件被装载两次 → 必须「一行 + 一个 Client 模块」 | 上一条 + 本次 `tests/unified-bundle.test.mjs`（组合层断言） |
| Cordis `apply` 的**返回值会被当作 effect 处理**，返回对象会报 `Invalid effect` | 运行时实测（本次首次组合根实现报错）；`@deepseek-ai/cordis/lib/index.js` 的 `safeCollect`/`Fiber._reload` |
| 组合层可离线核对：`composeEntries` 与 `loadOptionalPatches` 是官方导出 | `dsh-app-boot/lib/index.js` 导出列表；用于 `tests/unified-bundle.test.mjs` |
| 插件管理器只能管理**当前 profile**；隔离 profile 用官方 CLI `dsh plugin --profile <name> add|remove <pkg>`（内部转发 pnpm） | `dsh/lib/bin.js:115–120,234–236`；`dsh/lib/plugin-BGnVfe_D.js:63–98`（`runPlugin` → `runProfilePnpm`）；本次隔离安装实测 exit 0 |
| Bundle 内容被替换后，安装回执可能为 `application: restart-required`：Client 入口可立即更新，Host row 需重启 DSH 才生效 | 本次真实 Desktop 实测：入口 `settings.section` 立即变为单个 `wish-willow`，但 `plugin_list` 中旧 row `include:wish-willow-p0` 仍 `fiberPhase=active`，面板 RPC 在重启前失败 |
| 默认模型：base 默认 `provider: deepseek-official` / `model: deepseek-flash`，显示名为 **DeepSeek-V41-Flash** | `dsh-base/cordis.patch.yml` 的 `agent-default-model`；`dsh-llm-deepseek/lib/index.js:43–51`（`deepseek-flash` → `DeepSeek-V41-Flash`） |
| Windows 沙箱 `grantWrite` 需要工作目录对当前用户具备 **WRITE_OWNER**（强制完整性标签位于 SACL）；继承 ACE 只有 `Modify` 的目录会以 `ACCESS_DENIED` 失败 | `dsh-sandbox-windows-acl/lib/index.js:583–611` 注释与实现；本次实测报错 `SetNamedSecurityInfoW failed (Win32 5): grantWrite(<workspace>)`；迁移到用户 profile 下（FullControl 继承）后通过 |
| P0/P1 的 Domain、Service、Slot、RPC 名称在统一 Bundle 中全部保持不变 | `tests/unified-bundle.test.mjs`、`tests/integration/unified-runtime.test.mjs` 断言；升级前后真实存储文件 SHA256 一致 |

## P2（只读契约核对，未调用模型/运行插件）

先重新列 Inspect Providers，再精确读取 Host `Service.listService` 的 agents/tools/sessions/sessionQuery 与 `Event.listEvents` 的 agent/pre-step、tools/result、session/event。当前 Inspect 返回的是接口声明，不是业务调用，不证明本工作树 SDK/沙箱/模型运行成功。实际版本/peer/生命周期仍须后续授权验证。

| 使用点 | 只读依据与边界 |
|---|---|
| fresh Agent | `agents.create` 接受独立 sessionId/meta/setup；Reviewer 不传 seed/parentSession/parentAgent。当 setup 中 ID、cwd、isSeeded/parent 不符就拒绝创建 |
| 默认 fresh Session metadata | 官方随附 [Session 实现:1697–1710](<../.research/installed/dsh/node_modules/@deepseek-ai/dsh-session/lib/index.js#L1697-L1710>) 构造 `isSeeded: meta?.isSeeded ?? false`，parentSession 只有显式 meta 才出现；读取源码，不执行 |
| 全局 mask / scoped 遮蔽 | tools Service 声明 scoped registration 会遮蔽同名 global；restrict 只接受已知非空 global allow/deny，局部工具不应作为 filter 名称猜测。代码先 allow 已核实 global read，再注册受限 scoped read |
| 通用 read 的实际 schema | `Tool.listTools({})` 返回全局 `read` 的 file_path/offset/limit。Reviewer 遮蔽它并改为材料 ID/字符分页，不能给通用路径；另有同步白名单 guard 拒绝所有非允许动作 |
| scoped 事件 | agent/pre-step 是 waterfall，以 next 返回决定；tools/result、session/event 为 emit，按 Agent 过滤。只用实际声明的监听模式，不能把 Inspect 当可调用业务 Service |
| 完成与保存 | whenIdle 不等于成功；正常 turn/end + flush + readSession 中的持久正常结束、实际 read/submit tool/result 均须验证，异常/取消仍保留 Session 和非 PASS 结论 |

实现与未验证限制见[P2 报告](<P2-DEVELOPMENT-REPORT.md>)；这些声明/源码阅读均不是语法、测试、安装或真实 Reviewer 的通过证据。
