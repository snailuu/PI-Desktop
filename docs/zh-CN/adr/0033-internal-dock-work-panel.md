# ADR 0033：内部停靠式工作面板（不扩展原生窗口）

> **翻译说明：** 本页是与 [英文源决策](/adr/0033-internal-dock-work-panel) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已被 ADR 0122 取代；内部停靠方向由 ADR 0151 恢复
- 日期：2026-07-30
- 相关：[01-ui-ia](/zh-CN/spec/04-ux/01-ui-ia) ·
  [08-component-spec §5](/zh-CN/spec/04-ux/08-component-spec) ·
  [09-interaction-patterns §8](/zh-CN/spec/04-ux/09-interaction-patterns) ·
  [01-ipc-protocol](/zh-CN/spec/03-runtime/01-ipc-protocol) · 决策 D163
- 部分取代：ADR 0032

## 上下文

ADR 0032 将工作面板改成了停靠式 flex 列，但为了保持聊天宽度稳定，预留了*原生窗口宽度*，其值等于面板的已提交宽度。主进程会按该宽度扩展操作系统窗口（在显示器工作区内），并将原生浏览器 `WebContentsView` 定位在扩展出的区域内。对用户可见的结果是：打开面板会**使整个应用窗口变大**——看起来像是面板“单独向外展开”，而不是占用现有窗口内的空间。

ChatGPT 和 WorkBuddy 保持窗口固定，让侧边面板从客户区内部获取空间，把对话向左推。这正是所需的行为。

排查表明，窗口扩展只是一种*腾出空间*的机制：

- 此前的交互式终端标签页并未使用原生视图；ADR 0108 已彻底移除该界面。
- 原生 `WebContentsView`（宿主浏览器 guest 与插件视图）是依据**渲染器测量**得到的面板矩形，通过 `setBounds` 定位的（参见 `BrowserPane.setBounds` 和 `PluginViewTab`）。该视图合成在渲染器内容之上，因此必须被告知所在位置——但该矩形无论窗口是否扩展，都是按面板实际显示位置测量出来的。

因此，原生宽度预留对正确性而言并非必要：如果面板成为*固定*窗口中的一个参与布局流的列，测量所得的矩形本就落在窗口内部，浏览器视图会跟随它，无需任何窗口扩展。

## 决策

1. 工作面板是**固定**客户区内部的固定宽度、参与布局流的 flex 列。打开它会使 `MainChat` 向左重排；它绝不会扩展操作系统窗口。
2. 渲染器始终请求原生预留宽度为 `0`（`api.setWorkPanelReservation(0)`）。主进程不再为面板更改窗口边界。`window/setWorkPanelReservation` IPC 作为稳定的接缝予以保留；主进程返回空预留（`{ requested: 0, reserved: 0 }`）。
3. 原生浏览器 `WebContentsView` 继续依据渲染器测量得到的面板矩形，通过 `browserSetBounds` 定位。它要正确就位，无需任何窗口扩展。
4. 默认已提交宽度为 **420px**（既定基线），处于未变更的 `364..720px` 约束范围内。*（已被决策 D167 取代：默认值为 280px，处于 `244..720px` 约束范围内；此处的其余条款均继续有效。）*
5. 原生窗口边缘拖拽调整仅改变 `MainChat`，现在通过普通的重排实现（面板是内部面板，保持其已提交宽度）。

## 后果

- 操作系统窗口尺寸在打开 / 折叠 / 分隔条提交之间保持稳定；只有 `MainChat` 重排。这与 ChatGPT / WorkBuddy 一致。
- 在小窗口上，当面板以较宽宽度打开时，`MainChat` 可能被压缩到低于其 360px 可读性目标——这是 ChatGPT 也接受的同一取舍，在此可以接受。
- 几何逻辑更简单：预留机制予以保留但处于惰性状态，因此渲染器→主进程的 IPC 界面及其测试仍然有效。
- 持久化的常规窗口边界本就不含预留宽度；当预留始终为 `0` 时，它们就是用户自己的窗口尺寸，这正是重新启动时所需的行为。
- 退出动画及退出前分离原生视图的逻辑保持不变。

## 备选方案

### 保留 ADR 0032（预留原生宽度，扩展窗口）

已否决：为给面板腾出空间而扩展整个窗口，正是用户希望移除的那种“单独向外展开”行为。它还会让面板显得与窗口内布局相互脱节。

### 用单独的覆盖窗口裁剪原生视图

已否决：这会增加第二个窗口、焦点/遮挡方面的复杂度以及另一种故障模式，相比测量参与布局流的矩形没有任何收益。

## 参考

- `docs/adr/0032-reserve-native-width-for-the-docked-work-panel.md`（部分被取代）
- `apps/desktop/src/App.tsx`（预留目标设为 `0`）
- `apps/desktop/src/lib/work-panel-resize.ts`（`WORK_PANEL_DEFAULT_WIDTH`）
- `apps/desktop/src/components/workpanel/PluginViewTab.tsx`（依据测量矩形调用 `pluginViewSetBounds`）
- `apps/desktop/electron/main/browser-view.ts`（`BrowserPane.setBounds`）
- `docs/spec/06-delivery/04-e2e-test-plan.md`（E2E-056）
- `docs/spec/08-meta/decisions-log.md`（D163）
