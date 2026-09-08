# 11. 供应商与模型系统

> **翻译说明：** 本页是与 [英文源规格](/spec/03-runtime/11-provider-model-system) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 1. 目标

PI-Desktop 必须支持用户常用的**所有主流市场模型供应商与模型**，而不是把一份很小的允许列表硬编码为产品上限。

策略：

> **通过 models.dev 模型元数据 + pi-ai 传输适配器 + OpenAI 兼容逃生通道，实现通用供应商覆盖。**

我们**不**自行重新实现每个供应商的 SDK。
我们统一采用 pi 的多供应商层，并在产品层面增加配置、目录和 UX。

## 2. 覆盖原则

### 必须支持
1. 第一方主流供应商
2. 热门聚合器 / 网关
3. 任何 OpenAI 兼容端点
4. 用户自定义供应商
5. 持续刷新模型目录

### 产品承诺
- 用户可以通过以下方式连接几乎所有主流供应商/模型：
  - pi 原生供应商集成
  - OpenAI 兼容 API
  - 自定义供应商定义

### 明确的非承诺
- 在没有适配器的情况下保证每个冷门供应商的专有非标准协议都能用
- 永远在离线状态下提供无需目录更新的完整全球模型矩阵

## 3. 架构

```text
Settings / UI
  → ProviderConfigStore (Rust host DB)
  → AgentRuntime (Node/pi)
      ├─ built-in vendor providers (via pi-ai)
      ├─ openai-compatible provider
      └─ custom provider definitions
  → ModelCatalogService
      ├─ models.dev snapshot (sole model metadata source)
      ├─ runtime/provider discovery (IDs only for custom/dynamic models)
      └─ Rust-owned provider cache
```

## 4. 供应商类型

| type | 描述 | 示例 |
|---|---|---|
| `native` | 通过 pi-ai 提供的一等供应商集成 | openai、anthropic、google、bedrock、mistral 等 |
| `openai_compatible` | 任何 OpenAI Chat Completions/Responses 兼容网关 | OpenRouter、Together、Groq、Fireworks、DeepSeek、本地网关、企业代理 |
| `custom` | 基于已知协议配置文件的用户自定义供应商 | 私有部署、区域网关 |

协议配置（MVP）：

1. `openai`
2. `anthropic`
3. `google`
4. `openai_compatible`
5. `bedrock`（若运行时支持启用）
6. `custom_http`（后续高级/实验性）

OpenCode Go 作为名为 `opencode_go` 的 API 风格预设暴露。它仍处于 `openai_compatible` 供应商路径内：该预设将端点固定为 `https://opencode.ai/zen/go/v1`，使用 Bearer API key 认证，从 `/models` 发现模型，并通过 pi-ai 的 OpenAI Chat Completions 适配器发送聊天回合。它不会创建第二条传输通道，也不会形成封闭的模型允许列表。代理运行时会在每个 LLM 请求（会话回合、子代理、提示词增强和插件一次性调用）上注入 OpenCode 路由标头：`x-opencode-session` 是持久的对话 id（当调用方没有会话时则为每次调用生成的 UUID），`x-opencode-client` 为 `pi-desktop`，并且 `User-Agent` 为 `pi-desktop/<APP_VERSION>`，除非该行设置了 `headers["User-Agent"]`。基 URL 主机为 `opencode.ai` 的自定义 OpenAI 兼容行会收到相同的标头。不依赖 pi-ai 发出 `x-opencode-session`。每个供应商行（AI 服务或 OAuth 账户）都可以设置可选的 `headers`；留空则保留适配器默认值。fetch 包装器是最后写入者，因此 Codex 和 Anthropic 无法覆盖它们。

