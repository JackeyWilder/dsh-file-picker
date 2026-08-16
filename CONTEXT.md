# CONTEXT

dsh-file-picker —— dsh web（DeepSeek Harness，本机 http://127.0.0.1:3080）插件：
composer 工具行 📎 → 原生 Windows 文件对话框（多选、记住上次目录）→ 选中文件以卡片 rail
显示在输入框上方 → 发送时宿主把路径注入会话上下文，agent 用 read 读取。

## 项目定位

- 面向公众：npm `@jackeywilder/dsh-file-picker` + GitHub `JackeyWilder/dsh-file-picker` 均为公开；
- 硬性产品约束：文件路径绝不写进草稿/消息文本；卡片 rail 由主 composer 发送触发（插件不设独立发送按钮）；无 sidecar 残留。

## 架构速览

- dual-face：宿主侧 Node（`src/host/*`，ESM → `lib/index.js`）+ 浏览器侧（`src/client/*`，CJS 闭包 → `lib/client.js`）；
- slot 注入经 `cordis.patch.yml` 声明（`conversation.input.left` + `conversation.input.dock`，LooseSlots 降级写法）；
- 注入管线：`agent/inbox/inserted` 事件 + `agent.inject(createUserMessage(...))`，session 以 `agent.id` 为 key（见 docs/adr/0002）；
- 对话框：WinForms `OpenFileDialog` + 透明 TopMost owner + 卡死超时（见 docs/adr/0001）；
- 隐私：日志默认脱敏，`DSH_FILE_PICKER_DEBUG=1` 才输出完整路径（见 docs/adr/0003）。

## 环境事实

- PowerShell 一律 pwsh 7（`C:\Program Files\PowerShell\7\pwsh.exe`），禁止 Windows PowerShell 5.1；
- 插件经 `link:` 安装：改 `lib/` 重建即生效（宿主重启加载），浏览器端旧 bundle 需 Ctrl+Shift+R；
- 运行日志 `~/.dsh/logs/dsh-file-picker.log`（1MB 轮转）；dsh 主 shell 日志 `~/.dsh/dsh-launcher/shell.log`；
- 仓库无 tsconfig.json：类型正确性靠测试 + 构建 + review 兜底（tsdown 只转译不检查类型）。
- 授权边界：审批策略 never + 文件 full-access → 护栏内建于 docs/agents/authorization.md（破坏性 / 工作区外写改需汇报四要素并获同意）。
- 开发流：`main` 受分支保护（禁直推 + CI `build-test` 须绿），改动走 `feature/*` 分支 + PR 合入；发布仍走 `v*` tag（publish.yml 校验 tag==version）。