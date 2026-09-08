# 文档与代码一致性审计（2026-07-30）

> **翻译说明：** 本页是与 [英文源文档](/project/2026-07-30-docs-code-audit) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 范围与方法

本次审计覆盖提交 `5891920`（创建审计分支前的 `main`）下 `docs/` 目录中的每一份 Markdown 文档：共计 111 份文档。

| 领域 | 文档数 | 审查方法 |
|---|---:|---|
| 根文档与项目跟踪 | 3 | 链接、元数据、交付声明 |
| ADR | 38 | 索引覆盖、取代关系与实现引用 |
| 规格根目录 | 7 | 基线及导航一致性 |
| 产品 | 4 | 对照包/发布配置的范围与平台声明 |
| 架构 | 4 | 对照 Electron/Rust 代码的进程归属与包边界 |
| 运行时 | 17 | 协议、存储、运行时、安全与供应商契约 |
| UX | 11 | 当前组件/交互引用与实现状态声明 |
| 安全 | 2 | 渲染器、插件与更新信任边界 |
| 交付 | 7 | 构建、测试、发布与工作流契约 |
| 插件 | 15 | 清单、API、安装、隔离与插件市场契约 |
| 元 | 3 | 决策、基线引用与开放问题状态 |

本次审查结合了完整的静态扫描（相对链接、文档索引、被引用的源码路径、版本引用以及实现状态标记）与源码级检查，涉及 Electron 主进程/preload、Rust 主机核心、代理运行时、共享协议、包清单、发布工作流及测试。它并不声称静态源码契约测试等同于桌面端到端渲染测试。

## 已核实的一致性

- 所有 111 份 Markdown 文档的相对 Markdown 链接均有效。未发现损坏的内部目标。
- 已实现的核心拓扑仍与冻结架构一致：沙箱化的 Electron 渲染器、Electron 主进程/preload 桥接、通过 NDJSON JSON-RPC 通信的 Rust 主机核心，以及 Node pi sidecar。参见 `docs/spec/02-architecture/01-architecture.md` 与 `apps/desktop/electron/main/{host-process,agent-sidecar}.ts`。
- 在实现中 SQLite 所有权仅归 Rust：`Database::open_in_dir` 创建 `<data_dir>/pi.sqlite`，而 transcripts 仍以 JSONL 形式存放于 `<data_dir>/sessions/`（`crates/host-core/src/{db,transcripts}.rs`）。
- 当前的项目指令链、thinking 级别流程、上下文检查点压缩、供应商目录所有权以及会话级工作面板，均有匹配的运行时代码、ADR 与 E2E 计划条目。
- 近期的全局搜索、设置信息架构、操作系统区域设置以及项目指令变更，均由当前规格/ADR 覆盖，而不仅仅存在于源码中。

## 发现

### P0 - 插件市场插件未做能力沙箱隔离

插件市场可以下载并启用插件，而每个插件都在一个 Electron `utilityProcess` 中执行。该进程使用 Node 的 `createRequire`/动态 `import` 直接导入插件代码；因此，插件代码可以独立于代理式 `pi.*` API 使用 Node 内置模块。代理式权限检查只保护通过 `pi.*` 发起的调用，而无法保护直接的 `node:fs`、`node:child_process` 或网络访问。

证据：

- `docs/spec/07-plugins/01-plugin-system.md:185-192` 记录了独立进程，并明确承认原始 Node 内置模块仍可访问。
- `apps/desktop/electron/main/plugin-runtime.ts:159-178` 通过 `utilityProcess.fork` 以普通 Node 环境启动该进程。
- `apps/desktop/electron/main/plugin-host-process.mjs:17-20,174-196` 通过 Node 模块加载器导入任意插件入口模块。
- `docs/spec/07-plugins/01-plugin-system.md:230-234` 仍然把宿主 API 边界描述为似乎能阻止任意子进程与文件系统访问。

影响：插件市场包实际上是用户权限级别的原生代码，而非权限受限的插件。当前的 UI 与权限矩阵可能给人造成错误的安全预期。

