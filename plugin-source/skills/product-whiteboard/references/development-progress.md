# 已有关联白板项目的开发进度

适用于构思收敛后开始开发，以及已有白板关联项目的实现、修复、测试与交付。普通无关联代码任务不因此新建白板。

## 找回正确项目

先确定本次代码所属仓库或项目目录。使用当前对话已有的 boardId；否则调用 whiteboard_list，按 projectPath 匹配当前项目。读取 whiteboard_read 中的 plan、phase、progress、完整构思与依据。不要把别的项目或示例当作当前项目。目录不明且会导致串板时才询问。

首次进入开发，依据实际计划拆分少量里程碑和可验收任务，绑定 projectPath，并调用 whiteboard_progress。该调用默认令 phase=development，页面自动进入开发进度视图。产品构思仍保留，可随时回看。只做计划拆分、尚未获准开发时可显式传 phase=discovery。

## 何时更新

对已绑定项目，以下变化应在本轮工作中主动同步，不等用户催问：

- 开始实际任务前：in_progress。
- 实现已完成、尚待验证：review。
- 相关验证通过或交付物满足验收条件：done，并同时提交新的通过依据。
- 真实外部条件或失败挡住下一步：blocked，填写 blocker 和所需条件。
- 继续推进、解除阻塞、范围变化或本轮结束：提交准确的最新状态和 summary。

长命令开始前说明正在执行的任务，结束后用实际输出更新。没有新事实时不要刷事件、猜百分比或伪造心跳。“实时”指关键事件后及时同步，不是后台自动扫描代码。同步失败时保留开发成果，修复/重试同步并读回核对，不能口头声称看板已更新。

## whiteboard_progress 输入约定

- boardId：同一产品稳定的白板 ID。
- eventId：本次进度事件的稳定 ID。失败重试复用同一 ID 与相同参数；新事实使用新 ID。
- summary：简短、具体的本次变化。
- projectPath：实际项目绝对目录，首次绑定时填写。
- milestones：按稳定 id 新建或局部更新，字段为 title、description、dependsOn。
- tasks：按稳定 id 新建或局部更新。新任务需要 milestoneId、title、acceptance；可加 description、status、dependsOn、blocker、note 和 evidence。
- evidence：每条有稳定 id、kind（test/artifact/commit/review/record）、label、reference、result（passed/failed/info）和可选 detail。reference 是实际命令、文件、提交或报告路径；不要写私钥、访问令牌、个人敏感信息或无关原始日志。

省略的字段保留原值。依赖必须引用存在的 ID，不能成环。done 需要本次提供至少一条 result=passed 的依据；blocked/cancelled 必须说明 blocker。重新打开已完成任务时，用 note 说明原因，再提交新状态。

## 依据与阶段边界

每项任务先写清 acceptance。代码提交、编译、测试、模拟器、真机和正式发布是不同验收范围，不相互替代。首轮接入已有项目时，可以从可核查提交、产物与验收记录建立基线，但要标明记录来源、日期及未复测的范围。旧报告不等于本轮重新执行。

不按代码行数、提交次数、花费时间或模型感觉估计进度。看板按有依据的 done 任务计数；取消项不计入总数，依赖不会因取消自动被视为完成。任务拆分改变时保留稳定 ID，必要时显式取消旧范围并解释原因。

每次同步后读取 whiteboard_read，核对阶段、任务和本次事件；本轮结束前确保看板反映真实结果。需要交付时，whiteboard_export 会同时保留进度、原构思、计划与验收依据。
