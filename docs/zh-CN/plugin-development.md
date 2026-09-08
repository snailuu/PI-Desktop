# PI-Desktop 插件开发：从零到一

> **翻译说明：** 本页是与 [英文源页面](/plugin-development) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

本指南是从一个空文件夹到经过测试的 `.piplug` 包的最短完整路径。它描述的是 PI-Desktop 当前发布的插件运行时。当本指南与规格说明不一致时，[`docs/spec/07-plugins`](/zh-CN/spec/07-plugins/README) 下的文件仍是规范性约定。

## 1. 插件可以添加什么

插件可以贡献以下一项或多项能力：

| 能力 | 适用场景 | 主要构建块 |
|---|---|---|
| 命令 | 全局搜索中的显式动作 | `contributes.commands`、`pi.commands.register` |
| 面板 | 一个小型隔离的 HTML 界面 | `ui.panel`、`ui.panel` 权限、`window.pluginBridge` |
| 工作面板视图 | 停靠在应用右侧工作面板中的界面 | `contributes.views`、`ui.view` 权限、`window.pluginBridge` |
| 代理工具 | 代理可以调用的函数 | `contributes.agentTools`、`pi.agent.registerTool` |
| 评审器补全 | 宿主针对用户模型发起的一次性调用 | `pi.models.list`、`pi.session.getLlmContext`、`pi.agent.complete` |
| 技能 | 代理按需加载的指令 | `contributes.skills`、`agent.prompt.inject` 权限 |
| 主题 | 设计 token 覆盖 | `contributes.themes`、`ui.theme` 权限 |
| MCP 服务器 | 从本地或远程 MCP 服务器发现的工具 | `contributes.mcpServers`、一项 MCP 权限 |
| 服务 | 由宿主监督的常驻工作 | `contributes.services`、`background.service` 权限 |
| 消息总线 | 插件之间按约定定型的事件 | `contributes.bus`、总线权限 |

插件入口代码运行在专用的 Node 进程中。面板运行在沙箱化、上下文隔离的 Electron 窗口中，不集成 Node。来自任一界面的调用都要经过宿主拥有的权限网关。

> **信任边界：**权限模型管控的是 `pi.*` 宿主 API 和面板桥接。它还不是针对插件入口进程所使用的原生 Node API 的操作系统级沙箱。只有在你信任其来源时，才加载开发插件和第三方包，并且请使用宿主 API，而不是直接进行 Node 文件或网络访问。参见[安全规格](/zh-CN/spec/07-plugins/04-plugin-security)。

## 2. 前置条件

对于推荐的应用内优先路径，你需要：

- 一个正在运行的 PI-Desktop 构建；
- 一个用于该插件的空文件夹；以及
- 一个文本编辑器。

对于仓库 CLI 路径，你还需要 Node.js 22.19 或更新版本、pnpm 10 或更新版本，以及本仓库的一份检出副本。devkit 和 SDK 目前是私有的工作区包，因此不要假设 `npm install @pi-desktop/plugin-devkit` 在本仓库之外可用。

## 3. 创建第一个插件

### 选项 A：在 PI-Desktop 中创建

1. 打开**插件**（扩展页面）。
2. 打开顶部溢出菜单，选择**从模板新建插件**。
3. 选择 `panel-basic`。
4. 选择一个空文件夹。

PI-Desktop 会写入起始文件，将该文件夹作为开发插件加载，并将其作为当前项目打开。插件立即生效。

四个内置模板如下：

| 模板 | 起始内容 | 权限 |
|---|---|---|
| `panel-basic` | 命令和 HTML 面板 | `ui.panel` |
| `agent-tool-basic` | 代理可调用的 echo 工具 | `agent.tool.register` |
| `skill-pack` | 一份技能文档 | `agent.prompt.inject` |
| `full-demo` | 命令、面板、工具、技能和设置 | 这些功能所使用的权限 |

脚手架会拒绝非空的目标目录，因此它不会静默覆盖已有项目。

### 选项 B：使用仓库 CLI 创建

在 PI-Desktop 仓库根目录下：

