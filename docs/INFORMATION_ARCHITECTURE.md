# SkillClip Information Architecture

## 1. Product Structure

SkillClip has two major environments:

- in-page extension experiences
- workspace management experiences

## 2. In-Page Extension Experiences

### Action Bar

Triggered by text selection or keyboard shortcut.

Primary actions:

- Save Prompt
- Compile to Skill
- Save Whole Flow

Supporting metadata shown inline:

- source platform
- detected model
- conversation title
- capture range

### Skill Palette

Triggered by `/` or a shortcut inside supported AI input fields.

Functions:

- search skills
- filter by platform or tag
- show required variables
- insert compiled output into the current input

### Capture Suggestion

Triggered when the system detects a high-value conversation pattern.

Functions:

- suggest compiling a skill
- preview why the conversation looks reusable
- let users dismiss, snooze, or compile

## 3. Workspace Navigation

### Inbox

Purpose:
review newly captured prompts and conversation memories before they become durable assets.

Core actions:

- compile to skill
- merge into existing skill
- convert to variant
- tag
- archive

### Skills

Purpose:
browse validated, reusable skills.

Core actions:

- search
- edit
- duplicate
- invoke
- export
- archive

### Variants

Purpose:
compare alternate implementations of the same skill.

Core actions:

- diff against base skill
- mark best version
- attach usage notes
- assign model compatibility

### Sources

Purpose:
inspect original conversation material and trace every skill back to source.

Core actions:

- view raw conversation
- reopen source metadata
- recompile
- relink to another skill

## 4. Object Relationships

- One conversation memory can produce zero or more skill drafts.
- One skill draft can become one skill or be discarded.
- One skill can have many source conversations.
- One base skill can have many variants.
- One variant belongs to exactly one base skill lineage.

## 5. First-Time User Path

1. Install extension.
2. Save a prompt or compile one recent conversation.
3. See captured item in Inbox.
4. Review auto-generated skill draft.
5. Save as skill.
6. Reuse through slash palette.

## 6. Chrome Extension Page Model

### Required pages

- `background`
- `content script`
- `popup`
- `side panel`
- `options`

### Suggested responsibilities

`background`
- command routing
- platform detection pipeline
- storage sync orchestration

`content script`
- DOM adapters for AI platforms
- selection capture
- input insertion
- action bar and slash palette triggers

`popup`
- quick capture status
- recent skills
- shortcuts entry

`side panel`
- inbox triage
- skill preview
- draft review flow

`options`
- shortcuts
- storage mode
- export preferences
- platform toggles

## 7. Key UX Rules

- Capture must complete in under a few seconds.
- Users should always see what source context was included.
- Drafts should feel editable and reversible.
- Workspace should distinguish raw material from approved assets.
- Variants should never look like duplicate clutter.
