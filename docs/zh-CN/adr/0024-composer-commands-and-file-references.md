# ADR 0024：输入框斜杠命令与 @ 文件引用

> **翻译说明：** 本页是与 [英文源决策](/adr/0024-composer-commands-and-file-references) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-27
- 决策者：PI-Desktop core
- 相关：D123、D124、D125、D197、D209、D250、ADR 0019（工作面板子系统）、ADR 0059（剪贴板文件粘贴）、ADR 0070（紧凑引用显示）、ADR 0106（核心五个内置命令）、D114（草稿目录）、D119（transcript 文件存储）

## 上下文

输入框目前只是一个纯 textarea。命令面板（Cmd/Ctrl+Shift+P）承载应用命令，但聊天输入本身既没有原地命令系统，也无法引用工作区文件，而规格 08 §11.7 明确将两者都排除在范围之外。内嵌的 pi 运行时（`@earendil-works/pi-agent-core` 0.82）为其 CLI 原生定义了这两个概念：

- **提示词模板**：位于 `<workspace>/.pi/prompts/` 和 `~/.pi/agent/prompts/` 的 markdown 文件，带有 `description` / `argument-hint` frontmatter。`/name args` 在客户端展开（`parseCommandArgs` + `substituteArgs`：`$1..$n`、`$@`、`$ARGUMENTS`、`${@:N:L}`），并作为普通用户消息发送——模型从不会看到斜杠形式。
- **`@path` 引用**：提示词中的字面文本；模型随后用自己的 Read 工具跟进。不内联，也不转换为附件。
- pi 的内置斜杠命令（`/new`、`/model` 等）是其 TUI 的客户端行为，而非运行时特性。

PI-Desktop 使用的是低层 `Agent` 类（而非 `AgentHarness`），因此这些机制目前在桌面端都未生效；不过已安装的包导出了加载器/展开辅助函数，可以直接复用。

## 决策

1. **斜杠命令来自三个来源**，合并进同一个输入框菜单：pi 提示词模板（同名冲突时项目目录覆盖用户全局）、内置命令面板注册表（斜杠别名定义在 `electron/main/builtin-commands.ts`，由现有渲染器侧 switch 执行），以及插件面板命令（通过 `commandPalette/execute` 执行）。内置注册表有意限制为 ADR 0106 定义的五个核心条目。未知的 `/foo` 按字面文本发送（与 pi CLI 保持一致）。
2. **模板展开发生在 Electron 主进程的 `agent/prompt` 处理器中，且在持久化之前。** 持久化的用户消息存储 `content = 展开后的文本`，并新增一个可选 `command` 字段用于保存用户键入的调用（`/name args`）。代理重新播种时回放 `content`，因此模型上下文在重启之间保持一致；transcript 将 `command` 字段渲染为紧凑的 chip。额外的消息字段已被宿主存储容忍（revision* 先例）。
3. **`@path` 在提示词分发时保持为纯文本轻量引用**，与 pi CLI 完全一致。输入框提供模糊自动补全；接受目录时插入 `@dir/` 以便继续补全，而已补全的文件则按 ADR 0070 成为渲染器所有的紧凑引用。分发前，这些引用序列化为 `@relative/path `（路径含空格时加引号 `@"a b.txt"`）。Plan 和 Agent 都携带 Read/Glob/Grep，所以两种模式下引用都可用。不会内联内容，也不会有二进制内容进入提示词。操作系统剪贴板的文件/图片粘贴按 ADR 0059 物化为会话草稿文件引用；它不使用 pi-ai 的 `ImageContent`，也不改变纯文本提示词契约。
4. **工作区文件索引由 Electron 主进程提供**，而非 agent 工具——理由与 ADR 0019 相同：用户发起的浏览不应刷屏权限提示或审计记录。新增只读通道 `pi-desktop/fs/index` 返回最多 8000 条以工作区根为基准的条目（快速路径 `git ls-files -co --exclude-standard`，回退为忽略集遍历，带短 TTL 缓存）；`pi-desktop/composer/commands` 返回合并后的命令列表。两者在没有工作区时都软失败。这些仅限 Electron 的通道不改变宿主 RPC 协议版本。

## 考虑过的替代方案

- **在 agent sidecar 中展开模板**：可以将 pi 的导入集中在一处，但主进程会先持久化用户消息，因此 sidecar 若想影响重新播种所回放的内容，就需要第二条写入路径。已否决。
- **将运行时迁移到 `AgentHarness`** 以获得 `promptFromTemplate`：为一个特性而替换整个提示词/循环集成。目前否决；独立辅助函数提供的语义完全相同。
- **将引用的文件内容内联进提示词**（pi CLI 的参数模式行为）：会膨胀上下文，需要截断规则，还需要为二进制文件提供附件通道。已否决——Read 工具的轻量引用才是 pi 的交互式语义，且零成本。
- **从渲染器递归复用 `fs/list`**：每个目录层级一次 IPC 往返会让模糊搜索变得迟缓且通信频繁。已否决。

## 后果

- 输入框获得了一个键盘优先的自动补全面板（D125 定义了交互/输入法契约——本项目第一份明确的输入法规格）。
- `.pi/prompts` 模板成为 pi CLI 与 PI-Desktop 之间共享的资产。
- transcript 用户消息 schema 新增可选 `command` 字段；忽略它的渲染器仍可正常工作。
- 内联二进制附件与预览瓷砖仍推迟。紧凑的文本引用 chip 按 ADR 0070 是仅渲染器的草稿状态；剪贴板文件/图片仍按 ADR 0059 的定义使用会话草稿 `@` 引用。
