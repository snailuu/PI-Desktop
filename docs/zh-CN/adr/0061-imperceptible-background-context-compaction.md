# ADR 0061：不可感知的后台上下文压缩

> **翻译说明：** 本页是与 [英文源决策](/adr/0061-imperceptible-background-context-compaction) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受（第 2、4、6、7、8 条由 ADR 0064 修订）
- 日期：2026-08-06
- 决策者：PI-Desktop 主机核心
- 修订：ADR 0030 / ADR 0049 / D158

## 背景

ADR 0030 的回合边界守卫是正确的：超过硬预算时不会发出任何供应商请求，且 ADR 0049 为每一次自动失败提供了持久的保留尾部恢复。但它并非不可感知。压缩会通过五种方式向用户暴露自身：

- 每一次成功的自动压缩都会弹出一条 info toast；
- `compaction_start` 会置位 `isRunning`，于是运行状态和加载指示器会跳动，而用户并没有请求任何正在运行的任务；
- 软边界会注入一条临时指令，要求模型调用 `CompactContext`，这消耗了一个模型回合，并在对话记录中留下一条工具活动行；
- 压缩只在 `tokens >= hardLimit` 时运行，因此它总是发生在用户等待回复的那一刻，最坏情况下摘要输入接近整个窗口；
- 设置中暴露了 `reserveTokens`、`keepRecentTokens` 和一个启用开关，使调优一个安全机制成为用户的责任。

Codex（`codex-rs/core/src/session/context_window.rs`、`state/auto_compact_window.rs`）展示了两个值得采纳的思路：对触发条件分级，而不是使用单一的硬性边界；以及基于当前上下文前缀以来的*增量*而非总量来度量触发条件（`AutoCompactTokenLimitScope::BodyAfterPrefix`）。

> 由 ADR 0064 更正：本节最初还写道“Codex 也完全没有模型侧压缩工具——由宿主决定并执行”。这是错误的。Codex 有 `new_context`（`tools/handlers/new_context_window_spec.rs`），由 `Feature::TokenBudget` 控制，且上述两个思路都不是 Codex 的默认行为：`BodyAfterPrefix` 需要显式启用，而 Codex 没有用于对触发条件进行分级的预计算。

现有实现的一个特性让后台工作变得廉价：`entriesWithCompaction()` 通过 `throughMessageId` 定位检查点，并将其拼接到条目列表中，锚点之后的一切保持不变。因此提前计算出的检查点在尾部持续增长时仍可安装，所以预计算不需要新的不变量。

固定的 `reserveTokens: 16_384` / `keepRecentTokens: 20_000` 默认值也是一个与可见性无关的真实缺陷：它们把相同的绝对数值应用于 32k 窗口和 1M 窗口。

## 决策

压缩成为一种由宿主拥有、用户无法感知的后台活动。阻塞式硬边界保持不变，并仍是安全网。