当 OAuth 供应商围绕本地供应商行 id 重建时，运行时会保留原生 pi-ai 传输元数据，而不是将该行当作通用 OpenAI 端点处理。GitHub Copilot 请求会保留所固定模型的 IDE 身份标头，包括 `Editor-Version`、`Editor-Plugin-Version` 和 `Copilot-Integration-Id`；代理运行时会添加上下文相关的 `X-Initiator`、`Openai-Intent` 和图像请求标头。本地行 id 仍然负责认证绑定和记录身份，用户提供的供应商标头仍然是最终覆盖。

Zhipu / GLM 和 Z.AI 是 models.dev 支持的第一方供应商短名单（包括 Xiaomi）中命名的 OpenAI 兼容端点预设。添加供应商的服务选择器会持久化匹配的 models.dev `vendorKey`，并在命名服务路径上使用已发布的端点，而不显示名称、Base URL 或 API 格式。聊天回合仍然使用所选的 pi-ai 适配器（`chat_completions`、`responses`、`anthropic_messages`、`google_generative_ai` 或 `opencode_go`）。Zhipu / Z.AI Completions 请求使用 `thinkingFormat: "zai"` 和 `zaiToolStream: true`。

## 5. 内置供应商矩阵（发布意图）

> 模型元数据遵循内置/内存中的 models.dev 目录。供应商适配器仍然通过 pi-ai 可用，并且 OpenAI 兼容路径始终对 models.dev 未列出的模型保持开放。

### Tier A — 始终在 UI 中暴露
- OpenAI
- Anthropic
- Google Gemini
- OpenAI-Compatible（通用）

### Tier B — 当运行时支持时暴露 / 若 pi-ai 中存在则默认启用
- AWS Bedrock
- Azure OpenAI / OpenAI on Azure
- Mistral
- xAI
- DeepSeek
- Groq
- Together
- Fireworks
- Cohere
- Perplexity
- OpenRouter
- Moonshot / Kimi
- Zhipu / GLM
- MiniMax
- Baichuan
- Qwen / DashScope
- 01.AI / Yi
- SiliconFlow
- NVIDIA NIM
- Ollama（本地）
- LM Studio（本地 OpenAI 兼容）
- vLLM / TGI / LocalAI / LiteLLM 网关（通过 OpenAI 兼容）

### Tier C — 用户自定义
任何未列出但可通过以下方式访问的供应商：
- OpenAI 兼容 base URL
- 自定义标头
- 自定义认证方案

## 6. 模型支持政策

### 6.1 无硬性模型允许列表上限
PI-Desktop 不得永久将用户限制在很短的固定模型列表中。

