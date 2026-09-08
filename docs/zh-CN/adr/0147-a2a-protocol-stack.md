# ADR 0147：用于子代理协调的 A2A 协议栈

> **翻译说明：** 本页是与 [英文源决策](/adr/0147-a2a-protocol-stack) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已被 ADR 0165 取代
- 日期：2026-09-02
- 决策者：PI-Desktop 核心
- 相关：D277、D318、D321、ADR 0062、ADR 0089、ADR 0100、ADR 0162、ADR 0164、
  `03-runtime/02-agent-runtime.md` §5f.2、
  `03-runtime/06-host-rpc-protocol.md` §4、E2E-165、E2E-165b、E2E-165c、E2E-165d
- 取代：ADR 0138 与 ADR 0140。进程内的 `SubagentMailbox` 与单一的 `Peer` 工具被移除。
  那些 ADR 所识别的协调需求得以保留，但机制已被替换。
- 由以下 ADR 修订：ADR 0162 取消了仅限同一上下文寻址的限制。ADR 0164 允许父代理以
  `kind: "parent"` 注册并向其他父代理调用 `A2A`；父代理仍然不能向子代理寻址。

## 背景

ADR 0138 引入了会话作用域内的 `SubagentMailbox` 以及仅限被委派代理使用的对等工具；ADR 0140 将它们合并为单一的 `Peer` 工具，带有 `send | inbox | wait` 动作。两者都把协调完全放在 Node agent-runtime sidecar 的进程内进行：消息从不到达主机核心，不携带任何持久化状态，除了运行时提供的发送者名称之外，也没有任务生命周期、发现机制或授权模型。

该机制对兄弟代理之间的有界文本尚可一用，但它是一个无法扩展的私有协议。它没有任务状态机（消息发出即忘），没有可供被委派代理在重启后重新读取的持久化历史，没有文本之外的类型化载荷，没有可供被委派代理查询的发现接口，也没有能力模型——只有 sidecar 注入了 `from` 这一事实。它还与业界 Agent2Agent（A2A）协议存在偏离，因此 PI-Desktop 所构建的任何东西都无法与该契约互操作，也无法依据该契约进行推理。

## 决策

用一套真正的 **A2A（Agent2Agent）协议栈**替换对等消息传递，其 broker 位于 Rust 主机核心进程中。agent-runtime sidecar 中的每个子代理都是一个 A2A **客户端**，它经由新增的 `a2a.*` 方法域，通过现有的 stdio JSON-RPC 2.0 / NDJSON 传输——即 `plans.*` 域所使用的同一条管道——到达 broker。这里没有 HTTP、gRPC 或 REST 服务器，也没有网络 OAuth 栈；整个 A2A 接口面都绑定在本地传输之上。

A2A 的七大支柱映射到本地语义如下：

| A2A 支柱 | 标准形式 | 本地映射 |
|---|---|---|
| 传输 | HTTP + JSON-RPC / SSE | 现有的 stdio NDJSON JSON-RPC 2.0，新增 `a2a.*` 方法域 |
| 代理卡片发现 | `GET /.well-known/agent-card.json` | broker 持有内存中的代理注册表；`a2a.agents.list` 返回由各个 `SubagentDefinition` 派生出的卡片（name/description/skills） |
| 任务状态机 | 服务端管理的任务生命周期 | 主机核心中持久化的 SQLite `a2a_tasks` 行：`submitted, working, input-required, auth-required, completed, canceled, failed, rejected`；后四个为终态，永不再转换；broker 强制校验合法转换，`a2a.tasks.status` 将任务驱动到新状态。每个任务同时记录 `agentName`（为其提供服务的 worker）与 `requesterName`（发送首条消息的对等代理） |
| 消息 / 部件 | 类型化的 `Part` 联合 | `TextPart{kind:"text",text}` \| `FilePart{kind:"file",file:{name?,mimeType?,uri?,bytes?}}` \| `DataPart{kind:"data",data}`，在 TS（`packages/shared/src/a2a.ts`）与 Rust（`crates/host-core/src/a2a/types.rs`）中镜像定义 |
| 流式传输 | 基于 SSE 的 `message/stream` | 主机→客户端的 JSON-RPC 通知 `a2a.task.event`，携带 `TaskStatusUpdateEvent` / `TaskArtifactUpdateEvent`，形如 `{ recipient, contextId, event }`；路由是**基于对端的**——状态/终态事件路由给触发它那一方的对端（worker 的回复或完成会唤醒请求方；请求方的后续消息会唤醒 worker），因此代理等待的是寻址到自身的事件 |
| 推送通知 | Webhook 配置 | 主机拥有的推送配置（`a2a.tasks.pushNotificationConfig.set/get`）以及 `a2a.push` 通知 `{ recipient, contextId, taskId, token?, status }` |
| 认证 | OAuth / API key | 由主机铸造的每代理能力 token：`a2a.agents.register` 返回 `{ agentId, token }`，此后每次 `a2a.*` 调用都携带该 token，主机对其进行校验并据此授权寻址。token 由运行时注入，对模型永不可见，从而保持发送者的 `from` 无法被伪造这一不变量 |

`contextId` 等于 `sessionId`，将任务与请求方的会话归为一组。发现与寻址覆盖主机上的每个存活代理（ADR 0162）；但陌生方仍然无法读取其并非当事方的任务。

`a2a.*` 方法（除 `register` 外，每个都携带 `token`）在 `03-runtime/06-host-rpc-protocol.md` §4 中定义；`a2a.tasks.status({ token, id, state, message? })` 将任务驱动到新状态（完成 / 失败 / 交互式暂停），依据状态表校验转换是否合法，并为可选的 `message` 打上 broker 的 `from`/`contextId`。在运行时一侧，唯一面向子代理的工具是 `A2A`（取代 `Peer`），其动作为 `discover | send | get | wait | complete | cancel`；`complete` 结束被委派代理所服务的任务并唤醒其请求方。

