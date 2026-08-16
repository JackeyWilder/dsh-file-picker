# AGENTS.md

dsh-file-picker —— dsh web（DeepSeek Harness）的原生 Windows 文件选择器插件。
本文件是 agent 在本仓库开发 + 治理的总规则：红线、约定、门禁、流程。动手前先读完。

## 1. 仓库速览

- 形态：dual-face 插件。宿主侧 `src/host/*`（ESM → `lib/index.js`）跑在 dsh Node 进程；
  浏览器侧 `src/client/*`（CJS 闭包 → `lib/client.js`）经 `cordis.patch.yml` 声明 slot 注入 UI。
- 安装：dsh profile `package.json` 以 `link:G:/Dev/agent/dsh plugins/dsh-file-picker` 安装；
  改 `lib/` 重建后宿主重启生效；浏览器端旧 bundle 需 Ctrl+Shift+R。
- 一键命令：`pnpm build`（tsdown 转译）；`pnpm vitest run`（基线 55 个测试）。
- 发布：npm 公开 `@jackeywilder/dsh-file-picker`；GitHub 公开 `JackeyWilder/dsh-file-picker`。

## 2. 硬性红线（违反即事故）

**产品约束**
1.【禁止】文件路径绝不写进草稿/消息文本——注入只走宿主 `agent/inbox/inserted` 事件管线；
2.【禁止】不设独立发送按钮——卡片 rail 由主 composer 发送触发；
3.【禁止】无 sidecar 残留——不产生临时缓存文件、不留残进程。

**合规（公开插件）**
4.【禁止】npm token 等明文密钥绝不落盘（代码/日志/README/文档）；
5.【必须】日志默认脱敏（`G:\...\file`），完整路径仅 `DSH_FILE_PICKER_DEBUG=1` 时输出；
6.【禁止】提交内容不得含真实本机路径、用户名、密钥；
7.【禁止】不擅自 push / 发布——push 与发布前必须确认。

**技术**
8.【必须】PowerShell 一律 pwsh 7，禁止 Windows PowerShell 5.1；
9.【必须】调试后清理残留 pwsh 进程（spawn 残留会堆积拖慢系统）。

**运行治理（approval=never 环境）**
10.【必须】破坏性 / 不可逆操作与工作区外写改，先文字汇报四要素（原因/预计结果/可能结果/影响）并获你明确同意后方执行；细则见 docs/agents/authorization.md。

## 3. 开发约定

**按场景调用技能**
- 新功能/新方向：先 `brainstorming` 探索，再 tdd 实现；
- "不生效/卡住/失效"：先 `systematic-debugging` 定位根因再修；
- 合并/发布前：`requesting-code-review`；声称完成前：`verification-before-completion`；
- 改中文文案：`chinese-documentation`。

**构建/测试特有坑**
- `pnpm build` 通过 ≠ 类型正确（tsdown 只转译不检查类型；仓库无 tsconfig.json）；
- 改 client 代码必须重建 `lib/client.js`，交付说明附 Ctrl+Shift+R 提示；
- 改 host spawn 类代码必须同步维护 tests（`vi.mock('node:child_process')` 模式）。

## 4. 验证门禁（"完成"的定义）

改动必须全部满足：
1. `pnpm build` 通过；
2. `pnpm vitest run` 全绿（基线 55 个）；涉及 host spawn 类须同步维护测试；
3. 涉及 UI 的改动，交付说明附 Ctrl+Shift+R 验证提示；
4. 类型正确性不以 build 通过为证据；
5. 验证命令被沙箱/环境拦截时：如实报告并申请更高权限；【禁止】跳过验证却声称"已完成/已通过"。

## 5. 流程摘要

- **开发流**：功能开发一律在 `feature/*` / `fix/*` 分支进行，经 Pull Request 合入 `main`；`main` 受分支保护（禁直推、CI `build-test` 必须绿），不存在直推 main；PR 描述用 `.github/pull_request_template.md` 模板；合入 `main` 前需用户确认。
- **issue**：GitHub Issues（`gh issue create`）；分类标签 `needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`。
- **架构决策（ADR 纪律）**：改动若与既定决策（WinForms 对话框、inbox/inserted 注入、TopMost 置顶、隐私脱敏）冲突，禁止静默推翻——先读 `docs/adr/`，理由与后果记录为新 ADR（MADR 风格）。
- **发布**：改 `package.json` version 必须同步 git tag（publish.yml 校验 tag==version）；打 `v*` tag 并 push 触发自动发布，禁止手动 `npm publish` 绕过；本机发布用 npm CLI 而非 pnpm；scoped 包 `--access public`；NPM_TOKEN 只存 GitHub secret（红线 4）；CDN 4-5 分钟传播延迟属正常。
- **交接**：内容必须落仓库（CONTEXT.md / docs/adr/ / docs/handbook.md），不留 %TEMP%；行为变更须同步 README / CONTEXT / 相关 ADR。
- **提交**：Conventional Commits（英文 type + 中文描述，如 `fix: 修复对话框置顶失效`）；一个逻辑变更一个提交。
- **授权**：破坏性操作 / 工作区外写改 → 汇报（原因/预计结果/可能结果/影响）→ 等待明确同意 → 执行 → 回执；%TEMP% 本会话临时文件与工作区内 git 可逆操作为正常开发，免授权。

## 6. 文档地图

- `CONTEXT.md` —— 项目定位、架构速览、环境事实，任务开始必读。
- `docs/adr/` —— 0001 对话框 / 0002 注入时机 / 0003 隐私脱敏与公开卫生。
- `docs/handbook.md` —— 踩坑全集 + 代码地图 + 调试速查。
- `docs/agents/*.md` —— issue-tracker / triage-labels / domain 技能细则。
- 运行日志 `~/.dsh/logs/dsh-file-picker.log`（1MB 轮转）。