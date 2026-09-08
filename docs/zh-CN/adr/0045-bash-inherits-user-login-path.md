# ADR 0045：Bash 工具继承用户的登录 shell PATH

> **翻译说明：** 本页是与 [英文源决策](/adr/0045-bash-inherits-user-login-path) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-02
- 相关：[D084](/zh-CN/spec/08-meta/decisions-log) ·
  [工具与权限](/zh-CN/spec/03-runtime/03-tools-and-permissions)

## 背景

Bash 工具通过 `bash -lc` 运行代理命令（D084）。登录 bash 只会加载 bash profile，因此在 macOS 上——默认 shell 是 zsh，而 nvm、pnpm、Homebrew 等工具链是在 `~/.zshrc` / `~/.zprofile` 中初始化的——命令无法解析 `node`、`npm`、`pnpm` 以及任何仅由用户自己的 shell 导出的内容。从 Finder/Dock 启动应用还会进一步把环境缩减为最小的 GUI PATH。

## 决策

1. 在 Unix 上，首次 Bash 调用会探测用户登录 shell 的 PATH：`$SHELL`（回退顺序 `/bin/zsh` → `/bin/bash` → `/bin/sh`）执行 `-lic 'printf %s "$PATH"'`——`-l` 加载登录文件，`-i` 加载交互式 rc——并设置 5 秒超时，以免卡死的 rc 阻塞该工具。只保留 stdout 的最后一行，因此 rc 的横幅输出无法污染它；stderr 被丢弃（缺少 tty / 作业控制的噪声）。
2. 探测得到的 PATH 按进程缓存（`OnceLock`），并通过 `cmd.env("PATH", ...)` 注入每个 Bash 子进程。
3. 探测严格遵循尽力而为原则：失败时（没有 `$SHELL`、不可执行、退出码非零、超时）则原样使用宿主 PATH。Windows 继续使用 `bash -c` 并沿用宿主环境（无变化）。
4. 代理命令仍然是 POSIX bash；只有子进程环境的 `PATH` 被增强。解析得到的 bash 二进制本身不变。

## 影响

- `node`/`npm`/`pnpm`、Homebrew 工具链以及其他登录 shell 导出的内容都能在 Bash 工具调用中解析，与全新打开的终端保持一致。
- `bash -lc` 仍会在启动时重新运行 bash profile；conda/brew 钩子可能会前置、去重或重排条目——注入的登录 PATH 仍是用户 bash profile 所构建的基础。
- 整个开销仅为每个进程生命周期内一次有界的子进程（探测）；此后每次 Bash 调用都只读缓存。
- 缓慢或仅适用于交互式场景的用户 rc 会优雅地降级为先前行为，而不会导致该工具失败。

## 被否决的备选方案

- **在 `$SHELL` 而非 bash 中运行命令：** 违反 D084 的约定，即代理命令为 POSIX bash；zsh 的差异（`$path` 数组、echo/glob 语义）会悄然使行为分叉。
- **在包装命令中加载 rc 文件：** 很脆弱——命令行必须针对每种 shell 的 rc 语法做特殊处理，而且注入的前缀会出现在每个结果中。
- **在宿主中内置默认 PATH：** 无法得知用户的工具链；只是换了个形式的 Finder 启动问题。
