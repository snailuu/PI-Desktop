# ADR 0064：Codex 对等的上下文压缩

> **翻译说明：** 本页是与 [英文源决策](/adr/0064-codex-parity-context-compaction) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-06
- 决策者：PI-Desktop 核心
- 修订：ADR 0061 / ADR 0030 / D158 / D200；由 ADR 0136 修订

## 背景

ADR 0061 使压缩变得不可察觉，并引用 Codex 作为实现这一目标的参照。之后阅读 Codex 源码表明，其中四条条款与 Codex 的实际做法相反，而且其背景部分有一项事实性断言是错误的：

| Codex | ADR 0061 |
| --- | --- |
| 压缩仅在同步执行；任何地方都没有预计算 | 检查点在供应商空闲窗口预计算（条款 4） |
| 自动压缩阈值范围默认是整个上下文；`BodyAfterPrefix` 是可选启用 | 后台触发器测量自上一个检查点以来的增量（条款 2） |
| 每次压缩都会发出一个 `ContextCompaction` 回合项 **以及** 一个 `EventMsg::Warning` | 成功的压缩不通知任何人，也不留下任何行（条款 7、8） |
| `new_context` 是真实的、面向模型的工具，由 `Feature::TokenBudget` 门控 | “Codex 也完全没有模型侧压缩工具”（第 31 行）；该工具被移除（条款 6） |
| 压缩后，模型上下文保留最近的 **用户** 消息（≤20k token）加上摘要 | 保留的尾部保留完整的最近回合，包括助手和工具消息 |
| 两个族：LLM 摘要压缩和不生成摘要、切换到全新窗口的滚动切换 | 一个族，总是生成摘要 |
| 两级预算提醒（`TokenBudgetReminder`，然后 `AutoCompactFallbackPrompt`），每个窗口各一次 | 完全没有面向模型的提示（条款 6） |

上述每一项的源码定位：

- `core/src/compact.rs` — `COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000`；
  `build_compacted_history_with_limit()` 从最新到最旧遍历历史，只保留
  用户消息，截断跨过限制的那一条，再 `reverse()` 回正序，然后追加摘要；
  `:384` 在每次压缩后抛出 `EventMsg::Warning`。
- `core/src/compact_token_budget.rs` — 不生成摘要的路径运行相同的压缩生命周期，
  发出相同的 `ContextCompaction` 回合项，然后调用 `start_new_context_window()`。
- `session/mod.rs:3665 start_new_context_window()` — 历史被清空为初始上下文加上
  回合上下文项，并带有 `message: String::new()`。
- `session/turn.rs:423` —
  `should_roll_over = needs_follow_up && (take_new_context_window_request() || token_limit_reached)`：
  触发器在回合边界内联评估。
- `session/token_budget.rs:66 maybe_record()` — 第一级在
  `remaining <= reminder_threshold_tokens`，第二级在 `remaining == 0 &&
  allow_fallback`，每个窗口各声明一次。
- `tools/spec_plan.rs:994` 和 `tools/handlers/new_context_window_spec.rs` —
  `new_context`，无参数，描述为“Start a new context window. Does
  not clear, reset, or otherwise affect environment state.”

用户明确要求 Codex 对等，并被告知这会反转他们上一轮所要求的不可察觉目标，但仍然重申了这一要求。ADR 0061 中只有一条条款凭自身优点成立 *且* 与 Codex 一致：隐藏调优旋钮。Codex 也从模型元数据读取储备和保留值，并且同样从不询问用户。

## 决策

压缩遵循 Codex 的机制。ADR 0030 的硬边界、ADR 0049 的保留尾部恢复、ADR 0061 的模型窗口派生预算，以及 ADR 0061 的 `buildCheckpoint` / `installCheckpoint` 拆分均保留；ADR 0061 的条款 2、4、6、7 和 8 被替换。

1. **仅内联。** 所有后台预计算都被删除：
   `pendingBackgroundCheckpoint`、`backgroundCompaction`、`backgroundAbort`、
   `checkpointBaselineTokens`、`backgroundLimit`，以及
   `tool_execution_start`、`prompt()` 和运行 `finally` 中的三个调用点。
   `prepareNextTurn()` 重新估算预算，并在总量超过 `hardLimit` 时同步压缩。
   增量范围的触发器也随之移除——不再有需要它守护的第二阈值。
