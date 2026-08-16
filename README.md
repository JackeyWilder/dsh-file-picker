# dsh-file-picker — 选择工作区外文件，随消息注入路径

[![Release v0.1.0](https://img.shields.io/badge/release-v0.1.0-5B4CF0?style=flat-square)](https://github.com/JackeyWilder/dsh-file-picker/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-0B7285?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)
[![DSH profiles](https://img.shields.io/badge/DSH-Web-5B4CF0?style=flat-square)](cordis.patch.yml)

**安装：** `dsh plugin --profile web add @jackeywilder/dsh-file-picker`

**DeepSeek Harness Web UI 插件：点击 📎 用原生 Windows 对话框选择任意磁盘文件（含工作区之外），路径以 "Context injection" 上下文消息随你的下一条消息注入会话，agent 用现有 `read` 工具按路径读取——路径不进草稿、不进消息文本，文件绝不离开本机。**

[English](README.en.md) | [中文](README.md)

## 为什么需要这个插件

DSH 的 `read` 工具对**绝对路径没有沙箱限制**——agent 技术上可以读工作区外任意文件（`G:\Dev\backend\Club\...` 这类治理文档）。但 dsh web 缺一个把路径快速送进会话的 UI 入口：

- 输入框的"加号"已被图片附件管线占用（`dsh-attachment` 仅支持图片），不能复用来挂文件入口；
- 手动粘贴完整路径容易出错，长路径尤其如此；
- 拖拽方案在浏览器里拿不到真实路径（浏览器出于安全只暴露本地 URI，且经常什么都不给）。

本插件补上这个入口：原生文件对话框 → 附件卡片 → 发送时由宿主把绝对路径清单注入会话上下文，agent 用现有 `read` 工具读取。**文件从不离开它的目录**——不读取、不上传、不复制、不移动。

## ✨ 功能特性

- **📎 一键选择**：输入框工具行新增 📎 按钮，点击弹出 Windows 原生文件对话框。
- **📂 任意目录**：可浏览并选择**工作区之外**任意磁盘位置的文件，一次多选。
- **🎴 附件卡片条**：每个文件显示图标 + 文件名 + 所在目录，可 × 单独移除；移除即同步取消暂存，无残留。
- **🧹 输入框干净**：路径**不写入草稿、不进消息文本**——与"把路径粘进输入框"类方案的本质区别。
- **📨 随消息送达**：路径以 "Context injection" 上下文消息注入，与下一条消息**同一轮**进入模型上下文，覆盖打字发送、斜杠命令、steer、纯图片等所有发送路径。
- **📖 agent 按路径读取**：agent 在上下文中看到绝对路径清单，用现有 `read` 工具读取内容。
- **🔒 本机处理**：路径仅在本机宿主进程流转（loopback-only），不经任何外部网络。

## 环境要求

| 项 | 要求 |
|---|---|
| dsh | `0.1.0-rc.x`（在 `0.1.0-rc.6` 上验证），`web` profile |
| 操作系统 | **Windows**（原生对话框基于 PowerShell 7 + WinForms） |
| PowerShell | `pwsh` 7.x 在 PATH 中 |
| 运行时依赖 | `@deepseek-ai/cordis`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-*`、`react`——均为 peerDependencies，由 dsh 宿主提供，无需手动安装 |

## 安装

插件是一个 dsh **bundle**（`package.json` 声明 `dsh.bundle` + `dsh.client`），用标准 `dsh plugin` 机制安装到 `web` profile——**无需修改 DSH 源码，无需 config.yaml**：

```sh
dsh plugin --profile web add @jackeywilder/dsh-file-picker
# 或 GitHub 仓库：
dsh plugin --profile web add git+https://github.com/JackeyWilder/dsh-file-picker.git
# 或本地 checkout（开发调试）：
dsh plugin --profile web add link:"<本包路径>"
```

安装后**完全退出 dsh（launcher / 托盘 / web 进程）再重启**，然后硬刷新浏览器（Ctrl+Shift+R）一次——client bundle 只在插件进入浏览器启动清单（`__DSH_BOOT__`）后的新页面加载时生效。

### 升级

```sh
dsh plugin --profile web update @jackeywilder/dsh-file-picker
```

本地 link 安装：对替换后的 checkout 重新执行 `add`。

### 卸载

```sh
dsh plugin --profile web remove @jackeywilder/dsh-file-picker
```

卸载后重启 Web UI 并硬刷新浏览器。

## 使用

1. 点击输入框工具行的 **📎** 按钮；
2. Windows 原生文件对话框弹出，浏览并多选文件（对话框记住上次所选目录，下次打开定位到该目录）；
3. 点"打开"——输入框上方出现**附件卡片条**（📄/📁/🖼️/🗜️ 图标 + 文件名 + 所在目录 + × 移除），并提示"随下一条消息发送"；
4. 用主输入框**正常发送消息**——宿主检测到消息进入会话后，先把所选文件的绝对路径清单注入当前会话上下文，消息随即送达；发送成功后卡片条自动清空；
5. 对话中出现 **"Context injection"** 上下文行（附加了文件，请按需读取 + 绝对路径清单），agent 按其中的路径用 `read` 工具读取文件内容并执行你的指令。

## 工作原理

### 宿主侧（Node 进程）

1. **路由**：`POST /api/dsh-file-picker/native-pick`（spawn pwsh 弹原生对话框）、`POST /api/dsh-file-picker/stage`（暂存/覆盖文件清单）、`POST /api/dsh-file-picker/unstage`（清空暂存）、`GET /api/dsh-file-picker/status`（诊断）。
2. **发送信号**：监听 agent 作用域事件 **`agent/inbox/inserted`**——一条真实用户消息（`source.kind === 'user'`）进入该会话 inbox，即"发送被接受"的可靠信号，覆盖所有发送路径。
3. **注入**：`agent.inject(createUserMessage({ source: { kind: 'plugin', plugin: 'dsh-file-picker', form: 'notice', summary }, content: [路径清单] }))`——把路径排入同一轮的 pre-step 模型上下文，与刚发出的消息同时到达。

### 浏览器侧（dsh web）

1. **入口**：`conversation.input.left` 插槽注册 📎 按钮（`FilePickerButton`），点击调 `/native-pick`。
2. **卡片条**：`conversation.input.dock` 插槽注册附件卡片（`AttachmentRail`），用 `useSyncExternalStore` 管理卡片状态；卡片增删时把当前清单**同步**到宿主 `/stage` / `/unstage`，宿主始终镜像用户所见。
3. **自动清空**：用 framework 标准 `useSession` 监听会话节点数增长——消息落地后（宿主已注入）自动清空卡片，避免同一批文件被第二条消息重复发送。

### 文件路径如何到达模型

```
选择文件 ──POST /stage──▶ 宿主暂存表（不进草稿、不进消息文本）
用户发送 ──────────────▶ agent/inbox/inserted (kind=user)
                              │ 宿主查暂存表命中
                              ▼
                   agent.inject(路径清单上下文消息)
                              ▼
                  agent 在模型上下文看到绝对路径
                              ▼
                    read 工具读取文件内容
```

## 故障排查

| 症状 | 解决方案 |
| --- | --- |
| 发送后无 "Context injection" 行，但日志有 `injected N file(s)` | 浏览器缓存了旧 client bundle——硬刷新（Ctrl+Shift+R）后再试 |
| 日志出现 `inbox/inserted ... session=undefined` | 宿主加载的是旧 bundle——完全退出 dsh（含 launcher/托盘）后重启 |
| 卡片条不出现 | 确认 bundle 在 profile（`dsh --profile web --dump-config \| grep dsh-file-picker`），安装后重启 Web UI + 硬刷新 |
| 对话框不弹出 / 一直转圈 | `pwsh` 不在 PATH 或版本过旧——确认 pwsh 7.x 可用；重启 dsh 后再试 |
| 日志不显示完整路径 | 预期行为：默认脱敏（隐私默认），设环境变量 `DSH_FILE_PICKER_DEBUG=1` 记录完整路径 |
| 多选出现多个相同卡片 | 0.1.0 已修复的旧版 bug——升级插件并重启 |
| 插件安装后未加载 | 重启 Web UI 并硬刷新——client bundle 只在插件进入 `__DSH_BOOT__` 的新页面加载时生效 |

## 已知限制

- **仅 Windows**：原生对话框基于 pwsh + WinForms，无 macOS/Linux 支持（欢迎 PR，见[平台说明](#平台说明)）。
- **暂不支持拖拽**：当前只能通过 📎 按钮选择；与 dsh-drag-and-drop 类插件不冲突、可共存。
- **卡片条在输入框上方**：dsh 没有输入框内部附件插槽，卡片渲染于 `conversation.input.dock`。
- **依赖半公开接口**：`agent.inject` / `agent/inbox/inserted` 属 dsh 半公开能力，dsh 升级后可能变化，升级后用[故障排查](#故障排查)自检。

## 开发与验证

```sh
pnpm install
pnpm build      # 双入口：lib/index.js（宿主 ESM）+ lib/client.js（浏览器 CJS 闭包）
npx vitest run  # 测试
npx tsc --noEmit # 类型检查
```

仓库布局：

- `src/` — 宿主（Node）半：原生对话框（pwsh spawn）、stage/unstage/status 路由、loopback 信任栅栏、inbox-inserted 注入
- `src/client/` — 浏览器半：📎 按钮、附件卡片条（`useSyncExternalStore`）、会话节点监听清卡
- `tests/` — vitest 套件：卡片 store、路径脱敏、注入文本、fence、pwsh 脚本与输出解析（全部 mock，无需真实 pwsh）
- `lib/` — 构建产物，**不提交**（CI 构建；dsh 通过 npm/GitHub 安装时由发布包提供）

## 安全

- **信任栅栏**：宿主侧所有路由仅接受 loopback 请求（`isLoopbackRequest` 校验 remoteAddress / Host / sec-fetch-site / Origin，参照 dsh-ssh 实现范式）。
- **只读能力**：只提供原生文件**选择**，不读文件内容、不写文件；内容由 agent 用现有 `read` 工具读取。
- **无 sidecar 残留**：pwsh 以 `-EncodedCommand`（UTF-16LE Base64）内联执行对话框脚本，不落临时脚本文件；对话框关闭后进程即被终止（resolve-on-output + kill）。
- **注入面已封**：`initialDir` 单引号转义 + `Test-Path -LiteralPath`，无注入向量。

## 隐私与文件访问

插件**从不**：

- 上传文件
- 复制文件
- 移动文件
- 修改文件
- 删除文件
- 离开本机传输路径数据

数据流：浏览器把选中路径 POST 到**本地宿主进程**（`127.0.0.1`，loopback-only）→ 宿主暂存 → 消息进 inbox 时 `agent.inject` 注入 → agent 用 `read` 读取。路径注入会话上下文后 **agent 可见并可读取文件内容**——这是功能本质，请勿附加机密文件。

诊断日志（`<DSH_HOME>/logs/dsh-file-picker.log`，默认 `C:\Users\<你>\.dsh\logs\`）默认**只记录脱敏路径**（盘符 + `...` + 文件名，如 `G:\...\README.md`）；设 `DSH_FILE_PICKER_DEBUG=1` 才记录完整路径。日志超 1 MB 自动轮转为 `.log.1`，可随时删除。

## 平台说明

### Windows

✅ 支持。原生文件对话框（PowerShell 7 + WinForms），任意目录、多选、记住上次目录。无需额外安装（系统已有 pwsh 即可）。

### macOS

❌ 暂不支持。原生对话框基于 Windows Forms，macOS 无对应实现。欢迎 PR（可参考 dsh-at-file / chituai 的 osascript 方案）。

### Linux

❌ 暂不支持。同上，原生对话框无 Linux 实现。欢迎 PR（可参考 chituai 的 zenity 方案）。

## 同类插件对比

| 插件 | 机制 | 与本案差异 |
|---|---|---|
| [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker) | 原生对话框选任意文件 → 附件卡片 → 发送时注入路径 | 走 `Agent.inject` + `$DSH_HOME/uploads/attach-<sessionId>.txt` **sidecar 文件**中转；本插件路径由浏览器直接 POST 到宿主暂存（无 sidecar 残留，自动清卡） |
| [omdsh-dev/dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | 输入框 `@` 搜索**工作区内**文件，`<workspace-reference>` 引用进消息 | 只支持工作区内文件；本插件支持工作区外任意磁盘文件（Windows 原生对话框） |
| [omdsh-dev/dsh-drag-and-drop](https://github.com/omdsh-dev/dsh-drag-and-drop) | 拖拽文件 → 路径定位引擎还原真实路径插入输入框 | 路径进草稿文本；本插件路径不进草稿、不进消息文本，以宿主注入的上下文消息送达 |

## 社区

- 使用 [GitHub Issues](https://github.com/JackeyWilder/dsh-file-picker/issues) 报告可复现的 bug、功能请求与使用问题。

## 致谢

- [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker)：附件卡片条交互模型（图标 + 文件名 + × 移除）。
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `dsh-ssh`：loopback 信任栅栏（`isLoopbackRequest`）实现范式。

## License

[MIT](https://opensource.org/licenses/MIT) © 2026 JackeyWilder
