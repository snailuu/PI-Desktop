# ADR 0134：使用 models.dev 作为唯一模型元数据来源并附带本地快照

> **翻译说明：** 本页是与 [英文源决策](/adr/0134-models-dev-sole-model-metadata-source) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-29
- 决策者：PI-Desktop core
- 修订：ADR 0027、ADR 0133、D136、D266

## 上下文

最初的 models.dev 集成仍在 pi-ai 中保留了第二条模型元数据路径。这使得包升级或供应商特定的 pi 记录有可能更改 PI-Desktop 所呈现并发送给 sidecar 的模型名称、能力、限制、思考级别、输入模式或价格。它也没有持久化完整的公共 models.dev 文档，因此模型更新依赖于进程保持在线。

所提供的 models.dev 记录发布的不只是上下文和输出限制：它们还包括模型描述、系列、附件、推理选项、工具与结构化输出支持、temperature 支持、知识/发布元数据、输入/输出模态、权重、状态、交错、限制以及成本层级。这些字段需要一个稳定的归属方和一个本地离线快照。

## 决策

`https://models.dev/api.json` 是唯一的模型元数据/配置来源。

1. Electron 主进程在开发环境中读取 `resources/models.dev/api.json`，在打包构建中读取 `<resources>/models.dev/api.json` 所捆绑的公共文档。该文件是仓库/发布工件的一部分，而不是用户数据目录的一部分。
2. `scripts/release.mjs <version> --tag` 会获取 `https://models.dev/api.json`，对其进行校验，以原子方式替换已签入的资源，并在打标签之前将该文件纳入发布提交。
3. 启动时，Electron 读取捆绑快照，不进行网络 I/O。设置 → 模型配置提供 **刷新模型目录**，该操作始终重新获取 URL，并为当前进程替换内存中的快照；它绝不会写入打包文件或用户缓存。
4. 解析器将所有受支持的 models.dev 字段映射到现有的 `ModelInfo` 和 sidecar `ModelConfig`：`id`、`name`、`description`、`family`、`attachment`、`reasoning`、`reasoning_options`、`tool_call`、`structured_output`、`temperature`、`knowledge`、`release_date`、`last_updated`、`modalities.input/output`、`open_weights`、`limit.context` / `input` / `output`、`cost`（包括 audio/reasoning/cache/tier 价格）、`interleaved`、`status`、`experimental` 和 `provider`。供应商/模型匹配接受配置的 vendor 键、规范化 API URL、目录供应商身份以及无歧义的 vendor 前缀 ID；未加前缀的已配置 ID 可以匹配 `vendor/model` 目录 ID，且不改变用户可见的 ID。
5. 运行时将 models.dev 的 `ModelConfig` 传递给 pi-ai 所选的 wire adapter。pi-ai 仅作为请求序列化、OAuth 登录/账户可用性和流处理的实现依赖保留；其内置模型目录和模型能力函数不会被查询。
6. 未出现在 models.dev 中的模型仍可通过显式的通用文本模型形态运行，具有保守限制，且不声称支持推理/视觉。供应商 `/models` 发现和已认证的 OAuth 可用性仍可提供 models.dev 未列出的 ID，但它们不能凭空捏造元数据。

Models.dev 推理映射保留与规范级别相匹配的 `effort` 值（`none` → `off`），将 `toggle`/`budget_tokens` 映射为 `off` + `medium`，并在推理记录没有可用级别列表时使用 `low`/`medium`/`high`。输入和输出模态数组保留 `text`、`image`、`audio`、`video` 和 `pdf`；当前文本代理选择器会排除无法接收和产生文本的模型，而原始捆绑快照会为将来的界面保留这些记录。图像附件使用 pi-ai 所支持的瞬态图像块；PDF 能力从目录中呈现，但在具备原生 PDF 块的传输方式可用之前，PDF 文件仍作为有界文件引用。

## 后果

- 模型元数据只有一个权威来源，并且可从签入的发布资源离线复现。
- 每次发布都会在创建标签之前刷新目录，而无需数据库或主机核心 schema 迁移。
- 设置可以立即为当前进程获取更新的快照；下一次应用启动时会回到捆绑的发布快照，直到发布新版本。
- 供应商绑定仍由用户拥有的选择/覆盖决定；目录拥有已发布的模型语义，而通用回退则拥有未知 ID。
- Models.dev 故障时会保留上一次本地快照、供应商端点发现和显式自定义 ID。
- 对 models.dev schema 的变更需要在发布前提供解析器 fixture 和源码/运行时契约测试。

## 备选方案

### 保留 pi-ai 作为模型元数据回退

已拒绝：这会创建第二个权威来源，并允许包更新悄然改变用户所选的模型配置。它仅保留用于传输和 OAuth。

### 保留用户数据快照

已拒绝：发布工件必须可复现，而用户缓存会导致不同安装使用不同的模型配置。设置刷新在下次发布之前有意限定为进程本地。

### 仅在供应商对话框打开时获取

已拒绝：Composer 和运行时启动也需要模型能力状态；捆绑的发布快照为所有界面提供了一致的确定性基线。设置刷新仍然是一项显式的远程操作。

## 参考

- `scripts/release.mjs`（发布时的目录刷新）
- `apps/desktop/resources/models.dev/api.json`（捆绑快照）
- `apps/desktop/electron/main/models-dev-catalog.ts`（目录解析和刷新）
- `apps/desktop/electron/main/index.ts`（主进程加载和 IPC）
- `apps/desktop/src/components/settings/ModelConfigPage.tsx`（设置刷新操作）
- `packages/agent-runtime/src/model-capabilities.ts`
- `packages/agent-runtime/src/provider-binding.ts`
- `docs/spec/03-runtime/11-provider-model-system.md`
- `docs/spec/03-runtime/12-provider-config-schema.md`
- `docs/spec/03-runtime/13-model-catalog-and-selection.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`（E2E-066、E2E-080、E2E-154）
