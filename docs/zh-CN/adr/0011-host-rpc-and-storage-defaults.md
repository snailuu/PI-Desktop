# ADR 0011：冻结主机 RPC、存储归属与模式默认值

> **翻译说明：** 本页是与 [英文源决策](/adr/0011-host-rpc-and-storage-defaults) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受；模式配置条款部分被 ADR 0053 取代
- 日期：2026-07-25

## 上下文

在基线 0.3.0 之后，实现仍依赖若干高影响的默认值：

- Electron ↔ Rust 传输
- SQLite 归属
- 默认交互模式
- 此前的受限配置工具拆分（已被 ADR 0053 取代）
- 权限超时行为

## 决策

为实现冻结以下默认值：

1. 传输 = **Rust sidecar + stdio JSON-RPC（NDJSON）**
2. SQLite 归属 = **仅由 Rust 主机核心持有**
3. 默认模式 = **Agent**
4. 此前的受限配置为只读；该模式配置条款已被 ADR 0053 取代，后者取代了
   ADR 0052 中的历史操作状态决策，并将其替换为当前的 Plan 工作流
5. 权限超时 = **120s 拒绝**
6. 会话授权 = **按 toolName**
7. 首次发布平台 = **仅 macOS arm64**
8. TS schema = **typebox**
9. i18n = **i18next**

## 后果

### 正面
- M1/M2 可以继续推进，无需重新争论核心选择
- 进程与数据归属清晰
- 明确由主机持有的操作状态与权限策略

### 负面
- JSON-RPC 文本协议日后可能需要升级为二进制
- Rust 独占数据库归属要求主机 RPC 覆盖尽早成熟

## 相关文档

- `docs/spec/08-meta/decisions-log.md`
- `docs/spec/03-runtime/06-host-rpc-protocol.md`
- `docs/spec/03-runtime/07-process-model.md`
- `docs/spec/04-ux/03-permission-ux.md`
