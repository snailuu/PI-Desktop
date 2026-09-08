# ADR 0048：按回合惰性激活工具

> **翻译说明：** 本页是与 [英文源决策](/adr/0048-lazy-per-turn-tool-activation) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-02

## 上下文

PI-Desktop 目前会在首个供应商请求之前注册产品工具、插件工具、技能以及插件开发辅助工具。随后，即使提示只是一个问候或一个只读任务，完整的 JSON schema 也会被序列化进该请求。这使得首个输入异常庞大，并在每个新的用户回合中重复相同的可选 schema。

pi 的 coding-agent 接口面将活跃工具集与完整注册表分离，并为未激活的能力使用紧凑的提示片段。pi-agent-core 还支持在回合边界替换上下文，并使用 `addedToolNames` 标记工具结果；当供应商支持时，pi-ai 适配器可以使用该标记进行原生延迟工具搜索。

## 决策

PI-Desktop 保留一份完整的 sidecar 本地工具注册表，但只向供应商发送活跃子集：

- Agent 模式以 `Read`、`Bash`、`Edit` 和 `Write` 启动，与 pi 的 coding-agent 核心保持一致。
- Chat 模式以 `Read`、`Glob` 和 `Grep` 启动。
- 当存在延迟能力时，本地 `ToolSearch` 工具保持活跃。*（ADR 0061 移除了 `CompactContext` 工具，该工具同样被此列表始终激活；ADR 0064 将其恢复为 `new_context`，在所有模式下同样始终活跃。）*
- Agent 模式下的 `Glob` 和 `Grep`、`BrowserPreview`、插件工具、`Skill` 以及插件开发辅助工具都会延迟，直到被请求时才激活。

基础提示中包含一份大小受限的 `# On-demand tools` 目录，只列出名称和紧凑的单行描述，绝不包含被延迟的 JSON 参数 schema。模型使用精确名称或简短的能力查询来调用 `ToolSearch`。sidecar 会对匹配项排序，最多激活四个，在 `addedToolNames` 中返回它们的名称，并在下一次供应商请求之前重建上下文。支持原生延迟工具搜索的供应商可以在该加载点序列化新激活的 schema；不支持者则通过普通工具列表接收活跃 schema。

在每个新的用户提示开始时，延迟集合都会被清空。ToolSearch 不调用主机核心，也不会绕过权限、工作区约束、超时或审计行为。激活标记会保留在持久化的工具结果内部，以便转录重建时保留供应商消息语义。重新启动的运行时在使用延迟能力之前，仍然需要一次新的 ToolSearch 调用。

## 影响

- 简单的首个回合不再为每个可选工具 schema 付出代价。
- 核心编码工作流保持 pi 的 Read/Bash/Edit/Write 集合，无需额外的发现调用；文件枚举与搜索只需一次 ToolSearch。
- 需要辅助能力的任务在获得该能力之前，会多出一个显式的 ToolSearch 回合。
- ToolSearch 是一行普通的模型工具活动记录，因此发现步骤是可见且持久化的，而不是不透明的副作用。
- 供应商兼容性仍集中在 pi-ai 中：原生延迟搜索只是一种优化，而活跃上下文回退对每个适配器都有效。
- 插件描述在提示目录中受到长度限制，庞大的插件注册表也无法重新引入最初的 schema 泛滥。

## 备选方案

### 在每个请求中都发送全部 schema

被否决，因为它把首回合上下文浪费在模型并不需要的能力上，而且会随插件注册表的增长而增长。

### 根据提示文本启发式激活工具

被否决，因为用户措辞和项目指令并不是可靠的能力分类器，而且一旦启发式规则漏判，就会隐藏一个可用的工具。

### 仅使用供应商原生的工具搜索

被否决，因为并非每个已配置的供应商都支持它。sidecar 需要一个与供应商无关的活跃工具契约，并将原生搜索作为适配器层的优化。

## 参考资料

- `docs/spec/03-runtime/02-agent-runtime.md`
- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md` (E2E-008a)
- `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/src/core/system-prompt.ts`
- `https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md`
