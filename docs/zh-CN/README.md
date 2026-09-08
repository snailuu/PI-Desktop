# PI-Desktop 文档

> **翻译说明：** 本页是与 [英文源文档](/README) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

`docs/` 是一个 VitePress 项目。已发布的站点从 [`index.md`](/zh-CN/) 开始；
仓库的英文技术权威来源仍然组织在 `spec/` 和 `adr/` 下。

## 本地命令

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
pnpm docs:check
```

## 布局说明

- `spec/`、`adr/`、`project/`、`guide/`、`plugin-development.md` 以及本 README
  是英文权威来源；`zh-CN/` 按路径逐一镜像上述每一项，并由 `pnpm docs:check`
  校验。
- `image/` 存放仓库 README 中嵌入的图片。`public/` 存放站点自身提供的资源
  （品牌标识、截图）。
- `project/` 保存历史规划记录；当前状态位于 changelog 和 GitHub Issues 中。

## 入口

- [英文文档站点](/)
- [中文入口](/zh-CN/)
- [快速指南](/zh-CN/guide/)
- [规格索引](/zh-CN/spec/README)
- [ADR 入口](/zh-CN/adr/)
- [ADR 索引](/zh-CN/adr/README)
- [插件开发](/zh-CN/plugin-development)
- [可视化验证](/zh-CN/project/2026-08-13-docs-redesign-verification)

中文入口镜像了英文的阅读路径，并为每个被镜像的页面提供路径一一对应的配套页面。
每个已翻译的页面都链接到规范的英文源文件，并保留代码、协议字段和标识符。随着文档
集合不断增长，生成的侧边栏会保持两个语言树的完整。
