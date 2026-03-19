import { compileSkillDraft, createVariantFromSkill, promoteDraftToSkill } from "../lib/compiler.js";
import { MESSAGE_TYPES } from "../lib/constants.js";
import { ensureContentScript } from "../lib/injection.js";
import { createId, nowIso } from "../lib/utils.js";
import {
  archiveConversation,
  archiveDraft,
  archiveSkill,
  findDraftById,
  findSkillById,
  getAllState,
  insertConversation,
  insertDraft,
  insertSkill,
  insertVariant,
  removeDraft,
  resetAllState,
  seedDemoSkillIfNeeded,
  updateDraft,
  updateSkill
} from "../lib/storage.js";

chrome.runtime.onInstalled.addListener(async () => {
  await seedDemoSkillIfNeeded();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.runtime.onStartup?.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  if (command === "open-skillclip-action-bar") {
    chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OPEN_ACTION_BAR });
  }

  if (command === "open-skill-palette") {
    chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OPEN_SKILL_PALETTE });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      console.error("[SkillClip]", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case MESSAGE_TYPES.SAVE_PROMPT:
      return saveConversationMemory(message.payload, "selection");
    case MESSAGE_TYPES.SAVE_FLOW:
      return saveConversationMemory(message.payload, "whole_flow");
    case MESSAGE_TYPES.COMPILE_SKILL:
      return compileConversationToDraft(message.payload);
    case MESSAGE_TYPES.GET_STATE:
      return getAllState();
    case MESSAGE_TYPES.INSERT_SKILL:
      return trackSkillUsage(message.payload.skillId);
    case MESSAGE_TYPES.PROMOTE_DRAFT:
      return promoteDraft(message.payload.draftId);
    case MESSAGE_TYPES.CREATE_VARIANT:
      return createVariant(message.payload.skillId);
    case MESSAGE_TYPES.ARCHIVE_CONVERSATION:
      return archiveConversationItem(message.payload.conversationId);
    case MESSAGE_TYPES.ARCHIVE_DRAFT:
      return archiveDraftItem(message.payload.draftId);
    case MESSAGE_TYPES.ARCHIVE_SKILL:
      return archiveSkillItem(message.payload.skillId);
    case MESSAGE_TYPES.UPDATE_DRAFT:
      return updateDraftItem(message.payload);
    case MESSAGE_TYPES.UPDATE_SKILL:
      return updateSkillItem(message.payload);
    case MESSAGE_TYPES.RESET_STATE:
      return resetState();
    case MESSAGE_TYPES.SEED_DEMO:
      return seedDemo();
    case MESSAGE_TYPES.ENSURE_CONTENT_SCRIPT:
      return ensureContentScriptForTab(message.payload.tabId);
    case MESSAGE_TYPES.OPEN_SIDE_PANEL:
      if (sender.tab?.windowId) {
        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
      }
      return { opened: true };
    default:
      return null;
  }
}

async function saveConversationMemory(payload, captureMode) {
  const item = {
    id: createId("conv"),
    kind: "conversation_memory",
    sourcePlatform: payload.platform,
    sourceUrl: payload.url,
    sourceTitle: payload.title,
    sourceConversationId: payload.url,
    sourceModel: payload.model,
    capturedAt: nowIso(),
    captureMode,
    selectedText: payload.selectedText || "",
    turns: payload.turns || [],
    userTags: [],
    inferredTags: [],
    inferredScenario: payload.scenario || ""
  };

  await insertConversation(item);
  await broadcastStorageUpdate();
  return item;
}

async function compileConversationToDraft(payload) {
  const memory = await saveConversationMemory(payload, "recent_turns");
  const draft = compileSkillDraft({
    ...payload,
    conversationId: memory.id
  });

  await insertDraft(draft);
  await broadcastStorageUpdate();

  return draft;
}

async function promoteDraft(draftId) {
  const draft = await findDraftById(draftId);
  if (!draft) {
    throw new Error("Draft not found");
  }

  const skill = promoteDraftToSkill(draft);
  await insertSkill(skill);
  await removeDraft(draftId);
  await broadcastStorageUpdate();
  return skill;
}

async function createVariant(skillId) {
  const skill = await findSkillById(skillId);
  if (!skill) {
    throw new Error("Skill not found");
  }

  const variant = createVariantFromSkill(skill);
  await insertVariant(variant);
  await broadcastStorageUpdate();
  return variant;
}

async function trackSkillUsage(skillId) {
  const updated = await updateSkill(skillId, (skill) => ({
    ...skill,
    usageCount: (skill.usageCount || 0) + 1,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return updated;
}

async function archiveConversationItem(conversationId) {
  const item = await archiveConversation(conversationId);
  await broadcastStorageUpdate();
  return item;
}

async function archiveDraftItem(draftId) {
  const item = await archiveDraft(draftId);
  await broadcastStorageUpdate();
  return item;
}

async function archiveSkillItem(skillId) {
  const item = await archiveSkill(skillId);
  await broadcastStorageUpdate();
  return item;
}

async function updateDraftItem(payload) {
  const item = await updateDraft(payload.id, (draft) => ({
    ...draft,
    name: payload.name,
    scenario: payload.scenario,
    goal: payload.goal,
    promptTemplate: payload.promptTemplate,
    steps: payload.steps,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
}

async function updateSkillItem(payload) {
  const item = await updateSkill(payload.id, (skill) => ({
    ...skill,
    name: payload.name,
    scenario: payload.scenario,
    goal: payload.goal,
    promptTemplate: payload.promptTemplate,
    steps: payload.steps,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
}

async function resetState() {
  await resetAllState();
  await seedDemoSkillIfNeeded();
  await broadcastStorageUpdate();
  return { ok: true };
}

async function seedDemo() {
  await seedDemoSkillIfNeeded();
  await broadcastStorageUpdate();
  return { ok: true };
}

async function ensureContentScriptForTab(tabId) {
  if (!tabId) {
    throw new Error("Tab id is required");
  }

  return ensureContentScript(tabId);
}

async function broadcastStorageUpdate() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.STORAGE_UPDATED }).catch(() => {});
    }
  }
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.STORAGE_UPDATED }).catch(() => {});
}
