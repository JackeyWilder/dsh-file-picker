# dsh-file-picker

> DeepSeek Harness (DSH) Web GUI 插件：为 dsh web 添加"选择工作区外文件"能力——输入框工具行 📎 按钮 → 原生 Windows 文件对话框（任意目录、多选）→ 输入框上方附件卡片条 → 发送时由宿主把绝对路径清单注入会话上下文 → agent 用现有 `read` 工具按路径读取。

> ⚠️ **平台**：文件对话框基于 PowerShell 7（`pwsh`）+ Windows Forms，当前仅支持 **Windows**（需要系统已安装 PowerShell 7）。
> ⚠️ **兼容性**：依赖 dsh 的 `agent.inject` / `agent/inbox/inserted` 等半公开接口，按 **dsh rc.6（2026-08）** 验证。dsh 升级后如有异常，请用 [诊断](#诊断) 一节自检。

---

## ✨ 功能特性

- **📎 一键选择**：输入框工具行新增 📎 按钮，点击弹出 Windows 原生文件对话框（不用在输入框手打路径）。
- **📂 任意目录**：可浏览并选择**工作区之外**任意磁盘位置的文件——`read` 工具对绝对路径无沙箱限制，agent 读任意路径技术上可行，本插件补上缺失的 UI 入口。
- **🗂️ 多选支持**：一次选择多个文件，全部进入附件卡片条，随同一条消息送达。
- **🎴 附件卡片条**：每个文件显示图标 + 文件名 + 所在目录，可 × 单独移除；移除即同步取消暂存，不会残留。
- **🧹 输入框干净**：文件路径**不写入草稿、不进消息文本**，输入框内容完全不受影响——这是与"把路径粘进输入框"类方案的本质区别。
- **📨 随消息送达**：路径以 "Context injection" 上下文消息注入，与你的下一条消息**同一轮**进入模型上下文，覆盖打字发送、斜杠命令、steer 等所有发送路径。
- **📖 agent 按路径读取**：agent 在上下文中看到绝对路径清单，用现有 `read` 工具读取文件内容——插件本身不读取、不上传文件内容。

## 环境要求

| 项 | 要求 |
|---|---|
| dsh | `0.1.0-rc.x`（在 `0.1.0-rc.6` 上验证），`web` profile |
| 操作系统 | **Windows**（原生对话框基于 PowerShell 7 + WinForms） |
| PowerShell | `pwsh` 7.x 在 PATH 中（`dsh --version` 同环境的 pwsh 即可） |
| 运行时依赖 | `@deepseek-ai/cordis`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-*`、`react`——均为 peerDependencies，由 dsh 宿主提供，无需手动安装 |

## 安装

```bash
# 方式一：npm 包（推荐）
dsh plugin --profile web add @jackeywilder/dsh-file-picker

# 方式二：GitHub 仓库
dsh plugin --profile web add git+https://github.com/JackeyWilder/dsh-file-picker.git

# 方式三：本地 link（开发调试）
dsh plugin --profile web add link:"<本包路径>"
```

> 安装后**完全退出 dsh（含 launcher / 托盘 / web 进程）再重启**，确保宿主与浏览器加载新 bundle；浏览器必要时硬刷新（Ctrl+Shift+R）一次。

## 使用

1. 点击输入框工具行的 **📎** 按钮；
2. Windows 原生文件对话框弹出，浏览并多选文件（对话框记住上次所选目录，下次打开定位到该目录）；
3. 点"打开"——输入框上方出现**附件卡片条**（📄/📁/🖼️/🗜️ 图标 + 文件名 + 所在目录 + × 移除），并提示"随下一条消息发送"；
4. 用主输入框**正常发送消息**——宿主检测到消息进入会话后，先把所选文件的绝对路径清单注入当前会话上下文，消息随即送达；发送成功后卡片条自动清空；
5. 对话中出现 **"Context injection"** 上下文行（附加了文件，请按需读取 + 绝对路径清单），agent 按其中的路径用 `read` 工具读取文件内容并执行你的指令。

## 工作原理

### 宿主侧（Node 进程）

- **路由**：`POST /api/dsh-file-picker/native-pick`（spawn pwsh 弹原生对话框）、`POST /api/dsh-file-picker/stage`（暂存/覆盖文件清单）、`POST /api/dsh-file-picker/unstage`（清空暂存）、`GET /api/dsh-file-picker/status`（诊断）。
- **发送信号**：监听 agent 作用域事件 **`agent/inbox/inserted`**——当一条真实用户消息（`source.kind === 'user'`）进入该会话 inbox，即"发送被接受"的可靠信号（覆盖打字/slash/steer/纯图片所有路径）。
- **注入**：`agent.inject(createUserMessage({ source: { kind: 'plugin', plugin: 'dsh-file-picker', form: 'notice', summary }, content: [路径清单] }))`——把路径排入同一轮的 pre-step 模型上下文，与刚发出的消息同时到达。

### 浏览器侧（dsh web）

- **入口**：`conversation.input.left` 插槽注册 📎 按钮（`FilePickerButton`），点击调 `/native-pick`。
- **卡片条**：`conversation.input.dock` 插槽注册附件卡片（`AttachmentRail`），用 `useSyncExternalStore` 管理卡片状态；卡片增删时把当前清单**同步**到宿主 `/stage`（新增）或 `/unstage`（清空），宿主始终镜像用户所见。
- **自动清空**：用 framework 标准 `useSession` 监听会话节点数增长——消息落地后（宿主已注入）自动清空卡片，避免同一批文件被第二条消息重复发送。

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

## 诊断

- **宿主日志**：`<DSH_HOME>/logs/dsh-file-picker.log`（默认 `C:\Users\<你>\.dsh\logs\`），记录启动 / 暂存 / 消息进入 / 注入全链路；超过 1 MB 自动轮转为 `.log.1`；可随时安全删除。
- **状态路由**：`GET http://localhost:<dsh端口>/api/dsh-file-picker/status` 返回插件版本与当前暂存清单。
- **常见问题**：
  - 日志出现 `inbox/inserted ... session=undefined` → 宿主加载的是旧 bundle，请完全退出 dsh 后重启。
  - 日志出现 `injected N file(s)` 但对话无 "Context injection" 行 → 浏览器缓存了旧 client bundle，硬刷新后再试。
  - 完整路径不显示 → 默认日志已脱敏（隐私默认），设 `DSH_FILE_PICKER_DEBUG=1` 记录完整路径。

## 已知限制

- **仅 Windows**：原生对话框基于 pwsh + WinForms，无 macOS/Linux 支持（欢迎 PR）。
- **暂不支持拖拽**：当前只能通过 📎 按钮选择，与 dsh-drag-and-drop 类插件不冲突、可共存。
- **卡片条在输入框上方**：dsh 没有输入框内部附件插槽，卡片渲染于 `conversation.input.dock`。
- **依赖半公开接口**：`agent.inject` / `agent/inbox/inserted` 属 dsh 半公开能力，dsh 升级后可能变化，升级后用[诊断](#诊断)自检。

## 开发

```bash
pnpm install && pnpm build
npx vitest run
```

- 双入口构建：宿主侧 `lib/index.js`（ESM）+ 浏览器侧 `lib/client.js`（CJS 闭包，`__ModuleLoader__.load` 包裹）。
- `pnpm watch` 增量构建；改完重启 dsh 验证。
- 测试：`tests/` 覆盖卡片 store、路径脱敏、注入文本、fence、pwsh 脚本与输出解析（全部 mock，无需真实 pwsh）。

## 安全

- **信任栅栏**：宿主侧所有路由仅接受 loopback 请求（`isLoopbackRequest` 校验 remoteAddress / Host / sec-fetch-site / Origin，参照 dsh-ssh 实现范式）。
- **只读能力**：只提供原生文件**选择**，不读文件内容、不写文件；内容由 agent 用现有 `read` 工具读取。
- **无 sidecar 残留**：pwsh 以 `-EncodedCommand`（UTF-16LE Base64）内联执行对话框脚本，不落临时脚本文件；对话框关闭后进程即被终止（resolve-on-output + kill）。
- **路径注入面已封**：`initialDir` 单引号转义 + `Test-Path -LiteralPath`，无注入向量。

## 隐私与数据流

- 选中文件的路径**仅在本机处理**：浏览器 POST 到本地宿主进程（`127.0.0.1`，loopback-only），不经任何外部网络；插件不读取、不上传文件内容。
- 路径注入会话上下文后，**agent 可见并可读取文件内容**——这是功能本质（agent 需要路径才能读取），请勿附加机密文件。
- 诊断日志默认**只记录脱敏路径**（盘符 + `...` + 文件名，如 `G:\...\README.md`）；设置环境变量 `DSH_FILE_PICKER_DEBUG=1` 才记录完整路径。日志 1 MB 自动轮转，可随时删除。

## 同类插件对比

| 插件 | 机制 | 与本案差异 |
|---|---|---|
| [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker) | 原生对话框选任意文件 → 附件卡片 → 发送时注入路径 | 走 `Agent.inject` + `$DSH_HOME/uploads/attach-<sessionId>.txt` **sidecar 文件**中转；本插件路径由浏览器直接 POST 到宿主暂存（无 sidecar 残留，自动清卡） |
| [omdsh-dev/dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | 输入框 `@` 搜索**工作区内**文件，`<workspace-reference>` 引用进消息 | 只支持工作区内文件；本插件支持工作区外任意磁盘文件（Windows 原生对话框） |
| [omdsh-dev/dsh-drag-and-drop](https://github.com/omdsh-dev/dsh-drag-and-drop) | 拖拽文件 → 路径定位引擎还原真实路径插入输入框 | 路径进草稿文本；本插件路径不进草稿、不进消息文本，以宿主注入的上下文消息送达 |

## 致谢

- [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker)：附件卡片条交互模型（图标 + 文件名 + × 移除）。
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `dsh-ssh`：loopback 信任栅栏（`isLoopbackRequest`）实现范式。

## License

[MIT](https://opensource.org/licenses/MIT) © 2026 JackeyWilder
