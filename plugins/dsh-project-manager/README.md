# DSH 项目管理 0.1.5

独立插件 `dsh-project-manager`。在 DSH 原生设置中增加「项目」和「环境」，沿用 T3 Code 的项目列表、基本信息、检出目录与项目操作结构。搭配 `dsh-inbox-sidebar` 0.6.0，侧栏会话和新会话项目选择器共用项目设置数据与图标组件。

## 当前版本

`0.1.5` 为新会话项目选择器增加可选的会话上下文贡献。配合 DSH Polish `0.1.18`，同一个项目入口显示当前分支，菜单内开关工作树和选择基准分支；状态和操作仍由原生 Forge 提供。项目管理只承载标题摘要和菜单项目，不增加自己的工作树存储或创建流程。未启用 Polish 时保持原项目选择器。项目元数据加载失败时可用原生已登记工作区回退，保留上下文入口。

## 使用

安装后重新启动 DSH，打开「设置 → 项目」。已有 DSH 工作区自动出现在列表中，无需重新导入。

- 名称：选择全部环境可批量改名；选择一个环境只改该环境的登记名称。
- 图标：原生图标与颜色、Emoji、1–2 字文字、PNG/JPEG/WebP 图片；自动图标取项目名称。
- 检出目录：同一 Git origin 自动合并，可从目录菜单改为独立项目、归入其他项目或恢复自动分组。添加目录只登记已有目录。
- 目录菜单：新会话、打开目录、在 VS Code/Cursor 中打开、移除检出目录。
- 新会话项目选择器：输入框上方按钮和菜单同步项目名称与图标，目录作为次要信息；同一项目有多个本机检出目录时展开选择，保留 DSH 原生未发送草稿和附件转移、添加目录与失败重试流程。项目服务尚未就绪时回退原生工作区选择器。
- 置顶与归档：控制项目列表、项目选择器及新版会话侧栏。归档项目可从「显示已归档项目」找回；侧栏仍保留正在使用或有工作状态的项目。
- 项目操作：名称、图标、Shell 命令；指定检出目录运行、查看输出、停止进程组、查看最近运行。默认操作可共享，项目可覆盖并恢复继承；环境筛选决定编辑范围。
- `t3.json`：预览并导入命令，跳过名称或命令重复项，导入本身不运行命令。
- 移除项目：删除 DSH 工作区登记，保留磁盘目录和已有会话；再次登记目录可继续使用。

「设置 → 环境」可粘贴另一台 DSH 的带 token 启动地址建立连接。对方也须安装此插件。令牌和登录 Cookie 保存在 DSH 的 credentials 服务中；项目配置只保存不含 token 的地址。离线环境保留上次缓存的目录，禁用需要在线的操作；授权失效时重新连接。

本插件的分组、图标、操作覆盖和环境登记存储在当前 DSH 主机，所有连接此主机的浏览器共享。它不改写另一台 DSH 的项目管理偏好；改名、目录登记、命令运行与目录打开会发往所选主机。远程新会话在该 DSH 的新窗口打开。

## 与 T3 Code 的边界

本版覆盖这次约定的项目管理范围：基础项目管理、自定义脚本、多环境检出分组。DSH 的原生工作区服务作为目录和会话的唯一来源。

- 不改写 DSH 其他设置页，也不新增工作树创建器、源代码管理或模型配置。
- 项目管理插件自身不替换原生侧栏；`dsh-inbox-sidebar` 0.6.0 订阅本插件设置页的同一控制器，按会话显示项目身份。新会话按钮及菜单也接入该控制器，仍调用宿主选择工作区回调；只列当前 DSH 主机的目录，远程项目从设置页打开。其余原生工作区入口仍由 DSH 维护。
- 操作为显式运行的非交互命令，不是交互式终端。T3 的工作树创建、会话收起钩子、快捷键和内嵌浏览器预览字段不在这里执行；`t3.json` 导入只取名称和命令，图标转换为 DSH 原生代码图标。
- 输出保留最近 128 KiB 的文本；每台环境最多同时运行 8 个操作，保留最多 40 条运行记录。记录随 DSH 后端生命周期保留，卸载插件或关闭后端会停止本插件启动的操作。
- 当前在 macOS 验证。Linux/macOS 使用环境的登录 Shell；其他平台的脚本和编辑器启动尚未验证。

## 开发与验证

从仓库根安装基础开发依赖后：

```sh
npm ci --prefix plugins/dsh-project-manager
npm run check --prefix plugins/dsh-project-manager
npm run preview:build --prefix plugins/dsh-project-manager
npm run verify:ui --prefix plugins/dsh-project-manager
```

构建使用仓库根的 esbuild 和 Babel 开发依赖。后台页面使用本机已安装 DSH 的 React、SettingsPanel、UI primitives、图标和主题，RPC 为隔离示例。后端测试通过真实版本的 DSH Gateway，临时 Git 目录、双环境认证 HTTP 测试服务和实际子进程检查分组、改名、继承、停止与移除语义，不修改用户项目。

```sh
dsh plugin --profile desktop add "$PWD/releases/dsh-project-manager-0.1.5.tgz"
```

后台渲染、安装和原生窗口验收分别记录；未主动激活 DSH 或操作用户窗口。从仓库根运行 `node scripts/verify-composer-projects.mjs` 可检查新会话项目选择器。本机验收报告保留在未纳入版本控制的 `outputs/`。

## 方案来源

2026-11-11 核对了本机 T3 Code 源码与 DSH 0.2.2-rc.1 的原生接口。两项目为 MIT 许可证，GitHub 仓库均未归档，最近推送日期分别为 2026-11-11 和 2026-11-04。T3 Code 有 Homebrew Cask，但它是独立应用，不能直接作为 DSH 设置插件安装；现有 DSH workspace 能提供目录登记、改名和会话创建，因此扩展 DSH，比另建项目数据副本更合适。

- [T3 Code 安装与 Homebrew](https://github.com/pingdotgg/t3code/blob/main/docs/user/install.md)
- [T3 Code 项目设置](https://github.com/pingdotgg/t3code/blob/main/docs/user/project-settings.md)
- [DSH workspace](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/workspace/workspace/README.md)
- [DSH 源码与许可证](https://github.com/deepseek-ai/deepseek-harness)

只借鉴项目管理结构与操作范围，没有复制 T3 Code 实现代码。

## 可选会话上下文接口

`conversation.hero.workspace` 的项目组件以 `dshProjectContextVersion = 1` 标识支持可选 `projectContext`：`summary`、`tip`、`busy`、`items`、`selectedIds`、`onSelect(id)`。消费者保留原条目注入、语言和目录流程，不重复声明子插槽。`onSelect` 返回是否处理该 ID；处理后关闭菜单并归还焦点。上下文只用于当前组件实例，不写入项目配置。
