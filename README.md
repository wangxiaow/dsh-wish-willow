# Wish Willow

基于原版 DeepSeek Harness 的独立 Bundle 集合：让用户用自然语言表达软件愿望，由 AI 完成需求整理、开发、测试与交付。

- **P0（`dsh-wish-willow`，已验收）**：插件加载、独立持久产品状态与最小编辑 UI。只保存数据，不执行自动编程。
- **P1（`dsh-wish-willow-p1`，本次交付）**：许愿式编程最小闭环。提交愿望 → 真实 DSH Agent 规划 → 真实编码/构建/测试/运行 → 看板展示真实状态与证据 → 交付可运行软件 → 继续提交新愿望实现第二轮演化。

P2（独立 Reviewer、质量门禁）与 P3（跨模型接管、持续演化）未实现。

## 环境

固定 DSH **0.2.0-rc.2** / Cordis **4.0.4**，Node ≥22。需要已有 `storageDomain`、`typertGateway`、Agent/工具/沙箱/审批、Client Connection、locale 与 Settings Slot 的 Web/桌面组合。其他版本未经验证；不要通过版本豁免强行加载。

## 安装

### 推荐：DSH 插件管理页

1. 本地构建与检查：
   ```sh
   pnpm install --frozen-lockfile --ignore-scripts
   pnpm run check
   ```
2. 打包（P0 与 P1 各一个 Bundle）：
   ```sh
   pnpm pack --pack-destination artifacts
   pnpm --dir packages/p1 pack --pack-destination ../../artifacts
   ```
3. DSH 左侧 **插件 → 安装**，填入包目录或压缩包的**绝对路径**，例如：
   ```text
   G:\dsh\Wish-Willow\packages\p1
   G:\dsh\Wish-Willow\artifacts\dsh-wish-willow-p1-0.2.0-p1.1.tgz
   ```
4. 检查 Bundle 为启用、`wish-willow-p1` Host 行为 active。安装影响当前 profile 的所有会话，Host 代码具有宿主权限。
5. 打开/刷新原 DSH 页面，在 **设置 → Wish Willow · P1** 使用；P0 页面仍在 **设置 → Wish Willow · P0**。

创造模式也可使用公开工具 `plugin_manager`：先 `list_bundles`，再 `install_bundle`，`target` 填上述路径。插件自身不增加工具或权限。

## P1 使用（许愿式闭环）

1. 左侧新建产品，填写名称与愿望；愿望是唯一被标记为“用户确认”的需求。
2. 提交后主 Agent 先规划（此阶段只允许读取正式状态与保存计划），把需求、约束、决策与任务写入同一份持久产品状态。
3. Agent 提出重大决策时产品进入阻塞，需要你在看板明确接受或拒绝后才继续。
4. 编码阶段 Agent 在受控工作目录中真实修改源码，并通过 `wish_verify` 分别执行 build/test/run；Host 只接受真实前台退出码为 0 的证据。
5. `wish_deliver` 只有在源码确实被修改、且 build/test/run 三类证据均成功时才允许；Host 会保存不可覆盖的源码快照并写入 Released 版本，版本记录含可重复启动命令。
6. 继续提交新愿望即为下一轮演化：保留已确认需求与历史版本，生成新的 ChangeSet、构建与交付版本。

失败会成为可见的任务状态；重试有 3 次上限，“状态待确认”必须先确认才能重试（避免重复副作用）。执行有步数与时间上限，不会无限重试。

## 数据与备份

- P0：Domain `wish_willow`，版本 1，表 `products`。
- P1：Domain `wish_willow_p1`，版本 1，表 `projects`（一个产品一条聚合记录：需求/约束/决策/任务/运行/证据/产物/构建/版本/交付/来源历史）。
- P1 工作目录默认 `$DSH_HOME/wish-willow/projects/<projectId>`（Desktop profile 实测为 `.../profiles/desktop/wish-willow/projects/<projectId>`）；交付快照在 `.../deliveries/<projectId>/<versionId>`。
- 产品数据独立于 Session；P1 通过 Session ID、运行 ID、任务 ID 与真实执行证据关联。
- **同一存储 root 仅允许一个写入 Host**。JSON 后端没有跨进程写锁；revision 检查只保证同一 Host 的并发页面不静默覆盖。不同时启动 Web/桌面两个 Host 共写同一文件。
- 坏 JSON、schema 或 domain 版本不匹配会拒绝加载，保留原文件，不自动清空/迁移。停用或卸载不删除产品数据。
- P0 产品不会被 P1 自动改写；P1 只在用户点击“从 P0 产品导入”时按 UUID 复制一份只读快照。

## 开发与验证

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check          # build 校验 + 全部单元/组件/集成测试
pnpm test               # 单元与组件
pnpm run test:integration
```

自动化测试使用真实 Cordis、DSH JSON/Storage Domain/Typert Gateway，以及 React SSR。P1 的执行测试用「脚本化 Agent」驱动**真实**编排、**真实**工具守卫与**真实**命令执行（真实退出码），不伪装模型输出。SSR 与脚本化 Agent 都不等同于浏览器/桌面视觉验收。

主要说明：[架构](docs/ARCHITECTURE.md)、[接口依据](docs/API-EVIDENCE.md)、[P1 状态兼容](docs/P1-STATE-COMPATIBILITY.md)、[P1 交付报告](docs/P1-REPORT.md)、[P1 独立验收步骤](docs/P1-ACCEPTANCE.md)、[P0 验收报告](docs/P0-REPORT.md)。

## 尚未实现

P2 的独立 Reviewer 体系与多层质量门禁、P3 的跨模型接管/通用断点续跑/动态模型调度均未实现。P1 主 Agent 是单一 root Agent 顺序执行“规划 → 编码”，不虚构多 Agent 分工。

## 许可

[MIT License](LICENSE)，Copyright (c) 2026 wangxiaow。
