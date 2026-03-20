# SkillClip

把 AI 对话、Prompt 和 Whole Flow 编译成可复用技能。

> Not a prompt manager. An AI skill compiler.

SkillClip 想解决的不是“保存一句 Prompt”，而是：

- 保存 AI 工作流的原始素材
- 把粗糙 Prompt 优化成更可复用的 Prompt
- 把多轮对话整理成 Skill
- 把 Skill 作为 SOP 再插回 AI 输入框复用
- 在同一场景下继续迭代第二版、第三版

## 一句话理解

SkillClip 是一个本地优先的 Chrome 扩展，用来把：

- 单条 Prompt
- 多条 Prompt
- 整段 AI 对话流程

整理成可复用 Skill。

## Why It Matters

很多 Prompt 工具只能存文本片段。  
但真正有价值的，往往是：

- 一段来回优化出来的对话
- 一个能复用的方法
- 一组不断演化的工作流版本

SkillClip 管理的核心资产不是“句子”，而是：

- `Raw Capture / 原始素材`
- `Skill / 可复用技能`
- `Variant / 同场景优化版本`

## Current Features

- 保存 `Prompt` 或 `Whole Flow`
- 优化单条 Prompt
- 把多条 Prompt 或整段对话编译成 Skill
- 用 `Workflow Prompts -> Steps -> SOP Runbook` 组织 Skill
- 编辑 Skill、Workflow Prompt 和 Variant
- 把 Skill 插回当前 AI 输入框
- 本地优先保存到 `chrome.storage.local`
- 导出选中资产的 JSON

## Supported Platforms

- ChatGPT
- Claude
- Gemini
- DeepSeek
- Perplexity
- Kimi
- Doubao
- Yuanbao
- Qwen / Tongyi
- Copilot

说明：

- 不同平台 DOM 差异很大
- 目前已经有通用适配和部分站点级特化
- 稳定性还在持续迭代

## Core Flow

1. `Raw Capture / 原始素材`
   保存单条 Prompt 或 Whole Flow

2. `Prompt 优化`
   把粗糙 Prompt 变成更清晰的可复用 Prompt

3. `Skill 编译`
   把单条 Prompt、多条 Prompt 或整段对话整理成：
   - 场景
   - 目标
   - 步骤
   - Workflow Prompts
   - SOP Runbook

4. `Ready Skill / 可复用技能`
   编辑确认后保存成正式技能

5. `Variant / 同场景优化版本`
   为同一个 Skill 继续派生第二版、第三版

## Screenshots

建议后面补这 4 张图：

1. `Workspace / 工作台`
2. `Whole Flow -> Skill`
3. `Workflow Prompt 编辑`
4. `Skill 插入 AI 输入框`

占位命名说明：

- [docs/assets/README.md](./docs/assets/README.md)

## Local-First Storage

当前数据存储在：

- `chrome.storage.local`

这意味着：

- 同一浏览器用户配置下，重启后通常还在
- 不会自动同步给别人
- 不会自动云同步
- 卸载扩展、清空扩展数据、重置本地数据时会丢失

当前仍然是本地优先模式，还没有后端账户系统。

## Quick Start

1. 打开 `chrome://extensions`
2. 开启 `Developer mode`
3. 点击 `Load unpacked`
4. 选择当前项目根目录
5. 打开一个支持的 AI 页面
6. 保存 Prompt 或 Whole Flow
7. 打开工作台
8. 编辑并复用生成的 Skill

## Model Assistance

如果你在设置页填写了：

- `API Base URL`
- `API Model`
- `API Key`

那么：

- Prompt 优化
- Workflow Prompt 优化
- Whole Flow -> Skill 编译
- Skill Check

都会优先使用你配置的模型。

## Repo Guide

核心文件：

- [manifest.json](./manifest.json)
- [src/background/service-worker.js](./src/background/service-worker.js)
- [src/content/content-script.js](./src/content/content-script.js)
- [src/lib/compiler.js](./src/lib/compiler.js)
- [src/lib/storage.js](./src/lib/storage.js)
- [src/pages/sidepanel/sidepanel.html](./src/pages/sidepanel/sidepanel.html)
- [src/pages/options/options.html](./src/pages/options/options.html)

文档：

- [English README](./README_EN.md)
- [PRD](./docs/PRD.md)
- [信息架构](./docs/INFORMATION_ARCHITECTURE.md)
- [数据模型](./docs/DATA_MODEL.md)
- [技术架构](./docs/TECH_ARCHITECTURE.md)
- [开发说明](./docs/DEVELOPMENT.md)
- [开源策略](./docs/OPEN_SOURCE_STRATEGY.md)
- [公开前检查清单](./docs/PUBLIC_RELEASE_CHECKLIST.md)
- [隐私说明](./PRIVACY.md)

## Contributing

欢迎一起补这些方向：

- 平台 DOM 适配
- 输入框插入稳定性
- Skill 编译质量
- 中文 UX
- 本地存储升级
- 导出 / 同步 / Git 文件模式

开始前建议先看：

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [ROADMAP.md](./ROADMAP.md)

## License

- [MIT License](./LICENSE)
