# Architecture Decision Records

本目录存放编号 ADR，记录会影响行为的架构决策。

- 命名：`NNNN-标题.md`（如 `0001-native-winforms-dialog.md`），四位递增编号。
- 风格：MADR 风格——Context / Decision / Consequences。
- 规则：
  - 触碰某 ADR 覆盖的区域前先读它；
  - 决策变更时**新增** ADR（标注 supersedes），不修改历史 ADR；
  - ADR 归属与本仓库领域说明（根 `CONTEXT.md`）一致，作为领域文档的一部分被 agent 消费。