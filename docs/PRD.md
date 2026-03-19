# SkillClip PRD

## 1. Product Summary

### One-line pitch

Turn AI chats into reusable skills.

### Expanded pitch

SkillClip is a Chrome extension that captures prompts and AI conversations, compiles them into structured skill drafts, and lets users reuse those skills across AI products through a lightweight palette.

### Product category

AI workflow asset manager.

## 2. Problem

AI users do not just lose prompts. They lose working methods.

Current behavior:

- Users iterate for many turns before landing on a good workflow
- The final useful artifact is usually spread across multiple messages
- Saving one prompt loses the surrounding setup, constraints, and output pattern
- Reuse breaks across different AI tools and models
- Good conversations are rarely saved at the right time

## 3. Product Vision

SkillClip should become the system where AI-native users collect, refine, compare, and reuse the workflows they discover while chatting with AI.

The product must preserve:

- raw source context
- structured extracted knowledge
- ongoing iteration history

## 4. Principles

- Local-first by default
- Never discard raw source context
- Skill extraction is editable, not final
- Variants are a feature, not noise
- Cross-platform reuse matters more than single-platform depth
- Capture must feel instant

## 5. Target Users

### Primary

- heavy ChatGPT and Claude users
- indie hackers
- PMs, marketers, designers, founders, analysts
- people who already maintain personal prompt libraries and feel the pain

### Secondary

- teams building internal AI workflows
- creators sharing AI methods publicly
- open-source users who prefer Markdown and Git-backed assets

## 6. Jobs To Be Done

- When I discover a useful AI workflow, I want to save it before I lose it.
- When a conversation contains a reusable method, I want the system to turn it into a draft skill.
- When I face a similar task later, I want to reuse a proven skill in any AI product.
- When a skill underperforms, I want to compare and evolve variants instead of rewriting from scratch.

## 7. Product Scope

### In scope for V1

- Save selected prompt text
- Save recent conversation context
- Detect source AI platform and metadata
- Compile conversation into a structured skill draft
- Inbox for new captures
- Skill library for approved skills
- Variant creation and linking
- Slash palette or shortcut-based insertion
- JSON and Markdown export

### Out of scope for V1

- full cloud collaboration
- community marketplace
- public ranking system
- model quality benchmarking at scale
- advanced agent execution

## 8. MVP User Flows

### Flow A: Save Prompt

1. User selects prompt text on an AI page.
2. User presses shortcut.
3. Action bar opens.
4. User chooses `Save Prompt`.
5. Item is saved into `Inbox` as conversation memory.

### Flow B: Compile to Skill

1. User is on an AI conversation page.
2. User presses shortcut or opens extension action bar.
3. User chooses `Compile to Skill`.
4. Extension captures the last N turns plus metadata.
5. Compiler generates a `Skill Draft`.
6. User reviews, edits, and saves as:
   new skill, variant, merge candidate, or raw memory only.

### Flow C: Reuse Anywhere

1. User is on any supported AI input box.
2. User types `/` or presses shortcut twice.
3. Skill palette opens.
4. User picks a skill.
5. Required variables are filled.
6. Generated prompt template is inserted into the active input.

## 9. Killer Feature

At the end of a high-quality conversation, SkillClip should nudge the user with a low-friction suggestion:

`This conversation looks reusable. Save it as a skill?`

This is the signature behavior because it solves forgotten capture.

## 10. Information Model

The product manages three asset layers:

### Layer 1: Conversation Memory

Raw captured material:

- selected prompt
- conversation turns
- source platform
- model
- URL and title
- capture timestamp
- tags and scenario guess
- capture range

### Layer 2: Skill Draft and Skill

Structured method:

- name
- scenario
- goal
- inputs and variables
- constraints
- steps
- prompt template
- output format
- example
- source links
- quality status

### Layer 3: Variants and Evolution

Change-aware versions:

- base skill
- variants
- compatibility by platform or model
- notes on difference
- usage data
- outcome feedback

## 11. Core Surfaces

### Extension surfaces

- content script action bar
- slash palette
- side panel or popup quick actions
- optional end-of-chat suggestion card

### Workspace surfaces

- Inbox
- Skills
- Variants
- Sources

## 12. Success Metrics

### Activation

- percentage of installs that save at least one capture
- percentage of users who create their first skill draft

### Value realization

- percentage of saved captures converted into skills
- weekly skill reuse rate
- average number of variants per active skill

### Retention

- users returning to reuse skills across multiple platforms
- exported or synced assets per retained user

## 13. Open-Source Advantage

To maximize GitHub breakout potential, the product should emphasize:

- local-first architecture
- human-readable Markdown and JSON exports
- Git-friendly skill files
- extensible platform adapters
- transparent skill data model

## 14. Release Narrative

The project should be introduced as:

`Not a prompt manager. An AI skill compiler.`

That framing is sharper, more differentiated, and more open-source friendly than another prompt library tool.
