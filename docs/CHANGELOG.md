# 变更记录

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

没有开发 P1/P2/P3；没有核心 Fork、远程推送、Release 或公网部署。
