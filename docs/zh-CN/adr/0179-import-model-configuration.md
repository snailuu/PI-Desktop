# ADR 0179：从本地代理存储导入模型配置

> **翻译说明：** 本页是与 [英文源决策](/adr/0179-import-model-configuration) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-08
- 决策者：PI-Desktop 主机核心
- 相关：D007、D342、ADR 0012、
  ADR 0188、
  `04-ux/06-settings-ia.md`、`04-ux/08-component-spec.md` §18.5、
  `03-runtime/01-ipc-protocol.md`、`03-runtime/11-provider-model-system.md`

## 上下文

设置 → 导入已经可以扫描 Claude Code、Codex、OpenCode 和 Pi 会话
存储。这些工具会将供应商 URL、模型 id，以及通常还有 API 密钥保存在
众所周知的文件里。否则切换到 PI-Desktop 的用户就只能在设置 → 模型页面
重新输入那些端点。

D007 禁止自动导入 `~/.pi`，因为 `~/.pi-desktop` 归属于 PI-Desktop。对于模型
配置，这一点必须继续保持：扫描是显式操作，并且在选择导入之前不会
写入任何内容。

密钥不能跨渲染器。会话导入已经将 `filePath` 保留在主进程扫描
缓存中；模型导入也必须以同样的方式保留密钥。

这些工具提供的 OAuth/订阅授权（Codex ChatGPT 登录、Claude
订阅、OpenCode `type: oauth`）不是 PI-Desktop 的供应商账户
凭据。复制刷新 token 会是错误的安全边界。

## 决策

1. **设置 → 导入** 增加第二张卡片：模型配置，拥有自己的扫描 / 选择 / 导入所选。
   会话导入保持不变。

2. **来源**（与会话导入属于同一族）：
   - Claude Code：`~/.claude/settings.json` 加上 `settings.local.json`
     叠加（`env.ANTHROPIC_*`、`model`）
   - Codex：`~/.codex/config.toml` `[model_providers.<id>]`
   - OpenCode：`~/.config/opencode/opencode.json` `provider` 映射加上
     `~/.local/share/opencode/auth.json` API 密钥
   - Pi：`~/.pi/agent/models.json`（回退到 `~/.pi/models.json`）
   - CC Switch：`~/.cc-switch/cc-switch.db` `providers` 表（旧版
     `config.json`）。每一行的 `settings_config` 会根据应用类型进行转换。
     空的官方种子和仅含 OAuth 的行会被省略。如果实时的 Claude /
     Codex / OpenCode / Pi 文件与某个 CC Switch 端点及凭据匹配，
     则不会重复列出；若凭据不同，则仍然可见。

3. **IPC**（仅限 Electron，不进行主机协议版本升级）：
   `pi-desktop/modelConfig/importScan` 返回公开草稿
   （`source`、`externalId`、`name`、`baseUrl`、`apiStyle`、`modelIds`、
   `hasSecret`）。`importRun` 在最新扫描缓存中查找所选内容，
   并调用主机 `providers.create`。

4. **密钥。** 存储的 API 密钥、`env:` / `env_key` 解析结果，或
   `Authorization: Bearer` 头，会被复制到主机密钥存储中。
   占位值（`YOUR_API_KEY`、`${VAR}`）会被视为缺失。
   OAuth auth.json 条目，以及没有密钥的 Codex `requires_openai_auth`
   表，会被省略或在不带密钥的情况下导入。

5. **幂等性。** 如果某个候选的规范化 base URL、API 风格和
   凭据与现有供应商匹配，则跳过。不同凭据仍保持为独立的供应商
   行；凭据比较保留在 Electron 主进程中，永远不会到达渲染器。命名
   预设可以设置 `vendorKey`；自定义 URL 保持为 `custom`。ADR 0188 修订了此规则。

6. **默认模型。** 如果在该次运行中首次成功创建后，
   `settings.defaultProviderId` 为空，则该供应商及其第一个模型
   成为全局默认值。现有默认值永远不会被覆盖。

## 后果

- 从另一个本地代理切换过来时，可以同时带来转录文本以及这些转录文本
  所使用的模型，而无需将密钥粘贴到设置中。
- PI-Desktop 仍然不会静默摄取 `~/.pi`。
- 仅拥有 ChatGPT/Claude 订阅的用户仍然通过供应商账户
  登录；导入无法冒充该授权。

## 备选方案

- 首次启动时自动导入：被 D007 拒绝。
- 将密钥合并到现有同 URL 供应商中：这会覆盖一个可用的行。
  跳过更安全；用户可以编辑模型页面。
- 使用包含密钥的 IPC 负载在渲染器侧调用 `providers.create`：
  会话的扫描缓存已经存在；让密钥远离渲染器。
