# DSH Plugins

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供会话侧栏、项目管理和界面打磨的三个独立插件。插件可以分别安装、启用和停用。

| 插件 | 当前版本 | 功能 |
| --- | --- | --- |
| [会话收件箱](docs/inbox-sidebar.md) | `dsh-inbox-sidebar 0.6.0` | 跨项目会话列表、搜索、置顶、提醒和已收起列表 |
| [项目管理](plugins/dsh-project-manager/README.md) | `dsh-project-manager 0.1.5` | 项目名称与图标、检出目录、多环境与自定义操作 |
| [DSH Polish](plugins/dsh-polish/README.md) | `dsh-polish 0.1.44` | 磨砂材质、紧凑标题栏、原生滚动条、输入区和设置页细节 |

当前适配 DSH Desktop `0.2.2-rc.1`，开发和验证环境为 macOS。插件复用宿主的 React、控件、主题及业务服务；部分样式依赖当前版本的组件结构，升级 DSH 后需要重新核对。

本项目为独立扩展，与 DeepSeek 官方无隶属关系。

## 从源码安装

需要 Node.js 22 或以上、npm，以及已安装并提供 `dsh` 命令的 DSH Desktop。

```sh
git clone https://github.com/hahajiukanjian0911/dsh-plugins.git
cd dsh-plugins
npm ci
npm ci --prefix plugins/dsh-project-manager

npm run check
npm run check --prefix plugins/dsh-project-manager
npm run check --prefix plugins/dsh-polish

mkdir -p releases
npm run package
npm run package --prefix plugins/dsh-project-manager
npm pack ./plugins/dsh-polish --pack-destination ./releases
```

选择需要的插件安装：

```sh
dsh plugin --profile desktop add "$PWD/releases/dsh-inbox-sidebar-0.6.0.tgz"
dsh plugin --profile desktop add "$PWD/releases/dsh-project-manager-0.1.5.tgz"
dsh plugin --profile desktop add "$PWD/releases/dsh-polish-0.1.44.tgz"
```

安装后正常退出并重新打开 DSH。各插件可在 DSH 插件管理中分别停用。

## 开发与验证

- 仓库根目录是会话收件箱插件；另外两个插件位于 `plugins/`。
- 修改 `src/` 后运行对应插件的 `check`，生成发布入口并执行单测。项目管理构建复用仓库根目录的 esbuild。
- 原生组件后台预览需要本机安装 DSH；页面使用隔离数据，不会启动用户会话。浏览器检查默认使用 macOS 的 Google Chrome。
- `DSH_PROFILE_DIR` 可指定侧栏集成检查读取的 desktop profile，默认位于当前用户的 `~/.dsh/profiles/desktop`。
- 一些历史对照脚本需要本机保留的旧安装包或验收材料，未包含在通用快速检查中。
- `outputs/`、`temp/`、`releases/` 和本机配置备份不纳入版本控制；安装包可按上面的命令重新生成。

当前快速检查验证构建与单测。原生窗口中的交互体验需要安装后上手确认；源码推送不代表所有平台和 DSH 版本均已验收。

## 许可证

本仓库采用 [MIT](LICENSE) 许可证。保留的 T3 Code 参考源码及 Lucide 图标各自保留许可证和来源说明，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与各插件目录。当前会话侧栏构建不打包历史 T3 组件实现。