1. **分层预算，由模型窗口推导得出。** `contextBudget()` 保持 ADR 0030 定义的 `hardLimit` 和 `requestHeadroom` 不变，并新增 `backgroundLimit = floor(hardLimit * 0.7)` 作为预计算触发条件。`keepRecentTokens` 推导为 `clamp(hardLimit * 0.2, 8k, 64k)`，仍然以硬预算的一半为上限。软边界及其 `softGap` 被删除。
2. **增量触发范围。** 后台预计算需要同时满足 `tokens >= backgroundLimit`，以及自最新检查点安装时所记录的基线以来增长至少 `keepRecentTokens`。若没有增量检测，一个高于后台上限的大型保留尾部会在每个回合都请求新的摘要，却什么都减少不了。硬边界继续按总量度量，因为那才是供应商的实际约束。
3. **生成与安装分离。** `buildCheckpoint()` 执行准备、预算预检和摘要请求，不持久化任何内容，也不触碰 `activeCompaction`。`installCheckpoint()` 重新估算、通过 host-core 追加、更新 `activeCompaction`，并发出 `compaction_end`。阻塞路径就是将这两者背靠背组合，因此阈值、溢出和手动行为均保持不变。
4. **仅在供应商空闲窗口。** 后台摘要请求只从恰好两个位置发起：`tool_execution_start`（此时模型流已结束且下一个请求尚未发出），以及 `prompt()` 的 `finally`（此时用户正在阅读结果）。后台摘要绝不与流式回合共享供应商连接：`prepareNextTurn()` 会在下一个请求前等待任何进行中的构建。后台工作有意不设置 `compactionInProgress`，因为该标志会供给 `getStatus().isRunning`。
5. **在安装时检查陈旧性，失败时保持静默。** 预计算的检查点只有在以下条件全部满足时，才会在下一个回合边界或用户提示时被消费：它所基于的检查点仍然处于活动状态、其 `throughMessageId` 锚点仍存在于 `fullEntries` 中，并且它仍适配*当前*模型的预算。任何一项不满足都会丢弃它，并回退到现有的阻塞路径。失败的后台构建会被丢弃：不持久化、不发事件，也不走 ADR 0049 的兜底：保留尾部属于硬边界，而硬边界仍然在那里兜住后台工作漏掉的一切。
6. **没有面向模型的压缩。** 移除 `CompactContext`、`<context_management>` 提示，以及 host-core 免确认允许列表中的 `"CompactContext"` 条目。触发完全由宿主驱动，且是确定性的。
7. **静默。** `compaction_start` 和 `compaction_end` 携带可选的 `phase?: "background" | "blocking"`（缺省表示 `blocking`；按 ADR 0047 属于新增字段，因此协议版本不变）。一次成功的自动压缩——无论是后台还是阻塞——不通知任何人：没有 toast、没有运行状态变化、没有对话记录行。仍保留三个 toast，每一个都跟随用户已经看到的某件事：`retained_tail` 兜底（警告）、溢出重试（警告），以及手动 `/compact` 的结果。
8. **上下文检查器是唯一可见的痕迹。** `compaction_end` 携带 `status: { generation, summaryTokens }`，持久的 `SessionDetail.compaction` 在会话打开或分叉时提供相同信息。检查器渲染一行——`Compacted N× · summary ≈X`——没有检查点时不渲染任何内容。代际计数器搭载在检查点不透明的 `details` 值中，host-core 会原样持久化它，因此不需要改动记录 schema。
9. **无设置。** 移除设置中的压缩卡片、其搜索关键词、其 i18n 键，以及主进程的透传。已持久化的 `contextCompaction` 值被有意忽略：否则，曾经关闭过压缩的用户将没有开关可以把它重新打开。`ContextCompactionSettings` 类型作为运行时的构造时覆盖项保留，以便测试可以构建一个禁用压缩的会话。

手动 `/compact` 保持不变，并且仍然快速失败。

## 后果

- 在常见情况下，用户从不需要等待压缩。摘要请求与工具执行或空闲会话重叠进行，回合边界只需安装一个已经完成的检查点。
- 摘要输入更小、更廉价，因为硬限制的 0.7 比硬限制本身对应的历史要小得多。
- 跨越后台上限的会话会为其可能并不需要的摘要付出代价。0.7 是成本权衡：超过该点后，达到硬限制几乎不可避免，因此这些 token 很少被浪费；而更低的比例则会让短会话为其从不使用的摘要买单。
- 小窗口和大窗口模型现在获得与窗口成比例的预算，而不是一对绝对 token 数量。
- 去掉模型侧工具消除了一类浪费的回合和一个对话记录工件，也消除了模型忽略、推迟或重复该请求的可能性。没有任何确定性触发尚未覆盖的东西因此丢失。
- 压缩不再能通过对话记录审计。检查器那一行、持久化的检查点记录以及生命周期事件仍然存在，因此诊断是可行的；但随意观察不行。这是对 ADR 0030“以工具活动行保持可见/持久”的有意逆转。
- 用户不再能从 UI 禁用自动压缩。由于禁用的守卫意味着超大的供应商请求，这正是预期结果。
- 两个供应商空闲窗口并非全部窗口。从不运行工具、且在提示之间从不进入空闲的会话，仍然会像以前一样在硬边界处同步压缩。

## 备选方案

### 与流式回合并发压缩

已拒绝。它会消除最后的延迟，但在一个供应商连接上同时发出两个请求会招致限流（在 Bedrock 上已观察到），并使单次用户操作的可见成本翻倍。

### 在后台压缩的同时保留软边界提示

已拒绝。在确定性预计算存在的情况下，该提示只会增加它一贯就有的失败模式——浪费一个回合、留下一条对话记录行，以及让模型可以自由忽略它。

### 保留设置旋钮，但要藏在开发者开关之后

已拒绝。这些数值现在由模型窗口推导得出；一个覆盖项会成为重新引入小窗口/大窗口缺陷的途径，而用隐藏开关禁用安全守卫比没有开关更糟。

### 在压缩时显示一个细微的行内指示器

已拒绝。任何持久指示器都会让用户意识到一个他们无法对其施加影响的机制。检查器已经为任何想到要问的人回答了这个问题。

## 参考资料

- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/03-runtime/02-agent-runtime.md`
- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/04-ux/06-settings-ia.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md`（D158、D200）
- `codex-rs/core/src/session/context_window.rs`（行为参考）