事件路由是**基于对端的**。任务创建时，新任务被寻址到 worker；对既有任务的 `a2a.message.send`、`a2a.tasks.status` 以及 `a2a.tasks.cancel` 会将 `a2a.task.event`（以及，在终态且配置了推送时，`a2a.push`）路由给调用方的对端——worker 的回复或完成会唤醒请求方，请求方的后续消息会唤醒 worker；`a2a.tasks.resubscribe` 则重新向调用方自身发送。这补齐了委派往返流程，此前 worker 的完成从未能到达请求方。被委派代理的 `A2A` 工具在 spawn/settle 时按每次委派注册/注销，并闭包捕获主机铸造的 token。`SUBAGENT_A2A_TOOLS = ["A2A"]` 取代 `SUBAGENT_PEER_TOOLS = ["Peer"]`。ADR 0164 还额外将父代理注册为 `kind: "parent"`，并将 `A2A` 放入 Agent 模式目录，仅供父代理之间使用。

边界由 broker 强制执行：`A2A_MAX_TEXT_CHARS = 16000`、`A2A_MAX_FILE_BYTES = 20MB`、`A2A_MAX_TASK_HISTORY = 256`、`A2A_MAX_TASKS_PER_CONTEXT = 128`、`A2A_MAX_SENDS_PER_RUN = 200`、`A2A_MAX_STREAM_WAIT_SECONDS = 120`、`A2A_DEFAULT_STREAM_WAIT_SECONDS = 30`。错误使用 JSON-RPC 数字码 `1400`，其 `data.errorCode` 为以下之一：`A2A_UNKNOWN_TOKEN`、`A2A_UNKNOWN_AGENT`、`A2A_UNKNOWN_TASK`、`A2A_CROSS_CONTEXT_DENIED`、`A2A_INVALID_TRANSITION`、`A2A_TASK_TERMINAL`、`A2A_SEND_CAP`、`A2A_NO_PEERS`、`A2A_PAYLOAD_TOO_LARGE`。

## 非目标

- **不绑定 gRPC、HTTP 或 REST。** 唯一的传输绑定是本地 stdio JSON-RPC 管道。`/.well-known/agent-card.json` 发现端点以及 SSE / webhook 传输都被映射到本地 RPC 之上，而非以服务形式提供。
- **不使用真正的 OAuth。** 授权依靠由主机铸造的内存能力 token，而非网络 OAuth 或 API-key 交换。
- **不涉及跨机器或远程代理。** 每个代理都是本主机上某个本地会话的子代理；主机进程之外不存在任何代理。同一主机上的跨会话寻址是允许的（ADR 0162）。

## 后果

- **协议 v10 与 schema v12 是破坏性变更。** `PROTOCOL_VERSION` 从 9 升到 10，`app.handshake` 的 capabilities 数组现在包含 `"a2a"`；无法声明 `a2a` 能力的旧主机会在握手阶段被拒绝，UI 不会进入可交互状态。`SCHEMA_VERSION` 从 11 升到 12：`migrate_v11_to_v12` 新增 `a2a_agents`、`a2a_tasks`、`a2a_messages`、`a2a_artifacts` 与 `a2a_push_configs`。`a2a_messages` 的主键为复合主键 `(task_id, message_id)`，因此客户端提供的 message id 不会跨任务发生冲突；每个变更调用（任务创建、既有任务发送、状态更新）都在单个 SQLite 事务中持久化其多次写入。能力 token 仅存于内存，并在注销时失效。
- 协调现在是持久化且可检视的：任务及其消息历史保存在 SQLite 中，因此被委派代理可以用 `a2a.tasks.get` 重新读取任务，生命周期可审计——这与破坏性排空的邮箱不同。
- 载荷是类型化的（`TextPart`/`FilePart`/`DataPart`）而非仅限文本，因此被委派代理可以在上述边界内交换文件和结构化数据。
- 伪造发送方这一不变量在构造层面得到保障：能力 token 由运行时注入，永不暴露给模型，因此被委派代理既不能冒充其他代理，也不能寻址不属于自己的任务。
- 被取代的 ADR 中的边界依然成立：`A2A` 工具绝不进入父代理的 `toolCatalog`；被委派代理一旦 settle 即被注销，其 token 随之失效；流等待上限（120 秒）仍低于 300 秒的空闲看门狗。
- 未涉及：与父代理的消息传递、嵌套委派，以及任何远程或跨机器传输。跨会话寻址由 ADR 0162 决定。

## 考虑过的替代方案

- **保留进程内邮箱（ADR 0138/0140）：** 已否决。它无法承载任务生命周期、持久化历史、类型化载荷、发现机制或真正的授权模型，而且它是一个其他组件无法据以推理的私有契约。
- **在主机核心中运行真正的 A2A HTTP/SSE 服务器：** 已否决。对于纯粹本地、同一会话的协调需求而言，它只会引入网络监听器、OAuth 栈以及跨机器暴露面。将 A2A 语义绑定到现有 JSON-RPC 管道上，既能获得协议形态，又不带来那类攻击面。
- **将 broker 放在 sidecar 而非主机核心中：** 已否决。持久化任务状态、迁移以及能力 token 的权威应当归属于已经拥有 SQLite 与安全边界的那个进程；由 sidecar 拥有的 broker 会重复持久化逻辑，且无法在 sidecar 重启后存活。
