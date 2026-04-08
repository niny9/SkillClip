# SkillClip 产品需求文档（PRD）

## 1. 产品概述

### 1.1 产品名

SkillClip

### 1.2 一句话定位

把 Prompt 和 AI 对话，编译成可复用技能。

### 1.3 对外核心表达

SkillClip 不是一个 Prompt 收藏夹，而是一个 AI Skill Compiler。

它的目标不是帮用户保存一句话，而是帮用户把和 AI 聊出来的方法，沉淀成以后还能继续复用的技能资产。

### 1.4 产品形态

- Chrome 插件
- 本地优先的 AI 工作流资产管理器
- 支持 Prompt、Whole Flow、Skill、Variant、知识库导出

---

## 2. 产品要解决的问题

### 2.1 用户真实痛点

重度 AI 用户真正丢失的，往往不是某一句 Prompt，而是以下几类资产：

- 多轮对话中逐渐试出来的方法
- 为了某个结果不断补充约束、背景、输出要求后形成的流程
- 同一任务在不同平台、不同风格下优化出来的多个版本
- 一次有效对话背后隐含的“可重复执行方式”

### 2.2 现有方案的问题

当前市场上大多数 Prompt 工具，本质仍停留在：

- 保存文本片段
- 分类、标签、搜索
- 快速插入

它们解决的是“句子管理”，不是“方法管理”。

因此用户会继续遇到这些问题：

- 好结果往往是 5 到 10 轮对话之后才长出来的，单存一句 Prompt 不够
- 原始 Prompt 很粗糙，但真正有价值的是后续迭代过程
- 同一个场景会不断出现第二版、第三版，不是一次性定稿
- 跨 ChatGPT、Claude、Gemini、DeepSeek 等平台时，资产会割裂
- 最终很容易堆成一个“Prompt 垃圾堆”，而不是可复用方法库

### 2.3 SkillClip 的解决思路

SkillClip 要把用户与 AI 的交互资产分成三层：

1. 原始素材  
   先保留原文、对话、来源、上下文

2. 结构化技能  
   再把素材整理成可复用技能

3. 同场景优化版本  
   在同一技能上持续分叉、比较、演进

也就是说，SkillClip 解决的核心不是“怎么收藏 Prompt”，而是：

**怎么把一次有效的 AI 协作，变成长期可积累、可比较、可复用的工作流资产。**

---

## 3. 产品价值

### 3.1 对用户的核心价值

#### 价值一：减少重复表达成本

用户不需要每次重新组织长 Prompt，也不需要重复回忆“上次那套方法到底怎么写”。

#### 价值二：把聊天结果变成方法资产

很多高质量对话，不再停留在一次性结果，而是被整理成可复用 SOP。

#### 价值三：保留从粗糙到成熟的演化过程

用户一开始输入的往往并不完美。SkillClip 的价值就在于：

- 保存粗糙输入
- 优化单条 Prompt
- 编译整段工作流
- 形成技能

#### 价值四：统一跨平台 AI 资产

无论用户在 ChatGPT、Claude、Gemini、DeepSeek、Kimi、Doubao、Qwen、Copilot 哪个平台探索出方法，都可以统一收回同一个技能资产层。

#### 价值五：支持知识库沉淀

资产不仅存在插件本地，还可以导出为 Markdown / JSON，或者联动 Obsidian / Notion，变成长期知识资产。

### 3.2 对开源传播的价值

这个项目的传播点不在于“又一个 Prompt 工具”，而在于：

- 本地优先
- 开放数据结构
- Markdown / JSON 可导出
- Skill 可编辑、可追溯、可演化
- 支持接入用户自己的模型

它更容易被理解成：

**AI 原生用户的第二大脑工作流层。**

---

## 4. 目标用户

### 4.1 核心用户

- 高频使用 ChatGPT / Claude / Gemini 等 AI 工具的人
- PM、研究员、内容创作者、运营、分析师、独立开发者、创业者
- 有 Prompt 积累习惯，但已经感觉“单纯存 Prompt 不够”的用户

### 4.2 次级用户

- 团队内部 AI 方法整理者
- 想把 AI 工作流沉淀进知识库的人
- 偏好本地优先、可导出、可 Git 管理知识资产的开源用户

