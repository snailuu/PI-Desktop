# 01. IPC 协议

> **翻译说明：** 本页是与 [英文源规格](/spec/03-runtime/01-ipc-protocol) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 1. 目标

在渲染器与主进程之间定义一个稳定的契约。

原则：

1. 所有能力都经过预加载允许列表
2. 请求/响应都是类型化的
3. 长时间运行的任务使用事件流，而不是单个超大响应
4. 错误必须包含 code + message

## 2. API 组

| 域 | 描述 |
|---|---|
| `app` | 应用信息、健康检查 |
| `agent` | 对话、排队发送的停止/中止、状态，以及交互式 asktool 解析 |
| `plan` | Plan 提案列表、解析和变更事件 |
| `session` | 会话 CRUD / 历史 / 标题元数据及摘要生成 |
| `settings` | 配置读取/写入 |
| `secrets` | 密钥写入/删除/存在性检查（绝不将明文返回给 UI 日志） |
| `project` | 工作区选择与查询 |
| `tool` | 权限确认回调 |
| `shell` | 主机 shell 清单与持久化的默认 shell |
| `log` | 前端可显示的诊断信息 |
| `plugin` | 插件安装/启用禁用/查询/权限 |
| `commandPalette` | 命令面板搜索与执行 |
| `workspace` | 工作区选择与旧版工作树诊断 |
| `browser` | 工作面板内嵌预览导航/边界/可见性 + 状态事件 |
| `fs` | 工作面板工作区文件列表/读取/显示，以及用户发起的使用操作系统默认处理程序打开（只读） |
| `window` | 无边框窗口状态、控件，以及兼容性工作面板几何通道 |
| `menu` | 允许列表中的应用菜单命令与原生编辑/窗口操作 |
| `notification` | 持久化收件箱列表/读取/清除，以及新增/激活事件 |
| `stats` | 已完成回合的 token 历史（主机 RPC；仪表盘由插件拥有） |

## 3. 通道约定

```text
invoke: pi-desktop/<domain>/<action>
event: pi-desktop/<domain>/event/<name>
```

示例：

- `pi-desktop/agent/prompt`
- `pi-desktop/agent/stop`
- `pi-desktop/agent/abort`
- `pi-desktop/agent/event/message`
- `pi-desktop/agent/askTool/resolve`
- `pi-desktop/session/list`
- `pi-desktop/session/summarizeTitle`
- `pi-desktop/project/open`
- `pi-desktop/project/openFolder`

## 4. 通用响应信封

```ts
type Result<T> =
 | { ok: true; data: T }
 | { ok: false; error: AppError };

type AppError = {
 code: string;
 message: string;
 details?: unknown;
 retriable?: boolean;
};
```

## 5. 代理 API

### 5.1 prompt

```ts
type AgentPromptRequest = {
 sessionId: string;
 content: string;
 attachments?: AgentPromptAttachment[];
 /** 在追加之前将持久化转录截断为前 N 条消息（重新生成）。 */
 truncateBefore?: number;
 /** 渲染器快照，用于关闭从 prompt 到完成的通知竞态。 */
 viewingSessionId?: string | null;
};

type AgentPromptAttachment = {
 path: string;
 name: string;
 kind: "image" | "file";
 mimeType?: string;
 size?: number;
};

type AgentPromptResponse = {
 accepted: boolean;
 turnId: string;
};
```

斜杠模板展开（D123）：当 `content` 以 `/name` 开头，并且该名称匹配已加载的 pi 提示模板时，主进程处理器会在持久化之前展开该调用（`parseCommandArgs` + `substituteArgs`）。持久化的用户消息存储 `content = expanded text`，外加一个可选的 `command: string` 字段，携带所键入的调用以供转录显示。重新载入时会重放 `content`，因此代理上下文在重启之间保持一致。内置/插件斜杠别名绝不会到达此通道——渲染器会在本地执行它们。未知的 `/foo` 会作为字面内容通过。普通的 `@path` token 在流水线中任何位置都不会被转换（D124）。输入框持有的粘贴文件引用会单独放在 `attachments` 中传输；它们由 Electron 主进程在分发时验证和准备，因此粘贴的图片不依赖模型能否解释路径 token。

Prompt 执行会从持久化会话记录中解析 `mode`、`providerId`、`modelId` 和 `thinkingLevel`，并为 Bash 快照有效的命令 shell ID 和方言。
渲染器在会话空闲时通过 `pi-desktop/session/configure` 更改这些值：

```ts
type ThinkingLevel =
  | "off" | "minimal" | "low" | "medium"
  | "high" | "xhigh" | "max";

type SessionConfigureRequest = {
  id: string;
  mode: "plan" | "goal" | "agent";
  providerId?: string;
  modelId?: string;
  thinkingLevel: ThinkingLevel;
};
```

`session/configure` 仅在会话空闲时接受。当存在一个回合或 Plan/Goal 的 `pending`/`queued`/`running` 记录时，模式、供应商、模型、权限和 shell 默认值更改会被拒绝。渲染器可以在一个回合期间保持这些控件可编辑，但它会在本地排队最新的完整配置，并仅在终态事件之后调用此通道；正在运行的回合永远不会观察到这个乐观的下一回合选择。

只有发生变化的有效全局 `defaultCommandShell` 才是跨所有受影响会话的仅空闲操作：任何活动回合或 pending/queued/running 的 Plan/Goal 工作都会阻止该 shell 更改，而省略或幂等的 shell 字段不会。

`attachments` 是一个增量 prompt 字段。渲染器只发送元数据和源路径；它绝不发送二进制数据。Electron 主进程会针对会话 scratch/项目根验证路径，将图片字节持久化到内容寻址的附件存储中，并从 models.dev 记录推导出精确的模型传输方式。一个已知模型，如果其 models.dev 输入包含 `image`，则会以瞬态 pi-ai 图片块接收符合条件的图片。未知/非视觉模型以及超过 20 MiB 内联上限的图片会收到安全的 `@path` 回退。主进程对超过该上限的图片使用流式哈希和文件复制，sidecar 在重建历史时使用相同的限界读取规则。持久化的用户消息存储 `content` 加上附件元数据/引用，绝不为 base64。无效的附件路径会失败并返回 `PATH_OUTSIDE_WORKSPACE`。

重新生成历史（D109）也使用会话通道：

- `pi-desktop/session/saveRevision`
- `pi-desktop/session/listRevisions`
- `pi-desktop/session/activateRevision`

根用户回合可以包含 `revisionRootId`、`revisionCount` 和 `activeRevision`。激活一个修订会用 `prefix + archived branch` 替换实时尾部，并销毁会话代理。
sidecar 只接收当前回合所需的、已准备好的附件子集。在视觉运行时上，当重建历史时，持久化的图片引用会从会话绑定的附件/scratch 根中水合；过大或不可用的图片保留为路径回退。这使渲染器、主进程、sidecar、models.dev 目录和主机持久化处于同一个能力感知契约中。

### 5.2 在下一个回合边界停止

```ts
type AgentStopRequest = {
 sessionId: string;
 turnId?: string;
};

type AgentStopResponse = {
 requested: boolean;
};
```

`pi-desktop/agent/stop` 为活动运行时请求优雅停止。sidecar 在当前助手响应和完成的工具批次之后评估这个一次性请求，所处边界与它原本要开始下一个模型请求的边界相同。当前持久化回合随后发出 `agent_end`，并最终确定为 `completed`；该请求不会中止供应商流、取消正在运行的工具，也不会打开第二个并发回合。空闲会话返回 `requested: false`。

渲染器拥有每个会话可移除的内存中排队 prompt 列表。它仅针对排队项的**立即发送**操作调用此通道，并在终态事件之后通过普通的 `agent/prompt` 流释放该项。

### 5.3 中止

```ts
type AgentAbortRequest = {
 sessionId: string;
 turnId?: string;
};
```

