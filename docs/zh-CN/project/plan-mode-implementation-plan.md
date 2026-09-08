# 计划检查点与 Shell 实施计划

> **翻译说明：** 本页是与 [英文源文档](/project/plan-mode-implementation-plan) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已于 2026-08-05 实施并接受
- 范围：计划检查点的批准/执行与可选择的命令 shell
- 核心运行时：每个会话一个 `@earendil-works/pi-agent-core` Agent
- 基线：`0.4.14`
- 宿主协议：v9
- 数据库 schema：v10
- 交付：M6 已完成；Host/no-replay、pending-restore 与 terminal-card 非水合证据已接受

## 1. 执行决策

PI-Desktop 继续运行一个 pi Agent。选择器为 `Agent | Plan`，默认是 Agent。Plan 是处于规划状态的同一个 Agent，而不是第二个规划器、模型、服务、权限模式或安全沙箱。

Plan 暴露 Read、Glob、Grep、BrowserPreview、Bash、CompactContext、EnterPlanMode 和 SubmitPlan。Write、Edit、插件工具和未知工具由 Rust 主机核心拒绝。Bash 遵循所选的权限模式，因此 Plan 是规划意图，而非严格的只读安全边界。

`SubmitPlan(title, markdown, question)` 是其助手批次中唯一的工具。主机核心将提交的 Markdown 字节原样写入 `<workspaceRoot>/.pi/plan/*.md` 下的一个新的不可变文件。它在同一批准行中记录唯一的相对路径、SHA-256 和字节大小，以及结构化的 title 和 question。它不会添加 title/question 包装，也不会替换更早的工件。批准界面只提供 Approve 和 Reject，将显式权限选择默认为 Ask，并打开工件以供审阅。

批准会原子地将持久会话切换为 Agent，存储所选权限模式，并排队同一 Agent 的下一个执行回合。批准使用一个绝对的 30 分钟截止时间，并将过期报告为 `PLAN_APPROVAL_TIMEOUT`。在宿主重启时，待处理、已排队和正在运行的工作会被中断，且不会重放。待处理中断会使会话保持 Plan；已批准但处于排队或运行状态的中断会使会话保持 Agent。

Bash 工具在保留其协议名称的同时使用宿主 shell 目录。目录 ID 为 `windows-powershell`、`cmd`、`git-bash` 和 `bash`。生效的 shell ID 和方言按回合固定，stdout/stderr 分别流式输出，默认超时恰好为 60 秒，显式超时限制在 1-300 秒，取消会关闭整个进程树。

## 2. 不变量与词汇表

| 概念 | 取值 | 权威 |
|---|---|---|
| 持久运行模式 | `agent`、`plan` | Rust 宿主 SQLite |
| 实时 Plan 状态 | `planning`、`awaiting_approval`、`inactive`、`stopped` | 宿主/运行时投影 |
| 批准动作 | `approve`、`reject` | 宿主 RPC |
| 批准状态 | `pending`、`approved`、`rejected`、`expired`、`interrupted` | `plan_approvals.status` |
| 执行状态 | `queued`、`running`、`completed`、`interrupted` | `plan_approvals.execution_state` |
| 权限模式 | `inherit`、`ask`、`accept-edits`、`auto` | 宿主设置/会话策略 |
| Shell ID | `windows-powershell`、`cmd`、`git-bash`、`bash` | 宿主目录/设置 |
| Shell 方言 | `powershell`、`cmd`、`posix` | 生效的 shell 选项 |

渲染器和 sidecar 持有投影。渲染器仅在当前生命周期内，根据实时宿主事件保留每个会话的最新 Plan 提案/执行快照。`plans.pending` 仅重新水合待处理的批准；terminal 行仍然是宿主拥有的持久记录，但不会重新水合 terminal 卡片。渲染器和 sidecar 都不能授权模式、写入或替换计划工件、选择可执行文件路径，或恢复已中断的批准或执行。

## 3. 状态生命周期

