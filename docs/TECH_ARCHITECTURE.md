# SkillClip Technical Architecture

## Overview

SkillClip is a Chrome Extension built around three loops:

- capture useful AI conversation context
- compile that context into structured skill drafts
- reuse validated skills across AI products

The architecture should keep those loops independent enough to evolve separately.

## Extension Modules

### Background Service Worker

Responsibilities:

- register commands and high-level actions
- coordinate capture and compile requests
- normalize stored assets
- fan out updates to popup and side panel

### Content Script

Responsibilities:

- detect supported AI platforms
- read selected text and recent conversation turns
- inject the action bar
- inject the skill palette
- provide browser-native voice dictation into active AI inputs
- insert compiled prompts into active AI inputs

### Popup

Responsibilities:

- quick status view
- recent captures and skills
- fast actions into side panel

### Side Panel

Responsibilities:

- triage Inbox
- review skill drafts
- inspect skills and variants

### Options Page

Responsibilities:

- configure capture defaults
- export and import assets
- control platform adapters

## Data Flow

### Capture flow

1. User triggers a shortcut on a supported page.
2. Background notifies content script to open the action bar.
3. Content script collects selection, platform metadata, and recent turns.
4. Background stores a `conversation_memory` record.
5. UI surfaces refresh.

### Compile flow

1. User selects `Compile to Skill`.
2. Content script sends recent turns and metadata.
3. Background runs a local draft compiler.
4. Draft is stored as `skill_draft`.
5. Side panel can promote it to `skill` or variant later.

### Reuse flow

1. User opens the skill palette in an AI input box.
2. Content script requests validated skills.
3. User chooses a skill.
4. Variables are resolved.
5. Prompt template is inserted into the input.

## Storage

### Current MVP

- `chrome.storage.local` for simplicity and zero setup

### Planned upgrade

- IndexedDB for scalable local-first storage
- optional sync layer for authenticated users
- Markdown and JSON file export for Git-friendly workflows

## Platform Adapters

The extension should use adapter-style detection, one adapter per AI product.

Each adapter exposes:

- `matches(location)`
- `getConversationTitle()`
- `getModelName()`
- `getRecentTurns(limit)`
- `getActiveInput()`

This keeps platform-specific DOM logic isolated.

## Compilation Strategy

The MVP compiler is heuristic and local:

- infer a name from the selected text or first user turn
- infer scenario from URL, title, and conversation text
- extract placeholder variables from selected text patterns
- build ordered steps from recent user and assistant turns

Later, this compiler can be upgraded to a model-assisted pipeline without changing the asset format.

## File Layout

```text
/manifest.json
/src
  /background
  /content
  /lib
  /pages
  /styles
```

## MVP Constraints

- no cloud dependency
- no framework dependency required
- must load unpacked in Chrome
- must work even if platform extraction is partial

## Future Technical Upgrades

- IndexedDB abstraction
- richer DOM adapters
- semantic duplicate detection
- diffable variant comparison
- optional Git-backed filesystem export