中止请求和响应不携带输入框草稿或文件引用数据。
如果渲染器智能 Stop 撤销了一个未回答的用户回合，恢复来自渲染器的会话/回合作用域预序列化快照；现有的转录重写会移除已发送行，而不更改协议版本。该重写是根据完整持久化转录（`session.get` 不带窗口）与实时行合并计算得出的，绝不来自渲染器分页的、显示上限的窗口，并且会在该合并上重新评估：在中止和读取之间落地的回复行会将撤销转为结算（D299）。一个 Stop 如果发现已开始的回复，则仅在渲染器内存中将其结算（流式助手 → `aborted`，运行中的工具 → error），并且不执行转录重写；持久化副本是运行时自身的已中止最终行，或者如果该行从未到达，则是主机提升的进行中检查点。

### 5.4 compact（协议 v10）

```ts
type AgentCompactRequest = { sessionId: string };
type AgentCompactResponse = { accepted: boolean };
```

`pi-desktop/agent/compact` 为空闲会话创建一个模型上下文检查点。即使自动上下文保护被禁用，它也可用。缺少供应商/会话配置会通过正常的 `AppError` 信封失败；活动回合或压缩会返回 `AGENT_BUSY`。

### 5.5 Plan 和 Goal 检查点审批

契约审批与工具权限是分开的。Plan 和 Goal 共享整个表面；`kind` 是唯一的区分符（**D198**）。渲染器从同一个 Agent 接收主机写入的工件元数据，并通过类型化预加载 IPC 解析它；它绝不会乐观地更改会话模式。契约进入和提交仍然是 Agent/主机操作，而不是渲染器预加载方法。

```ts
type PlanningState = "inactive" | "planning" | "awaiting_approval";

type ProposalKind = "plan" | "goal";

type GlobalPermissionMode = "ask" | "accept-edits" | "auto";

type PlanApprovalAction = "approve" | "reject";

type PlanProposalStatus =
  | "pending" | "approved" | "rejected"
  | "expired" | "interrupted";

type PlanExecutionState =
  | "queued" | "running" | "completed" | "interrupted";

// SubmitPlan 和 SubmitGoal 的形状相同；工具名称决定 kind。
type SubmitPlanInput = {
  title: string;
  markdown: string;
  question: string;
};

type PlanArtifact = {
  relativePath: string; // `.pi/plan/<unique-name>.md` 或 `.pi/goal/<unique-name>.md`
  sha256: string;
  sizeBytes: number;
};

type PlanProposal = {
  id: string;
  sessionId: string;
  turnId: string;
  toolCallId: string;
  // 在区分符存在之前写入的旧版行读回为 `plan`。
  kind: ProposalKind;
  plan: string;
  markdown: string;
  title: string;
  question: string;
  status: PlanProposalStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  resolvedAt?: string;
  action?: PlanApprovalAction;
  targetPermissionMode?: GlobalPermissionMode;
  errorCode?: string;
  artifact?: PlanArtifact;
  version: number;
  executionId?: string;
  executionState?: PlanExecutionState;
};

type PlanExecution = {
  id: string;
  proposalId: string;
  sessionId: string;
  kind: ProposalKind;
  plan: string;
  title: string;
  question: string;
  artifact: PlanArtifact;
  targetPermissionMode: GlobalPermissionMode;
  state: PlanExecutionState;
};

type PlanningStateEvent = {
  sessionId: string;
  state: PlanningState;
  // 仅在携带无提案的 `inactive` 转换时缺失。
  kind?: ProposalKind;
  proposalId?: string;
  title?: string;
  markdown?: string;
  question?: string;
  artifact?: PlanArtifact;
  version?: number;
  plan?: string;
  action?: PlanApprovalAction;
  targetPermissionMode?: GlobalPermissionMode;
  executionId?: string;
  executionState?: PlanExecutionState;
  proposal?: PlanProposal;
};

type PlansPendingResult = {
  plans: PlanProposal[];
  state?: PlanningState;
  // 正在协商的契约，用于模式 chip 和审批文案。
  kind?: ProposalKind;
};

type PlanResolveIdentity = {
  proposalId: string;
  sessionId: string;
  turnId: string;
  toolCallId: string;
  version?: number;
};

type PlanResolveRequest =
  | (PlanResolveIdentity & {
      action: "approve";
      targetPermissionMode: GlobalPermissionMode;
    })
  | (PlanResolveIdentity & { action: "reject" });

type PlanResolutionResult = {
  ok: boolean;
  proposal: PlanProposal;
  state: PlanningState;
  action?: PlanApprovalAction;
  targetPermissionMode?: GlobalPermissionMode;
  execution?: PlanExecution;
};
```

预加载方法：

- `pi-desktop/plans/pending({ sessionId? }) -> PlansPendingResult`
- `pi-desktop/plans/resolve(PlanResolveRequest) -> PlanResolutionResult`

Electron 通过稳定的共享 `IPC.event.plansChanged` 通道（`pi-desktop/plans/event/changed`）将每个主机 `plans.changed` 通知原样转发给渲染器。这是 Plan/Goal 变更事件表面；渲染器不会以 AgentEvent 变体的形式接收契约审批转换。`plans.pending` 只返回当前待处理的审批行。终态 `plan_approvals` 行仍然是持久化的主机记录，但不会是渲染器水合数据；在有实时 `plans.changed` 事件到达时，渲染器仅针对当前渲染器生命周期保留其最新契约快照。

对于 `approve`，主机核心和 Electron 要求显式的 `targetPermissionMode`；Electron 绝不会从已存储的设置中填充它。渲染器将每个审批初始化为 Ask，这仍然是产品默认值，并且主机不会把该选择持久化为下一个审批默认值。`reject` 不携带权限模式。
带有错误提案、会话、回合、工具调用、版本或已过期的主机拥有截止时间的响应会失败并返回稳定的 Plan/Goal 审批错误。没有请求更改操作。

### 5.5 getStatus

```ts
type AgentActivity =
 | { phase: "starting"; since: number }
 | { phase: "waiting-model"; since: number }
 | { phase: "retrying"; since: number; attempt: number; retryDelayMs?: number }
 | { phase: "waiting-subagents"; since: number; subagentCount: number };

type AgentStatus = {
 sessionId: string;
 isRunning: boolean;
 currentTurnId?: string;
 modelId?: string;
 pendingToolConfirmations: number;
 activity?: AgentActivity;
};
```

## 6. 代理事件

从主进程 → 渲染器推送：

```ts
type AgentEventEnvelope = {
 sessionId: string;
 turnId?: string;
 ts: number;
 event: AgentEvent;
 /** 在子代理内部发出的事件上设置（D201、ADR 0062）：生成它的 `Task` 调用，以及定义名称。 */
 parentToolCallId?: string;
 agentName?: string;
};

type AgentEvent =
 | { type: "agent_start" }
 | { type: "agent_end"; messageIds: string[] }
 | { type: "turn_start" }
 | { type: "turn_end"; subagentUsage?: MessageUsage }
 | { type: "message_start"; message: UiMessage }
 | { type: "message_update"; message: UiMessage;
     deltaText?: string; deltaThinking?: string }
 | { type: "message_end"; message: UiMessage }
 | { type: "tool_start"; toolCallId: string; toolName: string; args: unknown }
 | { type: "tool_update"; toolCallId: string; partialResult?: unknown }
  | { type: "tool_end"; toolCallId: string; result: unknown; isError?: boolean;
      toolUsage?: ToolTokenUsage }
  | ({ type: "planning_state" } & Omit<PlanningStateEvent, "sessionId">)
  | { type: "tool_permission_request"; request: ToolPermissionRequest }
  | { type: "compaction_start";
     reason: "manual" | "threshold" | "overflow" }
 | { type: "compaction_end";
     reason: "manual" | "threshold" | "overflow";
     ok: boolean; tokensBefore?: number; firstKeptMessageId?: string;
     willRetry: boolean; fallback?: "retained_tail";
     mark?: { id: string; throughMessageId: string;
              generation: number; summaryTokens: number;
              summarized: boolean };
     error?: { code: string; message: string } }
 | { type: "error"; error: AppError }
 | { type: "status"; status: AgentStatus };
```

