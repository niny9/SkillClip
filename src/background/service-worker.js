import { buildSkillStructureFromWorkflowPrompts, compileSkillDraft, createVariantFromSkill, optimizePromptLocally, optimizeWorkflowPromptLocally, promoteDraftToSkill } from "../lib/compiler.js";
import { extractSkillDraftWithApi, optimizePromptWithApi, optimizeWorkflowPromptWithApi, optimizeWorkflowTurnsWithApi, reviewSkillWithApi, runSkillCheck, runWorkflowPromptCheck, testApiConnection } from "../lib/api-review.js";
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
  getSkillInputMemory,
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
  saveSkillInputMemory,
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
    case MESSAGE_TYPES.OPTIMIZE_CONVERSATION:
      return optimizeConversationPrompt(message.payload.conversationId);
    case MESSAGE_TYPES.OPTIMIZE_WORKFLOW_PROMPT:
      return optimizeWorkflowPromptItem(message.payload);
    case MESSAGE_TYPES.UPDATE_WORKFLOW_PROMPT:
      return updateWorkflowPromptItem(message.payload);
    case MESSAGE_TYPES.COMPILE_SKILL:
      return compileConversationToDraft(message.payload);
    case MESSAGE_TYPES.COMPILE_CONVERSATION:
      return compileStoredConversation(message.payload.conversationId);
    case MESSAGE_TYPES.COMPILE_SELECTIONS:
      return compileSelectedConversations(message.payload.conversationIds || []);
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
    case MESSAGE_TYPES.GET_SKILL_INPUT_MEMORY:
      return getSkillInputMemory(message.payload.skillId, message.payload.platform || "global");
    case MESSAGE_TYPES.SAVE_SKILL_INPUT_MEMORY:
      return saveSkillInputMemory(
        message.payload.skillId,
        message.payload.platform || "global",
        message.payload.values || {}
      );
    case MESSAGE_TYPES.TEST_API_CONNECTION:
      return testApiConnection(message.payload);
    case MESSAGE_TYPES.RUN_SKILL_CHECK:
      return runSkillCheckForAsset(message.payload);
    case MESSAGE_TYPES.RUN_WORKFLOW_PROMPT_CHECK:
      return runWorkflowPromptCheckForAsset(message.payload);
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
    compileStatus: "idle",
    compileError: "",
    linkedDraftId: "",
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
    await updateConversation(memory.id, (current) => ({
      ...current,
      compileStatus: "pending",
      compileError: "",
      updatedAt: nowIso()
    }));
    await broadcastStorageUpdate();
    try {
      preview = await compileFromExistingMemory(memory, payload, settings);
    } catch (error) {
      await updateConversation(memory.id, (current) => ({
        ...current,
        compileStatus: "failed",
        compileError: error?.message || "自动编译失败",
        updatedAt: nowIso()
      }));
      await broadcastStorageUpdate();
      return { memory: await findConversationById(memory.id), preview: null };
    }
  }

  return { memory: await findConversationById(memory.id), preview };
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
  await updateConversation(conversationId, (current) => ({
    ...current,
    compileStatus: "pending",
    compileError: "",
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();

  try {
    return await compileFromExistingMemory(source, {
      platform: source.sourcePlatform,
      url: source.sourceUrl,
      title: source.optimizedTitle || source.sourceTitle,
      model: source.sourceModel,
      selectedText: source.optimizedPrompt || source.selectedText || source.turns?.[0]?.text || "",
      turns: applyOptimizedTurns(source) || source.turns || []
    }, settings);
  } catch (error) {
    await updateConversation(conversationId, (current) => ({
      ...current,
      compileStatus: "failed",
      compileError: error?.message || "手动编译失败",
      updatedAt: nowIso()
    }));
    await broadcastStorageUpdate();
    throw error;
  }
}

async function compileSelectedConversations(conversationIds) {
  const state = await getAllState();
  const sources = state.conversations.filter((item) => conversationIds.includes(item.id));
  if (!sources.length) {
    throw new Error("No source conversations selected");
  }

  const settings = await getSettings();
  const payload = buildCombinedPayloadFromSources(sources);
  const primaryMemory = sources[0];
  return compileFromExistingMemory(primaryMemory, payload, settings);
}

async function optimizeConversationPrompt(conversationId) {
  const settings = await getSettings();
  const conversation = await findConversationById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const localResult = optimizePromptLocally(conversation);
  const apiResult = canUseModelAssist(settings)
    ? await optimizePromptWithApi(conversation, settings)
    : null;
  const finalResult = {
    optimizedTitle: apiResult?.optimizedTitle || localResult.optimizedTitle,
    optimizedPrompt: apiResult?.optimizedPrompt || localResult.optimizedPrompt,
    scenario: apiResult?.scenario || localResult.scenario
  };

  const item = await updateConversation(conversationId, (current) => ({
    ...current,
    optimizedTitle: finalResult.optimizedTitle,
    optimizedPrompt: finalResult.optimizedPrompt,
    inferredScenario: finalResult.scenario || current.inferredScenario,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return item;
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
    steps: payload.steps,
    stepSources: baseDraft.stepSources || [],
    workflowPrompts: baseDraft.workflowPrompts || []
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
    steps: payload.steps,
    stepSources: baseSkill.stepSources || [],
    workflowPrompts: baseSkill.workflowPrompts || []
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
    stepSources: variant.stepSources || [],
    workflowPrompts: variant.workflowPrompts || [],
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

async function runSkillCheckForAsset(payload) {
  const settings = await getSettings();
  const state = await getAllState();
  const asset = state.skills.find((item) => item.id === payload.id)
    || state.drafts.find((item) => item.id === payload.id)
    || state.variants.find((item) => item.id === payload.id);

  if (!asset) {
    throw new Error("Asset not found for skill check");
  }

  return runSkillCheck(asset, settings);
}

async function runWorkflowPromptCheckForAsset(payload) {
  const settings = await getSettings();
  const state = await getAllState();
  const asset = state.skills.find((item) => item.id === payload.id)
    || state.drafts.find((item) => item.id === payload.id)
    || state.variants.find((item) => item.id === payload.id);

  if (!asset) {
    throw new Error("Asset not found for workflow prompt check");
  }

  const prompt = asset.workflowPrompts?.[payload.index];
  if (!prompt) {
    throw new Error("Workflow prompt not found");
  }

  return runWorkflowPromptCheck(asset, prompt, settings);
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
  const preparedPayload = canUseModelAssist(settings)
    ? await preparePayloadForCompilation(payload, settings)
    : payload;

  let draft = compileSkillDraft({
    ...preparedPayload,
    conversationId: memory.id
  }, settings);

  if (canUseModelAssist(settings)) {
    draft = await extractSkillDraftWithApi({
      ...preparedPayload,
      conversationId: memory.id
    }, draft, settings);
  }

  draft = await applyApiValidationIfNeeded(draft, settings);
  await insertDraft(draft);
  await updateConversation(memory.id, (current) => ({
    ...current,
    compileStatus: "ready",
    compileError: "",
    linkedDraftId: draft.id,
    updatedAt: nowIso()
  }));
  await broadcastStorageUpdate();
  return draft;
}

async function updateWorkflowPromptItem(payload) {
  const settings = await getSettings();
  const updater = (asset) => rebuildAssetAfterWorkflowPromptEdit(asset, payload, settings);

  if (payload.kind === "draft") {
    const item = await updateDraft(payload.id, updater);
    await broadcastStorageUpdate();
    return item;
  }

  if (payload.kind === "skill") {
    const item = await updateSkill(payload.id, updater);
    await broadcastStorageUpdate();
    return item;
  }

  if (payload.kind === "variant") {
    const item = await updateVariant(payload.id, updater);
    await broadcastStorageUpdate();
    return item;
  }

  throw new Error("Unsupported asset kind for workflow prompt update");
}

async function optimizeWorkflowPromptItem(payload) {
  const settings = await getSettings();
  const state = await getAllState();
  const asset = state.skills.find((item) => item.id === payload.id)
    || state.drafts.find((item) => item.id === payload.id)
    || state.variants.find((item) => item.id === payload.id);

  if (!asset) {
    throw new Error("Asset not found for workflow prompt optimization");
  }

  const prompt = asset.workflowPrompts?.[payload.index];
  if (!prompt) {
    throw new Error("Workflow prompt not found");
  }

  const localResult = optimizeWorkflowPromptLocally(prompt, asset.scenario || asset.scenarioOverride || "");
  const apiResult = canUseModelAssist(settings)
    ? await optimizeWorkflowPromptWithApi(asset, prompt, settings)
    : null;

  return updateWorkflowPromptItem({
    id: payload.id,
    kind: payload.kind,
    index: payload.index,
    title: apiResult?.optimizedTitle || localResult.optimizedTitle || prompt.title,
    prompt: apiResult?.optimizedPrompt || localResult.optimizedPrompt || prompt.prompt
  });
}

function rebuildAssetAfterWorkflowPromptEdit(asset, payload, settings) {
  const nextWorkflowPrompts = (asset.workflowPrompts || []).map((item, index) => (
    index === payload.index
      ? {
        ...item,
        previousTitle: item.title,
        previousPrompt: item.prompt,
        title: payload.title,
        prompt: payload.prompt,
        updatedAt: nowIso()
      }
      : item
  ));

  const selectedText = nextWorkflowPrompts.map((item) => item.prompt).join("\n\n") || asset.example || "";
  const rebuilt = buildSkillStructureFromWorkflowPrompts({
    workflowPrompts: nextWorkflowPrompts,
    scenario: asset.scenario || asset.scenarioOverride || "Reusable AI workflow",
    selectedText,
    payload: {
      platform: asset.preferredForPlatforms?.[0] || "other"
    }
  });

  const nextAsset = {
    ...asset,
    workflowPrompts: rebuilt.workflowPrompts,
    inputs: rebuilt.inputs,
    steps: rebuilt.steps,
    stepSources: rebuilt.stepSources,
    promptTemplate: rebuilt.promptTemplate,
    outputFormat: rebuilt.outputFormat,
    example: selectedText,
    useWhen: asset.useWhen || rebuilt.useWhen,
    notFor: asset.notFor || rebuilt.notFor,
    goal: asset.goal || rebuilt.goal,
    whatItDoes: asset.whatItDoes || rebuilt.whatItDoes,
    updatedAt: nowIso()
  };

  if (asset.kind === "skill_draft" || asset.kind === "skill") {
    nextAsset.validation = validateSkillAsset(nextAsset, settings);
  }

  return nextAsset;
}

function buildCombinedPayloadFromSources(sources) {
  const titles = sources
    .map((item) => item.optimizedTitle || item.sourceTitle || item.selectedText || "")
    .filter(Boolean)
    .slice(0, 3);
  const selectedText = sources
    .map((item) => item.optimizedPrompt || item.selectedText || "")
    .filter(Boolean)
    .join("\n\n---\n\n");
  const turns = sources.flatMap((item) => (
    applyOptimizedTurns(item).map((turn) => ({
      ...turn,
      text: `[${item.sourceTitle || item.sourcePlatform || "source"}] ${turn.text}`
    }))
  ));
  const platforms = Array.from(new Set(sources.map((item) => item.sourcePlatform).filter(Boolean)));

  return {
    platform: platforms.length === 1 ? platforms[0] : "mixed",
    platforms,
    url: sources[0]?.sourceUrl || "",
    title: titles.join(" + ") || "Combined captured prompts",
    model: sources[0]?.sourceModel || "",
    selectedText,
    turns,
    conversationId: sources[0]?.id,
    conversationIds: sources.map((item) => item.id)
  };
}

function applyOptimizedTurns(source) {
  if (!source?.optimizedPrompt) {
    return source?.turns || [];
  }

  const userTurnIndex = (source.turns || []).findIndex((turn) => turn.role === "user");
  if (userTurnIndex < 0) {
    return [
      {
        id: `turn_opt_${source.id}`,
        role: "user",
        text: source.optimizedPrompt
      },
      ...(source.turns || [])
    ];
  }

  return (source.turns || []).map((turn, index) => (
    index === userTurnIndex
      ? { ...turn, text: source.optimizedPrompt }
      : turn
  ));
}

async function preparePayloadForCompilation(payload, settings) {
  const workflowPrompts = await optimizeWorkflowTurnsWithApi(payload, settings);
  if (!workflowPrompts.length) {
    return payload;
  }

  const promptMap = new Map();
  workflowPrompts.forEach((item) => {
    (item.sourceTurnIds || []).forEach((turnId) => {
      if (!promptMap.has(turnId) && item.prompt) {
        promptMap.set(turnId, item.prompt);
      }
    });
  });

  const optimizedTurns = (payload.turns || []).map((turn) => (
    turn?.role === "user" && promptMap.has(turn.id)
      ? { ...turn, text: promptMap.get(turn.id) }
      : turn
  ));

  const selectedText = workflowPrompts.map((item) => item.prompt).join("\n\n");

  return {
    ...payload,
    selectedText: selectedText || payload.selectedText,
    turns: optimizedTurns,
    workflowPromptsOverride: workflowPrompts
  };
}

function canUseModelAssist(settings) {
  return Boolean(
    settings?.apiBaseUrl?.trim()
      && settings?.apiModel?.trim()
      && settings?.apiKey?.trim()
  );
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
