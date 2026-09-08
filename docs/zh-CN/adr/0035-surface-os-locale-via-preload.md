# ADR 0035：通过 preload 桥暴露操作系统 locale

> **翻译说明：** 本页是与 [英文源决策](/adr/0035-surface-os-locale-via-preload) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-30
- 相关：[04-ux/06-settings-ia](/zh-CN/spec/04-ux/06-settings-ia) ·
  [04-ux/02-i18n-english-first](/zh-CN/spec/04-ux/02-i18n-english-first) ·
  [04-e2e-test-plan](/zh-CN/spec/06-delivery/04-e2e-test-plan) · E2E-091
- 更新：[api.ts](../../../apps/desktop/src/lib/api.ts) 中的 `window.piDesktop`
  preload 契约

## 上下文

设置 → 基础 → 语言控件提供了 **Auto** 选项，该选项应跟随用户的操作系统显示语言。最初的实现是从渲染器的 `navigator.language` 解析“auto”。

在 Electron 中，渲染器的 `navigator.language` 是内嵌浏览器的 locale，无论实际的操作系统语言是什么，都默认为 `en-US`。在中文系统上，渲染器仍然报告 `en-US`，因此即使操作系统是简体中文，“Auto”也会解析为英语。同样的默认值还被用作首次渲染时 i18n 初始语言的种子值。

可靠的来源是主进程：`app.getLocale()` 读取操作系统显示语言（macOS 的 `AppleLanguages`、Windows 的用户 UI 语言、Linux 的 `LANG`）。主进程本就掌握操作系统层面的事实；渲染器只需要一种在首次渲染前同步读取这些事实的方式。

## 决策

1. 从 preload 桥以同步字段 `window.piDesktop.locale` 暴露权威的操作系统 locale。主进程在创建窗口时解析 `app.getLocale()`，并通过 `webPreferences.additionalArguments` 传入；沙箱化的 preload 代码读取该参数，而不导入 Electron 仅限主进程使用的 `app` 模块（与现有的 `platform` 字段并列）。
2. 在 `api.ts` 的 `window.piDesktop` 类型中增加可选的 `locale?: string`；非 Electron 环境不会收到窗口创建参数。
3. 通过 `lib/app-language.ts` 中新增的 `resolveOsLocale()` 辅助函数解析“auto”语言，该函数优先使用 `window.piDesktop.locale`，对非 Electron 环境（例如测试）回退到 `navigator.language` / `userLanguage`。
4. 在 `main.tsx` 中改为从 `resolveOsLocale()` 初始化 i18n 的 `lng`，不再使用 `navigator.language`。

这样就把操作系统事实的解析保留在主进程中，且无需新增 IPC 通道（与 `platform` 一样，该值在首次渲染前即可用）。

## 后果

- “Auto”语言现在与真实的操作系统显示语言一致（例如中文系统上为简体中文），并且 Auto 卡片会内联显示检测到的语言（“当前：简体中文”）。
- 首次渲染时的初始 i18n 语言与操作系统 locale 一致。
- `window.piDesktop` preload 契约新增一个只读字符串字段。
- 非 Electron 环境（单元测试、可能的 Web 构建）回退到 `navigator.language`，仍可正常工作。

## 备选方案

### 继续使用 `navigator.language`

已否决：它正是误检测的根源，并且在 Electron 中渲染器无法看到操作系统语言。

### 为操作系统 locale 增加异步 IPC 调用

已否决：异步往返会延迟以正确语言进行首次渲染，并使已经在使用 `platform` 的同步预渲染设置复杂化。从桥中同步暴露该值更简单，也足够。

## 参考资料

- `apps/desktop/electron/main/index.ts`（通过 `additionalArguments` 传入 `app.getLocale()`）
- `apps/desktop/electron/preload/index.ts`（读取 locale 参数，而不导入 `app`）
- `apps/desktop/src/lib/api.ts`（`window.piDesktop.locale` 类型）
- `apps/desktop/src/lib/app-language.ts`（`resolveOsLocale`、`resolveAppLanguage`）
- `apps/desktop/src/main.tsx`（初始 `lng` 来自 `resolveOsLocale`）
- `apps/desktop/src/pages/SettingsPage.tsx`（Auto 卡片显示检测到的语言）
- `docs/spec/06-delivery/04-e2e-test-plan.md`（新增 E2E-091）