> 这些是**UI 规范化事件**，不是对原始 pi 事件的透传。
> `packages/agent-runtime` 负责将 pi 事件映射到此模型。

`status` 事件在回合活动期间包含可选的运行时拥有的 `activity` 阶段。`waiting-model` 标记运行时已启动供应商请求之后、第一个助手事件到达之前的时间间隔；`retrying` 标记可中止的供应商退避，并包含重试尝试；`waiting-subagents` 标记父回合正在等待委派工作。渲染器按会话保留此状态，并将其渲染为紧凑的内联行。当助手或工具活动开始时，或者当回合到达终态事件时，该阶段会被清除。这些阶段用于解释安静间隔；它们不会替换消息/工具生命周期事件，也不意味着完成百分比。

`planning_state` 是 agent-runtime 的本地规划投影。其可选提案和执行字段镜像共享的 `PlanningStateEvent` 形状（`proposal`、`executionId` 和 `executionState`）。完整的已批准执行描述符使用 `PlanExecution`，并由主机结果/通知携带。权威的主机审批/队列转换是通过 `IPC.event.plansChanged` 转发的单独 `plans.changed` 通知。
`tools.output` 是主机通知，在 Bash 工具运行期间由 `packages/agent-runtime` 消费；它不是 AgentEvent。

`turn_end` 结束一个模型/工具回合，但不是桌面运行的终态事件：另一个供应商请求可能立即跟随。因此渲染器忙碌状态和持久化回合完成仅在 `agent_end` 或 `error` 上结算。压缩始终是内联的：`compaction_start` 使运行保持忙碌，手动操作在其匹配的 `compaction_end` 上结算，阈值/溢出压缩保持在活动代理运行内部。没有需要区分的预计算阶段（D203）。

只要安装了检查点，`compaction_end.mark` 就会出现。它是渲染器对该次压缩的全部视图：`id`、转录行所在的 `throughMessageId` 锚点、`generation`（该会话已安装多少检查点）、`summaryTokens`（摘要的估算上下文成本）以及 `summarized`（当窗口滚转而没有向模型请求摘要时为 `false`）。记录本身不会被携带——其摘要和保留尾部远大于事件应有的规模——而是在会话打开或 fork 时从 `SessionDetail.compactions` 读取。

自动摘要失败可能仍会产生成功的生命周期事件，并带有 `fallback: "retained_tail"`；这意味着安装了一个持久化的、严格限界的尾部检查点，运行可以在减少历史上下文的情况下继续。手动压缩绝不会静默回退。

供应商 `error` 事件可以在 `AppError.details` 中包含有界诊断字段：`phase`（`request` 或 `stream`）、`providerStatus`、`providerCode`、`providerWaitMs`、`streamMs` 和 `retryAttempt`。这些字段是增量且经过脱敏的；它们绝不携带凭据或无限制的供应商响应。瞬态流失败可以在同一回合内重放一次，而不会产生终态 `error` 事件或重复的助手消息。第二次失败会发出终态规范化 `STREAM_FAILED` 错误。

## 6a. 通知 API（D117，协议 v4）

持久化收件箱请求是允许列表中的预加载调用，由 Electron 转发到单一主机 RPC 域，渲染器无法访问 SQLite：

- `pi-desktop/notification/list({ unreadOnly?, limit? })`
- `pi-desktop/notification/markRead({ id })`
- `pi-desktop/notification/markAllRead()`
- `pi-desktop/notification/clear()`

每当聊天页面的活动会话发生变化时，渲染器调用
`pi-desktop/notification/setViewingSession({ sessionId })`；在非聊天页面上，`sessionId: null` 会清除查看上下文。渲染器发起的 `agent/prompt` 也携带匹配的 `viewingSessionId` 快照，Electron 会在异步回合设置之前安装它，以便快速完成不会抢在查看上下文更新之前。Electron 在终态事件边界将此提示与主进程拥有的窗口可见性/焦点结合起来。缺失、null 或不匹配的上下文会安全地回退为创建通知。它还在本地化一条新记录后调用
`pi-desktop/notification/showNative({ id, sessionId, kind, title, body })`，其中 `kind` 为 `"task" | "interactive"`。此仅 Electron 请求绝不会进入主机 RPC 域。

```ts
type AppNotification = {
  id: string;
  kind: "task.completed" | "task.failed";
  sessionId: string;
  sessionTitle: string;
  turnId: string;
  errorCode?: string;
  createdAt: string;
  readAt?: string | null;
};

type NotificationListResult = {
  notifications: AppNotification[];
  unreadCount: number;
};

type NotificationChangedEvent = {
  notification: AppNotification;
};

type NotificationActivatedEvent = {
  id: string;
  sessionId: string;
};
```

主进程发送两个事件：

- `pi-desktop/notification/event/changed` 在 `session.endTurn` 返回新插入的记录之后。渲染器将该记录合并到其有界本地列表中，并重新计算准确的未读数。已在聚焦的当前聊天中可见的终态结果、重复的终态更新以及已中止的回合不会发出任何内容。
- `pi-desktop/notification/event/activated` 在用户点击 Electron 的原生系统通知之后。渲染器遵循其现有的会话选择路径，包括对项目绑定会话的项目激活。

Electron 拥有原生表面，而渲染器从结构化记录派生本地化的标题/正文文本。Electron 仅对有效的通知/会话对接受 `showNative`。对于 `kind: "task"`，它仅在主窗口未聚焦时显示原生通知；对于 `kind: "interactive"`，它保留精确可见会话抑制，同时允许一个已聚焦的后台会话发出警报。在这两种情况下，平台 API 都是尽力而为的，并且已显示的通知会在发出 `activated` 之前恢复/显示并聚焦窗口。没有权限、计划提醒或插件来源进入任务通知契约。原生投递是尽力而为的；当操作系统抑制横幅时，持久化收件箱仍然是权威。在 Windows 上，Electron 主进程在就绪之前、任何窗口创建之前，将 `com.pi-desktop.app` 注册为进程 AppUserModelID。该 ID 与 NSIS 包身份匹配，因此通知归属、通知设置、任务栏分组和已安装快捷方式都会解析为 `PI-Desktop`，而不是原版 Electron 宿主。

查看会话提示是建议性的且安全失败：缺失、陈旧、隐藏或未聚焦的渲染器状态会创建持久化通知。只有当主窗口可见且已聚焦，并且报告的聊天会话与完成会话匹配时才会抑制。窗口创建、渲染器重载和渲染器进程丢失会在评估任何后续终态事件之前清除该提示。

## 7. 会话 API

```ts
type SessionSummary = {
 id: string;
 title: string;
 messageCount: number;
 projectPath?: string;
 modelId?: string;
 providerId?: string;
  mode: "plan" | "goal" | "agent";
 thinkingLevel: ThinkingLevel;
 supportsReasoning?: boolean;
 supportedThinkingLevels?: ThinkingLevel[];
 updatedAt: string;
 createdAt: string;
};

type UiMessage = {
 id: string;
 role: "user" | "assistant" | "system" | "tool";
 content: string;
 thinking?: string; // 助手推理，绝不合并到 content 中
 usage?: MessageUsage; // 供应商报告的助手用量
 responseDurationMs?: number; // 用于吞吐量的模型流持续时间
 responseOutputTokens?: number; // 当 stop 没有最终用量时估算的部分输出
 toolName?: string;
 toolCallId?: string;
 toolArgs?: unknown;
 toolResult?: unknown;
 toolUsage?: ToolTokenUsage; // 估算的工具调用/结果占用
 error?: AppError;  // 此助手回合拥有的结构化失败
 createdAt: string;
 // 在子代理内部生成的行（D201、ADR 0062）；会话自身的行上不存在
 parentToolCallId?: string;   // 生成该委托的 `Task` 调用
 agentName?: string;          // 委托定义名称
 // 此处省略 status/tool 字段
};

type ToolTokenUsage = {
 argumentTokens: number;
 resultTokens: number;
 totalTokens: number;
 estimated: true;
};

type SessionDetail = SessionSummary & {
  messages: UiMessage[];
  /** 当渲染器收到有界页面时的从零开始的起始偏移量。 */
  messageStart?: number;
  /** 当可以使用 session.get 请求更旧的页面时为 true。 */
  hasMoreBefore?: boolean;
};
```