```text
Agent / inactive
  -> user selects Plan or Agent calls EnterPlanMode
Plan / planning
  -> SubmitPlan(title, markdown, question)
Plan / awaiting_approval
  -> approve(permission mode) -> Agent / queued -> Agent / running
  -> reject | expiry | abort | persistence failure -> Plan / stopped
host restart
  -> plan_approvals.pending -> interrupted
  -> plan_approvals.execution_state queued/running -> interrupted
```

规则：

1. 会话在规划之前、期间和之后都只存在一个 pi Agent。
2. `EnterPlanMode` 和 `SubmitPlan` 各自是其助手批次中唯一的工具调用。
3. 批准解析匹配提案、会话、回合、工具调用和版本身份。不存在序列化的进程纪元字段。
4. 待处理批准有一个绝对的 30 分钟截止时间；渲染器重新加载不会重置它，且仅通过 `plans.pending` 恢复仍然待处理的那一行。terminal 提案/执行快照不会被重新水合。
5. 拒绝和过期会使待处理会话保持 Plan，且不授予执行。
6. 批准在排队/运行中的执行开始之前提交 Agent 模式。
7. 启动会在服务 RPC 之前以事务方式隔离先前的实时工作。不会重放任何供应商、工具或队列工作。

## 4. 回合与配置边界

每个会话有一个活动回合、至多一个待处理批准，以及至多一个排队或正在运行的执行。当该边界处于活动状态时，第二个提示、Plan 提交、执行，或模式/供应商/模型/权限/shell 配置变更都会被拒绝。仅在空闲时才接受配置。对于待处理请求，批准动作是唯一启用的控件。不同会话保留各自既有的独立回合与工作区根行为。

计划任务或无人值守的 Plan 会在供应商工作、工件写入、批准或队列插入之前被拒绝，并返回 `PLAN_REQUIRES_INTERACTIVE_SESSION`。

## 5. SubmitPlan 与工件契约

```ts
type SubmitPlanInput = {
  title: string;
  markdown: string;
  question: string;
};
```

主机核心验证与项目绑定的会话，并将 `markdown` 的精确字节写入一个与以下模式匹配的新唯一文件：

```text
<workspaceRoot>/.pi/plan/<unique-name>.md
```

该写入由宿主拥有且为 create-new。工件目录会被防御性地创建，字节被刷新，相对路径存储在 `plan_approvals.artifact_relative_path` 中。`title` 和 `question` 存储在各自的结构化列中。不会添加 canonical UTF-8/LF 转换、末尾换行、title 标题、question 标题或其他包装。路径验证、符号链接、写入或冲突失败都不会创建批准行，并返回相应的 `PLAN_ARTIFACT_*` 错误。

批准接收工件打开器路径以及可持久化的哈希/大小元数据。UI 必须显示 title、question、工件打开器、到期时间和状态；不要求内联 Markdown、SHA-256 或字节大小。

## 6. 批准与执行契约

```ts
type PlanResolveRequest = {
  proposalId: string;
  sessionId: string;
  turnId: string;
  toolCallId: string;
  version?: number;
  action: "approve" | "reject";
  targetPermissionMode?: "ask" | "accept-edits" | "auto";
};
```

批准是一个原子的 `plan_approvals` 事务：

```text
BEGIN
  plan_approvals.status: pending -> approved
  plan_approvals.execution_id: new ID
  plan_approvals.execution_state: NULL -> queued
  sessions.mode: plan -> agent
  sessions.permission_mode: explicit selected mode
COMMIT
dispatch the same Agent's fresh execution turn
```

拒绝记录 `rejected`，不带权限模式，并让会话保持 Plan。过期记录 `expired` 并附带 `PLAN_APPROVAL_TIMEOUT`。中止和启动恢复记录 `interrupted`。执行工作器认领 `queued`，运行它，并以 `completed` 或 `interrupted` 完成它。行或请求中不序列化进程纪元；启动状态标记就是重放栅栏。

