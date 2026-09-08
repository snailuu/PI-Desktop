# ADR 0155：添加 Zhipu / Z.AI 命名端点预设

> **翻译说明：** 本页是与 [英文源决策](/adr/0155-zhipu-endpoint-presets) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-05
- 决策者：PI-Desktop 核心
- 更新 ADR 0012、ADR 0020 和 ADR 0116

## 上下文

Zhipu AI（智谱）提供两种产品模式和两个区域：

- Standard API 与 GLM Coding Plan
- 中国（`open.bigmodel.cn`）与国际（`api.z.ai`）

pi-ai 已经为两个 Coding Plan URL（`zai`、`zai-coding-cn`）提供了 Completions 传输，并会从这些主机检测 `thinkingFormat: "zai"`。models.dev 已经发布了全部四个端点。PI-Desktop 的添加供应商对话框此前是一个通用的 OpenAI 兼容表单，因此用户必须自行了解要粘贴哪个 URL，而保存的行会使用 `vendorKey: "custom"`。

Issue #35 要求为 API 与 Coding Plan、中国与国际提供一等配置能力，且不引入新的供应商 SDK。

## 决策

在添加供应商的**服务**选择器中暴露四个命名端点预设。它们仍然沿用现有的 OpenAI 兼容路径：

```text
vendorKey              baseUrl
zhipuai                https://open.bigmodel.cn/api/paas/v4
zhipuai-coding-plan    https://open.bigmodel.cn/api/coding/paas/v4
zai                    https://api.z.ai/api/paas/v4
zai-coding-plan        https://api.z.ai/api/coding/paas/v4
```

选择预设会填充名称、锁定 Base URL、保持 `apiStyle: "chat_completions"`，并持久化 models.dev 的 `vendorKey`。显示名称仍可编辑。Coding Plan 会显示一行 API 密钥提示。这是一个紧凑的选择器，不是恢复后的供应商卡片网格。

pi-ai 的 `zai` 传输是国际版 Coding Plan，而 models.dev 的 `zai` 是 Standard API。PI-Desktop 会同时存储 models.dev 键和确切的 URL，因此目录匹配不会将它们混淆。`zai-coding-cn` 仍是 `zhipuai-coding-plan` 的别名。

当配置的 URL 或 `vendorKey` 匹配某个预设时，sidecar 的 Completions 模型记录会收到 `thinkingFormat: "zai"` 和 `zaiToolStream: true`。不引入新的线上适配器、密钥表或主机协议。

## 后果

- 中国和国际的 Zhipu 用户可以选择 API 或 Coding Plan，而无需从外部文档复制 URL。
- 目录增强会跟随所选的端点，而不是通用的自定义行。
- 通用 OpenAI 兼容配置仍保留为“自定义”端点选项。
- OpenCode Go 仍是 API 风格的预设；Zhipu 不会新增四个 apiStyle 值。