`messageCount` 是当前规范转录中消息的主机权威计数。渲染器用它来区分空持久化会话与标题仍看起来未命名的会话；标题文本不是会话状态信号。

Electron 主进程从本地 models.dev 记录中，为该会话精确的供应商/API URL 和模型，用有效的推理能力丰富会话 list/get/create/fork/configure 结果。没有固定 `providerId`/`modelId` 的会话仅为此丰富目的继承应用默认供应商/模型；持久化 id 保持未设置，因此后续默认模型更改仍然适用。快照中不存在的 ID，或者没有可解析默认值的会话，会得到 `supportsReasoning: false` 和 `off`；缓存/供应商声明不会替换目录语义。Rust 主机仅对持久化 `thinkingLevel` 保持权威。

全局插件启动器使用仅 Electron 的允许列表通道：

- `pi-desktop/pluginLauncher/toggle` 显示或隐藏居中的实用工具窗口
- `pi-desktop/pluginLauncher/dismiss` 仅当由该窗口调用时隐藏它
- `pi-desktop/pluginLauncher/event/shown` 在每次调用后重置其查询、重新加载已安装插件并恢复输入焦点

启动器复用 `plugin/list` 和 `plugin/openPanel`；它不添加主机核心插件 RPC。Electron 主进程还调用增量主机方法 `keyboard.setGlobalShortcut({ binding })`，为保留的 `Alt+Space` 绑定启用仅 Windows 的回退。当主机核心的低层 Windows 键盘钩子检测到该组合键时，会发出通知 `keyboard.shortcut({ binding: "Alt+Space" })`；该钩子消费该组合键，以便活动窗口系统菜单不会打开。非 Windows 主机将该方法视为空操作。`responseDurationMs` 和 `responseOutputTokens` 是持久化在消息元数据中的可选转录元数据，因此协议 v11 和存储 schema v13 保持不变。

设置字体选择器（ADR 0083）通过一个仅 Electron 的允许列表通道读取已安装的系统字体族：

- `pi-desktop/app/systemFonts` 返回已安装系统字体族名称的 `string[]`（Electron 主进程中的平台工具——macOS 上仅作为回退的 `system_profiler`，其中 `osascript` JXA 将快速 CoreText 查询 `CTFontManagerCopyAvailableFontFamilyNames` 作为主路径进行桥接，Windows 上使用 PowerShell，Linux 上使用 `fc-list`），去重、排序，并排除隐藏的以 `.` 为前缀的字体族。主进程将结果缓存 60 秒；失败时解析为 `[]`。主机 RPC 和协议版本保持不变。

最小接口：

- `session/list`
- `session/create`
- `session/fork({ sessionId, title?, throughMessageId? }) -> { session: SessionDetail }`
- `session/get({ id, messageBefore?, messageLimit?, contentLimit? })` — 不带读取窗口选项时返回完整的 UI 投影；带这些选项时返回有界的最新/更旧页面以及 `messageStart` 和 `hasMoreBefore`。内容限制仅适用于显示值，绝不更改无损转录或模型上下文。`messageBefore` 和 `messageStart` 是转录文件中的物理消息行位置，而不是去重后的索引计数。
- `session/delete`
- `session/rename({ id, title }) -> { ok: boolean }` 修剪标题并接受 1–80 个 Unicode 码点。空白或过长的标题会作为 `INVALID_PARAMS` 被拒绝；成功重命名仅更改会话元数据，不改变转录内容、消息计数或活动时间戳。
- `session/summarizeTitle({ sessionId, userPrompt, assistantReply? }) -> { title }` 在 Electron 主进程中验证会话和 prompt，解析该会话的供应商/模型，并运行一次 `thinkingLevel: "off"` 的一次性补全。它本身从不写入标题；渲染器仅在会话仍具有默认或首个 prompt 回退标题时，通过 `session/rename` 应用结果。一次性失败会使该回退标题保持不变。
- `session/importScan`
- `session/importRun(candidates) -> { imported, skipped, failed }`
- `modelConfig/importScan -> { providers }`
- `modelConfig/importRun(candidates) -> { imported, skipped, failed }`

导入候选项携带 `projectPath: string | null`。成功导入会刷新会话和持久化 Projects 索引。

`modelConfig/importScan` 从用户主目录读取 Claude Code、Codex、OpenCode、Pi 和 CC Switch 配置文件，并返回公开供应商草稿（`source`、`externalId`、`name`、`baseUrl`、`apiStyle`、`modelIds`、`hasSecret`）。密钥保留在主进程扫描缓存中，并在 `modelConfig/importRun` 时通过 `providers.create` 写入。重新导入匹配的端点、API 风格和凭据会被跳过；同一端点上的不同凭据保持独立。来自这些工具的 OAuth token 绝不会被复制。没有主机协议或存储 schema 版本提升。

重新生成或编辑重发会在追加新的用户回合之前截断持久化转录。`agent/prompt` 接受 `truncateFromMessageId`——要丢弃的第一条消息的身份——主机根据自己的转录解析它；无法解析的 id 会以 `NOT_FOUND` 被拒绝，而不是在猜测位置切割。较旧的 `truncateBefore` 计数仍然被接受，但只有当调用方持有完整历史时才正确：显示有界窗口的渲染器所处理的消息与转录不同。

`session/fork` 是一个协议 v5 通道，它从源会话的当前活动转录创建一个独立会话。当可选 `throughMessageId` 存在时，复制的快照在该消息处结束；未知 id 返回 `NOT_FOUND`。当该源会话存在活动回合时，Electron 以 `AGENT_BUSY` 拒绝该请求。Electron 拥有本地化并供用户可见的分支标题；主机回退标题保留给非 UI 调用方。
主机会分配新的会话 id、消息 id 和工具调用 id；它复制持久化的项目/供应商/模型/模式/thinking/权限配置，但不会复制回合、通知、工件、scratch 数据、权限授予或重新生成修订。源会话保持不变。
消息作用域的助手 Fork/Edit 使用此选项，以便子会话获得新的会话 id，因此无法复用或修改源 pi 运行时或其供应商缓存。

协议版本 9 添加检查点 Plan 契约：`SubmitPlan`、唯一的 `.pi/plan/*.md` 工件元数据、仅批准/拒绝的响应、绝对到期时间、`plan_approvals` 执行字段、shell 清单/身份字段以及流式 stdout/stderr 事件。v7 或更旧的主机，以及任何不兼容的 v8 对等端，必须使握手失败，这样桌面才不会在显示 Plan 的同时静默丢失工件、队列、shell 或策略边界。
`pi-desktop/agent/compact` 和 `session.appendCompaction` 仍然是 v9 契约的一部分。Goal 契约在 v9 内部是增量的（**D198**）：`kind` 在传输中是可选的，缺失意味着 `plan`，因此早于 Goal 的对等端可以继续工作，并且根本不会协商 Goal。

协议版本 2 添加 `thinkingLevel`、`UiMessage.thinking` 和 `message_update.deltaThinking`。v1 对等端必须使版本检查失败，而不是静默丢弃这些字段。

`UiMessage.error` 是一个可选增量字段。供应商失败会在 `message_end` 之前，将生命周期 `error` 事件携带的同一个规范化 `AppError` 附加到助手消息上。错误消息随转录持久化，但会被排除在恢复的模型上下文之外。

上下文检查器消费两个增量用量信号。`MessageUsage` 是供应商报告的助手用量，`responseDurationMs` 是用于显示每秒输出 token 的已耗时 sidecar 流时间。`ToolTokenUsage` 是根据工具调用参数和结果得出的运行时估算值；供应商不报告每个工具的分配，因此渲染器将这些行标记为估算值，并且绝不将它们合并到精确的供应商总量中。较旧的对等端可以省略所有这些可选字段，而不会破坏 v6 握手。

