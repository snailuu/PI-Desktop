# 11. 供应商与模型系统

> **翻译说明：** 本页是与 [英文源规格](/spec/03-runtime/11-provider-model-system) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 1. 目标

PI-Desktop 必须支持**所有主流市场的模型供应商和模型**，以满足用户常见需求，而不是将一份很小的允许列表硬编码为产品上限。

策略：

> **通过 models.dev 模型元数据 + pi-ai 传输适配器 + OpenAI 兼容逃生舱实现通用的供应商覆盖。**

我们**不**自行重新实现每个供应商的 SDK。  
我们统一基于 pi 的多供应商层，并添加产品级配置、目录和 UX。

## 2. 覆盖原则

### 必须支持
1. 第一方主要供应商
2. 流行的聚合器 / 网关
3. 任何 OpenAI 兼容的端点
4. 用户自定义供应商
5. 持续的模型目录刷新

### 产品承诺
- 用户几乎可以连接所有可用的主流供应商/模型，方式包括：
  - 原生 pi 供应商集成
  - OpenAI 兼容 API
  - 自定义供应商定义

### 明确不承诺
- 在没有适配器的情况下保证每个冷门供应商的专有非标准协议
- 在不更新目录的情况下永久离线提供完整的世界模型矩阵

## 3. 架构

```text
设置 / UI
  → ProviderConfigStore (Rust 主机 DB)
  → AgentRuntime (Node/pi)
      ├─ 内置供应商（通过 pi-ai）
      ├─ openai 兼容供应商
      └─ 自定义供应商定义
  → ModelCatalogService
      ├─ models.dev 快照（唯一的模型元数据来源）
      ├─ 运行时/供应商发现（仅为自定义/动态模型提供 ID）
      └─ Rust 拥有的供应商缓存
```

## 4. 供应商类型

| 类型 | 描述 | 示例 |
|---|---|---|
| `native` | 通过 pi-ai 的一等供应商集成 | openai, anthropic, google, bedrock, mistral, 等 |
| `openai_compatible` | 任何 OpenAI Chat Completions/Responses 兼容网关 | OpenRouter、Together、Groq、Fireworks、DeepSeek、本地网关、企业代理 |
| `custom` | 基于已知协议配置的用户自定义供应商 | 私有部署、区域网关 |

协议配置（MVP）：

1. `openai`
2. `anthropic`
3. `google`
4. `openai_compatible`
5. `bedrock`（若运行时支持则启用）
6. `custom_http`（后续高级/实验性）

OpenCode Go 作为一个具名的 `opencode_go` API 风格预设对外暴露。它仍处于 `openai_compatible` 供应商路径内：该预设将端点固定为 `https://opencode.ai/zen/go/v1`，使用 Bearer API-key 认证，从 `/models` 发现模型，并通过 pi-ai 的 OpenAI Chat Completions 适配器发送对话回合。它不会创建第二种传输方式，也不构成封闭的模型允许列表。agent-runtime 会在每次 LLM 请求（会话回合、子代理、提示增强以及插件一次性调用）上注入 OpenCode 路由头：`x-opencode-session` 是持久的对话 id（当调用方没有会话时为每次调用生成的 UUID），`x-opencode-client` 为 `pi-desktop`，除非该行设置了 `headers["User-Agent"]`，否则 `User-Agent` 为 `pi-desktop/<APP_VERSION>`。base URL 主机为 `opencode.ai` 的自定义 OpenAI 兼容行会收到相同的头。并不依赖 pi-ai 来发出 `x-opencode-session`。每个供应商行（AI 服务或 OAuth 账户）都可以设置可选的 `headers`；为空则保留适配器默认值。fetch 包装器是最后写入者，因此 Codex 和 Anthropic 无法覆盖它们。

当一个 OAuth 供应商围绕本地供应商行 id 重建时，运行时会保留原生 pi-ai 传输元数据，而不是将该行视为通用的 OpenAI 端点。GitHub Copilot 请求会保留所固定模型的 IDE 身份头，包括 `Editor-Version`、`Editor-Plugin-Version` 和 `Copilot-Integration-Id`；agent-runtime 会添加上下文相关的 `X-Initiator`、`Openai-Intent` 以及图像请求头。本地行 id 仍然拥有认证绑定和转录身份，用户提供的供应商头仍然是最终覆盖。

