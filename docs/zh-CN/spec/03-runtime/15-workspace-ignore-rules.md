# 15. 工作区忽略规则

> **翻译说明：** 本页是与 [英文源规格](/spec/03-runtime/15-workspace-ignore-rules) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

## 1. 目标

默认阻止工具扫描/读取/写入敏感或无用的路径，同时在任务有意指向会话工作区之外的路径时，允许通过显式、可见的权限决策予以放行。

## 2. 规则层级（优先级 高 → 低）

1. **安全拒绝列表**（始终开启，MVP 中不可由用户禁用）
2. **应用默认值**（随产品发布）
3. **工作区规则**（`.pi-desktopignore` 或设置）
4. **用户全局忽略**（`~/.pi-desktop/ignore`）
5. 显式工具路径仍受安全拒绝列表和外部路径权限门控的约束

## 3. 安全拒绝列表（始终生效）

默认拒绝工作区之外的读取/写入/搜索。只有当宿主应用权限模式后，显式的 `Read`/`Glob`/`Grep`/`Write`/`Edit` 路径才可继续：`auto` 允许其执行，而 `ask` 与 `accept-edits` 会询问用户。隐式递归遍历绝不会获得工作区之外的访问权。

同时在工作区内也拒绝以下内容：
- `.git/objects/**`（可选优化；元数据后续可能允许读取）
- 私钥模式：`*.pem`、`*.key`、`id_rsa`、`id_ed25519`
- `.env`、`.env.*`（后续版本中读取可能被允许，但需权限提示；MVP 中对 Grep 内容导出默认拒绝）
- 凭据文件：`*.p12`、`*.pfx`、`credentials.json`（Google）、含 token 的 `.npmrc`（尽力而为）

> 精确的 env 文件策略后续可通过显式权限放宽；在 MVP 中对内容搜索采取失败关闭（fail closed）策略。

## 4. 默认忽略（应用）

```gitignore
node_modules/
dist/
build/
.target/
target/
.venv/
venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.DS_Store
*.log
coverage/
.turbo/
.next/
.cache/
```

## 5. 工作区文件

支持：

```text
.pi-desktopignore
```

语法：gitignore 兼容子集。

## 6. 工具行为

| 工具 | 忽略规则的适用方式 |
|---|---|
| Glob | 过滤结果 |
| Grep | 过滤文件集合 |
| Read | 显式路径位于工作区之外时受权限门控；拒绝后返回 `TOOL_DENIED` |
| Write/Edit | 显式路径位于工作区之外时受权限门控；拒绝后返回 `TOOL_DENIED` |
| Bash | 路径沙箱仍由宿主强制执行；忽略文件不会扩大 bash 的能力 |

## 7. 诊断

工具应返回稳定的错误：
- `PATH_OUTSIDE_WORKSPACE` —— 路径在做出外部路径权限决策之前越出工作区根目录，或未获权限的兼容性调用到达解析器
- `TOOL_DENIED` —— 外部路径权限被拒绝、超时或取消
- `WORKSPACE_PATH_DENIED` —— 为忽略规则/拒绝列表拦截保留的细分错误码（目前映射到 `PATH_OUTSIDE_WORKSPACE`；参见 [08-error-codes §3.7](/zh-CN/spec/03-runtime/08-error-codes)）

UI 后续可选地为 Glob/Grep 显示“已被忽略规则隐藏”的计数。

## 8. 验收标准

- [x] 非自动模式下工作区之外的路径需要权限，Auto 模式下允许
- [ ] 默认忽略规则使 Glob/Grep 隐藏 node_modules
- [ ] 工作区忽略文件生效
- [ ] MVP 中安全拒绝列表无法从 UI 禁用
