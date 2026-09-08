# ADR 0151：将工作面板保持在固定应用窗口内

> **翻译说明：** 本页是与 [英文源决策](/adr/0151-internal-work-panel-dock) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-03
- 相关：[01-ui-ia](/zh-CN/spec/04-ux/01-ui-ia) ·
  [08-component-spec §5](/zh-CN/spec/04-ux/08-component-spec) ·
  [09-interaction-patterns §8](/zh-CN/spec/04-ux/09-interaction-patterns) ·
  [01-ipc-protocol](/zh-CN/spec/03-runtime/01-ipc-protocol) · E2E-056 · E2E-167
- 取代：ADR 0122 以及 ADR 0146 中关于工作面板边界的条款
- 恢复 ADR 0033 中的内部停靠方向

## 背景

工作面板已作为流内 flex 同级元素渲染，但 ADR 0122 让渲染器请求相匹配的原生预留。因此，每当面板打开或折叠时，Electron 会扩大并随后缩小整个应用窗口。面板应当像左侧边栏一样：其宽度取自现有客户区，MainChat 在其旁重新布局。

原生 Browser `WebContentsView` 不需要更大的窗口。它根据渲染器测量出的面板矩形进行定位，而该矩形在面板位于现有客户区内时仍然有效。

## 决策

1. 工作面板仍为固定宽度、右侧、流内 flex 列。打开和折叠会在零与已提交的 `244..720px` 宽度之间以动画方式调整其 flex 分配，而不改变原生 BrowserWindow 的边界。
2. 渲染器将 `window/setWorkPanelReservation` 这一衔接点保持为零。主进程会将每个有效请求规范化为 `{ requested: 0, reserved: 0 }`，并且绝不应用面板宽度或 x 偏移几何。
3. 面板内侧左边缘分隔条由渲染器负责。将其向左移动会使面板扩张进 MainChat 的内部空间；向右移动则将空间归还给 MainChat。指针预览按帧合并，释放时提交首选宽度，Escape/取消/丢失捕获则恢复按下时的宽度。
4. 原生窗口边缘和角仍可调整应用窗口大小，但永远不会调整工作面板的大小或为其预留空间。首选面板宽度仍保留在渲染器本地，并独立于原生窗口边界持久化。
5. Browser 视图继续使用渲染器测量出的面板矩形，并在面板退出动画之前被分离，因为原生视图无法跟随渲染器 CSS 动画。

## 后果

- 打开和折叠不再移动窗口边缘或改变用户的应用边界；面板会像左侧边栏一样明显地占用内部空间。
- 在较小窗口上，MainChat 可能会窄于其 360px 的可读性目标。这是有意的固定窗口权衡。
- 原生预留和聊天宽度 IPC 形状仍作为兼容衔接点保留，但当前渲染器并不将它们用于面板呈现或调整大小。
- 原生窗口边界的持久化不再需要移除临时面板几何。

## 被拒绝的替代方案

### 保留 ADR 0122 中的原生预留

被拒绝，因为扩展整个应用窗口正是本次变更要移除的外向行为。

### 在不进行 flex 分配的情况下覆盖面板

被拒绝，因为这会覆盖聊天内容，并破坏测量得到的 Browser 表面、键盘顺序和连续重排。

## 参考

- `docs/adr/0033-internal-dock-work-panel.md`
- `docs/adr/0122-reserve-native-width-while-work-panel-visible.md`
- `docs/adr/0146-separate-work-panel-and-chat-resize-ownership.md`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/workpanel/WorkPanel.tsx`
- `apps/desktop/electron/main/index.ts`
