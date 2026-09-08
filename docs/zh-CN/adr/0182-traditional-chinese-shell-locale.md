# ADR 0182：繁体中文 shell locale

> **翻译说明：** 本页是与 [英文源决策](/adr/0182-traditional-chinese-shell-locale) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-08
- 决策负责人：PI-Desktop desktop/i18n 维护者
- 相关：ADR 0160、D314、E2E-091

## 上下文

locale registry 已经让语言选择器可扩展，但所有繁体中文操作系统标签仍然解析到简体中文目录。这导致自动选择对繁体中文用户不正确，也让 shell 和应用内发布说明保留简体中文术语。

## 决策

1. 将 `zh-TW` 作为独立的完整 shell 目录发布，原生名称为
   `繁體中文`，包括主机核心拥有的插件面板 chrome。可搜索的
   语言选择器继续读取共享的 locale registry，因此
   无需特定于 locale 的 UI 代码。
2. 将 `zh-TW`、`zh-Hant`、`zh-HK` 和 `zh-MO` 标签解析为 `zh-TW`，包括
   下划线分隔的形式。通用 `zh` 和简体中文地区
   继续解析为 `zh-CN`。
3. 将 `zh-TW` 添加到 `AppSettings.language`，并打包 `zh-TW` 和
   `zh_TW` 两个 Electron locale 目录。无主机协议或存储 schema
   版本变更。
4. 添加匹配的 `zh-TW` 产品变更日志目录，并将繁体中文
   发布说明请求解析到该目录。插件清单保留其现有
   `en` + `zh-CN` 契约；没有繁体中文字段的插件
   回退到英文，如 ADR 0160 所规定。

## 后果

- 繁体中文用户获得独立的 shell、正确的自动检测、
  可搜索的语言选择、感知 locale 的日期格式，
  以及繁体中文发布说明。
- i18n 和变更日志目录一致性测试覆盖一个额外的已发布
  locale。
- 新的 shell locale 仍遵循 ADR 0160：添加目录、registry 行、
  设置联合成员、Electron locale 包，以及相关验证。

## 备选方案

- 继续将繁体中文标签映射到 `zh-CN`：拒绝，因为文字和
  常用 UI 术语不同。
- 只添加 `zh-TW`，而将发布说明保留为 `zh-CN`：拒绝，因为
  更新界面是活动产品 shell 的一部分。
