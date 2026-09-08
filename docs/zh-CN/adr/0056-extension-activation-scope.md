# ADR 0056：用户自有的 MCP 服务器与技能，共享同一激活范围

> **翻译说明：** 本页是与 [英文源决策](/adr/0056-extension-activation-scope) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受（能力存储与 UI 部分由 ADR 0112 取代）
- 日期：2026-08-05

## 背景

在此之前，向 PI-Desktop 添加 MCP 服务器或技能的唯一方式是编写插件。ADR 0038 为插件提供了 `mcp` 贡献点，由 Electron 主进程通过 stdio 或 HTTP 桥接；ADR 0039（经 D174 修订）为插件提供了 `skills` 贡献点，在 `Skill` 工具背后发布由模型调用的目录条目。两者都能工作，但两者的形态都不符合用户真正想做的事：

- 现实中的每个 MCP 服务器都是以 JSON 片段的形式分发的——来自 README 的一段 `mcpServers` 块。要求用户为运行三行 JSON 而编写清单、包和签名，只是在凭空包一层壳。
- 一个技能就是一份 Markdown 文档。插件路径让最小的扩展背负了最大的封装。

第二个缺口是覆盖范围。`enabled` 曾是每个插件的单个布尔值，因此插件要么处处开启、要么处处关闭。同时拥有工作 monorepo 和个人项目的用户，会有恰好只属于其中一个的扩展：Jira MCP 服务器不该出现在关于副业项目的会话中，而它的工具描述在那里仍会消耗每个回合的上下文。变通做法——在切换项目时手动开关扩展——既繁琐又容易忘记，而一旦忘记，模型就会看到并尝试调用本不该存在的工具。

## 决策

### 1. 三种扩展类型采用统一的激活形态

`packages/shared/src/activation.ts` 定义了 `ActivationScope = { mode: "global" | "projects"; projects: string[] }`，它与 `enabled: boolean` **并列**存储，而不是编码进后者。插件、用户 MCP 服务器和用户技能都携带这一对值，因此一个控件即可渲染全部三者，一个谓词即可过滤全部三者。

UI 显示的三态控件（`off` / `projects` / `global`）由 `activationState` 推导得出，而非存储。将 `enabled` 单独保留，才能让用户把扩展收窄到两个项目、将其关闭、再重新开启，而无需重新选择项目。

`isActiveInProject` 是唯一的匹配规则：

- 路径比较不区分大小写，也不区分末尾分隔符，因为 macOS 和 Windows 都会给我们同一个目录的不同大小写拼写，而一个悄然停止匹配的范围读起来就像一个 bug。
- 限定路径也会匹配其子目录，因此限定到 monorepo 根目录即可覆盖在该根目录内某个包上打开的会话。
- `projects` 模式的扩展在完全没有项目的会话中**不激活**。“这些项目”是关于项目的陈述；没有工作区的会话不属于其中任何一个。
- 缺失或无法识别的范围会解析为全局，这也是此次变更之前安装的每个扩展的行为。

`normalizeProjectPath` 与主机核心的 `normalize_project_path` 保持一致，因此选择器中选定的路径与 `projects` 表中记录的路径比较相等。

### 2. 范围在目录组装**和**派发时都强制执行

仅过滤目录是不够的：会话的生命周期长于列出其工具的那条提示，因此会话中途重新设定扩展的范围必须立即生效。因此每个界面都检查两次：

- 插件工具、技能和命令：`pluginActiveInProject` 过滤每回合的目录，并在 `tools.execute`、命令面板和命令执行中重新检查。
- 用户 MCP 工具：`UserMcpRuntime.toolsForProject` 过滤，当记录不再适用时，`callTool` 以 `TOOL_NOT_FOUND` 和“not active for this session”拒绝调用。
- 用户技能：`skills.active` 过滤，`loadUserSkillBody` 重新读取记录，若范围已收窄则抛出异常。

主题有意**不**做范围限定：外观是应用级偏好，而非按项目的的能力。

存在两种不同的“当前项目”，二者不可互换。面向代理的界面按**会话的** `projectPath` 过滤；面向应用的界面（面板、命令、扩展页面）按**当前窗口的**项目过滤。

### 3. 用户 MCP 服务器是主机核心注册表，而非插件

`crates/host-core/src/mcp_servers.rs` 在 `~/.agents/servers` 或 `<project>/.agents/servers` 下拥有一个 `McpServerRecord` JSON 文件，无需插件。激活状态是应用本地的，位于 `<data>/agent-capabilities/mcp.json`。与层级相关的 RPC 有 `mcp.list`、`mcp.active`、`mcp.upsert`、`mcp.remove` 和 `mcp.setEnabled`；旧有的范围形态输入是兼容字段。

Electron 主进程在 `UserMcpRuntime` 中拥有进程和套接字，复用插件桥接中的 `McpServerClient`，而不是第二个客户端：

- 服务器在首次组装能看到它的会话时连接，其工具列表会被缓存，因此同一项目上的第二个会话不产生任何开销。
- 握手失败的服务器保持失败状态，直到用户编辑它或按下 Test，因此会话组装永远不会为连接超时支付两次代价。
- 保存会改变**服务器本质**的编辑（transport、command、args、env、url、headers）会断开连接；更改 label、description 或 scope 则不会。过期的工具列表比缺失的工具列表更糟。
- 活动进程上限为 16，这是应用已用于按所有者资源上限的宽度；超限的服务器会被记录并跳过，而不是排队。
- 每个服务器保留插件桥接自身每服务器 64 个工具的上限。

