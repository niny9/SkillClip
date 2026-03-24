import { MESSAGE_TYPES } from "../../lib/constants.js";

let latestState = null;
let selectedDetail = null;
let selectedConversationIds = new Set();
let latestRunCheck = null;
let selectedWorkflowPrompt = null;

async function load() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  const state = response.result;
  latestState = state;

  const activeConversations = state.conversations.filter((item) => !item.archivedAt);
  const activeSkills = state.skills.filter((item) => item.status !== "archived");
  const activeConversationIds = new Set(activeConversations.map((item) => item.id));
  selectedConversationIds = new Set(Array.from(selectedConversationIds).filter((id) => activeConversationIds.has(id)));

  renderList("[data-queue-raw]", activeConversations, renderConversation);
  renderSkills("[data-skills]", activeSkills, state.variants);
  renderVariants("[data-variants]", state.variants, state.skills);
  renderSelectedCount();
}

function updateSupportingPanelVisibility() {
  const wrapper = document.querySelector("[data-supporting-panel]");
  if (!(wrapper instanceof HTMLElement)) {
    return;
  }

  const hasVisibleChild = [
    "[data-extraction-panel]",
    "[data-validation-panel]",
    "[data-run-check-panel]",
    "[data-step-map-panel]",
    "[data-source-panel]"
  ].some((selector) => {
    const node = document.querySelector(selector);
    return node instanceof HTMLElement && !node.hidden;
  });

  wrapper.hidden = !hasVisibleChild;
}

function setFeedback(message) {
  const node = document.querySelector("[data-feedback]");
  if (node) {
    node.textContent = message;
  }
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setFeedback("没有找到当前活动页面。");
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.ENSURE_CONTENT_SCRIPT,
      payload: { tabId: tab.id }
    });
    await chrome.tabs.sendMessage(tab.id, message);
    setFeedback("已发送到当前页面。");
  } catch (error) {
    setFeedback("当前页面暂时无法连接，可能还没完成注入。");
  }
}

async function applySkillToActiveTab(skill) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setFeedback("没有找到当前活动页面。");
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.ENSURE_CONTENT_SCRIPT,
      payload: { tabId: tab.id }
    });
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: MESSAGE_TYPES.APPLY_SKILL,
      payload: { skill }
    });
    if (response?.ok) {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.INSERT_SKILL,
        payload: { skillId: skill.id }
      });
      setFeedback(`已把技能应用到当前输入框：${skill.name}`);
    } else {
      setFeedback("当前页面应用这个技能失败，请确认输入框已聚焦。");
    }
  } catch (error) {
    setFeedback("当前页面无法连接，请先聚焦到 AI 输入框。");
  }
}

function renderList(selector, items, renderer) {
  const container = document.querySelector(selector);
  if (!items.length) {
    container.innerHTML = "<p class='muted'>这里还没有内容。</p>";
    return;
  }

  container.innerHTML = items.slice(0, 12).map(renderer).join("");
}

function renderSkills(selector, skills, variants) {
  const container = document.querySelector(selector);
  if (!skills.length) {
    container.innerHTML = "<p class='muted'>还没有可复用技能。</p>";
    return;
  }

  const sortedSkills = [...skills].sort((left, right) => rankSkill(right) - rankSkill(left));

  container.innerHTML = sortedSkills
    .map((skill) => {
      const variantsForSkill = variants.filter((variant) => variant.baseSkillId === skill.id || variant.baseSkillId === skill.baseSkillId);
      return renderSkill(skill, variantsForSkill);
    })
    .join("");
}

function renderVariants(selector, variants, skills) {
  const container = document.querySelector(selector);
  if (!variants.length) {
    container.innerHTML = "<p class='muted'>还没有同场景优化版本。</p>";
    return;
  }

  container.innerHTML = variants
    .map((variant) => renderVariant(
      variant,
      skills.find((skill) => skill.id === variant.baseSkillId || skill.baseSkillId === variant.baseSkillId)
    ))
    .join("");
}

function rankSkill(skill) {
  const qualityScore = (skill.workflowPrompts || []).reduce((sum, item) => sum + (item.quality?.score || 0), 0);
  const averageQuality = skill.workflowPrompts?.length ? qualityScore / skill.workflowPrompts.length : 0;
  const usage = skill.usageCount || 0;
  const platformMatch = (skill.preferredForPlatforms || []).includes(getCurrentPlatformHint()) ? 25 : 0;
  return averageQuality + usage * 4 + platformMatch;
}

function getCurrentPlatformHint() {
  const activeLabel = document.querySelector("[data-feedback]")?.textContent || "";
  const normalized = activeLabel.toLowerCase();
  if (normalized.includes("chatgpt")) return "chatgpt";
  if (normalized.includes("claude")) return "claude";
  if (normalized.includes("gemini")) return "gemini";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("kimi")) return "kimi";
  if (normalized.includes("doubao")) return "doubao";
  if (normalized.includes("yuanbao")) return "yuanbao";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("copilot")) return "copilot";
  return "";
}

function renderConversation(item) {
  const linkedDraft = findLinkedDraftForConversation(item.id);
  const hasAutoDraft = Boolean(linkedDraft);
  const compileStatus = item.compileStatus || (hasAutoDraft ? "ready" : "idle");
  const pending = compileStatus === "pending";
  const failed = compileStatus === "failed";
  const summaryText = failed
    ? (item.compileError || "这条素材自动整理失败了，你可以手动重新生成。")
    : linkedDraft?.useWhen || linkedDraft?.goal || linkedDraft?.scenario || "这条素材还没有整理出技能建议。";
  const directActionLabel = linkedDraft
    ? "Promote to Skill / 直接升级成技能"
    : "Generate Skill / 生成技能";
  const editButton = linkedDraft
    ? `<button type="button" data-action="edit-conversation-draft" data-id="${item.id}">Edit Suggestion / 编辑整理结果</button>`
    : "";
  const badgeText = pending
    ? "正在整理中 / 原始素材"
    : failed
      ? "整理失败 / 原始素材"
      : "原始素材";
  return `
    <article class="list-card clickable-card queue-card queue-card-raw ${pending ? "queue-card-pending" : ""} ${failed ? "queue-card-failed" : ""}" data-detail-kind="conversation" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.selectedText || item.sourceTitle || "Captured conversation")}</strong>
      <label class="inline-check">
        <input type="checkbox" data-select-conversation="${item.id}" ${selectedConversationIds.has(item.id) ? "checked" : ""} />
        <span>Select / 选择</span>
      </label>
      <span class="queue-badge ${pending ? "queue-badge-pending" : ""} ${failed ? "queue-badge-failed" : ""}">${badgeText}</span>
      <span>Source / 来源: ${escapeHtml(item.sourcePlatform || "other")} · Mode / 方式: ${escapeHtml(item.captureMode)}</span>
      <div class="meta-block">
        <small>${hasAutoDraft
          ? `已自动整理：${escapeHtml(linkedDraft.status === "draft" ? "可编辑草稿" : "自动建议")}`
          : pending
            ? "系统正在整理这条素材，请稍等。"
            : failed
              ? "这条素材自动整理失败了，你可以手动重新生成。"
              : "这条素材还没有整理出技能建议。"
        }</small>
        <small>${escapeHtml(summaryText)}</small>
      </div>
      <div class="action-row">
        ${editButton}
        <button type="button" data-action="promote-conversation" data-id="${item.id}">${directActionLabel}</button>
        <button type="button" data-action="delete-conversation" data-id="${item.id}">删除</button>
      </div>
    </article>
  `;
}

