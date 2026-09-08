# ADR 0116：将 OpenCode Go 添加为固定供应商预设

> **翻译说明：** 本页是与 [英文源决策](/adr/0116-opencode-go-provider-preset) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-24
- 决策者：PI-Desktop core
- 更新 ADR 0012 和 ADR 0020

## 上下文

OpenCode Go 服务暴露了兼容 OpenAI 的 Chat Completions API，但其端点由服务方拥有，不应像通用网关那样被编辑。用户应能在无需从单独文档中复制端点的情况下进行配置，同时现有的供应商工作室必须继续支持任意兼容 OpenAI 的服务。

## 决策

将 `opencode_go` 添加为持久化的 API 风格值，并在自定义供应商对话框中暴露出来。选择它会应用以下不可变的连接默认值：

```text
name:    OpenCode Go
baseUrl: https://opencode.ai/zen/go/v1
```

渲染器保持名称和端点可见但为只读，只接受 API key 作为唯一可编辑的连接字段，并继续使用常规的已发现模型选择器。保存时的规范化也会强制这些固定值，因此过期或手动构造的表单状态无法覆盖它们。

运行时将 `opencode_go` 映射到 pi-ai 的 OpenAI Chat Completions 适配器。模型发现使用 Bearer key 调用 `/models`。密钥仍由现有的 Rust 宿主密钥存储持有；不引入 OpenCode 专用的密钥或数据库表。

OpenCode Go 要求 LLM 请求上带有稳定的 `x-opencode-session` 头，以便网关可以把一个对话固定到一个后端。pi-ai 不会发出该头。Agent-runtime 在会话、子代理、提示词增强和插件一次性流上注入它（以及 `x-opencode-client: pi-desktop` 和一个 PI-Desktop `User-Agent`），使用持久化的对话 id。检测匹配 `apiStyle: opencode_go`、供应商标识 `opencode` / `opencode-go`，或 `opencode.ai` 基础 URL，因此 UUID 供应商行和指向 Go 的自定义 Completions 行都能工作。这保留在代理层，与官方 Pi coding-agent 的归属标识辅助程序一致。

## 后果

- OpenCode Go 在供应商行和持久化配置中可被识别。
- 在选中该预设时，服务不会被意外指向其他端点。
- 通用的兼容 OpenAI 配置仍作为独立的 API 风格提供给用户自控的网关。
- 该预设不会创建第二个连接适配器，也不会把服务的模型列表限制为硬编码目录。
- OpenCode Go 的对话、子代理和一次性请求都携带稳定的会话路由头，无需等待 pi-ai 的变更。