### 4.3 用户特征

- 使用 AI 的频率高
- 已经形成一定工作流
- 经常重复做相似任务
- 愿意花时间打磨方法，但不想反复重复劳动
- 会因为“保存不及时”“保存后难复用”“复用后难管理”而产生明显挫败感

---

## 5. 产品目标

### 5.1 短期目标

做出一个真正能跑通的最小闭环：

- 保存 Prompt
- 保存 Whole Flow
- 优化单条 Prompt
- 编译成 Skill
- 复用到 AI 输入框
- 导出到知识库

### 5.2 中期目标

把插件从“可用原型”推进到“稳定、可演示、可公开传播”的产品形态：

- 支持更多平台
- 提升 whole flow 编译质量
- 强化 Prompt 与 Skill 的差异化结构
- 优化管理体验和知识库沉淀体验

### 5.3 长期目标

成为 AI 原生用户的工作流资产层：

- 收集
- 编译
- 优化
- 复用
- 导出
- 版本化

---

## 6. 产品原则

### 6.1 本地优先

默认存储在本地浏览器扩展存储中，先保证可控、轻量和开源接受度。

### 6.2 不丢原材料

任何 Skill 都不能脱离原始来源独立存在。原始 Prompt、对话轮次、来源平台、来源链接必须尽量保留。

### 6.3 Skill 是可编辑对象，不是一次性抽取结果

系统提取出来的只是草稿或候选结构，用户要能继续改、继续优化、继续比较。

### 6.4 优先沉淀“方法”，而不是“句子”

SkillClip 要鼓励用户保存：

- 方法
- 结构
- 步骤
- 输出要求
- 复用条件

而不是只保存一句话。

### 6.5 兼顾单条 Prompt 与整段工作流

不是所有用户都一次输入很长很完整的 Prompt。

产品必须支持两条真实路径：

- 单条粗糙 Prompt -> 优化 -> 复用
- 多轮对话 / 多条 Prompt -> 编译 -> 技能

### 6.6 复用优先于炫技

最终目标不是“提取看起来很高级的结构”，而是用户下一次真的能在 AI 输入框里继续用。

---

## 7. 核心概念定义

### 7.1 Prompt

用户在某个 AI 平台上的单条输入，或选中的一段原始文本。

它的特点是：

- 更原始
- 更具体
- 结构相对简单
- 更像单次任务输入

### 7.2 Whole Flow

围绕某个任务形成的整段多轮对话流程，通常包含：

- 初始需求
- 追加约束
- 输出修正
- 二次优化

它代表的是“一次有效方法的生成过程”。

### 7.3 Skill

从单条 Prompt、多条 Prompt 或 Whole Flow 中提炼出来的可复用技能对象。

Skill 不是一句话，而应该包含：

- 名称
- 场景
- 适用条件
- 不适用条件
- 目标
- 工作流 Prompt
- 运行手册
- 成功标准
- 来源映射

### 7.4 Variant

同一个技能在相似场景下的优化版本。

例如：

- 更适合 Claude 的版本
- 更适合长文本输入的版本
- 更偏结构化输出的版本

### 7.5 Runbook

技能最终给 AI 执行的完整 SOP 运行文本。

它代表的是：

- 全局角色
- 总体任务
- 输入
- 步骤
- 输出要求
- 最终检查

### 7.6 Workflow Prompt

技能内部每一步真正交给 AI 执行的优化版 Prompt。

它的定位不是“重复一个完整独立 Prompt”，而是：

- 在一个统一任务下的某一步动作
- 某一步上下文补充
- 某一步局部要求

---

## 8. 核心用户流程

### 8.1 流程一：保存单条粗糙 Prompt

目标：让用户把一个不完美但真实的输入先保存下来。

流程：

1. 用户在 AI 页面输入一个粗糙 Prompt
2. 选中文本
3. 打开操作条
4. 点击 `Save Prompt`
5. 内容进入原始素材区
6. 用户可选择：
   - 一键优化这条 Prompt
   - 继续把多条 Prompt 合成 Skill
   - 导出到知识库

用户价值：

- 不需要一开始就写完美 Prompt
- 可以先存，再优化

### 8.2 流程二：保存 Whole Flow

目标：把一次完整对话沉淀下来，而不是只留一句话。

