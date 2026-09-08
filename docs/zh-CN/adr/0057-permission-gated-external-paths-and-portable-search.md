# ADR 0057：权限门控的外部路径与可移植的原生搜索

> **翻译说明：** 本页是与 [英文源决策](/adr/0057-permission-gated-external-paths-and-portable-search) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受实施（由 D315 修订）
- 日期：2026-08-05
- 基线：`0.4.14`
- 协议：v9
- 存储 schema：v10

## 背景

读取/搜索工具在路径解析器运行之前被归类为低风险。因此，位于会话工作区之外的绝对路径绕过了常规权限卡片，并在之后以 `PATH_OUTSIDE_WORKSPACE` 失败。这使得一次合法的检查请求看起来像一次损坏的 Plan 回合，并促使代理重试或用 shell 命令替换原生工具。

主机已经拥有用于 `Read`/`Glob`/`Grep` 的有界、跨平台 Rust 实现，但 sidecar schema 只暴露了其作用域控制的一部分。模型无法可靠地提供 `path`、`include`、`outputMode`、`headLimit`、`offset`、`limit` 或 `Glob.limit`；一些供应商还输出了主机拒绝的 shell 风格 `files_with_matches` 值。

## 决策

### 1. 显式外部路径受权限门控

对于 `Read`、`Glob`、`Grep`、`Write` 和 `Edit`，主机在应用常规风险矩阵之前，会针对会话工作区与临时根目录对显式路径进行分类：

- Auto 在无卡片的情况下执行显式外部路径。
- Ask 和 Accept edits 发出已有的内联权限请求。
- Allow once 仅覆盖当前调用；Allow for session 使用已有的工具名授权作用域。
- Deny、超时和取消返回 `TOOL_DENIED` 且不执行。
- 相对父级穿越和符号链接逃逸与绝对路径遵循相同的规则。

批准后，主机核心使用与受包含路径相同的规范化祖先逻辑来解析路径。它绝不会把外部位置变成新的工作区根目录，隐式 Bash cwd 或递归遍历也不会获得该例外。成功的外部结果在存在根字段的地方报告 `root: "external"`，并保持绝对规范路径对模型可见。

Plan 对 Write/Edit/插件/未知工具已有的硬性拒绝仍高于此路径规则。

### 2. 原生搜索是可移植的默认方式

运行时暴露主机完整的有界搜索契约：

- `Read`：`offset` 与 `limit`；
- `Glob`：`path` 与 `limit`；
- `Grep`：`path`、`include`、`outputMode`、`headLimit` 和 `caseInsensitive`。

`outputMode` 在 schema 中恰好暴露 `content`、`filesWithMatches` 和 `count`。主机还会在执行前将 `files_with_matches` 和 `files-with-matches` 规范化为兼容别名。搜索指引在所有平台上优先使用工作区相对路径和原生工具。当进程 PATH 或 Unix 登录 PATH 上存在用户安装的 `rg` 时，Grep 可以 exec 它（D181 / D315）。这是一种实现后端，而非 shell 搜索：stdin 为 null，参数不通过 shell 加引号，主机仍然施加预算、最新优先顺序、作用域化 ignore（当 `path` 显式给出时使用 `--no-ignore-parent`）以及相同的 JSON 形状。缺失、被覆盖为无效或失败的 `rg`（spawn 错误或退出码 2）会回退到进程内的 `ignore` + `regex` 搜索器。`PI_DESKTOP_RG` 选择二进制；`PI_DESKTOP_DISABLE_RG` 强制回退。Bash 搜索仍是有界的最后手段，并且仍然不假设 POSIX 工具、PowerShell 或 `rg` 的可用性。

## 影响

- 项目之外的 Plan 检查可以等待明确的用户决策，而不是在解析器边界处失败。
- Auto 仍适用于全自动会话，而 Ask 和 Accept edits 为外部数据和变更保留了明确的同意边界。
- 搜索请求可以在执行前收窄作用域和输出，减少 shell 回退、无效 output-mode 重试以及上下文增长。
- 外部读取和搜索通过绝对路径可见；外部变更不会创建工作区 Review 或工件记录。
- 安全拒绝列表仍然是默认值。本 ADR 改变的是显式路径的决策点，而不是主机核心或 Bash cwd 的权威。

## 已否决的替代方案

### 继续返回 `PATH_OUTSIDE_WORKSPACE`

否决原因：代理无法区分用户拒绝的请求与缺失的权限机会，且 Plan 失去一条合法的检查路径。

### 将所有低风险读取视为 Auto

否决原因：低风险操作仍可能泄露来自无关目录的数据。作用域与用户同意必须分别评估。

### 使用 shell 特定的搜索命令

否决原因：命令可用性与引号处理在 macOS、Linux 和 Windows 上各不相同，并且无界 shell 输出是已被测量的上下文耗尽来源。从 Grep 中 exec `rg` 并不属于此替代方案：模型仍然调用 Grep，且由主机核心掌控结果预算。

## 相关文档

- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/03-runtime/05-host-core-rust.md`
- `docs/spec/03-runtime/06-host-rpc-protocol.md`
- `docs/spec/03-runtime/08-error-codes.md`
- `docs/spec/03-runtime/15-workspace-ignore-rules.md`
- `docs/spec/03-runtime/16-tool-result-limits.md`
- `docs/spec/04-ux/03-permission-ux.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`（E2E-019/E2E-019e）
