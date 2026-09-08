# ADR 0022：应用更新交付

> **翻译说明：** 本页是与 [英文源决策](/adr/0022-application-update-delivery) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-07-26
- 决策者：PI-Desktop 主机核心
- 相关：D120、D126、D010、ADR 0021

## 上下文

PI-Desktop 需要一条发布更新路径，它既要保持渲染器沙箱，又不能将 feed 配置暴露给不可信的 UI 代码，并且要反映各平台实际的安装器能力。单一的自动安装策略并不合适：未签名的 macOS 包无法提供合格的应内升级通道，而 Windows NSIS 与 Linux AppImage 支持 electron-updater 的下载并安装流程。

## 决策

1. Electron 主进程独占拥有 `electron-updater`、固定的 GitHub Releases feed、更新轮询与安装生命周期。渲染器 IPC 仅暴露经允许列表限定的 check、state、release-link 与 install 操作；调用方无法提供 feed URL。
2. 开发构建保持更新禁用。打包后的 macOS 与非 AppImage 的 Linux 使用手动交付：发现流程止于 `available` 并打开固定的 releases 页面。Windows NSIS 与 Linux AppImage 使用应用内下载与退出并安装的交付方式。
3. 更新器始终设置 `allowPrerelease = false`。否则 electron-updater 会将预发布安装（例如 `0.2.0-rc.6`）固定到同一个自定义通道（`rc`），从而永远不会提供更新的稳定版 GitHub latest 发布。预发布通道策略仍作为一项运维后续工作，以备日后需要专用 RC feed 时使用。
4. 自动检查在启动后以及周期性运行。自动检查失败保持静默；显式检查通过菜单与设置 -> 信息暴露状态与错误。已下载的更新在安装或正常关闭之前始终保持可操作。
5. Feed 清单与工件哈希由 electron-builder 生成。客户端不携带任何 GitHub 凭据，且当 feed 或包无法通过校验时以失败关闭（fail closed）。
6. D126 后续解除了 D010 仅限 macOS 的发布范围，并发布发布矩阵产出的所有平台工件与更新清单。macOS 在签名的应用内通道单独通过资格验证之前，仍保持通知并跳转的方式。
7. 双语产品“新增内容”文本（D164）在 `packages/shared` 中作为 EN + zh-CN 目录维护。主进程使用产品 UI 语言环境为所发现的版本格式化说明，并将其作为可选的 `UpdateState.releaseNotes` 附加到既有的更新路径上。GitHub 自动生成的发布正文仅保留在 Web 端；渲染器绝不提供说明 URL。

## 后果

- 更新状态由进程拥有，并在应用菜单、设置与常驻横幅之间保持一致。
- 沙箱化的渲染器无法重定向更新流量或安装任意包。
- Windows NSIS 与 Linux AppImage 可以从已发布的 tag feed 进行应用内更新；macOS 与 Linux deb 用户则从发布页面安装。
- 预发布安装可通过同一个 latest feed 升级到更新的稳定版；专用 RC 通道未启用。
- 应用内双语言发布亮点随构建一同发布，并遵循产品语言环境，无需第二个网络面。
- 签名、回滚、分阶段发布与可选的预发布通道策略仍属于运维后续工作，而非渲染器能力。

## 替代方案

- 由渲染器拥有更新器：拒绝，因为其违反了进程与沙箱边界。
- 由调用方提供 feed URL：拒绝，因为这会形成任意包安装路径。
- 在每个平台上强制使用单一交付模式：拒绝，因为安装器与签名保证因目标不同而异。
