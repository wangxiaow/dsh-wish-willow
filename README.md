# Wish Willow

基于原版 DeepSeek Harness 的**单一 Bundle**：让用户用自然语言表达软件愿望，由真实 DSH Coding Agent 完成需求整理、开发、测试与交付，并把产品状态独立于会话持久保存。

**一个安装单元 `dsh-wish-willow`（0.3.1），一个统一工作台入口。** 内部由 P0（旧产品状态）与 P1（愿望式演化闭环）两个模块组成，二者各自保留独立的 Service 与存储 Domain。P2（独立 Reviewer、质量门禁）与 P3（跨模型接管、持续演化）未实现。

- 统一 Bundle：[package.json](<package.json>)、[cordis.patch.yml](<cordis.patch.yml>)、组合根 [src/host.js](<src/host.js>)、工作台 [client.js](<client.js>)
- 内部模块：[src/p0/host.js](<src/p0/host.js>)、[packages/p1/src/host.js](<packages/p1/src/host.js>)
- 整合报告：[docs/P1-UNIFICATION-REPORT.md](<docs/P1-UNIFICATION-REPORT.md>) ｜ 验收：[docs/P1-FINAL-ACCEPTANCE.md](<docs/P1-FINAL-ACCEPTANCE.md>) ｜ 升级回退：[docs/WISH-WILLOW-UPGRADE.md](<docs/WISH-WILLOW-UPGRADE.md>)

## 环境

固定 DSH **0.2.0-rc.2** / Cordis **4.0.4**，Node ≥22。需要已有 `storageDomain`、`typertGateway`、Agent/工具/沙箱/审批、Client Connection、locale 与 Settings Slot 的 Web/桌面组合。其他版本未经验证；不要通过版本豁免强行加载。

## 安装（一次即可）

1. 本地构建与检查：
   ```sh
   pnpm install --frozen-lockfile --ignore-scripts
   pnpm run check
   ```
2. 打包（**一个** Bundle）：
   ```sh
   pnpm pack --pack-destination artifacts
   # → artifacts/dsh-wish-willow-0.3.1.tgz
   ```
3. 在 DSH「插件 → 安装」中填入**压缩包绝对路径**：
   ```text
   G:\dsh\Wish-Willow\artifacts\dsh-wish-willow-0.3.1.tgz
   ```
   创造模式也可用公开工具：先 `plugin_manager.list_bundles`，再 `plugin_manager.install_bundle`（`target` 填上述路径）。
4. 打开/刷新 DSH 页面，在 **设置 → Wish Willow** 使用（只有一个入口）。

**已有 P0/P1 双 Bundle 安装的升级**：请先移除 `dsh-wish-willow-p1`，再安装统一 Bundle，并按回执决定是否重启 DSH。完整步骤与回退见 [升级手册](<docs/WISH-WILLOW-UPGRADE.md>)。

## 使用（许愿式闭环）

1. 左侧新建产品，填写名称与愿望；愿望是唯一被标记为「用户确认」的需求。
2. 提交后主 Agent 先规划（该阶段只允许读取正式状态与保存计划），把需求、约束、决策与任务写入同一份持久产品状态。
3. Agent 提出重大决策时产品进入阻塞，需要你在看板接受或拒绝后才继续。
4. 编码阶段 Agent 在受控工作目录真实修改源码，并用 `wish_verify` 分别执行 build/test/run；Host 只接受真实前台退出码 0 的证据。
5. `wish_deliver` 只有在源码确实被修改、且 build/test/run 三类证据均成功时才允许；Host 保存不可覆盖源码快照并写入 Released 版本，版本记录含可重复启动命令。
6. 继续提交新愿望即为下一轮演化：保留已确认需求与历史版本，生成新的 ChangeSet、构建与交付版本。
7. 「旧版 P0 产品」区可直接编辑历史 P0 记录（CAS 保存），或「导入到统一产品」按 UUID 幂等并入统一状态。

失败会成为可见的任务状态；重试有 3 次上限，「状态待确认」必须先确认才能重试（避免重复副作用）。执行有步数与时间上限，不会无限重试。

## 数据与备份

- P0：Domain `wish_willow`，版本 1，表 `products`（旧数据源，可编辑/导入）。
- P1：Domain `wish_willow_p1`，版本 1，表 `projects`（一个产品一条聚合记录：需求/约束/决策/任务/运行/证据/产物/构建/版本/交付/来源历史）。
- 工作目录默认 `$DSH_HOME/wish-willow/projects/<projectId>`；交付快照在 `$DSH_HOME/wish-willow/deliveries/<projectId>/<versionId>/source`。
- 产品数据独立于 Session；通过 Session ID、运行 ID、任务 ID 与真实执行证据关联。
- **统一 Bundle 不迁移也不改写任何存储**：升级前后 `wish_willow.json` / `wish_willow_p1.json` 字节一致（实测）。
- **同一存储 root 仅允许一个写入 Host**。JSON 后端没有跨进程写锁；不要同时用 Desktop 与 Web 共写同一 root。
- 坏 JSON、schema 或 domain 版本不匹配会拒绝加载，保留原文件，不自动清空/迁移。停用或卸载不删除产品数据。

## 开发与验证

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check          # build 校验 + 全部单元/组件/集成测试（当前 50 项）
pnpm test               # 单元与组件
pnpm run test:integration
```

自动化测试使用真实 Cordis、DSH JSON/Storage Domain/Typert Gateway 与 React SSR。执行测试用「脚本化 Agent」驱动**真实**编排、**真实**工具守卫与**真实**命令执行（真实退出码），不伪装模型输出。SSR 与脚本化 Agent 都不等同于浏览器/桌面视觉验收。

真实客户端验收工具（可复现，非产品代码）：
- `tests/live-probe-unified/install.mjs`：官方 CLI 安装到隔离 home（含 live profile 保护）
- `tests/live-probe-unified/start-host.mjs`：官方 `runProfile` 启动隔离 Web Host 并交接认证 URL
- `tests/live-probe-unified/ui-drive.mjs`：真实浏览器输入事件驱动（CDP Input 域）；`ui-probe.ps1`：UIA 交叉核对
- `tests/live-probe-unified/desktop-probe.ps1`：真实 Desktop 窗口 UIA 操作
- `tests/live-probe-unified/verify-delivery.mjs`：独立进程复验交付软件（快照/构建/测试/HTTP/功能/Release 元数据）

## 尚未实现

P2 的独立 Reviewer 体系与多层质量门禁、P3 的跨模型接管/通用断点续跑/动态模型调度均未实现。主 Agent 是单一 root Agent 顺序执行「规划 → 编码」，不虚构多 Agent 分工。

## 许可

[MIT License](LICENSE)，Copyright (c) 2026 wangxiaow。