流程：

1. 用户在 AI 页面完成一轮多步对话
2. 点击 `Save Whole Flow`
3. 插件抓取最近多轮对话、平台、标题、URL、上下文
4. 原始内容进入原始素材区
5. 系统自动整理 Whole Flow
6. 用户进入详情页查看：
   - 运行手册
   - 工作流 Prompt
   - 来源映射

用户价值：

- 真正保存“方法形成的过程”
- 避免只存一句 Prompt 导致上下文丢失

### 8.3 流程三：从多条 Prompt 合成 Skill

目标：适配“每条 Prompt 只做一个小任务”的用户。

流程：

1. 用户在原始素材区勾选多条 Prompt
2. 点击 `把选中的 Prompt 合并成一个技能`
3. 系统综合这些 Prompt 的内容与顺序
4. 自动补出：
   - Scenario
   - Use When
   - Goal
   - Workflow Prompt
   - Runbook
5. 用户查看和调整
6. 升级为可复用技能

用户价值：

- 不强迫用户一开始就写完整大 Prompt
- 允许通过多条小 Prompt 沉淀技能

### 8.4 流程四：优化工作流内部 Prompt

目标：让 skill 内部每一步都更可用。

流程：

1. 用户打开一个 Skill
2. 查看每条 workflow prompt
3. 对某一条点 `一键优化`
4. 系统用模型优先、本地规则兜底进行优化
5. 重新更新：
   - workflow prompt 标题
   - workflow prompt 内容
   - 运行手册
   - 步骤映射

用户价值：

- Skill 不只是“提取完成”，而是可以持续打磨

### 8.5 流程五：复用 Skill

目标：让技能重新回到 AI 输入框里使用。

流程：

1. 用户在支持的 AI 页面打开技能面板
2. 选择一个 Skill
3. 如果有变量，填写变量
4. 插件把运行手册/技能内容插入输入框
5. 用户继续编辑或直接发送

用户价值：

- 减少重复书写
- 真正实现“方法复用”

### 8.6 流程六：导出到知识库

目标：把插件内资产沉淀到长期知识系统。

流程：

1. 用户在控制中心配置知识库联动
2. 选择目标：
   - 本地下载
   - Obsidian
   - Notion
3. 选择格式：
   - Markdown
   - JSON
4. 配置自动导出或手动导出
5. 保存 Prompt / Whole Flow / Skill 后自动同步

用户价值：

- 插件不是信息黑盒
- 资产可以进入自己的第二大脑

---

## 9. 功能范围

### 9.1 V1 必须实现

- 支持保存单条 Prompt
- 支持保存 Whole Flow
- 支持本地优化 Prompt
- 支持模型辅助优化 Prompt
- 支持从 Prompt / Whole Flow 编译成 Skill
- 支持编辑 Skill
- 支持 Variant
- 支持技能复用到输入框
- 支持 Markdown / JSON 导出
- 支持 Obsidian / Notion 联动

### 9.2 V1 不做

- 云端账号体系
- 多人协作
- Skill Marketplace
- 社区评分与 Fork 广场
- 跨端实时同步
- 自动 benchmark 多模型表现

---

## 10. 页面与模块设计

### 10.1 页面内操作条

位于 AI 页面内，用于快速触发：

- 保存 Prompt
- 保存 Whole Flow
- 语音输入
- 打开技能面板

### 10.2 工作台

主视图包括：

- 原始素材
- 可复用技能
- 同场景优化版本
- 详情编辑区

### 10.3 详情页

以“运行手册”为主结果展示，辅以：

- 可编辑字段
- 工作流 Prompt 编辑
- 工作流对照（折叠）
- 抽取来源
- 自动检查
- 原始来源

### 10.4 控制中心

用于：

- 查看当前状态
- 查看本地资产
- 配置模型
- 配置知识库联动
- 导出 JSON / Markdown

---

## 11. 数据结构要求

### 11.1 原始素材

至少包含：

- id
- sourcePlatform
- sourceUrl
- sourceTitle
- selectedText
- turns
- captureMode
- capturedAt
- compileStatus
- linkedDraftId

### 11.2 Skill / Draft

至少包含：