### 6.2 目录职责
1. **models.dev**（`https://models.dev/api.json`）是唯一的模型元数据来源。Electron 主进程在开发环境中读取检入的发布资源 `apps/desktop/resources/models.dev/api.json`，在发布构建中读取打包后的 `resources/models.dev/api.json` 路径。它绝不会将供应商凭据发送到目录。
2. 检入的快照在创建发布标签之前由 `scripts/release.mjs` 刷新。在运行时，设置 → 模型配置可以显式重新获取 `https://models.dev/api.json`；成功的响应仅替换当前进程的内存目录。获取失败时保留最后一个有效的内存目录，并且绝不写入用户数据。
3. **运行时/供应商发现**以及 Rust 拥有的缓存为自定义、本地或已认证的账户特定端点提供模型 ID。供应商匹配接受配置的 vendor key、规范化后的 API URL、models.dev provider 身份，以及带供应商前缀的 ID（如 `deepseek/deepseek-v4`）；仅当供应商身份无歧义时，不带目录前缀的供应商模型 ID 才会匹配到无前缀的确切后缀。原生适配器键可以使用目录别名——例如 pi-ai 的 `openai-codex` ChatGPT 订阅适配器通过 `openai` 记录解析模型元数据——同时该适配器保留自己的传输身份。它们不能虚构或替换模型元数据。当配置的自由格式 ID 不在 models.dev 中时，它仍可与通用的纯文本、非推理基线一起选择。对于目录尚不了解的端点，设置仍允许显式覆盖 thinking level。
4. models.dev 记录将 `id`、`name`、`description`、`family`、`attachment`、`reasoning`、`reasoning_options`、`tool_call`、`structured_output`、`temperature`、`knowledge`、`release_date`、`last_updated`、`modalities.input/output`、`open_weights`、`limit.context/input/output`、`cost`、`interleaved`、`status`、`experimental` 和 `provider` 映射到共享模型界面。
5. pi-ai 仍只是请求/OAuth 实现层。其内置模型目录和模型能力函数不会被读取用于名称、限制、定价、模态或其他模型配置。
6. 输入和输出模态数组保留 `text`、`image`、`audio`、`video` 和 `pdf`。文本代理选择器暴露能够处理文本的模型，同时在文件中保留所有原始记录以供未来界面使用。仅当模型接受图像输入时，图像输入才会作为瞬态图像内容块发送。PDF 能力会被呈现并保留在模型元数据中；由于 pi-ai 0.85 没有原生 PDF 内容块，PDF 附件仍然是有界文件引用，而不会被错误地编码为图像。
7. 用户编辑的 `ModelBinding` 值仍然是显式的供应商配置：它们控制所选的请求限制、启用的 thinking levels、应用于新主页草稿和新持久化会话的默认 thinking level（限制到已启用集合；仅当默认值未设置时使用最强已启用级别），以及附件能力覆盖。`models.dev` 提供已发布元数据，并为新添加的已知模型填充初始 thinking 选择；对于用户为端点显式启用的级别，它不是运行时门槛。为兼容起见，仍包含旧版通用 `128,000` 上下文种子的绑定会跟随新发布的 `limit.context`；非默认的高级值保持显式。这使目录刷新后 sidecar 和 context inspector 处于相同的有效窗口。
8. 设置会为每个绑定渲染七个规范 thinking levels。已发布的级别会为已知推理模型预先选中。非推理或未知模型显示相同的选项但未选中，并附带简短的手动覆盖说明。`defaultThinkingLevel` 从该绑定启用的级别中选择，因此存储的默认值始终属于显式集合。
9. `supportsImages` 和 `supportsDocuments` 是三态覆盖。缺失或 `null` 时遵循 models.dev 已发布的模态，因此目录更正仍能传达到已保存的绑定；`true` 或 `false` 是用户的显式回答，并在目录变化后保留。与 thinking levels 不同，这些覆盖不会被收窄到已发布的能力，因为代理或自托管端点通常会接受其目录条目中省略的输入。启用图像输入会开启瞬态图像内容块；启用 PDF 输入会记录能力，但不会改变编码方式，因为 pi-ai 0.85 没有 PDF 内容块，PDF 仍然是有界文件引用。
10. 设置复选框会针对已发布基线显示有效答案，将某一项设回已发布值会存储“跟随目录”，而不是等值的覆盖。因此，与 models.dev 保持一致就是重置，不需要单独的重置控件或按能力说明文案。
11. `ModelInfo` 是设置界面用于比较的已发布记录，因此存储的绑定不得影响其能力或推理字段。有效限制、推理和 thinking levels 通过精确绑定解析；有效传输模态数组还会额外应用显式附件覆盖。
12. 用户已配置的模型即使实时发现不再列出它，也会保留其已发布记录，因此其能力仍然可见且可编辑。只会重新添加已存在于供应商 `models` 中的 id，绝不会重新添加整个目录，并且只有发现实际返回的行才会写入模型缓存。

### 6.3 要覆盖的模型家族
目录和自定义模型条目必须支持常见能力类别：

- 文本聊天 / 编码模型
- 推理 / 思考模型
- 长上下文模型
- 视觉 / 多模态输入模型
- 支持工具调用的模型
- 支持 JSON/结构化输出的模型（在供应商支持的情况下）

## 7. 配置 schema

