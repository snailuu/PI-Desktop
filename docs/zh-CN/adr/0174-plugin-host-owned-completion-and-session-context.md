# ADR 0174：主机所有的插件补全与会话上下文

> **翻译说明：** 本页是与 [英文源决策](/adr/0174-plugin-host-owned-completion-and-session-context) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-07
- 决策者：PI-Desktop 核心
- 相关：D019、D015、D018、D336、ADR 0005、ADR 0008、ADR 0121、ADR 0170、
  `07-plugins/03-plugin-api.md`、`07-plugins/13-plugin-permissions-matrix.md`

## 上下文

诸如 `@juicesharp/rpiv-advisor` 之类的 Pi CLI 扩展允许执行器模型调用一个零参数的 `advisor()` 工具。主机会序列化已解析的 LLM 上下文，并使用用户现有的凭据对更强的审阅模型运行一次性补全。

PI-Desktop 插件已经可以注册工具、命令、设置和技能，但它们无法：

- 列出用户已完成认证的模型
- 读取当前会话面向模型的对话记录
- 将用户的供应商配额消耗在旁路补全上

插件若自行调用供应商，就需要密钥（被禁止，D018）或 `net.fetch` 加上粘贴的密钥。D019 默认拒绝会话摘要访问。输入框的 `prompt/enhance` 已经证明了主机所有的一次性路径，该路径从不把密钥交给渲染器。

## 决策

1. **三个公开插件 API**，由新权限门控：

   - `models.list`（medium）——`pi.models.list()` 返回就绪的
     `(providerId, modelId)` 行。不涉及密钥。
   - `session.read`（high）——`pi.session.getLlmContext()` 返回**进行中的工具会话**的有界、
     能感知压缩的投影。插件不能传入 session id；身份来自 `plugins.execute`（与 D333 相同的规则）。
   - `agent.complete`（high）——`pi.agent.complete({ modelKey, thinkingLevel,
     system, messages, includeSessionContext })` 通过代理回合和提示词增强所用的同一凭据解析器，
     运行主机所有的、带 `tools: []` 的一次性补全。`includeSessionContext: true`
     还要求 `session.read` 以及存在进行中的工具会话。

2. **主机拥有凭据与网络调用。** 插件进程永远不会收到 API key、OAuth 刷新 token
   或短期的 `ModelAuth`。补全复用 `resolveAgentRuntimeLaunch` 加上运行时的一次性辅助函数。
   密钥保留在 Electron 主进程中。

3. **会话上下文是投影，而非转储。** 子代理行会被省略。插件自身工具的进行中调用
   会从尾部剥离。压缩摘要会替换检查点之前的历史。工具结果会被截断。
   载荷设有上限。审计日志记录插件 id、模型键、大小与用量——绝不记录对话记录文本。

4. **速率与大小限制。** 每个插件每滚动 60 秒最多 8 次 `agent.complete` 调用。
   系统提示词 ≤ 32 KiB。合并后的 messages ≤ 200k 字符。补全预算 90 秒，
   低于 110 秒的插件工具超时。

5. **`session:modelChanged` 是主机事件**，在成功执行会更改供应商、模型或思考级别的
   `session.configure` 之后推送。

6. **D019 被修订，而非撤销。** 在 `session.read` 被声明并授予之前，会话内容仍被拒绝。
   工具执行上下文可以在没有该权限的情况下包含 `modelKey` / `thinkingLevel`，
   因为它们属于会话配置，而非对话记录。

7. **官方 advisor 以捆绑插件 `pi.advisor` 的形式提供。** 它只使用这些公开 API
   （外加 `agent.tool.register`、`agent.prompt.inject`、`ui.panel`）。默认禁用
   （`enabledByDefault: false`），可启用，不可卸载。用户的启用/禁用选择在多次启动之间
   保持不变。在用户通过 `/advisor` 或插件设置选择审阅模型之前，`advisor` 工具保持未注册状态，
   因此未使用的 advisor 既不产生补全开销，也不占用工具 schema。

没有主机协议或存储 schema 的升级。与 `prompt/enhance` 一样，补全是 Electron 本地的。

## 后果

- 第三方插件可以在不持有密钥的情况下构建审阅 / 第二意见工具。
- `session.read` + `agent.complete` 是一条合法的对话外泄通道，可把对话发送到用户已经在
  付费的另一个模型。安装 UI 必须展示这两个权限及其帮助文本。
- 插件工具保留 D015 前缀（`plugin_pi_advisor_advisor`）。Plan 和 Goal 仍然硬性拒绝插件工具。
- advisor 的消耗属于旁路补全：它记录在插件调用的审计中，不会被合并到父助手的
  用量标签（ADR 0171）中。

## 已否决的备选方案

### 在 sidecar 中加载 npm 上的 Pi CLI 扩展

sidecar 不是 Pi TUI 扩展宿主。`/advisor` 需要 TTY，在 RPC 下会失败。

### 让插件通过 `net.fetch` 调用供应商

这需要在插件设置中存放密钥（D018）或由用户粘贴密钥，并且会绕过主机重试、OAuth 与审计。

### 用第一方内置 `advisor` 工具替代插件

本次变更中已否决：重点在于验证公开通道，就像 Files 和 Browser 所做的那样。
后续再引入内置实现仍然可行。

### 给插件一个任意的 `sessionId` 参数

已否决：插件将能读取每一个打开的对话。进行中的工具身份与 `pi.browser.*`
所使用的界限相同。