```bash
pnpm install
pnpm --filter @pi-desktop/plugin-devkit... build
pnpm pi-plugin init panel-basic ../my-first-plugin \
  --id local.my-first-plugin \
  --name "My First Plugin"
```

然后打开 PI-Desktop，进入**插件**页面，选择**加载开发插件**，并选中 `../my-first-plugin`。

对于已发布的插件，请使用反向域名 id，例如 `com.example.workspace-summary`。`local.` 前缀是私有插件的实用约定。保持 id 稳定：设置、数据、授权、更新和包名都以它为键。

## 4. 理解生成的文件

`panel-basic` 模板会生成：

```text
my-first-plugin/
├── manifest.json
├── main.js
├── README.md
└── renderer/
    └── index.html
```

- `manifest.json` 声明身份、入口点、贡献项和所请求的权限。
- `main.js` 在插件进程中运行，并导出生命周期钩子。
- `renderer/index.html` 在隔离的面板窗口中运行。
- `README.md` 说明如何开发和打包这个特定插件。

分发包必须包含可直接执行的 JavaScript、HTML、CSS 和资源。PI-Desktop 在加载插件时不会安装依赖或编译 TypeScript。如果你使用 TypeScript 或第三方包，请在检查和打包之前将它们打包或编译进插件目录。

## 5. 手工构建最小插件

以下三个文件展示了完整的从命令到面板的路径。

### `manifest.json`

```json
{
  "schemaVersion": 1,
  "id": "local.my-first-plugin",
  "name": "My First Plugin",
  "version": "0.1.0",
  "description": "Opens a panel and shows a greeting.",
  "main": "main.js",
  "ui": {
    "panel": "renderer/index.html",
    "title": "My First Plugin",
    "width": 480,
    "height": 360
  },
  "contributes": {
    "commands": [
      {
        "id": "my-first-plugin.open",
        "title": "My First Plugin: Open Panel",
        "keywords": ["hello", "panel"]
      }
    ]
  },
  "permissions": ["ui.panel"],
  "engines": {
    "piDesktop": ">=0.1.0"
  },
  "activationEvents": [
    "onCommand:my-first-plugin.open",
    "onStartup"
  ]
}
```

`schemaVersion`、`id`、`name`、`version` 和 `main` 是必填项。每个文件路径都相对于插件根目录，并且必须留在其中。只声明插件实际需要的权限。

### `main.js`

```js
async function onLoad() {
  await pi.commands.register({
    id: "my-first-plugin.open",
    title: "My First Plugin: Open Panel",
    keywords: ["hello", "panel"],
    run: async () => {
      await pi.ui.openPanel({ title: "My First Plugin" });
      await pi.ui.showToast("Hello from My First Plugin");
    },
  });
}

async function onUnload() {
  await pi.commands.unregister("my-first-plugin.open");
}

module.exports = { onLoad, onUnload };
```

宿主将 `pi` 作为全局对象注入。`onLoad` 和 `onUnload` 不接收任何参数。CommonJS 是最简单的入口格式；当入口是 ES 模块时也会以 ESM 加载。模块求值加上 `onLoad` 共有 15 秒预算。`onUnload` 有 5 秒预算，且属于尽力而为，因此请及时释放定时器和订阅。

目前只会触发 `onLoad` 和 `onUnload`。manifest 中的其他生命周期名称是为计划中的完整生命周期保留的。

### `renderer/index.html`

PI-Desktop 在所有平台上都将面板托管在无边框窗口中。宿主恰好保留一条透明的 46 CSS px 拖动区域，并在右上角渲染一个极简的固定胶囊，其中包含最小化、最大化/还原和关闭按钮。面板标题、工具栏以及所有其他可见 UI 都归插件所有。正常流内容会自动偏移到拖动区域下方，因此不要再额外添加上内边距来补偿。拖动区域在胶囊之外不可点击；开发面板会针对这一约束显示提醒。

如果面板使用 `position: fixed` 或 `position: sticky` 来放置顶部工具栏，请将其锚定在宿主拖动区域下方，而不是使用 `top: 0`：

