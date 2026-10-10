# dsh-wish-willow-p1

Wish Willow P1：许愿式编程最小闭环的独立 DSH Bundle（companion bundle）。它在原版 DSH 中加入一个设置页与一个 Host 服务：
用户提交自然语言愿望后，由真实 DSH Agent 完成规划、编码、构建、测试并交付可运行软件，产品事实持久保存在独立 Storage Domain 中。

P0 Bundle（`dsh-wish-willow`，`0.1.0-p0.1`）与其数据保持原样，本包不读取或改写 P0 存储文件，只在用户显式点击“从 P0 产品导入”时按 UUID 复制一份只读快照。

## 安装

需要 DSH `0.2.0-rc.2` / Cordis `4.0.4`，Node ≥ 22，且 profile 已有 `storageDomain`、`typertGateway`、Agent/工具/沙箱/审批、Client Connection、locale 与 Settings Slot。使用官方插件管理页或 `plugin_manager` 安装本目录（`packages/p1`）或打包后的 tgz。

安装影响当前 profile 的所有会话；Host 代码具有宿主权限。安装后打开/刷新原 DSH 页面，在 设置 → Wish Willow · P1 使用。

## 使用

1. 左侧新建产品，填写名称与愿望；愿望是唯一被标记为“用户确认”的需求。
2. 提交愿望后，主 Agent 先做规划（只允许 `wish_state`/`wish_plan`），把需求、约束、决策与任务写入同一份持久产品状态。
3. 若 Agent 提出重大决策，产品进入阻塞状态，需要你在看板上明确接受或拒绝后才继续。
4. 编码阶段 Agent 在受控工作目录中真实修改源码，并通过 `wish_verify` 分别执行 build/test/run；Host 只接受真实前台退出码为 0 的证据。
5. `wish_deliver` 只有在源码确实被修改、且 build/test/run 三类证据均成功时才允许；Host 会保存不可覆盖的源码快照并写入 Released 版本。
6. 继续提交新的愿望即为第二轮演化：保留原已确认需求与历史版本，生成新的 ChangeSet 与交付版本。

失败会成为可见的任务状态；重试有次数上限，且“状态待确认”必须先确认才能重试。系统不会因为在运行中中断就重跑有副作用的操作。

## 数据

- Domain `wish_willow_p1`，version 1，single layout，表 `projects`（一个产品一条聚合记录）。
- 默认根目录来自 DSH storage 配置；工作目录默认 `$DSH_HOME/wish-willow/projects/<projectId>`。
- **同一存储 root 只允许一个写入 Host**；JSON 后端没有跨进程写锁。
- 未知版本、损坏 JSON 或不符合 schema 的记录会拒绝加载，不自动清空或迁移。

## 限制

- 未实现（属于 P2/P3）：独立 Reviewer 体系、跨模型交叉评审、跨模型任务接管、通用断点续跑与动态模型调度。
- 主 Agent 为单一 root Agent 顺序执行“规划 → 编码”，不使用虚构的多 Agent 分工。
- `workspace-write` 是文件写入边界，不是网络/进程/凭据隔离。
- 源码快照有大小与文件数上限，超出即失败而不是静默截断。
