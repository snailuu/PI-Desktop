# 00. 概述

> **翻译说明：** 本页是与 [英文源规格](/spec/01-product/00-overview) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 一句话定义

**PI-Desktop** 是一个本地优先的 AI 编程代理桌面客户端，构建于：

- Electron 桌面外壳
- Rust 主机后端核心
- pi Agent Harness 负责模型/代理循环
- 用户可安装的插件扩展能力
- 独立的 MCP 服务器、Skills 和子代理

## 产品公式

```text
PI-Desktop =
 Electron Shell
 + React UI (English-first)
 + Rust Host Core
 + pi Agent Runtime
 + Local Tools
 + Plugin System
```

## 目标

1. 为 pi 驱动的代理提供稳定的桌面 UX
2. 支持多供应商流式聊天
3. 在显式权限下执行本地工具
4. 在本地持久化会话、设置和密钥
5. 允许用户安装/开发插件
6. 作为全球产品发布，默认语言为英语
7. 让同一个 Agent 检查任务、提交结构化 Plan，并且仅在获得单独的用户批准后
   才继续进入 Agent
8. 让同一个 Agent 协商达成批准的 Goal 契约，然后在 Agent 模式下自主推进其
   验收标准
9. 让项目会话、导入、扩展和定时提示在日常本地工作中切实可用

## 非目标（MVP）

- 远程 WebUI / 网关控制
- 完整的 IDE 替代
- 多人协作
- 用 Rust 重写 pi
- 插件市场优先的分发

## 关键架构决策

| 决策 | 选择 |
|---|---|
| 桌面外壳 | Electron |
| UI | React + Vite + TypeScript |
| 默认语言 | 英语 |
| 主机后端 | Rust |
| 代理引擎 | pi（`pi-ai` + `pi-agent-core`） |
| 代理进程 | Node sidecar / 受控进程 |
| 渲染器访问 | 仅 preload IPC |
| 扩展 | 用户可安装的插件 |
| 存储 | SQLite + 安全密钥存储 |

## 最小用户循环

1. 启动 PI-Desktop
2. 配置供应商/API 密钥
3. 打开项目工作区
4. 创建会话并发送任务
5. 选择 Agent、Plan 或 Goal；可选地检查项目并提交
   Markdown 检查点
6. 批准或拒绝检查点，并选择执行权限模式
7. 在需要时批准本地工具执行
8. 在转录中审查差异、命令输出、浏览器预览，以及工作面板中的文件
9. 重启应用；被中断的契约工作不会被重放

## 质量原则

1. **引擎稳定性优先** —— 先保证 pi 循环正确，再扩展功能
2. **默认最小权限** —— 对有风险的工具/插件默认拒绝
3. **可观测性** —— 每次工具调用和失败都可追踪
4. **可替换性** —— 供应商/工具/存储可以演进
5. **全球化就绪** —— 尽早建立英语源字符串和本地化架构

## 文档地图

- 基线：`../00-baseline.md`
- 产品范围：`01-product-scope.md`
- 架构：`../02-architecture/01-architecture.md`
- IPC：`../03-runtime/01-ipc-protocol.md`
- 代理运行时：`../03-runtime/02-agent-runtime.md`
- 工具/权限：`../03-runtime/03-tools-and-permissions.md`
- 里程碑：`../06-delivery/01-mvp-milestones.md`
- 插件：`../07-plugins/01-plugin-system.md`
