# ADR 0172：受限的对话内图片显示

> **翻译说明：** 本页是与 [英文源决策](/adr/0172-contained-in-chat-image-display) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-07
- 相关：ADR 0019、ADR 0163、ADR 0169、决策 D320/D334、E2E-187
- 修订：桌面 IPC 规格中 `fs/read` 仅限工作区的条款

## 上下文

粘贴和上传的图片以无扩展名的 `attachments/<sha256>` 形式存储为 blob，位于数据目录下。本地 Markdown 图片相对于工作区。渲染器源无法加载这些文件，因此历史回合显示的是一个 chip 而不是图片。通过 `fs/open` 打开 `attachments/<sha256>` chip 也会失败，因为该路径被当作相对于工作区处理。

一个通用的“任意绝对常规文件”读取通道会让渲染器泄露任意磁盘内容。

## 决策

1. 保持 `fs/list` 仅限工作区。扩展 `fs/read`、`fs/reveal` 和 `fs/open`，使其共享 `resolveOpenablePath`：相对于工作区的路径、已位于工作区内 / `<data_dir>/scratch/` / `<data_dir>/attachments/` 的绝对路径，以及内容寻址的 `attachments/<sha256>` 引用。读取还会对目标执行 `realpath` 并重新检查包含关系。
2. 新增仅限渲染器的 `fs/readImageDataUrl({ref, mimeType?})`。它返回有界的图片 data URL，或返回 `missing` / `notImage` / `tooLarge`，并且绝不返回非图片字节。它不是插件主机 API；插件继续使用 `fs.readPreview`。
3. 已知的图片扩展名始终优先于客户端提供的 `mimeType`。无扩展名的附件 blob 只接受现有的 `IMAGE_MIME` 允许列表。任意 `image/*` 值都会被忽略。
4. 对话缩略图和本地 Markdown 图片通过该通道加载。点击已解析的图片会用同一 ref 打开主机文件查看器。

## 后果

- 当文件仍然存在且在大小上限内时，历史附件和本地 Markdown 图片会内联渲染。
- 即使伪造 `mimeType`，`/etc/passwd` 以及其他根路径之外的文件仍然不可读。
- 插件的文件视图仍限定在工作区范围内；转录工件仍使用主机的 `file:` 标签页。

## 已拒绝的替代方案

### 新增无界的绝对路径读取

拒绝，因为渲染器 IPC 不是用户点击门控。

### 从对话渲染器复用 `fs.readPreview`

拒绝，因为该 API 的插件作用域限定在工作区根目录，无法看到 `attachments/<sha256>` blob。

## 参考

- `apps/desktop/electron/main/fs-panel.ts`
- `apps/desktop/src/lib/use-referenced-image-data-url.ts`
- `docs/spec/03-runtime/01-ipc-protocol.md`