- id
- name
- scenario
- useWhen
- notFor
- goal
- outputFormat
- successCriteria
- workflowPrompts
- promptTemplate
- stepSources
- sourceConversationIds
- validation

### 11.3 Variant

至少包含：

- id
- baseSkillId
- name
- scenarioOverride
- changeSummary
- workflowPrompts
- stepSources

---

## 12. 技术与实现原则

### 12.1 存储

当前使用：

- `chrome.storage.local`

特征：

- 本地优先
- 浏览器重启后通常仍保留
- 无自动云同步
- 卸载插件或清理扩展数据后可能丢失

### 12.2 模型接入

用户可自行配置：

- Provider
- API Base URL
- Model
- API Key

用于：

- Prompt 优化
- Workflow Prompt 优化
- Skill 编译
- Skill 检查

### 12.3 知识库导出

支持：

- Markdown
- JSON
- Obsidian
- Notion

Markdown 应包含 frontmatter，便于知识库长期分类与检索。

---

## 13. 体验重点

### 13.1 用户输入必须允许粗糙

不能假设用户一开始就输入完美 Prompt。

SkillClip 的价值，恰恰建立在：

- 允许粗糙输入
- 后续逐步优化
- 最后沉淀技能

### 13.2 Whole Flow 必须真的体现“流程”

如果用户保存的是整段流程，就不能最终只显示成一条单 Prompt。

Whole Flow 的结果必须体现：

- 多步
- 顺序
- 作用分工
- 整体运行手册

### 13.3 Skill 与 Prompt 必须清晰区分

Prompt 是原始输入。  
Skill 是结构化方法。

不能让两者看起来只是复杂度不同的同一东西。

### 13.4 避免重复信息堆叠

详情页不能同时出现多份意义接近的内容，例如：

- 重复的运行手册
- 重复的摘要
- 重复的 Prompt/步骤说明

### 13.5 结果页必须适合演示

这个产品天然依赖演示传播，因此：

- 文案要清晰
- 结构要直观
- 详情页要像产品，不像调试工具

---

## 14. 成功指标

### 14.1 激活

- 安装后完成第一次保存 Prompt 的比例
- 安装后完成第一次保存 Whole Flow 的比例
- 安装后完成第一次升级成 Skill 的比例

### 14.2 价值实现

- 原始素材 -> Skill 的转化率
- Whole Flow -> Skill 的转化率
- Skill 被再次应用到输入框的比例
- 平均每个活跃用户拥有的 Skill 数量

### 14.3 留存

- 7 日内再次复用 Skill 的用户比例
- 30 日内再次保存 Whole Flow 的用户比例
- 知识库导出使用率

### 14.4 质量

- Whole Flow 编译后用户手动修改量
- Prompt 优化后被保留比例
- Skill 检查通过率

---

## 15. 路线图

### 15.1 近期

- 提升标题概括质量
- 提升 Whole Flow 编译质量
- 进一步减少详情页重复信息
- 提升插入输入框的稳定性
- 提升 Notion / Obsidian 联动稳定性

### 15.2 中期

- 更稳定的平台 DOM 适配
- 更强的场景归纳与变量抽取
- 更好的 Skill 排序、筛选与搜索
- 更好的 Variant 比较能力

### 15.3 长期

- Git/file mode
- 云同步
- 团队共享
- Skill 市场
- 更强的跨模型优化与验证

---

## 16. 对外发布叙事

### 16.1 最推荐表述

Not a prompt manager. An AI skill compiler.

### 16.2 用户能立刻理解的价值

SkillClip helps you:

- save rough prompts
- capture whole AI chat flows
- turn them into reusable skills
- reuse them anywhere
- sync them into your knowledge base

### 16.3 GitHub 传播点

- local-first
- open data model
- Markdown / JSON export
- Obsidian / Notion integration
- reusable AI workflow assets

---

## 17. 结论

SkillClip 的真正产品价值，不在于“再做一个 Prompt 管理器”，而在于：

**把 AI 对话里长出来的方法，沉淀成可复用技能。**

它既服务于：

- 当下的使用效率

也服务于：

- 长期的方法积累
- 知识资产沉淀
- 工作流标准化

如果 Prompt 工具解决的是“保存句子”，  
那么 SkillClip 要解决的是：

**保存方法，组织方法，复用方法。**
