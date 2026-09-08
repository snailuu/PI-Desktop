# ADR 0098：将每个供应商 OAuth 账户视为独立的供应商行

> **翻译说明：** 本页是与 [英文源决策](/adr/0098-multiple-vendor-oauth-accounts) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受实施
- 日期：2026-08-18
- 决策者：PI-Desktop 核心
- 相关：D240、ADR 0095、D027、D028、D031

## 上下文

最初的供应商账户实现使用 pi-ai 供应商 id 作为本地身份。Electron 主进程为每个供应商维护一个供应商行 id 和一个 `CredentialStore`，因此第二次登录只能复用第一个账户。渲染器还在 AI 供应商列表中显示 OAuth 行，而另一个供应商账户卡片又管理着相同的行。其退出登录操作清除了凭据，但留下了供应商行，导致这两个界面不一致。

多账户是真实需求：用户可能为同一个供应商拥有独立的个人、工作或团队订阅。账户边界也必须是安全边界，因为刷新 token 和访问 token 绝不能从一个账户串到另一个账户。

## 决策

1. **供应商行 id 就是账户身份。** 每次成功登录都会以一个新的 `authKind: "oauth"` 供应商行开始，即使另一行具有相同的 `vendorKey`。其 OAuth 凭据仅存储在
   `secret:provider:<providerId>:oauth`。
2. **每个账户获得一个作用域化的 pi-ai 集合。** Electron 主进程为每个供应商行创建一个
   `MutableModels` 实例和一个 `CredentialStore`。该存储仅在该实例内部接受内置供应商 id，并将其转换为该行特定的 secret ref。刷新序列化以行 id 为键，因此并发账户无法互相读取-修改-写入对方的 token。
3. **供应商账户拥有 OAuth 行生命周期。** 供应商账户卡片列出每个本地账户，允许重复选择供应商选择器，并通过 `providers.delete` 移除账户。因此，主机核心会一并清除该行、OAuth secret、API key secret 和 secret 元数据。缺少凭据的陈旧行会保持显示为 `Needs sign-in`，直到用户将其移除。
4. **AI 服务和供应商账户是分开的设置界面。** AI 服务列表仅包含 API key 以及自定义/无需认证服务。已连接的 OAuth 行仍可供默认模型选择器和运行时使用，但只能在供应商账户中编辑和删除。
5. **运行时绑定端到端使用供应商 id。** sidecar 绑定表仅存储会话允许的 OAuth 供应商行 id。其
   `provider.resolveAuth` 请求会根据该集合进行检查，主进程解析对应行作用域化的集合。在 sidecar 边界，供应商键从不被用作有歧义的账户查找。
6. **有歧义的子代理别名会失败关闭。** 子代理 pin 可以使用确切的供应商 id。供应商/名称别名只有在解析到唯一供应商行时才被接受；重复的供应商账户要求使用确切的行 id，而不是静默选择第一个账户。

## 后果

- 账户列表可以包含同一供应商的多行，并为重复行标记稳定序号以便扫描。
- 移除所选的默认账户会清除默认项或将其修复为第一个剩余且就绪的供应商。
- 升级后现有 OAuth 行仍可读取；下一次登录会创建新行，而不是修改现有行。
- IPC 主机协议和 SQLite schema 不需要新表或新版本。
  渲染器使用 Electron 主进程的 `providers/oauth/delete` invoke 通道，该通道委托给现有的主进程供应商删除契约。

## 备选方案

- **为每个供应商保留一个共享凭据并添加账户标签。** 已拒绝：凭据存储和 pi-ai 模型集合以供应商键为键，因此一个账户会覆盖或刷新另一个账户。
- **将 OAuth 行保留在通用 AI 服务列表中。** 已拒绝：这会让一个对象呈现两个所有者，并使删除语义不明确。
- **在移除账户时仅清除 OAuth secret。** 已拒绝：这会留下不可用的供应商行、陈旧的默认身份和具有误导性的服务条目。

## 参考

- `docs/adr/0095-vendor-account-oauth-login.md`
- `docs/spec/03-runtime/11-provider-model-system.md` §8a 和 §17
- `docs/spec/03-runtime/12-provider-config-schema.md` §3 和 §9
- `docs/spec/03-runtime/01-ipc-protocol.md` 供应商账户
- `docs/spec/04-ux/06-settings-ia.md` 模型配置
- `docs/spec/06-delivery/04-e2e-test-plan.md` E2E-151
- `apps/desktop/electron/main/oauth.ts`
- `apps/desktop/electron/main/agent-sidecar.ts`
