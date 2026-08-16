# Domain docs

本仓库为**单上下文**布局。

- 领域说明：根目录 `CONTEXT.md`（覆盖全部领域，任务开始时必读）。
- 架构决策：`docs/adr/` 下编号 ADR（`NNNN-标题.md`，MADR 风格）；触碰对应区域前先读，
  决策变更时新增 ADR，不修改历史 ADR。
- 消费规则：agent 任务开始时读 CONTEXT.md + 相关 ADR；任务若改变既定决策，同步更新文档。