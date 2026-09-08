# ADR 0025：将应用程序菜单移出 Windows/Linux 窗口

> **翻译说明：** 本页是与 [英文源决策](/adr/0025-menu-free-windows-linux-chrome) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-27
- 决策者：PI-Desktop 主机核心
- 相关：D118、D129、ADR 0021

## 上下文

ADR 0021 引入了原生的 macOS 系统菜单，以及位于 Windows/Linux 窗口内、由渲染器掌控的 File/Edit/View/Window/Help 菜单栏。窗口内的菜单栏占用了 46px 标题栏的左侧区域，并将 macOS 菜单模型套用到了无边框的 Windows/Linux 窗口装饰上。当前产品方向要求该菜单界面仅限 macOS 系统菜单使用。

在移除可见菜单栏之后，Windows/Linux 仍需要窗口控件，以及访问常用应用程序、编辑、缩放和全屏命令的途径。

## 决策

1. macOS 保留 ADR 0021 所定义的常规原生 Electron 应用程序菜单和隐藏内嵌式（hidden-inset）交通灯按钮。
2. Windows/Linux 保留无边框的 46px 标题栏以及由渲染器绘制的最小化、最大化/还原和关闭控件，但不在窗口内渲染任何应用程序菜单栏。
3. Windows/Linux 标题栏导航回收此前为 File/Edit/View/Window/Help 预留的空间。
4. Windows/Linux 上常用的应用程序、关闭窗口、缩放和全屏快捷键在没有可见菜单的情况下处理。标准编辑快捷键仍保持原生的 Web 内容行为。
5. 现有的白名单菜单命令与原生操作 IPC 继续保留，供 macOS 系统菜单、渲染器就绪以及快捷键分发使用。不引入新的特权界面。

## 后果

- 窗口标题栏更简洁，导航获得完整的左侧边缘。
- macOS 保留平台标准的系统菜单和所有原生角色。
- Windows/Linux 用户改为依赖可见的应用内控件、Settings -> Info、命令面板和键盘快捷键，而非窗口内菜单栏。
- F10 和 Shift+F10 不再被渲染器外壳界面占用。
- 已移除的渲染器菜单栏组件、样式、焦点模型和本地化弹出层行为不再需要维护或验证。

## 备选方案

### 保留渲染器菜单栏但默认隐藏

已拒绝，因为通过 Alt/F10 唤出的菜单仍会保留一个产品方向不希望出现在窗口内的平台概念。

### 移除所有与菜单相关的 IPC

本次变更已拒绝该方案，因为 macOS 系统菜单仍需要分发白名单的渲染器命令，而 Windows/Linux 快捷键可以复用有边界的原生操作界面，而无需扩大主进程的权限范围。

## 参考

- `docs/adr/0021-platform-application-chrome.md`
- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/04-ux/01-ui-ia.md`
- `docs/spec/04-ux/08-component-spec.md`
- `docs/spec/04-ux/09-interaction-patterns.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md` (E2E-067)
- `docs/spec/08-meta/decisions-log.md` (D129)
