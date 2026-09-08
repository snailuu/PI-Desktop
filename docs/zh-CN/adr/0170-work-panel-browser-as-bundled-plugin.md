# ADR 0170：将工作面板浏览器作为捆绑插件通过公共 CDP 发布

> **翻译说明：** 本页是与 [英文源决策](/adr/0170-work-panel-browser-as-bundled-plugin) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-06
- 决策者：PI-Desktop 核心
- 相关：[ADR 0019](/zh-CN/adr/0019-work-panel-subsystems) ·
  [ADR 0104](/zh-CN/adr/0104-plugin-contributed-work-panel-views) ·
  [ADR 0105](/zh-CN/adr/0105-files-as-a-bundled-plugin) ·
  [07-plugins](/zh-CN/spec/07-plugins/README)

## 背景

工作面板浏览器原本是由主机核心构建的启动器行（`HEADER_TOOLS`），外加一个主进程持有的 `WebContentsView` 客户视图。文件已经证明，第一方界面可以作为捆绑插件通过公共的 `contributes.views` 通道发布。用户同样需要让整个浏览器——chrome、预览和代理 CDP——以相同方式可选：在插件页面上启用/禁用，但永远不可卸载。

插件页面本身不能*成为*浏览器。插件视图是沙箱化的，具有 `webviewTag: false`，并且受 `net.domains` 限制。任意 http(s) 和工作区文件，以及 Chrome DevTools Protocol，都必须保留在主机持有的客户视图中。

## 决策

1. **`pi.browser` 是一个捆绑插件**，位于 `apps/desktop/resources/plugins/`，默认启用、可禁用、不可卸载。它贡献视图 `browser`（图标 token `browser`，顺序 10）并注册代理工具 `Browser`。
2. **客户视图 `WebContentsView`（`persist:work-browser`）和调试器仍由主机持有。** 插件 chrome 是普通的插件视图。客户视图叠加在 chrome 通过 `pi.browser.setBounds` 报告的内容相对空洞上。
3. **`browser.cdp` 是公共权限**（高）。`pi.browser.*` 是公共主机 API。任何声明了该权限的插件都可以调用它。边界会被钳制到调用插件视图上，因此客户视图无法覆盖聊天/输入框。
4. **原始 CDP 采用允许列表和默认拒绝。** Cookie、存储、目标和网络拦截方法会被拒绝。不暴露任何 DevTools websocket。
5. **主机 `BrowserPreview` 仍然是一个薄外观**（Plan/子代理名称稳定性）。如果 `pi.browser` 被禁用，它会报错；否则，当该会话的 chrome 可见时，它会将工作区文件加载到客户视图中，并显示插件视图。插件 CDP 保持仅限代理使用（`plugin_*`）。
6. **v1 是单例客户视图。** 会话位置会被记住，并在发起对话的插件标签页显示时重新绑定（D142）。后台会话不会窃取可见的客户视图。

本决策取代 ADR 0105 第 4 条（浏览器保持为主机核心构建的启动器）以及 ADR 0019 中的主机启动器条款。客户视图所有权和导航策略保持不变。ADR 0108 的“浏览器作为主机核心构建的工具”条款同样被取代：面板的可启动界面现在是插件视图。

## 后果

- 禁用 `pi.browser` 会移除启动器行、代理 CDP 和客户视图。URL 芯片回退到 `openExternal`。`BrowserPreview` 失败时保持关闭。
- 拥有 `browser.cdp` 的第三方插件共享同一个客户视图；最后调用 chrome `setBounds` 者胜出。
- Plan 仍然看到的是 `BrowserPreview`，而不是 `plugin_pi_browser_Browser`。

## 考虑过的替代方案

### 在插件视图内加载网页

已拒绝：这将需要 `webviewTag`、通配符 `net.domains`，并将 CDP 附加到错误的 WebContents 上。

### 仅 `pi.browser` 可调用的私有主机 API

已拒绝：文件栏正是第一方功能证明公共通道可行的例子。

### 保留 React `BrowserTab` chrome，仅将启动器插件化

已拒绝：那并不等于“整个默认浏览器都是插件”。