## 7. 存储契约

Schema v10 延续宿主拥有的 `plan_approvals` 表。其检查点和执行字段包括：

```text
request_id, session_id, turn_id, tool_call_id
plan_json                 exact submitted Markdown snapshot
title, question           structured DB fields
status, action, target_permission_mode, feedback
created_at, updated_at, expires_at, resolved_at, error_code, version
artifact_relative_path, artifact_sha256, artifact_size_bytes
execution_id, execution_state
```

不存在单独的 `plan_artifacts` 或 `plan_runs` 表，也没有序列化的 `hostEpoch` 字段。工件本身是 `.pi/plan/` 下的不可变 Markdown 文件；批准行对其进行索引，并携带执行描述符。

在数据库打开时，一个启动事务会将所有先前的 `pending` 批准以及所有先前的 `queued` 或 `running` 执行状态标记为 `interrupted`，中止关联的正在运行的回合，并在宿主服务 RPC 之前提交审计记录。同一宿主内的渲染器重新加载可以恢复待处理行及其原始截止时间。被拒绝、已过期、已批准/已完成以及已中断的 terminal 卡片在重新加载后不会被重新水合。宿主重启无法恢复可执行的工作，不会恢复任何陈旧动作，也绝不重放它；UI 不要求显示被中断的 terminal 快照。

v8 到 v10 的路径会对 WAL 做检查点，在破坏性工作之前创建一个精确可读的 `pi.sqlite.v8.bak`，并应用一个原子事务；v9 路径创建 `pi.sqlite.v9.bak`，而 v7 先到达 v8，然后使用相同的受保护路径。迁移保留会话、transcript、回合、权限和旧版批准数据，同时添加/回填工件和执行字段以及 `plan_approvals` 上的索引。它将持久化的 `chat` 值映射为 `plan`，验证 shell 设置，并最后写入 `PRAGMA user_version = 10`。格式错误的应用设置或计划任务配置、无效模式以及无效的默认 shell 都会以 schema v8 为权威而失败关闭。它不会从 transcript 文本重建工件或排队工作。

## 8. 可选择的 shell 契约

主机核心返回一个平台感知的目录：

| 平台 | 目录中的 ID |
|---|---|
| Windows | `windows-powershell`、`cmd`、`git-bash` |
| macOS/Linux | `bash` |

每个选项包含其稳定的 ID、显示标签、方言、可用性和默认标记。设置写入会拒绝未知、不可用和平台不匹配的 ID，并返回 `COMMAND_SHELL_INVALID`。如果持久化配置的 ID 之后变得不可用，生效选择会故意回退到该平台第一个可用的 shell，并标记 `fallback: true`。如果没有任何可用 shell，Bash 返回 `SHELL_NOT_FOUND`。

运行时在回合启动时固定生效的 ID 和方言。Bash 请求包含预期的 ID；主机核心在生成之前立即解析当前目录，并以 `COMMAND_SHELL_CHANGED` 拒绝陈旧的 ID/方言。这是目录身份检查，而非可执行文件路径哈希。回退可能会在回合被固定之前选择生效的 shell，但执行在固定之后绝不会改变 shell。

`Bash` 和 `tools.execute` 仍然是协议/工具名称。宿主独立地流式输出 stdout/stderr，并返回一个有界的最终结果。缺少 `timeoutMs` 表示恰好 60,000 ms；显式值仅在 1,000..300,000 ms 范围内被接受。超时和用户中止会在流关闭之前终止完整的 Unix 进程组或 Windows 进程/作业树。

## 9. 交付切片

