# ADR 0095：使用供应商账号登录，而不是粘贴 API key

> **翻译说明：** 本页是与 [英文源决策](/adr/0095-vendor-account-oauth-login) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受，待实现
- 日期：2026-08-18
- 决策者：PI-Desktop 核心团队
- 相关：D237、D240、ADR 0098、D028、D031、ADR 0012、ADR 0020、ADR 0027

## 上下文

供应商行此前只能通过一种方式完成认证：用户粘贴一个 API key，host-core 将其加密存储在 `secret:provider:<id>:api_key` 下，Electron 主进程在每次启动时读回明文，以便 sidecar 用恒定的 `{ auth: { apiKey } }` 为请求签名。那些已经为供应商订阅付费的用户——Claude Pro/Max、ChatGPT Plus/Pro、GitHub Copilot——必须另行购买 API 额度才能使用 PI-Desktop。

`@earendil-works/pi-ai` 已经在协议侧提供了所需的一切：七个 OAuth 流程、一个 `CredentialStore` 契约，以及带锁的 token 刷新。它没有提供的是宿主那一半——它自己的 `auth/types.d.ts` 写道：“应用在登录后通过 `modify(...)` 持久化凭据。登录/登出的编排由应用负责。”PI-Desktop 此前没有这一半。

有两个特性使这件事远不止是增加一个设置字段。供应商的访问 token 大约一小时就过期，因此在启动时解析一次的凭据会在会话中途失效。而刷新 token 比 API key 危险得多：它按需铸造新凭据，所以既有的“读取密钥并在启动时交给 sidecar”的模式对它而言并不可接受。

## 决策

1. **凭据是同一个供应商行上的第二个密钥。** OAuth 凭据序列化为 JSON，并通过现有的加密密钥存储保存在 `secret:provider:<id>:oauth` 下，与 `secret:provider:<id>:api_key` 并存——绝不取而代之。`has_secret` 的含义扩展为“持有任何一种凭据”，因此渲染器中的每一项就绪检查都无需改动即可继续工作；新增的 `has_oauth` 用于区分二者，以便显示徽章以及隐藏 key 输入框。`auth_kind` 增加了取值 `oauth`；它原本就是自由字符串，因此主机协议版本和存储 schema 都无需变更。

2. **登录编排位于 Electron 主进程的 `oauth.ts` 中。** 它基于 host-core 的 `secrets.*` RPC 实现 `CredentialStore`，按供应商串行化 `modify`，从而满足 pi-ai 的带锁刷新假设，并通过五个新的 invoke 通道和一个事件通道把 pi-ai 的 `AuthInteraction` 桥接到渲染器事件，通道均位于 `pi-desktop/providers/oauth/*` 之下。浏览器回调、设备码、选择和粘贴验证码这些步骤都是同一个事件流，因此渲染器渲染的是供应商所要求的内容，而不是针对每个供应商的定制脚本；取消操作会中止本地回调服务器或轮询循环。

3. **供应商列表是推导出来的，而非逐项枚举。** 卡片来自 `models.getProviders().filter(p => p.auth.oauth)`，因此七个供应商在第一天就全部支持，而某个供应商在 pi-ai 中新增或移除某个流程时，此处无需任何改动。由于 `auth/oauth/load.js` 通过带变量说明符的动态 import 加载流程——这是一条 electron-vite 无法打包的路径——主进程在启动时调用一次 `registerBunOAuthFlows()` 以静态注册它们。

4. **sidecar 按请求解析认证，并且永远看不到刷新 token。** OAuth 行的启动载荷携带 `apiKey: ""`。运行时注入一个 `resolveAuth` 回调，它调用新的 host-proxy 方法 `provider.resolveAuth`，该方法由主进程自行应答，绝不转发给 host-core；主进程依据它在每次启动时都会重写的绑定表校验 `(sessionId, providerId)` 对，并拒绝其他任何请求。回复是短时效的 `ModelAuth`——包含 `apiKey`、`headers`、`baseUrl`——pi-ai 会直接透传，因此 Copilot 的按账号端点与 Kimi 的仅 header 认证都无需特殊处理。pi-ai 在每次 stream 时都会调用 `getAuth` 且不缓存任何内容，只在过期之后于存储锁保护下刷新，因此这一方案既正确又开销很低。