智谱 / GLM 和 Z.AI 是具名的 OpenAI 兼容端点预设，位列一份由 models.dev 支持的第一方供应商（包括小米）精简服务列表中。添加供应商时的服务选择器会持久化匹配的 models.dev `vendorKey`，并在具名服务路径上直接使用已发布的端点，不显示 Name、Base URL 或 API 格式。对话回合仍使用所选的 pi-ai 适配器（`chat_completions`、`responses`、`anthropic_messages`、`google_generative_ai` 或 `opencode_go`）。智谱 / Z.AI Completions 请求使用 `thinkingFormat: "zai"` 和 `zaiToolStream: true`。

## 5. 内置供应商矩阵（交付意图）

> 模型元数据遵循捆绑/内存中的 models.dev 目录。供应商适配器仍通过 pi-ai 可用，并且 OpenAI 兼容路径对 models.dev 未列出的模型保持开放。

### Tier A —— 始终在 UI 中暴露
- OpenAI
- Anthropic
- Google Gemini
- OpenAI 兼容（通用）

### Tier B —— 当运行时支持时暴露 / 若 pi-ai 中存在则默认启用
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

### Tier C —— 用户自定义
任何未列出但可通过以下方式访问的供应商：
- OpenAI 兼容的 base URL
- 自定义头
- 自定义认证方案

## 6. 模型支持策略

### 6.1 没有硬性模型允许列表上限
PI-Desktop 不得将用户永久限制在简短的固定模型列表上。

