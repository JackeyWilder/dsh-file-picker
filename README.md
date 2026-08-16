# dsh-file-picker

为 dsh web 添加"选择工作区外文件"入口：输入框工具行按钮 → 原生 Windows 文件对话框（任意目录、多选）→ 选中文件在输入框上方形成附件卡片条；发送时由宿主注入上下文消息（绝对路径清单），agent 用 read 工具读取。

> ⚠️ **平台**：文件对话框基于 PowerShell 7（`pwsh`）+ Windows Forms，当前仅支持 **Windows**（需要系统已安装 PowerShell 7）。
> ⚠️ **兼容性**：依赖 dsh 的 `agent.inject` / `agent/inbox/inserted` 等半公开接口，按 **dsh rc.6（2026-08）** 验证。dsh 升级后如有异常，请用 [诊断](#诊断) 一节自检。

## 安装

```bash
# 方式一：npm 包
dsh plugin --profile web add @jackeywilder/dsh-file-picker

# 方式二：本地 link（开发）
dsh plugin --profile web add link:"<本包路径>"
```

## 使用

1. 点击输入框工具行的 📎 按钮；
2. Windows 原生文件对话框弹出，浏览并多选文件（对话框记住上次所选目录）；
3. 点"打开"——输入框上方出现附件卡片条（📄/📁 图标 + 文件名 + 所在目录 + × 移除），提示"随下一条消息发送"；
4. 用主输入框正常发送消息——宿主检测到消息进入会话（`agent/inbox/inserted`）后，先把所选文件的绝对路径清单注入当前会话上下文，消息随即送达；发送成功后卡片条清空（覆盖打字发送、斜杠命令、steer 等所有发送路径）；
5. 对话中出现 "Context injection" 上下文行（附加了文件，请按需读取 + 绝对路径清单），agent 按其中的路径用 read 工具读取文件内容。

## 诊断

- 宿主日志：`<DSH_HOME>/logs/dsh-file-picker.log`（默认 `C:\Users\<你>\.dsh\logs\`），记录启动 / 暂存 / 消息进入 / 注入全链路，超过 1 MB 自动轮转为 `.log.1`；可随时安全删除。
- 状态路由：`GET http://localhost:<dsh端口>/api/dsh-file-picker/status` 返回插件版本与当前暂存清单。
- 日志中如果 `inbox/inserted ... session=undefined`，说明宿主加载的是旧 bundle——请完全退出 dsh 后重启。

## 开发

```bash
pnpm install && pnpm build
npx vitest run
```

## 同类插件对比

| 插件 | 机制 | 与本案差异 |
|---|---|---|
| [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker) | 原生对话框选任意文件 → 附件卡片 → 发送时注入路径 | 走 `Agent.inject` + `$DSH_HOME/uploads/attach-<sessionId>.txt` **sidecar 文件**中转；本插件路径由浏览器直接 POST 到宿主暂存（无 sidecar 残留） |
| [omdsh-dev/dsh-at-file](https://github.com/omdsh-dev/dsh-at-file) | 输入框 `@` 搜索**工作区内**文件，`<workspace-reference>` 引用进消息 | 只支持工作区内文件；本插件支持工作区外任意磁盘文件（Windows 原生对话框） |
| [omdsh-dev/dsh-drag-and-drop](https://github.com/omdsh-dev/dsh-drag-and-drop) | 拖拽文件 → 路径定位引擎还原真实路径插入输入框 | 路径进草稿文本；本插件路径不进草稿、不进消息文本，以宿主注入的上下文消息送达 |

## 致谢

- [lostpaidaxing/dsh-file-picker](https://github.com/lostpaidaxing/dsh-file-picker)：附件卡片条交互模型（图标 + 文件名 + × 移除）。
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `dsh-ssh`：loopback 信任栅栏（`isLoopbackRequest`）实现范式。

## 安全

宿主侧路由仅接受 loopback 请求（`isLoopbackRequest` 校验 remoteAddress/Host/sec-fetch-site/Origin）；只提供只读原生文件选择能力，不读文件内容、不写文件。选择过程不留 sidecar 残留：pwsh 以 `-EncodedCommand` 内联执行对话框脚本，不落临时脚本文件，对话框关闭后进程即被终止。

**隐私**：选中的文件路径会写入上述诊断日志（含用户名等路径信息），且注入到会话上下文后 agent 可读取。请勿用于机密文件，或自行删除日志。