`turn_end.subagentUsage` 是同一持久化回合自上次发出 `turn_end` 以来已结算的子代理总量。父 `message.usage` 保持供应商报告的助手用量（D103）。Electron 将父消息用量加上 `subagentUsage` 汇总到 `session.endTurn.usage`。

### stats

- `pi-desktop/stats/getTokenUsageHistory({ startDate?, endDate?, bucket? }) -> TokenUsageHistoryResult`

`bucket` 为 `day` | `week` | `month`。省略日期时使用主机本地日历中的主机默认时间窗口（53 周 / 52 周 / 24 个月）。`week` 键使用 ISO 周年（`%G-W%V`）。结果会填充范围内的空桶。此通道不是设置页面；面向用户的仪表盘是插件 `pi.token-insights`（D335 / ADR 0173）。

## 8. 设置 / 密钥 API

### settings

可以返回给 UI 的非敏感配置：

- 供应商列表（不含密钥明文）
- 默认模型
- 来自主机 shell 清单的持久化 `defaultCommandShell`
- 持久化的 `largePasteThreshold`，用于超大纯文本输入框粘贴；主机将缺失值读取为 600，并接受从 1 到 1,000,000 的整数
- 权限策略开关
- UI 偏好设置，包括可选的 `AppSettings.keybindings` 覆盖，以共享快捷键操作 id 为键；值为 `null` 或可移植的 `Mod+Shift+Key` 字符串，并且不包含平台特定的原生加速键字符串。缺失条目使用平台默认值，而 `null` 是显式禁用/未绑定状态
- 可选的 `AppSettings.developerMode`；缺失和 `false` 都会使开发者工具保持禁用
- 可选的 `AppSettings.networkProxy`（`system` / `direct` / `custom` 加上代理 URL 和绕过列表）。缺失意味着 System。Custom 接受 `http`、`https`、`socks5` 和 `socks5h` URL。主进程立即应用 Chromium `session.setProxy` 和 Node 环境变量；代理 sidecar 会重新配置而无需重启进程。`pi-desktop/network/testProxy` 通过提供的配置运行一次有界的 Chromium 请求，并且不会持久化它。

`settings.set` 接受部分设置对象。主机核心将提供的字段合并到已存储的应用设置中，因此省略的字段（包括 `defaultCommandShell`）会被保留。只有传入的 shell 字段会经过 shell 校验；空闲 Plan/配置门控仅在其有效 shell 会发生变化时运行。无关写入和当前有效 shell 的幂等写入在工作活动期间仍然被接受。旧版 `planApprovalPermissionMode` 会被忽略，并从当前读取和写入中剥离；它不会被暴露或重新创建。

### shell

```ts
type CommandShellId = "windows-powershell" | "cmd" | "git-bash" | "bash";

type CommandShellOption = {
  id: CommandShellId;
  label: string;
  dialect: "powershell" | "cmd" | "posix";
  available: boolean;
  isDefault: boolean;
};

type CommandShellCatalog = {
  configuredId: CommandShellId | null;
  effective: CommandShellOption | null;
  fallback: boolean;
  choices: CommandShellOption[];
};
```

预加载方法：

- `pi-desktop/commandShell/list() -> CommandShellCatalog`
- `pi-desktop/settings/set({ defaultCommandShell }) -> { ok: true }`

设置 shell 写入仅接受当前平台可用的 ID，并拒绝未知、不可用或错误平台的 ID。只有在所有会话和 Plan/Goal 工作都空闲时，才会接受真实的有效 shell 变更。如果持久化的 ID 之后变得不可用，清单会选择第一个可用的平台 shell，并设置 `fallback: true`；如果没有可用选项，Bash 会返回 `SHELL_NOT_FOUND`。
每个回合都会固定有效 ID 和方言。运行时传输这两个值；主机在权限评估之前和生成之前拒绝已更改的固定值，并返回 `COMMAND_SHELL_CHANGED`。

### secrets

- `secrets/set(providerId, apiKey)`
- `secrets/delete(providerId)`
- `secrets/has(providerId) -> boolean`

禁止：

- 将完整 API 密钥写入普通日志
- 在渲染器中长期持有 API 密钥明文

### 供应商账户（OAuth，D237/D240）

使用供应商订阅登录是 Electron 主进程的对话，因此它仅使用 IPC——主机协议版本保持不变。五个调用通道加一个事件通道：

- `pi-desktop/providers/oauth/vendors() -> { vendors: OAuthVendor[] }`
- `pi-desktop/providers/oauth/start({ vendorId }) -> { loginId }`
- `pi-desktop/providers/oauth/respond({ loginId, promptId, value? })` — 缺失 `value` 会取消该提示，从而中止流程
- `pi-desktop/providers/oauth/cancel({ loginId }) -> { ok: boolean }`
- `pi-desktop/providers/oauth/delete({ providerId }) -> { ok: true }` 删除一个 OAuth 账户的供应商行及其作用域凭据
- `pi-desktop/providers/oauth/event` 流式传输 `OAuthLoginEvent`

```ts
type OAuthLoginEvent = { loginId: string; vendorId: string } & (
  | { kind: "info"; message: string; links?: Array<{ url: string; label?: string }> }
  | { kind: "authUrl"; url: string; instructions?: string; opened: boolean }
  | { kind: "deviceCode"; userCode: string; verificationUri: string;
      intervalSeconds?: number; expiresInSeconds?: number }
  | { kind: "progress"; message: string }
  | { kind: "prompt"; request: OAuthPromptRequest }
  | { kind: "promptCancelled"; promptId: string }
  | { kind: "done"; providerId: string; accountLabel?: string }
  | { kind: "error"; message: string }
  | { kind: "cancelled" }
);
```

一个流程可能会在 `start` 回复之前就抛出其第一个事件——OpenAI Codex 在登录开始的同一 tick 中询问浏览器或设备码——因此渲染器必须在调用 `start` 之前订阅事件通道，在 `loginId` 未知时暂存到达的内容，并在回复落地后按顺序释放匹配的事件。在回复之后订阅会丢弃第一个提示，流程会永远等待一个没人看到过的问题。

`start` 还必须在每次尝试中仅调用一次，并且来自用户操作而不是 React effect——StrictMode 在挂载时运行 effect 两次，而第二次尝试会打开第二个浏览器并争用同一个本地回调端口。渲染器的会话对象保留它已投递的每个事件，并将其重放给后续订阅者，因此对话框可以挂载、卸载、再次挂载，而无需重启任何东西。主进程从自身一侧捍卫同一个不变量：对供应商的 `start` 如果其尝试仍在进行中，会取消该尝试，并等待其结束，然后才开始下一个。

每种流程形状——浏览器回调、设备码、粘贴的代码、供应商选择——都走这一个流，因此渲染器渲染到达的内容，而不是按供应商分支。`opened: false` 表示浏览器无法启动，用户必须复制链接。`promptCancelled` 表示流程自己回答了一个问题（一个抢在粘贴框之前的回调），因此输入必须自行消失。

这里同样禁止：任何事件都不携带 token、刷新 token 或授权码。`accountLabel` 是显示字符串。

## 9. 项目 API

- `project/open()`：系统目录选择器
- `project/openFolder(path)`：在系统文件管理器中打开已知项目目录
- `project/get()`：当前工作区
- `project/list()`：持久化项目记录，包括导入创建的条目
- `project/set(path)`：设置工作区
- `project/clear()`

返回：

```ts
type ProjectWorkspace = {
 path: string;
 name: string;
};

type ProjectRecord = {
 id: number;
 path: string;
 name: string;
 pinned: boolean;
 createdAt: number;
 lastOpenedAt: number;
};
```

## 10. 工具权限 API

当工具需要确认时：

1. 主进程发送 `tool_permission_request`
2. UI 显示确认卡片
3. UI 调用 `tool/resolvePermission`

```ts
type ToolPermissionRequest = {
 requestId: string;
 sessionId: string;
 toolCallId: string;
 toolName: string;
 argsPreview: unknown;
 risk: "low" | "medium" | "high";
 reason: string;
 /** 当子代理询问时的定义名称（D201、ADR 0062）；对于会话自身的调用则缺失，同时缺失的还有生成它的 `Task` 调用。 */
 agentName?: string;
 parentToolCallId?: string;
};

type ToolPermissionResolution = {
 requestId: string;
 decision: "allow-once" | "allow-session" | "deny";
};
```

