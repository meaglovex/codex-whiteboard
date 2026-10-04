# 开发进度图 · 0.3.1

用户要求：构思时是产品经理的证据墙，开发时切换为项目经理的进度图；节点必须易读，不使用可爱的小岛、树木、建筑。

## 当前视觉方向

0.3.1 根据用户要求直接沿用现有构思白板材质。以运行中的构思页为参照，复用 `charcoal-felt.jpg`、`slate-paper.jpg`、纸纹/胶带/图钉 tokens 和宋体标题。原 0.3.0 的平面卡片视觉稿仅保留为版本记录。

## 设计和数据契约

- 主视图为带方向的里程碑依赖图，复用 React Flow。最多 24 个节点，稳定拓扑顺序，桌面三列折返，窄屏单列并聚焦当前阶段。
- 每个节点直接显示编号、阶段名称、文字状态、完成任务数和下一步。大标题、明确对比度、足够点击区域。
- 桌面宽度不小于 1440 px 时显示右侧任务面板；更窄时点击节点打开 Sheet，避免将节点缩成小字。
- 真实依赖产生连线，状态由任务聚合。未满足依赖的未开始阶段显示待解锁，仍可点开阅读。
- 完成度按有效任务数计算；取消项排除。没有工期数据就不伪造甘特日期。
- React 负责语义、状态和选择，React Flow 负责 SVG 连线、节点、平移缩放。状态更新保持坐标和选择，不使用随机布局。
- URL 保存视图和选中里程碑；显式打开的项目不被其他项目的更新抢走。
- 同步采用关键事件写入和约 900 ms 检查。最后同步时间始终可读，长时间无更新和网络错误保留最后数据。
- 新增组件复用官方 shadcn Tabs、Progress、Button、Badge、Sheet 和 Accordion。字体、状态、节点文本与比例均是实际 UI，未用图像承载数据。
- 参考来源：任天堂世界地图选关 https://en-americas-support.nintendo.com/app/answers/detail/a_id/63381/p/897/c/874 ；Mega Crit 官方游戏介绍 https://store.steampowered.com/app/646570/Slay_the_Spire/ 。借用关卡推进与路线阅读方式，不复用游戏素材。

## 视觉稿

`development-map-concept.png` 为桌面；`development-map-mobile.png` 为窄屏。图中任务数只用于视觉排版，实际产品数据由同步记录决定；不采用移动稿中重复的编号或无根据的宣传文案。

## 桌面生成提示词

```text
Design a Chinese project-manager progress board in restrained dark mode for a product whiteboard. The user explicitly rejected cute islands, trees and buildings. NO game scenery, NO 3D platforms, NO mascots, NO fantasy illustration. Keep only the useful game-level reading pattern: clearly named stages connected by dependencies. Every stage is a LARGE READABLE RECTANGULAR CARD. Actual editable UI text, shadcn-style controls, simple SVG links and standard outline icons. Graphite #14191f, slate surfaces #222b35, high-contrast white main text, cool gray secondary text, calm green completed states, coral blockers, blue current/selected accents. No decorative imagery or gradients. No nested mini-panels or tiny unreadable labels.
Full 1536x1024 desktop app screen. Top toolbar with existing simple panel outline icon and “产品白板”, divider “内网通”, segmented tabs “产品构思” and active “开发进度”, right “随开发更新”, “查看计划” and ellipsis.
Compact project heading “内网通 · 开发进度”, subtitle “实现与模拟器验收已有记录，下一步是真机验收。”. Right concise summary “8 / 13 项已完成”, actual-ratio slim bar, “3 项受阻”, “最近同步 15:42”.
Main canvas about 1040px wide left, 390px right inspector. SIX stage cards in two rows of three with at least 36px gaps and clean direction arrows routed through those gaps. Top row left-to-right stages 01,02,03; bottom row returns right-to-left 04,05,06. All cards roughly 270–290px wide and 190px tall. Stage titles at least 22px, status 14px, counts and next action 15px. No floating icon-only levels.
Each card must show FOUR things clearly: stage number + bold title; text status badge; completed task count and a small progress bar; one line of next step or verified result.
01 范围确认 / 已完成 / 2 / 2 项 / 范围与商业方向已确认
02 交互原型 / 已完成 / 1 / 1 项 / 原型已交付
03 功能实现 / 已完成 / 3 / 3 项 / 多设备客户端与服务端
04 模拟器互通 / 已完成 / 2 / 2 项 / 配对、访问与撤销已有记录
05 真机验收 / 受阻 / 0 / 3 项 / 等待真实设备验收记录 — SELECTED, clear thin coral outline, no glow
06 发布交付 / 待解锁 / 0 / 2 项 / 前置：真机验收
Right inspector “05 真机验收”, status “受阻”, summary “补齐真实设备与运行环境的验收证据。” Readable three task rows: 鸿蒙真机与跨网验证; Windows 实机运行; 后台运行与休眠恢复. Each has a text state and an icon. First task selected.
Below a subtle alert: “等待真机验收记录”, “需要手机、电脑和两个真实网络环境。” Then “验收依据”, row “发布准备记录 · 2026-10-04”. At the bottom “最近进展” with “建立开发进度基线”.
Map bottom legend uses icon + word for 已完成 / 进行中 / 待验收 / 受阻 / 待解锁 and actual fit/zoom controls. No unrequested marketing footer. Data is illustrative for the concept and will be supplied from live records in code. Make node text the dominant visual element and leave absolutely NO decorative game islands. Full complete unclipped primary screen.
```


