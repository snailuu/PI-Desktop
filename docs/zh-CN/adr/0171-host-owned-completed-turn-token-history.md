# ADR 0171：由主机核心持有的已完成回合 token 历史

> **翻译说明：** 本页是与 [英文源决策](/adr/0171-host-owned-completed-turn-token-history) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受（经 ADR 0173 修订）
- 日期：2026-09-07
- 决策者：PI-Desktop 核心
- 相关：D103、D157、D331、D335、ADR 0014、ADR 0173、
  `03-runtime/04-data-storage.md` §4.6、
  `03-runtime/06-host-rpc-protocol.md`、
  `04-ux/06-settings-ia.md`、E2E-186

## 上下文

`turns` 表已经存储 `input_tokens`、`output_tokens` 和 `usage_json`，并且
`session.endTurn` 已经接受 `usage`。但 Electron 从未发送它。按消息展示的芯片（D103）从助手的
`meta_json` 读取供应商用量。将子代理支出混入这些芯片会虚增上下文
检查器和组合回合总计。

仍然需要一个持久化的已完成回合总计，这样后续仪表板就能展示
用户实际支出的内容（包括子代理），而无需引入新的 schema 版本。

## 决策

1. **父级 `message.usage` 保持为供应商上报值。** 子代理总计永不
   合并到助手行中。
2. **回合汇总为 `session.endTurn.usage`。** Electron 汇总该持久化回合中所有父级
   助手 `message_end` 用量，并加上
   `turn_end.subagentUsage` 增量。只有该汇总值存储在 `turns` 上。
3. **`stats.getTokenUsageHistory` 是增量主机 RPC。** 它读取有界的本地日历窗口内已完成的
   回合，按 `day` / ISO `week` /
   `month` 分桶，填充空桶，并且不会提升 `PROTOCOL_VERSION` 或
   `SCHEMA_VERSION`。`idx_turns_ended_at` 在启动时通过
   `CREATE INDEX IF NOT EXISTS` 创建。
4. **面向用户的仪表板不是设置。** ADR 0173 将该界面移至
   插件市场插件 `pi.token-insights`。此 RPC 仍然存在，因此本地
   已完成回合历史（包括子代理支出）有一个主机核心归属方。
   Electron 发送 `usage` 之前的历史行可能为零。

## 后果

- 上下文检查器和 D103 芯片保留精确的供应商值。
- 新的已完成回合会填充主机历史；较旧的回合可能为零。
- 热力图位于 `pi.token-insights`（ADR 0173）。
- 后续从转录 `meta.usage` 回填将是单独的变更。

## 备选方案

- 用子代理支出重写父级 `message.usage`：已拒绝（D103）。
- 在主机设置页面中扫描 JSONL 转录：已拒绝（无界，归属方错误）。插件市场插件可以扫描本地工具元数据，包括 JSONL。
