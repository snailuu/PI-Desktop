# ADR 0076：在 host-core 中捕获 Windows 保留的插件启动器快捷键组合

> **翻译说明：** 本页是与 [英文源决策](/adr/0076-windows-reserved-global-shortcut-fallback) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-12
- 决策者：PI-Desktop core
- 相关：D211 · ADR 0072 · E2E-120

## 上下文

Windows 将 `Alt+Space` 保留给当前窗口的系统菜单。因此 Electron 的
`globalShortcut` 可能拒绝插件启动器的默认绑定，而渲染器的
`before-input-event` 回退仅在 PI-Desktop 处于焦点时生效。

## 决策

host-core 为默认的 `Alt+Space` 绑定安装一个窄范围的 Windows
`WH_KEYBOARD_LL` 钩子。它消费匹配的 keydown 事件，通过现有的
JSON-RPC 通知传输以 `keyboard.shortcut` 发出通知，并让 Electron
切换插件启动器。每当有效绑定发生变化时，Electron 都会发送这一新增的
`keyboard.setGlobalShortcut` 宿主方法；仅当 Windows 上的有效绑定为
`Alt+Space` 时才启用该钩子。其他平台以及自定义绑定仍沿用 Electron 正常的
全局快捷键路径。

该钩子不会检查或持久化文本，也不会暴露新的渲染器或插件能力。如果钩子安装
失败，聚焦窗口回退仍然可用，并且会记录该失败。

## 后果

- 当另一个应用程序处于前台时，Windows 默认启动器快捷键组合仍然生效，
  且不会打开该应用程序的系统菜单。
- 宿主二进制程序负责一小部分平台特定的输入集成，而 Electron 仍负责窗口
  创建和插件面板访问。
- 协议版本和存储 schema 保持不变，因为该方法和通知是新增的，且 Electron
  是唯一的消费方。
