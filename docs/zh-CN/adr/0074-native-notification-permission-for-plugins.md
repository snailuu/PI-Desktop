# ADR 0074：插件的原生通知权限

> **翻译说明：** 本页是与 [英文源决策](/adr/0074-native-notification-permission-for-plugins) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-12

## 背景

插件 `notify` 能力目前仅提供应用内 Toast。PI-Desktop 已使用 Electron 的原生通知 API 处理终端任务结果，但该界面有意由应用持有，并由持久化的任务通知收件箱作为后端支撑。插件需要一种方式向操作系统请求通知访问权限并投递原生通知，同时不获得对 Electron 对象或任务收件箱的访问权限。

Electron 并未为其主进程的 `Notification` 类提供跨平台、只读的通知权限查询，也没有单独的权限请求方法。原生投递通过通知生命周期报告成功或失败，而操作系统策略可能在不报告持久状态的情况下抑制横幅。

## 决策

保留 `pi.ui.notify` 作为向后兼容的应用内 Toast。在 `pi.ui` 下新增三个受权限门控的 API：

- `getNotificationPermission()` 返回 `granted`、`denied`、`unknown` 或 `unsupported`。
- `requestNotificationPermission()` 执行一次简短的的原生通知探测，并返回尽力而为的结果。
- `showNativeNotification({ title, body? })` 发送一条原生通知并返回 `{ shown, permission }`。

这三个 API 都使用现有的低风险 manifest `notify` 权限。Electron 主进程持有原生对象、限制标题/正文长度，并将插件通知与持久化的任务收件箱分离。原生插件通知不会创建收件箱行，点击时也不会产生会话激活事件。

权限结果有意设计为尽力而为。在观察到原生结果之前，或当操作系统未报告结果时，API 返回 `unknown`；不支持的平台返回 `unsupported`。这避免了假装 Electron 能够可靠地反映其无法查询的平台设置。

## 影响

- 插件可以提供操作系统级别的提醒和状态更新，同时仍受现有插件权限审查的约束。
- 现有插件保持其 Toast 行为和源码兼容性。
- 插件必须处理 `unknown`、`denied` 和 `unsupported`，而不能假定原生横幅已投递。
- 任务通知收件箱仍由应用持有，不能用作插件的持久化或导航通道。

## 考虑过的替代方案

- 用原生投递替换 `pi.ui.notify`：已拒绝，因为这会静默改变现有插件行为，并将 Toast 与操作系统通知混为一谈。
- 添加平台特定的权限包：在本次 API 修订中已拒绝；这会在没有通用 Electron 权限契约的情况下增加平台特定的依赖。
- 允许插件构造 Electron `Notification` 对象：被插件隔离边界拒绝。
