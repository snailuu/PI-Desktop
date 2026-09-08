# ADR 0179：从本地代理存储导入模型配置

> **翻译说明：** 本页是与 [英文源决策](/adr/0179-import-model-configuration) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-08
- 决策者：PI-Desktop 核心
- 相关：D007、D342、ADR 0012、
  `04-ux/06-settings-ia.md`、`04-ux/08-component-spec.md` §18.5、
  `03-runtime/01-ipc-protocol.md`、`03-runtime/11-provider-model-system.md`

## 背景

设置 → 导入已经会扫描 Claude Code、Codex、OpenCode 和 Pi 会话存储。这些工具同样将供应商 URL、模型 id，以及通常还有 API 密钥保存在众所周知的文件中。转而使用 PI-Desktop 的用户否则就得在设置 → 模型中重新输入这些端点。

D007 禁止自动导入 `~/.pi`，以便 PI-Desktop 拥有 `~/.pi-desktop`。这一要求对模型配置必须同样成立：扫描是一项显式操作，并且在选择导入之前不会写入任何内容。

密钥不能经过渲染器。会话导入已将 `filePath` 保存在主进程扫描缓存中；模型导入必须以相同方式保存密钥。

来自这些工具的 OAuth/订阅授权（Codex ChatGPT 登录、Claude 订阅、OpenCode `type: oauth`）不是 PI-Desktop 的供应商账户凭据。复制刷新 token 会打破正确的安全边界。

## 决策

1. **设置 → 导入**新增第二张卡片：模型配置，带有自己的扫描 / 选择 / 导入所选。会话导入保持不变。

2. **来源**（与会话导入同属一个系列）：
   - Claude Code：`~/.claude/settings.json` 加上 `settings.local.json`
     叠加（`env.ANTHROPIC_*`、`model`）
   - Codex：`~/.codex/config.toml` 中的 `[model_providers.<id>]`
   - OpenCode：`~/.config/opencode/opencode.json` 中的 `provider` 映射加上
     `~/.local/share/opencode/auth.json` 中的 API 密钥
   - Pi：`~/.pi/agent/models.json`（回退到 `~/.pi/models.json`）
   - CC Switch：`~/.cc-switch/cc-switch.db` 的 `providers` 表（旧版
     `config.json`）。每一行的 `settings_config` 按应用类型转换。
     空的官方种子行和仅含 OAuth 的行会被省略。与 CC Switch 端点匹配的
     实时 Claude / Codex / OpenCode / Pi 文件不会被重复列出。

3. **IPC**（仅 Electron，不提升主机协议版本）：
   `pi-desktop/modelConfig/importScan` 返回公开草稿
   （`source`、`externalId`、`name`、`baseUrl`、`apiStyle`、`modelIds`、
   `hasSecret`）。`importRun` 在最新的扫描缓存中查找所选内容，并调用主机
   `providers.create`。

4. **密钥。** 已存储的 API 密钥、`env:` / `env_key` 解析结果，或
   `Authorization: Bearer` 请求头会被复制到主机密钥存储。占位值
   （`YOUR_API_KEY`、`${VAR}`）视为缺失。OAuth 的 auth.json 条目以及没有
   密钥的 Codex `requires_openai_auth` 表会被省略，或者不带密钥导入。

5. **幂等性。** 规范化 base URL 和 API 风格与现有供应商匹配的候选项会被跳过。
   具名预设可以设置 `vendorKey`；自定义 URL 保持为 `custom`。

6. **默认模型。** 如果在该次运行中首次成功创建后 `settings.defaultProviderId`
   为空，则该供应商及其第一个模型成为全局默认。现有默认值绝不会被覆盖。

## 后果

- 从另一个本地代理切换时，可以同时带来对话记录以及这些对话记录使用过的模型，
  无需将密钥粘贴到设置中。
- PI-Desktop 仍然不会静默摄取 `~/.pi`。
- 仅有 ChatGPT/Claude 订阅的用户仍需通过供应商账户登录；导入无法冒充该授权。

## 备选方案

- 首次启动时自动导入：被 D007 拒绝。
- 将密钥合并到现有的同 URL 供应商：会覆盖正常工作的条目。跳过更安全；
  用户可以编辑模型页面。
- 在渲染器侧执行 `providers.create`，并将密钥放在 IPC 载荷中：会话的扫描缓存
  已经存在；应让密钥远离渲染器。