```ts
type ProviderAuthKind =
  | "api_key"
  | "api_key_and_base_url"
  | "bearer"
  | "azure_api_key"
  | "aws_sdk_default"
  | "custom_headers"
  | "oauth" // vendor subscription account, credential owned by Electron main
  | "none" // local no-auth

type ProviderConfig = {
  id: string                    // uuid/ulid
  name: string                  // display name
  vendorKey: string             // openai/anthropic/google/openrouter/custom/...
  type: "native" | "openai_compatible" | "custom"
  protocol: "openai" | "anthropic" | "google" | "openai_compatible" | "bedrock" | "custom_http"
  enabled: boolean
  baseUrl?: string
  authKind: ProviderAuthKind
  secretRef?: string            // pointer into secret store
  headers?: Record<string, string> // optional outbound headers; empty keeps adapter defaults
  apiStyle?:
    | "chat_completions"
    | "opencode_go"
    | "responses"
    | "anthropic_messages"
    | "google_generative_ai"
    | "openai_codex_responses" // vendor account only
    | "pi_messages"            // vendor account only
    | "auto"
  compatibility?: {
    supportsTools?: boolean
    supportsVision?: boolean
    supportsStreaming?: boolean
    supportsReasoning?: boolean
    supportedThinkingLevels?: ThinkingLevel[]
  }
  defaultModelId?: string
  models: ModelBinding[]        // selected models and per-model settings
  createdAt: string
  updatedAt: string
}

type UserModelConfig = {
  id: string                    // provider-local model id/slug
  displayName: string
  providerId: string
  contextWindow?: number
  maxOutputTokens?: number
  capabilities?: Array<"text" | "tools" | "vision" | "reasoning" | "json">
  pricingHint?: string
  hidden?: boolean
}

type ModelBinding = {
  id: string
  contextWindow: number
  maxTokens: number
  thinkingLevels: ThinkingLevel[]
  defaultThinkingLevel: ThinkingLevel | null
  availableForSubagents?: boolean // opt-in for AI-driven delegation
}

type SelectedModelRef = {
  providerId: string
  modelId: string
}

type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max"
```

上面的 compatibility 字段作为面向旧客户端的持久化 schema 兼容面保留。PI-Desktop 不再将它们读取为运行时模型覆盖。`ModelInfo` 的推理支持和受支持的 thinking levels 描述解析后的 models.dev 记录；有效的供应商/会话能力来自精确的 `ModelBinding`。未知的自由格式 id 从通用形态开始，并且不推断推理能力，但显式绑定可以选择加入某些级别。

供应商对话框会为每个选中的模型持久化一个 `ModelBinding`。第一个绑定是当前对话和旧版运行时消费者的有效模型。对话级模型切换以及跨数组路由仍属于未来工作。仅含 `defaultModelId` 的旧版供应商在宿主读取时会被具体化为一个回退绑定，并在下一次供应商写入时升级为 `models`。

`ModelBinding.availableForSubagents`（布尔值，默认 false）：选择加入标志，使该模型可用于 AI 驱动的子代理委派。启用后，该模型会出现在注入到父代理系统提示词中的委派目录中。父代理随后可以通过 Task 工具的 `model` 参数选择它。

## 8. 密钥

- API keys 通过安全存储（`SECRET_*` API）存储
- 供应商配置仅存储 `secretRef` / hasSecret 布尔值
- 渲染器在列表 API 中永远不会收到原始 key
- 可选的 key 验证调用：`providers.testConnection`
- 供应商账户行存储 OAuth 授权而不是 key；`hasSecret` 覆盖任一凭据，`hasOauth` 区分它们（§8a）

## 8a. 供应商账户（OAuth）供应商

