# 08. 错误码

> **翻译说明：** 本页是与 [英文源规格](/spec/03-runtime/08-error-codes) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

> 事实来源：`packages/shared/src/errors.ts`（`ErrorCodes`）。§3.7 中的错误码为预留（在发出之前即已记录）；其余均为已启用。

## 1. 目标

在以下各处提供一套稳定的统一错误词汇：

- 渲染器 UI
- Electron IPC
- Rust 主机 RPC
- Node pi sidecar 桥接

## 2. 错误对象

```ts
type AppError = {
  code: string            // stable machine code, e.g. TOOL_DENIED
  message: string         // English UI/default message
  details?: unknown
  retriable?: boolean
  source?: "renderer" | "electron" | "host" | "agent" | "plugin"
  causeCode?: string      // nested/transport code if mapped
  traceId?: string
}
```

规则：

1. `code` 一经发布即不可变更
2. `message` 为英文源文本（i18n 键可另行映射）
3. 在可用时，UI 应优先使用由 `code` 推导出的 i18n 键

共享测试套件会校验本次更新新增发出的 runtime 与 Edit 错误码均已存在于 `ErrorCodes` 中；§3.7 中的预留错误码在实现方发出之前，仍有意保持缺失状态。

## 3. 错误码注册表

### 3.1 应用 / 协议

| 错误码 | 可重试 | 含义 |
|---|---|---|
| `PROTOCOL_MISMATCH` | no | 握手/协议版本不匹配 |
| `HOST_UNAVAILABLE` | yes | Rust 主机未运行/无法访问 |
| `HOST_OVERLOADED` | yes | 有界的主机 RPC/工具容量已满；待背压缓解后重试 |
| `AGENT_UNAVAILABLE` | yes | pi sidecar 未运行/无法访问 |
| `APP_DEGRADED` | yes | 应用在能力受限的状态下运行 |
| `INTERNAL` | maybe | 意外的内部故障 |
| `INVALID_ARGUMENT` | no | 请求 schema/参数无效，包括文件/目录类型错误的原生工具路径 |
| `UNAUTHORIZED` | no | 能力/认证边界拒绝了调用 |
| `NOT_FOUND` | no | 未找到实体 |
| `CONFLICT` | maybe | 状态冲突 / 资源忙 |
| `TIMEOUT` | yes | 通用超时 |

`HOST_UNAVAILABLE` 保留用于主机进程/传输通道缺失或损坏的情形，而非普通的准入压力。RPC 容量不足会返回 `HOST_OVERLOADED`；已获准入的 shell 因操作系统临时耗尽进程资源而无法启动时，返回 `PROCESS_RESOURCE_EXHAUSTED`。主机核心的控制 stdio 与 Tokio 的动态阻塞池相互隔离，因此后一种情况不会把临时的线程压力演变成主机进程退出。

### 3.2 代理 / 会话

| 错误码 | 可重试 | 含义 |
|---|---|---|
| `AGENT_BUSY` | no | 会话已有活动回合 |
| `AGENT_NOT_FOUND` | no | 会话不存在 |
| `TURN_NOT_FOUND` | no | 回合 ID 无效 |
| `TURN_ABORTED` | no | 回合被用户/系统中止 |
| `MODEL_NOT_CONFIGURED` | no | 未选择可用模型，或供应商以未知模型为由拒绝所选模型 |
| `PROVIDER_ERROR` | yes | 上游供应商故障；可重试的故障（5xx 网关）最多获得四次同一回合内的重试，格式错误的 400/422 请求则为终止性错误 |
| `PROVIDER_UNAUTHORIZED` | no | 供应商凭据错误/缺失 |
| `PROVIDER_RATE_LIMITED` | yes | 供应商限流；运行时会在终止事件之前跨设置/流静默重试最多五次 |
| `CONTEXT_TOO_LARGE` | no | 恢复之后提示/上下文仍超出模型的安全预算、发生了第二次供应商溢出，或自动恢复已被禁用 |
| `CONTEXT_COMPACTION_FAILED` | no | 自动的保留尾部恢复无法准备、持久化或适配检查点，或手动检查点摘要生成 / 持久化追加失败；受保护的下一供应商请求不会启动 |
| `STREAM_FAILED` | yes | 供应商流被终止、提前关闭，或在完整响应返回前以其他方式结束；终止事件之前最多可进行四次同一回合内的重试 |
| `EMPTY_MODEL_RESPONSE` | yes | 模型两次在既无工具调用也无可见文本的情况下结束了回合：一次发生在流式输出期间，一次发生在自动重跑之后（spec 02-agent-runtime §5e） |
| `PROMPT_ENHANCEMENT_EMPTY` | no | 一次性增强模型未返回文本 |
| `SUBAGENT_IDLE_TIMEOUT` | no | 已撤销（D328）：空闲看门狗不会被启用；该错误码保留用于已存储的结果 |
| `SUBAGENT_DURATION_TIMEOUT` | no | 已撤销（D328）：时长看门狗不会被启用；该错误码保留用于已存储的结果 |

