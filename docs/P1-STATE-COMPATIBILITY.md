# P1 状态兼容方案（实施中）

## 选择、原因与替代方案

选择新增 **P1 独立 Bundle `dsh-wish-willow-p1`** 与 Storage Domain `wish_willow_p1`（version 1，single layout，projects 聚合表），保留已验收 P0 Bundle、`wish_willow` version 1/products 及设置编辑器原样。原因：不需要迁移/改写旧数据，也不需要在当前仍工作的 Desktop Host 中替换已装包、触发 restart-required。P1 本身没有 Fork/新服务器/框架；复用相同 DSH Host。现有 P0 作为可选导入来源，而不是 P1 Agent 运行依赖。

替代方案：在 P0 products 增加字段，会使 P0 的严格旧 schema 不能回读；新增表到同一 JSON unit 会被旧后端按已声明表重新序列化而丢掉新表；替换当前 P0 包需要完整重启。为保护旧数据及活跃会话，均不采用。阶段切换不改 AGENTS.md。

## 数据映射

- P0 每条产品保持原 id/title/wish/status/schemaVersion/revision/createdAt/updatedAt。
- 用户在 P1 显式导入时，以同一 UUID 创建 P1 Project，保存 `legacy.productId/revision/snapshot`。快照逐字段、逐字符串保留旧数据；P0 源记录不写、不重置。
- P1 新建产品直接进入 P1 Domain，不伪称旧 P0 页面可编辑新的 P1 执行记录。两个设置入口各自明确阶段。
- 一个 P1 聚合记录保存正式需求/约束/决策/任务/运行/ChangeSet/证据/构建/产物/版本/交付/来源历史。UI 与主 Agent 读写同一记录，通过单 Domain 串行变换实现 CAS，避免多表事务。
- 已确认需求是原始用户愿望；Agent 拆分/补充只能标记 inferred。重要决策的用户确认不暴露给 Agent 工具。
- Release 历史只可追加，不可无痕改写。Built/Released 必须关联本次 build/test/run exit 0 的真实工具结果及源码快照，不接受 Agent 自报完成。

## 幂等、恢复与失败关闭

创建使用持久 creationRequestId；重复同一输入返回同一产品，异输入拒绝。愿望提交使用 ChangeSet.requestId，响应丢失后旧 revision 同键重试返回既有状态；不同新请求仍受 CAS/忙碌检查。运行中 Host 中断后 pending/running 标记 uncertain，不自行续跑、不重复有副作用的执行；显式恢复必须保留旧失败/未确认记录。

两份 Domain 仍由**一个 Host**写入；不新增第二 Host，不对正在运行的 JSON 文件手工写入。未知 version/损坏 JSON/坏记录失败关闭；不自动清空、不忽略非法记录。

## 已验证与待验证

- 2026-10-10 单元测试 `tests/p1-state.test.mjs` 5/5：幂等、CAS、持久失败、P0 完整快照、确认事实保护、中断待确认、无证据不可交付。
- 2026-10-10 集成测试 `tests/integration/p1-runtime.test.mjs` 3/3（真实 Cordis + Storage + JSON + Domain + Typert + Gateway）：P0 与 P1 各自 Domain 真实落盘、P0 文件字节在导入前后完全不变、同 UUID 导入、新 Host 代际重开一致、坏 JSON/外来版本/非法记录失败关闭且保留字节。
- 2026-10-10 集成测试 `tests/integration/p1-execution.test.mjs` 6/6（脚本化 Agent 驱动真实编排、真实守卫、真实命令执行）：证据门禁、无证据拒绝交付、真实非零退出码留证、失败后重试、第二轮愿望演化出第二个版本、3 次重试上限、步数上限后失败而非循环。
- P0 原有 14 项回归 + 上述新增共 **32 pass / 0 fail / 0 skip**，`pnpm run check` 退出码 0，原始日志 `docs/evidence/p1/check-full.txt`。
- 真实运行时（Desktop Host，DSH `0.2.0-rc.2`）：P1 Bundle 经官方 `plugin_manager.install_bundle` 安装返回 `application: applied`，未重启 Host 即在真实 Client `settings.section` 出现 `wish-willow-p1`（order 31、active）；真实端到端两轮执行与交付证据见 `docs/P1-REPORT.md` 与 `docs/evidence/p1/live/`。
- 仍未验证：Web 端独立浏览器的表单点击链路、原生 Desktop 的完整键盘/视觉验收（见 `docs/P1-ACCEPTANCE.md` 的独立验收步骤）。

