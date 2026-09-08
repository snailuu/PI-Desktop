# 界面

> **翻译说明：** 本页是与 [英文源页面](/guide/screenshots) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

下方的每一帧都来自支撑
[E2E 测试计划](/zh-CN/spec/06-delivery/04-e2e-test-plan) 的采集装置：应用以
`PI_DESKTOP_CAPTURE=1` 对着一个临时数据目录运行，自动遍历每一个界面，
并写出 PNG，再由 `scripts/publish-screenshots.py` 转换成本页所用图片。因此这些
截图展示的是实际发布的 shell，而不是效果图，其中也包括全新安装时的空状态。

会话标题和对话记录来自采集夹具，所以外壳是英文，而示例对话是中文。
[中文版本](/zh-CN/guide/screenshots) 展示的是同一批界面，只是外壳为中文。

## 主页与对话

主页是全新安装后显示的第一个界面：一个 hero 区域、输入框，以及按项目分组的会话侧边栏。

![浅色主题下的 PI-Desktop 主页](../../public/screenshots/app/zh/home-light.webp)

![深色主题下的 PI-Desktop 主页](../../public/screenshots/app/zh/home-dark.webp)

![深色主题下的聊天页面](../../public/screenshots/app/zh/dark-home.webp)

对话以流式方式写入对话记录，右侧带有一条小地图轨道；
悬停在轨道上会放大地标标记，并预览光标所在位置的消息。

![带有小地图轨道的对话](../../public/screenshots/app/zh/minimap.webp)

![光标下被放大的小地图轨道](../../public/screenshots/app/zh/minimap-hover.webp)

输入框中的“模型 × 推理”标签可为该会话切换模型。在输入框中，`/` 打开命令菜单，
`@` 打开文件引用菜单。

![输入框中的模型与推理菜单](../../public/screenshots/app/zh/model-menu.webp)

![输入框中的斜杠命令菜单](../../public/screenshots/app/zh/composer-slash.webp)

![输入框中的 @ 文件菜单](../../public/screenshots/app/zh/composer-at.webp)

## 工作面板

当代理产出工件时，工作面板会在对话旁边打开。下面的几帧是没有活动工作区时的面板，
也就是对话启动时所在的状态。

![审查面板](../../public/screenshots/app/zh/panel-review.webp)

![浏览器预览面板](../../public/screenshots/app/zh/panel-browser.webp)

![文件浏览面板](../../public/screenshots/app/zh/panel-files.webp)

![工作面板切换菜单](../../public/screenshots/app/zh/panel-menu.webp)

## 页面

拉取请求、项目归档和定时任务都是从侧边栏进入的整页界面。

![拉取请求页面](../../public/screenshots/app/zh/pulls-live.webp)

![深色主题下的拉取请求页面](../../public/screenshots/app/zh/dark-pulls.webp)

![项目归档](../../public/screenshots/app/zh/project-archive-live.webp)

![深色主题下的项目归档](../../public/screenshots/app/zh/dark-project-archive.webp)

![定时任务](../../public/screenshots/app/zh/scheduled-live.webp)

## 通知与 Toast

通知收件箱为已完成的工作、权限请求和更新通知保留持久记录。
Toast 则覆盖同一范围内稍纵即逝的那一端。

![浅色主题下的通知收件箱](../../public/screenshots/app/zh/notifications-light.webp)

![深色主题下的通知收件箱](../../public/screenshots/app/zh/notifications-dark.webp)

![窄窗口中的通知浮层](../../public/screenshots/app/zh/notifications-narrow.webp)

![浅色主题下的成功、警告和错误 Toast](../../public/screenshots/app/zh/toasts-light.webp)

![深色主题下的成功、警告和错误 Toast](../../public/screenshots/app/zh/toasts-dark.webp)

## 全局搜索

`⌘K` 会在会话、页面、设置项和命令之上打开同一个对话框。
选中某个设置项的结果会导航到相应标签页，并闪烁该行。

![带最近会话的全局搜索](../../public/screenshots/app/zh/search.webp)

![匹配会话的全局搜索](../../public/screenshots/app/zh/search-query.webp)

![匹配设置项的全局搜索](../../public/screenshots/app/zh/search-settings.webp)

![匹配目标页面的全局搜索](../../public/screenshots/app/zh/search-pages.webp)

![从搜索打开的设置项](../../public/screenshots/app/zh/search-anchor.webp)

![深色主题下的全局搜索](../../public/screenshots/app/zh/search-dark.webp)

## 插件

已安装的插件、插件市场以及打包工作流都位于插件页面。

![已安装的插件](../../public/screenshots/app/zh/plugins-live.webp)

![插件市场](../../public/screenshots/app/zh/plugins-market.webp)

![插件页面菜单](../../public/screenshots/app/zh/plugins-menu.webp)

![单个插件的行菜单](../../public/screenshots/app/zh/plugins-row-menu.webp)

![新建插件模板对话框](../../public/screenshots/app/zh/plugins-template.webp)

## 扩展

MCP 服务器、Skills 和子代理都独立于插件进行管理，各自都支持全局或项目范围的激活。

![MCP 服务器](../../public/screenshots/app/zh/extensions-mcp.webp)

![激活范围选择器](../../public/screenshots/app/zh/extensions-scope.webp)

![MCP 服务器编辑器](../../public/screenshots/app/zh/extensions-mcp-editor.webp)

![Skills](../../public/screenshots/app/zh/extensions-skills.webp)

![子代理](../../public/screenshots/app/zh/extensions-subagents.webp)

![插件提供的子代理](../../public/screenshots/app/zh/extensions-subagents-provided.webp)

![子代理编辑器](../../public/screenshots/app/zh/extensions-subagent-editor.webp)

![深色主题下的子代理](../../public/screenshots/app/zh/extensions-subagents-dark.webp)

![深色主题下的 MCP 服务器](../../public/screenshots/app/zh/extensions-mcp-dark.webp)

## 设置

设置是一个整页界面，带有一条可搜索的标签栏。

![基础设置 — 语言、主题和外观](../../public/screenshots/app/zh/settings-live.webp)

![深色主题下的基础设置](../../public/screenshots/app/zh/dark-settings.webp)

![模型配置中的供应商默认值](../../public/screenshots/app/zh/settings-models.webp)

![带目录源选择器的扩展市场](../../public/screenshots/app/zh/settings-extensions.webp)

![使用自定义目录 URL 的扩展市场](../../public/screenshots/app/zh/settings-extensions-custom.webp)

## 重新生成这些截图

构建渲染器，确认 `target/debug/pi-desktop-host-core` 已存在，创建
`/tmp/codex-screens`，然后为每个语言各运行一次应用并发布每一轮的结果：

```bash
pnpm --filter @pi-desktop/desktop build
mkdir -p /tmp/codex-screens

# 英文轮次；中文轮次追加 --lang=zh-CN。
cd apps/desktop && PI_DESKTOP_CAPTURE=1 PI_DESKTOP_DATA_DIR=$(mktemp -d) \
  ELECTRON_RENDERER_URL= ./node_modules/.bin/electron .

python3 scripts/publish-screenshots.py --source /tmp/codex-screens --locale en
```

当最后一个场景写出后，采集装置会打印 `CAPTURE_DONE`。