在扩展插件市场分发之前必须解决的方案：

1. 禁用远程安装/自动启用，或者在真正实现隔离之前，明确将其呈现为不受限制的代码执行。
2. 实现能力沙箱，采用白名单运行时和操作系统级资源/进程限制，或将不受信任的插件执行迁移到单独沙箱化的进程中。
3. 添加对抗性测试，证明直接的 Node 文件系统、子进程与网络访问无法绕过已授予的权限。
4. 在新的 ADR 中记录所选定的安全边界，然后同步更新插件、安全、插件市场与验收文档。

### P1 - 清单规格远强于实际执行力度

文档化的清单契约要求 `schemaVersion: 1`、已知权限、安全的相对路径、贡献依赖以及存在的技能/面板路径。而现行验证器只要求其中一小部分字段，并对清单路径使用未经检查的 `join` 操作。

证据：

- 必需规则：`docs/spec/07-plugins/02-plugin-manifest-schema.md:119, 134-142`。
- SDK 验证只检查 object/id/name/version/main/schemaVersion：`packages/plugin-sdk/src/index.ts:141-165`。
- 宿主验证只检查非空字符串以及 `path.join` 之后的存在性：`crates/host-core/src/plugins.rs:330-357`。
- 运行时加载重复了未检查的入口 join：`apps/desktop/electron/main/plugin-runtime.ts:245-260` 与 `plugin-host-process.mjs:188-196`。

必须解决的方案：使验证器成为权威（schema 版本相等、权限白名单、semver/id 语法、禁止绝对路径或 `..` 路径、贡献依赖检查以及规范化包含关系），然后为每个被拒绝的字段添加负向测试。不要为了迎合不完整的验证器而弱化文档化的契约。

### P1 - 宿主所有权决策与实现已产生偏离

冻结基线将 Electron 主进程描述为薄编排层，并将宿主/系统能力的归属权赋予 Rust。而在实践中，Electron 主进程拥有大量特权接口：PTY 生命周期、浏览器视图、更新器、插件运行时、文件系统面板、导入器以及 sidecar 监督。

证据：

- 冻结角色：`docs/spec/00-baseline.md:50-53` 与 `docs/spec/02-architecture/01-architecture.md:31-37,61-73`。
- Electron 主进程直接导入这些服务：`apps/desktop/electron/main/index.ts:51-70`。

这是可维护性与安全边界风险，而非声称当前应用无法运行。请选择并记录一个连贯的方向：将终端/浏览器/插件宿主服务迁移到 Rust 主机核心契约之后，或者明确修订冻结边界，使 Electron 主进程成为特权桌面服务所有者，而 Rust 仅拥有所列出的持久化服务。此项选择需要 ADR，因为它改变了冻结的安全/数据边界。

### P1 - 远程插件市场完整性不是来源验证

插件市场包从远程目录获取，并使用同一目录提供的 SHA-256 值进行校验。这只能检测传输损坏，但无法在目录源被攻陷后确立发布者来源。当前实现有意不设强制签名检查。

证据：

- 远程供应商与 `curl` 获取记录于 `docs/spec/07-plugins/07-plugin-marketplace.md:27-40`。
- 代码在 `crates/host-core/src/plugins.rs:641-723,898-997` 中获取并安装插件市场包。
- 签名验证在 `docs/spec/07-plugins/08-plugin-signing-updates.md:142-156` 中仍处于计划阶段。

解决方案：在强制实施签名目录与包来源之前，保持插件市场明确标注为实验性；或者使用能够提供独立固定信任材料的包源。此问题会加剧 P0 执行边界问题。

### P2 - 插件 API、生命周期、存储与 IPC 文档混淆了目标契约与已交付契约

若干插件文档暴露了并不存在的 API 或行为，而一些当前行为也没有被准确表述。

