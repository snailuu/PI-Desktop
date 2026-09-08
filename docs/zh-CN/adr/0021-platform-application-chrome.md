# ADR 0021：平台应用外壳

> **翻译说明：** 本页是与 [英文源决策](/adr/0021-platform-application-chrome) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：部分被 ADR 0025 取代
- 日期：2026-07-26

## 上下文

Electron 的默认外壳无法满足 PI-Desktop 所遵循的全部三项桌面惯例。macOS 需要符合惯例的原生应用菜单和内嵌的红绿灯按钮。无边框的 Windows 和 Linux 窗口需要可见的应用菜单，以及最小化、最大化/还原和关闭控件。

渲染器拥有的命令（例如 New Task 和 Settings）无法直接在 Electron Main 中执行。原生编辑、缩放、全屏和窗口操作不能变成任意特权命令桥接。

## 决策

1. macOS 保留 `hiddenInset` 红绿灯按钮，并安装原生 Electron 应用菜单。
2. Windows 和 Linux 使用共享的 46px 无边框外壳，配有渲染器菜单栏和渲染器绘制的窗口控件。
3. 渲染器拥有的菜单命令使用固定的 `APP_MENU_COMMANDS` 允许列表。原生菜单和窗口操作使用各自独立的固定允许列表。
4. preload 仅暴露外壳所需的操作系统标识符和允许列表中的 IPC 通道。
5. 原生命令在投递前等待渲染器就绪确认。窗口创建为单飞，并且关闭或重载窗口会重置该确认。
6. Windows 和 Linux 打包仍属于外壳就绪工作。本决策不改变 D010 中 macOS-arm64 优先发布的范围。

## 后果

- 每个平台都能获得熟悉的菜单和窗口控件，同时不会暴露任意的主进程执行能力。
- 原生菜单命令可以重新创建 macOS 窗口，而不会与渲染器订阅设置发生竞态，也不会创建重复窗口。
- Windows 和 Linux 在发布前需要原生 runner 打包和视觉验收。
- 自定义外壳必须在渲染器重载前后保持键盘、焦点、本地化、拖拽区域和最大化状态行为。

## 备选方案

### 在所有平台上保留 Electron 的默认菜单和边框

被否决，因为现有的隐藏标题栏设计在 Windows 和 Linux 上仍不完整，而 macOS 又会缺少产品特有的命令。

### 在渲染器中实现所有菜单操作

被否决，因为原生编辑和窗口操作属于 Electron Main，必须留在明确的能力边界之内。

### 在固定延迟后发送命令

被否决，因为渲染器订阅时序因机器和重载状态而异。确认机制是确定性的。

## 参考

- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/04-ux/09-interaction-patterns.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`（E2E-067）
- `docs/spec/08-meta/decisions-log.md`（D118）
