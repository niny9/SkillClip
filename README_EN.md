# SkillClip

Turn AI chats, prompts, and whole flows into reusable skills.

SkillClip is a local-first **AI Skill Compiler** for people who work across ChatGPT, Claude, Gemini, DeepSeek, Kimi, Doubao, Qwen, Copilot, and other AI tools.

It is not a prompt manager.

Instead of only saving snippets, SkillClip tries to preserve:

- the raw prompt
- the surrounding conversation context
- the reusable workflow behind a good AI result
- the improved variants of the same skill over time

## What It Does

- Save raw prompts and whole flows
- Optimize rough prompts into more reusable prompt patterns
- Compile multiple prompts or a whole conversation into a skill
- Structure the result as:
  - workflow prompts
  - steps
  - source mappings
  - SOP-style runbooks
- Reinsert saved skills into current AI input boxes
- Keep everything local-first in the browser

## Why It Exists

Most prompt managers stop at text storage.

But many useful AI workflows are not a single prompt. They are:

- 5 to 10 turns of refinement
- a method hidden inside a conversation
- something you want to reuse, improve, compare, and fork

SkillClip is built around that higher-level asset.

## Core Asset Types

- `Raw Capture`
- `Ready Skill`
- `Variant`

## Current State

This repository contains a Chrome MV3 extension prototype.

Already in place:

- side panel workspace
- raw capture storage
- prompt optimization
- whole-flow-to-skill compilation
- workflow prompt editing
- run checks
- local storage with `chrome.storage.local`

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

## Local-First Storage

Current data is stored in:

- `chrome.storage.local`

So:

- it survives normal browser restarts
- it does not automatically sync across users or machines
- it can be lost if the extension is removed or local extension data is cleared

## Quick Start

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the project root folder

Then:

1. Open a supported AI site
2. Save a prompt or a whole flow
3. Open the workspace
4. Review or edit the generated skill
5. Apply the skill back into an AI input

## Documentation

- [Chinese README](./README.md)
- [PRD](./docs/PRD.md)
- [Architecture](./docs/TECH_ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Contributing](./CONTRIBUTING.md)
- [Roadmap](./ROADMAP.md)

## License

MIT
