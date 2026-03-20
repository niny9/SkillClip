# Contributing

感谢你愿意参与 SkillClip。

这个项目现在还在快速演进阶段，所以我们更欢迎：

- 小步提交
- 明确目标
- 不破坏主链路

## 先了解什么

开始之前，建议先看：

- [README.md](/Users/niny/Documents/GitHub/SkillClip/README.md)
- [docs/PRD.md](/Users/niny/Documents/GitHub/SkillClip/docs/PRD.md)
- [docs/TECH_ARCHITECTURE.md](/Users/niny/Documents/GitHub/SkillClip/docs/TECH_ARCHITECTURE.md)
- [docs/DATA_MODEL.md](/Users/niny/Documents/GitHub/SkillClip/docs/DATA_MODEL.md)

## 当前优先欢迎的贡献

1. 平台适配
- ChatGPT / Claude / Gemini / DeepSeek / Kimi / Doubao / Qwen / Copilot 的 DOM 抽取
- 输入框识别
- 技能插入稳定性

2. Skill 编译质量
- Prompt 优化
- Whole Flow -> Skill 的结构化提炼
- 去重、压缩、变量抽取
- SOP 生成质量

3. 前端体验
- 工作台交互
- 中文化
- 折叠区和层级
- 反馈提示

4. 存储与导出
- 从 `chrome.storage.local` 逐步迁移到 IndexedDB
- JSON / Markdown 导出
- Git 文件模式

## 开发原则

- 不要把项目重新做成 Prompt 收藏夹
- Prompt 和 Skill 要保持清晰区分
- Whole Flow 的目标是生成可复用 SOP，不是简单贴原文
- 默认优先中文体验
- 先保证“能用”，再加复杂度

## 提交建议

建议每次 PR 只做一类事情，比如：

- 修一个平台的输入框适配
- 提升 workflow prompt 去重
- 只改工作台 UI

尽量避免一个 PR 同时改：

- 抽取逻辑
- 存储
- UI
- 文档

除非这些改动天然绑在一起。

## 本地测试

建议最少做这几步：

1. 在 Chrome 里 `Load unpacked`
2. 打开一个支持的平台页面
3. 测一遍：
- 保存 Prompt
- 保存 Whole Flow
- 生成 Skill
- 编辑 Workflow Prompt
- 应用 Skill

4. 跑语法检查

常用检查：

```bash
node --check src/content/content-script.js
node --check src/background/service-worker.js
node --check src/pages/sidepanel/sidepanel.js
node --check src/pages/options/options.js
node --check src/lib/compiler.js
```

## 提交内容尽量包含

- 改了什么
- 为什么改
- 怎么测
- 有没有已知限制

## 暂时不建议的大改

当前阶段先不要直接做这些大动作，除非先讨论：

- 完整账户系统
- 后端同步服务
- 大规模权限扩张
- 完全重写 UI 框架
- 直接拆成复杂 monorepo

## Issue 建议格式

提问题时，如果能带上这些会更快：

- 平台名
- 页面 URL 类型
- 你点了什么
- 实际结果
- 预期结果
- 截图

## License

贡献代码默认按本仓库的 GNU GPL v3 发布：

- [LICENSE](/Users/niny/Documents/GitHub/SkillClip/LICENSE)