```css
.panel-toolbar {
  position: sticky;
  top: var(--pi-plugin-titlebar-height, 46px);
  -webkit-app-region: drag;
}

.panel-toolbar button {
  -webkit-app-region: no-drag;
}
```

宿主不会注入面板标题。在进行视口高度计算时也要记住这 46px 的拖动区域：
`height: calc(100dvh - var(--pi-plugin-titlebar-height, 46px))`。

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My First Plugin</title>
  </head>
  <body>
    <h1>My First Plugin</h1>
    <button id="hello">Show toast</button>
    <script>
      document.getElementById("hello").addEventListener("click", async () => {
        await window.pluginBridge.invoke("ui.showToast", {
          message: "Hello from the panel",
        });
      });
    </script>
  </body>
</html>
```

面板不会获得全局 `pi` 对象。它只会获得 `window.pluginBridge`，并且任意 Electron IPC 通道都不可用。

## 6. 添加能力

### 6.1 代理工具

声明工具及其权限：

```json
{
  "contributes": {
    "agentTools": [
      {
        "name": "summarize_text",
        "description": "Summarize text supplied by the agent.",
        "risk": "low",
        "schema": {
          "type": "object",
          "properties": {
            "text": { "type": "string" }
          },
          "required": ["text"]
        }
      }
    ]
  },
  "permissions": ["agent.tool.register"]
}
```

在 `onLoad` 期间注册匹配的处理程序：

```js
await pi.agent.registerTool({
  name: "summarize_text",
  description: "Summarize text supplied by the agent.",
  risk: "low",
  schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  execute: async (args, context) => {
    context.log("summarize_text called");
    const text = String(args?.text ?? "");
    return { summary: text.slice(0, 120) };
  },
});
```

在 `onUnload` 中注销它。宿主会以带插件命名空间的名称将其暴露给模型，应用常规的代理权限策略，审计执行过程，并强制执行 110 秒的插件侧超时。插件工具在 Plan 模式下不可用。

### 6.2 技能

添加一个文件，例如 `skills/release-notes.md`：

```markdown
---
name: Release notes
description: Use when the user asks for release notes or a changelog entry.
---

# Release notes

