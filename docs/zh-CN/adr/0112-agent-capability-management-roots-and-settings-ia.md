# ADR 0112：代理能力管理根目录与设置信息架构

> **翻译说明：** 本页是与 [英文源决策](/adr/0112-agent-capability-management-roots-and-settings-ia) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-20
- 决策者：PI-Desktop 核心
- 取代 ADR 0056、ADR 0058 和 ADR 0063 中关于能力存储与能力 IA 的部分；更新 D193、D194 和 D202

## 上下文

MCP 服务器、技能和子代理定义此前被描述为应用数据目录下的注册表，而 Extensions 页面逐渐承载了它们的管理界面。这种模型使能力文件难以在不同安装之间迁移，将配置与应用本地的激活状态混在一起，并让 Extensions 页面承担了与之无关的编写流程。它还导致多份文档仍在引用 `.pi/` 能力目录。

## 决策

### 1. `.agents` 是唯一的能力文件根目录

宿主进程只扫描和写入以下目录：

```text
~/.agents/skills                 global skills
<project>/.agents/skills         project skills
~/.agents/servers                global MCP configuration
<project>/.agents/servers        project MCP configuration
~/.agents/subagents              global subagent definitions
```

不存在项目级子代理目录。`.pi/agents`、`.pi/skills` 和 `.pi/mcp` 都不是能力来源；与之无关的 `.pi/prompts` 存储保持不变。

技能是 Markdown 文档。其 `name` 和 `description` frontmatter 会被扫描进目录，而正文保留在磁盘上，直到 `Skill` 工具需要时才读取。MCP 服务器按 id 各一个 JSON 文件。子代理是 Markdown 文档，其 frontmatter 由运行时消费。

### 2. 文件归属与激活状态相互分离

能力文档中从不包含 `enabled` 或项目覆盖项。host-core 将应用本地状态存储于：

```text
<data>/agent-capabilities/skills.json
<data>/agent-capabilities/mcp.json
<data>/agent-capabilities/subagents.json
```

全局能力默认启用，并且可以拥有按项目的覆盖项。项目能力只有其所属项目的状态。扫描目录时会清除不再存在文件的状态；删除全局文件会移除其所有项目覆盖项，而项目扫描只移除该项目中孤立的条目。

### 3. 项目优先级在过滤之前解析

对于活动运行时，项目记录会按 id 或不区分大小写的显示名称遮蔽全局记录。即使项目记录的本地状态为禁用，该项目记录仍然胜出；只有在完成遮蔽之后，宿主进程才会过滤已禁用的记录。这样可以防止已禁用的项目定义让全局定义重新可见。

### 4. 管理功能位于设置 > 代理之下

技能、MCP 和子代理是三个独立的设置目标项，而不是标签页。技能和 MCP 使用固定高度的全局/项目列布局；其项目列带有最近项目选择器。子代理只使用一个全局列，且没有项目选择器。Extensions 目标项只保留已安装和插件市场两个标签页。

技能在每一列各提供一个单文件原生导入操作，并将所选文档物理复制到该列的 `.agents/skills` 目录中。MCP 的创建和编辑复用 `McpEditorSheet`；编辑时会锁定 id，校验与宿主进程共享，同级的重复 id 或标签会被拒绝。测试已保存的 MCP 连接会在编辑器中以及通过 toast 报告结果。

### 5. 协议查询是显式的

能力的 list、read、remove、import 和 enable 调用都会携带 `level`，并在需要时携带 `projectPath`。项目级请求若缺少 `projectPath` 则无效。运行时激活使用所选项目合并后的 `mcp.active` 和 `skills.active` 结果；子代理激活仅限全局。

## 后果

- 能力文件可移植、可检查，并且可以安全共享，无需复制应用本地的启用决策。
- 项目可以覆盖或禁用全局能力，而无需修改全局文件。
- 设置的 IA 更庞大，但 Extensions 成为聚焦于插件/插件市场的界面，并且每个能力页面都可以暴露自己的操作入口。
- 现有的插件激活作用域保持不变；它们不会被复用于文件级能力页面。
- 在需要处，宿主进程保留兼容形态的遗留作用域 RPC 字段作为无操作输入，但新的 UI 状态由 level 和本地状态表示。