function renderSkill(item, variantsForSkill = []) {
  const platforms = (item.preferredForPlatforms || []).slice(0, 3).join(", ");
  return `
    <article class="list-card clickable-card" data-detail-kind="skill" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>可复用技能 · ${escapeHtml(item.scenario || "可复用工作流")} · 已使用 ${item.usageCount || 0} 次</span>
      <div class="meta-block">
        ${platforms ? `<small>Platforms / 平台: ${escapeHtml(platforms)}</small>` : ""}
        <small>Variants / 变体数: ${variantsForSkill.length}</small>
        ${variantsForSkill.length ? variantsForSkill.map((variant) => `<small>${escapeHtml(variant.name)}</small>`).join("") : "<small>还没有优化版本。</small>"}
      </div>
      <div class="action-row">
        <button type="button" data-action="edit-skill" data-id="${item.id}">编辑</button>
        <button type="button" data-action="apply-skill" data-id="${item.id}">Apply Now / 立即应用</button>
        <button type="button" data-action="create-variant" data-id="${item.id}">新建优化版</button>
        <button type="button" data-action="delete-skill" data-id="${item.id}">删除</button>
      </div>
    </article>
  `;
}

function renderVariant(item, baseSkill) {
  const platforms = (baseSkill?.preferredForPlatforms || []).slice(0, 3).join(", ");
  return `
    <article class="list-card clickable-card" data-detail-kind="variant" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>同场景优化版本 · 所属技能：${escapeHtml(baseSkill?.name || item.baseSkillId)}</span>
      <div class="meta-block">
        ${platforms ? `<small>Platforms / 平台: ${escapeHtml(platforms)}</small>` : ""}
        <small>${escapeHtml(item.changeSummary || "Variant")}</small>
      </div>
      <div class="action-row">
        <button type="button" data-action="edit-variant" data-id="${item.id}">编辑</button>
        <button type="button" data-action="delete-variant" data-id="${item.id}">删除</button>
      </div>
    </article>
  `;
}

function findLinkedDraftForConversation(conversationId) {
  const conversation = latestState?.conversations?.find((item) => item.id === conversationId);
  if (conversation?.linkedDraftId) {
    const directLinked = latestState?.drafts?.find((draft) => draft.id === conversation.linkedDraftId);
    if (directLinked) {
      return directLinked;
    }
  }
  return latestState?.drafts?.find((draft) => (
    (draft.status === "preview" || draft.status === "draft")
      && (draft.sourceConversationIds || []).includes(conversationId)
  )) || null;
}

async function ensureDraftFromConversation(conversationId) {
  const linkedDraft = findLinkedDraftForConversation(conversationId);
  if (linkedDraft) {
    return linkedDraft;
  }

  const response = await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.COMPILE_CONVERSATION,
    payload: { conversationId }
  });
  await load();
  return response?.result || null;
}

async function promoteConversationDirectly(conversationId) {
  let draft = await ensureDraftFromConversation(conversationId);
  if (!draft?.id) {
    setFeedback("没能根据这条素材生成技能建议。");
    return;
  }

  if (draft.status === "preview") {
    const approved = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.APPROVE_DRAFT_PREVIEW,
      payload: { draftId: draft.id }
    });
    draft = approved?.result || draft;
  }

  if (draft?.id) {
    const promoted = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PROMOTE_DRAFT,
      payload: { draftId: draft.id }
    });
    const skill = promoted?.result || null;
    setFeedback(`已升级为正式技能：${skill?.name || ""}`);
    await load();
  }
}

async function openConversationDraftDetail(conversationId) {
  const draft = await ensureDraftFromConversation(conversationId);
  if (!draft) {
    setFeedback("没能打开这条素材对应的技能建议。");
    return;
  }

  setFeedback("已打开自动整理出的技能建议。");
  showDetailPanel(draft, "draft");
}