### 6.2 目录职责
1. **models.dev**（`https://models.dev/api.json`）是唯一的模型元数据来源。Electron 主进程在开发环境下读取已检入的发布资源 `apps/desktop/resources/models.dev/api.json`，在发布构建中读取打包后的 `resources/models.dev/api.json` 路径。它绝不会将供应商凭证发送到目录。
2. 已检入的快照会在创建发布标签之前由 `scripts/release.mjs` 刷新。在运行时，设置 → 模型配置可以显式重新拉取 `https://models.dev/api.json`；成功的响应仅替换当前进程的内存中目录。拉取失败会保留最后一次有效的内存中目录，且绝不写入用户数据。
3. **运行时/供应商发现**与 Rust 拥有的缓存为自定义、本地或已认证的账户专属端点提供模型 ID。供应商匹配接受所配置的 vendor key、规范化 API URL、models.dev 供应商身份，以及诸如 `deepseek/deepseek-v4` 的供应商前缀 ID；仅当供应商身份明确无歧义时，不带目录前缀的供应商模型 ID 才会匹配到完全一致的无前缀后缀。原生适配器键可以使用目录别名 —— 例如，pi-ai 的 `openai-codex` ChatGPT 订阅适配器通过 `openai` 记录解析模型元数据 —— 而适配器保留其自身的传输身份。它们不能臆造或替换模型元数据。当所配置的自由形式 ID 在 models.dev 中缺失时，它仍可选用，并采用通用的仅文本、非推理基线。对于目录尚不了解的端点，设置仍允许显式覆盖思考等级。
4. models.dev 记录将 `id`、`name`、`description`、`family`、`attachment`、`reasoning`、`reasoning_options`、`tool_call`、`structured_output`、`temperature`、`knowledge`、`release_date`、`last_updated`、`modalities.input/output`、`open_weights`、`limit.context/input/output`、`cost`、`interleaved`、`status`、`experimental` 和 `provider` 映射到共享的模型界面。
5. pi-ai 仅保留为请求/OAuth 实现层。其捆绑的模型目录和模型能力函数不会被读取用于名称、限制、定价、模态、推理或其他模型配置。
6. 输入和输出模态数组保留 `text`、`image`、`audio`、`video` 和 `pdf`。文本代理选择器会暴露能够处理文本的模型，同时在文件中保留所有原始记录以供未来的界面使用。仅当模型接受图像输入时，图像输入才会作为临时的图像内容块发送。PDF 能力会在模型元数据中呈现并保留；由于 pi-ai 0.85 没有原生 PDF 内容块，PDF 附件仍保持有界的文件引用，而不会被错误地编码为图像。
7. 用户编辑的 `ModelBinding` 值仍是显式的供应商配置：它们控制所选的请求限制、启用的思考等级、应用于新首页草稿和新持久化会话的默认思考等级（会被夹取到已启用集合上；仅当默认值未设置时才使用最强已启用等级），以及附件能力覆盖。`models.dev` 提供已发布的元数据，并为新添加的已知模型播种初始思考选择；它不是用户为该端点显式启用的某等级的运行时门槛。为兼容起见，仍然包含遗留通用 `128,000` 上下文种子的绑定会跟随新发布的 `limit.context`；非默认的高级值仍然保持显式。这使 sidecar 和上下文检查器在目录刷新后处于相同的有效窗口。
8. 设置会为每个绑定渲染七个规范思考等级。对于已知的推理模型，已发布的等级初始为选中状态。非推理或未知模型会显示相同的选项但均未选中，并附有简短的手动覆盖说明。`defaultThinkingLevel` 从绑定所启用的等级中选择，因此存储的默认值始终属于显式集合的一部分。
9. `supportsImages` 和 `supportsDocuments` 是三态覆盖。缺失或 `null` 会跟随已发布的 models.dev 模态，因此目录修正仍能到达已保存的绑定；`true` 或 `false` 是用户的显式回答，并在目录变化后仍然保留。与思考等级不同，这些覆盖不会被收窄到已发布的能力，因为经代理或自托管的端点通常会接受其目录条目中未列出的输入。启用图像输入会开启临时的图像内容块；启用 PDF 输入会记录该能力但不改变编码，因为 pi-ai 0.85 没有 PDF 内容块，PDF 仍保持有界的文件引用。
10. 设置复选框会显示相对于已发布基线的有效回答，将某项设回已发布值会存储"跟随目录"而非等值的覆盖。因此，与 models.dev 保持一致就是重置，无需单独的重置控件或按能力分别提供的说明文案。
11. `ModelInfo` 是设置界面用作比较基准的已发布记录，因此存储的绑定不得影响其能力或推理字段。有效限制、推理和思考等级通过精确绑定解析；有效传输模态数组还会额外应用显式的附件覆盖。
12. 用户已配置的模型即使实时发现不再列出它，也会保留其已发布记录，因此其能力仍然可见且可编辑。只有已经存在于供应商 `models` 中的 id 才会被重新添加，绝不会整体添加目录，并且只有发现实际返回的行才会写入模型缓存。

### 6.3 需覆盖的模型家族
目录和自定义模型录入必须支持常见的能力类别：

- 文本对话 / 编码模型
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
  | "oauth" // 供应商订阅账户，凭证由 Electron 主进程拥有
  | "none" // 本地无认证

type ProviderConfig = {
  id: string                    // uuid/ulid
  name: string                  // 显示名称
  vendorKey: string             // openai/anthropic/google/openrouter/custom/...
  type: "native" | "openai_compatible" | "custom"
  protocol: "openai" | "anthropic" | "google" | "openai_compatible" | "bedrock" | "custom_http"
  enabled: boolean
  baseUrl?: string
  authKind: ProviderAuthKind
  secretRef?: string            // 指向密钥存储的指针
  headers?: Record<string, string> // 可选的出站头；为空则保留适配器默认值
  apiStyle?:
    | "chat_completions"
    | "opencode_go"
    | "responses"
    | "anthropic_messages"
    | "google_generative_ai"
    | "openai_codex_responses" // 仅供应商账户
    | "pi_messages"            // 仅供应商账户
    | "auto"
  compatibility?: {
    supportsTools?: boolean
    supportsVision?: boolean
    supportsStreaming?: boolean
    supportsReasoning?: boolean
    supportedThinkingLevels?: ThinkingLevel[]
  }
  defaultModelId?: string
  models: ModelBinding[]        // 选中的模型及按模型设置
  createdAt: string
  updatedAt: string
}

