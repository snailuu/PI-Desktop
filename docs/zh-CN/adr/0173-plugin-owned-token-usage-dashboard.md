# ADR 0173：插件自有的 token 用量仪表盘

> **翻译说明：** 本页是与 [英文源决策](/adr/0173-plugin-owned-token-usage-dashboard) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-07
- 决策者：PI-Desktop 核心
- 相关：D103, D331, D335, ADR 0171, `04-ux/06-settings-ia.md`,
  E2E-186, 插件市场插件 `pi.token-insights`

## 上下文

ADR 0171 增加了由主机核心持有的已完成回合 token 历史，以及设置 → 用量目的地。插件市场插件 `pi.token-insights` 已经发布了跨 PI-Desktop、Claude Code、Codex 和 OpenCode 的私有本地仪表盘（热力图、KPI、过滤器、连续记录、代理工具）。保留两个界面会在偏好设置内重复一个更弱的、仅限 PI-Desktop 的矩阵。

插件无法写入 `pi.sqlite`（D002）。它们已经以只读方式读取外观和供应商标签。主机仍然需要 `session.endTurn.usage`，以便子代理支出在不重写父级 `message.usage` 的情况下持久化。

## 决策

1. **设置中没有用量目的地。** 偏好设置只有常规、AI 和快捷键。搜索不会索引用量标签页。
2. **`pi.token-insights` 是面向用户的仪表盘。** 命令面板关键词（`usage`、`tokens`、`用量`）会打开该插件。
3. **主机持久化保持不变。** Electron 仍然将父级 `message_end` 用量加上 `turn_end.subagentUsage` 汇总到 `session.endTurn.usage`。`stats.getTokenUsageHistory` 仍然是用于本地已完成回合汇总的附加型主机 RPC / IPC。它不是设置页面。
4. **插件可以将主机已完成回合的剩余量**折入其 PI-Desktop 事实立方体，当这些总量超过转录助手 `meta.usage` 时，这样无需重复计算 JSONL 消息即可使子代理支出可见。它仍然绝不重写 `message.usage`。

## 后果

- 想要热力图的用户需要安装或打开 Token Insights。
- 在 Electron 发送 `usage` 之前的历史回合在主机 RPC 中可能仍然是零；插件的 JSONL 扫描仍然是那些日子的回填。
- 之后包装 `stats.getTokenUsageHistory` 的第一方插件 API 是单独的变更。

## 备选方案

- 在插件旁边保留设置 → 用量：已拒绝（重复的信息架构）。
- 删除主机回合持久化：已拒绝（D331 记账）。
- 让插件用回合表替换 JSONL：已拒绝（丢失逐消息的模型/供应商排名和持久化之前的历史）。