5. **供应商行的身份在不同回合之间保持稳定。** `matches()` 比较的是供应商行，其 `apiKey` 恒为 `""`；每次启动新生成的 `resolveAuth` 闭包是一个函数属性，会在 `JSON.stringify` 中消失。因此 OAuth 会话会复用其已预热的 runtime，而不是每一小时或每一个回合都重建一次。

6. **模型发现与连接测试都通过账号进行。** 对于 OAuth 行，`providers.listModels` 读取的是已认证的目录（`models.getAvailable`，它会应用供应商自己的 `filterModels`，因此 Copilot 展示的是订阅实际包含的内容），而不是用它并不拥有的 key 去探测 `/models`；连接测试则通过解析认证来验证账号。登录会在行配置中存储一个非机密的账号标签，并根据所选模型决定该行的 `apiStyle`——一个供应商可能横跨多种线上 API。原先“每个供应商一行”的假设已由 ADR 0098 修订：现在每次登录都会创建独立的行和凭据作用域。为此新增了两种 style：`openai_codex_responses` 和 `pi_messages`。

## 后果

- 订阅用户可以从设置 → 模型配置登录并正常选择模型；七个受支持的供应商都不再需要单独的 API 额度。
- 权限边界是收紧而非放宽。此前 sidecar 无条件获得长期有效的 API key；对于供应商行，它现在只会获得一个可撤销、约一小时有效的 token，仅对应其会话所绑定的那一个供应商，并且完全不会获得刷新 token。
- 供应商登录依赖主进程存活以应答 `provider.resolveAuth`；回合进行中宿主进程或主进程重启会使该请求失败，而不是用过期 token 完成签名——这正是期望的失败方向。
- API key 行完全不受影响：相同的存储、相同的启动载荷、相同的解析路径。两类凭据仍处于同一个供应商存储域中；每个 OAuth 账号拥有自己的供应商行和 secret 引用（ADR 0098）。

## 备选方案

- **在启动时解析一次凭据并放入载荷。** 已否决：Codex token 约一小时过期，因此长会话会在回合中途中断；刷新会改变载荷，使 `matches()` 在每个回合都不匹配，从而重建 runtime 并丢弃预热状态；而且这会把一个用户从未输入过的 token 放进一个执行模型指令代码的进程中。
- **把凭据存储交给 sidecar，让 pi-ai 在进程内刷新。** 已否决：这会把刷新 token——那个持久密钥——交给最不受信任的进程，并且违背现有的 host-proxy 白名单规则，即 sidecar 不得拉取密钥或修改配置。
- **将 OAuth 凭据存入新的专用表或文件。** 已否决：加密密钥存储已经提供了所需的全部保证，而第二个后端还需要自己的生命周期、删除路径和审计。
- **先只支持两三个供应商。** 已否决：列表是从 pi-ai 的目录推导出来的，因此限制它就意味着要编写一份硬编码白名单——代码更多而覆盖更少。

## 参考资料

- `docs/spec/03-runtime/11-provider-model-system.md`
- `docs/spec/03-runtime/12-provider-config-schema.md`
- `docs/spec/03-runtime/14-secrets-storage.md`
- `docs/spec/03-runtime/01-ipc-protocol.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- `apps/desktop/electron/main/oauth.ts`, `apps/desktop/electron/main/agent-sidecar.ts`
- `packages/agent-runtime/src/provider-binding.ts`
- `crates/host-core/src/secrets.rs`, `crates/host-core/src/providers.rs`
- 决策 D237、D028、D031
