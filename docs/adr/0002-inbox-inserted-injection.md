# 0002 · 经 agent/inbox/inserted 事件注入文件路径

- 状态：接受（2026-08-17）

## Context

选中文件需在发送时注入会话上下文。曾考虑 phase-listener 方案，但普通发送走 `default-sink`，
phase 恒为 `'plain'`（见 dsh `input/machine.ts:460-477`），该方案根本不可行。
另：Agent 接口字段为 `id` 而非 `sessionId`（`runtime-types.ts:66`），`agent.sessionId` 是 undefined。

## Decision

宿主监听 `agent/inbox/inserted` 事件，命中已 stage 的路径列表时
以 `agent.inject(createUserMessage(...))` 注入；session 以 `agent.id` 为 key；
浏览器 rail 发送后自动 unstage（`/unstage`），保证无 sidecar 残留。

## Consequences

- 注入稳定可靠；路径只经宿主事件管线进入上下文，**绝不写进草稿/消息文本**（产品红线 1 的基础）；
- stage/unstage 生命周期由浏览器 rail 驱动，宿主只做状态簿记；
- loopback 防护：routes（/native-pick、/stage、/unstage、/reveal、/status）仅接受本机回环请求。