一旦会话运行并行子代理，它就可以持有多个打开的请求。渲染器按会话将它们排队，并优先回答最旧的；解析契约保持不变，因为它已经以 `requestId` 为键（`04-ux/03-permission-ux.md` §6a）。

Plan 不会替换这个通用权限契约。Plan 的 `Bash` 调用使用正常的会话作用域权限流程：`ask` 和 `accept-edits` 会发出工具权限请求，而 `auto` 会在没有确认的情况下执行。Plan 审批是一个单独的状态转换，并且始终使用上面的 `plan` 方法。

## 11. 版本兼容性

- IPC/主机构建契约版本字段：`protocolVersion: 11`
- 破坏性变更必须提升版本并记录 ADR
- 渲染器和主进程在启动时校验版本；不匹配时提示升级/重新安装
- 协议 v4 添加通知记录、通道，以及携带通知的 `session.endTurn` 结果。v3 对等端会被拒绝，而不是静默丢失持久化完成/失败事件。
- 可选的查看会话调用和 `createNotification` 回合结束字段是 v4 的增量行为。较旧的调用方省略该字段，并保留创建通知的安全默认值。
- 协议 v5 添加必需的 `session/fork` 快照操作。v4 对等端会在聊天变为可交互之前被拒绝，而不是暴露一个只会在调用时失败的分支命令（ADR 0023）。
- 协议 v6 添加了持久化上下文检查点以及手动/生命周期通道。v5 对等端会被拒绝，因为静默省略检查点可能使下一个供应商请求不安全（ADR 0030）。
- 协议 v9 取代了更早的 v7 Plan 契约。它添加了 `SubmitPlan`、精确的唯一工件元数据、仅批准/拒绝的解析、30 分钟绝对到期时间、`plan_approvals` 执行状态、shell 选择和固定的 ID/方言，以及流式命令输出。v7/v8 对等端会在 UI 变为可交互之前被拒绝，因为它无法强制执行或表示此边界（ADR 0053/0054）。`SubmitGoal` 和可选的 `kind` 区分符随 v9 一起提供，不需要版本提升，因为缺失 `kind` 正好是 Goal 之前的行为。

## 12. 插件 API（主机 UI 侧）

最小接口：

- `plugin/list`
- `plugin/loadDev(path)`
- `plugin/reload(id)` — 从其存储路径重新加载已注册的开发插件，并刷新其权限上限
- `plugin/installFromPath(path)`
- `plugin/enable(id)`
- `plugin/disable(id)`
- `plugin/uninstall(id)`
- `plugin/getPermissions(id)`
- `plugin/setPermission(id, permission, allowed)`（可选的细粒度）
- `plugin/setScope(id, scope)`（D192）

返回的摘要：

```ts
type PluginSummary = {
 id: string
 name: string
 version: string
 enabled: boolean
 source: "installed" | "dev"
 status: "ready" | "error" | "disabled"
 errorMessage?: string
 permissions: string[]
 scope?: ActivationScope
}
```

## 12a. 用户 MCP 服务器 API（D193）

用户拥有的 MCP 配置按 id 存储为一个 JSON 文件，位于 `~/.agents/servers/<id>.json` 或 `<project>/.agents/servers/<id>.json` 下。
启用状态不会写入这些文件；主机核心将其存储在应用本地的 `<data>/agent-capabilities/mcp.json` 状态文件中。

- `mcp.list({ level, projectPath? })` → `{ servers: McpServerRecord[]; statuses: McpServerStatus[] }`
- `mcp.active({ projectPath? })` → 有效运行时列表
- `mcp.upsert(server)` — 在请求的层级创建或替换文件
- `mcp.remove({ id, level, projectPath? })`
- `mcp.setEnabled({ id, enabled, level, projectPath? })`
- `mcp.setScope` 仍然是兼容形状的调用；设置页面改为使用显式能力层级和本地状态

没有 `projectPath` 的项目级请求无效。`mcp.active` 在过滤禁用记录之前，会按 id 或不区分大小写的标签从全局集合中移除项目记录，因此禁用的项目记录仍会遮蔽全局记录。仅桌面的 `mcp/test` IPC 操作会强制执行一次连接测试，并将状态返回给 MCP 编辑器。

```ts
type McpServerStatus = {
 serverId: string
 state: "idle" | "connecting" | "ready" | "failed"
 toolCount: number
 toolNames?: string[]
 message?: string
 updatedAt: number
}
```

工具以 `mcp_<serverId>_<toolName>` 的形式到达代理，与插件桥接的 `plugin_` 命名空间不相交（D015）。

## 12b. 用户技能 API（D194）

用户技能是从 `~/.agents/skills` 和 `<project>/.agents/skills` 扫描到的 Markdown 文档。直接 Markdown 文件和传统 `<skill>/SKILL.md` 形状都接受。启用状态存储在 `<data>/agent-capabilities/skills.json` 中，绝不存储在文档中。目录 id 是 ASCII slug：当 frontmatter `name` 可 slug 化时使用它，否则对于 `SKILL.md` 使用技能目录名（不是诸如 `Downloads` 的暂存文件夹），否则使用稳定的 `skill-<hash>`，这样非 ASCII 标题仍会被列出。折叠的 YAML `description: >` / `|` 块会扁平化为目录一行简介。

- `skills.list({ level, projectPath? })` → `{ skills: UserSkillRecord[] }`
- `skills.active({ projectPath? })` → 有效运行时列表
- `skills.create(skill)`
- `skills.import({ path, level, projectPath? })` — 一个源文件会被物理复制到所选的 `.agents/skills` 目录中
- `skills.update({ id, ...skill })`
- `skills.read({ id, level?, projectPath? })` → `{ skill, body }`
- `skills.remove({ id, level?, projectPath? })`
- `skills.setEnabled({ id, enabled, level, projectPath? })`

列表包含从 frontmatter 派生的 `name` 和 `description`，不包含正文。
只有描述进入 prompt，正文在模型调用 `Skill` 时才获取（D174）。缺失的文件会从列表中移除，其本地状态会在下一次扫描期间清理。

## 12c. 子代理 API（D202）

用户拥有的子代理是仅全局的 Markdown 文档，位于 `~/.agents/subagents/<id>.md` 下。没有项目级子代理目录。
启用状态存储在 `<data>/agent-capabilities/subagents.json` 中，并且绝不会写入 Markdown 文件。

- `agents.list` → `{ subagents: UserSubagentRecord[] }`
- `agents.active` → 已启用的全局文档
- `agents.create(subagent)` — 重名会失败并返回 `SUBAGENT_INVALID`
- `agents.update(id, subagent)`
- `agents.read(id)` → `{ subagent, body }`
- `agents.remove(id)`
- `agents.setEnabled(id, enabled)`

Electron 的 `subagent/list` IPC 通道将同一个仅全局列表暴露给 设置 > 代理 > 子代理。运行时清单将这些全局用户文档与其内置项组合在一起；它不会扫描 `.pi/agents` 或任何项目能力目录。

## 12d. 能力级别与本地激活

技能和 MCP 管理调用使用：

```ts
type AgentCapabilityQuery = {
 level: "global" | "project"
 projectPath?: string
}
```

全局记录默认启用，并且可以有按项目覆盖。项目记录有其所属项目的状态。主机会在扫描时清理已删除文件的状态；删除全局文件会移除其所有项目覆盖。这些记录独立于插件 `ActivationScope`。

## 13. 命令面板 API

- `commandPalette/search(query)`
- `commandPalette/execute(commandId)`

命令来源：
- 内置命令
- 插件 contributes.commands

## 13a. 工作面板 API

工作面板通道是 Electron 主进程实现。用户驱动的工作区操作从 `workspace.get` 解析可见根，并且在没有可见根时安全失败。代理驱动的 BrowserPreview 路由通过 `session.get` 解析发起的对话，因此后台预览绝不会继承可见会话的工作区。

