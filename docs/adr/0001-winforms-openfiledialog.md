# 0001 · 使用 WinForms OpenFileDialog 承载原生文件选择

- 状态：接受（2026-08-17）
- 取代：COM `IFileOpenDialog` 路线（fde836b 引入，d54e827 回退）

## Context

插件需要原生 Windows 多选文件对话框。曾实现 COM `IFileOpenDialog`（C# interop）：
- 每次 pick 需 csc 编译 1s+，缓存到 `%TEMP%` 被用户拒绝；
- 独立任务栏条目；对话框被 Windows 前台锁压到其它窗口后面（dsh 服务 spawn 的 pwsh 无前台激活权限），`ShowDialog()` 永久阻塞 → 插件完全失效；
- pwsh 无法将 `__ComObject` cast 到自定义 `[ComImport]` 接口，COM 逻辑必须进 `Add-Type` 的 C# static method；
- `IFileDialog` vtable 有 23 个方法（无 `GetFileTypeCount`），计数错误即 AccessViolationException。

## Decision

用 WinForms `OpenFileDialog`（`System.Windows.Forms`）：
- 透明 TopMost owner 窗体（`Opacity=0`、1x1、`Location=(-32000,-32000)`、`ShowInTaskbar=$false`）+ `ShowDialog($owner)`，强制对话框置顶；
- `AutoUpgradeEnabled=$true` 保持现代 Explorer 样式；`Multiselect=$true`；`RestoreDirectory=$true`；
- 宿主侧 `runNativePicker` 加 10 分钟卡死超时（`PICKER_STUCK_TIMEOUT_MS`），超时 kill 子进程并按取消处理；
- 必须 `[System.Windows.Forms.Application]::EnableVisualStyles()`（否则首个 UI 元素阻塞且无窗口）；
- stdout 首行 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`（`-EncodedCommand` 走 ANSI/GBK 会乱码）。

## Consequences

- 无编译延迟、无 `%TEMP%` 残留；对话框 z-order 置顶且 foreground=True；
- 卡死不再拖死 UI（📎 不会永久 disabled）；
- 依赖 pwsh 7 WinForms（默认 STA，勿画蛇添足改 MTA）；需注意清理残留 pwsh 进程（红线 9）；
- COM 路线细节留档备查：正确 IID `D57C7288-D4AD-4768-BE02-9D969532D960`、vtable 23 方法。