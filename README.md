# Wish Willow · P0

基于原版 DeepSeek Harness 的独立 Bundle。P0 **只实现插件加载、独立产品状态与最小编辑器**，不是自动编程产品。没有开发 P1–P3。

## 环境与安装

目前固定 DSH **0.2.0-rc.2** / Cordis **4.0.4**，Node ≥22。需要已有 `storageDomain`、`typertGateway`、Client Connection、locale 与 Settings Slot 的 Web/桌面组合。其他版本未经验证；不要通过版本豁免强行加载。

### 推荐：DSH 插件管理页

1. 从 GitHub 下载或克隆这个仓库（本次交付没有远程仓库地址，也没有公开发布）。
2. 本地构建与打包：
   ```sh
   pnpm install --frozen-lockfile --ignore-scripts
   pnpm run check
   pnpm pack --pack-destination artifacts
   ```
   发布入口本身是普通 JavaScript，不需要 `prepare`、安装脚本、CDN 或单独服务器。`build` 命令校验现成产物，不做转译。
3. DSH 左侧 **插件 → 安装**，填入生成的压缩包的**绝对路径**，例如：
   ```text
   G:\dsh\Wish-Willow\artifacts\dsh-wish-willow-0.1.0-p0.1.tgz
   ```
4. 检查 Bundle 为启用、`wish-willow-p0` Host 行为 active。安装影响当前 profile 的所有会话，Host 代码具有宿主权限。
5. 若管理器报告 `restart-required`，保存当前工作后按 DSH 自身机制重启；不要把“已安装”当作“已加载”。打开/刷新原 DSH 页面，在 **设置 → Wish Willow · P0** 找到界面。

创造模式也可使用公开工具 `plugin_manager`：先 `list_bundles`，再 `install_bundle`，`target` 填上述压缩包绝对路径。仅在 danger-full-access 或获准调用时可安装。插件自身不增加工具或权限。

### GitHub 直接安装（发布后）

DSH 官方管理器支持 git/GitHub package spec，并在下载前执行连接检查。将仓库上传到你授权的 GitHub 地址后，在上述安装输入框填：

```text
https://github.com/<OWNER>/<REPOSITORY>.git#<COMMIT_SHA>
```

`<OWNER>`、`<REPOSITORY>`、`<COMMIT_SHA>` 都是需替换的占位符，不是本次已存在的下载链接。建议固定提交，而非浮动 main。仓库已经包含 Host/Client 可加载入口，不依赖 Git 下载时的构建脚本。**真实 GitHub 安装尚未验证**；禁止把示例当作已发布 Release。

Web CLI 的官方形式是 `dsh plugin --profile web add <package-spec>`；Desktop 推荐使用自身插件页，不让 CLI 并发修改运行中的桌面 profile。

## 使用

- 新建产品，填写名称、愿望与手动状态，点击保存。状态仅为 `draft / confirmed / archived` 标签，不触发 Agent。
- 保存成功只在 DSH 完成持久写入后显示。列表中的产品具有稳定 UUID、revision、创建及更新时间。
- 编辑后不会自动切换产品，避免丢失草稿。重新读取按钮会**显式放弃未保存修改**。
- 两个页面编辑同一 revision 时，仅首个保存成功；后一个收到冲突，保留草稿。复制重要草稿后重新读取、重新编辑。
- 停用/卸载不删除产品数据。本版没有产品删除接口。

## 数据与备份

Domain `wish_willow`，版本 1，表 `products`。产品数据独立于 Session；P0 不关联/创建/删除会话。

默认 DSH base 路由位于 `$DSH_HOME/storages/wish_willow.json`；最终路径由 DSH storage 配置决定，不是仓库目录。备份和手工修复需先停止所有写入该 root 的 Host。此文件不是加密数据库，不应输入密钥或敏感凭据。

**同一存储 root 仅允许一个写入 Host**。DSH JSON 后端没有跨进程写锁；本插件的 revision 检查只保证同一 Host 的并发页面不静默覆盖。不同时启动 Web/桌面两个 Host 共写该文件。可让浏览器连接桌面已有 Host，或使用不同 DSH_HOME。

坏 JSON、schema 或 domain 版本不匹配会拒绝加载，保留原文件，不自动清空/迁移数据。错误写入不会改变成功前的内存状态。schema 升级必须另行设计迁移。

## 开发与验证

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm test
pnpm run test:integration
pnpm run check
```

自动化测试使用真实 Cordis、DSH JSON/Storage Domain/Typert Gateway，以及 React SSR。跨进程测试依次创建两个隔离 Node Host，无模型请求或用户 profile 写入。SSR 不等同于浏览器视觉/E2E 验证。

主要说明：[架构](docs/ARCHITECTURE.md)、[接口依据](docs/API-EVIDENCE.md)、[P0 验收报告](docs/P0-REPORT.md)、[双端记录与手工验收](docs/COMPATIBILITY.md)。详细的实际运行结果以报告为准。

## 尚未实现

主 Agent、规划/看板、软件预览与交付、Reviewer、质量门禁、跨模型接管与持续演化均未实现。P0 后等待用户验收，不自动进入 P1。