function showDetailPanel(item, kind) {
  const promptForm = document.querySelector("[data-prompt-form]");
  const form = document.querySelector("[data-detail-form]");
  const empty = document.querySelector("[data-detail-empty]");
  const title = document.querySelector("[data-detail-title]");
  const note = document.querySelector("[data-detail-note]");
  const sourceTitleLabel = document.querySelector("[data-source-title-label]");
  const sourceContentLabel = document.querySelector("[data-source-content-label]");
  const sourceSaveButton = document.querySelector("[data-source-save-button]");
  const sourceOptimizeButton = document.querySelector("[data-source-optimize-button]");
  const sourceContentWrap = document.querySelector("[data-source-content-wrap]");
  if (!form || !empty || !promptForm) {
    return;
  }

  selectedDetail = { id: item.id, kind };
  latestRunCheck = null;
  renderWorkflowPromptEditor(null);
  updateSelectedCards();
  if (title) {
    const kindLabel = kind === "conversation"
      ? "原始素材"
      : kind === "draft"
        ? "技能草稿"
        : kind === "skill"
          ? "可复用技能"
          : "同场景优化版本";
    title.textContent = `当前选中：${kindLabel} - ${item.name || item.id}`;
  }

  empty.hidden = true;
  promptForm.hidden = kind !== "conversation";
  form.hidden = kind === "conversation";
  if (note) {
    note.hidden = false;
    note.textContent = kind === "conversation"
      ? "原始素材只保留来源、标题和捕获内容。结构化字段只属于技能。"
      : kind === "skill"
      ? "这条技能已经可复用，但下面的字段仍然可以继续编辑。"
      : kind === "variant"
        ? "这是你手动分出来的同场景优化版本，可以继续自由修改。"
        : "这是自动生成的技能草稿建议，升级成正式技能前建议先编辑。";
  }
  if (kind === "conversation") {
    const linkedDraft = findLinkedDraftForConversation(item.id);
    const isFlowCapture = item.captureMode === "whole_flow" || item.captureMode === "recent_turns";
    const displayText = isFlowCapture
      ? summarizeConversationForEditor(item)
      : (item.selectedText || item.turns?.[0]?.text || "");

    promptForm.elements.id.value = item.id || "";
    promptForm.elements.sourceTitle.value = item.sourceTitle || "";
    promptForm.elements.selectedText.value = displayText;
    if (sourceTitleLabel) {
      sourceTitleLabel.textContent = isFlowCapture ? "Flow Title / 工作流标题" : "Prompt Title / Prompt 标题";
    }
    if (sourceContentLabel) {
      sourceContentLabel.textContent = isFlowCapture ? "Flow Content / 工作流内容" : "Prompt Content / Prompt 内容";
    }
    if (sourceSaveButton) {
      sourceSaveButton.textContent = isFlowCapture ? "保存工作流原文" : "保存 Prompt";
    }
    if (sourceOptimizeButton) {
      sourceOptimizeButton.textContent = isFlowCapture ? "整理这段工作流" : "Optimize Prompt / 一键优化";
      sourceOptimizeButton.hidden = isFlowCapture;
    }
    if (sourceContentWrap) {
      sourceContentWrap.classList.toggle("flow-source-wrap", isFlowCapture);
    }
    renderPromptMeta(item);
    renderOptimizedPrompt(isFlowCapture ? null : item);
    renderExtractionPreview(null);
    renderValidationPreview(null);
    renderRunCheckPreview(null);
    renderStepMapPreview(null, item.turns || []);
    renderWorkflowPromptsPreview(isFlowCapture ? (linkedDraft?.workflowPrompts || []) : []);
    renderVariantCompare(item, kind);
    renderSourcePreview(item);
    if (note) {
      note.hidden = false;
      note.textContent = isFlowCapture
        ? "这是你保存下来的整段工作流原文。下面优先展示系统整理出的工作流 Prompt，而不是单条 Prompt。"
        : "原始素材只保留来源、标题和捕获内容。结构化字段只属于技能。";
    }
    updateSupportingPanelVisibility();
    return;
  }
  if (sourceTitleLabel) {
    sourceTitleLabel.textContent = "Prompt Title / Prompt 标题";
  }
  if (sourceContentLabel) {
    sourceContentLabel.textContent = "Prompt Content / Prompt 内容";
  }
  if (sourceSaveButton) {
    sourceSaveButton.textContent = "保存 Prompt";
  }
  if (sourceOptimizeButton) {
    sourceOptimizeButton.textContent = "Optimize Prompt / 一键优化";
    sourceOptimizeButton.hidden = false;
  }
  if (sourceContentWrap) {
    sourceContentWrap.classList.remove("flow-source-wrap");
  }
  form.elements.id.value = item.id || "";
  form.elements.kind.value = kind;
  form.elements.name.value = item.name || "";
  form.elements.scenario.value = item.scenario || item.scenarioOverride || "";
  form.elements.useWhen.value = item.useWhen || "";
  form.elements.notFor.value = item.notFor || "";
  form.elements.goal.value = item.goal || item.changeSummary || "";
  form.elements.promptTemplate.value = item.promptTemplate || "";
  form.elements.steps.value = (item.steps || []).join("\n");
  form.elements.outputFormat.value = item.outputFormat || "";
  form.elements.successCriteria.value = (item.successCriteria || []).join("\n");
  renderExtractionPreview(item.extraction);
  renderValidationPreview(kind === "variant" ? null : item.validation);
  renderRunCheckPreview(null);
  renderStepMapPreview(item.stepSources || [], item.steps || []);
  renderWorkflowPromptsPreview(item.workflowPrompts || []);
  renderVariantCompare(item, kind);
  renderSourcePreview(item);
  updateSupportingPanelVisibility();
}