2. **Codex 的保留形态。** `codexShapedPreparation()` 保留
   `prepareCompaction()` 的切点（因此也保留其回合边界和
   拆分回合处理），然后将 `turnPrefixMessages` 和 `retainedTail` 折回
   `messagesToSummarize`，使摘要覆盖整个被压缩范围，
   并将保留尾部重建为仅用户消息：
   `selectRetainedUserMessages()` 遍历被压缩范围加上上一个
   检查点保留的用户消息，从最新到最旧，直到
   `COMPACTION_RETAINED_USER_MESSAGE_MAX_TOKENS = 20_000`（上限为硬预算的一半，
   以避免仅凭保留就填满小窗口），截断跨越限制的消息而不是丢弃它，
   再反转回时间顺序。将尾部折入摘要不是可选的：
   `prepareCompaction()` 只总结切点以下的内容，因此过滤尾部但不这样做，
   会静默丢失没有被任何内容总结的助手和工具内容。丢弃助手消息也会丢弃
   它们的工具调用，因此不会有孤立的 `tool_use` 到达供应商。
3. **一个内部开关背后的两个族。**
   `CompactionStrategy = "summary" | "fresh_window"` 从构造选项解析，然后是
   `PI_DESKTOP_COMPACTION_STRATEGY`，默认 `"summary"`。`fresh_window` 不发出摘要请求：
   它安装一个带有空保留尾部和固定
   `CONTEXT_ROLLOVER_SUMMARY` 标记文本的检查点，然后继续经历相同的
   生命周期——预算重新估算、`session.appendCompaction`、
   `compaction_end`、转录行、警告——镜像 Codex 将其
   token 预算滚动切换建模为普通压缩。该开关不进入
   `AppSettings`、Settings 或 i18n。
4. **`new_context` 回来了。** 该工具无参数，并逐字保留 Codex 的
   描述；执行它只设置 `pendingModelCompaction` 并
   返回该族的滚动切换消息。`prepareNextTurn()` 在
   `pendingModelCompaction || tokens >= hardLimit` 时压缩，与 Codex 的
   `should_roll_over` 一致。该名称在 `activeTools()`、
   `isCoreTool()`、contract 模式允许列表，以及 host-core
   无需确认允许列表（`crates/host-core/src/permissions.rs`）中同步，
   在那里它取代了 `"CompactContext"`。
5. **两级提醒，每个窗口各一次。** 设
   `remaining = hardLimit - tokens`：第一级在
   `remaining <= clamp(hardLimit * 0.15, 8k, 32k)` 时说明剩余预算
   并要求模型开始收尾；第二级在 `remaining <= 2_000` 时
   告诉它现在写下任何必须保留的内容。每级各声明一次，且两个声明
   在检查点安装时重置。提醒被追加到
   当前回合的系统提示中，并在 `finally` 中恢复——与 `SILENT_TURN_NUDGE` 相同的机制
   ——因此它永远不会进入转录或
   持久历史。
6. **整条检查点链都是持久的。** `read_compactions()` 和
   `write_transcript_with_compactions()` 取代了它们仅保留最新记录的前身；
   `sessions.rs` 验证、分叉并重映射每一条记录，并向会话详情负载添加
   `compactions: Vec<CompactionRecord>`，同时
   将 `compaction` 保留为其最后一个元素。每次压缩一行转录要求
   该链能在重启、延迟截断和分叉后存活。
7. **每次压缩一行转录，并且每次都有警告。**
   `compaction_end` 携带 `mark?: ContextCompactionMark`
   （`id`、`throughMessageId`、`generation`、`summaryTokens`、`summarized`），
   而不是 ADR 0061 的 `status`，并完全去掉 `phase`；持久记录
   在会话打开或分叉时提供相同的标记。
   `buildTranscriptEntries()` 在锚点消息之后插入一个 `kind: "compaction"` 条目，
   结束包含它的任何助手回合，并丢弃锚点已不存在的标记。
   成功压缩还会无条件弹出警告 toast；回退、溢出和手动 toast 保留，
   因为每个都说明了更具体的内容。上下文检查器保留其
   线，现在读取最新的标记。

