# 从这里开始

> **翻译说明：** 本页是与 [英文源页面](/guide/) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

PI-Desktop 是一个本地优先的 AI 编程代理桌面客户端。应用让工作区、宿主进程、代理运行时和供应商配置保持可见、可检查，同时让日常编程工作依然直接顺畅。

## 选择一条路径

| 如果你想… | 从这里开始 |
|---|---|
| 看看应用长什么样 | [界面截图](/zh-CN/guide/screenshots) |
| 了解已交付的功能范围 | [产品范围](/zh-CN/spec/01-product/01-product-scope) |
| 了解系统如何协同工作 | [架构](/zh-CN/spec/02-architecture/01-architecture) |
| 追踪某条协议或存储边界 | [运行时规格](/zh-CN/spec/03-runtime/01-ipc-protocol) |
| 构建扩展 | [插件开发](/zh-CN/plugin-development) |
| 理解某项决策为何存在 | [ADR 索引](/zh-CN/adr/README) |
| 验证用户可见的变更 | [E2E 测试计划](/zh-CN/spec/06-delivery/04-e2e-test-plan) |

中文入口遵循同样的路径：[打开双语指南](/zh-CN/guide/) 可阅读本地化的导览，并跳转到对应的主题地图。

## 心智模型

```text
Renderer UI  →  Electron orchestration  →  Rust host core
      ↓                    ↓                       ↓
  transcript          pi Node sidecar          SQLite + processes
```

渲染器负责呈现。Electron 协调各类桌面能力。Rust 主机核心掌管特权进程、文件系统、RPC 与持久化边界。pi sidecar 掌管代理循环以及面向供应商的模型调用工作。

## 使用文档

文档在事实来源层面以英文为先。[中文入口](/zh-CN/) 提供相同的信息架构，并为每份规格提供完整的翻译配套。每个中文页面都会链接回其英文源文；技术标识符保持不变，以便搜索和交叉引用的路径保持稳定。当你知道某个术语、协议方法或决策编号时，使用全局搜索；当你在探索某个领域时，使用侧边栏。

## 修改边界之前

1. 阅读相关的 spec。
2. 检查关联的 ADR 和决策记录。
3. 当行为对用户可见或对协议可见时，更新 E2E 场景。
4. 运行范围最小的有效验证，然后在变更中记录结果。

完整的仓库规则参见 [AI 开发工作流](/zh-CN/spec/06-delivery/03-ai-development-workflow) 和 [变更检查清单](/zh-CN/spec/06-delivery/05-change-checklist)。
