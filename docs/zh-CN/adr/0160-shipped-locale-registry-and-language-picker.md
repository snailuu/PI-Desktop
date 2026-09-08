# ADR 0160：已发布的 locale 注册表与可搜索的语言选择器

> **翻译说明：** 本页是与 [英文源决策](/adr/0160-shipped-locale-registry-and-language-picker) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- Status: Accepted（由 ADR 0182 修订）
- Date: 2026-09-05
- Decision owners: PI-Desktop desktop/i18n 维护者
- Related: D012, D073, ADR 0009

## Context

General 外观卡片将语言呈现为三张预览卡片
（Auto / 简体中文 / English）。这种控件无法扩展：每新增一个 locale
都需要硬编码一张卡片、一个示例字形，以及用于其名称的目录键。
产品现在发布的 UI locale 已超过两个，首批新增土耳其语，因此
选择器和 locale 列表必须来自同一个注册表。

插件标签保留 `en` + `zh-CN` 约定并回退到英文。
产品变更日志最初只发布这两种 locale；ADR 0182 增加了
繁体中文，且不要求插件补齐每一个外壳 locale。

## Decision

1. `@pi-desktop/i18n` 拥有 `supportedLocales` 注册表：id、原生名称
   （endonym，永不翻译）以及英文名称。`resolveLocale` 将 OS
   标签映射到该列表（`tr` / `tr-TR` → `tr`，简体中文标签 →
   `zh-CN`，繁体中文标签 → `zh-TW`，否则 `en`）。
   `catalogs[locale]` 是渲染器、应用菜单、
   托盘和原生同意对话框所使用的查找表。
2. `AppSettings.language` 为 `"auto"` 加上每一个注册表 id。Auto 仍然
   通过沙盒化 preload 桥接跟随 `app.getLocale()`。
3. Settings → General → Appearance 中主题保持为三张预览卡片。
   语言为可搜索的选择器行（与 Font
   和 Service 相同的锚定菜单模式）：Auto 固定在最上方并附带检测到的原生名称，随后是
   已发布的 locale，按其原生名称排列。搜索匹配原生名称、英文名称
   和 locale id。
4. 插件的 `PluginLocalizedString` 仍要求 `en` 和 `zh-CN`。其他
   外壳 locale 回退到英文。变更日志跟随已发布的外壳
   locale（当存在相应翻译时），否则回退到英文；
   其初始的 `en` / `zh-CN` 集合由 ADR 0182 添加 `zh-TW` 修订。

## Consequences

- 添加一个 UI locale 只需一个目录文件、一行注册表记录、一个
  `AppSettings.language` 联合成员，以及一个 Electron locale 包。选择器
  无需改动。
- 即使当前 UI 语言不为用户所知，原生名称也始终可被找到。
- 插件和发布说明不必在第一时间就发布每一个新的外壳 locale。

## Alternatives

- 将语言保持为可换行的预览卡片：超过三个或四个选项便难以阅读，而且名称
  仍然会被硬编码。
- 要求插件添加每一个已发布的 locale：会破坏现有清单，
  且与外壳翻译的规模不成比例。
