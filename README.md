# SkillClip

Turn AI chats into reusable skills.

SkillClip is not a prompt manager. It is an AI skill compiler for people who work across ChatGPT, Claude, Gemini, DeepSeek, Perplexity, and other AI products.

Instead of saving isolated prompt snippets, SkillClip captures the context around a good AI conversation and compiles it into a reusable skill:

- Capture prompts, selected text, or recent chat turns
- Detect source platform, page, model, and conversation metadata
- Compile multi-turn conversations into structured skill drafts
- Reuse skills anywhere through a slash palette or shortcut
- Keep everything local-first, exportable, and versionable

## Why This Exists

Prompt managers hit a ceiling because they mostly store text fragments.

What people actually want is:

- a way to keep the method behind a successful AI conversation
- a way to reuse that method in different tools
- a way to evolve and compare better versions over time

SkillClip is designed around that higher-order asset.

## Product Thesis

SkillClip manages three layers of AI work:

1. Conversation Memory
   Save the raw material: prompts, chat turns, source URL, model, tags, and context window.
2. Skill Drafts and Skills
   Turn a conversation into a structured, editable, reusable method.
3. Variants and Evolution
   Track forks, improvements, platform-specific versions, and usage feedback.

This makes SkillClip closer to an AI workflow asset manager than a prompt library.

## Strongest MVP

- Select text and press a shortcut to save a prompt
- Detect the current AI platform automatically
- Compile the last N conversation turns into a skill draft
- Trigger a skill palette with `/` or shortcut inside AI input fields
- Local-first storage with JSON and Markdown export

## Current Build

This repository now includes a first Chrome Extension MVP scaffold:

- `manifest.json` for a loadable MV3 extension
- action bar for `Save Prompt`, `Compile to Skill`, and `Save Whole Flow`
- `Voice to Input` for browser-native speech dictation into AI inputs
- local-first background storage using `chrome.storage.local`
- popup and side panel workspace
- slash-triggered skill palette inside supported AI pages
- heuristic skill compiler with draft and validated skill generation
- platform adapter structure for ChatGPT, Claude, Gemini, DeepSeek, and Perplexity

## Load It In Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select this folder:
   `/Users/niny/Documents/GitHub/SkillClip`

Then open ChatGPT, Claude, Gemini, DeepSeek, or Perplexity and try:

- `Cmd/Ctrl + Shift + K` to open the action bar
- `Cmd/Ctrl + Shift + L` to open the skill palette
- typing `/` in an AI input box to trigger the palette

## What Exists vs. Next

Already working in scaffold form:

- capture selected text and recent turns
- detect supported AI platforms with adapter-based DOM extraction
- create conversation memory items
- compile skill drafts
- auto-promote drafts into reusable skills for MVP testing
- insert a saved skill back into an AI input
- dictate text into the active AI input with browser speech recognition

Next priorities:

- richer platform-specific DOM adapters
- real IndexedDB storage layer
- draft review actions: merge, variant, archive
- export to Markdown and JSON files
- variant diff and lineage UI

## Killer Feature

The product should proactively detect high-signal conversations and ask:

`This conversation looks reusable. Compile it into a skill?`

The pain is not just saving. The pain is forgetting to save at the right moment.

## Core Docs

- [PRD](./docs/PRD.md)
- [Information Architecture](./docs/INFORMATION_ARCHITECTURE.md)
- [Data Model](./docs/DATA_MODEL.md)
- [Technical Architecture](./docs/TECH_ARCHITECTURE.md)
- [Open Source Strategy](./docs/OPEN_SOURCE_STRATEGY.md)
- [Store Readiness](./docs/STORE_READINESS.md)
- [Development and Packaging](./docs/DEVELOPMENT.md)
- [Privacy Policy Draft](./PRIVACY.md)

## Positioning

- Not a prompt manager
- Not a snippet library
- Not another AI sidebar

SkillClip is a reusable skill system for AI-native work.
