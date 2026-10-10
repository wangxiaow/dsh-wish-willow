# Web / Desktop 验证记录（P0 历史记录）

> **本文件是 P0 阶段（`dsh-wish-willow` 0.1.0-p0.1，单页面）的验证记录，保留历史原文。**
> 统一 Bundle 0.3.0 的双端验收记录已迁移到 [P1-FINAL-ACCEPTANCE.md](<P1-FINAL-ACCEPTANCE.md>) 与 [P1-UNIFICATION-REPORT.md](<P1-UNIFICATION-REPORT.md>)：其中 Web 端为真实 Host + 真实浏览器完整流程，Desktop 端为真实 profile 安装级升级 + 单入口实测（面板复验待重启）。
> 下表最后三行「未验证」项在统一 Bundle 阶段已被上述记录取代。

环境：Windows、官方 Desktop 0.2.0-rc.2；`DSH_PROFILE=desktop`；现有 Web GUI URL 为 `http://127.0.0.1:19387`。没有创建替代服务器、改造核心或终止应用。

## 实际证据矩阵

| 项目 | 结果 | 证据/边界 |
|---|---|---|
| 当前 Desktop profile Bundle 安装 | 通过；正式来源替换待重启 | 候选包 applied/exit=0；正式 artifacts 路径重新安装 exit=0、restart-required。之后仅补充交付记录，运行源码未变 |
| 当前 Desktop Host 插件加载 | 通过 | list_plugins：include:wish-willow-p0、enabled=true、fiberPhase=active |
| 当前连接 Client 的 UI 注册 | 通过 | 实际 Client Slots.listSubTree：settings.section 中 wish-willow-p0/order=30/active=true |
| 停用释放与重新启用 | 通过 | Slot 消失后恢复；JSON 文件 SHA256 未改变 |
| 当前 Desktop Host 产品读写/恢复 | 通过 | 临时 probe 调用正式 Service 创建及更新，domain 重开后相同 ID、revision=2、内容与时间戳一致；同 PID=31800，**不是整机重启** |
| 现有 Web URL 未认证请求 | 通过 | 对 api/wishWillow/list 的真实 POST 返回 HTTP401，不获取/读取认证密钥 |
| Web/原生共用 Connection 路径 | 实现/集成通过 | 官方 Connection 共享 Fetch handler 真实调用测试，业务只调用 connection.rpc.call('/api',...)；未把模拟载体当原生 E2E |
| React 编辑、保存与冲突保留 | 自动化通过 | react-test-renderer 真实 hooks 交互；不是浏览器 DOM 测试 |
| 中英文字典与 SSR 控件/主题 token | 自动化通过 | React SSR 两种语言；未做真实像素/键盘/读屏验收 |
| 跨新进程恢复 | 自动化通过 | 两个独立 Node 进程加载实际 DSH Cordis/存储/Gateway 后深比较；不是完整 DSH 应用重启 |
| 独立浏览器 Web 端表单创建/修改 | 未验证 | 无已认证浏览器 DOM/点击工具；未读取凭据或通过新服务器冒充原 URL |
| 原生 Desktop 窗口视觉与 IPC 表单闭环 | 未验证 | 有 Desktop Host，但没有原生窗口截图/交互证据；当前 Client Inspect 不能证明窗口载体种类 |
| 完整退出/重新启动 Desktop 后恢复 | 未验证 | 当前工作会话由此应用承载，没有强制结束进程以避免丢失用户工作；提供下述手工流程 |
| 不同机器/macOS/Linux | 未验证 | 没有目标机器，代码共享不是跨平台通过 |
| 实际 GitHub 下载安装 | 未验证 | 已有用户授权的 wangxiaow/dsh-wish-willow 仓库；本次只提交源码，尚未用 DSH 管理器验证远程安装 |

## 待用户手工验收（不进入 P1）

1. 在现有 DSH 的设置中选择 **Wish Willow · P0**。若入口未同步，刷新原页面，不新起服务器。
2. 确认能看到 `[P0 TEST] Wish Willow 加载验证` 测试记录（明确不是正式需求）。新建一个自己的产品，保存名称、愿望与手动状态，记下 UUID 和 revision。
3. 在第二个**连接同一 Host**的页面打开同一产品；先后修改，确认后保存者收到冲突且草稿仍在。
4. 保存所有 DSH 工作后，用应用正常退出/重启。再打开该页，确认 UUID、文本、状态和 revision 不变。
5. Web 浏览器与原生桌面窗口分别重复创建/修改、页面刷新、暗色/亮色、窄屏、Tab 导航。不要让两个独立 Host 同时写同一 storage root。
6. 检查停用 Bundle 后入口消失、重新启用后数据恢复。不要直接编辑正在写入的 JSON。

验收记录请附平台、DSH 版本、Host 模式、操作步骤与通过/失败。未验证项不能据此报告直接打勾。
