# ADR 0052：Plan 运行状态与审批边界

> **翻译说明：** 本页是与 [英文源决策](/adr/0052-plan-operating-state-and-approval-boundary) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已被 ADR 0053 取代
- 日期：2026-07-30
- 基线：`0.4.13`
- 协议：v7
- 存储 schema：v8

ADR 0053 用主机写入的不可变唯一 `.pi/plan/*.md` 工件取代了本检查点，改为仅支持批准/拒绝的决议，沿用现有的 `plan_approvals` 工件/执行字段，并引入无重放的启动中断围栏。下文关于结构化提案/请求修改的细节，作为该已被取代设计的历史背景保留。

## 背景

PI-Desktop 此前的产品选择器把 Chat 和 Agent 视为两种工具配置档。这套术语使规划工作流变得含糊：一个 plan 可能被描述为另一个代理、一个规划器模型，或一种只读权限模式。这些解读要么会重复 pi 运行时，要么把授权放进渲染器。

所要求的工作流是单个 pi Agent：它可以检查任务、提交结构化 plan、等待独立的用户决策、根据反馈修订，并且只在获得审批后继续执行。该工作流横跨持久化会话模型、pi 工具组合、Rust 授权、主机 RPC、渲染器 IPC、插件注册、存储恢复和定时执行。

## 决策

### 1. 一个 Agent，两种运行状态

产品选择器恰好是 `Agent | Plan`。每个会话只有一个 pi Agent。Plan 是该 Agent 进入规划状态后的形态；它不是第二个 Agent、规划器服务、规划器模型或权限模式。对于新会话和新的定时任务，Agent 仍是默认值。

持久化会话模式为 `agent | plan`。实时规划状态是持久化模式、运行时和主机审批记录的投影：

```text
Agent / inactive
  -> Plan / planning
  -> Plan / awaiting_approval
  -> Agent / inactive（审批后，同一 Agent 继续）
```

用户可以在空闲时选择 Plan。同一 Agent 也可以在执行期间调用 `EnterPlanMode`。两条路径都收敛到同一个由主机校验的 Plan 状态。`ExitPlanMode` 提交结构化 plan，并且是其批次中唯一允许的助手工具调用。

渲染器内部的 `page = "chat"` 值可以保留为对话界面的路由。它不是运行状态，不得出现在模式选择器、模式命令或授权决策中。

### 2. 主机持有的持久化权威

Rust 主机核心对以下事项具有权威：

- 在每次工具调用时根据持久化的 `sessionId` 解析 `sessions.mode`；
- 在权限模式和授权之前强制执行 Plan/Agent 工具策略；
- 创建和解决持久化的 plan 审批记录；
- 以选定的权限模式提交 Plan → Agent 转换；
- 发出规范化的审批/状态事件，并应用超时/恢复处理；
- 定时/无人值守策略和稳定的错误码。

渲染器状态和 sidecar 模式字段属于投影或诊断上下文。由 Electron 或 sidecar 提供的冲突模式不能授权任何工具。过期的渲染器无法清除 Plan 或授予执行权限。

### 3. Plan 工具与权限策略

Plan 暴露：

- `Read`、`Glob`、`Grep` 和 `BrowserPreview`；
- `Bash`，受持久化权限模式管控；
- `ExitPlanMode`（该列表还曾包含 `CompactContext`，已由 ADR 0061 移除，并由 ADR 0064 以 `new_context` 恢复）。

无论权限模式、会话授权、清单风险或过期 IPC 状态如何，Plan 都拒绝 `Write`、`Edit`、所有插件工具和未知工具。Agent 保留现有的 `Read`、`Glob`、`Grep`、`Write`、`Edit`、`Bash` 和已注册插件策略。

Plan 保留权限模式选择。在 `ask` 和 `accept-edits` 下 Bash 会弹出确认提示；在 `auto` 下 Bash 无需确认即可运行，并可能修改工作区或临时目录。BrowserPreview 是显式的只读 UI 检查例外。因此 Plan 表达的是规划意图，而不是严格的只读安全配置。UI 必须说明这一权衡。

### 4. 独立的 plan 审批事务

`ExitPlanMode` 创建一行由主机持有的 `plan_approvals` 记录，包含请求、会话、回合、工具调用、结构化 plan、截止时间和 pending 状态。主机会发出该请求并等待一个内存中的一次性通道；该记录保留提案和最终结果，但不会让已终止的 Agent 变得可恢复。

审批不是通用工具权限。`plans.resolve` 只接受匹配的活跃请求/会话/回合。审批要求显式指定目标权限模式，在 UI 中默认为 `ask`，并以原子方式提交：

