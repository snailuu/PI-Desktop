# ADR 0053：计划检查点工件、审批与执行纪元

> **翻译说明：** 本页是与 [英文源决策](/adr/0053-plan-checkpoint-artifact-and-execution-epoch) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受，待实现
- 日期：2026-07-31
- 取代：ADR 0052 与 D188
- 基线：`0.4.14`
- 协议：v9
- 存储 schema：v10

## 背景

先前的 Plan 契约围绕一个结构化提案使用内存中的审批等待器，并允许
请求修改的反馈。它既没有给用户一个确切的、可检查的计划工件，也没有定义
已批准的执如何在无需重放的情况下被中断。计划审批必须足够持久，
以支持渲染器重新加载，但主机重启绝不能重放由旧宿主进程创建的工作。

## 决策

### 1. 一个代理与一个 Plan 提交工具

产品选择器仍为 `Agent | Plan`，Agent 为默认值，每个会话一个 pi 代理。Plan 是处于规划状态的同一个代理。Plan 暴露 `Read`、`Glob`、`Grep`、`BrowserPreview`、`Bash`、`EnterPlanMode` 和 `SubmitPlan`（在 ADR 0061 移除 `CompactContext` 之前它也曾暴露该工具，ADR 0064 则将其恢复为 `new_context`）；Write、Edit、插件工具和未知工具仍由主机拒绝执行。`SubmitPlan` 是其所在批次中唯一的助手工具调用，且仅对活跃的 Plan 回合有效。

输入精确为：

```ts
type SubmitPlanInput = {
  title: string;
  markdown: string;
  question: string;
};
```

不存在 `ExitPlanMode`、结构化步骤 schema、`proposedCommands` 字段或
`request_changes` 动作。修订即是在当前提案被拒绝或过期之后提交一个
新的 `SubmitPlan`。

### 2. 不可变的、由主机写入的计划工件

对于绑定项目的会话，主机核心会把提交的 Markdown 字节原样写入以下位置的新工件：

```text
<workspaceRoot>/.pi/plan/<unique-name>.md
```

目录和文件名由主机拥有。每次提交都会得到一个唯一文件；已接受的提交绝不替换更早的工件。输入中的 `title` 和 `question` 仍作为 `plan_approvals` 中的结构化字段保留；主机核心不会为 `markdown` 前置标题、追加问题小节、规范化换行符或添加任何其他包装。

主机核心会校验会话根目录，以不覆盖的方式创建文件，flush 精确字节，并在同一条审批记录中记录工作区相对工件路径、SHA-256 和字节大小。路径逃逸、符号链接歧义或写入失败都不会创建审批或执行描述符。

### 3. 审批与权限选择

审批卡片显示结构化标题和问题、指向主机创建的工件的打开入口、绝对过期时间以及当前状态。打开工件会读取不可变的 Markdown 文件；卡片无需内联 Markdown，也无需显示其哈希或字节大小。它只有 **Approve** 和 **Reject** 两个操作。Approve 需要显式的执行权限模式：`ask`、`accept-edits` 或 `auto`；UI 默认选择 `ask`。Reject 从不选择或授予执行模式。没有反馈字段，也不会因超时、重新加载、定时任务或陈旧的渲染器而产生隐式审批。

审批截止时间是自主机创建起的绝对 30 分钟期限。在主机仍存活期间，渲染器重新加载会保留原截止时间。过期会以规范错误 `PLAN_APPROVAL_TIMEOUT` 记录；卡片重新打开时截止时间永不延长。

### 4. 进程纪元栅栏与恢复

宿主进程有一个内部启动纪元，但它不会被序列化到数据库中，也不是协议字段。唯一的 `plan_approvals` 行同时承载审批状态和执行字段：

```text
status: pending -> approved | rejected | expired | interrupted
execution_state: queued -> running -> completed | interrupted
```

审批会以原子方式将会话切换为 Agent 并采用选定的权限模式，记录 `execution_id`，并设置 `execution_state = queued`；随后由同一个 Agent 启动执行回合。一个会话最多只能有一个待处理的 Plan 审批，且最多只能有一个排队中或运行中的执行。

启动后、处理任何 RPC 之前，主机核心会运行一个事务，把所有先前的 `pending` 审批标记为 `interrupted`，并把所有先前的 `queued` 或 `running` 执行状态标记为 `interrupted`；相关的运行中回合会被中止。任何审批、队列条目、供应商调用或工具执行都不会被重放。待处理审批被中断会让会话停留在 Plan。如果审批已将会话提交到 Agent，则中断其排队中或运行中的执行会让会话停留在 Agent；用户可以开始新的回合，而不会自动重新进入 Plan。

### 5. 回合与配置边界

每个会话只有一个活跃回合。当该回合或 Plan 运行处于活跃状态时，第二次提示词提交、第二次 Plan 提交、模式/供应商/模型/权限/shell 配置变更或第二次 Plan 运行都会被拒绝。会话配置仅在空闲时才被接受。对于待处理的 Plan 请求，审批操作是唯一启用的控制项。跨会话工作保留现有的会话级工作区和事件隔离。

### 6. 定时 Plan 策略

定时或无人值守的 Plan 执行会在供应商工作、工件创建、审批或队列插入之前被拒绝，错误为 `PLAN_REQUIRES_INTERACTIVE_SESSION`。定时任务必须先被显式改为 Agent，然后才能无人值守运行。

### 7. 版本化契约

协议 v9 承载 `SubmitPlan`、唯一的工件路径与元数据、批准/拒绝响应、绝对过期时间、执行状态、shell 选择以及流式命令输出。存储 schema v10 延续单一的 `plan_approvals` 检查点表，包含结构化标题/问题、工件字段、执行 ID/状态以及持久化的默认 shell 设置，同时保留现有的转录与会话数据。v8 到 v10 的迁移是事务性的；`PRAGMA user_version = 10` 最后写入。

## 后果

### 积极影响

- 每个提交的提案都有自己的主机所属文件，其字节可验证。
- 渲染器重新加载可恢复，而无需让主机重启重放工作。
- Agent/Plan 边界以及审批后的 Agent 状态都是显式的。
- shell 选择、输出、超时和取消可以共享同一套主机审计与回合边界。

### 权衡取舍

- 拒绝一个计划是终态的；修订需要另一个模型回合和一个新工件。
- 主机重启会中断即使是已批准、排队中或运行中的执行。
- Plan 工件会累积在 `.pi/plan/` 下；它们不可变，且不是渲染器拥有的草稿存储。

## 被否决的替代方案

### 请求修改式审批

因本次检查点而被否决，因为它把计划编辑与审批边界混在一起。修订是带有新工件哈希的新提交。

### 主机重启后重放持久化队列

被否决，因为持久化的执行请求可能比创建它的进程状态、工具身份、shell 身份和用户意图存活得更久。重启恢复仅支持中断。

### 由渲染器拥有或由 sidecar 写入的计划文件

被否决，因为工作区写入、路径校验、哈希、大小和审批身份必须由主机拥有。

## 相关文档

- `docs/adr/0054-selectable-command-shell-catalog.md`
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
- `docs/spec/04-ux/06-settings-ia.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/04-ux/09-interaction-patterns.md`
- `docs/spec/05-security/01-security.md`
- `docs/spec/06-delivery/02-acceptance-criteria.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md` (D189)