手动 `/compact` 未更改，并保持快速失败。Settings 仍然不暴露
压缩控制，也仍然忽略持久化的 `contextCompaction` 值
（ADR 0061 条款 9）。

### 对 Codex 的有意偏离

- **摘要位置。** Codex 将摘要追加在保留的用户消息之后。
  pi-agent-core 中的 `buildSessionContext()` 在 `entry.retainedTail` 之前发出
  `createCompactionSummaryMessage(summary)`，而这个顺序不是我们能选择的。
  两种顺序呈现的内容相同。
- **任务边界。** ADR 0136 收窄了保留尾部：活跃回合可以仅保留
  其最新用户消息，而已完成回合的检查点具有
  空尾部，因此下一个提示不会被误认为已完成工作的延续。
- **`hardLimit` 推导。** Codex 在窗口的 90% 处压缩；我们保留
  ADR 0030 的“窗口 − 输出储备”。Codex 能承受更宽松的数字，
  因为它有一个单独的全窗口守护；我们没有，而且过大的
  请求是硬供应商错误。
- **工具注册。** Codex 将 `new_context` 门控在
  `Feature::TokenBudget` 之后，因此它仅为不生成摘要的族存在。我们在两个族中都注册它，
  因为需求是模型拥有该工具。
  未实现 `get_context_remaining`；提醒改为携带该数字。
- **提醒阈值和文本。** Codex 从每个模型的元数据读取两者。
  我们没有这样的数据源，因此阈值派生自守护使用的同一 `hardLimit`，
  措辞由我们决定。
- **提醒投递。** Codex 注入合成历史项。我们没有
  一个能保持不进入转录的历史条目通道，因此提醒
  改为每回合系统提示追加——效果等价，且没有
  持久化风险。

## 后果

- 压缩发生在用户再次等待的时刻。这是
  对等的代价；Codex 也付出这个代价。ADR 0061 的零等待属性
  没有了。
- 压缩后的模型上下文要小得多，也更有损：除了通过摘要，
  没有助手推理，也没有工具输出能存活。
  可见转录未受影响，因此用户不会丢失任何东西。
- 摘要输入现在是整个被压缩范围，而不是该范围
  减去尾部，因此每个摘要请求都比 ADR 0061 下更大——
  但请求更少，因为触发器又变成了一条硬边界。
- 压缩又可以由转录审计了，恢复了 ADR 0030 的
  可见性属性，而 ADR 0061 反向废除了它。
- 每次压缩都会用警告打断用户。这是有意为之：只有
  用户才能决定改为启动新会话，而在多次
  压缩之后，这通常是更好的答案。
- 模型可以提早并刻意地压缩，也可以忽略
  提醒——当它忽略时，硬边界仍然在那里。
- 不生成摘要的族已实现，但在发布构建中不可达。它
  存在是为了使机制完整且可测试，而不是作为产品选项。

## 备选方案

### 保留后台预计算并添加可见行和警告

拒绝。用户要求的是 Codex 的机制，而不是它的超集，而且
一个预计算的检查点在无关的回合边界安装，会使
该行的位置变得任意。

### 将保留尾部过滤为用户消息，而不折入摘要

作为正确性缺陷拒绝：`prepareCompaction()` 只总结切点以下的内容，
因此尾部内被丢弃的助手和工具消息将不会被任何内容覆盖。

### 设置 `keepRecentTokens: 0`，让 `prepareCompaction()` 产生空尾部

拒绝。当最后一个条目是工具结果时，`findCutPoint()` 会回退到
最早的有效切点，这会丢弃远超预期的内容。

### 在 Settings 中暴露族开关

拒绝。Codex 不暴露它，而且没有用户能仅凭一个设置行
在“完全无摘要”和“一次摘要请求”之间做出判断。

## 参考

- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/03-runtime/02-agent-runtime.md`
- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/03-runtime/04-data-storage.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/04-ux/09-interaction-patterns.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md`（D158、D200、D203）
- `codex-rs/core/src/compact.rs`、`compact_token_budget.rs`、
  `session/token_budget.rs`、`tools/handlers/new_context_window_spec.rs`
  （行为参考）