工具名称带有 `mcp_` 前缀（`userMcpToolName`），与插件桥接的 `plugin_` 区分开，因此两个命名空间不会冲突，审计日志也能说明是哪个注册表服务了调用。

`commandPolicy` 为 `trusted`，子进程的 cwd 是用户的主目录：没有插件拥有该服务器，因此没有可将其沙箱化的插件根目录，而用户输入的命令就是他们自己的命令。

### 4. 粘贴 `mcpServers` 块是添加服务器的主要方式

`packages/shared` 中的 `parseMcpImport` 接受用户剪贴板上实际存在的内容：`mcpServers` 文档、`servers` 拼写、裸映射，或单个服务器对象。它根据 `url` 是否存在推断 `http`，因为现实中的半数配置省略了 `type`；强制转换非字符串的 env 和 header 值；丢弃非字符串的 args；尊重 `disabled: true`；并将一次导入限制在 32 个服务器。

格式错误的条目会被**报告，而非致命**——导入返回它理解的内容，并附上每个被跳过条目的原因，因为一次粘贴十五个服务器、其中一个条目有误，不应是全有或全无。

### 5. 用户技能各是一份 Markdown 文档

`crates/host-core/src/user_skills.rs` 扫描 `~/.agents/skills` 或 `<project>/.agents/skills` 下的 Markdown 文档。激活状态是应用本地的，位于 `<data>/agent-capabilities/skills.json`；不会向技能文档写入任何注册表或 enabled 字段。RPC：`skills.list`、`skills.active`、`skills.create`、`skills.import`、`skills.update`、`skills.read`、`skills.remove` 和 `skills.setEnabled`。

交付契约与 D174 一致、未作改动：进入提示的是 description，正文仅在模型调用 `Skill` 时获取，文档上限为 128 KiB。这就是编辑器要求填写 description 并将其置于正文上方的原因——description 是必须为自己上下文成本赢得价值的部分，也是模型在主动请求之前唯一看到的部分。

用户技能 id 是裸的；插件技能 id 包含 `/`。`loadUserSkillBody` 拒绝任何包含 `/` 的 id，并回退到插件目录，因此两个命名空间无需注册表查找即可保持可区分。

## 后果

- 添加 MCP 服务器就是一次粘贴，编写技能就是往表格里敲 Markdown。两者都不涉及清单、包或签名。
- 对于从不设置范围的任何东西，插件 `enabled` 语义保持不变，因此无需迁移：缺失范围读作全局。
- 扩展仍然是两标签页（`installed`、`market`）的插件界面。能力管理现在是三个独立的设置 > 代理页面；将新类型合并进已安装列表仍被拒绝。
- 按项目限定的扩展对没有工作区的会话没有任何贡献。这是有意为之，范围控件也说明了这一点，但这是用户可能被意外到一次的行为。
- 现在有两个注册表以 JSON 文件形式存在于 SQLite 之外。它们是用户编写的配置，受益于可读和可手工编辑，且两者都不需要事务。
- `SCHEMA_VERSION` 未变。插件范围存在于现有插件记录中；两个新注册表是文件。

## 备选方案

### 继续要求插件包装

已拒绝。这是现状，它把两种最常见的扩展——一段 JSON 片段和一份 Markdown 文件——的代价定成了发布软件。

### 将“关闭”编码为第三种激活模式

已拒绝。`mode: "off"` 无论如何都必须携带项目列表才能在关闭状态间往返后保留，而每个消费者届时都必须记住 `projects` 在名为 `off` 的模式下仍有意义。一个单独的布尔值表达了同样的含义，却没有这个陷阱。

### 把所有能力类型合并为一个“扩展”列表

已拒绝。插件是被安装的，MCP 服务器是被配置的，技能是被编写的，而子代理是全局提示文档。它们的行需要真正不同的可供性。因此扩展仍专注于已安装插件和插件市场，而设置 > 代理拥有三个独立的能力页面。

### 只过滤目录，不过滤派发

已拒绝。模型能看到的工具就是它会尝试调用的工具，而在用户收窄范围之前组装的会话仍然记得那个名字。只在一处强制执行，意味着重新设定范围到下一次提示之间是一个漏洞。

### 按会话而非按项目限定范围

已拒绝。用户是按其正在其中工作的代码库来思考扩展的，而不是按单个对话，而且按会话的选择意味着在同一项目中每开一个新会话都要重做一次。

### 让按项目限定的扩展适用于无项目会话

已拒绝，因为这是一个“安全”默认值，实际上与安全相反：它会让 `projects` 模式比其字面含义更宽，而它悄然扩大适用范围的那些会话，恰恰是没有工作区边界来约束它们的会话。

## 参考资料

- `packages/shared/src/activation.ts`、`packages/shared/src/mcp-import.ts`
- `packages/plugin-sdk/src/index.ts`（`userMcpToolName`）
- `crates/host-core/src/mcp_servers.rs`、`crates/host-core/src/user_skills.rs`
- `crates/host-core/src/plugins.rs`、`crates/host-core/src/rpc/mod.rs`
- `apps/desktop/electron/main/user-mcp.ts`、
  `apps/desktop/electron/main/index.ts`
- `apps/desktop/src/pages/PluginsPage.tsx`、
  `apps/desktop/src/components/extensions/*`
- `apps/desktop/src/styles/extensions.css`
- `docs/spec/07-plugins/01-plugin-system.md`、
  `docs/spec/07-plugins/03-plugin-api.md`
- 决策 D192、D193、D194；扩展了 D015、D174、ADR 0038、ADR 0039
