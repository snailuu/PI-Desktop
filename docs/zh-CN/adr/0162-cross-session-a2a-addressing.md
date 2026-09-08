# ADR 0162：跨会话 A2A 寻址

> **翻译说明：** 本页是与 [英文源决策](/adr/0162-cross-session-a2a-addressing) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已被 ADR 0165 取代
- 日期：2026-09-05
- 决策者：PI-Desktop 核心
- 相关：D318、D277、ADR 0147、ADR 0062、ADR 0089、
  `03-runtime/02-agent-runtime.md` §5f.2,
  `03-runtime/06-host-rpc-protocol.md` §4、E2E-165、E2E-165b、E2E-165c
- 修订：ADR 0147。本地 A2A broker、能力 token 认证、类型化部件、
  持久化任务生命周期，以及父代理不可调用 A2A 的边界均保持不变。
  仅限同一 context 寻址的限制被解除。

## Context

ADR 0147 将每个 A2A 代理都绑定到 `contextId = sessionId`，并以
`A2A_CROSS_CONTEXT_DENIED` 拒绝跨 context 的发现、发送与任务访问。
这与其所取代的进程内邮箱一致，后者在设计上就是按会话划分作用域的。

broker 本身已经是进程全局的：host-core 中一个内存注册表、一条
sidecar JSON-RPC 管道，以及每个会话一个 `DesktopAgentRuntime`。来自
不同会话的代理本就位于同一个映射中；隔离只是一层过滤器。因此，
两个已打开会话中的并发工作无法共享一个事实、一个文件占用声明或一个
圆桌席位，即便两个委托代理都位于同一台宿主本机上。

剩下的风险在于身份，而非传输。对等方 id 在每个会话内唯一
（`discussant`、`discussant-2`），但跨会话并不唯一，因此两个对话可能都在
运行 `discussant`。任务将这些 id 存储为 `agentName` / `requesterName`，
而 sidecar 会将 `a2a.task.event` 广播给每个会话运行时。若只是简单地移除
过滤器，错误的 `discussant` 就可能读取到任务，或因另一会话的事件而被唤醒。

## Decision

允许在同一 host 上跨会话进行 A2A 发现与寻址。

1. **`a2a.agents.list` 返回所有其他存活代理**，而不仅是调用方
   `contextId` 下的代理。每个 Agent Card 都携带 `contextId`（其注册时所处的
   会话 id），以便委托代理能够区分同会话对等方与其他会话对等方。
   调用方自身的卡片仍被排除。
2. **`a2a.message.send` 可以向任何已注册的对等方发送消息。** 省略 `to` 时，
   broker 仍优先选择同会话对等方（保留当前“单一另一对等方”的默认行为），
   之后才选择唯一的其他会话对等方。
3. **任务访问基于成员身份，而非 context。** 调用方必须是任务的
   `requesterName` 或 `agentName`。陌生人——无论是否在同一会话——仍会以
   `A2A_UNKNOWN_AGENT` 失败。`A2A_CROSS_CONTEXT_DENIED` 出于线上兼容性
   保留在错误码列表中，但不再产生。任务上的 `contextId` 仍是请求方的
   会话 id，并且仍对 `A2A_MAX_TASKS_PER_CONTEXT` 构成上限。
4. **存活的对等方 id 在整个注册表中唯一。** 在 `a2a.agents.register` 时，
   如果 `card.name` 已被占用，broker 会为其添加后缀（`discussant-2`、…）
   并返回去重后的 `agentId`。运行时会将此 id 用于委托代理的 A2A 工具、
   等待队列和提示词，因此任务上的 `agentName` / `requesterName`
   不会与另一个存活代理冲突。
5. **事件携带 `recipientContextId`。** `a2a.task.event` 与 `a2a.push`
   的形如 `{ recipient, recipientContextId, contextId, … }`。每个会话运行时
   只有在 `recipientContextId` 等于其 `sessionId` 时才投递事件（省略该字段
   则保持当前的同会话投递行为）。这可以避免共享 sidecar 管道上的广播为
   错误的会话排队工作。
6. **未变更的边界（由 ADR 0164 修订）。** 已结束的委托代理会被注销。
   仍然不存在嵌套委托，也不存在远程或跨机器传输。父代理到父代理的 A2A
   由 ADR 0164 规定；父代理仍不能寻址子代理。

## Consequences

- 两个位于不同已打开会话中、具备 A2A 能力的委托代理可以互相发现、
  创建持久化任务，并完成对端往返。
- 常见情形下的同会话 A2A 保持不变：名称唯一、省略 `to` 会选择另一个
  本地对等方、事件仍会唤醒本地等待方。
- 当第一个会话已占用 `discussant` 时，第二个会话中名为 `discussant` 的
  定义可能注册为 `discussant-2`。委托代理会被告知其被分配的对等方 id。
- `A2A_CROSS_CONTEXT_DENIED` 仍然是一份已记录的代码，但未被使用。
  新的跨会话失败为 `A2A_UNKNOWN_AGENT`、`A2A_UNKNOWN_TASK` 或
  `A2A_NO_PEERS`。
- 未涉及：嵌套委托以及任何网络 A2A 绑定。父代理到父代理的 A2A 由
  ADR 0164 决定。注销后的名称复用（后来的 `discussant` 读取仍命名为
  `discussant` 的过期任务）与当前的会话内风险相同。

## Alternatives considered

- **保留同会话隔离**：拒绝。用户可见的需求是会话间协调，而 broker
  本就已是全局的；该拒绝是邮箱边界的遗留物，而非传输限制。
- **按 `(name, contextId)` 寻址而不对名称去重**：拒绝。
  任务将 `agentName` / `requesterName` 持久化为字符串；两个存活的 `bob`
  代理都会通过成员身份检查。在注册时去重可保持该约定。
- **将存储的名称限定为 `name@contextId`**：拒绝。这会把会话 id 泄漏到
  模型读取的每一份任务摘要中，并且仍需要在共享管道上做事件过滤。