### 3.3 工作区 / 工具 / 权限

| 错误码 | 可重试 | 含义 |
|---|---|---|
| `WORKSPACE_REQUIRED` | no | 未绑定工作区 |
| `PATH_OUTSIDE_WORKSPACE` | no | 路径在做出显式的外部路径权限决策之前逃逸沙箱、未获权限的兼容性调用到达解析器，或提示附件位于其会话暂存/项目/附件根目录之外 |
| `TOOL_NOT_FOUND` | no | 未知工具 |
| `TOOL_DENIED` | no | 权限被拒绝 / 模式禁止 |
| `TOOL_TIMEOUT` | yes | 工具执行超时 |
| `TOOL_FAILED` | maybe | 工具已执行但失败 |
| `MUTATION_RETRY_BUDGET_EXHAUSTED` | yes | 在同一路径的 `Edit` 或 shell patch 失败后，重复保护机制结束了该回合；携带 `details.kind`（`edit` 或 `patch-command`）以及最后一个工具错误码 |
| `PROCESS_RESOURCE_EXHAUSTED` | yes | 由于操作系统临时耗尽进程资源，shell 进程无法启动 |
| `SHELL_NOT_FOUND` | no | 目录回退之后仍无可用平台 shell；消息中携带指引 |
| `COMMAND_SHELL_CHANGED` | no | 执行前被固定的 shell ID 或方言发生了变化 |
| `COMMAND_SHELL_INVALID` | no | 设置为未知、不可用或平台不匹配的 shell ID |
| `PERMISSION_TIMEOUT` | no | 权限提示超时（映射为拒绝） |
| `PERMISSION_REQUIRED` | no | 正在等待用户决策 |
| `WRITE_DISABLED_IN_PLAN` | no | 契约模式对 Write 的硬拒绝 |
| `EDIT_DISABLED_IN_PLAN` | no | 契约模式对 Edit 的硬拒绝 |
| `PLUGIN_DISABLED_IN_PLAN` | no | 契约模式对每个插件工具的硬拒绝 |
| `TOOL_DISABLED_IN_PLAN` | no | 契约模式对未知/未列出工具的硬拒绝 |
| `PLAN_NOT_ACTIVE` | no | 在没有契约正在协商时运行了提交工具 |
| `PLAN_KIND_MISMATCH` | no | 在 Goal 模式下使用 `SubmitPlan`，或在 Plan 模式下使用 `SubmitGoal` |
| `PLAN_APPROVAL_REQUIRED` | no | SubmitPlan/SubmitGoal 正在等待独立的审批 |
| `PLAN_APPROVAL_TIMEOUT` | no | 30 分钟的绝对计划审批截止时间已过期 |
| `PLAN_APPROVAL_STALE` | no | 响应与当前生效的提案/会话/回合/工具调用/版本不匹配 |
| `PLAN_APPROVAL_INTERRUPTED` | no | 待处理的审批在中止、崩溃或持久化失败期间被关闭 |
| `PLAN_ARTIFACT_WRITE_FAILED` | no | 主机无法将精确字节写入新的 `.pi/<kind>/*.md` 工件 |
| `PLAN_EXECUTION_INTERRUPTED` | no | 已批准的排队/运行中的 Plan 或 Goal 执行停止且未重放 |
| `PLAN_REQUIRES_INTERACTIVE_SESSION` | no | 无人值守/计划调度的 Plan 或 Goal 运行无法请求审批 |

