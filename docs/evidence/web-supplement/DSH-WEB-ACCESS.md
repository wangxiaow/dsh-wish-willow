# Web 补验连接方式核对

时间：2026-10-10；范围仅 T4/T5 的测试环境。不修改产品或 DSH 核心。

> 本文记录启动前的查证与待确认方案。用户随后明确批准隔离方案，已实际执行并结束；见[测试 Host](<docs/evidence/web-supplement/isolated-host.json>)、[补验结果](<docs/evidence/web-supplement/results-final.json>)与[结束核验](<docs/evidence/web-supplement/cleanup.json>)。以下“尚未启动”“等待确认”均指查证当时。

## 已确认的事实

1. 当前 Chrome 的已认证页面 origin 是 `http://127.0.0.1:3080`，监听进程为 Node PID 8860；Desktop Host 是 `127.0.0.1:19387`，PID 29280。这是两个不同 Host，不要求也不应把 PID 强行合并。[浏览器 origin 记录](<docs/evidence/web-supplement/browser-origin.json>)只保留 origin，不记录 URL 查询、fragment 或认证信息。
2. 当前用户 Web profile 的 [package.json](<C:/Users/wangw/.dsh/profiles/web/package.json>)仅选择 `@deepseek-ai/dsh-base` 与 `@deepseek-ai/dsh-web-app`，没有安装/选择 Wish Willow。浏览器刷新后设置中无 Wish Willow 入口，与该环境配置一致；这不能作为 Wish Willow Web 功能失败证据。[真实浏览器截图](<docs/evidence/web-supplement/browser-after-refresh.png>)。
3. 官方 Web 用 `dsh --profile web` 启动；启动器通常自动打开携带一次性进程启动认证参数的页面，并换取签名 cookie 后重定向到干净地址。不是手工只输入一个端口就自动获得认证。依据：[官方 Web 使用说明:34–41](<.research/installed/dsh/node_modules/@deepseek-ai/dsh-web-app/README.zh.md#L34-L41>)、[官方 Connection 认证说明:37–43](<.research/installed/dsh/node_modules/@deepseek-ai/dsh-client-connection/README.zh.md#L37-L43>)。
4. Desktop 在内部以 `--no-open --port 19387` 启动 profile，然后生成 authenticatedUrl 经 IPC 交给 Electron。只读源码证明有同一 HTTP 服务与认证，但本次没有找到可向用户推荐的 Desktop“普通浏览器登录”入口；不能声称技术上绝不可能，也不能让用户裸开 19387 就视为已认证。依据：[Desktop Host:215–235](<.research/installed/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js#L215-L235>)、[认证 URL 的 IPC 交接:337–342](<.research/installed/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js#L337-L342>)。不提取该 IPC 信息或读取用户认证存储。
5. T5 的两个真实客户端可以是同一个 Web Host 的两个浏览器标签页/窗口，并不必须一端 Desktop、一端 Web。产品 revision 的原子性范围是同一个 Host；DSH Domain 的变更只在进程内可见。[官方 Domain 限制:149–153](<.research/installed/dsh/node_modules/@deepseek-ai/dsh-storage-domain/README.zh.md#L149-L153>)。
6. profile 是独立的 Bundle 选择，不代表产品存储自动跨 Host 隔离。不能在与 Desktop 共用 home/root 的 Web profile 中直接启用本插件并同时写同一个产品文件。官方 profile 约定：[App boot:46–50](<.research/installed/dsh/node_modules/@deepseek-ai/dsh-app-boot/README.zh.md#L46-L50>)；本项目单写入 Host 边界见 [兼容性说明](<docs/COMPATIBILITY.md>)。

## 建议的最小安全方案（尚未启动）

复用前轮 GitHub 安装验收已建立的隔离 home，其 [Web profile manifest](<.test-data/final-github-home-20261009/profiles/web/package.json>)已选择固定 Commit 的 Wish Willow。使用同版本官方 CLI 启动一个仅用于补验的 Web Host，例如空闲的 `3081` 端口。两个真实浏览器客户端连接该同一新 Host，完成 T4/T5。

示意命令（只影响执行该命令的终端环境）：

```powershell
$env:DSH_HOME = 'G:\dsh\Wish-Willow\.test-data\final-github-home-20261009'
& 'C:\Users\wangw\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' `
  'G:\dsh\Wish-Willow\.research\installed\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js' `
  --profile web --port 3081
```

由官方启动流程打开浏览器完成认证，不复制或记录 Token。Agent 若执行，会事先确认端口空闲、避免把认证启动 URL 写入验收日志，并以受管理后台任务运行；结束只停止该测试 Host，不停止现有 3080/19387。

此方案不安装到现有 Web/Desktop profile，不重启 DSH，不改变现有产品存储，也不需要调用模型。启动额外测试服务前等待用户确认。

## 执行边界

最初把“两个客户端共用一个 Host”过度限定为“浏览器必须连接 Desktop 的 19387”，现已纠正。此前缺失入口是不同 profile 未装插件的环境差异，未认定为产品缺陷。后台研究代理未完成，以上结论由主 Agent 直接读取官方资料得到。未启动新服务器、未改认证、未写产品数据。