### workspace

- `workspace/diff()` → `WorkspaceDiff { repo, clean, files: DiffFile[], truncated? }`。
  这个旧版诊断通道可以检查当前工作树，但它不是 Review 的事实来源。Review UI 改为从转录工具结果读取消息拥有的审查记录，因此提交无法擦除已记录的更改。
- `workspace/review/rollback({sessionId, snapshotId})` →
  `ReviewRollbackResult`。主机在恢复快照之前验证当前工具后哈希；它返回 `rolledBack`、`alreadyRolledBack`、`conflict` 或 `unavailable`，并且绝不覆盖冲突的后续编辑。

### browser（D100，D333）

Chrome 和代理 CDP 位于捆绑插件 `pi.browser` 中，通过 `pi.browser.*` 提供。为 Plan 安全预览外观和 URL 回退保留的渲染器 IPC：

- `browser/openExternal({url?})` — 允许列表中的 http(s)/mailto，或省略时使用当前 guest URL
- 事件：`browser/event/state {url, title, isLoading, canGoBack, canGoForward}`
  （也会作为 `browser:state` 推送到插件视图）
- 代理预览事件：`browser/event/preview {sessionId, path?, url?}`。
  Electron 主进程验证该会话项目内的工作区 `path`，当该对话的插件视图可见时加载 guest，并且渲染器在匹配的运行时面板上下文中使用 `location` 打开 `plugin:pi.browser/browser`。后台会话的导航不会抢占可见 guest。

### fs（只读）

- `fs/list({path})` → 条目按目录优先排序；忽略 `.git`、
  `node_modules`，以及
  [15-workspace-ignore-rules](/zh-CN/spec/03-runtime/15-workspace-ignore-rules) 的默认忽略子集
- `fs/read({path, mimeType?})` → 文本（≤512KB）/ 图片 data URL（≤5MB）/
  二进制 / tooLarge。相对路径在工作区根内解析；
  `attachments/<sha256>` blob 以及已位于工作区、`<data_dir>/scratch/` 或 `<data_dir>/attachments/` 内的绝对路径，在 realpath 检查后也被接受（D334 / ADR 0172）。已知图片扩展名优先于 `mimeType`；无扩展名的 blob 仅接受图片 MIME 允许列表。路径穿越、`~` 和其他逃逸会被拒绝
  （`INVALID_ARGUMENT`）。
- `fs/readImageDataUrl({ref, mimeType?})` → `FsImageDataUrlResult`
  （带有 `dataUrl` 的 `image`，或 `missing` / `notImage` / `tooLarge`）。包含范围与 `fs/read` 相同。绝不返回非图片字节。仅渲染器使用；
  不是插件主机 API。
- `fs/reveal({path})` → 在 Finder 中显示。包含范围与 `fs/read` 相同。
- `fs/open({path})` → 使用操作系统默认应用程序打开。词法包含范围与 `fs/read` 相同（不包含读取所使用的额外 realpath 步骤）。
- `fs/list` 保持仅工作区；向外穿越会被拒绝
  （`INVALID_ARGUMENT`）。

## 13b. 桌面菜单与窗口 API

预加载暴露一个同步、只读的 `platform: NodeJS.Platform` 值，以便渲染器在首次绘制之前选择原生 macOS chrome 或无菜单的 Windows/Linux 无边框 chrome。

主进程到渲染器的应用命令使用一个允许列表事件：

```ts
type AppMenuCommand =
  | "newTask" | "openProject" | "openSettings"
  | "openCommandPalette" | "toggleSidebar"
  | "openHelp" | "openLogs" | "checkForUpdates";

event: menu/event/command { command: AppMenuCommand }

menu/rendererReady() -> { ready: true }
```

渲染器在调用 `menu/rendererReady` 之前订阅 `menu/event/command`。当原生菜单命令创建或重新加载窗口时，主进程会等待该确认，因此启动时机不会丢弃第一条命令。

渲染器拥有的 Windows/Linux 键盘快捷键通过 `menu/nativeAction` 执行缩放和全屏操作。保留的兼容表面还支持编辑和窗口操作。其请求限制为导出的 `NATIVE_MENU_ACTIONS` 元组；未知值会失败，而不是变成通用的主进程命令表面：

```ts
type NativeMenuAction =
  | "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll"
  | "reload" | "zoomIn" | "zoomOut" | "resetZoom"
  | "toggleFullScreen" | "minimize" | "toggleMaximize" | "close";

menu/nativeAction({ action: NativeMenuAction })
  -> { maximized: boolean; fullScreen: boolean }
```

开发者工具使用专用的主进程拥有门控，而不是通用的原生菜单操作：

```ts
devtools/toggle({ open?: boolean }) -> { open: boolean }
```

当 `AppSettings.developerMode` 不为 `true` 或不存在活动窗口时，主进程拒绝该请求。同一个已存储标志在所有平台上控制 F12，在 Windows/Linux 上控制 Ctrl+Shift+I，以及 macOS View 菜单角色。禁用该标志会关闭已打开的开发者工具窗口。

`window/control` 接受导出的 `WINDOW_CONTROL_ACTIONS` 元组：

```ts
type WindowControlAction =
  | "getState" | "minimize" | "toggleMaximize" | "close";

window/control({ action: WindowControlAction })
  -> { maximized: boolean }
```

在 Windows/Linux 上，`minimize` 执行原生操作系统最小化过渡，因此窗口仍保留在任务栏中，并可以在那里恢复。Windows/Linux 关闭仍然遵循下面持久化的关闭行为选择；是关闭路径，而不是最小化，可以将窗口隐藏到托盘。macOS 保持其原生 Dock/托盘最小化行为。

Windows/Linux 关闭行为（D230，ADR 0090）通过两个增量主进程拥有通道读取和写入。`closeBehavior/get` 返回持久化偏好以及平台是否支持它（macOS 保持原生 Dock 生命周期并报告 `supported: false`）；`closeBehavior/set` 接受可设置的 `CloseBehavior`（`tray` 或 `quit`）并持久化它：

```ts
type CloseBehavior = "ask" | "tray" | "quit";

window/closeBehavior/get -> { behavior: CloseBehavior; supported: boolean }
window/closeBehavior/set({ behavior: "tray" | "quit" })
  -> { behavior: "tray" | "quit" }
```

`ask` 是 `get` 报告的瞬态未设置状态；它永远不可设置——首次关闭会提示一次，而一旦存在选择，就可以切换它，但不能恢复为提示。`ask` 和未知值会以 `INVALID_ARGUMENT` 失败，而不是被强制转换，并且 `set` 在 macOS 上也会以同样方式失败，因为那里没有可配置的关闭行为。设置行为不会触碰托盘图标：D216（ADR 0078）在启动时在每个平台创建一个托盘图标，并且无论存储哪种关闭行为，最小化到托盘都需要它。

最大化/取消最大化更改还会发出
`window/event/maximized`。未知操作会失败。这些仅 Electron 通道不会进入主机核心，也不会更改主机 RPC 协议版本。
预加载有意不暴露任意的 BrowserWindow 调整大小通道。
插件面板 chrome 使用单独的 Electron 本地
`pi-plugin-panel-window-control` 通道，具有相同的四个语义操作，
但处理器严格从发送方的活动面板窗口解析目标。预加载在其闭合 Shadow DOM 标题栏内部消费此通道；它不会被添加到 `window.pluginBridge` 或共享主机协议。
工作面板几何接缝为 Electron 兼容性而保留，但面板由渲染器拥有，并且绝不会更改原生窗口边界（ADR 0151）：

```ts
window/setWorkPanelReservation({ width: 0 | number })
  -> { requested: number; reserved: number }
```

`width` 必须是一个有限整数 JSON 数字，等于 `0` 或位于闭区间 `244..720` 内。字符串、布尔值、null、小数值和其他格式错误的负载会以 `INVALID_ARGUMENT` 失败，而不是被强制转换。内部停靠会将每个有效请求规范化为零，并返回 `{ requested: 0, reserved: 0 }`；正值仅作为向后兼容的空操作被接受。重复请求绝不会更改原生边界。

