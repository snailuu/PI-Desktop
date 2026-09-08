# ADR 0178：按供应商自定义 HTTP 请求头

> **翻译说明：** 本页是与 [英文源决策](/adr/0178-per-provider-custom-headers) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-08
- 决策者：PI-Desktop 主机核心
- 修订 ADR 0176 / ADR 0095 / ADR 0156
- 取代 ADR 0176 中仅限 User-Agent 的表面

## 上下文

ADR 0176 添加了逐行的 User-Agent 覆盖，因为网关会检查该请求头，而 Codex 会在额外请求头之后覆盖它。随后用户需要对其他非机密请求头（路由、租户或客户端标识）走同一条最后写入者路径，而不是一个专用的 User-Agent 字段。供应商 schema 已列出 `headers`；0176 将该映射留作未实现，并说明若两者同时存在则 User-Agent 胜出。

针对单个 User-Agent 字段的高级编辑器位于两列网格中，看起来过于稀疏。

## 决策

每个供应商行——API-key AI 服务和 OAuth 供应商账户——都可以在 `config_json.headers` 中存储一个可选的 `headers` 映射。

- 为空、省略或更新为 `{}` 时保持当前的适配器默认值。
- 非空映射是该行出站 HTTP 的最后写入者：会话回合、内置子代理、提示增强、插件一次性调用、`/models` 发现（包括未保存的表单值）、连接测试，以及 OAuth token 刷新。
- fetch 包装器是最后写入者，因此 Codex 和 Anthropic SDK 无法覆盖该映射。相同的值也会放在 pi-ai 流选项请求头上，从而使 OpenCode 的调用方胜出规则依然成立。
- 读取时，已存储的 `config_json.userAgent` 会迁移到 `headers["User-Agent"]`。写入 `headers` 会丢弃残留的 `userAgent`。若两者同时存在，对于映射中已有的 User-Agent 键，`headers` 胜出。
- 主机校验：对键和值进行 trim；键不区分大小写且唯一；最多 32 个请求头；键 ≤ 256 字节；值 ≤ 4096 字节；不含 CR/LF；请求头名称仅限字母数字加连字符。保留键会被拒绝，因此这不会破坏签名或逐跳成帧：`authorization`、`proxy-authorization`、`host`、`content-type`、`content-length`、`cookie`、`set-cookie`、`connection`、`transfer-encoding`、`te`、`trailer`、`upgrade`、`keep-alive`、`x-api-key`、`api-key`、`chatgpt-account-id`、`x-opencode-session`。
- 不是机密。没有 SQLite 或主机协议版本号提升。
- UI 是位于右上角对话框操作区的一个显式高级设置按钮（命名、自定义和供应商账户），点击后打开一个单独的紧凑模态框。该模态框提供常用请求头预设，包括 `User-Agent`、复制与持久化所用同一规范化记录的 JSON、可导入直接请求头对象或 `{ "headers": { ... } }` 的 JSON 导入，以及不区分大小写且不产生重复行的合并。最多可见两行请求头；更多行在编辑器内部滚动。命名显示名称仍位于请求头控件上方。首次 OAuth 登录不收集请求头；它们会在账户存在之后进行编辑。
- `AgentRuntime.matches()` 包含该请求头映射，因此编辑它会重建热运行时。

覆盖 Anthropic OAuth 的 `claude-cli/…` User-Agent 可能导致 Claude Pro/Max 拒绝该请求。这是用户的选择。

## 后果

- 用户可以冒充另一个客户端，并按服务或账户附加网关专用请求头，而无需全局请求头转储或携带认证信息的编辑器。
- OAuth 登录 HTTP 仅在行映射保存之后才使用它；首次登录流量保持 pi-ai 默认值。
- 先前保存的 User-Agent 仍然生效，直到该行下次保存，届时它只会存储在 `headers` 中。