1. **契约冻结**：ADR 0053/0054、D189/D190、基线 0.4.14、协议 v9、schema v10 以及 E2E-104-E2E-117。
2. **存储/宿主边界**：不可变工件写入器、`plan_approvals` 字段/索引、启动中断事务、队列转换、计划任务拒绝以及错误映射。
3. **Agent/RPC 垂直切片**：SubmitPlan、同一 Agent 批准、拒绝/过期、空闲/配置守卫，以及无重放的启动恢复。
4. **Shell 执行切片**：目录/默认持久化、平台验证、生效回退、回合固定、陈旧 ID 拒绝、流式输出、超时边界以及进程树取消。
5. **桌面交互**：工件打开器批准卡片、状态/到期呈现、shell 设置、渲染器重新加载行为、本地化和诊断。
6. **聚焦验证**：迁移、RPC、宿主授权、不可变工件字节、过期、重启栅栏、shell 回退、陈旧身份、流、超时和中止检查。E2E 运行仍然为可选（opt-in）。

## 10. 聚焦验证清单

### 计划与存储

- Agent、Plan、批准、队列和执行过程中保持同一个 Agent 身份；
- 每次提交都有唯一的工件路径，且 Markdown 逐字节保留；
- title/question 结构化存储，工件打开器能解析该文件；
- 仅 approve/reject 的 schema 和 Ask 默认值；
- 绝对过期返回 `PLAN_APPROVAL_TIMEOUT`；
- 一个活动回合、一个待处理批准和一个排队/正在运行的执行；
- v8 到 v10 迁移与回滚；
- 启动事务在 RPC 之前中断先前的 pending/queued/running 工作；
- 重启后不重放任何供应商/工具/队列；
- 待处理中断保持 Plan；已批准中断保持 Agent；
- 计划任务 Plan 在供应商/工件/队列工作之前被拒绝。

### Shell 与进程

- 精确的平台目录 ID 和设置验证；
- 持久化但不可用的 ID 回退到该平台第一个可用的 shell；
- 回合固定生效的 ID/方言，陈旧身份失败关闭；
- Bash 协议名称保持稳定；
- 独立的、有序的 stdout/stderr 事件和有界最终结果；
- 精确的 60 秒默认值和 1-300 秒覆盖边界；
- 超时和用户中止终止完整的进程树。

## 11. 验收证据

E2E 计划自动化这些 M6 场景：E2E-104 迁移、E2E-105 宿主 Plan 策略、E2E-106 不可变工件批准、E2E-107 过期、E2E-108 启动中断、E2E-109 无重放/Agent 保留、E2E-110 计划任务拒绝、E2E-111 活动/配置边界、E2E-112 shell 选择与回退、E2E-113 陈旧 shell 身份、E2E-114 流式输出、E2E-115 超时、E2E-116 进程中止以及 E2E-117 UX/语言环境。

2026-08-05 的验收结合了主机核心套件（139/139 通过，包括 15 个聚焦 DB 测试）、97 个 agent-runtime 测试、desktop/shared/i18n 套件、完整的 JavaScript 构建/类型检查/lint、长超时的 `test:e2e:plan` 宿主工作流，以及原生 CDP 的 `test:e2e:plan-ui` Electron 工作流。公共 RPC 无法安全制造的两个宿主状态——延迟的批准过期和一个先前持久化的 shell 变得不可用——由确定性的 Rust 测试直接覆盖。同一 Host 的渲染器证据覆盖了待处理恢复、同一生命周期内的 terminal 控件、稳定的 Electron/Host 身份，以及渲染器重新加载后 rejected 加 approved/completed terminal 卡片的缺失。E2E-108/E2E-109 覆盖宿主重启中断、陈旧响应拒绝和无重放。

## 12. 明确的非目标

- 第二个规划器 Agent/模型/服务；
- 批准卡片中的请求修改反馈；
- 渲染器/sidecar 写入或替换计划工件；
- 宿主重启后重放任何 Plan 工作；
- 对计划任务/后台 Plan 的自动批准；
- 宿主 shell 目录之外的任意可执行文件路径；
- 单独的 PowerShell/cmd/Git Bash 协议工具；
- 将可执行文件路径哈希作为 shell 身份；
- Agent Bash 工具的交互式 PTY 行为。