旧版聊天宽度/事件形状仍然是 Electron 本地兼容表面，但可见的内部停靠不会调用它们，也不会使用它们来调整窗口大小：

```ts
window/setWorkPanelChatWidth({ width: number })
  -> { requested: number; applied: number }

window/event/workPanelResize
  -> { phase: "preview" | "commit"; panelWidth: number }
```

`window/setWorkPanelChatWidth` 和 `window/event/workPanelResize` 仅对较旧的 Electron 调用方可用。当前渲染器分隔条会在本地更改持久化的 `244..720px` 面板宽度，而原生窗口边缘会调整固定应用窗口的大小，而不更改该面板目标。原生 Browser 视图继续跟随渲染器测量的面板矩形。
因此，窗口边界持久化和显示协调在普通应用边界上操作；没有面板特定的宽度或 x 偏移预留，并且后台工件无法更改可见窗口几何形状。

## 13c. 输入框输入 API（D123/D124/D197，ADR 0024/0059）

支撑输入框自动补全和文件引用的仅 Electron 通道。
`composer/commands` 和 `fs/index` 是只读的并且软失败；
`composer/pickFiles` 打开输入框所使用的统一原生选择器，并返回一次性 token；旧版 `composer/pickPhotos` 通道为兼容性而保留，但不由输入框 UI 暴露。
`composer/importFiles` 和 `composer/pasteFiles` 只写入发起会话的 Electron 拥有 scratch 目录。两者都不添加主机 RPC 方法，也不更改主机协议版本。渲染器提供的绝对源路径绝不被选择器导入通道接受（ADR 0181）。

### composer/commands

```ts
composer/commands() -> { commands: ComposerCommand[] }

type ComposerCommand = {
  /** 在 "/" 后输入的斜杠名称，在合并列表中唯一。 */
  name: string;
  kind: "template" | "builtin" | "plugin";
  title: string;            // 显示标题（模板：name）
  description?: string;     // 模板 frontmatter / 调色板标题
  argumentHint?: string;    // 模板 frontmatter `argument-hint`
  source?: "project" | "user"; // 模板来源
  id?: string;              // 用于执行的内置/插件调色板 id
};
```

模板从 `<workspace>/.pi/prompts/*.md` 和
`~/.pi/agent/prompts/*.md` 加载（项目在名称冲突时胜出；短 TTL 缓存）。
没有工作区时，只返回用户全局模板、内置命令和插件命令。

### fs/index

```ts
fs/index() -> { entries: FsIndexEntry[]; truncated: boolean }

type FsIndexEntry = { path: string; kind: "file" | "dir" };
```

用于 `@` 菜单的工作区根相对路径：`git ls-files -co
--exclude-standard` 快速路径、忽略集递归遍历回退、从文件路径派生的目录、8000 条目上限并以 `truncated: true` 标记、每个根短 TTL 缓存。没有工作区时安全失败为空列表。模糊过滤在渲染器侧进行。

### composer/pickFiles 和 composer/pickPhotos

```ts
composer/pickFiles() -> { token: string | null; canceled: boolean }
composer/pickPhotos() -> { token: string | null; canceled: boolean }
```

两个对话框都在 Electron 主进程中运行。输入框使用 `pickFiles` 作为其单一文件/图片入口：它接受常规文件而不进行类型过滤，导入器根据 MIME/扩展名元数据将每个结果分类为图片或文件。
`pickPhotos` 保留为较旧渲染器客户端的兼容通道。
目录不属于 MVP 选择器契约。当用户选择文件时，主进程将原生路径与绑定到调用 `WebContents` 的 token 关联存储，有效期为 60 秒，并且一次性消费。渲染器接收该 token，但绝不接收所选的绝对路径。

### composer/importFiles

```ts
composer/importFiles({ sessionId, token }) -> {
  files: ComposerPastedFile[];
}
```

Electron 主进程消费发送方绑定的选择器 token，通过 `realpath` 解析每个记录的路径，要求存在一个常规文件，应用与剪贴板传输相同的 20 文件 / 每文件 64 MiB / 总共 128 MiB 限制，并将字节复制到 `<data_dir>/scratch/<sessionId>/pasted/` 下，使用 UUID 支持的清理后名称。token 在导入开始之前被删除，因此无法重放。返回的 `ComposerPastedFile` 记录是渲染器存储或分派的唯一路径，因此选择器选择无法在 prompt 中留下外部源路径，也无法绕过附件根边界。

### composer/pasteFiles

```ts
composer/pasteFiles({ sessionId, files }) -> {
  files: ComposerPastedFile[];
}

type ComposerPasteFile = {
  name?: string;
  mimeType?: string;
  /** 为生成的大文本粘贴设置，以便主机拥有的剪贴板历史可以保留该文本。 */
  recordHistory?: boolean;
  data: ArrayBuffer;
};

type ComposerPastedFile = {
  path: string;     // UUID 支持的绝对存储路径
  name: string;     // 清理后的原始叶子显示名称
  kind: "image" | "file";
  mimeType: string;
  size: number;
};
```

Electron 主进程验证 `sessionId` 解析为持久化主机会话，将请求限制为 20 个文件、每文件 64 MiB、总共 128 MiB，剥离渲染器提供的目录组件，并以独占创建语义将唯一名称写入 `<data_dir>/scratch/<sessionId>/pasted/` 下。渲染器将返回的路径和 kind 元数据保存在瞬态引用状态中，显示 `name`，并通过 `AgentPromptRequest.attachments` 提交它们。
主进程按 SHA-256 持久化图片字节，并且仅当所选模型无法将该图片作为视觉块接收时，才添加路径回退。剪贴板字节绝不会作为 base64 进入持久化 prompt 或主机代理消息。
无效会话以及格式错误/过大的负载会以 IPC 错误失败，并且该操作无法写入工作区。

### clipboard/recordPaste

```ts
clipboard/recordPaste({ text }) -> { ok: true }
```

这个从渲染器到主进程的通道仅从主应用窗口接受，并记录该窗口用户发起的输入框粘贴事件已经提供的文本。它绝不读取操作系统剪贴板。空文本会被有界历史存储忽略。

### prompt/enhance

```ts
prompt/enhance({
  sessionId?: string | null;
  draft: string;
  providerId?: string;
  modelId?: string;
  thinkingLevel?: ThinkingLevel;
}) -> { enhancedDraft: string }
```

这是一个独立的、一次性补全，没有会话历史、工具或附件。Electron 主进程解析供应商/模型和凭据，因此渲染器绝不会接收到密钥。空草稿、斜杠命令草稿、缺失模型和供应商失败都会返回通用 `Result` 错误信封。

### app/openFeedback（D313）

```ts
app/openFeedback() -> { ok: true }
```

Electron 主进程构建一个固定的 GitHub 缺陷表单 URL
（`https://github.com/vastsa/PI-Desktop/issues/new?template=bug_report.yml`），并使用 `shell.openExternal` 打开它。查询字段 `app-version`、`os` 和 `environment` 从主进程拥有的版本信息填充。渲染器无法提供 URL。如果构造结果离开该来源或模板，则会被拒绝。
此通道不会进入主机核心，也不会更改主机 RPC 协议版本。

## 14. 错误码 — 初始注册表（可扩展）

| code | 含义 |
|---|---|
| `AGENT_BUSY` | 当前会话已经有一个正在运行的回合 |
| `AGENT_NOT_FOUND` | 会话不存在 |
| `MODEL_NOT_CONFIGURED` | 没有可用模型 |
| `PROVIDER_SECRET_MISSING` | 缺少 API 密钥 |
| `TOOL_DENIED` | 权限被拒绝 |
| `TOOL_TIMEOUT` | 工具超时 |
| `WORKSPACE_REQUIRED` | 需要项目目录 |
| `PATH_OUTSIDE_WORKSPACE` | 在显式的外部路径权限决策之前，路径越界 |
| `INTERNAL` | 未分类的内部错误 |
