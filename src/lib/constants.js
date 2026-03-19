export const STORAGE_KEYS = {
  CONVERSATIONS: "skillclip.conversations",
  DRAFTS: "skillclip.drafts",
  SKILLS: "skillclip.skills",
  VARIANTS: "skillclip.variants",
  SETTINGS: "skillclip.settings"
};

export const MESSAGE_TYPES = {
  OPEN_ACTION_BAR: "skillclip/open-action-bar",
  OPEN_SKILL_PALETTE: "skillclip/open-skill-palette",
  SAVE_PROMPT: "skillclip/save-prompt",
  SAVE_FLOW: "skillclip/save-flow",
  COMPILE_SKILL: "skillclip/compile-skill",
  INSERT_SKILL: "skillclip/insert-skill",
  PROMOTE_DRAFT: "skillclip/promote-draft",
  CREATE_VARIANT: "skillclip/create-variant",
  ARCHIVE_CONVERSATION: "skillclip/archive-conversation",
  ARCHIVE_DRAFT: "skillclip/archive-draft",
  ARCHIVE_SKILL: "skillclip/archive-skill",
  UPDATE_DRAFT: "skillclip/update-draft",
  UPDATE_SKILL: "skillclip/update-skill",
  UPDATE_SETTINGS: "skillclip/update-settings",
  RESET_STATE: "skillclip/reset-state",
  SEED_DEMO: "skillclip/seed-demo",
  ENSURE_CONTENT_SCRIPT: "skillclip/ensure-content-script",
  GET_STATE: "skillclip/get-state",
  STORAGE_UPDATED: "skillclip/storage-updated",
  OPEN_SIDE_PANEL: "skillclip/open-side-panel"
};

export const PLATFORMS = {
  CHATGPT: "chatgpt",
  CLAUDE: "claude",
  GEMINI: "gemini",
  DEEPSEEK: "deepseek",
  PERPLEXITY: "perplexity",
  OTHER: "other"
};
