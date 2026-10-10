# Wish Willow 升级与回退手册（双 Bundle → 统一 Bundle）

适用版本：`dsh-wish-willow` **0.3.1**（统一 Bundle）替换 `dsh-wish-willow` 0.1.0-p0.1 + `dsh-wish-willow-p1` 0.2.0-p1.1（双 Bundle）。
适用环境：DSH `0.2.0-rc.2` / Cordis `4.0.4`，Windows（本次实测平台）。

> **数据安全承诺**：本次升级**不迁移、不改写、不重命名**任何存储。`wish_willow.json` 与 `wish_willow_p1.json` 在升级前后必须字节一致；升级只改变「装了什么、看到什么页面」。

---

## 1. 升级后的变化

| 维度 | 升级前（双 Bundle） | 升级后（统一 Bundle） |
|---|---|---|
| 安装单元 | `dsh-wish-willow` + `dsh-wish-willow-p1` | 仅 `dsh-wish-willow@0.3.1` |
| Loader row | `wish-willow-p0`、`wish-willow-p1` | `wish-willow` |
| 用户页面 | 设置里两个：`Wish Willow · P0`、`Wish Willow · P1` | 设置里一个：`Wish Willow` |
| Service | `wishWillow`、`wishWillowP1` | 同左（未改名） |
| Storage Domain | `wish_willow` v1/products、`wish_willow_p1` v1/projects | 同左（未改名、未改版本、未改 schema） |
| 产品数据文件 | `$DSH_HOME/storages/wish_willow.json`、`wish_willow_p1.json` | 同左，字节不变 |
| 工作目录与交付快照 | `$DSH_HOME/wish-willow/projects/<id>`、`…/deliveries/<projectId>/<versionId>/source` | 同左 |

统一后的**正式产品状态来源**是 P1 聚合记录（`wish_willow_p1/projects`）；`wish_willow/products` 保留为可查看、可编辑、可按 UUID 导入的旧数据源（导入幂等，重复导入返回同一产品，不写 P0 文件）。

---

## 2. 升级前准备（必须）

```powershell
# 1) 记录当前安装与数据指纹
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
(Get-FileHash "$env:USERPROFILE\.dsh\storages\wish_willow.json"    -Algorithm SHA256).Hash.ToLower()
(Get-FileHash "$env:USERPROFILE\.dsh\storages\wish_willow_p1.json" -Algorithm SHA256).Hash.ToLower()

# 2) 备份 profile 清单与产品数据（示例路径可自选，勿提交到仓库）
$bk = "$env:USERPROFILE\wish-willow-upgrade-backup"
New-Item -ItemType Directory -Force -Path $bk | Out-Null
Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\package.json"     "$bk\package.json"
Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml" "$bk\cordis.patch.yml"
Copy-Item "$env:USERPROFILE\.dsh\profiles\desktop\pnpm-lock.yaml"   "$bk\pnpm-lock.yaml"
Copy-Item "$env:USERPROFILE\.dsh\storages\wish_willow.json"         "$bk\wish_willow.json"
Copy-Item "$env:USERPROFILE\.dsh\storages\wish_willow_p1.json"      "$bk\wish_willow_p1.json"
```

不可省略的理由：卸载/安装 Bundle 只动 profile 清单与 `node_modules`，但备份能让任何意外都可回退。
**不要**为了升级而停掉或替换用户正在运行的环境；如必须重启，请先取得用户同意。

---

## 3. 升级步骤

### 3.1 顺序要求（重要）

**先移除旧 P1 Bundle，再安装统一 Bundle。**
原因：统一 Bundle 的 Host 会注册 `wishWillowP1`；若旧 `dsh-wish-willow-p1` 仍在 bundles 列表中，同一 Host 会出现两个相同 Service 的注册，导致新行装载失败。

### 3.2 通过 DSH 插件管理工具（推荐，Desktop 使用此方式）

```text
plugin_manager.list_bundles                      # 确认现状：dsh-wish-willow(0.1.0-p0.1) + dsh-wish-willow-p1(0.2.0-p1.1)
plugin_manager.remove_bundle    target=dsh-wish-willow-p1
plugin_manager.install_bundle   target=<绝对路径>\artifacts\dsh-wish-willow-0.3.1.tgz
plugin_manager.list_bundles                      # 确认只剩 dsh-wish-willow(0.3.1)
```

本次实测回执：

| 操作 | 回执 |
|---|---|
| `remove_bundle dsh-wish-willow-p1` | `stage: remove, changed: true, application: applied, packageResult.exitCode: 0` |
| `install_bundle …0.3.1.tgz` | `stage: enable, changed: true, **application: restart-required**, packageResult.exitCode: 0` |

### 3.3 通过官方 CLI（非 Desktop profile 适用）

```powershell
$env:DSH_HOME = '<隔离 home>'          # 例如 %LOCALAPPDATA%\dsh-wish-willow-acceptance\home-unified
node <dsh 安装目录>\node_modules\@deepseek-ai\dsh\lib\bin.js plugin --profile web add <tgz 绝对路径>
node <dsh 安装目录>\node_modules\@deepseek-ai\dsh\lib\bin.js plugin --profile web remove dsh-wish-willow-p1
```

