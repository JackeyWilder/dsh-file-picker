# 0003 · 日志脱敏与公开仓库卫生

- 状态：接受（2026-08-17）

## Context

插件以公开 npm 包 + 公开 GitHub 仓库面向公众发布；运行日志会记录真实文件路径，公开文档与提交可能外泄本机信息。

## Decision

- 日志默认脱敏：路径显示为 `G:\...\file`；仅环境变量 `DSH_FILE_PICKER_DEBUG=1` 时输出完整路径；
- 日志文件 `~/.dsh/logs/dsh-file-picker.log`，1MB 轮转；
- 提交内容（代码/测试/文档/日志样例）不得包含真实本机路径、用户名、密钥。

## Consequences

- 公众场景下路径不泄露，调试需显式开启 DEBUG；
- README / 交接 / 日志样例一律使用占位写法（如 `G:\...\file`）；
- 版本号运行时读 `../package.json`（`PLUGIN_VERSION`），日志标注插件版本便于定位。