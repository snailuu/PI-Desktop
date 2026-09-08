# PI-Desktop 项目看板

> **翻译说明：** 本页是与 [英文源文档](/project/BOARD) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

> 历史记录。以下状态表最近一次刷新于 2026-08-11，针对 0.5.x 系列，保留用于里程碑可追溯性。
> 当前的交付状态位于 `packages/shared/src/changelog.ts` 和仓库的 GitHub Issues 中。

GitHub Projects 需要额外的 token 作用域（`project`）。
在启用之前，请通过以下方式跟踪交付：

- GitHub Issues
- 里程碑
- 本文档（看板）

## 列

| 列 | 含义 |
|---|---|
| 待办 | 已登记，尚未开始 |
| 就绪 | 可以开始实现 |
| 进行中 | 正在进行的工作 |
| 评审 | 等待验证 |
| 已完成 | 已完成 |

## 状态快照（2026-08-11）

| 里程碑 | GitHub | 本地状态 |
|---|---|---|
| M0 规格冻结 | [closed](https://github.com/vastsa/PI-Desktop/milestone/1) | 已完成 |
| M1 应用骨架 | [closed](https://github.com/vastsa/PI-Desktop/milestone/2) | 已完成 |
| M2 Pi 对话运行时 | [closed](https://github.com/vastsa/PI-Desktop/milestone/3) | 已完成 |
| M3 工作区工具 | [closed](https://github.com/vastsa/PI-Desktop/milestone/4) | 已完成 |
| M4 插件基础 | [closed](https://github.com/vastsa/PI-Desktop/milestone/5) | 已完成 |
| M5 桌面加固 | [open](https://github.com/vastsa/PI-Desktop/milestone/6) | 已完成，除公证外（受凭据限制） |
| M6 计划运行状态 | planned | 已完成（2026-08-05）；Goal 与当前扩展增量已交付 |

未关闭的 issue：
- [#6 M5: Packaging and desktop hardening](https://github.com/vastsa/PI-Desktop/issues/6)

## 泳道

### 已完成
- M0 规格冻结
- 英语优先政策
- Rust 主机核心架构决策
- 私有仓库初始化
- UX 设计系统规格（07/08/09）
- AI 开发工作流规格（03）
- E2E 测试计划规格（04）
- 变更检查清单规格（05）
- AGENTS.md 代理指令文件
- M1 应用骨架（pnpm monorepo、Electron、主机核心健康检查、i18n）
- M2 Pi 对话运行时（供应商/密钥、流式对话、会话持久化）
- M3 工作区工具（Read/Glob/Grep/Write/Edit/Bash、权限、路径沙箱）
- M4 插件基础（开发态加载、命令面板、插件工具注册）
- M5 打包：本地构建未签名 DMG（`PI-Desktop-0.1.0-arm64.dmg`），
  带自定义图标、主机二进制 + sidecar 资源；签名/公证流水线
  已脚本化（`scripts/release-macos.sh`，D078）
- M5 加固：渲染器沙箱 + 生产 CSP（D081）、带脱敏/轮转的 NDJSON 日志通道
  （D082）、崩溃监督 + 降级 UI（D080）、窗口状态持久化（D083）、应用图标（D079）
- 跨平台外壳就绪性：原生 macOS 应用菜单，以及
  Windows/Linux 无菜单的无边框标题栏、窗口控件和
  原生运行器打包配置（D118/D129）
- 对话记录存储 v7：每个会话在 `sessions/` 下对应独立 JSONL 文件，
  SQLite 缩减为索引（FTS/列表/徽标）、仅追加的修订文件、
  v7 之前的数据库通过破坏性重置归档（D119）
- 对话分支：protocol-v5 主机快照从空闲对话创建独立
  会话，同时保留工作区/运行时配置
  并重新映射对话记录标识符（D122 / ADR 0023）
- 应用更新交付：主进程持有的固定 feed、打包版 macOS 的更新发现
  与手动发布链接、带类型的渲染器状态，以及 Windows NSIS/Linux
  AppImage 应用内交付流水线（D120 / ADR 0022，由 D126 发布）
- 规格语料库 0.4.7：全面英语优先（翻译了运行时/插件/
  ADR 文档）、错误码注册表统一到 shared/errors.ts、e2e 状态
  与实际自动化同步、决策日志重构为（A–I）并附取代链、
  验收标准标注证据
- Codex 视觉一致性处理（D034–D072 系列；截图捕获套件）
- M6 Plan/Goal 运行状态实现：单代理的 Agent/Plan/Goal 转换、
  不可变的 `.pi/plan/*.md` 和 `.pi/goal/*.md` 检查点、
  带显式默认 Ask 的权限选择的批准/拒绝、重启中断不重放、
  计划合约拒绝、可选择的 shell 标识/流/超时/中止处理，
  以及英语/简体中文渲染器覆盖（E2E-104–E2E-120）

### 进行中
- Codex 视觉金标准打磨（持续由截图驱动的迭代）
- 签名/公证的 macOS 分发，以及原生 Windows/Linux 资格验证
- 更强的插件运行时沙箱与发布者签名/来源追溯路径
- 完整的 Playwright/UI 驱动 E2E 覆盖

### 阻塞（外部）
- 完整 DMG 公证 — 需要 Apple Developer 凭据；操作手册已就绪
  （[06-release-runbook](/zh-CN/spec/06-delivery/06-release-runbook)）

### 待办
- 在已交付的英语/zh-CN 语言包之外的其他语言环境

## 当前产品增量（0.5.6）

M6 检查点已完成。当前应用还包含：

- 单个 pi 代理上的 Agent / Plan / Goal 合约模式，包括 Goal 批准
  与验收标准自主执行
- 针对插件、MCP 服务器、Skills 和子代理的扩展管理，支持
  全局/项目激活范围以及插件市场
- 全局插件启动器、会话导入、定时提示词、通知、
  输入框斜杠命令、`@` 文件引用，以及剪贴板文件粘贴
- 并行有界子代理，带归属标注的对话记录行和受管理的
  用户级注册表
- 上下文检查点查看、按消息范围的评审/回滚，以及响应运行期间
  暂存的下一回合配置

## 验证快照（2026-08-05 — M6 Plan 验收）

- `cargo test -p host-core --locked` — 139/139 通过；15 个针对性 DB 测试通过
- `pnpm --filter @pi-desktop/desktop test` — 353 通过，1 个
  平台条件跳过
- `pnpm --filter @pi-desktop/agent-runtime test` — 97 通过
- `pnpm --filter @pi-desktop/shared test` — 构建 `dist` 后 114 通过
  （57 个源用例分别以源码形式和构建产物形式执行）
- `pnpm --filter @pi-desktop/i18n test` — 7 通过
- `pnpm build:js`、`pnpm typecheck`、`pnpm lint` 和
  `cargo fmt --all -- --check` — 通过
- `PI_DESKTOP_E2E_LONG_TIMEOUT=1 pnpm test:e2e:plan` — 13 通过；两个
  public-RPC fixture 跳过项有直接的确定性 Rust 覆盖
- `pnpm test:e2e:plan-ui` — 默认无密钥运行在 1280×800 和
  900×700 下 5/5 通过，实时用例被显式跳过；可选的环境变量门控实时
  用例需要 OpenAI 兼容供应商。使用模型
  `gpt-5.6-luna` 的授权运行 6/6 通过，控制台零诊断信息：真实输入框/发送、
  实时 `EnterPlanMode` → `SubmitPlan`、经 preload/Main 渲染的 Ask 批准、
  批准后精确的持久化标记、批准前后同一 `DesktopAgentRuntime` 对象的
  私有 WeakMap 证明，以及稳定的 Main/Host/sidecar PID；凭据从未进入
  CDP 或输出
- `pnpm test:e2e` — 带凭据 20/20 通过；无跳过
- `pnpm test:e2e:boot` 和 `pnpm test:e2e:supervision` — 在 Windows 上通过

## 后续升级到 GitHub Projects

```bash
gh auth refresh -s read:project,project
gh project create --owner vastsa --title "PI-Desktop Roadmap"
```
