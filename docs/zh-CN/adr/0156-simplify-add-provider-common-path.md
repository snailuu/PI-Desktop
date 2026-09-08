# ADR 0156：简化添加供应商的通用路径

> **翻译说明：** 本页是与 [英文源决策](/adr/0156-simplify-add-provider-common-path) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-05
- 决策者：PI-Desktop 核心
- 更新 ADR 0116 和 ADR 0155

## 上下文

添加供应商对话框在模型面板之前堆叠了 Service、Name、Base URL、API key 和 API 格式。具名的 Zhipu / Z.AI 端点已经知道自己的名称、URL 和通信格式，因此这些额外字段让首次使用的路径看起来像是一个通用网关表单。

## 决策

新对话框启动时只显示 **Service**。选择具名端点后（Zhipu / Z.AI API 或 Coding Plan、OpenCode Go），通用路径为 Service + API key，再加一行主机摘要。自定义端点则显示 Name、Base URL 和 API key。Name（具名行）和 API 格式（自定义行）保留在 Advanced 之后。OpenCode Go 是 Service 选项，而不是 API 格式选项。

不引入步骤器、供应商卡片网格或额外的 `apiStyle` 值。ADR 0155 中的持久化、目录匹配和 Completions 标志保持不变。

## 影响

- 添加已知服务是选择 + 粘贴 + 选择模型。
- 自定义 OpenAI 兼容网关保留先前的 Name / URL / key 契约，API 格式仍可在 Advanced 中使用。
- OpenCode Go 可与其他具名服务一起被发现。
