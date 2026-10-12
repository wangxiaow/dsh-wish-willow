# 变更记录

## 未发布工作树：P2 独立 Reviewer / Host 质量门禁（代码接入，未执行验收）

- P1 成功保全后增量实现 fresh 只读 Reviewer、实际材料/哈希/读回/持久 Session 与结构化 PASS/FAIL/BLOCKED/UNVERIFIED；不继承 Coder 会话，最多 20 步/300 秒，不自动重试。
- 确定性低/中/高风险，Reviewer 只能提高下限；高风险须候选/最新报告/风险/本地交付范围绑定的用户批准。状态层私有释放许可、物理文件复核和 revision CAS，禁止普通 mutate 追加 Release。
- optional quality、报告/材料 Artifact、不可覆盖审查/批准/门禁历史、高风险候选重开继续、一次显式重审和最小统一 UI；当前状态不被旧成功掩盖。
- 新有限正反例与旧断言兼容更新、固定真实正/反候选、[开发报告](<P2-DEVELOPMENT-REPORT.md>)及[分项授权计划](<P2-EXECUTION-PLAN.md>)。
- **NOT RUN**：测试/build/pack/install/实际模型/UI 验收；没有新版本/Commit/Release。0.3.2 未公开发布，P1 的[接受例外](<P1-CLOSURE-0.3.2.md>)保持不变。下面 92/92 等全部是历史阶段证据，不是 P2 通过结果。

## 0.3.2（F1 收敛：交付门禁、独立快照与测试隔离）

- **F1-A Release 错误放行**：`wish_deliver` 的最终判定只看完整的**前台**退出 DTO（`kind==='foreground'`、`exitCode===0`，且无 `timedOut`/`aborted`/`denied`/`runnerFailed`）。环境拒绝、runner 错误、被提升为后台 job 或超时一律记为 `unverified` 并保留真实原因，但**不再进入 Built/Released**。新增 `healthCheck`（loopback URL + 期望文本）用于 HTTP 服务型交付：先确认端口未被占用，再启动、轮询 HTTP 200 与内容、并确认本次进程已停止；只把超时当成功被明确禁止。
- **F1-B 独立快照验证**：快照改为排除式收录，`.ps1`/`.sh`/`.cmd`/`.bat`/`.py` 等入口不再被丢弃；每次未通过的尝试使用独立候选目录 `deliveries/<projectId>/candidates/<candidateId>/<versionId>`，历史 Release 不被覆盖；build/test/run 与启动命令改为在**工作区之外、调用前必须不存在**的干净副本 `restores/<candidateId>` 中重放，并经专用无模型验证会话执行；修复 `rebindWorkspacePath` 在“副本位于原目录之下”时重复插入路径的问题。
- **F1-C 快照与恢复安全边界**：新增规范相对路径校验（拒绝 `..`、绝对路径、盘符、ADS、反斜杠、Windows 尾点/尾空格与设备名）、祖先与目标重解析点拒绝、manifest 在写入与读取两侧的路径/数量/字节/哈希校验、目标目录不可预先存在；凭据类文件按名称（多段 `.env.*`、`.credentials.*`、`secrets.*`，仅显式 `example|sample|template` 结尾豁免）与高置信内容双重排除，排除项写入 manifest 而非静默丢弃。
- **F1-D 测试与安装验证隔离**：测试 fixture 改为操作系统临时目录下带所有权标记的新目录且**默认不删除**；拒绝真实 DSH Home（按官方 `DSH_HOME > ~/.dsh` 解析）、用户主目录、AppData、磁盘根、仓库根、前缀兄弟路径以及任何符号链接/junction 重定向；脚本化 Agent 的 shell **默认关闭**，只有测试显式构造受限 fixture runner 才真实执行命令（该 runner 明确**不是**操作系统沙箱）；隔离安装探针不再复制真实凭据并要求显式 `--authorize-isolated-profile-change`，隔离 Host 探针要求显式授权并在启动前核对真实 Home。
- **依赖来源限定**：当前只验证无第三方依赖的 Node/PowerShell 交付——快照声明依赖、受控隔离根内出现 `node_modules`、或 Node 按用户全局目录（`~/.node_modules`、`~/.node_libraries`）存在时拒绝；隔离根之上的无关祖先目录只记录、不拒绝（已写明的限制）。
- **自动化回归**：`92 pass / 0 fail`（含 F1-A/B/C/D 反例与既有 0.3.1 的 50 项），`node scripts/check.mjs` exit 0。

## 0.3.1（统一 Bundle 验收版）

- 在 0.3.0 基础上补齐统一 Bundle 的验收证据：隔离 Web profile 与真实 Desktop profile 安装、单一入口、P0/P1 历史数据字节不变、真实 Web/Desktop UI 与真实 Agent 两轮演化、回退手册与隔离回退实测。
- 已知遗留：`packages/p1/src/artifacts.js` 的扩展名白名单会静默丢弃 `.ps1` 等非白名单入口文件（**F1**，已在 0.3.2 修复）。

