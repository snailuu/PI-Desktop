# ADR 0083：自定义全局 UI 字体

> **翻译说明：** 本页是与 [英文源决策](/adr/0083-custom-global-ui-font) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受实施
- 日期：2026-08-14
- 基线：`0.4.16`
- 协议：v9（新增一个 Electron 主进程 IPC 通道；主机 RPC 不变）
- 存储 schema：v10（可选的 `AppSettings.fontFamily` JSON 字段）

## 上下文

外壳排版使用单一硬编码的 token 栈（`--font-sans`）。用户希望能在设置中选择全局 UI
字体——包括可安全用于商业用途的开源许可字体——类似于 dbx 桌面客户端中的字体选择器，
后者会枚举系统字体并内置一个 OFL 字体家族。

渲染器被沙箱化在 preload IPC 允许列表之后，且应用发布的是内置渲染器，因此字体来源
必须是本地的（不得使用 CDN/CSS 字体服务，参见
[07-ui-design-system §2](/zh-CN/spec/04-ux/07-ui-design-system)）。

## 决策

### 1. 设置选择器与持久化

设置 → 基础 → 外观 新增一行 **字体**，带有可搜索的选择器。选择结果持久化为
`AppSettings.fontFamily`，即一个 CSS `font-family` 栈字符串。值缺失或为空表示使用
内置 token 栈；选择器始终将 **系统默认** 列在首位。选择系统默认时持久化的是一个空栈
（`fontFamily: ""`），而不是移除该键：`settings.set` 将提供的字段合并到已存设置中，
而 JSON 序列化会丢弃 `undefined`，因此省略该键无法清除已存储的覆盖值。

选择器菜单以固定定位的 body 层级浮动层形式 portal 到 `document.body`（以触发器为
基准测量并限制在视口内），因此设置卡片的 `overflow` 不会裁剪或挤压它；它遵循组件
规格中的 body 层级浮动层契约。

### 2. 内置的开源许可字体家族

应用内置四种字体家族，格式为 `woff2`，全部采用 SIL Open Font License 1.1
（可免费用于商业用途及再分发；许可文本随附于
`apps/desktop/src/assets/fonts/licenses/`）：

| 字体家族 | 文字覆盖 | 来源 |
|---|---|---|
| Geist | 拉丁文（可变字体） | vercel/geist-font |
| Inter | 拉丁文（可变字体） | rsms/inter |
| Noto Sans SC | CJK（可变字体） | google/fonts（Source Han Sans 谱系） |
| LXGW WenKai | CJK 楷体（常规） | lxgw/LxgwWenKai |

每个栈都会追加一个 CJK 回退层级（`Noto Sans SC`、`PingFang SC`、`Hiragino Sans GB`、
`Microsoft YaHei`、`sans-serif`），因此在所选字体家族不含 CJK 字形时，中文文本依然
可读。等宽字体栈（`--font-mono`）保持不变。

### 3. Electron 主进程中的系统字体枚举

Electron 主进程仅使用平台工具解析已安装的系统字体家族（不使用原生模块），从而使
主进程包保持自包含：

- macOS：`osascript` JXA 桥接
  `CTFontManagerCopyAvailableFontFamilyNames`——即 `font_kit::all_families()` 使用的
  同一个 CoreText 查询，能在数十毫秒内返回规范的 CSS 字体家族名称——并在 osascript
  不可用时保留 `system_profiler SPFontsDataType -json` 作为回退
- Windows：PowerShell `[Windows.Media.Fonts]::SystemFontFamilies`
- Linux：`fc-list -f "%{family[0]}\n"`

结果会去重、过滤（排除以 `.` 开头的隐藏字体家族）、排序，并在每个进程内缓存 60 秒。
渲染器通过一个新加入允许列表的 IPC 通道 `pi-desktop/app/systemFonts` 获取它们。

### 4. 应用方式

渲染器根据 `AppSettings.fontFamily` 在 `document.documentElement` 上覆盖
`--font-sans`；`body` 以及所有 `var(--font-sans)` 使用方无需重新加载即可生效。内置
字体家族的 `@font-face` 规则位于 `apps/desktop/src/styles/fonts.css`，在 token 层
之前导入。

## 影响

- 用户只需选择一次全局 UI 字体；该选择在重启后仍然保留，并可直接从内置文件离线
  渲染。
- 通过追加的回退层级，每个选项的 CJK 覆盖都保持正确。
- macOS 枚举通过快速的 CoreText 路径在数十毫秒内完成解析（此前的 `system_profiler`
  路径耗时 2–5 秒，现在仅作为回退）；结果在每个进程内缓存 60 秒，并返回
  `PingFang SC` 这类规范字体家族名称，而非 system_profiler 的本地化别名（如
  `苹方-简`）。
- 安装包因内置字体文件增大约 16 MB。
- `@font-face` 的 `font-weight` 描述符被豁免于样式 token 守卫，因为它们描述的是
  字体文件，而非 UI 排版。

## 替代方案

- **在主机核心中使用 `font_kit`**（dbx 的做法）：原生枚举速度快，但会为一个仅渲染器
  使用的偏好设置新增一个主机 RPC 方法并扩大主机协议面；而 Electron 主进程通过
  `osascript` JXA 桥接即可获得相同的 CoreText 字体家族列表，无需扩大协议。
- **`font-list` npm 包**：API 干净，但其内部的 `require("./libs/core")` 目录引用
  无法在 electron-vite 主进程打包后存活，且其 macOS 辅助程序是预构建二进制文件，
  需要 asar 解包。
- **`queryLocalFonts()`（Local Font Access API）**：在沙箱化的渲染器中受权限门控，
  且在 Electron 中仍处于实验阶段。