function hideDetailPanel() {
  const promptForm = document.querySelector("[data-prompt-form]");
  const promptMeta = document.querySelector("[data-prompt-meta]");
  const form = document.querySelector("[data-detail-form]");
  const empty = document.querySelector("[data-detail-empty]");
  const sourcePanel = document.querySelector("[data-source-panel]");
  const supportingPanel = document.querySelector("[data-supporting-panel]");
  const sourceContent = document.querySelector("[data-source-content]");
  const optimizedPanel = document.querySelector("[data-optimized-prompt-panel]");
  const optimizedContent = document.querySelector("[data-optimized-prompt-content]");
  const extractionPanel = document.querySelector("[data-extraction-panel]");
  const extractionContent = document.querySelector("[data-extraction-content]");
  const validationPanel = document.querySelector("[data-validation-panel]");
  const validationContent = document.querySelector("[data-validation-content]");
  const runCheckPanel = document.querySelector("[data-run-check-panel]");
  const runCheckContent = document.querySelector("[data-run-check-content]");
  const stepMapPanel = document.querySelector("[data-step-map-panel]");
  const stepMapContent = document.querySelector("[data-step-map-content]");
  const workflowPromptsPanel = document.querySelector("[data-workflow-prompts-panel]");
  const workflowPromptsContent = document.querySelector("[data-workflow-prompts-content]");
  const workflowEditorPanel = document.querySelector("[data-workflow-editor-panel]");
  const workflowPromptForm = document.querySelector("[data-workflow-prompt-form]");
  const workflowPromptCheck = document.querySelector("[data-workflow-prompt-check]");
  const comparePanel = document.querySelector("[data-compare-panel]");
  const compareContent = document.querySelector("[data-compare-content]");
  const title = document.querySelector("[data-detail-title]");
  const note = document.querySelector("[data-detail-note]");
  if (!form || !empty || !promptForm) {
    return;
  }

  selectedDetail = null;
  selectedWorkflowPrompt = null;
  updateSelectedCards();
  promptForm.hidden = true;
  promptForm.reset();
  form.hidden = true;
  form.reset();
  empty.hidden = false;
  if (title) {
    title.textContent = "当前未选中任何条目";
  }
  if (note) {
    note.hidden = true;
  }
  if (sourcePanel) {
    sourcePanel.hidden = true;
  }
  if (supportingPanel) {
    supportingPanel.hidden = true;
  }
  if (sourceContent) {
    sourceContent.innerHTML = "";
  }
  if (optimizedPanel) {
    optimizedPanel.hidden = true;
  }
  if (optimizedContent) {
    optimizedContent.innerHTML = "";
  }
  if (extractionPanel) {
    extractionPanel.hidden = true;
  }
  if (extractionContent) {
    extractionContent.innerHTML = "";
  }
  if (validationPanel) {
    validationPanel.hidden = true;
  }
  if (validationContent) {
    validationContent.innerHTML = "";
  }
  if (runCheckPanel) {
    runCheckPanel.hidden = true;
  }
  if (runCheckContent) {
    runCheckContent.innerHTML = "";
  }
  if (stepMapPanel) {
    stepMapPanel.hidden = true;
  }
  if (stepMapContent) {
    stepMapContent.innerHTML = "";
  }
  if (workflowPromptsPanel) {
    workflowPromptsPanel.hidden = true;
  }
  if (workflowPromptsContent) {
    workflowPromptsContent.innerHTML = "";
  }
  if (workflowEditorPanel) {
    workflowEditorPanel.hidden = true;
  }
  if (workflowPromptForm) {
    workflowPromptForm.reset();
  }
  if (workflowPromptCheck) {
    workflowPromptCheck.innerHTML = "";
  }
  if (comparePanel) {
    comparePanel.hidden = true;
  }
  if (compareContent) {
    compareContent.innerHTML = "";
  }
  updateSupportingPanelVisibility();
}

