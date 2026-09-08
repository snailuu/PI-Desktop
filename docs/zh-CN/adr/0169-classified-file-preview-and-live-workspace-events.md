# ADR 0169：面向插件视图的分类文件预览与实时工作区事件

> **翻译说明：** 本页是与 [英文源决策](/adr/0169-classified-file-preview-and-live-workspace-events) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-06
- 决策者：PI-Desktop 核心
- 相关：[ADR 0104](/zh-CN/adr/0104-plugin-contributed-work-panel-views) ·
  [ADR 0105](/zh-CN/adr/0105-files-as-a-bundled-plugin) ·
  [ADR 0109](/zh-CN/adr/0109-open-files-with-the-os-associated-application) ·
  [ADR 0111](/zh-CN/adr/0111-reveal-files-in-file-manager) · D332 · E2E-153

## 背景

内置的 `pi.files` 视图是一个公共插件消费者（ADR 0105）。在它取代主机 Files 工具后，若干第一方浏览行为缺失或损坏：

1. `fs.readText` 无法对图片、二进制文件或超大文件进行分类，因此插件将图片报告为不可用，并可能将大型二进制文件按 UTF-8 加载。
2. `fs.openDefault` 已存在（ADR 0109），但在 reveal 取代头部操作后，它从 Files UI 中消失了（ADR 0111）。
3. `appearance:changed` 等面板事件仅广播给分离的 `ui.panel` 窗口。停靠的工作面板视图从未收到这些事件。
4. `workspace:changed` 被规划为待实现。Files 视图改为每两秒轮询一次 `workspace.get`。

## 决策

1. 添加 `pi.fs.readPreview(pathFromRoot)` 及面板通道 `fs.readPreview`，由现有的 `fs.read` 权限和完整的已声明作用域检查进行门控。主机将单个现有常规文件分类为 `text`、`image`、`binary` 或 `tooLarge`，使用与主机 Files 标签页相同的大小上限（文本 512 KiB，图片 5 MiB）。图片返回 data URL；二进制文件和超大文件不返回任何载荷字节。目录会被拒绝。
2. 将每个插件面板事件通过同一个 `pi-plugin-panel-event:<event>` preload 通道，同时广播给分离的面板窗口和实时停靠视图。
3. 每当缓存的工作区路径发生变化时，将 `workspace:changed` 投递给面板和插件进程。载荷与 `workspace.get()` 匹配：`{ path, name } | null`。
4. 在内置 Files 查看器中恢复 **用默认应用打开**，通过 `fs.glob` 添加搜索，在用户手势中复制相对于根目录的路径，并通过 `fs.readPreview` 预览图片。不引入私有的内置插件通道。

## 后果

- 第三方插件可以预览图片和超大文件，而无需发明第二套读取 API。
- 停靠视图可以实时跟随主题、语言和项目切换。
- Files 插件仍然是公共 API 的消费者；转录本中的 `file:<path>` 标签页仍归主机所有。

## 考虑过的替代方案

### 复用 `fs.readText` 并在插件中检测图片

被拒绝：对 PNG/JPEG 进行 UTF-8 解码是有损的，没有大小上限，并且在没有二进制通道的情况下无法生成 data URL。

### 私有的 Files IPC 通道

被拒绝：那会重新引入 ADR 0105 所移除的主机/插件例外。
