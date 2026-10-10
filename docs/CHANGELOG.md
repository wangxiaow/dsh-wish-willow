# 变更记录

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
