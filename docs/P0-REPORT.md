# P0 交付与验收报告

**结论：P0 实现和可运行 Bundle 已交付；自动化及当前运行时加载/持久化验证通过。完整 Web/原生 Desktop E2E、完整应用重启及远程 GitHub 安装仍未验证，不能宣布双端全部验收通过。停止在 P0，等待用户验收。**

## 1. 完成范围

- 独立 Git 仓库及 npm Bundle，一条 `wish-willow-p0` 行，未改 DSH 核心。
- 独立 Product State：UUID、产品名称、愿望、手动状态、schemaVersion、revision、创建/更新时间。不以 Session 当产品存储。
- 设置页查看、新建、修改、保存、显式重新读取；中英字典、主题 token、冲突保留草稿和组件卸载取消。
- 复用 DSH Storage Domain/JSON 原子发布、Cordis 资源生命周期、Connection/Typert RPC。
- 安装/使用说明、锁定依赖、自动化测试、源码依据、双端记录与手工验收流程。
- P1–P3 均未实现；没有主 Agent、任务规划/看板、软件预览交付、Reviewer/门禁或跨模型恢复。

## 2. 代码与产物

- 版本 / Build ID：`0.1.0-p0.1`；Host 源码 SHA256 `66480847ECDCDD17EBEAE9C0C6CC41E5E3C61C934F0C2889582029F3FB4A0622`。
- 源码：仓库根目录；核心入口 `src/host.js`、`src/model.js`、`client.js`、`cordis.patch.yml`。
- 可安装 Bundle：`artifacts/dsh-wish-willow-0.1.0-p0.1.tgz`。
- 完整源码快照：`artifacts/wish-willow-p0-source.zip`，含开发规范、阶段契约、锁文件、测试和文档，不含 DSH 源码、node_modules 或研究目录。
- 包含完整交付文件的最终包另有产物结构/指纹检查；对当前 runtime 已加载的 Host/model/Client 代码逐项 SHA256 相同。pnpm pack 会重新序列化 manifest，比较的是解析后 manifest 语义，不把格式差异说成代码差异。
- Git commit 与最终压缩包 SHA256 在最终工具输出/产物指纹记录中提供，不在本文嵌入自引用哈希。没有 remote、公开 Release、推送或公网部署。

## 3. 验证证据

### 自动化（通过）

1. 官方安装包依赖只读副本上的 `node scripts/check.mjs` 和全部测试通过。
2. 在全新目录用官方 npm 包独立执行 `pnpm install --ignore-scripts`，exit=0，539 个开发/测试与其传递依赖；没有依赖研究目录。随后 `pnpm run check`：**14/14 通过，0 失败、0 跳过**。
3. `pnpm install --frozen-lockfile --ignore-scripts` 再次成功（exit=0）。锁文件提交用于复现；生产 Bundle 自身只新增 Zod，DSH peers 由宿主解决。
4. 测试覆盖：输入与坏记录、引用隔离、CAS、模拟持久失败不改内存、真实 JSON 写盘、真实 Gateway/Connection envelope、未认证/错误 Origin 拒绝、fiber 卸载恢复、独立新进程恢复、React SSR/交互/冲突及卸载取消。
5. 独立进程测试是实际加载 DSH 包的两个 Node 进程，不是完整 DSH 桌面重启。写失败用受控失败模拟，不冒充真实磁盘故障/断电试验。

原始最终输出：`docs/evidence/clean-check.txt`。开头 PowerShell 将 pnpm 正常 stderr 命令回显标记为 NativeCommandError；进程 exit=0，末尾 tests=14/pass=14/fail=0。没有删掉失败断言或以跳过掩盖失败；首次失败及修复见 CHANGELOG。

### 当前真实 DSH（通过的部分）

- 官方 `plugin_manager.install_bundle` 对安装候选包返回 applied、exit=0；Host `include:wish-willow-p0` 实际 active。
- 实际 Client `settings.section` Slot 中出现 order=30/active=true 的 Wish Willow；停用后消失、重新启用后恢复。
- 临时独立 probe 在 Desktop Host PID=31800 调用正式 Service 创建及更新一条明确标记为测试的产品；真实文件在 DSH_HOME/storages 中生成。关闭并重新打开 Domain 后 ID、revision=2、内容和时间戳完全一致；文件 SHA256 保持不变。
- probe 已用官方管理器移除；测试产品保留，不执行未授权数据删除。可在 UI 将其标为 archived。
- 原 URL `http://127.0.0.1:19387` 的未认证 RPC POST 实际返回 401，没有读凭据或放宽安全门禁。
- 前后 app.asar SHA256 相同，DSH 核心未修改。

实际结果摘录：`docs/evidence/runtime.json`；完整测试产品结果：`live-created.json` / `live-reloaded.json`。

### 保留的错误/警告

- 初次导入因 Domain 名横杠不符合真实规则而失败，修复后通过；首次测试 Fiber.phase 假设也被源码和失败纠正。
- 临时 probe 尚启用时停用主体，管理器返回 failed，原因是依赖 probe pending。核实主体选择已关闭、Slot 已释放、数据未变，再先停依赖并按依赖顺序恢复，两者返回 applied；最后移除 probe。此错误未被隐藏。
- 安装有 node-domexception 弃用与 peer 警告。`pnpm peers check` exit=1，只点名既有 dsh-codex-connect / dsh-delivery-assured，没有点名 Wish Willow；不修改其他插件或授予版本豁免。

### 未验证

独立已认证浏览器的表单 E2E、原生 Desktop 窗口/IPC/视觉及键盘体验、完整 DSH 应用退出重启、macOS/Linux、真实 GitHub 下载及安装。详见 COMPATIBILITY，不把 Slot 注册或共用代码等同于双端全通过。

## 4. 限制与风险

- 固定开发预览版本；SRC Remote 是官方开发回退，并非严格生成式契约。
- 单写入 Host：JSON 后端无跨进程写锁，revision 不保护两个独立 Host。双端可共连一个 Host，不能共写同一 root。
- 没有自动迁移/备份、删除、分页、跨页面推送或离线写入；错误数据失败关闭，数据明文保存。
- 网络中断发生在提交之后时，UI 可能显示失败但记录已保存；重新读取可确认。创建重试没有持久幂等键，可能产生重复测试/产品记录，不能宣称 P3 级恢复。
- 原生/浏览器完整重启等余项需用户实际操作验收，当前会话没有被强制中断。

## 5. 需要用户决定的事项

当前无额外安全/费用/核心修改请求。请先完成兼容性文档中的待验收项，决定是否接受 P0 的明确限制。公开 GitHub 发布或进入 P1 均需另行授权；本次未做。

## 6. 下一阶段建议（仅建议）

先补齐完整重启和原生/Web 表单验收，再批准 P1。P1 应围绕独立 Product State 与 DSH 主 Agent 的稳定 ID 关联，完成最小实际软件交付闭环，而不是提前引入 Reviewer 或跨模型复杂编排。