## 0.3.0（统一 Bundle）

- **一个安装单元**：`dsh-wish-willow` 0.3.0 取代 P0 Bundle + P1 companion Bundle；`cordis.patch.yml` 只插入一行 `wish-willow`。
- 新增组合根 `src/host.js`：按序装载 P0 模块（`src/p0/*`）与 P1 模块（`packages/p1/src/*`），`inject` 取两者并集；`apply` 不返回值（Cordis 会把返回值当 effect）。
- 新增统一工作台 `client.js`：单个 `settings.section#wish-willow`，覆盖产品创建、愿望输入、已确认/推断需求、约束与决策、任务分组、Agent 执行记录、证据、版本与启动方式、下一轮入口，以及旧 P0 产品的编辑与 UUID 幂等导入。
- **存储零改动**：`wish_willow` v1/products 与 `wish_willow_p1` v1/projects 的名称、版本、表与 schema 全部不变；升级前后 `wish_willow.json`/`wish_willow_p1.json` 字节一致（实测）。
- 旧 companion 包 `packages/p1` 冻结保留（回退路径），与统一 Bundle 不可同时安装。
- 自动化回归从 32 项扩展到 **50 项**（新增单一安装面、组合层、升级/兼容、统一 UI/RPC、挂载交互、生命周期与跨进程）。
- 真实 Web UI 完成两轮 DeepSeek V4.1（`deepseek-official/deepseek-flash`）软件演化并独立复验；真实 Desktop profile 完成安装级升级（入口已统一，需重启后完成面板复验）。
- 发现并记录环境约束：Windows 沙箱写入授权需要工作目录 `WRITE_OWNER`；G: 盘受限目录会导致 `wish_verify` 在执行前失败（不伪造证据）。

## 0.2.0-p1.1（P1 companion Bundle，历史）

- 独立 P1 Domain `wish_willow_p1` v1/projects 的聚合产品状态；持久幂等创建、CAS 变更、恢复语义、证据门禁。
- 最小 Orchestrator：真实 DSH root Agent 顺序执行「规划 → 编码」，scoped 私有工具写入产品状态并采集真实证据。
- 不可覆盖源码快照（大小/数量上限、拒绝符号链接与凭据类文件）。
- 产品演化看板（`settings.section#wish-willow-p1` order 31）与 P0 页面并存。
- 两轮真实交付与独立复验；32 项自动化回归通过。

## 0.1.0-p0.1

- 初始化独立 Git 仓库，保留既有 AGENTS 治理规范。
- 单 Bundle 的 Host apply/inject、标准 Remote Service、官方 lazy Client factory。
- 独立 domain `wish_willow` v1；严格输入/记录校验、UUID、CAS revision 和副本返回。
- 设置页新增产品、查看/编辑/手动状态、显式重新读取、冲突保留草稿、中英字典、主题 token。
- 自动化模型/React/真实 DSH 存储/RPC/跨进程/卸载恢复测试。
- 官方管理器实际安装；真实 Desktop Host 产品 smoke；临时 probe 清理，保留明确标记的测试记录。
- 安装、使用、源码依据、兼容性与阶段报告。
- 正式 artifacts 路径替换安装 exit=0、restart-required；保留当前相同源码的活动代际，不强制重启，交由用户正常重启验收。

## 修复与未通过的首次检查

- 初次 domain 名 `wish-willow` 导入被真实 UNIT_NAME_RE 拒绝，修正为 `wish_willow`。不通过记忆假定命名规则。
- 初次测试误用了不存在的 Fiber.phase，依据实际 Cordis 源码改为 Fiber.state=2；同时为坏数据测试增加精确错误码，防止错误失败原因导致假阳性。
- 随附 Host 安装没有 React npm 包；测试单独安装真实 React/SSR/renderer 依赖，生产 Client 仍只复用平台 React。
- 首次 pack 的 `--out artifacts` 是文件路径不是目录；核对 pnpm help 后改为 `--pack-destination artifacts`。
- live disable 一次因仍选中的 probe 进入 pending 而返回 failed；报告保留失败，修正依赖停用顺序后验证主体数据未改变及重启 fiber 恢复。
- 安装 peer 警告已用 pnpm peers check 调查，只点名既有其他插件，不为消除警告修改它们或授予版本豁免。

首次 P0 交付没有开发 P1/P2/P3，也没有核心 Fork、远程推送、Release 或公网部署。

## 用户授权的仓库提交

- 提交目标：<https://github.com/wangxiaow/dsh-wish-willow>，只提交源码到 main，不创建 Release 或进入 P1。
- 许可保留 MIT，版权名改为 `wangxiaow`；同步 package 作者/仓库元信息与 GitHub 安装说明。
- 不包含 node_modules、DSH 核心副本或本地打包产物；保留原始测试记录和未验证事项。
- 提交前 pnpm run check 的自动依赖检查首次因未批准构建脚本而退出 1；未授予构建许可，按 README 显式执行 install --frozen-lockfile --ignore-scripts 后，许可/仓库元信息检查及 14 项测试全部通过。
