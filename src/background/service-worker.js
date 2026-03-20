import { compileSkillDraft, createVariantFromSkill, promoteDraftToSkill } from "../lib/compiler.js";
import { extractSkillDraftWithApi, reviewSkillWithApi, testApiConnection } from "../lib/api-review.js";
import { MESSAGE_TYPES } from "../lib/constants.js";
import { ensureContentScript } from "../lib/injection.js";
import { validateSkillAsset } from "../lib/validator.js";
import { createId, nowIso } from "../lib/utils.js";
import {
  archiveConversation,
  archiveDraft,
  archiveSkill,
  findDraftById,
  findConversationById,
  findSkillById,
  findVariantById,
  getAllState,
  getSettings,
  insertConversation,
  insertDraft,
  insertSkill,
  insertVariant,
  removeConversation,
  removeDraft,
  removeSkill,
  removeVariant,
  resetAllState,
  restoreConversation,
  restoreDraft,
  restoreSkill,
  seedDemoSkillIfNeeded,
  updateConversation,
  updateSettings,
  updateDraft,
  updateSkill,
  updateVariant
} from "../lib/storage.js";

chrome.runtime.onInstalled.addListener(async () => {
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
      return saveCapturedItem(message.payload, "selection");
    case MESSAGE_TYPES.SAVE_FLOW:
      return saveCapturedItem(message.payload, "whole_flow");
    case MESSAGE_TYPES.COMPILE_SKILL:
      return compileConversationToDraft(message.payload);
    case MESSAGE_TYPES.COMPILE_CONVERSATION:
      return compileStoredConversation(message.payload.conversationId);
    case MESSAGE_TYPES.GET_STATE:
      return getAllState();
    case MESSAGE_TYPES.INSERT_SKILL:
      return trackSkillUsage(message.payload.skillId);
    case MESSAGE_TYPES.APPROVE_DRAFT_PREVIEW:
      return approveDraftPreview(message.payload.draftId);
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
    case MESSAGE_TYPES.RESTORE_CONVERSATION:
      return restoreConversationItem(message.payload.conversationId);
    case MESSAGE_TYPES.RESTORE_DRAFT:
      return restoreDraftItem(message.payload.draftId);
    case MESSAGE_TYPES.RESTORE_SKILL:
      return restoreSkillItem(message.payload.skillId);
    case MESSAGE_TYPES.DELETE_CONVERSATION:
      return deleteConversationItem(message.payload.conversationId);
    case MESSAGE_TYPES.DELETE_DRAFT:
      return deleteDraftItem(message.payload.draftId);
    case MESSAGE_TYPES.DELETE_SKILL:
      return deleteSkillItem(message.payload.skillId);
    case MESSAGE_TYPES.DELETE_VARIANT:
      return deleteVariantItem(message.payload.variantId);
    case MESSAGE_TYPES.UPDATE_CONVERSATION:
      return updateConversationItem(message.payload);
    case MESSAGE_TYPES.UPDATE_DRAFT:
      return updateDraftItem(message.payload);
    case MESSAGE_TYPES.UPDATE_SKILL:
      return updateSkillItem(message.payload);
    case MESSAGE_TYPES.UPDATE_VARIANT:
      return updateVariantItem(message.payload);
    case MESSAGE_TYPES.UPDATE_SETTINGS:
      return updateSettingsItem(message.payload);
    case MESSAGE_TYPES.GET_SETTINGS:
      return getSettings();
    case MESSAGE_TYPES.TEST_API_CONNECTION:
      return testApiConnection(message.payload);
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

async function saveCapturedItem(payload, captureMode) {
  const settings = await getSettings();
  const memory = await saveConversationMemory(payload, captureMode);

  let preview = null;
  if (settings.autoCompileAfterCapture) {
    preview = await compileFromExistingMemory(memory, payload, settings);
  }

  return { memory, preview };
}

async function compileConversationToDraft(payload) {
  const settings = await getSettings();
  const memory = await saveConversationMemory(payload, "recent_turns");
  return compileFromExistingMemory(memory, payload, settings);
}

async function compileStoredConversation(conversationId) {
  const state = await getAllState();
  const source = state.conversations.find((item) => item.id === conversationId);
  if (!source) {
    throw new Error("Conversation not found");
  }

  const settings = await getSettings();
  return compileFromExistingMemory(source, {
    platform: source.sourcePlatform,
    url: source.sourceUrl,
    title: source.sourceTitle,
    model: source.sourceModel,
    selectedText: source.selectedText || source.turns?.[0]?.text || "",
    turns: source.turns || []
  }, settings);
}

async function promoteDraft(draftId) {
  const draft = await findDraftById(draftId);
  if (!draft) {
    throw new Error("Draft not found");
  }

  const settings = await getSettings();
  let skill = promoteDraftToSkill(draft, settings);
  skill = await applyApiValidationIfNeeded(skill, settings);
  await insertSkill(skill);
  await removeDraft(draftId);
  await broadcastStorageUpdate();
  return skill;
}

async function approveDraftPreview(draftId) {
  const settings = await getSettings();
  const item = await updateDraft(draftId, (draft) => {
    const nextDraft = {
      ...draft,
      status: "draft"
    };
    return {
      ...nextDraft,
      validation: validateSkillAsset(nextDraft, settings),
      updatedAt: nowIso()
    };
  });
  await broadcastStorageUpdate();
  return item;
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

async function restoreConversationItem(conversationId) {
  const item = await restoreConversation(conversationId);
  await broadcastStorageUpdate();
  return item;
}

async function restoreDraftItem(draftId) {
  const item = await restoreDraft(draftId);
  await broadcastStorageUpdate();
  return item;
}

async function restoreSkillItem(skillId) {
  const item = await restoreSkill(skillId);
  await broadcastStorageUpdate();
  return item;
}

async function deleteConversationItem(conversationId) {
  await removeConversation(conversationId);
  await broadcastStorageUpdate();
  return { deleted: true };
}

async function deleteDraftItem(draftId) {
  await removeDraft(draftId);
  await broadcastStorageUpdate();
  return { deleted: true };
}

async function deleteSkillItem(skillId) {
  await removeSkill(skillId);
  await broadcastStorageUpdate();
  return { deleted: true };
}

async function deleteVariantItem(variantId) {
  await removeVariant(variantId);
  await broadcastStorageUpdate();
  return { deleted: true };
}

async function updateDraftItem(payload) {
  const settings = await getSettings();
  const baseDraft = await findDraftById(payload.id);
  const nextDraft = {
    ...baseDraft,
    name: payload.name,
    whatItDoes: payload.whatItDoes,
    scenario: payload.scenario,
    useWhen: payload.useWhen,
    notFor: payload.notFor,
    goal: payload.goal,
    promptTemplate: payload.promptTemplate,
    outputFormat: payload.outputFormat,
    successCriteria: payload.successCriteria,
    steps: payload.steps
  };
  const validated = await applyApiValidationIfNeeded({
    ...nextDraft,
    validation: validateSkillAsset(nextDraft, settings)
  }, settings);

  const item = await updateDraft(payload.id, (draft) => ({
    ...draft,
    ...validated,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
}

async function updateConversationItem(payload) {
  const baseConversation = await findConversationById(payload.id);
  if (!baseConversation) {
    throw new Error("Conversation not found");
  }

  const item = await updateConversation(payload.id, (conversation) => ({
    ...conversation,
    sourceTitle: payload.sourceTitle,
    selectedText: payload.selectedText,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
}

async function updateSkillItem(payload) {
  const settings = await getSettings();
  const baseSkill = await findSkillById(payload.id);
  const nextSkill = {
    ...baseSkill,
    name: payload.name,
    whatItDoes: payload.whatItDoes,
    scenario: payload.scenario,
    useWhen: payload.useWhen,
    notFor: payload.notFor,
    goal: payload.goal,
    promptTemplate: payload.promptTemplate,
    outputFormat: payload.outputFormat,
    successCriteria: payload.successCriteria,
    steps: payload.steps
  };
  const validated = await applyApiValidationIfNeeded({
    ...nextSkill,
    validation: validateSkillAsset(nextSkill, settings)
  }, settings);

  const item = await updateSkill(payload.id, (skill) => ({
    ...skill,
    ...validated,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
}

async function updateVariantItem(payload) {
  const baseVariant = await findVariantById(payload.id);
  if (!baseVariant) {
    throw new Error("Variant not found");
  }

  const item = await updateVariant(payload.id, (variant) => ({
    ...variant,
    name: payload.name,
    changeSummary: payload.goal,
    scenarioOverride: payload.scenario,
    promptTemplate: payload.promptTemplate,
    steps: payload.steps,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
}

async function resetState() {
  await resetAllState();
  await broadcastStorageUpdate();
  return { ok: true };
}

async function seedDemo() {
  await seedDemoSkillIfNeeded();
  await broadcastStorageUpdate();
  return { ok: true };
}

async function updateSettingsItem(payload) {
  const settings = await updateSettings(payload);
  await broadcastStorageUpdate();
  return settings;
}

async function applyApiValidationIfNeeded(asset, settings) {
  if (settings.validationMode !== "api") {
    return asset;
  }

  const apiValidation = await reviewSkillWithApi(asset, settings);
  return {
    ...asset,
    validation: apiValidation
  };
}

async function ensureContentScriptForTab(tabId) {
  if (!tabId) {
    throw new Error("Tab id is required");
  }

  return ensureContentScript(tabId);
}

async function compileFromExistingMemory(memory, payload, settings) {
  let draft = compileSkillDraft({
    ...payload,
    conversationId: memory.id
  }, settings);

  if (settings.validationMode === "api") {
    draft = await extractSkillDraftWithApi({
      ...payload,
      conversationId: memory.id
    }, draft, settings);
  }

  draft = await applyApiValidationIfNeeded(draft, settings);
  await insertDraft(draft);
  await broadcastStorageUpdate();
  return draft;
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