`_IN_PLAN` 后缀和 `PLAN_` 前缀属于历史遗留：两种契约模式（Plan 与 Goal）共用这些错误码，而不是另建一套 `_IN_GOAL`（**D198**）。渲染器根据提案的 `kind` 选择措辞，因此同一个错误码既可呈现为 "Plan" 文案，也可呈现为 "Goal" 文案。

### 3.4 Edit 契约（ADR 0087）

仅由 `Edit` 发出。版本与来源校验失败各自拥有独立的错误码，因为每种情况都指向不同的后续动作；将它们统一报告为 `TOOL_FAILED` 会丢失这一信息。见 [18-line-anchored-edit-contract](/zh-CN/spec/03-runtime/18-line-anchored-edit-contract) §11。

| 错误码 | 可重试 | 含义 |
|---|---|---|
| `EDIT_TAG_REQUIRED` | no | `tag` 缺失或不是 4 位十六进制数字 |
| `EDIT_TAG_MISMATCH` | yes after a `Read` | tag 与实时文件的哈希不符，且漂移恢复被拒绝；携带实时 tag 以及锚点处的当前内容 |
| `EDIT_TAG_UNKNOWN` | yes after a `Read` | tag 格式良好，但会话未记录该路径下的此类内容 |
| `EDIT_LINES_UNSEEN` | yes | 锚点引用了会话从未展示过的行；携带被揭示的内容 |
| `EDIT_PARSE_FAILED` | no | op 头格式错误、无冒号头部下出现正文行、正文缺失，或出现 `-`/上下文行 |
| `EDIT_RANGE_INVALID` | no | 范围倒置、行越界、op 重叠或锚点重复 |
| `EDIT_BLOCK_UNRESOLVED` | no | `N*` 定位符未能解析；消息中给出了普通范围（plain-range）替代写法 |
| `EDIT_REGISTER_EMPTY` | no | 从尚未设置的寄存器中粘贴 |
| `EDIT_REGISTER_AMBIGUOUS` | no | 匿名粘贴时存在多个待处理的匿名捕获 |
| `EDIT_REPAIR_AMBIGUOUS` | no | 边界修复候选在最小代价上并列 |
| `EDIT_NO_CHANGE` | no | 应用后产生的文本与输入完全相同 |
| `EDIT_AMPLIFICATION_LIMIT` | no | 降低（lowering）超出了扩张上限 |

当其消息报告了完整揭示时，`EDIT_LINES_UNSEEN` **无需**再次 `Read` 即可重试：被揭示的行会合并进会话的来源记录，因此同一个 `tag` 原样重试即可应用。被截断的揭示不会合并任何内容，需要重新读取。

`EDIT_TAG_MISMATCH`、`EDIT_TAG_UNKNOWN` 和 `EDIT_LINES_UNSEEN` 在每个路径上各获得一次免计数尝试，之后重复保护机制才会对其计数，因为每种情况本身已携带了重试所需的信息。其余错误码在首次出现时即计数，而耗尽预算的失败会在助手行上以 §3.3 的 `MUTATION_RETRY_BUDGET_EXHAUSTED` 呈现（[18-line-anchored-edit-contract](/zh-CN/spec/03-runtime/18-line-anchored-edit-contract) §9.3）。

### 3.5 密钥 / 设置

| 错误码 | 可重试 | 含义 |
|---|---|---|
| `PROVIDER_SECRET_MISSING` | no | 已启用的供应商需要 API 密钥 |
| `SECRET_STORE_UNAVAILABLE` | maybe | 操作系统安全存储不可用（预留） |
| `SETTINGS_INVALID` | no | 设置载荷无效（预留） |

### 3.6 插件

