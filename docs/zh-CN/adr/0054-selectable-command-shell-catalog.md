# ADR 0054：可选择的命令 shell 目录与执行身份

> **翻译说明：** 本页是与 [英文源决策](/adr/0054-selectable-command-shell-catalog) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受实施（§4 中的超时边界已由 ADR 0167 / D329 修订）
- 日期：2026-07-31
- 基线：`0.4.14`
- 协议：v9
- 存储 schema：v10

## 背景

Bash 工具当前为每个进程解析单一 Bash 实现。这使用户无法选择与其项目相匹配的命令语言，并且使已变更的可执行文件难以被检测。在 shell 选择变为显式且由主机权威决定的同时，协议名称与代理工具词汇必须保持稳定。

## 决策

### 1. 主机拥有的 shell 目录

主机核心暴露一个感知平台、具有稳定 ID 的目录：

| ID | Shell | 发现方式 |
|---|---|---|
| `windows-powershell` | 原生 PowerShell | Windows 上的 `powershell.exe`/原生 PowerShell |
| `cmd` | Windows 命令提示符 | Windows 上的 `cmd.exe` |
| `git-bash` | Git for Windows Bash | Git for Windows 安装与 PATH |
| `bash` | Unix Bash | macOS/Linux 上的 `/bin/bash`、`/usr/bin/bash` 或经批准的 PATH 条目 |

Windows 目录包含 `windows-powershell`、`cmd` 和 `git-bash`；Unix 目录包含 `bash`。该目录不接受由渲染器或 sidecar 提供的任意可执行文件路径。

设置写入仅接受当前平台可用的 ID。未知、不可用以及平台不匹配的 ID 会被拒绝。若某个已持久化的 ID 之后变得不可用，主机核心会有意选择平台目录中第一个可用的 shell 并报告 `fallback: true`；若没有任何可用项，Bash 将以 `SHELL_NOT_FOUND` 失败。

### 2. 持久化的默认值与稳定身份

宿主在应用设置中持久化一个 `defaultCommandShell` ID。仅允许从可用目录中进行选择，且仅在受影响的会话处于空闲状态时允许。在回合启动时，运行时固定生效的 shell ID 与方言。执行请求携带被固定的 ID；主机核心在 spawn 之前再次解析目录，若生效的 ID 或方言发生变化，则以 `COMMAND_SHELL_CHANGED` 拒绝。该身份校验针对的是目录选择，而非可执行文件路径哈希。运行时回退在回合被固定之前选定；此后执行绝不会静默切换 shell。

### 3. 稳定的 Bash 协议契约

代理工具与主机方法仍为 `Bash` 和 `tools.execute`；shell 选择是请求上的数据，而不是新的 `PowerShell`、`Cmd` 或 `GitBash` 工具名称。命令以所选 shell 的文档化调用形式，在发起会话的工作区中以非交互方式运行。

主机核心将 stdout 和 stderr 作为独立且有序的输出事件进行流式传输。最终工具结果仍受边界限制，并记录任一流是否被截断。任何流数据块都不得包含机密，也不得归属于其他会话/回合。

### 4. 超时与取消

每次 Bash 执行都有一个强制的 60 秒默认超时。调用方仅可请求从 1 秒到 300 秒范围内、经主机校验的覆盖值；缺省值精确使用 60 秒，超出范围的值会被拒绝。超时与用户中止会终止整个进程树，而不仅仅是 shell 领头进程：Unix 使用进程组，Windows 使用 job/进程树边界。宿主等待关闭完成，关闭流，记录终态结果，并返回 `TOOL_TIMEOUT` 或 `TURN_ABORTED`，且不留下孤儿进程。

## 后果

- 用户可以一次性选定命令语言，并在会话与重启之间保留该默认值。
- 已变更的生效 shell 选择不会在过期假设下接收命令，而持久化但不可用的偏好则可通过有意的目录回退恢复。
- 流式传输使长命令可观测，同时不削弱最终结果限制。
- 稳定的 Bash 协议避免了工具 schema 与兼容路径的增殖。

## 被拒绝的替代方案

### 始终使用 Bash

被拒绝，因为它排除了原生 Windows 命令工作流，并使用户的 shell 偏好不可见。

### 让调用方提供任意可执行文件路径

被拒绝，因为这会绕过目录策略，并使身份校验与安全审查不可靠。

### 为每种 shell 创建一个协议工具

被拒绝，因为它破坏了现有的 Bash 技能，并在不增加权威的情况下扩大了权限与审计矩阵。

## 相关文档

- `docs/adr/0053-plan-checkpoint-artifact-and-execution-epoch.md`
- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/03-runtime/05-host-core-rust.md`
- `docs/spec/03-runtime/06-host-rpc-protocol.md`
- `docs/spec/03-runtime/07-process-model.md`
- `docs/spec/03-runtime/08-error-codes.md`
- `docs/spec/03-runtime/09-logging-and-observability.md`
- `docs/spec/03-runtime/16-tool-result-limits.md`
- `docs/spec/04-ux/06-settings-ia.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/04-ux/09-interaction-patterns.md`
- `docs/spec/05-security/01-security.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md` (D190)
