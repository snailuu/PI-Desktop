# 03. 仓库结构

> **翻译说明：** 本页是与 [英文源规格](/spec/02-architecture/03-repo-structure) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 1. 工作区布局

两个工作区共享同一个仓库：pnpm 管理所有 JavaScript 包（`apps/*`、`packages/*`、`docs`），Cargo 管理 Rust crate。根 `package.json` 的脚本会分发到二者。

```text
PI-Desktop/
├── apps/
│ └── desktop/                # Electron 产品外壳
│   ├── electron/
│   │ ├── main/               # 主进程，每个关注点一个模块
│   │ ├── preload/            # 渲染器与插件面板的 preload
│   │ └── shared/             # 主进程与 preload 共同导入的代码
│   ├── src/                  # React 渲染器
│   │ ├── components/         # UI；settings/、workpanel/、plugins/、extensions/
│   │ ├── hooks/              # React hooks
│   │ ├── lib/                # 不依赖框架的渲染器逻辑与 IPC 客户端
│   │ ├── pages/              # 路由目标页面
│   │ ├── stores/             # zustand 应用 store
│   │ ├── styles/             # 按界面拆分的 CSS；tokens.css 是设计系统
│   │ └── assets/             # 字体与品牌素材
│   ├── test/                 # node --test 测试套件（*.test.mjs）与 helpers/
│   ├── resources/            # 打包的 extraResources：skills/、plugins/、models.dev/
│   ├── build/                # 供 electron-builder 使用的图标与 macOS entitlements
│   ├── index.html
│   ├── electron.vite.config.ts
│   └── package.json          # 同时存放 electron-builder 配置
├── crates/
│ └── host-core/              # Rust 特权宿主（二进制 pi-desktop-host-core）
│   ├── Cargo.toml
│   └── src/                  # rpc/、tools/，外加每个领域一个模块
├── packages/
│ ├── shared/                 # IPC/协议契约、错误码、变更日志
│ ├── i18n/                   # 随包发布的 UI 文案目录与 locale 辅助函数
│ ├── agent-runtime/          # pi sidecar 与运行时封装（打包进应用）
│ ├── plugin-sdk/             # 插件作者类型与校验器
│ └── plugin-devkit/          # pi-plugin CLI：scaffold、check、pack、publish
├── examples/
│ ├── plugins/                # hello 与 roundtable 示例插件
│ └── fixtures/sample-project # 用于 E2E 场景的工作区 fixture
├── docs/                     # VitePress 站点与英文唯一事实来源
│ ├── spec/                   # 编号的规格领域（见 spec/README.md）
│ ├── adr/                    # 架构决策记录
│ ├── project/                # 看板、审计、实现计划
│ ├── guide/                  # 面向用户的快速指南
│ ├── zh-CN/                  # 与 spec/ 和 guide/ 逐路径对应的中文镜像
│ ├── image/                  # 仓库 README 中嵌入的图片
│ ├── public/                 # 文档站点提供的静态资源
│ ├── scripts/                # 仅供文档使用的检查（check-locales.mjs）
│ └── .vitepress/             # 站点配置与主题
├── scripts/                  # 仓库自动化（见 scripts/README.md）
├── .github/                  # CI 与发布工作流、issue 模板
├── AGENTS.md                 # 面向 AI 编码代理的强制规则
├── package.json              # 根脚本、pnpm 工作区
├── pnpm-workspace.yaml
├── Cargo.toml                # Rust 工作区
└── README.md · README.zh-CN.md
```

## 2. 各包职责

### `apps/desktop`
产品入口：
- Electron 生命周期、窗口、托盘、应用菜单
- 渲染器与主进程之间的 IPC 接口
- host-core 与 sidecar 进程监管
- 插件运行时、面板与视图
- 打包配置

### `crates/host-core`
Rust 宿主服务：
- 工具执行
- 权限网关
- 插件宿主服务
- 持久化（SQLite、transcript、工件、密钥）
- 审计日志

### `packages/agent-runtime`
pi 之上的 Node 封装：
- 模型引导
- 代理回合控制
- 事件规范化
- 宿主工具桥接客户端

### `packages/shared`
跨边界契约：
- IPC 通道名称
- DTO 类型
- 错误码
- 协议版本管理
- 在应用中呈现的变更日志条目

### `packages/i18n`
- 英文源文案目录与随包发布的翻译文案目录
- locale 注册表与解析辅助函数
- 消息 ID 约定

### `packages/plugin-sdk`
- manifest 类型
- 宿主 API 类型
- 校验器

### `packages/plugin-devkit`
- 插件作者与插件市场发布流程所用的 `pi-plugin` CLI
- 模板脚手架、manifest 检查、打包、发布

## 3. 运行时数据（不纳入 git）

`PI_DESKTOP_DATA_DIR` 可覆盖默认位置。

```text
~/.pi-desktop/
 ├── pi.sqlite               # 单一 DB，由 host-core 拥有（03-runtime/04，D086）
 ├── sessions/               # 按会话划分的 transcript 文件（D119）
 ├── artifacts/              # 计划与目标检查点工件
 ├── attachments/            # 内容寻址的提示词附件 blob（主进程）
 ├── scratch/<sessionId>/    # 会话级临时文件
 ├── secrets/
 ├── logs/
 │    ├── app/<category>.log
 │    ├── host/<category>.log
 │    └── agent/<category>.log
 ├── cache/
 ├── plugins/
 │    ├── installed/
 │    ├── data/
 │    ├── logs/
 │    ├── cache/
 │    ├── market/             # 目录与已下载的包
 │    └── registry.json
 ├── window-state.json       # 上次主窗口边界（主进程）
 └── close-behavior.json     # 持久化的关闭到托盘选择（主进程）
```

## 4. 命名约定

| 对象 | 约定 |
|---|---|
| JS 包 | `@pi-desktop/*` |
| Rust crate | `pi-desktop-host-core`（或 `host-core`） |
| IPC 通道 | `pi-desktop/<domain>/<action>` |
| i18n 键 | `domain.section.key` |
| 插件 ID | 反向域名风格 |
| 主进程模块 | `electron/main/` 下每个关注点一个文件；由 `index.ts` 将它们串联起来 |
| 渲染器测试 | `apps/desktop/test/<subject>.test.mjs`，绝不与源码放在一起 |
