# Triage labels

此仓库使用五个标准分类角色，每个角色一个标签（字符串即名称）：

| Label | 角色 |
|---|---|
| `needs-triage` | 新票、未评估 |
| `needs-info` | 需要报告者补充信息 |
| `ready-for-agent` | 可直接交给 agent 执行 |
| `ready-for-human` | 需要人做决定 |
| `wontfix` | 决定不修复 |

triage 技能经 `gh label` / `gh issue edit` 应用这些标签；若仓库尚无这些标签，先创建（`gh label create`）。