---
title: 架构与工程
description: PI-Desktop 的桌面壳、进程边界、存储所有权和工程结构。
---

# 架构与工程

> **翻译说明：** 本页是与 [英文源文档](/spec/architecture/) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

这一主题说明桌面客户端如何拆分，以及每个进程和数据边界由谁负责。中文页面提供同步导览；完整契约见对应英文规格。

## 阅读顺序

1. [系统架构](/zh-CN/spec/02-architecture/01-architecture)
2. [应用技术栈](/zh-CN/spec/02-architecture/02-tech-stack)
3. [仓库结构](/zh-CN/spec/02-architecture/03-repo-structure)
4. [文档站](/zh-CN/spec/02-architecture/04-documentation-site)

## 系统地图

```text
Renderer UI → Electron orchestration → Rust host core
     ↓                  ↓                    ↓
 transcript       pi Node sidecar       SQLite + processes
```

Renderer 负责呈现，Electron 负责桌面能力协调，pi sidecar 负责代理循环，Rust host 负责特权进程、文件系统、RPC 和持久化边界。