供应商行可以通过供应商订阅——Claude Pro/Max、ChatGPT Plus/Pro、Copilot 以及 pi-ai 的其他 OAuth 供应商——而不是粘贴的 key 进行认证（ADR 0095、D237、D240）。所提供的供应商来源于 `models.getProviders().filter(p => p.auth.oauth)`，因此该列表跟随固定版本，而不是硬编码表；并且 `registerBunOAuthFlows()` 在启动时运行一次，因为 pi-ai 通过 electron-vite 无法打包的动态导入来加载流程。

Electron 主进程拥有登录对话和凭据；渲染器只会看到事件和非密钥账户标签。每次登录都会创建一个带有 `authKind: "oauth"` 的新供应商行；即使多个行共享同一个 `vendorKey`，行 id 也是账户身份。Electron 主进程为每一行创建一个 pi-ai 模型集合和一个 `CredentialStore` 作用域，将供应商 id 映射到 `secret:provider:<rowId>:oauth`。然后它从该账户自己的目录中填充 `baseUrl`、`apiStyle` 和 `defaultModelId`。供应商目录响应会将每个本地行都作为账户包含在内，包括已断开/孤立行，以便用户可以显式移除它们。

请求认证是**按请求**解析的，而不是在启动时解析：

```text
sidecar request
  → runtime provider binding (`resolveAuth` injected at launch)
  → host-proxy `provider.resolveAuth` { sessionId, providerId }
  → Electron main (answered locally, never forwarded to host-core)
      · binding table check → PROVIDER_NOT_BOUND on a mismatch
      · row-scoped pi-ai `models.getAuth(vendorKey)` → refresh under that row's lock only if expired
  → short-lived ModelAuth { apiKey?, headers?, baseUrl? }
```

值得说明的两个后果：供应商访问 token 的有效期约为一个小时，因此不得在载荷或运行时中缓存任何内容；并且由于该行的 `apiKey` 始终保持为 `""`，而注入的解析器是一个函数，运行时身份（`matches()`）是稳定的，因此 OAuth 会话会在各回合之间复用其已预热的运行时，而不是重新构建它。因此 sidecar 从不持有刷新 token，并且仅为其会话所绑定的供应商持有访问 token。

此类行的模型发现读取已认证的目录（`models.getAvailable`，它会应用供应商自己的 `filterModels`），而不是探测 `/models`；连接测试通过解析认证来证明账户有效。对于静态 OAuth 供应商（如 ChatGPT Plus/Pro（`openai-codex`）），该目录是固定的 pi-ai 模型列表，而不是实时的供应商 `/models` 探测，因此新发布的账户模型（如 `gpt-6-astra`）只有在固定版本包含它之后才会出现。一旦 ID 可用，models.dev 仍会提供元数据，但它无法将该 ID 添加到已认证列表中。一个供应商可能横跨多种线上 API——Copilot 提供 Anthropic、Chat Completions 和 Responses 模型——因此该行的 `apiStyle` 跟随所选模型。删除行会调用正常的宿主 `providers.delete` 路径，该路径会移除其 OAuth 密钥和元数据；它绝不会注销或删除具有相同 vendor key 的另一行。

## 9. 模型目录服务

```ts
interface ModelCatalogService {
  listProviders(): Promise<ProviderDescriptor[]>
  listModels(filter?: ModelQuery): Promise<ModelDescriptor[]>
  refreshCatalog(options?: { providerId?: string }): Promise<RefreshResult>
  resolveModel(ref: SelectedModelRef): Promise<ResolvedModel>
  upsertUserModel(model: UserModelConfig): Promise<void>
}
```

### ModelDescriptor

```ts
type ModelDescriptor = {
  providerId: string
  vendorKey: string
  modelId: string
  displayName: string
  source: "bundled" | "discovered" | "user"
  catalogSource?: "models.dev"
  capabilities: Array<"text" | "tools" | "vision" | "reasoning" | "json">
  contextWindow?: number
  maxOutputTokens?: number
  deprecated?: boolean
  tags?: string[]
  supportedThinkingLevels?: ThinkingLevel[]
}
```

## 10. UI 要求