| 错误码 | 可重试 | 含义 |
|---|---|---|
| `PLUGIN_NOT_FOUND` | no | 插件 ID 缺失（预留） |
| `PLUGIN_INVALID` | no | 清单/包无效 |
| `PLUGIN_LOAD_FAILED` | maybe | 启用/加载失败 |
| `PLUGIN_DISABLED` | no | 插件已禁用（预留） |
| `PLUGIN_PERMISSION_DENIED` | no | 插件缺少已声明/已授予的权限（预留） |
| `PLUGIN_COMMAND_NOT_FOUND` | no | 命令 ID 缺失（预留） |
| `PLUGIN_CRASHED` | yes | 插件运行时崩溃（预留） |
| `PLUGIN_CONTRACT_MISMATCH` | no | 不支持的清单/api 版本（预留） |

### 3.7 预留的细粒度错误码（尚未发出）

为未来映射而记录的更细粒度的供应商/工具区分。在发出之前，各实现使用表中所列的规范父级错误码。

| 预留错误码 | 当前的规范父级错误码 | 说明 |
|---|---|---|
| `PROVIDER_BASE_URL_INVALID` | `PROVIDER_ERROR` | 端点无效（400） |
| `PROVIDER_PROTOCOL_MISMATCH` | `PROVIDER_ERROR` | 协议配置（profile）错误 |
| `PROVIDER_MODEL_NOT_FOUND` | `MODEL_NOT_CONFIGURED` | 未知模型 ID（404） |
| `PROVIDER_TIMEOUT` | `TIMEOUT` | 网络/服务器超时（可重试） |
| `PROVIDER_UNSUPPORTED_CAPABILITY` | `PROVIDER_ERROR` | 不支持工具/视觉 |
| `PROVIDER_DISABLED` | `MODEL_NOT_CONFIGURED` | 供应商已禁用 |
| `WORKSPACE_PATH_DENIED` | `PATH_OUTSIDE_WORKSPACE` | 被 ignore/denylist 拦截 |
| `TOOL_BINARY_CONTENT` | `TOOL_FAILED` | 拒绝二进制内容转储 |

历史别名（切勿在新代码中使用）：`PROVIDER_AUTH_FAILED` → `PROVIDER_UNAUTHORIZED`；`PROVIDER_STREAM_INTERRUPTED` → `STREAM_FAILED`；`WORKSPACE_OUTSIDE_ROOT` → `PATH_OUTSIDE_WORKSPACE`；`SECRET_MISSING` → `PROVIDER_SECRET_MISSING`；`SHELL_UNAVAILABLE` → `SHELL_NOT_FOUND`；`SHELL_IDENTITY_STALE` → `COMMAND_SHELL_CHANGED`；`PLAN_APPROVAL_EXPIRED` → `PLAN_APPROVAL_TIMEOUT`。截断不是错误：有界的工具结果会携带一个标记，指明哪一端得以保留以及其余内容所在的位置，或在同级结果字段中报告所限定的窗口（见 [16-tool-result-limits](/zh-CN/spec/03-runtime/16-tool-result-limits)）。

## 4. 映射规则

### 主机 RPC 数字码 → AppError.code
参见 `06-host-rpc-protocol.md` 的数字码表。  
示例：主机 `1004` → `TOOL_DENIED`。

### 供应商异常
Node sidecar 将供应商 SDK 错误映射为：

- `PROVIDER_UNAUTHORIZED`
- `PROVIDER_RATE_LIMITED`
- `MODEL_NOT_CONFIGURED`（供应商以 404 拒绝所选模型）
- `PROVIDER_ERROR`
- `NETWORK_ERROR`
- `STREAM_FAILED`

