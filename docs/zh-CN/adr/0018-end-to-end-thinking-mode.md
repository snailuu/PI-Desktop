# ADR 0018：将思考模式贯通完整的会话流水线

> **翻译说明：** 本页是与 [英文源决策](/adr/0018-end-to-end-thinking-mode) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-26

## 上下文

桌面端此前暴露的用力等级（effort）标签仅存在于渲染器状态中。pi 运行时在构造时禁用了推理，所选等级从未跨越 IPC，助手思考事件也没有持久或可见的表示。移除这个装饰性控件修复了误导性的 UI，但也让具备推理能力的模型失去了可操作的选项。

pi 已经提供了模型推理元数据、支持的思考等级、供应商特定的请求序列化，以及独立的思考流块。PI-Desktop 需要的是一个权威的会话值，以及一条无损地穿越每一个进程边界的路径，而不是又一个仅存在于渲染器中的偏好项。

## 决策

思考模式是会话作用域的运行时配置，其规范等级为 `off`、`minimal`、`low`、`medium`、`high`、`xhigh` 和 `max`。

完整路径为：

```text
model capability -> session.thinkingLevel -> renderer/main IPC
-> sidecar prompt -> pi Agent thinkingLevel -> thinking stream events
-> UiMessage.thinking -> host canonical blocks -> transcript disclosure
```

- 当供应商没有显式覆盖时，模型能力从 pi 的内置目录中推断。自定义供应商可以显式启用或禁用推理。
- 感知能力的 UI/主进程/sidecar 边界使用相同的就近支持值钳制。主机在不了解供应商的情况下验证规范枚举。不支持推理的供应商始终解析为 `off`。
- 输入框仅在所选供应商/模型具备推理能力时渲染该选择器，并通过 `session.configure` 持久化更改。
- 思考文本在流事件、持久化、渲染和复制操作中与回答文本保持分离。
- 主机 schema v3 新增 `sessions.thinking_level`；助手推理内容存储为规范的 `thinking` 内容块。既有的 v2 会话迁移为 `off`。
- 由于会话和消息的线上格式发生变化，共享/主机协议版本升级到 2。

这扩展了 D091：推理控件之所以可以可见，是因为它现在拥有端到端的运行时实现。

## 后果

- 推理选择在重启后仍然保留，并应用于该会话的下一回合。
- 稀疏的模型能力集合——包括无法完全禁用推理的模型，以及诸如 `["off","high"]` 这类类布尔的客制集合——在设置、输入框、主进程和 sidecar 之间一致地解析。
- 仅含思考的流更新可以展开对话记录，而不会创建空的回答气泡。
- 搜索和回答复制行为排除思考文本。
- 旧数据库以追加方式迁移；旧的协议对端会在正常的版本握手时失败，而不是静默丢弃新字段。

## 备选方案

### 将用力等级保留在渲染器本地存储中

已拒绝，因为它无法影响请求，也无法作为会话真相存续。

### 将思考文本放入助手回答内部

已拒绝，因为它会破坏回答的 markdown、复制语义、搜索文本，以及 pi 已经在推理和最终输出之间提供的区分。

### 启用一个通用的推理布尔值

已拒绝，因为 pi 的各模型暴露的支持等级各不相同，有时还是稀疏的；将它们折叠会丢失模型能力信息。

## 参考资料

- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/03-runtime/02-agent-runtime.md`
- `docs/spec/03-runtime/04-data-storage.md`
- `docs/spec/03-runtime/06-host-rpc-protocol.md`
- `docs/spec/03-runtime/11-provider-model-system.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md` (D096)