### 设置 → 代理 → 供应商
- 快速添加内置供应商
- 添加 OpenAI 兼容端点
- 添加自定义供应商
- 编辑 base URL/标头
- 设置/替换/删除 key
- 在高级选项中设置可选的自定义标头（留空则保留适配器默认值）；复制与持久化相同的规范化 JSON
- 登录 / 退出供应商账户，并查看某一行使用的是哪个账户
- 编辑供应商账户的非密钥标签、自定义标头和默认模型
- 启用/禁用供应商
- 测试连接
- 选择多个模型，并编辑每个绑定的上下文窗口、输出限制和启用的 thinking levels；目录元数据为 API 供应商和已登录供应商账户提供初始值。选择器始终暴露七个规范级别：已发布级别为已知模型提供种子值，而任何显式选择都会为代理或新发布的模型保留。两个界面都通过同一个选择器呈现，因此供应商账户编辑器提供与 API 供应商编辑器相同的按绑定编辑
- 默认保持模型卡片紧凑，按需展开元数据/配置，并将对话框操作放在可独立滚动内容之外
- 不要暴露原始目录兼容性内部信息或供应商密钥
- 设置 → 导入可以从 Claude Code、Codex、OpenCode、Pi 和 CC Switch 复制供应商/模型行。扫描是显式的。存储的 API keys 会被复制到宿主密钥存储中；OAuth/订阅授权则不会。等效供应商（规范化 URL + API 风格 + 相同凭据）在重新导入时会被跳过。同一端点上的不同凭据仍为独立供应商。无协议或 schema 版本号变更（D342 / ADR 0179 / ADR 0188）。

### 模型选择器
- 跨已启用供应商搜索所有模型
- 按供应商/vendor 分组
- 显示能力徽章（工具/视觉/推理）
- 允许“刷新模型”
- 允许输入自定义模型 id

### 空/错误状态
- 未配置供应商
- 缺少 key
- 未找到模型
- 供应商未授权
- 目录刷新失败（仍允许手动输入模型 id）

## 11. 运行时解析算法

当以 `(providerId, modelId)` 开始一个回合时：

1. 从宿主加载供应商配置
2. 如果缺失/已禁用 → 失败（`MODEL_NOT_CONFIGURED`；保留详情：`PROVIDER_DISABLED`）
3. 解析凭据：对于带 key 的行，通过 `secretRef` 读取密钥（绝不记录它；缺失 → `PROVIDER_SECRET_MISSING`）；对于 `oauth` 行，完全跳过此步骤并以空 key 启动，因为认证是按请求解析的（§8a）
4. 通过匹配的供应商 key/API URL 和精确模型 id 解析 models.dev 记录
5. 将其完整模型配置——名称、描述、家族、附件/推理/工具/结构化输出/温度标志、知识和发布日期、输入/输出模态、权重、状态、交错、限制、成本数据以及 thinking 选项——复制到运行时模型快照中；当不存在时，使用通用的纯文本、非推理形态
6. 从 models.dev `modalities.input` 推导视觉传输；供应商发现/缓存声明不能提升未解析的模型，而显式的附件绑定覆盖可以
7. 将会话 thinking level 限制到精确绑定所启用的级别，并通过仅替换供应商/模型身份、所选 API 适配器、认证和显式配置的端点 URL 来构建运行时供应商适配器。对于 `anthropic_messages`，运行时会从该 URL 中移除末尾的 `/v1`，再将其传递给 pi-ai，因为 Anthropic SDK 自身会追加 `/v1`；因此带或不带 `/v1` 的配置根路径都会到达相同的 `/v1/messages` 路由。
8. 使用中止句柄和独立的回答/thinking 事件执行流
9. 将供应商错误转换为共享的 `AppError` 代码（§15）

如果模型不在 models.dev 中，只要用户显式输入模型 id 且供应商接受未知 id，仍允许使用它。缓存/供应商能力字段不会将该回退提升为已知的运行时模型。

