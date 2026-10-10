# P1 独立验收步骤

面向**独立验收 Agent / 人工验收者**。所有步骤基于真实仓库与真实 DSH 运行时；未实际执行的项必须记为 UNVERIFIED，不得由共享代码推断通过。

版本：Wish Willow P1 `0.2.0-p1.1`，DSH `0.2.0-rc.2` / Cordis `4.0.4`，Node ≥22，Windows 11。

## 0. 准备

```sh
cd G:\dsh\Wish-Willow
git status --short --branch      # 记录 HEAD 与未提交内容
pnpm install --frozen-lockfile --ignore-scripts
```

确认基线：`tasks/P1.md` 记录了开发起点（`main` / `d72ab3c`）、DSH 与 app.asar SHA256、P0 原有 14 项测试结果。

## A. P0 回归（必须通过）

```sh
& <bundled-node> <bundled-pnpm> run check
```

判据：`scripts/check.mjs` 输出 Build PASS；`node --test` 汇总 **0 fail、0 skip**，且总数 ≥32（P0 原 14 项 + P1 新增）。原始日志参考 `docs/evidence/p1/check-full.txt`。允许 PowerShell 把 pnpm 的命令回显标记为 NativeCommandError，但进程退出码必须为 0。

## B. 数据与兼容

1. `tests/integration/p1-runtime.test.mjs` 必须通过，覆盖：P0/P1 各自 Domain 真实落盘、导入前后 P0 文件字节不变、同 UUID 导入、新 Host 代际重开一致、坏 JSON/外来版本/非法记录失败关闭且保留字节。
2. 手工交叉核验（真实 Host）：记录 `$DSH_HOME/storages/wish_willow.json` 的 SHA256，然后在 P1 页面执行一次“从 P0 产品导入”，再比较该文件 SHA256 —— 必须完全一致；`wish_willow_p1.json` 中该记录必须含 `legacy.snapshot`（逐字符串等于导入前的 P0 记录）。
3. 复核 revision 冲突：在两个页面（或两次 RPC）用同一 `expectedRevision` 提交，只有第一个成功，第二个返回 `wish-willow-p1/conflict`。
4. 复核幂等：用相同 `requestId` 重复创建/提交返回同一记录；用相同 `requestId` 但不同内容返回 `idempotency-conflict`。

## C. Agent 执行与证据门禁

1. `tests/integration/p1-execution.test.mjs` 必须通过（脚本化 Agent 驱动真实编排、真实守卫、真实命令执行）。
2. 逐项确认断言存在：无代码修改或缺少 build/test/run 证据时 `wish_deliver` 被拒绝；真实非零退出码被记录为失败证据；3 次重试上限；步数上限后 ChangeSet 失败而不是继续循环。
3. 真实运行时抽查：在真实 Host 中触发一次愿望，确认 `wish_willow_p1.json` 中出现 `runs[].sessionId`、`evidence[].exitCode`、`artifacts[].sha256`、`releases[]`，并用 `docs/evidence/p1/live/` 的记录交叉比对。

## D. UI（分别验证 Web 与原生 Desktop）

1. 安装 P1 Bundle 后，查询客户端 Slot：`cordis_inspect_query(platform=client, provider=Slots, method=listSubTree, input={root:"settings.section"})`，确认 occupants 含 `wish-willow-p1`、order 31、active=true —— 这是**注册**证据，不是视觉验收。
2. 原生 Desktop：打开/刷新 DSH，进入 设置 → Wish Willow · P1，用一个标记 `[验收测试]` 的产品实际点击：新建产品 → 提交愿望 → 观察任务从待执行到执行中；确认失败任务、证据、构建、版本与启动方式可见，且没有伪造百分比。
3. 浏览器 Web：在已认证的 Web 页面重复第 2 步（同一 Host，避免两个 Host 共写同一存储 root）。
4. 两端都要记录：产品 UUID、revision、任务状态、证据退出码、版本标签、启动命令、截图或控件文本。未实际执行的一端记为 UNVERIFIED。

## E. 端到端（P1-C 关键项）

1. 从真实 UI 输入一个普通自然语言愿望（例如待办事项应用），等待执行结束。
2. 判据：生成真实源码目录；`build`/`test`/`run` 三类证据均有真实 exit 0；`builds[].status=passed`；`versions[].status=Released`；`releases[]` 提供可在源码目录重复执行的启动命令；本地实际运行该命令并确认软件可用。
3. 第二轮：对同一产品提交修改愿望（例如增加优先级与筛选），判据：新增 ChangeSet、任务、证据、Build 与第 2 个 Released 版本；原已确认需求与第一个 Release 记录保持不变（不可无痕改写）；第二轮交付的软件仍满足核心原需求。
4. 两轮都要有可核验的代码、测试与执行证据；仅“生成了代码文本”不算交付。未启动或无法访问的 URL 不得标记为可用预览。

## F. 明确不要求的项

- P2 的独立 Reviewer / 多层质量门禁，P3 的跨模型接管 / 通用断点续跑 / 多模型调度。
- 云部署、应用商店发布。
- 跨 Host 并发写同一存储 root 的 CAS。

## 判据汇总

| 项 | 通过判据 |
|---|---|
| A | `pnpm run check` 退出码 0，0 fail / 0 skip，总数 ≥32 |
| B | 集成测试通过 + P0 文件字节不变 + 冲突/幂等实测 |
| C | 执行集成测试通过 + 真实运行时证据可交叉核对 |
| D | Slot 注册证据 + 至少一端真实点击验收；另一端未做则 UNVERIFIED |
| E | 两轮均满足“真实源码 + 三类 exit 0 证据 + Released 版本 + 可重复启动命令” |
