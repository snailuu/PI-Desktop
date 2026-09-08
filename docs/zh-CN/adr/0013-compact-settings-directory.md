# ADR 0013：将设置导航整合为四个目的地

> **翻译说明：** 本页是与 [英文源决策](/adr/0013-compact-settings-directory) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：部分被 ADR 0026 取代
- 日期：2026-07-26

## 上下文

基线 0.4.0 在 D062–D065 中冻结了与 Codex 对齐的宽泛设置导航栏。
该目录公开了 Personal、Integrations 和 Coding 分组，其中包含独立的 Appearance 和 Providers 目的地，以及大量占位行。已交付的本地优先工作流需要更少的顶层选项，同时现有的全页外壳、内容卡片、供应商管理、会话导入和诊断必须保持可用。插件管理在应用主外壳中已有专用目的地，无需在设置中重复条目。

更改这些已冻结的视觉一致性决策需要明确的基线决策，而不是静默重写历史行。

## 决策

保留 D063/D070 中的全页设置外壳、返回应用操作、搜索控件、导航栏度量、内容卡片和主题行为。

将宽泛的分组目录替换为恰好四个目的地，顺序如下：

1. General
2. Configuration
3. Import sessions
4. About

Appearance 成为 General 中的卡片。Providers 成为 Configuration 中的卡片。两者均不作为独立的导航栏目的地出现。不渲染任何占位设置目的地。

供应商设置深层链接和内置命令指向 Configuration 中的 Providers 卡片。Import sessions 保留其专用的 Settings 目的地。插件管理仍位于应用外壳现有的 Plugins 目的地，用户可以在那里加载、启用、禁用和卸载插件。

## 后果

- 设置导航栏更短，且仅包含已实现、有用的目的地。
- 主题控件仍可在 General 下被发现。
- 供应商管理仍可从模型设置流程访问，而无需占用另一行导航栏。
- 插件管理仍可从应用外壳访问，而无需在 Settings 中重复。
- 全页外壳和既有的浅色/深色视觉度量不变。
- 规格和 E2E 场景必须断言精确的四项顺序以及两个合并部分。
- D090 取代 D062–D065 中关于导航/内容位置的条款，包括其中 Plugins 的 Settings/Integrations 放置，以及 D070 中 Account 特定的度量。

## 替代方案

### 保留宽泛的 Codex 目录

被拒绝，因为空洞且低价值的目的地会掩盖已实现的本地工作流。

### 完全移除 Appearance 或 Providers

被拒绝，因为主题选择和供应商配置是必需的产品能力；整合可在没有独立目的地的情况下保留它们。

## 参考

- `docs/spec/00-baseline.md`
- `docs/spec/04-ux/01-ui-ia.md`
- `docs/spec/04-ux/06-settings-ia.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `docs/spec/08-meta/decisions-log.md` (D090)