## 12. 兼容性层级

| 层级 | 含义 |
|---|---|
| full | 已验证/预期支持工具 + 流式 + 视觉 |
| standard | 预期支持聊天流式 |
| limited | 通过兼容网关尽力支持 |
| unknown | 用户自定义，无保证 |

UI 可以显示层级提示，但默认不得硬性阻止未知模型。

## 13. 刷新与更新政策

1. Electron 主进程在提供模型元数据之前读取捆绑的发布资源：开发环境中为 `apps/desktop/resources/models.dev/api.json`，打包构建中为 `resources/models.dev/api.json`。
2. `scripts/release.mjs` 获取 `https://models.dev/api.json`，验证它，并在创建发布标签之前原子地替换检入的资源。
3. 设置 → 模型配置可以随时强制远程刷新；成功的响应仅更新当前进程的内存目录。
4. 供应商端点发现仅为核心内置/内存 models.dev 快照中缺失的模型提供 ID；未知 ID 使用通用元数据。
5. 刷新失败不得清除捆绑文件、Rust 拥有的供应商缓存或已配置的绑定。

## 14. 本地 / 离线模型支持

通过 OpenAI 兼容本地服务器支持：

- Ollama（若 pi 原生支持则原生，否则使用 OpenAI 兼容代理）
- LM Studio
- vLLM / TGI / LocalAI / LiteLLM 代理
- 其他本地网关

要求：

- 自定义 base URL
- 认证可以为 `none`
- 始终可用手动模型 id 输入
- 目录刷新在可用时可以使用 `/models`；否则使用用户定义的模型

## 15. 故障分类（供应商域）

规范代码位于 [08-error-codes](/zh-CN/spec/03-runtime/08-error-codes)；保留的详情代码会映射到规范父代码，直到被发出（该文档的 §3.7）。

| code | 状态 | 含义 | 面向用户的指引 |
|---|---|---|---|
| `PROVIDER_UNAUTHORIZED` | 已生效 | key 无效/过期或认证被拒绝 | 重新输入密钥 / 检查账户 |
| `PROVIDER_RATE_LIMITED` | 已生效 | 429 / 配额 | 稍后重试 / 切换模型 |
| `PROVIDER_SECRET_MISSING` | 已生效 | 已启用供应商但无密钥 | 完成设置 |
| `MODEL_NOT_CONFIGURED` | 已生效 | 未选择模型，或供应商以 404 拒绝所选模型 | 选择或配置一个可用模型 |
| `PROVIDER_ERROR` | 已生效 | 其他上游供应商故障 | 重试 / 检查详情 |
| `NETWORK_ERROR` | 已生效 | 无法访问供应商端点 | 检查网络和 base URL |
| `STREAM_FAILED` | 已生效 | 流在回合中途中断 | 重试回合 |
| `PROVIDER_BASE_URL_INVALID` | 保留 → `PROVIDER_ERROR` | base URL 格式错误或无法访问 | 修正端点 |
| `PROVIDER_PROTOCOL_MISMATCH` | 保留 → `PROVIDER_ERROR` | 端点协议错误 | 切换协议配置 |
| `PROVIDER_MODEL_NOT_FOUND` | 保留 → `MODEL_NOT_CONFIGURED` | 供应商未知模型 id | 刷新目录或使用自定义 id |
| `PROVIDER_TIMEOUT` | 保留 → `TIMEOUT` | 网络或服务器超时 | 重试 / 检查网络 |
| `PROVIDER_UNSUPPORTED_CAPABILITY` | 保留 → `PROVIDER_ERROR` | 不支持工具/视觉/推理 | 切换模型或禁用该功能 |
| `PROVIDER_DISABLED` | 保留 → `MODEL_NOT_CONFIGURED` | 供应商存在但已禁用 | 启用供应商 |

## 16. OpenAI 兼容一等路径

