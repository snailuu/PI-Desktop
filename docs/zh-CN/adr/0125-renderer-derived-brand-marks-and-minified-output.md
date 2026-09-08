# ADR 0125：渲染器随包发布派生的品牌标识与压缩输出

> **翻译说明：** 本页是与 [英文源决策](/adr/0125-renderer-derived-brand-marks-and-minified-output) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-26
- 相关：ADR 0083、D079、D094
- 基线：`0.10.8`

## 上下文

渲染器输出为 31 MiB，其中三项开销源于偶然，而非产品决策：

1. `electron-vite` 将其渲染器预设硬性默认为 `minify: false`，与原生 Vite 不同。`apps/desktop/electron.vite.config.ts` 未覆盖该设置，因此每次生产构建都输出未压缩的 chunk；仅入口 chunk 就有 108,273 行。
2. KaTeX 的样式表为其每个字形都声明了 `woff2`、`woff` 和 `truetype` 三种来源。随附的 Chromium 普遍支持 `woff2`，因此这 40 个 `.woff`/`.ttf` 文件（0.78 MiB）被产出却从未被加载。
3. D079 和 D094 将 `build/icon_1024.png` 指定为规范品牌标识，而 `BrandLogo` 直接导入它。该文件是 1024x1024 的母版，`scripts/make-icon.py` 由它派生出 `build/icon.icns`。`BrandLogo` 的渲染尺寸为 16、20 和 64 CSS px，因此渲染器携带了 1.04 MiB 的 PNG 只为绘制一个 64 px 的标识。

这些都不是 Electron 自身的体积。解包后的应用约为 279 MB，但不含任何应用代码的裸 Electron 43.4.0 外壳已经约有 277 MB，因此渲染器是唯一值得优化的部分。

## 决策

1. 渲染器构建显式设置 `minify: "esbuild"`。该设置由 `packaging-footprint.test.mjs` 断言，因为框架默认值可能会悄悄将其撤销。
2. 一个 `pi-drop-legacy-font-fallbacks` Vite 插件通过 `enforce: "pre"` 从 CSS 中移除 `woff` 和 `truetype` 的 `src` 条目，且是在 Vite 将 `url()` 值注册为资源之前。若在其后剥离，资源仍会被产出。只会移除以逗号前缀的备选条目，因此单一声明来源为 `woff` 或 `truetype` 的字形会保留该来源。
3. `build/icon_1024.png` 和 `build/logo_dark.png` 仍为规范品牌母版，也是安装器图标的唯一事实来源。此决策在一点上修订了 D079 和 D094：渲染器导入的是位于 `apps/desktop/src/assets/brand/logo-light.png` 和 `logo-dark.png` 的**派生**标识，而非母版。派生文件为 192x192，足以覆盖 64 px 渲染在 3 倍设备像素比下的需求。母版变更时，使用 `sips -Z 192` 从母版重新生成它们；视觉识别保持不变。

两款随附的 CJK 字体保持不做子集化。ADR 0083 第 2 节将 `Noto Sans SC` 追加到每个字体栈中，以确保中文文本在离线状态下仍可阅读，而子集化会从用户提供的内容中丢失字形。要缩减这 15 MiB，需要修订 ADR 0083，而不是改动构建配置。

## 后果

- `out/renderer` 从 31 MiB 降至 24 MiB：JavaScript 从 12.53 MiB 降至 7.72 MiB，旧式字体回退从 0.78 MiB 降至 0，PNG 品牌资源从 1.23 MiB 降至 0.06 MiB。
- 压缩后的渲染器堆栈跟踪需要借助 devtools 源码视图；不产出 sourcemap，这与上一版本的行为一致。
- 品牌标识现在存在于两处。`packaging-footprint.test.mjs` 断言渲染器不导入 `build/` 下的内容，因此未来若有贡献者重新引入母版路径，测试套件会失败，而不是悄然恢复 1 MiB 体积。
- 剥离旧式字体格式之所以安全，仅因为应用完全运行在随附的 Chromium 中。插件面板会将自己的主题 CSS 清理为 `data:` URI，无法引用渲染器的字体资源，而文档站点使用独立主题。
