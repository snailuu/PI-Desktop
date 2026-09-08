# ADR 0010：使用 Rust 作为后端主机核心

> **翻译说明：** 本页是与 [英文源决策](/adr/0010-rust-backend-host-core) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-25

## 上下文

PI-Desktop 需要一个稳健的本地后端来支持：

- 文件系统工具
- 进程/命令执行
- 插件隔离边界
- 安全存储适配器
- 长时间运行的宿主服务

纯 Electron 主进程 TypeScript 后端是可行的，但在系统级任务和隔离方面较弱。

## 决策

使用 **Rust 作为后端主机核心**。

### 职责划分

| 层 | 技术 | 负责范围 |
|---|---|---|
| UI | React + TypeScript | 渲染、UX 状态 |
| Electron 外壳 | TypeScript | 窗口、preload 桥接、应用生命周期 |
| 主机核心 | **Rust** | 工具、权限网关、插件宿主服务、持久化适配器、特权操作 |
| 代理引擎 | Node/TypeScript (pi) | 模型供应商、代理循环、工具调用编排 |

### 通信

```text
Renderer
 → Electron preload/main IPC
 → Rust host core (local RPC / FFI / sidecar protocol)
 ↔ Node pi agent runtime (sidecar)
```

Electron↔Rust 传输的实现选择可以是：

1. Rust sidecar 进程通过 stdio/JSON-RPC 或 protobuf，或
2. 原生 Node/Electron 插件绑定

MVP 目标：**Rust sidecar + 本地 RPC**，以获得更清晰的隔离。

## 非目标

- 用 Rust 重写 pi 本身
- 在 MVP 中替换 pi 代理循环
- 将 UI 移入 Rust

## 后果

### 正面
- 强大的系统级后端
- 更好的隔离与性能余量
- 为工具/插件带来更清晰的安全边界

### 负面
- 比纯 TS 主进程有更多活动部件
- 需要将 Rust 二进制与 Electron 应用一起打包