function renderOptimizedPrompt(item) {
  const panel = document.querySelector("[data-optimized-prompt-panel]");
  const content = document.querySelector("[data-optimized-prompt-content]");
  if (!panel || !content) {
    return;
  }

  if (!item?.optimizedPrompt) {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  panel.hidden = false;
  content.innerHTML = `
    <article class="list-card">
      <strong>${escapeHtml(item.optimizedTitle || "优化后的 Prompt")}</strong>
      ${item.inferredScenario ? `<span>${escapeHtml(item.inferredScenario)}</span>` : ""}
      <div class="meta-block">
        <small>${escapeHtml(item.optimizedPrompt)}</small>
      </div>
    </article>
  `;
}

function summarizeConversationForEditor(item) {
  const turns = Array.isArray(item?.turns) ? item.turns : [];
  if (!turns.length) {
    return item?.selectedText || "";
  }

  return turns
    .map((turn, index) => `${index + 1}. ${turn.role === "assistant" ? "AI" : "用户"}：${turn.text || ""}`)
    .join("\n\n")
    .slice(0, 5000);
}

function renderWorkflowPromptsPreview(items) {
  const panel = document.querySelector("[data-workflow-prompts-panel]");
  const content = document.querySelector("[data-workflow-prompts-content]");
  if (!panel || !content) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  panel.hidden = false;
  content.innerHTML = items.map((item, index) => `
    <article class="list-card">
      <strong>第 ${index + 1} 条 · ${escapeHtml(item.title || `工作流 Prompt ${index + 1}`)}</strong>
      <span>${escapeHtml(item.prompt || "")}</span>
      <div class="meta-block">
        <small>对应步骤：第 ${index + 1} 步</small>
        ${item.quality ? `<small>质量分：${escapeHtml(String(item.quality.score))} · 优先级：${escapeHtml(item.quality.priority)}</small>` : ""}
        ${item.sourceTurnIds?.length ? `<small>来源轮次：${escapeHtml(item.sourceTurnIds.join(", "))}</small>` : "<small>还没有关联到来源轮次。</small>"}
      </div>
      <div class="action-row">
        <button type="button" data-action="edit-workflow-prompt" data-index="${index}">编辑</button>
        <button type="button" data-action="optimize-workflow-prompt-inline" data-index="${index}">一键优化</button>
        <button type="button" data-action="run-workflow-prompt-check" data-index="${index}">检查这条 Prompt</button>
      </div>
      ${item.sourceTurnIds?.length ? `<div class="action-row">${item.sourceTurnIds.map((turnId) => `<button type="button" data-action="jump-to-turn" data-turn-id="${escapeHtml(turnId)}">定位到 ${escapeHtml(turnId)}</button>`).join("")}</div>` : ""}
    </article>
  `).join("");
}

function renderWorkflowPromptEditor(item, index, promptCheck = null) {
  const panel = document.querySelector("[data-workflow-editor-panel]");
  const form = document.querySelector("[data-workflow-prompt-form]");
  const checkNode = document.querySelector("[data-workflow-prompt-check]");
  if (!panel || !form || !checkNode) {
    return;
  }

  if (!item) {
    selectedWorkflowPrompt = null;
    panel.hidden = true;
    form.reset();
    checkNode.innerHTML = "";
    return;
  }

  selectedWorkflowPrompt = { index };
  panel.hidden = false;
  form.elements.index.value = String(index);
  form.elements.title.value = item.title || "";
  form.elements.prompt.value = item.prompt || "";
  checkNode.innerHTML = promptCheck
    ? `
      <article class="list-card ${promptCheck.running ? "status-running" : ""}">
        <strong>${escapeHtml(promptCheck.running ? "正在检查这条 Prompt..." : promptCheck.ok ? "这条 Prompt 可以使用" : "这条 Prompt 还需要继续优化")}</strong>
        <span>${escapeHtml(promptCheck.summary || "")}</span>
        ${(Array.isArray(promptCheck.issues) && promptCheck.issues.length)
          ? `<div class="meta-block"><small>${escapeHtml(promptCheck.issues.join(" | "))}</small></div>`
          : "<p class='muted'>当前没有额外的 Prompt 级问题。</p>"}
      </article>
    `
    : `
      <div class="meta-block">
        ${item.quality ? `<small>质量分：${escapeHtml(String(item.quality.score))} · 优先级：${escapeHtml(item.quality.priority)}</small>` : ""}
        ${(Array.isArray(item.quality?.issues) && item.quality.issues.length)
          ? `<small>${escapeHtml(item.quality.issues.join(" | "))}</small>`
          : "<small>当前没有明显的质量警告。</small>"}
      </div>
      ${(item.previousPrompt || item.previousTitle)
        ? `<details class="raw-json-wrap"><summary>上一版本</summary><div class="meta-block"><small>${escapeHtml(item.previousTitle || "")}</small><small>${escapeHtml(item.previousPrompt || "")}</small></div></details>`
        : "<p class='muted'>你可以在这里编辑单条工作流 Prompt，然后保存或单独检查。</p>"}
    `;
}

function renderRunCheckPreview(result) {
  const panel = document.querySelector("[data-run-check-panel]");
  const content = document.querySelector("[data-run-check-content]");
  if (!panel || !content) {
    return;
  }

  if (!result) {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  panel.hidden = false;
  const issues = result.issues?.length
    ? `<ul class="detail-list">${result.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>`
    : "<p class='muted'>当前没有明显的阻塞问题。</p>";
  const promptChecks = Array.isArray(result.promptChecks) && result.promptChecks.length
    ? `
      <div class="meta-block">
        <small>工作流 Prompt 检查</small>
      </div>
      ${result.promptChecks.map((item, index) => `
        <article class="list-card">
          <strong>Prompt ${index + 1} · ${escapeHtml(item.title || `Prompt ${index + 1}`)}</strong>
          <span>${escapeHtml(item.ok ? "可用" : "还需要继续优化")}</span>
          <div class="meta-block">
            <small>${escapeHtml(item.summary || "")}</small>
            ${(Array.isArray(item.issues) && item.issues.length)
              ? `<small>${escapeHtml(item.issues.join(" | "))}</small>`
              : "<small>这条 Prompt 当前没有额外问题。</small>"}
          </div>
        </article>
      `).join("")}
    `
    : "";

  content.innerHTML = `
    <article class="list-card">
      <strong>${escapeHtml(result.ok ? "整体技能可以使用" : "整体技能还需要继续优化")}</strong>
      <span>${escapeHtml(result.summary || "")}</span>
      ${result.checkedAt ? `<p class="muted">检查时间：${escapeHtml(result.checkedAt)}</p>` : ""}
      ${result.outputPreview ? `<div class="meta-block"><small>输出预览</small><small>${escapeHtml(result.outputPreview.slice(0, 800))}</small></div>` : ""}
      ${issues}
    </article>
    ${promptChecks}
  `;
}

function renderStepMapPreview(stepSources, fallbackItems = []) {
  const panel = document.querySelector("[data-step-map-panel]");
  const content = document.querySelector("[data-step-map-content]");
  if (!panel || !content) {
    return;
  }

  if (!Array.isArray(stepSources) || stepSources.length === 0) {
    if (!Array.isArray(fallbackItems) || fallbackItems.length === 0) {
      panel.hidden = true;
      content.innerHTML = "";
      return;
    }

    panel.hidden = false;
    content.innerHTML = `
      <ul class="detail-list">
        ${fallbackItems.map((item, index) => `<li>${index + 1}. ${escapeHtml(item.text || item)}</li>`).join("")}
      </ul>
    `;
    return;
  }

  panel.hidden = false;
  content.innerHTML = stepSources.map((item, index) => `
    <article class="list-card">
      <strong>第 ${index + 1} 步</strong>
      <span>${escapeHtml(item.step || "")}</span>
      ${item.sourceTurnIds?.length ? `<div class="action-row">${item.sourceTurnIds.map((turnId) => `<button type="button" data-action="jump-to-turn" data-turn-id="${escapeHtml(turnId)}">定位到 ${escapeHtml(turnId)}</button>`).join("")}</div>` : ""}
      ${item.sourcePreview ? `<div class="meta-block"><small>来源摘要</small><small>${escapeHtml(item.sourcePreview)}</small></div>` : ""}
    </article>
  `).join("");
}

function renderPromptMeta(item) {
  const container = document.querySelector("[data-prompt-meta]");
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="meta-block">
      <small>Platform / 平台: ${escapeHtml(item.sourcePlatform || "other")}</small>
      <small>Mode / 方式: ${escapeHtml(item.captureMode || "selection")}</small>
      <small>URL / 链接: ${escapeHtml(item.sourceUrl || "")}</small>
      <small>Turns / 对话轮次: ${escapeHtml(String(item.turns?.length || 0))}</small>
    </div>
  `;
}

function updateSelectedCards() {
  document.querySelectorAll("[data-detail-id]").forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const isSelected = selectedDetail
      && node.dataset.detailId === selectedDetail.id
      && node.dataset.detailKind === selectedDetail.kind;
    node.classList.toggle("selected-card", Boolean(isSelected));
  });
}

function renderExtractionPreview(extraction) {
  const panel = document.querySelector("[data-extraction-panel]");
  const content = document.querySelector("[data-extraction-content]");
  if (!panel || !content) {
    return;
  }

  if (!extraction) {
    panel.hidden = false;
    content.innerHTML = "<p class='muted'>Local heuristic extraction / 本地规则抽取</p>";
    return;
  }

  panel.hidden = false;
  content.innerHTML = `
    <div class="meta-block">
      <small>Mode / 模式: ${escapeHtml(extraction.mode || "unknown")}</small>
      <small>Provider / 服务商: ${escapeHtml(extraction.provider || "local")}</small>
      <small>Model / 模型: ${escapeHtml(extraction.model || "heuristic")}</small>
      <small>Extracted At / 抽取时间: ${escapeHtml(extraction.extractedAt || "")}</small>
    </div>
  `;
}

function renderValidationPreview(validation) {
  const panel = document.querySelector("[data-validation-panel]");
  const content = document.querySelector("[data-validation-content]");
  if (!panel || !content) {
    return;
  }

  if (!validation) {
    panel.hidden = false;
    content.innerHTML = "<p class='muted'>This check runs automatically when a preview is generated, when you save edits, and when a draft is promoted to a reusable skill.</p>";
    return;
  }

  panel.hidden = false;
  const issues = validation.issues?.length
    ? validation.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")
    : "<li>当前没有明显问题。</li>";

  content.innerHTML = `
    <div class="validation-card status-${escapeHtml(validation.status || "unknown")}">
      <div class="validation-topline">
        <div class="status-pill status-${escapeHtml(validation.status || "unknown")}">
          ${escapeHtml(validation.mode || "local")} · ${escapeHtml(validation.status || "unknown")}
        </div>
        ${validation.score != null ? `<strong class="validation-score">${escapeHtml(String(validation.score))}</strong>` : ""}
      </div>
      <p class="muted">${validation.checkedAt ? `检查时间：${escapeHtml(validation.checkedAt)}` : "暂时还没有检查时间。"}</p>
      <p class="muted">会在生成草稿、保存编辑、升级技能时自动运行。</p>
      <ul class="detail-list">${issues}</ul>
    </div>
  `;
}

function renderVariantCompare(item, kind) {
  const panel = document.querySelector("[data-compare-panel]");
  const content = document.querySelector("[data-compare-content]");
  if (!panel || !content || !latestState) {
    return;
  }

  if (kind !== "variant") {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  const baseSkill = latestState.skills.find((skill) => skill.id === item.baseSkillId || skill.baseSkillId === item.baseSkillId);
  if (!baseSkill) {
    panel.hidden = false;
    content.innerHTML = "<p class='muted'>这条优化版本还没有找到对应的基础技能。</p>";
    return;
  }

  panel.hidden = false;
  content.innerHTML = `
    <article class="list-card">
      <strong>${escapeHtml(baseSkill.name || "Base skill")}</strong>
      <span>${escapeHtml(baseSkill.scenario || "暂未填写场景")}</span>
      <div class="meta-block">
        <small>Base prompt / 基础模板</small>
        <small>${escapeHtml((baseSkill.promptTemplate || "").slice(0, 220) || "暂时还没有运行手册")}</small>
      </div>
      <div class="meta-block">
        <small>Your variant focus / 你的优化点</small>
        <small>${escapeHtml(item.changeSummary || "暂时还没有填写优化重点。")}</small>
      </div>
    </article>
  `;
}

function renderSourcePreview(item) {
  const sourcePanel = document.querySelector("[data-source-panel]");
  const sourceContent = document.querySelector("[data-source-content]");
  if (!sourcePanel || !sourceContent || !latestState) {
    return;
  }

  if (item?.kind === "conversation_memory") {
    sourcePanel.hidden = false;
    sourceContent.innerHTML = renderSourceCard(item);
    return;
  }

  const sourceIds = item.sourceConversationIds || [];
  const sources = latestState.conversations.filter((conversation) => sourceIds.includes(conversation.id));

  if (!sources.length) {
    sourcePanel.hidden = false;
    sourceContent.innerHTML = "<p class='muted'>这条技能暂时还没有关联来源对话。</p>";
    return;
  }

  sourcePanel.hidden = false;
  sourceContent.innerHTML = sources.slice(0, 3).map(renderSourceCard).join("");
}

function renderSelectedCount() {
  const node = document.querySelector("[data-selected-count]");
  if (node) {
    node.textContent = `已选择：${selectedConversationIds.size}`;
  }
}

function renderSourceCard(source) {
  const turnsPreview = (source.turns || [])
    .slice(0, 8)
    .map((turn) => `
      <div class="source-turn source-turn-${escapeHtml(turn.role || "unknown")}" data-turn-id="${escapeHtml(turn.id || "")}">
        <strong>${escapeHtml(turn.role || "unknown")} · Turn / 第${escapeHtml(String((source.turns || []).indexOf(turn) + 1))}轮</strong>
        <span>${escapeHtml(turn.text || "")}</span>
      </div>
    `)
    .join("");

  return `
    <article class="list-card source-card">
      <strong>${escapeHtml(source.sourceTitle || source.selectedText || "原始对话")}</strong>
      <span>Platform / 平台: ${escapeHtml(source.sourcePlatform || "other")}</span>
      <span>Mode / 方式: ${escapeHtml(source.captureMode || "unknown")}</span>
      ${source.selectedText ? `<div class="meta-block"><small>Selected text / 选中文本</small><small>${escapeHtml(source.selectedText.slice(0, 180))}</small></div>` : ""}
      <details class="raw-json-wrap">
        <summary>查看完整来源时间线</summary>
        <div class="meta-block"><small>URL</small><small>${escapeHtml(source.sourceUrl || "")}</small></div>
        ${turnsPreview ? `<div class="source-turns"><small>对话时间线</small>${turnsPreview}</div>` : ""}
      </details>
      <div class="action-row">
        <button type="button" data-action="re-save-source-prompt" data-source-id="${source.id}">另存为 Prompt</button>
        <button type="button" data-action="recompile-source-skill" data-source-id="${source.id}">重新编译为草稿</button>
      </div>
    </article>
  `;
}

function buildPayloadFromConversation(source) {
  return {
    platform: source.sourcePlatform,
    url: source.sourceUrl,
    title: source.sourceTitle,
    model: source.sourceModel,
    selectedText: source.selectedText || source.turns?.[0]?.text || "",
    turns: source.turns || []
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrentDetailAsset() {
  if (!selectedDetail || !latestState) {
    return null;
  }

  if (selectedDetail.kind === "draft") {
    return latestState.drafts.find((item) => item.id === selectedDetail.id) || null;
  }
  if (selectedDetail.kind === "skill") {
    return latestState.skills.find((item) => item.id === selectedDetail.id) || null;
  }
  if (selectedDetail.kind === "variant") {
    return latestState.variants.find((item) => item.id === selectedDetail.id) || null;
  }

  return null;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.STORAGE_UPDATED) {
    load();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "promote-draft" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PROMOTE_DRAFT, payload: { draftId: id } });
    return;
  }

  if (action === "approve-preview" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.APPROVE_DRAFT_PREVIEW, payload: { draftId: id } });
    setFeedback("已把当前预览保存为草稿。");
    return;
  }

  if (action === "create-variant" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CREATE_VARIANT, payload: { skillId: id } });
    return;
  }

  if (action === "delete-conversation" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_CONVERSATION, payload: { conversationId: id } });
    setFeedback("这条原始素材已删除。");
    hideDetailPanel();
    return;
  }

  if (action === "promote-conversation" && id) {
    await promoteConversationDirectly(id);
    return;
  }

  if (action === "compile-selected") {
    if (selectedConversationIds.size === 0) {
      setFeedback("请先选择至少一条 Prompt。");
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.COMPILE_SELECTIONS,
      payload: { conversationIds: Array.from(selectedConversationIds) }
    });
    const draft = response?.result || null;
    await load();
    if (draft) {
      showDetailPanel(draft, "draft");
      setFeedback("已把选中的 Prompt 合并成一条技能草稿。");
    }
    return;
  }

  if (action === "edit-conversation-draft" && id) {
    await openConversationDraftDetail(id);
    return;
  }

  if (action === "delete-draft" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_DRAFT, payload: { draftId: id } });
    setFeedback("这条草稿已删除。");
    hideDetailPanel();
    return;
  }

  if (action === "delete-skill" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_SKILL, payload: { skillId: id } });
    setFeedback("这条技能已删除。");
    hideDetailPanel();
    return;
  }

  if (action === "edit-skill" && id) {
    const item = latestState?.skills.find((skill) => skill.id === id);
    if (item) {
      showDetailPanel(item, "skill");
    }
    return;
  }

  if (action === "apply-skill" && id) {
    const item = latestState?.skills.find((skill) => skill.id === id);
    if (item) {
      await applySkillToActiveTab(item);
    }
    return;
  }

  if (action === "run-skill-check") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    renderRunCheckPreview({
      ok: false,
      summary: "正在执行整条技能的试运行检查，请稍等...",
      outputPreview: "",
      issues: [],
      checkedAt: ""
    });
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RUN_SKILL_CHECK,
      payload: { id: selectedDetail.id }
    });
    latestRunCheck = response?.result || null;
    renderRunCheckPreview(latestRunCheck);
    setFeedback("技能试运行检查已完成。");
    return;
  }

  if (action === "edit-workflow-prompt") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    const asset = getCurrentDetailAsset();
    const index = Number(target.dataset.index);
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这条工作流 Prompt。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index);
    setFeedback("已打开这条工作流 Prompt，准备编辑。");
    return;
  }

  if (action === "run-workflow-prompt-check") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    const asset = getCurrentDetailAsset();
    const index = Number(target.dataset.index ?? selectedWorkflowPrompt?.index);
    if (!Number.isInteger(index) || index < 0) {
      setFeedback("请先选择一条工作流 Prompt。");
      return;
    }
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这条工作流 Prompt。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index, {
      ok: false,
      running: true,
      summary: "系统正在调用模型检查这条 Prompt，请稍等。",
      issues: []
    });
    setFeedback(`正在检查第 ${index + 1} 条工作流 Prompt...`);
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RUN_WORKFLOW_PROMPT_CHECK,
      payload: { id: selectedDetail.id, index }
    });
    const latestAsset = getCurrentDetailAsset();
    const latestPrompt = latestAsset?.workflowPrompts?.[index] || prompt;
    renderWorkflowPromptEditor(latestPrompt, index, response?.result || null);
    setFeedback(`第 ${index + 1} 条工作流 Prompt 检查已完成。`);
    return;
  }

  if (action === "optimize-workflow-prompt") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    const index = Number(selectedWorkflowPrompt?.index);
    if (!Number.isInteger(index) || index < 0) {
      setFeedback("请先选择一条工作流 Prompt。");
      return;
    }
    const asset = getCurrentDetailAsset();
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这条工作流 Prompt。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index, {
      ok: false,
      running: true,
      summary: "系统正在优化这条工作流 Prompt，请稍等。",
      issues: []
    });
    setFeedback(`正在优化第 ${index + 1} 条工作流 Prompt...`);
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OPTIMIZE_WORKFLOW_PROMPT,
      payload: { id: selectedDetail.id, kind: selectedDetail.kind, index }
    });
    await load();
    const nextAsset = getCurrentDetailAsset();
    const nextPrompt = nextAsset?.workflowPrompts?.[index];
    if (nextAsset) {
      showDetailPanel(nextAsset, selectedDetail.kind);
    }
    if (nextPrompt) {
      renderWorkflowPromptEditor(nextPrompt, index, {
        ok: true,
        summary: "这条工作流 Prompt 已优化完成。",
        issues: []
      });
    }
    setFeedback(`第 ${index + 1} 条工作流 Prompt 已优化完成。`);
    return;
  }

  if (action === "optimize-workflow-prompt-inline") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || index < 0) {
      setFeedback("没有找到这条工作流 Prompt。");
      return;
    }
    const asset = getCurrentDetailAsset();
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这条工作流 Prompt。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index, {
      ok: false,
      running: true,
      summary: "系统正在优化这条工作流 Prompt，请稍等。",
      issues: []
    });
    setFeedback(`正在优化第 ${index + 1} 条工作流 Prompt...`);
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OPTIMIZE_WORKFLOW_PROMPT,
      payload: { id: selectedDetail.id, kind: selectedDetail.kind, index }
    });
    await load();
    const nextAsset = getCurrentDetailAsset();
    const nextPrompt = nextAsset?.workflowPrompts?.[index];
    if (nextAsset) {
      showDetailPanel(nextAsset, selectedDetail.kind);
    }
    if (nextPrompt) {
      renderWorkflowPromptEditor(nextPrompt, index, response?.result ? {
        ok: true,
        summary: "这条工作流 Prompt 已优化完成。",
        issues: []
      } : null);
    }
    setFeedback(`第 ${index + 1} 条工作流 Prompt 已优化完成。`);
    return;
  }

  if (action === "delete-variant" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_VARIANT, payload: { variantId: id } });
    setFeedback("这条优化版本已删除。");
    hideDetailPanel();
    return;
  }

  if (action === "edit-variant" && id) {
    const item = latestState?.variants.find((variant) => variant.id === id);
    if (item) {
      showDetailPanel({
        ...item,
        scenario: item.scenarioOverride || "",
        useWhen: "",
        notFor: "",
        goal: item.changeSummary || "",
        outputFormat: "",
        successCriteria: [],
        steps: item.steps || []
      }, "variant");
    }
    return;
  }

  if (action === "open-actionbar") {
    await sendToActiveTab({ type: MESSAGE_TYPES.OPEN_ACTION_BAR });
    return;
  }

  if (action === "open-palette") {
    await sendToActiveTab({ type: MESSAGE_TYPES.OPEN_SKILL_PALETTE });
    return;
  }

  if (action === "open-control-center") {
    await chrome.runtime.openOptionsPage();
    setFeedback("已打开控制中心。");
    return;
  }

  if (action === "refresh-workspace") {
    await load();
    setFeedback("工作台已刷新。");
    return;
  }

  if (action === "clear-detail") {
    hideDetailPanel();
    return;
  }

  if (action === "clear-workflow-editor") {
    renderWorkflowPromptEditor(null);
    return;
  }

  if (action === "re-save-source-prompt") {
    const sourceId = target.dataset.sourceId;
    const source = latestState?.conversations.find((item) => item.id === sourceId);
    if (source) {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SAVE_PROMPT,
        payload: buildPayloadFromConversation(source)
      });
      setFeedback("已把来源内容另存为 Prompt。");
    }
    return;
  }

  if (action === "recompile-source-skill") {
    const sourceId = target.dataset.sourceId;
    const source = latestState?.conversations.find((item) => item.id === sourceId);
    if (source) {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.COMPILE_SKILL,
        payload: buildPayloadFromConversation(source)
      });
      setFeedback("已根据来源内容重新生成草稿。");
    }
    return;
  }

  if (action === "optimize-conversation") {
    if (!selectedDetail || selectedDetail.kind !== "conversation") {
      setFeedback("请先选中一条原始素材。");
      return;
    }
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.OPTIMIZE_CONVERSATION,
      payload: { conversationId: selectedDetail.id }
    });
    if (response?.result) {
      renderOptimizedPrompt(response.result);
      setFeedback("这条 Prompt 已优化完成。");
      await load();
    }
    return;
  }

  if (action === "jump-to-turn") {
    const turnId = target.dataset.turnId;
    const turnNode = turnId ? document.querySelector(`[data-turn-id="${CSS.escape(turnId)}"]`) : null;
    const detail = turnNode?.closest("details");
    if (detail instanceof HTMLDetailsElement) {
      detail.open = true;
    }
    turnNode?.scrollIntoView({ behavior: "smooth", block: "center" });
    turnNode?.classList.add("selected-card");
    window.setTimeout(() => turnNode?.classList.remove("selected-card"), 1200);
    return;
  }

  if (target.closest("button")) {
    return;
  }

  if (target.closest(".inline-check")) {
    return;
  }

  const checkbox = target.closest("[data-select-conversation]");
  if (checkbox instanceof HTMLInputElement) {
    if (checkbox.checked) {
      selectedConversationIds.add(checkbox.dataset.selectConversation);
    } else {
      selectedConversationIds.delete(checkbox.dataset.selectConversation);
    }
    renderSelectedCount();
    return;
  }

  const card = target.closest("[data-detail-id]");
  if (!(card instanceof HTMLElement) || !latestState) {
    return;
  }

  const detailId = card.dataset.detailId;
  const detailKind = card.dataset.detailKind;
  if (!detailId || !detailKind) {
    return;
  }

  if (detailKind === "draft") {
    const item = latestState.drafts.find((draft) => draft.id === detailId);
    if (item) {
      showDetailPanel(item, "draft");
    }
  }

  if (detailKind === "conversation") {
    const item = latestState.conversations.find((conversation) => conversation.id === detailId);
    if (item) {
      showDetailPanel(item, "conversation");
    }
  }

  if (detailKind === "skill") {
    const item = latestState.skills.find((skill) => skill.id === detailId);
    if (item) {
      showDetailPanel(item, "skill");
    }
  }

  if (detailKind === "variant") {
    const item = latestState.variants.find((variant) => variant.id === detailId);
    if (item) {
      showDetailPanel({
        ...item,
        scenario: item.scenarioOverride || "",
        useWhen: "",
        notFor: "",
        goal: item.changeSummary || "",
        outputFormat: "",
        successCriteria: [],
        steps: item.steps || []
      }, "variant");
    }
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.selectConversation) {
    if (target.checked) {
      selectedConversationIds.add(target.dataset.selectConversation);
    } else {
      selectedConversationIds.delete(target.dataset.selectConversation);
    }
    renderSelectedCount();
  }
});

document.querySelector("[data-detail-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    id: String(formData.get("id") || ""),
    name: String(formData.get("name") || ""),
    scenario: String(formData.get("scenario") || ""),
    useWhen: String(formData.get("useWhen") || ""),
    notFor: String(formData.get("notFor") || ""),
    goal: String(formData.get("goal") || ""),
    promptTemplate: String(formData.get("promptTemplate") || ""),
    outputFormat: String(formData.get("outputFormat") || ""),
    successCriteria: String(formData.get("successCriteria") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    steps: String(formData.get("steps") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  };
  const kind = String(formData.get("kind") || "");

  if (kind === "draft") {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.UPDATE_DRAFT, payload });
    setFeedback("草稿已保存。");
  }

  if (kind === "skill") {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.UPDATE_SKILL, payload });
    setFeedback("技能已保存。");
  }

  if (kind === "variant") {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.UPDATE_VARIANT, payload });
    setFeedback("优化版本已保存。");
  }
});

document.querySelector("[data-prompt-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_CONVERSATION,
    payload: {
      id: String(formData.get("id") || ""),
      sourceTitle: String(formData.get("sourceTitle") || ""),
      selectedText: String(formData.get("selectedText") || "")
    }
  });
  setFeedback("Prompt 已保存。");
});

document.querySelector("[data-workflow-prompt-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedDetail || selectedDetail.kind === "conversation") {
    setFeedback("请先选中一条草稿、技能或优化版本。");
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const index = Number(formData.get("index"));
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.UPDATE_WORKFLOW_PROMPT,
    payload: {
      id: selectedDetail.id,
      kind: selectedDetail.kind,
      index,
      title: String(formData.get("title") || ""),
      prompt: String(formData.get("prompt") || "")
    }
  });
  await load();
  const asset = getCurrentDetailAsset();
  const prompt = asset?.workflowPrompts?.[index];
  if (asset) {
    showDetailPanel(asset, selectedDetail.kind);
  }
  if (prompt) {
    renderWorkflowPromptEditor(prompt, index);
  }
  setFeedback("工作流 Prompt 已保存。");
});

load();
