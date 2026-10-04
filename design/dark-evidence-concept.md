# 深色证据墙材质

2026-10-04。用户明确保留探案证据墙风格，只更换材质；不能改成普通现代卡片后台。

- 保留原有排布、微倾斜、图钉、胶带、纸张、印章、关系线和交互。
- 使用深色毡板、石墨金属边框、冷灰卡纸、钛色图钉和烟灰半透明胶带。系统浅色时采用冷白/浅灰材质，不使用黄色纸张。
- 深色画布约 #15191f，卡纸约 #343c47，正文 #eef1f5，次要文字 #bac2cf，印章用可读的灰玫瑰色与灰绿色。
- 系统主题变化即时生效；MCP 原生面板优先使用宿主主题。计划、依据、菜单、表单和原型与画布共用主题。
- 概念图中的红线是材质示意，实际界面仍只绘制已有关系。

## 生成方式

内置 imagegen，以上一版探案墙概念为编辑参考。另生成独立的深色细毡板与冷灰微纹理卡纸，分别保存为 src/assets/charcoal-felt.jpg、src/assets/slate-paper.jpg。

## 完整概念提示词

```text
Edit this detective evidence-wall app concept. Preserve the evidence-wall composition, all six physical notes, their asymmetrical positions and small rotations, the pinned project heading, readable Chinese content, real pin-and-thread relationship aesthetic, and evidence stamps. THE USER WANTS THE SAME DETECTIVE EVIDENCE WALL, ONLY WITH MODERN MATERIALS SUITABLE FOR DARK MODE. Do not turn it into flat dashboard cards or a generic SaaS workspace.
Replace the old warm cork, yellow paper, brown wooden frame, and beige tape with sophisticated cool modern materials: deep charcoal fine felt / matte magnetic board (#15181c), thin brushed graphite aluminum perimeter, cool slate-gray archival paper and semi-opaque frosted dark inserts (#2c3239 / #333c46), dark blue-gray notebook paper with very faint ruled/grid lines, small brushed titanium pin heads and smoked translucent tape. Retain tactile depth, realistic edge shadows, slight paper bends, pin fasteners and very fine muted crimson strings. This is an elegant contemporary detective case wall, with the precision and restrained material finish of a premium Apple product, not vintage or grungy.
All main text becomes clean warm-free white (#eef1f5), secondary text soft cool gray (#bac2cf), subtle stamps use legible cool gray/soft green or desaturated rose. Absolutely NO yellow, beige, cork brown, wooden grain, warm lighting, sepia, gold or orange. No neon, glowing sci-fi HUD, fake stats, added crime imagery, room, desk, monitor or logos.
Keep the top toolbar compact with “产品白板”, divider, “内网通”, “随对话更新”, and add the existing real action “查看计划” with a small document icon before the fit-view and ellipsis icons. Dark glass-like charcoal toolbar with clear text.
Keep main title “内网通” on a physically attached note. Keep notes headed “多设备客户端与双平台服务端”, “付费下载”, “Tailcat 与第三方代理兼容”, “不提供服务器 · 多对多”, “下载安装与扫码引导”, “上架与收款准备”. Keep “查看依据” links and “已形成共识” / “讨论中” stamps. Keep bottom footer. Make all notes highly readable against the dark materials.
Retain the actual evidence-board visual metaphor and physical attachments. The change is MATERIAL AND DARK-MODE COLOR, not information architecture or dashboard layout. Straight-on full 1536x1024 application screenshot concept, complete unclipped screen.
```

## 实现核对

- 原证据墙的卡片组件、排布算法、微倾斜、图钉、印章和关系数据保持一致。本次修改集中在材质、语义颜色和主题监听。
- 使用内置浏览器检查 1536 × 1024 深色/浅色画布及 390 × 844 深色单列。窄屏 DOM 和直接 CDP 截图均确认没有页面横向溢出；所有模拟覆盖已清除。
- 依据面板、菜单与已填写的 Markdown 计划随系统模式即时切换。深色正文为 rgb(238, 241, 245)，卡纸底色为 rgb(52, 60, 71)，计划面板底色为 rgb(34, 41, 51)。
- 真实 MCP Apps 验收宿主：初始 dark → 宿主 light → 宿主 dark 均立即更新 iframe 的 data-theme，控制台无警告或错误。
- 25 项测试通过，包括系统主题初值/变化、宿主主题优先级和监听器清理。主题变化不重写白板文件。
- 概念对照点：物理错位布局、冷灰卡纸/细毡纹理、银色固定件、浅色正文、状态印章和阅读面板。保留真实原文长度与现有关系；不把图中的摘要或示意连线写入数据。金属边框与图钉使用可缩放 CSS 近似表面反光，没有烘焙界面文字。
- 首屏文案没有新增、删除或改名；仅 HTML 默认标题去掉无关示例名称。卡片、依据和计划仍使用原来的可编辑/可读取组件。

## 独立材质提示词

### 毡板

Create a standalone seamless production background texture matching ONLY the deep charcoal felt/matte pinboard in the reference. Uniform flat straight-on fine dark neutral blue-black felt fibers, overall color #15191f, subtle short fine textile fibers. Square 1024x1024 fully edge-to-edge, uniform neutral lighting, repeatable tile, no gradient, no vignette, no directional shadows. Absolutely NO frame, pins, strings, papers, labels, text or objects. No brown, cork, yellow or warm hues. It is a tactile contemporary detective evidence-wall substrate behind real editable UI.

### 卡纸

Create a standalone seamless production paper texture matching ONLY the cool charcoal archival card paper in the reference. Flat edge-to-edge 1024x1024 square, medium cool slate-gray #343c47, very subtle paper fibers and barely visible fine creases, uniform diffuse neutral lighting, repeatable. Low texture contrast so white text placed later remains easy to read. NO edges, borders, labels, grid, lines, text, tape, pins, strings, frame or other objects. NO yellow, brown, sepia, orange or warm hues. Real elegant tactile gray paper, not a smooth generic UI fill.