（`plugin` 子命令把参数转发给 profile 目录里的 pnpm，属于官方安装路径；不要手工改 `package.json` 或直接改 `node_modules`。）

### 3.4 重启

- 插件管理回执为 `application: applied` 时，客户端入口通常立即更新（本次隔离环境与真实 Desktop 的入口都立刻变成了单个 `Wish Willow`）。
- 回执为 **`application: restart-required`** 时，Host 侧新 row 需要**重启 DSH** 才生效（本次真实 Desktop 即属此情形：入口已统一，但面板调用会在重启前报「操作失败…」）。
- 重启后请执行 §5 的校验。

---

## 4. 回退（统一 Bundle → 双 Bundle）

```text
plugin_manager.remove_bundle  target=dsh-wish-willow
plugin_manager.install_bundle target=<绝对路径>\artifacts\dsh-wish-willow-0.1.0-p0.1.tgz
plugin_manager.install_bundle target=<绝对路径>\artifacts\dsh-wish-willow-p1-0.2.0-p1.1.tgz
plugin_manager.list_bundles   # 确认两个旧 Bundle 回归且 enabled
# 重启 DSH
```

- 旧的两个 tgz 保留在 `artifacts/`（含 SHA256 见 `artifacts/BUILD-INFO.json`），源码仍在仓库内 `packages/p1/`（冻结未改动）。
- 若 profile 清单需人工恢复：把 §2 备份的 `package.json` 覆盖回去，然后 `pnpm install`（Desktop profile 由官方 `plugin_manager` 管理，优先用官方操作而不是手改清单）。
- **回退同样不改动产品数据**：回退后 P0 页面与 P1 页面会重新出现，历史项目与 Release 全部可读。
- 回退后不要再安装统一 Bundle（两者不可共存）。

---

## 5. 升级后校验（建议逐条执行）

```powershell
$n = 'node'   # 或用 DSH 自带 node
# 1) 只剩一个 Wish Willow Bundle，且版本为 0.3.1
Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\package.json"
(Get-Content "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-wish-willow\package.json" -Raw | ConvertFrom-Json).version

# 2) 产品数据字节未变
(Get-FileHash "$env:USERPROFILE\.dsh\storages\wish_willow.json"    -Algorithm SHA256).Hash.ToLower()
(Get-FileHash "$env:USERPROFILE\.dsh\storages\wish_willow_p1.json" -Algorithm SHA256).Hash.ToLower()

# 3) 一致性自检（仓库内）
node scripts/check.mjs

# 4) 界面：设置里只应看到一个 “Wish Willow”；打开后能看到升级前的产品
#    （旧 P0 产品在「旧版 P0 产品」区，可直接编辑或点“导入到统一产品”）
```

期望结果：步骤 1 显示 `["…","@deepseek-ai/dsh-experimental-agent-team-profile","dsh-codex-connect","dsh-wish-willow"]` 且版本 `0.3.1`；步骤 2 与升级前完全相同；步骤 4 中产品与版本历史完整。

---

## 6. 安装失败 / 异常恢复

| 现象 | 含义 | 处理 |
|---|---|---|
| pnpm 报 peer 依赖告警 | 与本插件无关的既有告警 | 忽略；`peerDependencies` 均为 optional |
| 安装后设置里出现两个 Wish Willow | 旧 Bundle 未移除 | 执行 §3.1 顺序：先 `remove_bundle dsh-wish-willow-p1` 再安装 |
| 面板显示「操作失败；草稿已保留。请检查连接或插件状态后重试。」 | Host row 尚未生效（`restart-required`） | 重启 DSH |
| 面板显示「此产品已被其他页面修改…」 | 同一产品被两个页面并发修改（CAS 保护生效） | 点「重新读取」，草稿会保留 |
| 启动时报 domain 版本不匹配 / malformed-medium | 存储文件被外部改动或损坏 | **不要**删除文件；先备份，再按 `docs/P1-STATE-COMPATIBILITY.md` 处理 |
| 需要彻底回退 | — | 按 §4 |

---

## 7. 已知限制

1. 统一 Bundle 与旧 companion Bundle **不可同时安装**（重复 Service/重复页面）。
2. **同一存储 root 只允许一个写入 Host**：JSON 后端没有跨进程写锁；Desktop 与 Web 若指向同一 `$DSH_HOME`，不要同时运行。
3. 迁移**不会**把 P0 产品自动并入统一状态：必须由用户在界面上显式「导入到统一产品」（按 UUID 幂等）。
4. 暂不支持从更高版本 schema 回退到旧 Bundle；旧 Bundle 只能读它当初写入的 v1 schema。
5. Windows 沙箱要求工作目录授予当前用户 WRITE_OWNER（用户 profile 下的默认目录满足；若把 `$DSH_HOME` 放在受限目录，`wish_verify` 会在执行前失败并给出 `grantWrite(...)` 报错——这是环境限制而非产品缺陷，验证失败会被如实记录）。
