# Handbook —— 踩坑全集与代码地图

> 由交接文档（2026-08-17）固化而来；沿用脱敏写法，真实路径一律显示为 `G:\...`。

## 1. 踩坑全集（坑 → 症状 → 修复）

1. **对话框被压到前台窗口后面（最严重）**：dsh 服务 spawn 的 pwsh 无前台激活权限，Windows 前台锁把模态对话框开在其它窗口之后——可见但点不到 → `ShowDialog()` 永久阻塞 → `runNativePicker` promise 永不 resolve → 📎 永久 disabled，整个插件失效。
   修复：脚本内建透明 TopMost owner（`Opacity=0`、1x1、`Location=(-32000,-32000)`、`ShowInTaskbar=$false`）→ `ShowDialog($owner)`；另加 `PICKER_STUCK_TIMEOUT_MS = 10min` 超时兜底，超时 kill 子进程并按取消处理。
2. **explorer 定位不生效 + 不置顶（2026-08-17 实测定案）**：
   - 直传 `spawn('explorer', ['/select,"<path>"'])`：Node libuv 把含空格 + 内部引号的 argv 拼成 `"/select,\"...\""`（内部引号转义为 `\"`），explorer 不认 → 进程启动但**无窗口、空转残留**（可堆到 10+）。
   - `shell:true` 经 cmd 原样传引号：窗口能弹出，但 Windows 前台锁把它压在后台。
   - 最终方案：spawn pwsh（`-EncodedCommand`，与 picker 同构）执行 `Start-Process explorer.exe -ArgumentList '/select,"<path>"'`（引号原样到达），轮询 `Get-Process explorer` 匹配 `MainWindowTitle.Contains(<父目录>)`——**explorer 窗口标题只含父目录路径 + " - 文件资源管理器"，永远不含文件名**，按文件名匹配必失败；随后 `ShowWindow(SW_RESTORE)` + `keybd_event` ALT 注入 + `SetForegroundWindow` 解锁前台。脚本内自验：SetForegroundWindow 后 300ms 前台即 explorer。
   - 注意：用户随后手动点击其它窗口会把前台带走——Windows 前台锁的正确语义，不算故障。
3. **`agent.sessionId` 是 undefined**：Agent 接口字段是 `id`。用 `agent.id` 做 session key。
4. **pwsh 7 不能 cast `__ComObject` 到自定义 `[ComImport]` 接口**：COM 逻辑必须放进 `Add-Type` 的 C# static method（如 `FpPicker.Show()`）。
5. **IFileDialog vtable 计数错误导致 AccessViolationException**：IFileDialog 有 23 个方法（无 `GetFileTypeCount`），多写一个 slot 全偏移。
6. **IFileOpenDialog 正确 IID**：`D57C7288-D4AD-4768-BE02-9D969532D960`（候选 GUID 全 E_NOINTERFACE；该路线已放弃，记录备查）。
7. **pwsh 非交互 stdout 乱码**：`-EncodedCommand` 走系统 ANSI 代码页（zh-CN=GBK）。脚本首行必须 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`；spawn 后 `stdout.setEncoding('utf8')`。
8. **pwsh 首个 UI 元素不显示**：必须 `[System.Windows.Forms.Application]::EnableVisualStyles()`，否则 OpenFileDialog 阻塞且无窗口。
9. **对话框回退旧式扁平列表**：显式 `$d.AutoUpgradeEnabled = $true`。
10. **pwsh 退出竞态**：对话框关闭后 pwsh 可能在 WinForms 消息泵上滞留——`runNativePicker` 用"首个完整输出行即 resolve + `child.kill()`"，不等待自然退出。
11. **浏览器缓存旧 bundle**：宿主跑新版本但 UI 还是旧的 → 提示用户 Ctrl+Shift+R；调 client 时记得 `lib/client.js` 重建。
12. **测试断言陷阱**：`not.toContain('0x20')` 会误匹配 `0x200` 前缀 → 用 `'| 0x20)'` 这类精确片段。
13. **残留 pwsh 进程拖慢系统**：调试 spawn 残留会堆积，注意清理（`Get-Process pwsh | Stop-Process`）。
14. **tsdown 只转译不类型检查**：`pnpm build` 通过 ≠ 类型正确；仓库无 tsconfig.json，类型正确性靠测试 + 构建 + 仔细 review。
15. **git push 偶发瞬时失败**（SSH 握手/权限误报）：重试一次即可，勿当成真失败。
16. **pwsh 7 默认 STA**（不是 MTA）——WinForms 依赖这一点，别用 `-STA` 之外的东西画蛇添足。

## 2. 代码地图

- `src/host/index.ts`：routes `/native-pick`、`/stage`、`/unstage`、`/reveal`、`/status`（loopback 防护）+ `agent/inbox/inserted` 监听注入。
- `src/host/native-pick.ts`：`buildPickerScript`（WinForms + TopMost owner）、`parsePickerOutput`、`runNativePicker`（含超时）。
- `src/host/reveal.ts`：`revealPath`（引号包裹，坑 2）。
- `src/host/log.ts`：`hostLog` / `redactPath` / `redactList` / `PLUGIN_VERSION`（运行时读 `../package.json`）、`DSH_FILE_PICKER_DEBUG`。
- `src/client/FilePickerButton.tsx`（📎）、`AttachmentRail.tsx`（dock 卡片）、`rail.ts`（store）、`api.ts`（fetch 封装）、`index.ts`（slot 注册：`conversation.input.left` + `conversation.input.dock`，LooseSlots 降级写法）。
- `tests/*`：9 个 spec 共 54 测试；host 侧 spawn 类用 `vi.mock('node:child_process')`。
- `tsdown.config.ts`：宿主 ESM `lib/index.js`；浏览器 CJS `lib/client.js` + `__ModuleLoader__.load` banner。
- `.github/workflows/ci.yml` + `publish.yml`（v* tag 触发、校验 tag==version、NPM_TOKEN）。
- `README.md` / `README.en.md`：dnd 风格，含隐私说明（绝不在 README 写任何真实路径/token）。

## 3. 调试速查

- 宿主存活：`curl http://127.0.0.1:3080/api/dsh-file-picker/status`
- 插件日志：`~/.dsh/logs/dsh-file-picker.log`；dsh 主 shell 日志：`~/.dsh/dsh-launcher/shell.log`
- 清理残留 pwsh：`Get-Process pwsh | Stop-Process`
- 清理残留 explorer（无窗口空转）：`Get-Process explorer | Where-Object { $_.MainWindowHandle -eq 0 } | Stop-Process`（勿杀桌面 shell）
- 浏览器 UI 未更新：Ctrl+Shift+R 强制刷新
- `git push` 瞬时失败：重试一次
- npm CDN 传播延迟：scoped 包首发 4-5 分钟属正常，勿当失败重发
- 类型检查兜底：`pnpm build` + `pnpm vitest run` + 仔细 review（仓库无 tsconfig.json）