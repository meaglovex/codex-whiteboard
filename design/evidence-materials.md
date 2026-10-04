# 证据墙材质

2026-10-04，使用内置 imagegen，以 `detective-board-concept-v1.png` 为参考生成。保存为 JPEG 以减小内联包，原始生成图保留在 Codex 生成目录。

- `src/assets/cork.jpg`：画布软木背景，600 px 重复铺设。
- `src/assets/paper.jpg`：纸张微纹理，不包含任何文字或操作控件。

## Cork prompt

Generate a standalone production texture asset from the reference concept: ONLY its warm natural brown cork pinboard material. Square 1024 by 1024, completely edge-to-edge uniform cork at a fine realistic grain scale, photographic macro texture, color around warm medium tobacco brown #967046. Flat straight-on, even diffuse lighting, no vignette or lighting gradient, subtle natural variation, seamlessly repeatable. NO wooden frame, NO papers, NO shadows of objects, NO pins, NO thread, NO text, NO UI, NO marks. This will tile across the interactive app canvas behind real UI.

## Paper prompt

Generate a standalone production texture asset from the reference concept: ONLY the pale warm ivory paper material of its large cream note. Square 1024 by 1024, completely edge-to-edge off-white ivory paper, color #f5efdf, very subtle paper fibers and faint gentle wrinkles. Flat straight-on, evenly lit, near uniform, seamless repeatable microtexture, clean and readable for dark text placed later. NO paper edges, NO holes, NO pins, NO tape, NO lines, NO text, NO shadows, NO objects, NO UI. This is a subtle paper background texture to be used under editable interface text.

材质保留理由：相比旧版纯白卡片，纸张与软木建立了用户要求的实体证据墙质感。正文保持实际 DOM 文字，低对比度纸纹没有遮挡文字或按钮；图钉、线条和边框由代码绘制，可随画布缩放。
