# 产品白板 0.1

给产品经理使用的开发前共识白板。主板呈现核心想法、流程、视觉参考和关键交互；下层保留依据、分支、异常、备选方案与讨论过程。

## 本机试用

0.1.0 已在本机 Codex 安装并启用。打开 [产品白板](http://127.0.0.1:5210/?board=example)，点击顶部项目名 → **新的产品**，填写目标与想融合的体验。窄屏从“更多操作 → 新的产品”进入。

在 Codex 新聊天中输入“用产品白板，和我讨论一个产品想法”，可调用已安装的 Skill 与 MCP 工具。工具会按需启动本机服务，并返回白板地址。旧聊天可能需要新聊天才能加载新增插件。

首屏“慢一点”带有“示例”标识，包含预置讨论。新产品从空白开始；右侧发送的新问题使用真实 Codex 模型回应。

## 0.1 功能

- 自由画布：拖动、缩放、连接、编辑、移出与撤销；多产品切换。
- 多媒体想法：便签、三步流程、风景或艺术图片、可编辑的输入与反馈原型。
- 双向讨论：主动质疑、回应反驳、具体场景举例；候选等待采纳，钉住由用户决定。
- 多层依据：编辑并展开下层内容，最多八层；核心标题和摘要保持简洁。
- 偏好默认：持久保存有来源的习惯；宿主可见的可靠记忆由 Skill 自动补充，当前项目要求优先。没有可靠技术栈信息时留空。
- 本机保存：服务端文件自动落盘，刷新、关闭页面、插件更新后保留；独立修改并发合并，同字段冲突显示错误。
- 开发交接：保存完整 JSON 与 Markdown，包含目标、主板、层次、关系、原型配置、讨论和候选；JSON 可以重新导入为新产品。

原型用于讨论单次交互，输入、提交与反馈可实际操作；演示输入不会成为真实业务记录。0.1 没有任意页面原型编辑器、多人同步、账户或云存储，也没有自动执行产品业务。

## 数据与模型

macOS 数据目录为 `~/Library/Application Support/Product Whiteboard/`，白板、偏好、近二十次保存快照和导出均在此目录。它与插件缓存分开，重新安装不删除产品资料。测试白板放在 `acceptance/2026-09-30/`，不会混入试用列表。

网页讨论调用本机已登录的 Codex CLI。发送讨论时，产品内容、相关偏好、最近讨论和最多三张白板图片会交给当前 Codex 登录所用的模型服务。没有额外 API Key 输入。存储边界见 [PRIVACY.md](PRIVACY.md)。

## 开发与安装

需要 Node.js 20+、npm、已安装并登录的 Codex CLI。本次验收使用 Codex CLI 0.159.0。

```bash
npm ci
npm run install:local
npm test
npm run verify:host
```

`install:local` 构建前端、打包 MCP 与 Skill、注册本机市场、安装插件并核对安装文件；只在确认进程属于本插件且讨论已结束时刷新服务。不会设置开机启动或发布到外网。

构建包位于 `release/product-whiteboard/`，本机市场清单位于 `.agents/plugins/marketplace.json`。打包格式依据 [OpenAI 插件文档](https://developers.openai.com/plugins/build/plugins)，使用受支持的 `.codex-plugin/plugin.json`、Skill 与 stdio MCP。公开市场提交留待试用后处理。

前端采用 React、TypeScript、Vite 与 React Flow。开发预览前先运行本机插件并在同一浏览器打开 5210 地址，以取得会话，再运行 `npm run dev -- --port 5199`。开发预览代理 `/api` 到已运行的本机服务。

卸载本插件：

```bash
codex plugin remove product-whiteboard@product-whiteboard-local
```

该命令移除插件缓存，保留上述数据目录；已启动的本机服务会持续到进程退出或重启。没有修改其他插件。

## 验收

[0.1 实际验收记录](design/V0.1-ACCEPTANCE.md)包含本机安装、宿主加载、真实模型辩论、数据落盘和界面结果。桌面实图为 [v0.1-installed-desktop.png](design/v0.1-installed-desktop.png)。[早期视觉稿记录](design/VERIFICATION.md)仅作为历史资料。

项目是独立本地 Git 仓库，未配置远程，未提交公开市场。
