# ADR 0105：将 Files 作为捆绑插件发布；Review 保留在主机

> **翻译说明：** 本页是与 [英文源决策](/adr/0105-files-as-a-bundled-plugin) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受（2026-08-19 修订；终端条款已被 ADR 0108 取代）
- 日期：2026-08-19
- 决策者：PI-Desktop 核心
- 相关：[ADR 0019](/zh-CN/adr/0019-work-panel-subsystems) ·
  [ADR 0104](/zh-CN/adr/0104-plugin-contributed-work-panel-views) ·
  [ADR 0108](/zh-CN/adr/0108-remove-built-in-interactive-terminal) ·
  [07-plugins/13-plugin-permissions-matrix](/zh-CN/spec/07-plugins/13-plugin-permissions-matrix)

## 背景

工作面板有一个用于插件贡献视图的公开扩展点。捆绑的 Files 浏览器应当走这条公开路径，而不是继续作为一个仅主机可用的特殊视图。根据 ADR 0043，Review 仍然归消息所有，因此其归属边界不同。

## 决策

1. `pi.files` 是从
   `apps/desktop/resources/plugins/` 发布的第一方插件，并且像第三方插件一样通过
   `contributes.views` 贡献其视图。
2. 捆绑插件默认启用，无法卸载，但用户可以将其禁用。其文件系统访问使用受权限门控的公开读取 API。
3. 只有 Files *工具* 迁移。归 Transcript 所有的 `file:<path>` 资源和 Review 工件仍由主机渲染，并保持消息/会话作用域。
4. 浏览器外壳和代理 CDP 作为捆绑插件 `pi.browser` 发布（ADR 0170）。来宾 `WebContentsView` 和调试器仍属于主机窗口机制，只能通过公开的 `pi.browser.*` API 访问。
5. 此前关于在主机中保留交互式终端的提案已被 ADR 0108 取代。不存在插件 PTY API，也不存在私有的捆绑插件通道。

## 后果

- 所发布的插件是公开的贡献视图 API 和文件系统 API 的真实消费者；这些 API 中的缺口会被第一方功能捕获。
- 启动器列出 Browser 和活动插件视图。Review 和文件资源由对话工件打开。
- 插件信任边界保持不变：任何插件权限都无法生成交互式 shell。

## 考虑过的替代方案

### 将 Files、Review 和交互式终端保留为主机工具

对于 Files 予以拒绝：这会使公开的插件扩展点得不到测试。Review 仍归主机所有，因为其证据属于转录消息。交互式终端被移除而非迁移；ADR 0108 记录了原因。

### 为捆绑插件提供私有的主机能力

拒绝：私有通道不会测试公开的插件 API，并且会重新制造本 ADR 旨在减少的主机/插件信任分裂。
