# ADR 0145：发布原生 macOS Intel 工件

> **翻译说明：** 本页是与 [英文源决策](/adr/0145-native-macos-intel-release-lane) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-01
- 决策者：PI-Desktop 主机核心
- 相关：D126、D285、ADR 0022、E2E-092

## 上下文

标签发布工作流此前只发布 Apple Silicon 的 macOS 工件。electron-builder
配置也将两个 macOS 目标都固定为 `arm64`，因此在不修改共享包配置的情况下
无法选择 Intel 构建。Rust 主机 sidecar 是从原生 `target/release` 输出打包的，
除非 sidecar 架构被独立管理并验证，否则交叉编译的 Electron 包是不安全的。

## 决策

1. 发布矩阵发布两个原生 macOS 通道：arm64 使用 `macos-15`，x64 使用
   `macos-15-intel`。工作流在准备包输入之前通过 `uname -m` 进行验证。
2. 静态 macOS electron-builder 目标保持为 DMG 和 ZIP，不固定 `arch`。工作流
   向 electron-builder 传递显式匹配的 `--arm64` 或 `--x64` 标志。
3. 每个 macOS runner 在本地构建 `pi-desktop-host-core`，并打包同一份原生输出。
   本地签名发布脚本默认使用宿主架构，并拒绝与之不匹配的 `MAC_ARCH` 覆盖。
4. 每个 macOS 作业在上传前重命名其生成的 `latest-mac.yml`。发布作业验证两个
   feed，合并其文件，并随两个架构的安装程序一起发布一个合并后的
   `latest-mac.yml`。
5. 在有签名的应用内更新通道通过验证之前，macOS 更新行为仍为通知并跳转链接。
   此决策仅改变发布工件覆盖范围和原生打包；它不改变更新器归属或签名策略。

## 后果

- Intel Mac 用户可从每次标签发布中获得原生 DMG 和 ZIP 工件。
- 在两个 macOS 通道上，Rust 主机与 Electron 可执行文件具有确定且匹配的架构。
- 发布上线需要一个元数据合并步骤，因为 electron-builder 会为每个架构生成一个
  macOS 更新器 feed。
- Intel 包的体积占用和原生启动验证必须与现有的 arm64 基线分开记录。
- 开发者无法使用本地签名通道交叉构建另一个 macOS 架构，除非先切换到匹配的
  原生 runner。

## 考虑过的替代方案

- 保持仅 macOS arm64：被否决，因为 Intel 用户仍无法安装原生发布版本，且所要求的
  平台覆盖未得到满足。
- 在 Apple Silicon runner 上构建 Intel 包：被否决，因为 Rust sidecar 由宿主原生
  发布目标生成，可能与 Electron 包不匹配。
- 永久发布独立的更新器 feed：被否决，因为当前 macOS 交付模式为通知并跳转链接，
  并且当有签名的更新通道可用时，GitHub Release 应只暴露一个 macOS feed。
