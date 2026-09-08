---
title: 安全
description: PI-Desktop 的权限、路径、插件和进程隔离边界。
---

# 安全

> **翻译说明：** 本页是与 [英文源文档](/spec/security/) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

安全规格描述哪些操作需要授权、哪些路径可以访问，以及插件和宿主进程如何隔离。

## 关键入口

- [安全模型](/zh-CN/spec/05-security/01-security)
- [工具与权限](/zh-CN/spec/03-runtime/03-tools-and-permissions)
- [插件安全](/zh-CN/spec/07-plugins/04-plugin-security)
- [Host RPC 与资源隔离](/zh-CN/spec/03-runtime/06-host-rpc-protocol)

## 维护规则

任何权限、进程、路径、插件能力或 secret 存储变化，都需要同步更新英文规格、ADR 和 E2E 测试计划。
