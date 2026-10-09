# 经核实的 DSH 接口依据

验证日期：2026-10-09，本机官方 Desktop 安装 `0.2.0-rc.2`，Cordis `4.0.4`，Node `24.21.0`。

官方仓库身份来自安装包 manifest：<https://github.com/deepseek-ai/deepseek-harness>。GitHub 与 raw 内容抓取均被 web_fetch 的非公网 DNS 检查拒绝，没有绕过；本次实际阅读的是同版本官方随附 README、开发模板与已发布实现源码，而非远程 master。安装包没有可用 Git commit，固定 npm 版本及归档 SHA256：

```text
app.asar SHA256
983CA71114E6DFD353FC79AF5A1F9481A250EE64C2A3C757673029B811B23BC2
```

ASAR 的 `dsh/` 只读提取于被 Git 忽略的 `.research/installed/dsh/`。不修改、不重新分发 DSH 核心。以下原始路径均相对于其中的 `node_modules/@deepseek-ai/`；原始发行物也可在官方同名 npm 包中核对。

| 结论 | 实际读取依据 |
|---|---|
| Bundle 是 manifest.dsh.bundle.patch 指向的 YAML；insert 加唯一插件行 | `dsh-agent-preset/skills/cordis-plugin-development/references/host-plugin.md:3–27` |
| Host export apply/inject，所有注册需 effect 生命周期 | 同文 `49–60`；`cordis/lib/index.js:1594–1640` |
| Client 平台声明仍是 web；lazy factory ID 必须等于 package name | `dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/{package.json,client.js}`；`dsh-client-modules/README.zh.md:28–50` |
| Desktop 可以由 shell carrier 获取同一 bundle | `dsh-client-modules/README.zh.md:12,74–80`；不因此宣称原生完整验收通过 |
| 根级设置页是 additive list，唯一 id 不替换 shipped UI | 运行时 Client `Slots.listSubTree(root=settings.section)`，存在且 owner props.close；`Service.listService(service=slots)` 核实 inject/register 生命周期 |
| Theme/locale 可复用 | 运行时 `Theme.listTokens` 与 `Service.listService(service=locale)`；Client 只用返回的 token 名称 |
| 产品领域独立于 Session，持久写/close | 运行时 Host `Service.listService(service=storageDomain)`；`dsh-storage-domain/README.zh.md:12,49–89` |
| Domain 名称不接受横杠，写入不自动 parse | `dsh-storage/lib/index.js` UNIT_NAME_RE；`dsh-storage-domain/lib/index.js:61–75,257–285,365–383`；首轮导入失败促使 domain 改为 wish_willow |
| JSON 原子发布、单元格式、无跨进程写锁 | `dsh-storage-json/lib/index.js:25–51`；`README.zh.md:76–88,141–143` |
| base 默认 root=$DSH_HOME/storages | `dsh-base/cordis.patch.yml:165–176`；运行时 `Config.listConfigs(entry=include:storage-json)` 核实 root schema（未将表达式当实际路径） |
| Bundle 安装/启停接口和风险 | 运行时 Host `Service.listService(service=pluginManager)`、`plugin_manager.list_bundles`；`dsh-plugin-manager/README.zh.md:31–69,92–94,125–150` |
| 本地路径/git/压缩包可安装；安装不等于激活 | 同 README:46–48,94,134–148；安装必须通过 plugin_manager，不手改 profile |
| RPC 不重造 transport | 运行时 Host `Service.listService(service=connection)`、`service=typertGateway`；`dsh-api-gateway/README.zh.md:27–34,54–56` |
| SRC 可暴露简单参数方法，业务校验由插件承担 | `dsh-api-gateway/lib/index.js:998–1074`；`README.zh.md:29,83–85`；`dsh-typert-protocol/lib/index.js:146–194,239–267` 的公开 Remote 与绑定实现 |
| Client Connection carrier 能共用 Web/原生 transport | `dsh-client-connection/lib/client.js:1209–1231,1365–1369,1423,1477–1490`；公开 README:28–32 |

## 检查局限

- Client `connection` 由 ctx.provide 提供，Inspect Service catalog 未收录；精准查询返回 provider-error（未猜测接口）。其实际签名由官方实现核实，使用 `rpc.call(channel, endpoint, payload, signal)`，结果 `{ok,value}` 或 `{ok:false,error}`。
- 没有使用任何未查询的 Event，也没有将 Inspect Provider 的方法误当业务 Service 调用。
- 默认 JSON 后端的单 Host 限制不能用 revision CAS 或原子 rename 隐藏。
- 未运行 DSH 源码 watcher；不会承诺改源文件后当前 GUI 自动更新。外部 Bundle 更新须重装/重启并刷新原 URL，不能新起 Vite 替代当前 GUI。

自动化与实际管理器运行结果分别见验收报告，源码依据不替代实际平台验收。
