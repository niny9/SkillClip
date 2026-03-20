# Release Guide

这份文档用于说明如何把当前仓库整理成一个适合开源发布的版本。

## 1. 准备仓库

确认这些文件存在并可读：

- [README.md](/Users/niny/Documents/GitHub/SkillClip/README.md)
- [LICENSE](/Users/niny/Documents/GitHub/SkillClip/LICENSE)
- [CONTRIBUTING.md](/Users/niny/Documents/GitHub/SkillClip/CONTRIBUTING.md)
- [ROADMAP.md](/Users/niny/Documents/GitHub/SkillClip/ROADMAP.md)
- [PRIVACY.md](/Users/niny/Documents/GitHub/SkillClip/PRIVACY.md)

## 2. 本地自检

至少检查这些文件：

```bash
node --check src/content/content-script.js
node --check src/background/service-worker.js
node --check src/pages/sidepanel/sidepanel.js
node --check src/pages/options/options.js
node --check src/lib/compiler.js
```

## 3. 本地加载确认

1. 打开 `chrome://extensions`
2. 开启 `Developer mode`
3. `Load unpacked`
4. 选择项目目录
5. 实测：
- 保存 Prompt
- 保存 Whole Flow
- 生成 Skill
- 编辑 Workflow Prompt
- 应用 Skill

## 4. 打包发布

当前最简单方式：

- 直接压缩整个扩展根目录
- 生成一个 zip 包，方便别人本地加载

建议 zip 中至少包含：

- `manifest.json`
- `src/`
- `README.md`
- `LICENSE`

## 5. GitHub Release 建议内容

每次 release 最好包含：

- 版本号
- 变化摘要
- 已知限制
- 安装方式
- zip 包

## 6. 当前已知限制建议写在 Release 里

- 不同 AI 网站 DOM 差异很大，兼容性还在持续完善
- 当前是本地优先原型，没有云同步
- 自动发送链路暂时不作为主能力
- 数据存储在 `chrome.storage.local`

## 7. 开源首页最重要的信息

Release 页面最值得强调的不是“我们做了很多功能”，而是：

- 它是什么
- 它解决什么问题
- 怎么装
- 现在已经能做什么
- 目前还不稳定的地方是什么