type UserModelConfig = {
  id: string                    // 供应商本地模型 id/slug
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
  availableForSubagents?: boolean // 对 AI 驱动的委派选择加入
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

上面的兼容性字段作为面向旧版客户端的持久化 schema 兼容界面予以保留。PI-Desktop 不再将它们读取为运行时模型覆盖。`ModelInfo` 的推理支持和受支持的思考等级描述了解析后的 models.dev 记录；有效的供应商/会话能力来自精确的 `ModelBinding`。未知的自由形式 id 以通用形态开始，且不推断推理能力，但显式绑定可以选择加入这些等级。

供应商对话框会为每个选中的模型持久化一个 `ModelBinding`。第一个绑定是当前对话和遗留运行时消费者所使用的有效模型。对话级别的模型切换以及跨数组的路由仍属未来工作。仅带 `defaultModelId` 的遗留供应商会在主机读取时具体化为一个回退绑定，并在下次供应商写入时升级为 `models`。

`ModelBinding.availableForSubagents`（布尔值，默认 false）：一个选择加入标志，使该模型可供 AI 驱动的子代理委派使用。启用后，该模型会出现在注入父代理系统提示的委派目录中。随后父代理可以通过 Task 工具的 `model` 参数选择它。

## 8. 密钥

- API 密钥通过安全存储（`SECRET_*` API）保存
- 供应商配置只存储 `secretRef` / hasSecret 布尔值
- 渲染器绝不会在列表 API 中收到原始密钥
- 可选的密钥验证调用：`providers.testConnection`
- 供应商账户行存储 OAuth 授权而非密钥；`hasSecret` 涵盖任一凭证，`hasOauth` 用于区分它们（§8a）

## 8a. 供应商账户（OAuth）供应商

供应商行可以通过供应商订阅（Claude Pro/Max、ChatGPT Plus/Pro、Copilot 以及 pi-ai 其余 OAuth 供应商）进行认证，而无需粘贴密钥（ADR 0095、D237、D240）。所提供的供应商派生自 `models.getProviders().filter(p => p.auth.oauth)`，因此该列表跟随固定版本而非硬编码表格，并且 `registerBunOAuthFlows()` 在启动时运行一次，因为 pi-ai 通过 electron-vite 无法打包的动态导入来加载流程。

Electron 主进程拥有登录对话和凭证；渲染器只能看到事件和非密钥的账户标签。每次登录都会创建一个带有 `authKind: "oauth"` 的新供应商行；即使多个行共享同一 `vendorKey`，行 id 也是账户身份。Electron 主进程为每个行创建一个 pi-ai 模型集合和一个 `CredentialStore` 作用域，将供应商 id 映射到 `secret:provider:<rowId>:oauth`。随后它从该账户自己的目录中填充 `baseUrl`、`apiStyle` 和 `defaultModelId`。供应商目录响应会将每个本地行作为一个账户包含在内，包括已断开/孤立的行，以便用户显式移除它们。

请求认证是**按请求**解析的，而非在启动时解析：

```text
sidecar 请求
  → 运行时供应商绑定（`resolveAuth` 在启动时注入）
  → host-proxy `provider.resolveAuth` { sessionId, providerId }
  → Electron 主进程（本地应答，绝不转发到 host-core）
      · 绑定表检查 → 不匹配时 PROVIDER_NOT_BOUND
      · 按行作用域的 pi-ai `models.getAuth(vendorKey)` → 仅在过期时在该行的锁下刷新
  → 短生命周期的 ModelAuth { apiKey?, headers?, baseUrl? }
```

有两个值得说明的后果：供应商访问 token 的生命周期约为一小时，因此不得在载荷或运行时中缓存任何内容；并且由于该行的 `apiKey` 保持为 `""` 且注入的解析器是一个函数，运行时身份（`matches()`）是稳定的，因此 OAuth 会话会在各回合之间复用其热运行时，而不是重建它。因此 sidecar 从不持有刷新 token，并且仅为其会话所绑定的供应商持有访问 token。

此类行的模型发现会读取已认证的目录（`models.getAvailable`，它会应用供应商自己的 `filterModels`），而不是探测 `/models`，连接测试则通过解析认证来证明账户有效。对于静态 OAuth 供应商（例如 ChatGPT Plus/Pro（`openai-codex`）），该目录是所固定的 pi-ai 模型列表，而非实时的供应商 `/models` 探测，因此诸如 `gpt-6-astra` 这类新发布的账户模型只有在固定版本包含它之后才会出现。一旦 ID 可用，models.dev 仍会提供元数据，但它无法将该 ID 添加到已认证列表中。一个供应商可能横跨多种线路 API —— Copilot 同时提供 Anthropic、Chat Completions 和 Responses 模型 —— 因此该行的 `apiStyle` 会跟随所选模型。删除行会调用正常的主机 `providers.delete` 路径，从而移除其 OAuth 密钥和元数据；它绝不会登出或删除具有相同 vendor key 的另一个行。

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
- 编辑 base URL/头
- 设置/替换/删除密钥
- 在"高级"中设置可选的定制头（为空则保留适配器默认值）；复制用于持久化的同一规范化 JSON
- 登录/登出供应商账户，并查看某行使用哪个账户
- 编辑供应商账户的非密钥标签、定制头和默认模型
- 启用/禁用供应商
- 测试连接
- 选择多个模型，并编辑每个绑定的上下文窗口、输出限制和已启用的思考等级；目录元数据为 API 供应商和已登录的供应商账户提供初始值。选择器始终暴露七个规范等级：已发布的等级为已知模型播种，而任何显式选择都会为代理或新发布的模型予以保留。两种界面都通过同一选择器呈现这一点，因此供应商账户编辑器提供与 API 供应商编辑器相同的按绑定编辑
- 默认保持模型卡片紧凑，按需展开元数据/配置，并将对话框操作置于可独立滚动的内容之外
- 不暴露原始目录兼容性内部结构或供应商密钥
- 设置 → 导入可以从 Claude Code、Codex、OpenCode、Pi 和 CC Switch 复制供应商/模型行。扫描是显式的。存储的 API 密钥会被复制到主机密钥存储；OAuth/订阅授权则不会被复制。重新导入时会跳过等价的端点（规范化 URL + API 风格）。不会提升协议或 schema 版本（D342 / ADR 0179）。

### 模型选择器
- 跨已启用的供应商搜索所有模型
- 按供应商/厂商分组
- 显示能力徽标（工具/视觉/推理）
- 允许"刷新模型"
- 允许输入自定义模型 id

### 空/错误状态
- 未配置供应商
- 缺少密钥
- 未找到模型
- 供应商未授权
- 目录刷新失败（仍允许手动输入模型 id）

## 11. 运行时解析算法

使用 `(providerId, modelId)` 启动一个回合时：

1. 从主机加载供应商配置
2. 若缺失/被禁用 → 失败（`MODEL_NOT_CONFIGURED`；保留的详细信息：`PROVIDER_DISABLED`）
3. 解析凭证：对于有密钥的行，通过 `secretRef` 读取密钥（绝不记录它；缺失 → `PROVIDER_SECRET_MISSING`）；对于 `oauth` 行则完全跳过此步骤，并以空密钥启动，因为认证是按请求解析的（§8a）
4. 通过匹配的供应商 key/API URL 和精确模型 id 解析 models.dev 记录
5. 将其完整的模型配置 —— 名称、描述、家族、附件/推理/工具/结构化输出/温度标志、知识和发布日期、输入/输出模态、权重、状态、交错、限制、成本数据和思考选项 —— 复制到运行时模型快照；若缺失，则使用通用的仅文本、非推理形态
6. 从 models.dev 的 `modalities.input` 推导视觉传输；供应商发现/缓存的声明无法将未解析的模型提升，而显式的附件绑定覆盖可以
7. 将会话思考等级夹取到精确绑定所启用的等级上，并仅通过替换供应商/模型身份、所选的 API 适配器、认证和显式配置的端点 URL 来构建运行时供应商适配器。对于 `anthropic_messages`，运行时会在将该 URL 传递给 pi-ai 之前移除末尾的 `/v1`，因为 Anthropic SDK 自身会追加 `/v1`；因此配置了带或不带 `/v1` 的根都会到达相同的 `/v1/messages` 路由。
8. 使用中止句柄执行流，并分离回答/思考事件
9. 将供应商错误转换为共享的 `AppError` 代码（§15）

如果模型在 models.dev 中缺失，只要用户显式输入模型 id 且供应商接受未知 id，仍允许使用它。缓存/供应商能力字段不会将该回退提升为已知的运行时模型。

## 12. 兼容性层级

| 层级 | 含义 |
|---|---|
| full | 工具 + 流式 + 视觉 已验证/预期 |
| standard | 预期支持对话流式 |
| limited | 通过兼容网关尽力而为 |
| unknown | 用户自定义，无保证 |

UI 可以显示层级提示，但默认不得硬性阻止未知模型。

## 13. 刷新与更新策略

1. Electron 主进程在提供模型元数据之前读取捆绑的发布资源：开发环境下为 `apps/desktop/resources/models.dev/api.json`，打包构建中为 `resources/models.dev/api.json`。
2. `scripts/release.mjs` 会拉取 `https://models.dev/api.json`，验证它，并在创建发布标签之前原子替换已检入的资源。
3. 设置 → 模型配置可以随时强制进行远程刷新；成功的响应仅更新当前进程的内存中目录。
4. 供应商端点发现仅为捆绑/内存中 models.dev 快照中缺失的模型提供 ID；未知 ID 使用通用元数据。
5. 刷新失败不得清除捆绑文件、Rust 拥有的供应商缓存或已配置的绑定。

## 14. 本地/离线模型支持

通过 OpenAI 兼容的本地服务器支持：

- Ollama（若 pi 支持则为原生，否则通过 OpenAI 兼容代理）
- LM Studio
- vLLM / TGI / LocalAI / LiteLLM 代理
- 其他本地网关

要求：

- 自定义 base URL
- 认证可为 `none`
- 手动模型 id 录入始终可用
- 目录刷新在可用时可以使用 `/v1/models`；否则使用用户定义的模型

## 15. 失效分类（供应商域）

规范代码位于 [08-error-codes](/zh-CN/spec/03-runtime/08-error-codes)；保留的详细代码在发出之前映射到规范父级（该文档的 §3.7）。

| 代码 | 状态 | 含义 | 面向用户的指导 |
|---|---|---|---|
| `PROVIDER_UNAUTHORIZED` | live | 无效/过期的密钥或认证被拒 | 重新输入密钥 / 检查账户 |
| `PROVIDER_RATE_LIMITED` | live | 429 / 配额 | 稍后重试 / 切换模型 |
| `PROVIDER_SECRET_MISSING` | live | 已启用的供应商但没有密钥 | 完成设置 |
| `MODEL_NOT_CONFIGURED` | live | 未选择模型，或供应商以 404 拒绝所选模型 | 选择或配置一个可用模型 |
| `PROVIDER_ERROR` | live | 其他上游供应商故障 | 重试 / 检查详情 |
| `NETWORK_ERROR` | live | 无法到达供应商端点 | 检查网络和 base URL |
| `STREAM_FAILED` | live | 流在回合中途中断 | 重试回合 |
| `PROVIDER_BASE_URL_INVALID` | reserved → `PROVIDER_ERROR` | 格式错误或不可达的 base URL | 修正端点 |
| `PROVIDER_PROTOCOL_MISMATCH` | reserved → `PROVIDER_ERROR` | 端点协议错误 | 切换协议配置 |
| `PROVIDER_MODEL_NOT_FOUND` | reserved → `MODEL_NOT_CONFIGURED` | 供应商不认识该模型 id | 刷新目录或使用自定义 id |
| `PROVIDER_TIMEOUT` | reserved → `TIMEOUT` | 网络或服务器超时 | 重试 / 检查网络 |
| `PROVIDER_UNSUPPORTED_CAPABILITY` | reserved → `PROVIDER_ERROR` | 不支持工具/视觉/推理 | 切换模型或禁用该功能 |
| `PROVIDER_DISABLED` | reserved → `MODEL_NOT_CONFIGURED` | 供应商存在但已被禁用 | 启用供应商 |

## 16. OpenAI 兼容的一等路径

任何供应商只要暴露 OpenAI 兼容 API，就可以在没有原生 SDK 的情况下接入。

必填字段：
- `baseUrl`
- 认证（`api_key` / `bearer` / `none` / 自定义头）
- 模型 id（目录或自由形式）

可选：
- `apiStyle` (`chat_completions` | `opencode_go` | `responses` | `auto`)
- 兼容性标志
- `headers`（可选的出站 HTTP 头；为空则保留适配器默认值）

对于 OpenAI Chat Completions 适配器，系统指令默认使用标准的 `system` 角色。这能让任意兼容网关保持互操作性，因为一些上游路由会拒绝较新的 `developer` 角色，包括推理模型路由。当已知某端点接受该角色时，解析后的模型记录可以显式设置 `compat.supportsDeveloperRole: true`；此覆盖的作用域为模型，不会改变其他供应商。

这是**通用逃生舱**，保证在原生集成之外的市场覆盖。

## 17. 多供应商产品规则

1. 允许同一 `vendorKey` 的多个供应商并存且相互独立（例如两个 OpenRouter 账户）；每个行都有自己的 OAuth 密钥作用域。
2. 对于 API/自定义服务，供应商 `name` 可由用户编辑且唯一。OAuth 行可以共享厂商显示名称；它们的稳定身份是 `providerId`，其非密钥的账户标签是呈现元数据。
3. 默认应用模型是 `(providerId, modelId)` 对，而非单独的 modelId。
4. 会话存储自己的 `(providerId, modelId)` 绑定。
5. 删除供应商会阻止引用它的新回合；历史会话保留这些 id 用于审计/显示。
6. 导出设置绝不包含原始密钥。
7. 导入设置可以重建供应商外壳并提示输入密钥。
8. 除非供应商有显式的兼容性覆盖，否则推理能力是特定于模型的；在回合解析期间，供应商默认值不得覆盖会话所选模型。

## 18. 校验规则

- `name` 必填
- `vendorKey` 必填
- `protocol` 必填
- 当端点非隐式时，openai_compatible/custom 需要 `baseUrl`
- 当 `authKind` 需要密钥时，密钥必填
- 头不得包含原始 api 密钥（请使用密钥存储）
- 模型 id 非空

## 19. 验收标准

- [ ] 从 UI 添加 OpenAI / Anthropic / Google / OpenAI 兼容供应商
- [ ] 使用 base URL + 密钥添加任意 OpenAI 兼容的自定义供应商
- [ ] 通过跨供应商的目录搜索选择模型
- [ ] 当目录缺少时，接受自由形式的模型 id
- [ ] 目录刷新至少为一个原生和一个兼容供应商填充模型，且不破坏现有供应商
- [ ] 连接测试返回结构化的成功/失败，且不泄露密钥
- [ ] 可以从设置登录同一厂商的两个账户，独立用于回合，并一次移除一个；sidecar 绝不会收到任一刷新 token
- [ ] 会话可以在回合之间切换模型
- [ ] 已知的推理等级为绑定播种，同时所有七个规范等级仍可显式选择，且所选的等级会到达 pi；没有任何非 `off` 等级的绑定解析为 `off`
- [ ] 缺失密钥/模型时以稳定、可操作的错误代码阻止运行
- [ ] 至少一条本地供应商路径（Ollama 或 LM Studio 风格）已记录且可测试
- [ ] 没有诸如"仅 3 个供应商 / 10 个模型"之类的产品硬性限制

## 20. 非目标（MVP）

- 构建我们自己的完整供应商 SDK 生态系统
- 保证所有供应商的工具/视觉质量一致
- 供应商插件市场（不需要；配置是本地）
- 超越模型能力标志的完整多模态附件工作室
- 为每个供应商门户自动发现付费计划
- 没有 pi-ai 支持的专有非 HTTP SDK
- 云同步的供应商配置文件
