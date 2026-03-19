# SkillClip Data Model

## 1. Model Overview

SkillClip stores three linked asset types:

- `conversation_memory`
- `skill`
- `skill_variant`

It may also use a transient `skill_draft` object during review.

## 2. Conversation Memory

```ts
type ConversationMemory = {
  id: string;
  kind: "conversation_memory";
  sourcePlatform: "chatgpt" | "claude" | "gemini" | "deepseek" | "perplexity" | "other";
  sourceUrl: string;
  sourceTitle?: string;
  sourceConversationId?: string;
  sourceModel?: string;
  capturedAt: string;
  captureMode: "selection" | "recent_turns" | "whole_flow";
  selectedText?: string;
  turns: ConversationTurn[];
  userTags: string[];
  inferredTags: string[];
  inferredScenario?: string;
  notes?: string;
  archivedAt?: string;
};

type ConversationTurn = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt?: string;
};
```

## 3. Skill Draft

```ts
type SkillDraft = {
  id: string;
  kind: "skill_draft";
  status: "draft";
  name: string;
  scenario: string;
  goal: string;
  userIntent?: string;
  inputs: SkillInput[];
  constraints: string[];
  steps: string[];
  promptTemplate: string;
  outputFormat?: string;
  example?: string;
  sourceConversationIds: string[];
  duplicateOfSkillId?: string;
  confidenceScore?: number;
  createdAt: string;
  updatedAt: string;
};

type SkillInput = {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
};
```

## 4. Skill

```ts
type Skill = {
  id: string;
  kind: "skill";
  status: "validated" | "archived";
  name: string;
  slug: string;
  scenario: string;
  goal: string;
  userIntent?: string;
  inputs: SkillInput[];
  constraints: string[];
  steps: string[];
  promptTemplate: string;
  outputFormat?: string;
  example?: string;
  tags: string[];
  sourceConversationIds: string[];
  baseSkillId?: string;
  preferredForPlatforms?: string[];
  preferredForModels?: string[];
  qualityScore?: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};
```

## 5. Skill Variant

```ts
type SkillVariant = {
  id: string;
  kind: "skill_variant";
  baseSkillId: string;
  name: string;
  changeSummary: string;
  scenarioOverride?: string;
  promptTemplate: string;
  constraints: string[];
  steps: string[];
  preferredForPlatforms?: string[];
  preferredForModels?: string[];
  usageCount: number;
  successSignals?: VariantFeedback[];
  createdAt: string;
  updatedAt: string;
};

type VariantFeedback = {
  id: string;
  label: string;
  score?: number;
  note?: string;
  platform?: string;
  model?: string;
  createdAt: string;
};
```

## 6. Storage Strategy

### Local-first

- IndexedDB stores primary extension data
- Local cache supports instant search and palette use
- Exports support JSON and Markdown

### Optional sync

- Sync should replicate structured assets, not just text blobs
- Source conversations and skills should remain separately addressable

## 7. File Export Strategy

Suggested human-readable layout:

```text
/exports
  /skills
    writing-xiaohongshu-title.md
    sql-debugger.json
  /sources
    2026-03-19-chatgpt-title-iteration.json
  /variants
    writing-xiaohongshu-title-claude-v2.md
```

## 8. Design Constraints

- Source context must always be traceable
- Every skill should be editable after compilation
- Variants should preserve lineage to the base skill
- Status should distinguish draft from validated from archived
- Data model should work without cloud dependencies
