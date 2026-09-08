# ADR 0157：主进程负责的 GitHub issue 反馈

> **翻译说明：** 本页是与 [英文源决策](/adr/0157-main-owned-github-issue-feedback) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- Status: Accepted
- Date: 2026-09-05
- Deciders: PI-Desktop core
- Related: D120, D313, ADR 0022

## 上下文

没有应用版本、操作系统或复现步骤的 bug 报告无法
进行分诊。设置 → 信息已经显示版本和日志，但用户在应用内没有通往 GitHub issue 创建页面的路径，而现有的 issue 表单将这些分诊字段视为可选。

## 决策

1. GitHub issue 表单是唯一的提交入口（`blank_issues_enabled: false`）。
   bug 表单要求填写描述、复现步骤、预期行为和
   实际行为、应用版本以及操作系统。功能表单要求填写问题和
   提议的变更。英文是源标签语言；中文
   保留在相同字段上。
2. 设置 → 信息暴露一个**报告问题**行。其操作会调用
   允许列表中的 `pi-desktop/app/openFeedback` 通道。Electron 主进程会构建
   一个固定的 GitHub bug 表单 URL，从主进程拥有的版本信息预填 `app-version`、`os` 和
   `environment`，并使用
   `shell.openExternal` 打开它。渲染器无法提供 URL。
3. 构造的 URL 必须保持在 `https://github.com/vastsa/PI-Desktop/issues/new`
   并带有 `template=bug_report.yml`。功能请求仍可从
   GitHub 的模板选择器获取，而不是从第二个设置操作发起。

## 后果

- 分诊数据在提交时收集，而不是在后续评论中收集。
- 打开 GitHub 遵循与发布页面相同的“主进程拥有 URL”规则。
- 无主机协议、存储或更新源变更。

## 备选方案

- 渲染器通过 `window.open` 打开构造的 URL：被拒绝，因为这会
  让沙箱选择目的地，与 `updates/openReleases` 的做法不同。
- 打开模板选择器但不预填版本：被拒绝，因为
  设置行已经拥有权威的版本信息。
