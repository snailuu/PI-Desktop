# ADR 0176：按供应商的 User-Agent 覆盖

> **翻译说明：** 本页是与 [英文源决策](/adr/0176-per-provider-user-agent) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-07
- 决策者：PI-Desktop 核心
- 修订 ADR 0095 / ADR 0156

## 上下文

某些网关和厂商订阅会检查 `User-Agent`。pi-ai 会固定发送
`pi (<platform> …)`，Anthropic OAuth 推理发送 `claude-cli/<version>`，
OpenCode Go 发送 `pi-desktop/<APP_VERSION>`，而 Codex 会在额外请求头之后覆盖
User-Agent。设置中没有办法为某一行设置值。供应商 schema 列出了一个
`headers` 映射，但从未实现。

## 决策

每个供应商行——API-key AI 服务和 OAuth 厂商账户——都可以在
`config_json.userAgent` 中存储一个可选的 `userAgent`。

- 留空或省略则保持当前适配器默认值。
- 非空且去除空白后的值将作为该行出站 HTTP 的 `User-Agent` 发送：
  会话回合、内置子代理、提示词增强、插件一次性调用、`/models` 发现
  （包括未保存的表单值）、连接测试以及 OAuth token 刷新。
- fetch 包装器是最后写入者，因此 Codex 和 Anthropic SDK 无法覆盖它。
  同一个值也会放入 pi-ai stream-option 请求头中，从而保持 OpenCode 的
  调用方优先规则成立。
- 使用 `""` 更新会清除覆盖。最大 256 字节；CR/LF 会被拒绝。
- 它不是密钥。不提升 SQLite 或主机协议版本。
- UI 位于 AI 服务对话框（具名和自定义）以及厂商账户编辑器的“高级”中。
  首次 OAuth 登录不会收集 User-Agent；它会在账户存在后编辑。
- `AgentRuntime.matches()` 包含 `userAgent`，因此编辑它会重建
  热运行时。
- 未使用的 `headers` 映射仍然不予实现。如果之后添加，`userAgent`
  仍作为 UI 别名，并优先于 `headers["User-Agent"]`。
  **已被 ADR 0178 取代：** `config_json.headers` 是受支持的覆盖方式；
  遗留的 `userAgent` 会迁移到 `headers["User-Agent"]`。

覆盖 Anthropic OAuth 的 `claude-cli/…` User-Agent 可能导致 Claude
Pro/Max 拒绝请求。这是用户的选择。

## 后果

- 用户可以按服务或账户冒充另一个客户端，而无需全局 User-Agent
  或完整的自定义请求头编辑器。
- OAuth 登录 HTTP 仅在该行值保存后才会使用它；首次登录
  流量保持 pi-ai 默认值。
