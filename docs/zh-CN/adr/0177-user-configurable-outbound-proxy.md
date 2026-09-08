# ADR 0177：用户可配置的出站代理

> **翻译说明：** 本页是与 [英文源决策](/adr/0177-user-configurable-outbound-proxy) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-09-08
- 决策者：PI-Desktop core
- 相关：D340、ADR 0083、ADR 0096、
  `04-ux/06-settings-ia.md`、`03-runtime/07-process-model.md`

## 上下文

出站 HTTP 分散在多个进程中：

- Electron 主进程 — 模型发现、models.dev 刷新、插件 `net.fetch`、
  OAuth 轮询、GitHub 相关拉取
- 代理 sidecar（Node `fetch` / pi-ai）— LLM 供应商调用
- host-core — 插件市场目录和包 `curl`
- Chromium 会话 — 默认会话、`persist:work-browser`、插件面板
- electron-updater — Chromium / Electron 网络

这些入口都不遵循某个产品级设置。使用 Clash、V2Ray、企业 HTTP 代理或 SOCKS5 的用户，其应用内浏览器有可用的系统/TUN 代理，但模型调用会静默失败，因为 Node 的 `fetch` 不使用系统代理。

单一设置控件应当将同一个代理应用于应用自有的流量。

## 决策

1. **设置 → 通用 → 网络** 将代理暴露为 System / Direct / Custom。Custom 接受 `http`、`https`、`socks`、`socks5` 和 `socks5h` URL，以及一个绕过列表。持久化是可选的，作为 `AppSettings.networkProxy` 存放在现有主机设置 blob 中。不提升协议或存储 schema 版本。

2. **System**（默认）：Chromium `session.setProxy({ mode: "system" })`。Node sidecar 保持直连，除非该进程已从启动 shell 继承了代理环境变量。这保留了当前 GUI 应用的行为。

3. **Direct**：Chromium `{ mode: "direct" }`。Electron 主进程中的代理环境变量键被清除。host-core 的插件市场 curl 使用 `--noproxy '*'`。

4. **Custom**：Chromium 使用 `proxyRules` + `proxyBypassRules`；Electron 主进程的 `fetch` 使用 `net.fetch`，因此 SOCKS5 走 Chromium 栈；sidecar 设置一个 undici dispatcher（HTTP(S) 用 `ProxyAgent`，SOCKS5 CONNECT + 同一个 undici `fetch`）；host-core 的 curl 从存储的设置中获取 `--proxy` / `--noproxy`。默认绕过列表为 `localhost,127.0.0.1,::1,<local>`，以便回环 MCP 和本地模型保持直连。

5. **不重写**：工作区 Bash（host-core 的 spawn 环境会剥离代理键，使凭据无法泄漏到 `env` 中），以及用于 OAuth 的系统浏览器（`shell.openExternal`）。插件工具进程保留其被剥离后的环境；`pi.net.fetch` 仍经过主进程。

6. **无需重启即可应用。** `settings.set` 更新 Chromium 会话（包括 `session-created`）、主进程环境和 `sidecar.configure`。测试操作（`pi-desktop/network/testProxy`）通过所提供的配置运行一次有界的 Chromium fetch，并且不会持久化该配置。

7. **密钥。** 代理 userinfo 存放在设置 JSON 中，与其他非 API 密钥偏好设置放在一起。日志会脱敏密码。host-core 绝不会把 URL `set_var` 到其进程环境中。

## 后果

- LLM、插件市场、更新和应用内浏览器共享同一个代理。
- System 模式不会神奇地让 Node 遵循 macOS/Windows 系统代理；需要模型调用经过 Clash 的用户仍应选择 Custom（通常为 `http://127.0.0.1:7890` 或 `socks5://127.0.0.1:1080`）。
- 向 sidecar 包中添加 `undici` 可以让 dispatcher 和 `fetch` 实现保持在同一个包中。

## 替代方案

- 仅环境变量（`HTTP_PROXY`）：Node `fetch` 在没有 dispatcher 的情况下会忽略它；SOCKS5 支持不完整；host-core 的 Bash 会继承凭据。
- `app.commandLine.appendSwitch('proxy-server')`：无法在运行时更改。
- 按供应商设置代理：无法覆盖插件市场、更新或浏览器。