Write one line per user-visible change. Use imperative mood and put the newest
change first.
```

使用所需权限声明它：

```json
{
  "contributes": {
    "skills": ["skills/release-notes.md"]
  },
  "permissions": ["agent.prompt.inject"]
}
```

提示词会收到一份简短的技能目录；完整正文按需读取。每个插件最多可贡献 32 个技能，每个文件最大为 128 KiB，描述上限为 240 个字符。缺少 `agent.prompt.inject` 的技能会被忽略，而不是被加载。

### 6.3 设置与私有数据

在 manifest 中声明默认值：

```json
{
  "contributes": {
    "settings": [
      {
        "key": "greeting",
        "title": "Greeting",
        "type": "string",
        "default": "Hello"
      }
    ]
  }
}
```

从插件进程中读取和更新它们：

```js
const settings = await pi.plugin.getSettings();
await pi.plugin.setSettings({ greeting: "Welcome" });
const dataPath = await pi.plugin.getDataPath();
```

设置和数据路径对插件 id 是私有的。已安装插件的插件页面会为 `string`、`number`、`boolean`、`select`、`json` 和 `shortcut` 字段生成控件。快捷键字段必须指定一个已声明的命令：

```json
{
  "key": "openShortcut",
  "title": "Open panel shortcut",
  "type": "shortcut",
  "default": "Mod+Shift+H",
  "command": "hello.open",
  "scope": "plugin"
}
```

插件快捷键仅在获得焦点的 PI-Desktop 窗口中运行，并会与应用快捷键映射进行校验。目前尚不支持全局注册。用户编辑之后，插件会收到 `plugin:settingsChanged`。不要把凭据放入 `manifest.json` 或源代码控制中。

### 6.4 工作区文件、剪贴板、网络和通知

这些 API 需要显式权限：

| 权限 | 插件进程 API | 面板桥接通道 |
|---|---|---|
| `fs.read` | `pi.fs.readText`、`pi.fs.glob`、`pi.fs.list`、`pi.fs.requestDirectory` | `fs.readText`、`fs.glob`、`fs.list` |
| `fs.write` | `pi.fs.writeText` | `fs.writeText` |
| `fs.delete` | `pi.fs.remove` | 未暴露 |
| `clipboard.read` | `pi.clipboard.readText`、`pi.clipboard.getHistory` | `clipboard.readText`、`clipboard.getHistory` |
| `clipboard.write` | `pi.clipboard.writeText` | `clipboard.writeText` |
| `net.fetch` | `pi.net.fetch` | `net.fetch` |
| `shell.openExternal` | `pi.shell.openExternal` | `shell.openExternal` |
| `notify` | `pi.ui.notify`、`pi.ui.getNotificationPermission`、`pi.ui.requestNotificationPermission`、`pi.ui.showNativeNotification` | `ui.notify`、`ui.getNotificationPermission`、`ui.requestNotificationPermission`、`ui.showNativeNotification` |

在展示树形结构时，使用 `fs.list` 而不是 `fs.glob`：它一次返回一个目录（按名称排序，包含目录），因此用户可以展开自己想要的部分，而无需等待一次上限为 500 个匹配项的整仓库遍历。两者遵循相同的读取范围。

文件权限只是声明的一半：`manifest.fs` 规定每种模式可以触及哪些路径（见 §6.5）。路径相对于该模式的根目录。绝对路径和 `..` 逃逸会被拒绝，离开根目录的符号链接也是如此。`fs.remove` 是非递归的，会将路径移入操作系统回收站，并且不能删除根本身。`net.fetch` 接受 HTTP(S)，并且只能访问 `manifest.net.domains` 中列出的主机；`openExternal` 接受 HTTP(S) 和 `mailto:` URL。

`pi.ui.notify` 会显示应用内 Toast。原生通知是选择加入的：在调用 `pi.ui.showNativeNotification(...)` 之前先调用 `pi.ui.requestNotificationPermission()`。返回的权限是尽力而为的结果，因为 Electron 没有暴露跨平台的只读操作系统权限 API；`unknown` 表示平台尚未报告结果，`unsupported` 表示桌面通知不可用。原生插件通知不会被加入 PI-Desktop 的持久任务通知收件箱。

面板桥接还暴露了 `ui.showToast`、`ui.closePanel`、`plugin.getSettings` 和 `workspace.get`。宿主自身未实现的通道会被转发到你的 `onPanelInvoke(channel, payload)`，因此面板可以通过你定义的通道与自己的插件通信；未导出 `onPanelInvoke` 的插件会收到 `UNSUPPORTED`。

### 6.5 文件范围

`fs.read` / `fs.write` / `fs.delete` 规定你的插件是否可以触及文件。`manifest.fs` 规定可以触及哪些文件：

```json
{
  "permissions": ["fs.read", "fs.write", "fs.delete"],
  "fs": {
    "read": { "scope": ["**/*"] },
    "write": { "scope": ["docs/**", "*.md"] },
    "delete": { "own": true, "scope": ["dist/**"] }
  }
}
```

- `scope` 的 glob 相对于根目录。`*` 匹配一个路径段，`**` 可跨分隔符。
- **读取**可以声明整棵树。**写入和删除则不行**——整棵树的模式会校验失败，因为出站允许列表才能让宽泛的读取变得安全，而没有任何东西能让宽泛的写入变得安全。
- 超出所声明范围的访问不算错误：PI-Desktop 会询问用户（拒绝 / 允许一次 / 允许本次会话）。声明你需要的范围，这样你的插件就不会在每次调用时都打断用户，并且要预期拒绝会以 `PERMISSION_DENIED` 形式返回。
- 无论你声明什么，某些路径都会被拒绝：`.env*`、SSH 和云凭据、`*.pem`、`.git/**` 以及 PI-Desktop 自身的数据目录。它们也不会出现在 `fs.glob` 的结果中。

**删除。**`own: true` 允许你删除自己插件写入的文件，无需范围也无需提示——这是清理自身输出的正确默认值。（如果用户在你写入之后编辑过该文件，它就不再算作你的文件。）删除其他任何内容都需要一个 `scope`。每次删除都是非递归的，会移入操作系统回收站，并且在每分钟超过 50 次删除后会被中断，因此批量清理应当限速进行，而不是用一个 `glob` 加一个循环来完成。

**在工作区之外工作。**在某个模式上设置 `"root": "userSelected"` 并调用 `pi.fs.requestDirectory()`：用户选择一个目录，你在其中获得完全访问权，无需声明范围。该句柄保存在内存中，插件进程退出后即消失，因此每个会话都要重新请求。

**旧版名称。**`fs.read.workspace`、`fs.write.workspace` 和 `fs.delete.workspace` 仍会加载，但会被削减——写入触不到任何内容，删除只能触及你自己的输出——直到 manifest 声明了 `fs`。插件页面会告知用户发生了这种情况。

### 6.6 网络访问

`net.fetch` 允许你的插件发起请求；`manifest.net.domains` 规定可以发往哪里：

```json
{
  "permissions": ["net.fetch"],
  "net": { "domains": ["api.example.com", "*.githubusercontent.com"] }
}
```

条目是裸主机名——没有 scheme、没有端口、没有路径——以 `*.` 开头的条目覆盖该域名及其子域名。单独的 `*` 会在安装时被拒绝。

该列表是宿主所拥有的**每一条**出站路径的唯一允许列表，而不仅仅是 `pi.net.fetch`：面板自身的 `fetch`、`<img>`、`<script>` 和样式表加载也要遵守它（沙箱化的面板仍然有网络栈），你声明的远程 HTTP MCP 服务器同样如此。来自面板的 `window.open` 会被直接拒绝。

省略、为空或格式错误的 `net.domains` 意味着**完全没有出站**，即使已授予 `net.fetch` 也是如此。重定向会被手动跟踪并重新检查，因此被允许的主机无法将请求弹转到你未声明的地址。请将资源打包进插件，而不是从你否则必须声明的 CDN 加载。

### 6.7 主题

声明一个 CSS 文件和 `ui.theme`：

```json
{
  "contributes": {
    "themes": [
      {
        "id": "midnight",
        "label": "Midnight",
        "path": "themes/midnight.css",
        "base": "dark"
      }
    ]
  },
  "permissions": ["ui.theme"]
}
```

在该 CSS 中覆盖 PI-Desktop 设计 token。宿主会对所贡献的 CSS 进行净化，拒绝 import 和非 data URL，每个文件上限为 256 KiB，并且每个插件最多允许八个主题。用户在设置中选择主题。

### 6.8 工作面板视图

视图是停靠在应用右侧工作面板中的界面，与 Review、Terminal、Browser 和 Files 并列。它与 `ui.panel` 是同一个隔离页面——你可以复用相同的 HTML——但它显示在主窗口内，而不是独立窗口中，这适合用户在阅读对话时查阅的任何内容：变更列表、文件树、问题队列。

```json
{
  "contributes": {
    "views": [
      {
        "id": "changes",
        "title": { "en": "Changes", "zh-CN": "改动" },
        "icon": "diff",
        "entry": "views/changes.html",
        "order": 10
      }
    ]
  },
  "permissions": ["ui.view"]
}
```

按插件需要声明任意多个；每一个都会成为面板顶部菜单中的一行。`title` 可以是普通字符串，也可以是 `{ en, "zh-CN" }` 对象。`order` 用于对这些行进行排序，默认按声明顺序。

`icon` 是固定列表中的一个 token，宿主会从自己的图标集中绘制它——`bell`、`book`、`bot`、`branch`、`browser`、`chat`、`clock`、`diff`、`files`、`folder`、`image`、`key`、`link`、`list-checks`、`palette`、`plug`、`pull-request`、`search`、`server`、`shield`、`sparkles`、`target`、`terminal`、`workflow`、`wrench`。插件不能提供自己的 SVG，因为图标是在宿主 chrome 内绘制的。未知 token 不是错误：它会被渲染成字母方块，`pi-plugin check` 会对此发出警告。

在页面内部，`window.pluginBridge` 的工作方式与在面板窗口中完全一样。唯一的区别是 chrome：停靠的视图没有窗口控件，也没有拖动区域，因此请读取 `--pi-plugin-titlebar-height`，而不是硬编码 `46px`，同一个文件在两种放置方式下都能正确布局。

```css
body {
  /* 0px docked, 46px in a panel window. */
  padding-top: calc(var(--pi-plugin-titlebar-height, 0px) + 12px);
}
```

视图受到的约束与面板窗口相同：沙箱化页面、无 Node、插件自身持久化的会话分区，网络被限制在 `manifest.net.domains` 之内（§6.6）。它还会按激活范围进行过滤——限制在特定项目的插件不会在其他项目中提供其视图。

`examples/plugins/hello` 在 `views/greetings.html` 提供了一个可用的视图，而 PI-Desktop 自带的 **Files** 面板就是一个以相同方式构建的捆绑插件——`apps/desktop/resources/plugins/pi.files` 是一个完整而非玩具级的示例，展示了如何通过公开的 `fs.list` / `fs.readPreview` / `fs.glob` / `fs.openDefault` / `fs.reveal` 桥接读取工作区。

### 6.9 MCP 服务器

MCP 服务器是声明式的。本地服务器需要 `mcp.server.local`；远程服务器需要 `mcp.server.remote`：

```json
{
  "contributes": {
    "mcpServers": [
      {
        "id": "docs",
        "label": "Documentation tools",
        "transport": "stdio",
        "command": "bin/docs-server",
        "args": ["--stdio"],
        "env": {
          "DOCS_TOKEN": { "setting": "docsToken" }
        }
      },
      {
        "id": "issues",
        "transport": "http",
        "url": "https://mcp.example.com/tools",
        "headers": {
          "Authorization": { "setting": "issuesAuthorization" }
        }
      }
    ]
  },
  "permissions": ["mcp.server.local", "mcp.server.remote"]
}
```

stdio 命令必须是能在 `PATH` 上找到的裸命令，或是相对于插件的可执行文件；绝对路径会被拒绝。远程 URL 可以使用 HTTP 或 HTTPS，且主机必须列在 `net.domains` 中；非回环的 HTTP 未加密，因此仅在可信网络上使用。设置引用只会读取此插件自己的设置——宿主环境和供应商密钥永远不会被转发。MCP 工具遵循与手写插件工具相同的仅限代理策略和命名空间规则。

### 6.10 常驻服务与消息总线

声明服务 id 和允许的主题：

```json
{
  "contributes": {
    "services": [
      { "id": "watcher", "label": "Workspace watcher" }
    ],
    "bus": {
      "publish": ["example.index.ready"],
      "subscribe": ["example.build.*"]
    }
  },
  "permissions": [
    "background.service",
    "bus.publish",
    "bus.subscribe"
  ]
}
```

注册匹配的处理程序：

```js
let unsubscribe;

