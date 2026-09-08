# ADR 0152：八帧空首页吉祥物 GIF

> **翻译说明：** 本页是与 [英文源决策](/adr/0152-eight-frame-empty-home-mascot-gif) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-04
- 决策者：PI-Desktop 核心
- 相关：D293、D294、E2E-046、E2E-099、US-UI-17
- 取代：ADR 0150

## 上下文

ADR 0150 将随机化的像素画精灵图集替换为 100px 的内联 SVG 代理标记，以使空首页主视觉保持安静。现在，新的八帧挥手吉祥物成为空首页的预期标记，其独立的浅色和深色 artwork 已经使用透明背景。之前的 SVG 轨道/呼吸循环不再与该 artwork 匹配，而单张栅格图在 shell 主题变化时会显得效果不佳。

## 决策

将内联 SVG 替换为处理后的八帧 GIF，放入现有的 100px 空首页槽位。`HomeMascotLogo` 是装饰性的（`aria-hidden="true"`），渲染四张图片，CSS 一次只显示其中一张：

- `src/assets/home-mascot-light.gif` / `home-mascot-dark.gif` —— 循环挥手，并在第一帧短暂停留
- `src/assets/home-mascot-still-light.png` / `home-mascot-still-dark.png` —— 匹配的第一帧，仅在 `prefers-reduced-motion: reduce` 下显示

活动的一对跟随 `document.documentElement[data-theme]`。除 `light` 之外的任何值都使用深色 artwork，与 `BrandLogo` 保持一致。播放由 GIF 原生驱动。没有随机选择，没有 JavaScript 计时器，指针悬停不会改变节奏。

## 后果

- 空首页品牌标识使用提供的吉祥物动作集，而不是代码原生的 SVG。
- 100px 布局槽位、装饰性角色和 reduced-motion 冻结保持不变。
- 浅色和深色表面各自保留专用的吉祥物处理，而不是通过主题 token 对单个资源重新着色。
- 历史文件 `home-mascot-groups.png` 图集不在仓库中；GIF 和静态帧才是源资源。

## 被否决的替代方案

- 保留 SVG 并忽略新帧：这会丢弃所请求的空首页动作集。
- 恢复随机化精灵图集：这会重新引入 ADR 0150 已移除的计时器、悬停和姿势选择状态。
- 用 JavaScript 驱动这八帧：这会增加 GIF 加 CSS 切换已经覆盖的计时器和 reduced-motion 状态。
- 两种主题使用同一个 GIF：提供的浅色和深色 artwork 会与相反的表面产生冲突。
