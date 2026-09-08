# ADR 0044：绑定会话的项目指令预检

> **翻译说明：** 本页是与 [英文源决策](/adr/0044-session-bound-project-instruction-preflight) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-02
- 相关：[ADR 0037](/zh-CN/adr/0037-project-instruction-chain) ·
  [代理运行时](/zh-CN/spec/03-runtime/02-agent-runtime) ·
  [日志与可观测性](/zh-CN/spec/03-runtime/09-logging-and-observability)

## Context

按路径限定范围的指令加载会在每个文件工具之前运行。解析器位于 Electron 主进程，但它会先调用主机核心的 `session.get` 以重新发现项目根目录。因此，缓慢或拥塞的宿主进程会拖慢本应本地完成的文件操作，并使该延迟出现在通用的宿主往返测量中。在一次 prompt 中重复读取文件也会重复执行相同的指令解析。

## Decision

1. Electron 主进程在运行时启动期间从宿主进程持有的会话记录中推导出项目根目录，并将其作为启动元数据传递。
2. Electron 主进程在每个 prompt 或压缩请求之前将该根目录注册到 sidecar 包装器上。反向的 `project.instructions.resolve` 请求使用此绑定；sidecar 载荷中提供的任何根目录都会被忽略。
3. sidecar 为每个 prompt 维护一个 claim 映射，以已注册的根目录和目标目录为键。成功的结果和尽力而为的降级结果都会被该 prompt 中后续的文件工具复用。该映射会在下一个 prompt 之前被清空，因此指令的修改可以跨消息可见。
4. 工具计时将指令预检与 `hostRttMs` 分开报告，并带有缓存命中和基础链降级的标记。

## Consequences

- 文件工具的预检不再增加一次主机核心 `session.get` 往返。
- 同一目录中重复的文件工具避免了重复的解析器 IPC 与文件发现，同时保持跨消息的新鲜度。
- ADR 0037 中的主进程隔离边界仍然明确：sidecar 只选择目标路径，而根目录由 Electron 主进程持有。
- 解析器超时或宿主进程失败时仍保持尽力而为，并回退到基础链，而不会携带同级目录的指令。

## Alternatives rejected

- **在所有 prompt 之间缓存指令链：** 在指令文件变更后存在规则陈旧的风险，并且需要文件监听或 stat 失效机制。
- **信任 sidecar 发送的项目根目录：** 削弱了绑定会话的隔离边界，并让模型驱动的输入选择扫描根目录。
- **保留按文件的 `session.get`：** 在最为热点的文件工具预检路径上保留了一项本可避免的宿主进程依赖。
