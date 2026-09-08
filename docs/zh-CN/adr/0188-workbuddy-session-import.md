# ADR 0188：导入 WorkBuddy 会话

> **翻译说明：** 本页是与 [英文源决策](/adr/0188-workbuddy-session-import) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-08
- 决策者：PI-Desktop 核心
- 相关：ADR 0179、D007、
  `03-runtime/04-data-storage.md`、`04-ux/06-settings-ia.md`、
  `04-ux/08-component-spec.md` §18

## 上下文

设置 → 导入会扫描 Claude Code、Codex、OpenCode 和 Pi 的会话存储。
WorkBuddy（codebuddy.cn）将会话保存在
`~/.workbuddy/projects/<slug>/<session-uuid>.jsonl` —— 这一目录布局与
`~/.claude/projects/` 类似，但 JSONL schema 并不能互换：

- 消息为 `type: "message"`，`role` 位于顶层，而不是
  `type: "user" | "assistant"` 加上嵌套的 `message` 对象。
- 内容块是 OpenAI 形态（`input_text`、`output_text`），而不是
  Anthropic 形态（`text`、`tool_use`、`tool_result`）。
- 工具调用是独立的 `function_call` / `function_call_result` 行，
  通过 `callId` 配对，而不是嵌入助手消息中的内容块。
- 指针是 `id` / `parentId`；时间戳是 epoch 毫秒。
- 会话带有 `ai-title` 记录，因此标题不必从第一条用户消息中截断而来。

有两个特性需要显式处理：

1. **注入的上下文。** 每个用户回合都被包裹在 `<system-reminder>`
   块中，该块包含系统提示、工具列表和记忆提醒；在压缩之后会出现
   `<cb_summary>` 或 `<conversation_history_summary>` 块。真正的提示位于
   `<user_query>` 中。沿用 Claude Code 的首条消息启发式规则会把一整墙
   系统提示导入为会话标题和正文。压缩还可能让该块缺失闭合标签。
2. **外置的工具结果。** 超过内联限制的结果会被写入
   `<session>/tool-results/call_*.txt`；该行只保留一个带路径的
   `<persisted-output>` 占位存根。

D007 保持扫描为显式操作，因此新增一个来源只会增加一次可选的扫描。`~/.pi`
的行为没有变化。

## 决策

1. `workbuddy` 成为第五个 `ExternalSource`，其导入器位于
   `electron/main/importers/workbuddy.ts`，与现有的四个导入器一同注册，
   并通过现有的 `SessionImportPanel` 呈现。
2. **标题**来自 `ai-title` 记录，回退到第一条真实的用户提示，再回退到
   会话 id。
3. **注入的上下文**分三遍剥离：移除成对的
   `<system-reminder>` / `<cb_summary>` / `<conversation_history_summary>`
   块；优先使用 `<user_query>` 正文，以便真实提示能在包裹格式错误时
   保留下来；然后丢弃从某个未闭合的开标签到该回合末尾的所有内容。
4. **外置的结果**会依据 `<persisted-output>` 占位存根中的路径读取回来，
   但仅在解析出的路径仍位于 `~/.workbuddy/projects` 之内时进行。
   无法读取的文件保留内联占位存根。
5. `reasoning` 和 `file-history-snapshot` 记录不会转换为消息。
6. `arguments` 是一个 JSON 字符串；能解析时予以解析，否则保持为字符串。

## 后果

- 会话表中的 `source` 列接受 `workbuddy`，并且设置 → 导入在每个语言
  环境下都会新增第五个来源分组和标签。
- 导入的 WorkBuddy 会话会显示 AI 生成的标题，这比其他来源的首条消息
  截断更易读。
- 导入器会为每个外置的工具结果多读取一个文件，并受 projects 根路径
  检查的约束。
- WorkBuddy 的 schema 漂移被限制在一个导入器文件中；其他四个导入器
  不受影响。
