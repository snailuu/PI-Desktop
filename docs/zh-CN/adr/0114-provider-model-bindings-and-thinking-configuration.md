# ADR 0114：持久化供应商模型绑定与思考配置

> **翻译说明：** 本页是与 [英文源决策](/adr/0114-provider-model-bindings-and-thinking-configuration) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-21
- 决策者：PI-Desktop 核心
- 更新 ADR 0020 与 ADR 0027

## 上下文

供应商工作室此前只存储一个 `defaultModelId`，并把上下文、输出与思考能力的决策保留在运行时/目录代码中。这导致一个供应商无法为多个模型保留设置，也使自定义模型与未配置的默认值无法区分。新的供应商对话框需要选择多个模型、为每个模型保留独立的限制，并允许用户显式启用或禁用思考级别。

## 决策

`ProviderPublic`、`ProviderCreateInput` 和 `ProviderUpdateInput` 暴露一个 `models: ModelBinding[]` 字段。一个绑定包含：

```ts
type ModelBinding = {
  id: string
  contextWindow: number
  maxTokens: number
  thinkingLevels: ThinkingLevel[]
  defaultThinkingLevel: ThinkingLevel | null
}
```

Rust 主机核心把该数组持久化到 `providers.config_json.models` 下，这使供应商特定的设置以增量方式扩展，并保留在既有的存储所有者内部。`default_model_id` 保留为兼容字段，并在新写入时镜像第一个绑定。当前对话继续解析第一个绑定；未来的对话模型选择器可能会选择其他绑定。

内置的 pi-ai 目录仍是已知模型元数据的权威来源。设置界面以其上下文窗口、最大输出、推理标志和思考级别映射作为初始值，但把用户的编辑写入绑定。未知的自定义模型使用 128,000 上下文、8,192 最大输出、无思考级别，以及 null 默认值。模型创建后可手动为其启用思考。

## 迁移与兼容性

当存储的供应商没有 `config_json.models` 数组时，主机核心会从 `default_model_id` 用自定义回退值生成一个绑定。该生成的绑定由 `providers.list` / `providers.get` 返回；下一次供应商创建/更新会写入新数组。现有客户端可以继续发送或读取 `defaultModelId`，并且 Electron 主进程在解析运行时模型时，会先回退到 `models[0]?.id`，再使用遗留字段。

## 影响

- 多个模型配置可在重启和供应商编辑之后保留。
- 思考级别回退是确定性的：规范顺序为
  `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。
- 空的思考支持由 `thinkingLevels: []` 和
  `defaultThinkingLevel: null` 表示，而不是伪造的 `off` 选择。
- 供应商存储契约以增量方式变更，无需新的 SQLite 表
  或迁移版本。
- 对话模型切换与路由策略明确不在范围内；第一个绑定即当前运行时默认值。