```text
BEGIN
  plan_approvals: pending -> approved
  sessions.mode: plan -> agent
  sessions.permission_mode: selected explicit mode
  追加审计记录
COMMIT
唤醒 ExitPlanMode
以 Agent 工具启动新的模型回合
```

请求修改要求反馈非空，记录该结果，将反馈作为 Plan 工具结果返回给同一 Agent，并让会话保持 Plan 状态。拒绝会记录结果、停止该次运行，并让 Plan 保持激活。

超时、中止、持久化失败、主机崩溃、sidecar 崩溃和过期响应一律按失败关闭。完整进程重启会把待处理的审批标记为 `interrupted`，中止相关联的回合，让会话保持 Plan 状态，并拒绝旧响应。渲染器重新加载时只能恢复由活跃主机等待者支撑的请求。

### 5. 迁移与协议

Schema v8 是一次事务性的 v7 迁移。它把持久化的会话模式、应用默认模式和定时任务模式值从 `chat` 映射为 `plan`，保留转录/回合/权限，新增 `plan_approvals`，并在失败时保持 schema v7 仍然有效。新默认值仍为 Agent。协议 v7 承载 `plan | agent` 联合类型、plan 状态事件、结构化审批事件，以及 `plans.pending` / `plans.resolve` RPC。

### 6. 定时任务与插件策略

在本版本中，Plan 仅限交互式使用。定时或无人值守的 Plan 运行会在向供应商发起请求之前以 `PLAN_REQUIRES_INTERACTIVE_SESSION` 失败；没有任何后台进程会展示或自动审批 plan。现有的定时 Chat 值会迁移为 Plan，并且在无人值守运行前需要显式切换为 Agent。

插件代理工具是仅限 Agent 的贡献。即使其清单风险较低或权限已授予，Plan 也会在主机边界隐藏并拒绝它们。插件命令和面板仍是显式的用户 UI 贡献，但不能成为模型可调用的 Plan 工具。

## 影响

### 积极影响

- 规划保留单一 Agent 上下文，避免第二个规划器生命周期。
- 持久化的主机授权无法被渲染器或 sidecar 状态绕过。
- 用户可以显式选择审批后的权限姿态。
- 反馈、恢复、迁移、插件拒绝和定时行为都可通过稳定的协议/存储契约进行观测和测试。

### 权衡

- Plan 不是严格的免修改模式，因为 Auto Bash 可以做出修改。这是有意为之，必须在产品文案和审批 UX 中明示。
- 完整进程崩溃会丢弃进行中的 Agent 等待；提案会以 interrupted 记录保留，但用户必须提交新的 plan。
- 协议和 schema 版本升级需要主机、sidecar、主进程、渲染器、迁移和兼容性工作的同步。

## 被否决的备选方案

### 第二个规划器 Agent 或模型

被否决，因为它重复上下文、引入第二个审批/运行时边界，并与反馈和审批必须返回同一 Agent 的要求相冲突。

### 把 Plan 作为权限模式或严格只读配置

被否决，因为规划意图与授权姿态是两回事。Plan 必须保留权限选择和 Bash 行为，包括 Auto 显式的修改权衡。

### 由渲染器持有的模式或审批状态

被否决，因为过期或伪造的 IPC 可能授予执行权限，而渲染器重新加载会丢失权威的状态转换。Rust 持有持久化模式、策略和审批身份。

### 通过命令文本分类在 Plan 中放行 Bash

被否决，因为通用 shell 命令无法被可靠地证明为只读。现有的权限模式是显式控制手段；Plan 对 Write/Edit/插件的拒绝仍是精确的工具策略。

## 相关文档

- `docs/spec/00-baseline.md`
- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/03-runtime/02-agent-runtime.md`
- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/03-runtime/04-data-storage.md`
- `docs/spec/03-runtime/05-host-core-rust.md`
- `docs/spec/03-runtime/06-host-rpc-protocol.md`
- `docs/spec/03-runtime/07-process-model.md`
- `docs/spec/03-runtime/08-error-codes.md`
- `docs/spec/03-runtime/10-session-state-machine.md`
- `docs/spec/04-ux/03-permission-ux.md`
- `docs/spec/04-ux/04-builtin-commands.md`
- `docs/spec/04-ux/06-settings-ia.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/04-ux/09-interaction-patterns.md`
- `docs/spec/05-security/01-security.md`
- `docs/spec/07-plugins/04-plugin-security.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md` (D188)
