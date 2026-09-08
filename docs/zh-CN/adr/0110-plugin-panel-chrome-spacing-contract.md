# ADR 0110：将插件面板外壳间距契约版本化

> **翻译说明：** 本页是与 [英文源决策](/adr/0110-plugin-panel-chrome-spacing-contract) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- Status: Accepted
- Date: 2026-08-20
- Deciders: PI-Desktop core
- Related: [ADR 0092](/zh-CN/adr/0092-plugin-owned-panel-surface) ·
  [ADR 0093](/zh-CN/adr/0093-plugin-panel-strict-drag-band) ·
  [ADR 0104](/zh-CN/adr/0104-plugin-contributed-work-panel-views) ·
  [07-plugins](/zh-CN/spec/07-plugins/03-plugin-api)

## Context

由主机核心持有的插件胶囊预留了一条严格的 46px 拖拽带。较旧的插件页面使用普通的 body 内边距，并依赖 preload 来添加该拖拽带。较新的页面还会读取 `--pi-plugin-titlebar-height`，这使得叠加的主机内边距与安全区重复，并在插件自有的工具栏或卡片上方留下过多空白。内置的 Files 页面与创作模板需要一份确定性的契约，使其在分离放置与停靠放置下都能正常工作。

## Decision

1. 当前插件页面声明 `<meta name="pi-plugin-chrome" content="v2">`。
2. preload 在页面布局之前发布 `--pi-plugin-titlebar-height`：分离的面板为 `46px`，停靠的视图为 `0px`。
3. v2 页面自行负责其正常文档流中的间距，并且必须使用该变量。主机不再额外添加上内边距。没有该标记的页面保留旧版的叠加偏移量，以便已安装的插件保持兼容。
4. 主机胶囊仍然是位于 46px 拖拽带右上角的封闭式、随页面自适应的三控件胶囊；插件页面自行负责其标题、工具栏和各个界面。主机在外观变更后重新采样页面颜色。
5. 第一方示例、内置插件和生成的 panel 模板使用中性的 PI-Desktop token 色阶以及 v2 标记。

## Consequences

- 插件页面不再需要猜测主机是否已插入安全区，分离与停靠的入口也可以共用同一套布局。
- 在作者迁移期间，现有的第三方页面仍能正常渲染。
- 该标记是一个小型的公开 HTML 契约，而不是 manifest schema 变更，因此插件无需修订包格式即可采用它。
