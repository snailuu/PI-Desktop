# ADR 0168：主进程拥有的 `openExternal` http(s)/mailto 允许列表

> **翻译说明：** 本页是与 [英文源决策](/adr/0168-main-owned-open-external-allowlist) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-06
- 决策者：PI-Desktop 核心
- 相关：D330、ADR 0109、GitHub pull request #45

## 背景

聊天 markdown、插件面板、插件启动器、OAuth 登录以及内嵌预览最终都会调用 Electron 的 `shell.openExternal`。此前，主窗口和启动器的 `setWindowOpenHandler` 会直接转发原始 URL。经提示注入的 `file:`、`javascript:`、`ms-msdt:` 或自定义 URI 方案会在用户点击后抵达操作系统协议处理器。

插件 `pi.shell.openExternal` 此前已记录支持 HTTP(S) 和 `mailto:`（ADR 0109）。预览和插件视图处理器使用的是 `/^https?:/i` 前缀检查，这比解析后的 URL 更弱，且未覆盖应用外壳。

## 决策

1. Electron 主进程拥有唯一的解析器（`parseAllowedExternalUrl`）。只有当 `new URL` 得出带主机名且书写了 `//` 的 `http:`、`https:`，或带地址的 `mailto:` 时，URL 才能抵达 `shell.openExternal`。打开方接收规范化后的 href。控制字符一律拒绝。
2. 不允许的 URL 会抛出异常。无法呈现该错误的调用方（窗口打开处理器）会捕获并忽略。OAuth 将拒绝视为“浏览器未打开”。插件保持 `INVALID_ARGUMENT`。
3. 工作区文件在经过现有路径门禁后仍走 `shell.openPath`。预览中的“在浏览器中打开”对 http(s)/mailto 使用允许列表，对根目录内的 `file:` 页面使用 `openPath`。
4. 主进程构造的 URL（GitHub 反馈、发布页面）仍会经过解析器。

## 后果

- 来自聊天、插件或 `window.open` 的自定义 URI 方案无法启动操作系统处理器。
- `mailto:` 仍是受支持的插件和链接目标。
- `https:alert(1)` 式特殊方案填充会被拒绝。

## 考虑过的替代方案

### 仅允许 http/https，阻止 mailto

已拒绝：这会破坏已记录的插件 API 和 ADR 0109。

### 前缀正则 `/^https?:/i`

已拒绝：它会匹配没有主机名的 `https:payload`，且与插件运行时的 `://` 检查不一致。

### 返回 `false` 而不是抛出异常

已拒绝：OAuth 已将遭拒绝的 `openExternal` promise 映射为 `opened: false`。静默返回 `false` 会报告成功。
