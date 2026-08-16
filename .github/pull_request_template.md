## 变更类型

- [ ] `feat`：新功能
- [ ] `fix`：缺陷修复
- [ ] `docs`：文档
- [ ] `refactor` / `style` / `test` / `chore` / `perf`：其他

## 摘要

<!-- 一句话说明本次变更解决的问题 -->

## 验证（合入门禁：main 禁直推，须 CI`build-test` 绿）

- [ ] `pnpm build` 通过
- [ ] `pnpm vitest run` 全绿（基线 55 个）
- [ ] 涉及 UI 改动：已说明 Ctrl+Shift+R 验证方式
- [ ] 行为变更已同步 README / CONTEXT / 相关 ADR

## 关联

- 关联 issue：#
- 是否改动宿主 spawn 逻辑 / 客户端 bundle：是 / 否
