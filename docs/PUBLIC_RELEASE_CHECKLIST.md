# Public Release Checklist

这份清单用于判断当前仓库是否适合公开。

## 仓库内容

- [ ] `README.md` 已经能解释项目是什么、怎么装、怎么用
- [ ] `README_EN.md` 已经能给英文用户一个基本入口
- [ ] `LICENSE` 已存在
- [ ] `CONTRIBUTING.md` 已存在
- [ ] `ROADMAP.md` 已存在
- [ ] `PRIVACY.md` 已存在

## 仓库清洁度

- [ ] 没有把个人运营草稿放进仓库
- [ ] 没有把本机私有路径写进公开文档
- [ ] 没有把真实 API Key 放进仓库
- [ ] 没有明显只适合内部的调试说明暴露在首页

## 产品可理解性

- [ ] 用户能理解 `Raw Capture -> Skill -> Variant`
- [ ] 用户能理解它不是 Prompt 收藏夹，而是 Skill Compiler
- [ ] 用户能理解当前数据是本地优先保存

## 最低可用性

- [ ] 能保存单条 Prompt
- [ ] 能保存 Whole Flow
- [ ] 能生成 Skill
- [ ] 能编辑 Workflow Prompt
- [ ] 能把 Skill 插回 AI 输入框

## 发布前建议补充

- [ ] README 截图
- [ ] 一段 20-40 秒演示 GIF
- [ ] 首个 GitHub Release
- [ ] 已知限制说明

## 当前阶段建议

如果下面 3 条已经满足，就可以先公开：

- 核心流程能跑
- README 足够清楚
- 没有明显泄露私有信息

这个项目现在更适合：

- 先公开
- 边收 issue 边迭代
- 再准备 Chrome Web Store