## 0.3.0 验收记录（2026-10-04）

- `npm test`：33 项通过，覆盖旧白板兼容、增量保留、事件重试去重、状态转换、依赖拒绝、任务计数、MCP 持久化与完整导出。
- 内置浏览器隔离验收：首次进度同步自动切换到开发阶段；节点鼠标与键盘操作、任务选择、展开依据和 Markdown 计划均可用。任务从受阻转为进行中再完成时，计数与记录即时刷新，既有选择和视口不跳动。
- 用独立测试项目改变活动白板后，已明确打开的项目保持原页；刷新 URL 保留开发视图与里程碑选择。返回产品构思仍显示原来的 6 张卡片。
- 从页面实际点击导出后回读 JSON、Markdown 和 plan.md，确认 13 项任务、6 张原构思卡片、验收条件与完整计划均保留。
- 390 × 844 窄屏聚焦当前阶段，330 px 宽节点与任务 Sheet 可读；1536 × 1024 桌面采用三列折返路线和任务侧栏。深浅色均实看，浏览器无错误日志。
- 真实 MCP Apps 隔离验收宿主验证了自动进入开发阶段、节点打开、构思/开发切换和宿主主题变化。原生 iframe 不改写浏览器 URL，避免受沙箱源限制；网页仍保留深链接。此项不冒充 Codex 桌面菜单实显验收。
- 已安装插件文件与构建核对一致。Codex app-server 实际加载 `whiteboard_progress`、启用 Skill 和 `ui://product-whiteboard/board-v0.3.0.html`，无 Skill 加载错误。
- 实际「内网通」白板由 revision 26 增至 28，读取确认 6 个阶段、13 项任务（8 完成、3 受阻、2 待办）。旧目标、6 张构思卡片、关系、消息与多层依据逐项比较一致。新增独立的当前交付计划，没有替换原构思。
- 项目基线引用现有产物与历史验收记录，并实际执行 `npm run native:test`：19/19 通过。未重跑模拟器、Windows EXE 或真机验证；这些范围和正式发布仍分别保留。

### 视觉核对

[桌面实际截图](v0.3.0-installed.png)和[窄屏实际截图](v0.3.0-narrow.png)来自已安装版本与真实项目数据。最终界面保留概念稿的大矩形阶段节点、两行折返方向、文字状态和任务详情；移除概念图中的装饰图标、渐变和估算百分比，以官方 shadcn 组件呈现可操作内容。概念稿不参与运行时渲染。未使用小岛、树木、建筑或其他游戏场景。

“实时”范围是 Codex 在关键开发事件后调用工具，网页随后读取；未实现后台仓库监听。旧聊天可能仍使用旧工具缓存，新聊天已验证可加载 0.3.0。日历甘特图尚未实现，当前没有据实工期时不展示虚构日期。

## 0.3.1 材质调整

- 底板：复用构思视图的毡布素材和深浅色覆盖层。
- 节点：保留大矩形与固定布局，采用冷灰纸纹、图钉、细纸边和投影；少量横线纸/方格纸区分阶段。
- 排版：标题沿用宋体，正文和数量保留清楚的系统字体。状态和计数并排，状态改为印章。
- 连线与详情：真实依赖使用原白板的红线色；桌面任务面板是胶带固定的纸页，窄屏 Sheet 沿用同一纸纹。
- 文案与数据：可见任务文案、阶段、验收依据和计数不变。调整只影响展示。
- 实际检查：内置浏览器检查 1536 × 1024 桌面、390 × 844 窄屏及深浅色；节点选择、任务详情与查看计划正常，未见浏览器错误。将原构思页与新进度截图逐项核对了底板、纸纹、标题、状态、连线和详情面板，保留了进度图所需的有序布局。
