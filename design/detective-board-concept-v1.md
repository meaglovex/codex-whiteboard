# 探案证据墙视觉稿

- 日期：2026-10-04
- 状态：用户确认后已实现为 0.2.0，见 `V0.2.0-ACCEPTANCE.md`。
- 用户要求：先用 imagegen 重新设计，像电影里警察探案时使用的证据白板。
- 生成方式：内置 imagegen。
- 设计图：`detective-board-concept-v1.png`（1536 × 1024）。
- 内容参考：当前打开的「内网通」白板，共 6 个核心节点。

## 视觉与交互方向

软木墙、木框、纸张、图钉、胶带、红线。不同节点可采用索引卡、便利贴和方格纸。已形成共识和讨论中采用两种印章样式。维持简洁顶栏与「查看依据」入口。

这是视觉布局示意。图中的摘要做了适配，不能覆盖真实白板内容。当前白板没有已保存的关系连线；图中的红线仅示意关系的视觉样式，实现时须依据实际关系数据绘制。图像中方框及流程也仅作视觉表达，不能把待准备事项视为已完成。实际界面需用可编辑文字、已有 shadcn 组件和 SVG 连线实现，材质图片只作为资产。

## 生成提示词

```text
Use case: ui-mockup.
Design a polished, complete desktop product whiteboard interface, inspired by a cinematic police detective's evidence pinboard. This is a PRODUCT THINKING BOARD, containing the user's existing Chinese product ideas, not a criminal case. The user explicitly asks for a detective evidence-wall feeling.

Create one gorgeous, readable, straight-on interface concept at 1536 x 1024 landscape, edge-to-edge application screen. No outer monitor, no laptop mockup, no room, no person. Full primary screen, not a landing page.
Art direction: tactile dark walnut-framed cork evidence wall, softly lit warm brown fine-grain cork, real ivory paper notes with subtle paper fibers, old cream index cards, translucent masking tape, small metallic or oxblood thumbtacks, fine crimson threads between a few pins. Strong, sophisticated cinematic atmosphere with plentiful readable light paper areas. Paper shadows and occasional 1–3 degree rotations make the artifacts tangible. Calm composed asymmetry and layered editorial typography; six notes form a considered evidence collage rather than a sterile uniform grid. Do not overcrowd. No blood, crime scene tape, weapons, mugshots, skulls, unrelated locations or fake evidence photographs.

Layout:
A restrained 60px matte charcoal app toolbar at the top, with small board icon and Chinese product name “产品白板”, a divider, and “内网通”. Right: a small subdued green sync dot and “随对话更新”, then simple fit-to-view and three-dot menu icons. Minimal UI chrome, real controls to be implemented with existing shadcn components later.
Within the board surface, upper left: a compact cream taped project-heading paper, title “内网通”, subtitle “多设备连接，让内部服务随处可用”. Leave this distinct from six content artifacts.
Below, compose SIX readable tactile artifacts with a few thin crimson threads routed through gaps. These threads are illustrative relationship styling in this visual concept, not claims that links already exist in the data.
1. Largest central-left cream memo: small label “核心想法”, headline “多设备客户端与双平台服务端”. Body “手机、平板、电脑都能连接。服务端支持鸿蒙电脑与 Windows。” Subtle dark red stamp “已形成共识”. Bottom small understated clickable text “查看依据 · 11 ↗”.
2. Small pale-yellow sticky note upper right: heading “付费下载”. Body “先付款，再下载安装。” Stamp “已形成共识”. Bottom “查看依据 · 2 ↗”.
3. Warm cream checklist paper at right mid-lower: heading “上架与收款准备”. Body in 3 restrained lines: “开发者账号已具备”“签名与收款资料待准备”“真机验收待完成”. Small amber “讨论中” marker. Bottom “查看依据 · 1 ↗”.
4. A wide ivory flow document center-lower, pinned across the top, headline “下载安装与扫码引导”, four short steps in a genuinely readable horizontal diagram “选择连接方式 → 安装服务端 → 开启服务 → 扫码配对”. Bottom “查看依据 · 2 ↗”.
5. Small cream index card lower-left: heading “不提供服务器 · 多对多”. Body “由用户提供服务资源，支持多设备连接。” Stamp “已形成共识”. Bottom “查看依据 · 3 ↗”.
6. Light desaturated blue-gray squared notebook sheet upper-middle/right: heading “Tailcat 与第三方代理兼容”. Body “保留独立的配置导入路径。” Stamp “已形成共识”. Bottom “查看依据 · 12 ↗”.

Make papers noticeably different in shape and material, keeping all main text dark, crisp and legible. Use refined Chinese sans-serif for body and a stronger Chinese serif/editorial heading. Avoid illegible handwriting for body. Annotations and stamps may feel hand-marked. Do not add any other cards or content.
At the bottom, a slim unobtrusive dark footer: left “在 Codex 里继续讨论，这页会跟着更新。” Right “5 个共识 · 6 个核心想法”.
The material board should be beautiful even without photographic attachments, because the current board contains text and a flow only. Allow future image cards to resemble pinned photographic prints; do not invent photos in this current board.
Constraints: practical to implement as code-native text, editable app components and SVG connections above a separable cork texture. Never make the final interface depend on baked-in bitmap text. This image is the complete visual design concept. Do not make a generic SaaS dashboard; do not add sidebars, tabs, search field, extra tool palettes, new controls, decorative fake statistics or marketing copy.
Lighting: warm, soft, directional upper-left light, gentle falloff on cork only, no dark wash over papers. Texture is tactile and premium, not filthy or distressed. Colors: deep charcoal #262724, cork brown #8b6b49, ivory #f6efdf, pale sticky yellow #ece0a5, quiet blue-gray #d9e1df, crimson #9e3531.
Output one cohesive high-fidelity screen with balanced margins and six complete paper notes visible, clean Chinese text, no cropping of important content.
```
