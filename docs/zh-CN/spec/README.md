# PI-Desktop 规格

> **翻译说明：** 本页是与 [英文源规格](/spec/README) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

> 冻结基线：`0.4.16` · 当前应用线：`0.13.3`
> 更新日期：`2026-09-05`
> 语言：**英文优先**
> 技术栈：Electron + **Rust 主机核心** + pi Agent Harness + 用户可安装插件

基线是冻结的决策工件，并非当前应用中每一项功能的完整清单。当前实现新增了 Goal 契约、独立 MCP/Skills/Subagents、插件市场与启动器流程、会话导入、定时任务，以及下一回合输入框配置。宿主传输协议为 v10；存储 schema 为 v12（见 `00-baseline.md`）。

## 快速入口

| 文档 | 描述 |
|---|---|
| [NAV.md](/zh-CN/spec/NAV) | 单页完整导航 |
| [00-baseline.md](/zh-CN/spec/00-baseline) | 冻结基线 |
| [08-meta/decisions-log.md](/zh-CN/spec/08-meta/decisions-log) | 冻结的详细决策 |
| [01-product/00-overview.md](/zh-CN/spec/01-product/00-overview) | 概述 |
| [01-product/01-product-scope.md](/zh-CN/spec/01-product/01-product-scope) | 当前产品范围与运行模式 |
| [02-architecture/01-architecture.md](/zh-CN/spec/02-architecture/01-architecture) | 架构 |
| [03-runtime/05-host-core-rust.md](/zh-CN/spec/03-runtime/05-host-core-rust) | Rust 主机核心 |
| [04-ux/02-i18n-english-first.md](/zh-CN/spec/04-ux/02-i18n-english-first) | i18n 策略 |
| [04-ux/07-ui-design-system.md](/zh-CN/spec/04-ux/07-ui-design-system) | 设计系统（token、动效、密度） |
| [04-ux/01-ui-ia.md](/zh-CN/spec/04-ux/01-ui-ia) | 已发布外壳与导航目标图 |
| [../project/plan-mode-implementation-plan.md](/zh-CN/project/plan-mode-implementation-plan) | Plan 运行状态实现计划 |
| [07-plugins/01-plugin-system.md](/zh-CN/spec/07-plugins/01-plugin-system) | 插件系统 |
| [06-delivery/03-ai-development-workflow.md](/zh-CN/spec/06-delivery/03-ai-development-workflow) | AI 开发工作流规则 |
| [06-delivery/04-e2e-test-plan.md](/zh-CN/spec/06-delivery/04-e2e-test-plan) | E2E 测试计划与场景 |
| [06-delivery/05-change-checklist.md](/zh-CN/spec/06-delivery/05-change-checklist) | 变更检查清单 |

## 目录结构

```text
docs/spec/
├── 00-baseline.md
├── 01-product/
├── 02-architecture/
├── 03-runtime/
├── 04-ux/
├── 05-security/
├── 06-delivery/
├── 07-plugins/
└── 08-meta/
```

## 阅读路径

### 产品
1. `00-baseline.md`
2. `01-product/00-overview.md`
3. `01-product/01-product-scope.md`
4. `06-delivery/01-mvp-milestones.md`

### 实现
1. `00-baseline.md`
2. `02-architecture/01-architecture.md`
3. `03-runtime/05-host-core-rust.md`
4. `03-runtime/02-agent-runtime.md`
5. `03-runtime/01-ipc-protocol.md`
6. `03-runtime/11-provider-model-system.md`
7. `07-plugins/01-plugin-system.md`

### 插件作者
1. [`../plugin-development.md`](/zh-CN/plugin-development)
2. `07-plugins/01-plugin-system.md`
3. `07-plugins/02-plugin-manifest-schema.md`
4. `07-plugins/03-plugin-api.md`
5. `07-plugins/10-plugin-devex.md`
6. `examples/plugins/hello`

## 冻结决策（简版）

1. Electron 外壳
2. 英文优先的产品/文档
3. Rust 宿主后端核心
4. Node sidecar 中的 pi 代理引擎
5. 宿主 RPC = stdio JSON-RPC NDJSON
6. SQLite 仅由 Rust 独占
7. 默认模式 = Agent；运行选择器 = Agent | Plan | Goal。Plan 和 Goal
   是同一个 Agent 的契约状态，并非严格的只读安全
   配置，因为 Bash 会遵循所选的权限模式
8. SubmitPlan 将精确的 Markdown 字节写入新的宿主拥有的
   `.pi/plan/*.md` 工件；标题/问题以结构化形式保留在
   `plan_approvals` 中，审批会打开该工件，仅有批准/拒绝两种操作，并
   在 30 个绝对分钟后以 `PLAN_APPROVAL_TIMEOUT` 过期
9. 协议 v11 和存储 schema v13 是 Plan/Goal
   检查点、`plan_approvals` 执行字段、启动中断以及
   shell 标识的权威依据。v11 撤回了 v10 中新增的 A2A 方法域。
10. 权限超时 120 秒后拒绝；Bash 超时默认 60 秒
11. 本地用户可安装插件（插件市场后续推出）
12. 发布标签 = macOS arm64 与 Intel x64、Windows x64，以及 Linux x64（D126/D285）
13. 通用供应商/模型覆盖（原生 + OpenAI 兼容 + 自定义）
