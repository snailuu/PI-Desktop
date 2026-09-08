# ADR 0034：将命令面板合并到全局搜索

> **翻译说明：** 本页是与 [英文源决策](/adr/0034-merge-command-palette-into-global-search) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-30
- 相关：[08-component-spec §16](/zh-CN/spec/04-ux/08-component-spec) ·
  [09-plugin-command-palette](/zh-CN/spec/07-plugins/09-plugin-command-palette) ·
  [04-builtin-commands](/zh-CN/spec/04-ux/04-builtin-commands) ·
  [04-e2e-test-plan](/zh-CN/spec/06-delivery/04-e2e-test-plan) · 决策 D014
- 更新：移除 [08-component-spec §16](/zh-CN/spec/04-ux/08-component-spec) 中描述的独立命令面板界面

## 背景

应用此前提供了两个相互重叠的“查找任何内容”界面：

- **命令面板**（Cmd/Ctrl+Shift+P），列出内置命令与插件命令，通过顶栏上的专用按钮和独立浮层打开。
- **全局搜索**（Cmd/Ctrl+K），列出会话、页面和设置。

两者都是可搜索的浮层，具有相同的交互模型（输入、方向键、Enter、Esc）。将它们分开意味着要维护两个界面、顶栏中多出一个按钮，以及用户认知模型的分裂：“命令在这里，其他所有东西在那里。”顶栏的命令面板按钮还与搜索按钮争夺空间。

## 决策

1. 移除独立的命令面板浮层（`CommandPalette.tsx`）及其顶栏按钮。
2. 将命令列表（内置命令 + 插件命令）作为 **Commands** 分区渲染在现有的全局搜索对话框（`SearchDialog.tsx`）中，使用与其他结果分组相同的 `role="listbox"` / `role="option"` 语义和扁平化的选项索引导航。
3. `openCommandPalette` 快捷键（Cmd/Ctrl+Shift+P，参见 D014）现在打开全局搜索对话框，其中包含 Commands 分区。`Cmd/Ctrl+K` 继续打开同一个对话框。两个组合键都能到达命令。
4. 从应用 View 菜单中移除冗余的 “Command Palette” 条目（View 菜单中已有 “Search”）。快捷键 id 予以保留，使键盘快捷键设置页面和插件命令发现功能继续正常工作。
5. 命令的数据路径保持不变：搜索对话框复用 `api.searchCommands` 和 `runPaletteCommand`（内置命令 + 插件桥接）。

## 后果

- 单一可搜索界面覆盖会话、页面、设置和命令。
- 顶栏少了一个按钮；搜索成为统一的发现入口。
- `Cmd/Ctrl+Shift+P` 仍然有效，现在落到统一搜索上且命令列表可用；肌肉记忆得以保留。
- `CommandPalette.tsx`、其 CSS 界面以及 `paletteOpen` 状态均被移除。
- 插件命令发现（E2E-023）与禁用后移除贡献项（E2E-025）被重新表述为针对全局搜索的用例。

## 备选方案

### 保留两个独立界面

已否决：重复了交互逻辑和 UI，增加第二个顶栏按钮，并迫使用户判断哪个界面承载哪些内容。合并同时简化了代码和用户体验。

### 在全局搜索中把命令隐藏在查询之后

已否决：命令面板此前在空查询下即可访问（Cmd/Ctrl+Shift+P 会显示所有命令）。因此 Commands 分区即使在空查询下也会渲染，从而保持该快捷键的行为不变。

## 参考资料

- `apps/desktop/src/components/SearchDialog.tsx`（Commands 分区）
- `apps/desktop/src/components/ConversationTopbar.tsx`（按钮已移除）
- `apps/desktop/src/App.tsx`（`openCommandPalette` → 打开搜索）
- `apps/desktop/electron/main/application-menu.ts`（菜单项已移除）
- `apps/desktop/src/lib/api.ts`（复用 `searchCommands`）
- `apps/desktop/src/lib/commands.ts`（复用 `runPaletteCommand`）
- `docs/spec/06-delivery/04-e2e-test-plan.md`（E2E-023、E2E-025 已更新）