pi.services.register({
  id: "watcher",
  start: ({ log }) => log("watcher started"),
  stop: () => {},
});

unsubscribe = await pi.bus.subscribe("example.build.*", async (message) => {
  await pi.bus.publish("example.index.ready", {
    source: message.from,
    at: message.at,
  });
});
```

在卸载时调用 `unsubscribe()`。插件不会收到自己的总线消息。请将所有主题视为对任何持有匹配订阅的已安装插件公开；永远不要在负载中放置密钥。

## 7. 权限设计

权限既要在 `manifest.json` 中声明，也要由用户授予。未声明或未授予的 API 调用会以 `PERMISSION_DENIED` 失败。

| 风险 | 权限 |
|---|---|
| 低 | `ui.panel`、`ui.view`、`ui.theme`、`notify` |
| 中 | `clipboard.read`、`clipboard.write`、`fs.read`、`shell.openExternal`、`background.service`、`bus.publish`、`bus.subscribe` |
| 高 | `fs.write`、`fs.delete`、`agent.tool.register`、`agent.prompt.inject`、`net.fetch`、`mcp.server.local`、`mcp.server.remote` |

有两个权限除了名称之外还带有声明的范围，并且用户会同时看到两者：`manifest.fs` 对应文件模式（§6.5），`manifest.net.domains` 对应出站（§6.6）。两者都采用失效关闭：缺失或为空的声明不会授予任何内容，因此对它们只字未提的插件触不到任何东西。

请尽可能请求最小的权限集合。向已加载的开发插件添加权限不会通过热重载生效：PI-Desktop 会停止重载，并要求用户重新加载该文件夹，以便审阅新的授权。为此目的，扩大 `manifest.fs` 也算作添加权限。移除权限会在重载时生效。

完整的映射和策略见[权限矩阵](/zh-CN/spec/07-plugins/13-plugin-permissions-matrix)。

## 8. 开发与调试

### 热重载

开发插件在首次加载文件夹之后以及跨应用重启期间都会被监视。变更会在 300 毫秒防抖后重载。`.git`、`node_modules`、`dist`、`target` 以及常见的编辑器临时文件会被忽略。

一次重载会执行 `unload → validate → load`。面板内存不会被保留。语法或 manifest 错误会卸载损坏的版本，但会保持监视器处于活动状态；保存修复即可恢复。最多同时监视 16 个开发插件。

### 验证每一项贡献

- 从全局搜索运行命令（`Cmd/Ctrl+K` 或 `Cmd/Ctrl+Shift+P`）。
- 从命令或插件行打开面板。
- 在代理模式下让代理调用所贡献的工具。
- 请求一个与技能描述匹配的任务，然后检查该技能是否被选中。
- 在设置中选择一个所贡献的主题。
- 检查插件行中的服务状态和重启次数。

### 日志与故障

加载、崩溃、权限、工具、网络、服务和总线活动都会记录在应用日志中。打开**设置 → 信息 → 日志**，然后搜索插件 id。面向用户的加载和热重载失败也会以 toast 形式出现，并且在存在持久化的加载错误时显示在插件行上。

宿主 API 失败会抛出带有 `code` 的 `Error`，常见的有 `PERMISSION_DENIED`、`NOT_FOUND`、`INVALID_ARGUMENT`、`TIMEOUT`、`UNSUPPORTED`、`LIMIT_EXCEEDED` 或 `RATE_LIMITED`。在可选操作周围捕获错误，并在诊断信息中包含该 code，同时不要记录密钥。

## 9. 检查、打包与安装

在仓库根目录运行校验：

```bash
pnpm pi-plugin check ../my-first-plugin
```

`check` 会报告阻塞性错误和非阻塞性警告。它使用与安装相同的规则来校验 manifest、被引用的文件、权限、路径包含关系、符号链接、包大小和文件数量。也要检查警告，尤其是未使用和高风险的权限。

只使用 devkit 打包：

```bash
pnpm pi-plugin pack ../my-first-plugin
```

结果是：

```text
../my-first-plugin/dist/local.my-first-plugin-0.1.0.piplug
```

该命令会打印包的 SHA-256。`.piplug` 是仅存储（不压缩）的 ZIP；`zip` 的常规默认设置通常会生成安装程序拒绝的归档。devkit 会排除 `.git`、`node_modules` 和 `dist`，拒绝符号链接，并强制执行最多 2,000 个文件和 50 MiB 的上限。

要测试用户实际收到的那个工件：

1. 打开**插件**。
2. 从顶部溢出菜单中选择**安装插件包**。
3. 选择生成的 `.piplug`。
4. 审阅权限并安装它。
5. 重复上一节中的贡献验证检查。
6. 禁用它再重新启用，以验证清理和启动行为。
7. 卸载它并确认其贡献消失。

代理还可以在每种操作模式下运行 `PluginCheck`。`PluginScaffold` 和 `PluginPack` 是代理模式工具，并且仅限于当前工作区。

## 10. 准备发布

在分享包之前：

1. 使用稳定的反向域名插件 id。
2. 按语义化版本更新 `version`。
3. 将 `engines.piDesktop` 设置为你实际支持的版本。
4. 在插件 README 中记录每个命令、设置、工具输入、权限和外部服务。
5. 添加变更日志和许可证。
6. 将所有生成的 JavaScript 和资源构建到插件文件夹中。
7. 运行 `pi-plugin check` 并解决每个错误和意外警告。
8. 运行 `pi-plugin pack`，并在干净的应用状态下安装生成的包。
9. 将打印出的 SHA-256 记录在发布工件旁边。

对于官方插件市场，请将包和目录元数据提交到 [`vastsa/pi-desktop-plugins`](https://github.com/vastsa/pi-desktop-plugins)，并遵循该仓库的 `CONTRIBUTING.md`。插件市场目录是一个独立的仓库；在此处添加插件并不会发布它。

签名不是当前的信任基础。包 SHA-256 和显式权限审阅是已实现的基线；路线图细节请参阅[签名与更新规格](/zh-CN/spec/07-plugins/08-plugin-signing-updates)。

## 11. 故障排查

| 症状 | 可能原因 | 修复方法 |
|---|---|---|
| `manifest.json is missing` | 选错了目录 | 选择根目录包含 `manifest.json` 的目录 |
| `main entry missing` | `main` 指向未构建的源代码 | 先编译/打包，或更正相对路径 |
| 面板打不开 | 缺少文件、`ui.panel` 或权限 | 声明面板路径和 `ui.panel`；新授权需要重载 |
| 工作面板菜单中缺少视图 | 缺少 `ui.view`、缺少入口文件，或插件的激活范围排除了当前打开的项目 | 声明 `ui.view`，检查 `views[].entry` 是否存在，并将范围设为全局或本项目 |
| 视图显示字母方块而不是图标 | 未知的 `views[].icon` token | 使用受支持列表中的 token；`pi-plugin check` 会对未知 token 发出警告 |
| `pluginBridge` 不可用 | HTML 在普通浏览器中打开 | 在 PI-Desktop 面板内测试桥接调用 |
| 工具始终不出现 | 缺少贡献项、注册或授权 | 对齐 `agentTools`、`registerTool` 和 `agent.tool.register`；使用代理模式 |
| 技能始终不生效 | 缺少权限或元数据不明确 | 添加 `agent.prompt.inject` 以及具体的 `name`/`description` front matter |
| 保存时报告 `PERMISSION_DENIED` | manifest 扩大了权限 | 再次加载开发文件夹并审阅新授权 |
| 语法错误后热重载停止 | 损坏的插件被卸载 | 保存修正后的文件；监视器仍处于活动状态 |
| 安装包时因压缩被拒绝 | 归档是用通用 ZIP 工具制作的 | 使用 `pi-plugin pack` 重新构建 |
| MCP 服务器不启动 | transport 字段、命令、URL、设置或权限无效 | 运行 `pi-plugin check`，然后按插件 id 检查日志 |
| 服务反复重启 | `start` 抛出异常或插件进程退出 | 让 `start` 幂等，在 `stop` 中清理，并检查重启日志 |

## 12. 参考索引

- [示例插件](https://github.com/vastsa/PI-Desktop/tree/main/examples/plugins)
- [插件系统概览](/zh-CN/spec/07-plugins/01-plugin-system)
- [Manifest schema](/zh-CN/spec/07-plugins/02-plugin-manifest-schema)
- [宿主 API](/zh-CN/spec/07-plugins/03-plugin-api)
- [生命周期](/zh-CN/spec/07-plugins/05-plugin-lifecycle)
- [打包](/zh-CN/spec/07-plugins/06-plugin-packaging)
- [开发者体验](/zh-CN/spec/07-plugins/10-plugin-devex)
- [权限](/zh-CN/spec/07-plugins/13-plugin-permissions-matrix)
- [Hello 参考插件](https://github.com/vastsa/PI-Desktop/tree/main/examples/plugins/hello)