- `pi.events.on/off` 被文档化为 MVP 事件，但在 `plugin-host-process.mjs:166-170` 中为空操作。
- 概览文档记录了 `pi.agent.invokeSkill` 与 `pi.agent.appendSystemHint`，而它们并不存在于 SDK 与宿主进程中；`packages/plugin-sdk/src/index.ts:95-118` 才是已实现的 API 表面。
- 诸如主题、入口点、`resizable`、丰富作者数据以及按工具的 timeout/权限元数据等清单字段虽有描述，但被 Rust 清单表示（`crates/host-core/src/plugins.rs:81-99`）忽略。
- 插件设置由 Electron 主进程存储在按插件划分的 `settings.json` 中（`plugin-runtime.ts:650-671`），而非存储在 `docs/spec/07-plugins/11-plugin-storage-isolation.md:61-73` 中所述的、作为推荐当前机制的宿主 `kv` 命名空间中。
- IPC 列表包含诸如重载、日志与打开数据目录等目标端点，但没有相应的共享 IPC 声明。已交付的 API 必须从 `packages/shared/src/protocol.ts` 生成，或针对其进行测试。

解决方案：将未实现的字段/API 标记为计划中，从单一 schema 生成公开的插件类型与验证逻辑，并添加契约测试，将清单/API/IPC 文档示例与已交付的 SDK 及协议进行比对。

### P2 - 产品与发布姿态在若干处已过时

- `docs/spec/01-product/01-product-scope.md:42-60,95-103` 仍将 macOS 描述为唯一必需平台，而 Windows/Linux 为计划中。基线与 electron-builder 配置却发布 macOS arm64、Windows x64 与 Linux x64 三条通道。
- `docs/spec/02-architecture/02-tech-stack.md:22-26` 称使用 pnpm 10.x，并允许通过 Node 适配器使用 SQLite。根目录 `package.json` 要求 pnpm 11.18.0，且存储由 Rust `rusqlite` 负责。
- `docs/spec/05-security/01-security.md:78-84` 声明插件仅限本地，但插件市场执行远程包安装。

本次审计中明确的元数据与索引修正在随附的文档提交中应用。平台与安全措辞必须继续跟踪上述最终信任边界决策。

### P3 - 元数据、导航与跟踪偏离

- 尽管 `00-baseline.md` 为 0.4.12，`docs/README.md`、`docs/spec/README.md` 与 `docs/spec/08-meta/open-questions.md` 仍引用了较早的基线版本。
- `docs/adr/README.md` 遗漏了已接受的 ADR 0036，尽管该 ADR 文件存在。
- `docs/project/BOARD.md` 是一份明确标注日期的历史快照，并不反映 2026-07-30 的交付状态。它应当要么作为实时看板维护，要么明确归档，改用单一当前跟踪器。
- `docs/project/README.md` 包含简体中文散文，与仓库英语优先的文档规则相悖。

## 测试与交付路径评估

源码契约测试套件相当广泛，但文档化的 E2E 计划在很大程度上仍是一份规格，只有单元/源码测试作为部分证据。该计划本身正确地将许多渲染旅程标记为草稿或手动。在宣布 M5 加固完成之前，请优先为以下内容实现真正的打包应用覆盖：

1. 渲染器/preload 权限边界；
2. 插件市场安装与禁用插件恢复；
3. 跨所有文件入口点的工作区逃逸/符号链接行为；
4. 每个已发布平台上的更新；以及
5. 并发会话/权限焦点行为。

本次审计未运行任何本地 E2E 命令，因为仓库说明禁止在未经明确请求的情况下手动触发本地 E2E 作业。

## 本次审计包含的直接文档修正

- 将过时的基线元数据更新为 0.4.12。
- 在 ADR 索引中添加 ADR 0036。
- 修正技术栈文档中所述的 pnpm 与 SQLite 所有权。
- 修正产品平台表与远程插件安全声明。
- 从项目跟踪中链接本报告，并使该索引英语优先。

## 后续门禁

不要仅通过编辑散文来关闭 P0/P1 发现项。下一项实现请求必须从插件执行/信任决策开始，更新相关 ADR 与规格，实现边界，并添加针对性的负向测试与打包应用测试。
