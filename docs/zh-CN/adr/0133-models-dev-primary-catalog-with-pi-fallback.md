# ADR 0133：以 models.dev 作为主要模型目录，以 pi-ai 作为回退

> **翻译说明：** 本页是与 [英文源决策](/adr/0133-models-dev-primary-catalog-with-pi-fallback) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-29
- 决策者：PI-Desktop 主机核心
- 修订：ADR 0027、D136、D243

## 上下文

PI-Desktop 固定的 `@earendil-works/pi-ai` 包提供了高质量的运行时适配器和一份有用的内置模型目录，但其模型覆盖范围和发布节奏并不能代表当前市场的全貌。因此供应商设置无法可靠地提供用户所期望目录中的当前模型名称、限制、模态或能力标志。

应用已经具备主进程模型发现路径和由 Rust 拥有的按供应商缓存。模型元数据必须保持在渲染器之外，供应商凭据不得发送到目录服务，并且当没有任何公开目录知晓自定义/本地供应商时，这些供应商必须仍然可用。

## 决策

使用 `https://models.dev/api.json` 作为主要的远程模型目录。

1. Electron 主进程以有界超时获取该固定 URL，并只解析 PI-Desktop 所需的供应商/模型字段。渲染器从不获取该 URL，且请求中不发送任何 API key、OAuth token 或其他供应商凭据。
2. models.dev 供应商首先按配置的 `vendorKey` 匹配，其次按规范化后的供应商 API URL 匹配。精确的模型 ID 匹配提供显示名称、上下文/输出限制、输入模态、价格提示、推理选项、工具调用标志和结构化输出标志，供 `ModelInfo` 与运行时模型配置使用。
3. 对于已配置模型，目录优先级为：
   `models.dev` → `pi-ai` → 供应商端点发现 → 通用默认值。
   固定的 pi-ai 目录仍然是 models.dev 记录不可用或缺失时的回退，并在 models.dev 没有等价数据时提供适配器专属的兼容性数据。供应商端点发现仍然可用于自定义和账户专属的模型 ID。
4. 现有的 `ModelBinding` 仍然是用户针对所选供应商/模型的显式配置。目录数据提供默认值和能力元数据；对绑定的编辑继续控制其配置的限制和启用的思考层级。
5. 远程快照在每个 Electron 进程中最多加载一次，除非未来有显式的刷新策略替代该行为。获取失败会保留任何已成功的内存快照，并在不清空由 Rust 拥有的供应商缓存的情况下继续回退。现有供应商缓存存储其当前的规范化字段；主进程会根据最新目录对缓存行重新装饰。
6. `ModelInfo.catalogSource` 仅是面向渲染器的注解。它记录 `models.dev` 或 `pi-ai`，而不改变主机 RPC/存储 schema，也不持久化原始远程文档。

Models.dev 的推理选项映射到 PI-Desktop 的规范层级：effort 值在可识别时予以保留（`none` 变为 `off`）；toggle 和 token 预算选项使用 `off` 加 `medium` 作为启用代表；没有层级列表的 reasoning 记录使用保守的 `low`/`medium`/`high` 集合。输入或输出模态不是文本的条目不会在文本代理模型选择器中提供。

## 后果

- 设置和输入框可以使用当前广泛覆盖的供应商/模型目录，而无需在应用中附带一份庞大的静态矩阵。
- 离线以及目录不可用时的运行仍然可以通过缓存的供应商行、pi-ai 的内置目录、供应商发现和自由格式模型 ID 来实现。
- 远程目录可以独立于应用发布更新名称和限制，因此需要基于 fixture 的解析器测试和优先级测试。
- models.dev 不定义供应商的线上适配器。所选的 API 风格和 pi-ai 兼容性数据仍然决定请求序列化；目录条目不能为未知 ID 授予不受支持的传输或图像能力。
- 远程目录故障是非致命的，且不得清除用户选定的绑定或凭据。

## 备选方案

### 保持 pi-ai 作为唯一目录

被拒绝，因为其原生目录范围较窄，可能落后于 models.dev 的市场覆盖，尽管它仍然是最好的本地回退和适配器来源。

### 在渲染器中获取 models.dev

被拒绝，因为目录加载属于 Electron 主进程，可以保持单一网络边界，并避免将供应商凭据或远程响应处理与渲染器状态混在一起。

### 完全替换供应商发现

被拒绝，因为自定义/本地端点以及需要认证的供应商目录可能暴露公开目录中不存在的模型。对于这些情况，发现仍然是回退方案。

## 参考

- `apps/desktop/electron/main/models-dev-catalog.ts`
- `apps/desktop/electron/main/index.ts`
- `packages/agent-runtime/src/model-capabilities.ts`
- `docs/spec/03-runtime/11-provider-model-system.md`
- `docs/spec/03-runtime/12-provider-config-schema.md`
- `docs/spec/03-runtime/13-model-catalog-and-selection.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`（E2E-066、E2E-080、E2E-154）