任何供应商只要暴露 OpenAI 兼容 API，就可以在没有原生 SDK 的情况下接入。

必需字段：
- `baseUrl`
- auth（`api_key` / `bearer` / `none` / 自定义标头）
- 模型 id（目录或自由格式）

可选：
- `apiStyle`（`chat_completions` | `opencode_go` | `responses` | `auto`）
- 兼容性标志
- `headers`（可选出站 HTTP 标头；留空则保留适配器默认值）

对于 OpenAI Chat Completions 适配器，系统指令默认使用标准 `system` 角色。这保持了任意兼容网关的互操作性，因为某些上游路由会拒绝较新的 `developer` 角色，包括推理模型路由。当已知某个端点接受该角色时，解析后的模型记录可以显式设置 `compat.supportsDeveloperRole: true`；此覆盖仅作用于模型，不会改变其他供应商。

这是**通用逃生通道**，保证原生集成之外的模型市场覆盖。

## 17. 多供应商产品规则

1. 允许同一 `vendorKey` 的多个供应商，且它们相互独立（例如两个 OpenRouter 账户）；每个行都有自己的 OAuth 密钥作用域。
2. 对于 API/自定义服务，供应商 `name` 可由用户编辑且唯一。OAuth 行可以共享供应商显示名称；它们的稳定身份是 `providerId`，其非密钥账户标签是展示元数据。
3. 默认应用模型是一对 `(providerId, modelId)`，而不是单独一个 modelId。
4. 会话存储自己的 `(providerId, modelId)` 绑定。
5. 删除供应商会阻止引用它的新回合；历史会话保留这些 id 以供审计/显示。
6. 导出设置绝不包含原始密钥。
7. 导入设置可以重建供应商外壳并提示输入密钥。
8. 推理能力是模型特定的，除非供应商有显式的兼容性覆盖；在回合解析期间，供应商默认值不得覆盖会话所选模型。

## 18. 验证规则

- `name` 必填
- `vendorKey` 必填
- `protocol` 必填
- 当端点不是隐式时，`baseUrl` 对 openai_compatible/custom 必填
- 当 `authKind` 需要 key 时，密钥必填
- 标头不得包含原始 api keys（使用密钥存储）
- 模型 id 非空

## 19. 验收标准

- [ ] 从 UI 添加 OpenAI / Anthropic / Google / OpenAI-Compatible 供应商
- [ ] 使用 base URL + key 添加任意 OpenAI 兼容自定义供应商
- [ ] 通过跨供应商的目录搜索选择模型
- [ ] 当目录遗漏时接受自由格式模型 id
- [ ] 目录刷新至少为一个原生供应商和一个兼容供应商填充模型，而不破坏现有供应商
- [ ] 连接测试返回结构化成功/失败，且不泄露密钥
- [ ] 可以在设置中登录同一供应商的两个账户，独立用于回合，并一次移除一个；sidecar 绝不会收到任一刷新 token
- [ ] 会话可以在回合之间切换模型
- [ ] 已知推理级别为绑定提供种子值，同时七个规范级别全部保持显式可选，并且所选级别会到达 pi；没有任何非 `off` 级别的绑定解析为 `off`
- [ ] 缺少 key/模型时会以稳定、可操作的错误代码阻止运行
- [ ] 至少记录并测试一个本地供应商路径（Ollama 或 LM Studio 风格）
- [ ] 没有“只有 3 个供应商 / 10 个模型”之类的产品硬性限制

## 20. 非目标（MVP）

- 构建我们自己的完整供应商 SDK 生态
- 保证所有供应商具有完全相同的工具/视觉质量
- 供应商市场（不需要；配置是本地）
- 超出模型能力标志的完整多模态附件工作室
- 为每个供应商门户自动发现付费计划
- 在没有 pi-ai 支持的情况下支持专有非 HTTP SDK
- 云同步的供应商配置文件
