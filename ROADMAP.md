# Roadmap

SkillClip 的目标不是“多一个 Prompt 收藏工具”，而是做成：

**把 AI 对话和 Prompt 编译成可复用技能的工作流系统。**

下面是当前更现实的阶段路线。

## Phase 1: 可用原型

目标：

- 本地加载后真的能用
- 保存 Prompt / Whole Flow
- 生成 Skill
- 编辑 Skill
- 把 Skill 插回 AI 输入框

当前重点：

- 平台适配稳定性
- 工作流 Prompt 去重
- Whole Flow -> SOP
- 中文体验统一

## Phase 2: 稳定工作流

目标：

- Whole Flow 生成的 Skill 更像真正可复用 SOP
- 多个 Prompt 可以稳定合成一个 Skill
- Workflow Prompt 可以单条优化、单条检查、单条编辑

重点能力：

- 更好的变量抽取
- 更好的步骤映射
- 更好的场景归纳
- 更稳定的模型辅助编译

## Phase 3: 知识资产化

目标：

- Skill 不只是能保存，还能长期演化

重点能力：

- Variant diff
- 使用次数与质量排序
- 场景筛选
- 平台筛选
- 版本历史

## Phase 4: 本地优先专业版能力

目标：

- 让高阶用户把 Skill 当成真正知识资产管理

重点能力：

- IndexedDB
- Markdown / JSON 导出
- 文件系统模式
- Git-friendly skill files

## Phase 5: 开源传播与发布

目标：

- GitHub 上更容易被理解、安装、传播
- 逐步具备 Chrome Web Store 发布条件

重点工作：

- README 和文档持续迭代
- 演示截图 / GIF
- 隐私页
- 商店素材

## 当前最值得继续做的事情

1. 提高输入框插入稳定性
2. 把 Whole Flow 进一步做成真正 SOP
3. 继续压缩重复 Workflow Prompt
4. 把工作台再简化
5. 增强本地导出与恢复

## 当前暂不优先

- 后端账号系统
- 云同步
- 团队协作空间
- Skill Marketplace
- 复杂权限扩张

这些以后可能会做，但现在还不该抢主线。
