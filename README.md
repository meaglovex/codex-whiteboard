# 产品白板 0.1.2

Codex 对话驱动的产品开发前白板。用户说出新产品想法，Codex 自动建一页、边讨论边更新；白板只呈现核心想法、流程、视觉参考和关键交互，下层保留争论、分支与开发依据。

## 本机试用

安装后，在新的 Codex 聊天直接说：

> 我想做一个把相册回看和便签记录结合起来的日记产品，先讨论目标与核心流程。

不需要提到插件或手动新建。Skill 隐式识别新产品意图，调用 `whiteboard_begin` 建板并打开；同一产品的后续讨论复用这一页。讨论和反驳都在当前 Codex 聊天进行，每轮由 `whiteboard_sync` 更新核心内容，已有白板窗口自动跟随当前产品。

卡片上只有“查看依据”，展开后可继续看下层和下下层。尚未确认的判断显示“讨论中”；用户在聊天中明确达成共识后，Codex 更新状态。图片与交互原型仍可呈现，原型可以实际试用一次输入、提交和反馈。画布可平移、缩放，历史白板和开发上下文导出收在顶部更多菜单。

普通已有项目修复不新建白板，明确拒绝白板时不触发。直接要求开发也不会增加额外批准关卡。自动识别由 Codex 的 Skill 选择实现，仍取决于模型遵循规则；没有用关键词 Hook 截断用户请求或强行改写宿主聊天。

[本机白板](http://127.0.0.1:5210/)也可直接打开。原生入口位于聊天右侧 **新标签页 → 更多工具… → 产品白板**。运行中的旧聊天可能保留插件工具缓存，新聊天加载更新后的插件。

## 数据与开发依据

- 核心卡片使用稳定 ID，讨论修订更新原卡；多层依据按 ID 合并，保留未提及的子内容。
- 同一对话和产品标识重复建板只产生一页，切换不同产品产生独立白板。
- 用户常用技术栈、设计和习惯从插件偏好及宿主已可见的可靠记忆补充，并记录来源；不把推荐冒充记忆。
- 白板与偏好落盘到 `~/Library/Application Support/Product Whiteboard/`，与插件缓存分开；重装保留资料。
- 保留近二十次修改快照，完整 JSON 和 Markdown 导出包含所有层次、关系、原型与讨论。

讨论直接使用当前 Codex 聊天的模型能力。界面没有另一个聊天框，也不再启动一个额外模型回合。0.1 没有多人同步、账户、云存储或任意页面原型编辑器；原型试用输入不会成为真实业务记录。存储与模型边界见 [PRIVACY.md](PRIVACY.md)。

## 开发与安装

需要 Node.js 20+、npm、已安装并登录的 Codex CLI；本机验收使用 CLI 0.159.0。

```bash
npm ci
npm run install:local
npm test
npm run verify:host
```

`install:local` 构建前端、打包 MCP 与 Skill、注册本机市场、安装插件并核对文件，只在确认旧进程属于本插件且讨论已结束时刷新服务。不设置开机启动，不发布外网，不修改其他插件。

前端沿用 React、TypeScript、Vite 和 React Flow，官方 shadcn/ui Base Nova 组件与主题。MCP Apps 面板通过宿主转发限定的插件接口，没有私有令牌或外部脚本。`whiteboard_open` 声明菜单入口，`whiteboard_begin` 带相同面板资源；插件格式依据 [OpenAI 文档](https://developers.openai.com/plugins/build/plugins)。

`node scripts/preview-mcp-panel.mjs` 启动真实 MCP Apps 人工验收宿主：5321 为界面，5322 为服务，独立 `.test-data/native-viewer/` 数据；它不代表 Codex 桌面菜单实显已通过。`node scripts/verify-implicit.mjs` 使用真实 Codex 模型在隔离目录验证自然语言触发、反驳后的增量更新和普通修复不触发，会消耗模型额度，不纳入默认单元测试。

构建包位于 `release/product-whiteboard/`，本机市场清单位于 `.agents/plugins/marketplace.json`。公开市场提交留待用户试用后处理。项目是独立本地 Git 仓库，未配置远程。

```bash
codex plugin remove product-whiteboard@product-whiteboard-local
```

卸载保留本机资料；已启动的本机服务持续到退出或重启。

## 验收记录

[0.1.2 对话驱动验收](design/V0.1.2-ACCEPTANCE.md)记录当前结果。
