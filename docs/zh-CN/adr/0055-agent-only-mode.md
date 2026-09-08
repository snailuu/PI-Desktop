# ADR 0055：仅代理模式；Chat 变为内部只读配置

> **翻译说明：** 本页是与 [英文源决策](/adr/0055-agent-only-mode) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：被 ADR 0052 / ADR 0053 取代
- 日期：2026-08-05

> 已取代。本 ADR 移除的模式概念以 Plan 运行状态的形式回归
> （ADR 0052，随后又被 ADR 0053 取代），因此产品再次暴露
> `Agent | Plan` 选择器，而 `chat` 迁移到 `plan` 而非
> `agent`。之所以保留本文，是因为关于否定式权限门禁的推理，以及
> 在遇到未知 `mode` 值时失败关闭的推理，仍然成立；也是因为它
> 记录了该开关为何在被以不同契约重新引入之前被移除。

## 背景

自 D003/D004 起，一个会话携带两种工具配置之一。`agent` 获得完整的编码
能力面（`Read`/`Bash`/`Edit`/`Write`/`Glob`/`Grep`/`BrowserPreview`
加上插件工具）；`chat` 获得一个只读子集（`Read`/`Glob`/`Grep`），
主机核心在每一种权限模式之外都对其硬拒绝（D115）。

本产品是一个代理桌面。`chat` 从来不是目的地：它作为安全阀而存在，但
UI 把它宣传为一个对等选项——通过顶栏分段开关、设置中的默认模式
行、`/chat-mode` 与 `/agent-mode` 命令面板命令，以及四个本地化标签。
这带来了三项代价：

1. 切换到 Chat 之后又把开关从肌肉记忆中删除的用户，可能让某个会话
   永久无法写入文件。开关消失后，该会话将无处可回，被困住。
2. 每一项工具、提示词组合与权限变更都必须推理两次，而惰性工具
   激活的核心集（D185）按模式分叉。
3. 模式芯片与用户确实会更改的控件——模型、思考级别、权限模式——
   争夺空间。

直接删除该配置也不可接受：导入的会话以及旧版本写入的行携带当前 UI
不会产生的 `mode` 字符串，而对于任何非显式 `agent` 的情况，狭窄的
工具面都是一条值得保留的安全边界。

## 决策

1. **`agent` 是产品暴露的唯一模式。** 顶栏分段开关、设置中的默认
   模式行、两个命令面板命令及其斜杠别名、`.ct-mode*` 样式，以及
   `settings.mode*` i18n 键均被移除。`newSession` 始终请求 `agent`，
   而启动时会规范化存储中不是 `agent` 的 `defaultMode`。
2. **`chat` 更名为 `read-only`。** 共享类型变为
   `Mode = "read-only" | "agent"`。主机核心的 `SESSION_MODES` 是
   `["agent", "read-only"]`，而 `normalize_session_mode` 在每一条写入
   路径（`session.create`、`session.configure`、`session.import`）上把
   D188 之前的 `chat` 拼写折叠为 `read-only`，并拒绝其他任何值。
   调用方存储规范化后的值，绝不存储原始输入。
3. **权限门禁是否定式的。** 当 `mode != "agent"` 且该工具不在
   `read_only_mode_allows` 之内（`Read`/`Glob`/`Grep` 加上
   `plugin_*`）时，`PermissionManager` 予以拒绝。因此，未知或遗留的
   `mode` 字符串会失败关闭到只读工具面，而不是悄然获得
   Write/Edit/Bash。硬拒绝继续优先于每一种 D115 权限模式，包括
   `auto`。
4. **错误码已被重命名**为 `BASH_DISABLED_IN_READ_ONLY` 和
   `WRITE_DISABLED_IN_READ_ONLY`。两者都没有本地化消息，因此重命名
   仅限于 `packages/shared/src/errors.ts`、主机的代码选择处以及
   规格。
5. **现有的 `chat` 行在打开时迁移到 `agent`。** `boot_maintenance`
   运行 `UPDATE sessions SET mode = 'agent' WHERE mode = 'chat'`，并
   通过 `json_set` 把存储的 `app.defaultMode` 中的 `chat` 折叠为
   `agent`。两条语句都是幂等的；首次打开之后没有任何行会匹配。

## 后果

- 没有任何会话会被困在只读状态：唯一能持有 `read-only` 的行，是
  未来的导入或外部写入者产生的行，而按设计它们保留主机强制执行的
  狭窄工具面。
- `SCHEMA_VERSION` 保持为 7。`Database::open` 会归档并重置任何低于
  当前版本的数据库（D119），因此提升版本号会摧毁本次变更本要挽救的
  那些会话。该修复是现有 schema 内部的一次数据修复。
- 模式字符串仍留在 RPC 契约中（`tools.execute`、`session.configure`、
  `SessionSummary`）以及 `sessions.mode` 列中。移除它会是一次毫无
  收益的协议破坏，而主机仍然需要它来选取工具配置。
- 对话顶栏只保留模型选择器加任务操作；输入框的芯片行现在以
  Thinking 开头。在切换模型时，`ModelSelect` 仍然是会话思考级别的
  写入方。
- 工具激活（D185）仍有两套核心集。只读的那一套只是无法从 UI 到达
  而已。

## 备选方案

### 彻底移除 `read-only` 配置

拒绝。这会让导入的行和遗留行持有一个主机无法识别的 `mode`，而对
无法识别值的自然回退将是完整的代理工具面——恰好在最糟糕的时刻悄然
扩大权限。

### 保留 `chat` 这个拼写

拒绝。该名称描述的是一个已不存在的产品模式，并且在代码、日志和错误
码中读起来像是 Agent 的对等物。`read-only` 说明了该配置的真实身份，
而剩余的主机侧强制执行正是为此而存在。

### 保留开关但把它藏在开发者模式之后

拒绝。它既保留了双工具集的推理成本，又保留了被困的失败模式，而一条
通往与安全相关配置的仅调试路径比没有路径更糟。

### 提升 schema 版本以承载迁移

拒绝。v7 是一次破坏性重置，而不是迁移链（D119）：打开当前版本之前的
数据库会将其归档并引导一个全新的文件。提升版本会为了修复其中的一个
列值而丢弃用户的会话。

## 参考

- `packages/shared/src/types.ts`, `packages/shared/src/errors.ts`
- `packages/agent-runtime/src/runtime.ts`
- `crates/host-core/src/sessions.rs`, `crates/host-core/src/permissions.rs`
- `crates/host-core/src/db.rs`, `crates/host-core/src/rpc/mod.rs`
- `apps/desktop/src/components/ConversationTopbar.tsx`
- `apps/desktop/src/pages/SettingsPage.tsx`
- `apps/desktop/electron/main/builtin-commands.ts`
- `docs/spec/03-runtime/03-tools-and-permissions.md`
- `docs/spec/03-runtime/04-data-storage.md`
- `docs/spec/03-runtime/08-error-codes.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md` (E2E-018, E2E-088)
- 决策 D191；修订了 D003、D004、D115；被 D188 / D189 取代
- [ADR 0052](/zh-CN/adr/0052-plan-operating-state-and-approval-boundary),
  [ADR 0053](/zh-CN/adr/0053-plan-checkpoint-artifact-and-execution-epoch)
