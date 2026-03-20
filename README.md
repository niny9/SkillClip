# SkillClip

Turn AI chats, prompts, and whole flows into reusable skills.

> Not a prompt manager. An AI skill compiler.

SkillClip is a local-first Chrome extension for turning:

- single prompts
- multiple prompts
- whole AI chat flows

into reusable skills.

[中文说明 / Chinese README](./README_CN.md)

## TL;DR

SkillClip is a local-first Chrome extension that captures prompts and AI chat flows, then compiles them into reusable skills with workflow prompts, step mappings, and SOP-style runbooks.

## Why This Exists

Most prompt tools stop at text storage.

But the most valuable AI assets are often not single prompts. They are:

- conversations refined over multiple turns
- reusable methods hidden inside AI chats
- evolving workflow versions you want to compare and improve

SkillClip is built around that higher-level asset.

## What SkillClip Manages

- `Raw Capture`
- `Skill`
- `Variant`

## What It Can Do Right Now

- Save raw prompts and whole flows
- Optimize rough prompts into cleaner reusable prompts
- Compile prompts or whole flows into structured skills
- Organize skills with:
  - workflow prompts
  - steps
  - step-source mappings
  - SOP-style runbooks
- Edit skills, workflow prompts, and variants
- Reinsert saved skills into current AI input boxes
- Keep everything local-first in `chrome.storage.local`
- Export selected assets as JSON

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

Notes:

- DOM structures vary a lot across platforms
- Some platform-specific handling already exists
- Reliability is still improving

## How It Works

1. `Raw Capture`
   Save a single prompt or a whole flow

2. `Prompt Optimization`
   Turn rough prompts into clearer reusable prompts

3. `Skill Compilation`
   Turn prompts or full conversations into:
   - scenario
   - goal
   - steps
   - workflow prompts
   - SOP runbook

4. `Ready Skill`
   Review and keep the result as a reusable skill

5. `Variant`
   Fork the same skill into second and third versions for the same scenario

## Screenshots

Use the current three screenshots in this order:

1. `AI page + workspace side panel`
   Caption: `Compile AI chats into reusable skills beside the conversation itself.`

2. `Local assets and workspace overview`
   Caption: `Review raw captures, reusable skills, variants, and local assets in one workspace.`

3. `Model-assisted configuration`
   Caption: `Plug in your own model for prompt optimization, skill compilation, and checks.`

Suggested README image block once the files are added to `docs/assets/`:

```md
![Hero workspace](./docs/assets/hero-workspace.png)
*Compile AI chats into reusable skills beside the conversation itself.*

![Local assets](./docs/assets/local-assets.png)
*Review raw captures, reusable skills, variants, and local assets in one workspace.*

![Model config](./docs/assets/model-config.png)
*Plug in your own model for prompt optimization, skill compilation, and checks.*
```

File naming and usage guide:

- [docs/assets/README.md](./docs/assets/README.md)
- [docs/SCREENSHOT_USAGE.md](./docs/SCREENSHOT_USAGE.md)

## Storage Model

Current data is stored in:

- `chrome.storage.local`

So:

- it usually survives normal browser restarts
- it does not sync automatically across users or devices
- it can be lost if the extension is removed or local extension data is cleared

There is no backend account system yet.

## Current Limitations

- platform compatibility is still improving
- data is local-first and not cloud-synced
- whole-flow-to-skill compilation still needs more polish
- screenshot and demo assets are not complete yet

## Quick Start

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the project root folder
5. Open a supported AI site
6. Save a prompt or a whole flow
7. Open the workspace
8. Edit and reuse the generated skill

## Model Assistance

If you configure:

- `API Base URL`
- `API Model`
- `API Key`

then the following will prefer your configured model:

- prompt optimization
- workflow prompt optimization
- whole-flow-to-skill compilation
- skill checks

## Repository Guide

Core files:

- [manifest.json](./manifest.json)
- [src/background/service-worker.js](./src/background/service-worker.js)
- [src/content/content-script.js](./src/content/content-script.js)
- [src/lib/compiler.js](./src/lib/compiler.js)
- [src/lib/storage.js](./src/lib/storage.js)
- [src/pages/sidepanel/sidepanel.html](./src/pages/sidepanel/sidepanel.html)
- [src/pages/options/options.html](./src/pages/options/options.html)

Docs:

- [Chinese README](./README_CN.md)
- [PRD](./docs/PRD.md)
- [Information Architecture](./docs/INFORMATION_ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Technical Architecture](./docs/TECH_ARCHITECTURE.md)
- [Development](./docs/DEVELOPMENT.md)
- [Open Source Strategy](./docs/OPEN_SOURCE_STRATEGY.md)
- [Public Release Checklist](./docs/PUBLIC_RELEASE_CHECKLIST.md)
- [Privacy](./PRIVACY.md)

## Contributing

Good areas to contribute:

- platform DOM adapters
- input insertion reliability
- skill compilation quality
- multilingual UX
- storage upgrades
- export / sync / file mode

Start here:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [ROADMAP.md](./ROADMAP.md)

## License

- [MIT License](./LICENSE)