完全为 `terminated` 的供应商消息以及等价的流提前关闭消息会映射为 `STREAM_FAILED`。请求设置阶段或响应后的 `PROVIDER_RATE_LIMITED` 使用共享的运行时预算：初始尝试之后再重试五次，设置阶段与流阶段失败合并计数。非 429 的瞬时失败——`STREAM_FAILED`、`NETWORK_ERROR`、`TIMEOUT` 以及可重试的 `PROVIDER_ERROR`（例如上游网关 502/503/504）——共享它们自己的有界预算：初始尝试之后再重试四次，同样在设置阶段与流阶段之间合并计数，且与 429 预算相互独立。两种预算都可被中止。429 路径在客户端退避之前会遵循 `retry-after-ms`、`retry-after` 秒数以及 HTTP-date 头，并将等待时间上限设为 30 秒；非 429 路径采用相同的优先级顺序，但上限为 8 秒，否则依次等待 1、2、4、8 秒。只有失败的请求会被重放；会话及其工具状态不受影响。来自格式错误的 400/422 请求的不可重试 `PROVIDER_ERROR` 永远不会进入任何一种预算。

### 权限超时
UI/主机超时会在内部发出 `PERMISSION_TIMEOUT`，向代理呈现的工具结果为拒绝（`TOOL_DENIED`）。

### Shell 与 Plan/Goal 检查点故障

仅当目录回退找不到任何可用的平台 shell 时，才返回 `SHELL_NOT_FOUND`。`COMMAND_SHELL_CHANGED` 绝不会改用其他 shell 重试；该回合必须获取新的有效 ID/方言。`PLAN_ARTIFACT_WRITE_FAILED` 绝不会创建审批行。`PLAN_APPROVAL_TIMEOUT` 仅适用于绝对待处理截止时间；`PLAN_EXECUTION_INTERRUPTED` 标识一个已批准的排队/运行中的执行因中止或主机恢复而中断。`PLAN_KIND_MISMATCH` 与 `PLAN_NOT_ACTIVE` 一样属于终止性工具错误：提交工具针对错误的契约运行，因此不会写入任何工件，也不会创建审批行。

## 5. UI 处理准则

| 类别 | UI 行为 |
|---|---|
| 认证/配置（`PROVIDER_SECRET_MISSING`、`MODEL_NOT_CONFIGURED`） | 助手错误消息，附带设置 CTA |
| 权限拒绝 | 内联工具卡片状态 |
| 可重试的供应商/网络故障 | 带诊断详情的助手错误消息；会话范围内的失败回合恢复卡片提供重试 |
| 内部/主机不可用 | 降级横幅 + 恢复提示 |

与消息绑定的供应商故障绝不使用 toast 或浮动全局横幅。当 `PROVIDER_RATE_LIMITED` 失败的有界重试预算仍可用时，该失败保持不可见；只有预算耗尽时才会渲染助手错误与生命周期错误。助手错误消息显示本地化摘要与稳定的错误码，并提供一个可访问的详情展开区，其中包含已脱敏的供应商响应、供应商 ID 和模型 ID。供应商详情上限为 600 个字符，常见的凭据/头部值在事件发出或持久化之前均会被脱敏。在可用时，详情展开区和计时日志还可能显示有界的 `phase`、`providerStatus`、`providerCode`、`providerWaitMs`、`streamMs` 和 `retryAttempt` 字段。助手错误卡片提供一个本地化的继续操作，在同一会话中重发续接提示（`继续当前任务` / `Continue the current task`），且不会截断已失败的回合。重新生成仍由会话范围内的失败回合恢复卡片提供，而非助手错误卡片。

## 6. i18n 键约定

```text
errors.<code>
errors.<code>.action
```

示例：

- `errors.PROVIDER_SECRET_MISSING`
- `errors.PROVIDER_SECRET_MISSING.action`
- `errors.HOST_UNAVAILABLE`

## 7. 验收

1. 每一次 IPC 失败都返回 `AppError.code`
2. 主路径上不存在未经类型化的纯字符串失败
3. Plan/Goal 的硬拒绝使用明确的工具专属错误码；Bash 绝不会仅因运行模式而被任一契约模式拒绝，而是遵循权限策略
4. 主机数字码映射为稳定的字符串错误码
5. 无效的 shell 设置、无可用 shell/固定标识过期、工件写入、过期、调度拒绝以及重启中断路径均映射为稳定的错误码；仅允许文档所述的回合前目录回退，且不会重放任何工作
