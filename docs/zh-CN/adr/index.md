# 架构决策记录

> **翻译说明：** 本页是与 [英文源文档](/adr/) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

ADR 记录的是不应被静默更改的架构选择。本条目是通往完整记录集的一条精选阅读路径；[ADR 索引](/zh-CN/adr/README)列出了每项决策，[中文镜像](/zh-CN/adr/)按相同的相对路径翻译每条记录。决策 ID、状态以及英文记录仍是两个语种的唯一事实来源。

## 关键决策

| 决策 | 描述 |
|---|---|
| [ADR 0001：Electron 桌面外壳](/zh-CN/adr/0001-use-electron) | 桌面窗口与平台能力的承载层 |
| [ADR 0005：本地插件系统](/zh-CN/adr/0005-user-installable-plugin-system) | 第一阶段用户可安装插件的边界 |
| [ADR 0009：英语优先的全球化](/zh-CN/adr/0009-english-first-globalization) | 源语言、术语与协作规则 |
| [ADR 0010：Rust 主机核心](/zh-CN/adr/0010-rust-backend-host-core) | 特权进程、RPC 与持久化的主机边界 |
| [ADR 0053：计划检查点](/zh-CN/adr/0053-plan-checkpoint-artifact-and-execution-epoch) | 计划审批、工件与执行纪元 |
| [ADR 0079：VitePress 文档站点](/zh-CN/adr/0079-vitepress-documentation-site) | 双语文档站点的结构与部署 |
| [ADR 0083：自定义全局 UI 字体](/zh-CN/adr/0083-custom-global-ui-font) | 设置中的字体选择器、内置开源字体与系统字体枚举 |
| [ADR 0089：主动的后台子代理委派](/zh-CN/adr/0089-proactive-background-subagent-delegation) | 非阻塞 Task、TaskWait/TaskList/TaskStop 生命周期与权限范围 |
| [ADR 0090：用户可配置的关闭行为](/zh-CN/adr/0090-user-configurable-close-behavior-close-to-tray) | 首次关闭时仅询问一次，可关闭到托盘或退出，可在设置中更改 |
| [ADR 0095：使用供应商账号登录](/zh-CN/adr/0095-vendor-account-oauth-login) | 使用订阅账号代替 API key；凭据保留在主进程中，sidecar 为每个请求获取短时有效的 token |
| [ADR 0106：核心五个内置命令](/zh-CN/adr/0106-core-five-builtin-commands) | 将命令面板与输入框 `/` 菜单固定为五个第一方命令 |
| [ADR 0108：移除内置交互式终端](/zh-CN/adr/0108-remove-built-in-interactive-terminal) | 工作面板不再承载 PTY；交互式 shell 由外部终端处理，Agent Bash 保持非交互式 |
| [ADR 0128：针对供应商瞬时失败的有界重试](/zh-CN/adr/0128-bounded-transient-provider-retry) | 为供应商瞬时失败共享一个有界重试预算：请求建立与流式阶段共享四次重试 |
| [ADR 0131：大段输入框粘贴写入会话临时目录](/zh-CN/adr/0131-large-text-paste-session-reference) | 超过可配置阈值的纯文本粘贴会保存为会话临时文件，并在原位置插入行内 `@` 引用 |
| [ADR 0137：保留的会话面板](/zh-CN/adr/0137-retained-session-panes) | 每个最近访问过的会话保留一个已挂载的面板（最多三个）；切换是可见性替换，而非重建转录 |
| [ADR 0141：展开的侧边栏宽度可调整](/zh-CN/adr/0141-sidebar-width-resize) | 展开的侧边栏可通过右边缘手柄在 240–520px 之间调整，偏好值会被持久化 |
| [ADR 0142：允许非回环 HTTP MCP 端点](/zh-CN/adr/0142-allow-non-loopback-http-mcp) | 支持局域网 MCP，同时明确警告明文连接风险；插件仍受网络允许列表约束 |
| [ADR 0145：发布原生 macOS Intel 工件](/zh-CN/adr/0145-native-macos-intel-release-lane) | 通过与架构匹配的原生 macOS runner 发布 arm64 与 Intel x64 DMG/ZIP，并合并更新源 |
| [ADR 0148：显式禁用键盘快捷键](/zh-CN/adr/0148-explicitly-disable-keyboard-shortcuts) | 未提供覆盖值时使用默认值；`null` 表示未绑定，并在渲染器、菜单与启动器中禁用分发 |
| [ADR 0174：主机托管的插件补全与会话上下文](/zh-CN/adr/0174-plugin-host-owned-completion-and-session-context) | 插件可以列出已登录的模型、读取进行中的工具会话，并通过公共 API 让主机执行一次性补全 |
| [ADR 0175：解释安静的进行中回合](/zh-CN/adr/0175-live-agent-activity-status) | 使用等待模型 / 重试中 / 等待子代理的状态行来解释暂停 |
| [ADR 0176：按供应商设置 User-Agent](/zh-CN/adr/0176-per-provider-user-agent) | 每个 AI 服务/OAuth 行可以设置可选的 User-Agent（已被 0178 的 headers 映射取代） |
| [ADR 0177：用户可配置的出站代理](/zh-CN/adr/0177-user-configurable-outbound-proxy) | 设置中可为模型请求、插件市场、更新与内置浏览器提供系统/直连/自定义代理覆盖 |
| [ADR 0178：按供应商设置自定义 HTTP 头](/zh-CN/adr/0178-per-provider-custom-headers) | 每个 AI 服务/OAuth 行可在高级选项中编辑任意非敏感请求头 |
| [ADR 0179：从本地代理存储导入模型配置](/zh-CN/adr/0179-import-model-configuration) | 设置 → 导入会显式扫描 Claude Code / Codex / OpenCode / Pi 的供应商配置并复制 API key |
| [ADR 0180：自定义全局文本缩放](/zh-CN/adr/0180-custom-reading-font-size) | 设置 → 外观 按比例缩放所有 UI 文本，不使用 px；窗口缩放保持独立 |
| [ADR 0181：主进程持有的文件选择器能力](/zh-CN/adr/0181-main-owned-picker-capabilities) | 文件选择器路径保留在主进程中，导入边界由一次性 token 保护，并移除不支持的文件夹选择 |
| [ADR 0182：繁体中文应用外壳](/zh-CN/adr/0182-traditional-chinese-shell-locale) | 提供独立的繁体中文外壳、系统语言解析与发布日志目录 |
| [ADR 0183：P0 国际化应用外壳区域设置](/zh-CN/adr/0183-p0-international-shell-locales) | 提供完整的德语、西班牙语与法语外壳语言目录及发布日志 |
| [ADR 0184：输入框工具栏中的上下文用量检查器](/zh-CN/adr/0184-composer-context-usage-inspector) | 将剩余容量检查器移到模型选择器左侧，仅在回答下方保留模型徽标 |
 | [ADR 0185：韩语应用外壳](/zh-CN/adr/0185-korean-shell-locale) | 提供完整的韩语外壳、系统语言解析与韩语发布日志目录 |
 | [ADR 0186：显示进行中重试的供应商原因](/zh-CN/adr/0186-retry-cause-in-active-turn-status) | 悬停或聚焦重试状态行可显示错误摘要、错误码与安全的供应商消息 |
 | [ADR 0187：分离任务与交互式原生通知的投递](/zh-CN/adr/0187-separate-task-and-interactive-native-notification-delivery) | 终端任务保持仅在未聚焦时投递，而交互式提示可以向其他已聚焦的会话发送通知 |
| [ADR 0188：模型配置导入保留不同凭据](/zh-CN/adr/0188-preserve-distinct-import-credentials) | 同一端点的不同 API 密钥作为独立提供商导入，相同凭据仍幂等跳过 |
| [ADR 0188：导入 WorkBuddy 会话](/zh-CN/adr/0188-workbuddy-session-import) | 保留提示词、工具结果与 AI 标题 |
| [ADR 0189：完成中文文档镜像](/zh-CN/adr/0189-complete-chinese-documentation-mirror) | 每个文档页面按相同相对路径镜像为中文 |

## 何时阅读 ADR

- 规格告诉你系统应该如何工作。
- ADR 告诉你为什么选择这一边界，以及放弃了哪些替代方案。
- 决策日志记录更细粒度的冻结条款与后续修订。

前往 [ADR 索引](/zh-CN/adr/README)查看完整记录，或打开[决策日志](/zh-CN/spec/08-meta/decisions-log)按编号查找条目。
