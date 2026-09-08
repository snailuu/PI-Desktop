# ADR 0086：让 macOS 保持常规激活策略

> **翻译说明：** 本页是与 [英文源决策](/adr/0086-macos-regular-activation-policy) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-14
- 决策者：PI-Desktop 核心
- 相关：D223, E2E-127, ADR 0072, ADR 0078, ADR 0080

## 背景

全局插件启动器（ADR 0072）是一个无边框、始终置顶的面板，应当出现在用户正在进行的任何操作之上，因此它的窗口向 Electron 请求了 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`。在 macOS 上，该选项并非按窗口生效的标志：Electron 的实现方式是对整个进程调用 `TransformProcessType(kProcessTransformToUIElementApplication)`，因为 macOS 10.14 及更高版本只允许辅助（accessory）应用把窗口浮动在另一个应用的全屏 Space 之上。于是该进程变成了 UIElement 应用，PI-Desktop 从 Dock 和 Cmd+Tab 中消失。

随后 ADR 0080 把启动器的创建移入启动预热流程，因此该类型转换在每次启动时都会执行，即使启动器从未被打开过。窗口本身仍然显示在屏幕上，这让症状看起来像窗口管理器的问题，而不是激活策略的变更。

最小化会把主窗口隐藏到托盘（ADR 0078），而 macOS 只会从 `applicationShouldHandleReopen:` 发出 Electron 的 `activate` 事件——即点击 Dock 图标或重新启动应用。Cmd+Tab 和 App Exposé 不会触发它，因此即使应用重新出现在列表中，被隐藏到托盘的窗口也没有键盘途径可以恢复。

## 决策

1. PI-Desktop 在其整个生命周期内都是一个常规（前台）macOS 应用。任何代码路径都不得转换进程类型：启动器传入 `skipTransformProcessType: true`，且 `app.dock.hide()` 与 `app.setActivationPolicy` 不得出现在主进程中。在 Dock 和 Cmd+Tab 中的存在是不变量，而不是某个窗口选项的副作用。
2. 启动器保留其 collection behavior：它会加入每个常规 Space，并浮动在 PI-Desktop 自己的全屏窗口之上。它不会覆盖另一个应用的全屏 Space；macOS 将其保留给辅助应用，在那里激活会改为切换 Space。
3. macOS 激活通过 `did-become-active` 以及 `activate` 来恢复外壳（shell），条件是应用已完成启动、未在退出且没有可见窗口。Cmd+Tab 和 App Exposé 能把隐藏到托盘的窗口带回来，而显示启动器或插件面板不会顺带把主窗口提到前台。
4. 测试对启动器的调用形态和激活处理器进行断言，因此未来的窗口选项无法再悄无声息地让应用变成辅助应用。

## 后果

- 应用始终可以从 Dock、Cmd+Tab、App Exposé 和托盘访问到。
- 启动器无法覆盖另一个应用的全屏 Space。从其中调用它会激活 PI-Desktop 并切换 Space，这是常规前台应用的行为。
- 面板焦点行为不变：`show()` 会激活应用，并在两种策略下都使面板成为 key window，因此 ADR 0080 的延迟优化不受影响。

## 备选方案

- 在每次显示启动器时切换策略（显示前调用 `app.dock.hide()`，显示后调用 `app.dock.show()`）。这能恢复全屏覆盖，但每次调用都会让 Dock 图标闪烁，给 ADR 0080 优化过的路径增加工作量，保留了一个 Cmd+Tab 看不到应用的窗口状态，而且一旦忘记恢复就会让应用永久处于辅助模式。
- 完全去掉 `visibleOnFullScreen`。Dock 问题同样修复，但启动器也会不再覆盖 PI-Desktop 自己的全屏窗口，没有任何收益。
- 将 PI-Desktop 作为 `LSUIElement` 托盘应用发布。这与 ADR 0078 的常驻主窗口以及产品的主窗口形态相矛盾。要覆盖其他应用的全屏 Space，需要一个单独的辅助助手进程，而不是在拥有主窗口的应用中做进程范围的类型转换。
