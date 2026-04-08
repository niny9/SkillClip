import { MESSAGE_TYPES } from "../../lib/constants.js";

let latestState = null;
let selectedDetail = null;
let selectedConversationIds = new Set();
let latestRunCheck = null;
let selectedWorkflowPrompt = null;

const SCENARIO_LABELS = {
  "Social profile writing": "社交名片整理",
  "Podcast interview planning": "播客访谈策划",
  "Interview outline generation": "访谈提纲整理",
  "Product PRD writing": "产品 PRD 撰写",
  "Marketing copy generation": "营销文案生成",
  "SQL debugging": "SQL 排错",
  "Research synthesis": "研究总结",
  "Meeting summary": "会议纪要",
  "Writing assistant": "写作助手",
  "Coding workflow": "代码工作流",
  "Learning plan": "学习计划",
  "Content repurposing": "内容二次创作",
  "Social post generation": "社交平台内容生成",
  "Video script writing": "视频脚本撰写",
  "Sales outreach": "销售触达文案",
  "Customer support reply": "客服回复",
  "Translation refinement": "翻译润色",
  "Prompt optimization": "提示词优化",
  "Workflow automation": "工作流自动化",
  "General AI workflow": "通用 AI 工作流",
  "Reusable AI workflow": "可复用 AI 工作流"
};

const SCENARIO_CANONICAL = Object.fromEntries(
  Object.entries(SCENARIO_LABELS).map(([key, value]) => [value, key])
);

function localizeScenario(value = "") {
  return SCENARIO_LABELS[value] || value;
}

function canonicalizeScenario(value = "") {
  return SCENARIO_CANONICAL[value] || value;
}

function parseWorkflowPromptSections(prompt = "") {
  const lines = String(prompt || "").split("\n");
  const sections = { body: [] };
  let current = "body";

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^#\s*(本步动作|步骤动作|当前动作|TASK|任务|总体任务)$/i.test(trimmed)) {
      current = "task";
      sections[current] = [];
      return;
    }
    if (/^#\s*(本步上下文|当前上下文|CONTEXT|上下文)$/i.test(trimmed)) {
      current = "context";
      sections[current] = [];
      return;
    }
    if (/^#\s*(本步要求|当前要求|REQUIREMENTS|要求)$/i.test(trimmed)) {
      current = "requirements";
      sections[current] = [];
      return;
    }
    if (trimmed) {
      sections[current] ||= [];
      sections[current].push(trimmed);
    }
  });

  return {
    task: (sections.task || []).join(" "),
    context: (sections.context || []).join(" "),
    body: (sections.body || []).join(" ")
  };
}

function normalizeWorkflowPromptTitle(item, index = 0) {
  const sections = parseWorkflowPromptSections(item?.prompt || "");
  const task = String(sections.task || "").replace(/\s+/g, " ").trim();
  if (task) {
    if (/明确|确认|梳理|提炼/.test(task)) return "明确目标、对象与输出";
    if (/补充|说明|提供|给出/.test(task) && /背景|约束|身份|经历|限制|对象/.test(`${task} ${sections.context || ""}`)) {
      return "补充背景、约束与关键信息";
    }
    if (/优化|改写|重写|调整|强化|细化/.test(task)) return "优化结果的结构与表达";
    if (/整理|输出|生成|形成|产出/.test(task)) return "整理并输出最终结果";
    return task;
  }

  const currentTitle = String(item?.title || "").replace(/\s+/g, " ").trim();
  if (
    currentTitle &&
    !/^(现在|可以|行，那|好的|然后|我想|你帮我|帮我|请你|请帮我)/.test(currentTitle)
  ) {
    return currentTitle;
  }

  const context = String(sections.context || sections.body || "").replace(/\s+/g, " ").trim();
  if (/背景|约束|限制|对象|嘉宾/.test(context)) return "补充关键背景与约束";
  if (/优化|调整|改写|重写|深入|细化/.test(context)) return "优化当前结果的结构细节";
  if (/输出|整理|生成|提纲|方案|结果/.test(context)) return "整理并输出最终结果";
  if (/目标|主题|方向|范围/.test(context)) return "明确任务目标与范围";

  return `第 ${index + 1} 步工作流`;
}

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

function renderWorkflowStatus() {
  const wrapper = document.querySelector("[data-workflow-status]");
  const title = document.querySelector("[data-workflow-status-title]");
  const text = document.querySelector("[data-workflow-status-text]");
  if (!(wrapper instanceof HTMLElement) || !title || !text) {
    return;
  }

  const asset = getCurrentDetailAsset();
  if (!asset || selectedDetail?.kind === "conversation" || !Array.isArray(asset.workflowPrompts) || !asset.workflowPrompts.length) {
    wrapper.hidden = true;
    title.textContent = "当前还没有选中工作流步骤";
    text.textContent = "点开任意一步后，这里会显示当前正在编辑的内容。";
    return;
  }

  wrapper.hidden = false;
  if (!selectedWorkflowPrompt || !Number.isInteger(selectedWorkflowPrompt.index)) {
    title.textContent = "当前正在查看整条工作流";
    text.textContent = `这条技能目前共有 ${asset.workflowPrompts.length} 步，默认按从上到下执行。`;
    return;
  }

  const index = selectedWorkflowPrompt.index;
  const prompt = asset.workflowPrompts[index];
  title.textContent = `当前选中：第 ${index + 1} 步`;
  text.textContent = normalizeWorkflowPromptTitle(prompt, index);
}

function renderRunbookPrimary(item) {
  const panel = document.querySelector("[data-runbook-primary-panel]");
  const content = document.querySelector("[data-runbook-primary-content]");
  if (!(panel instanceof HTMLElement) || !content) {
    return;
  }

  if (!item || !item.promptTemplate || selectedDetail?.kind === "conversation") {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  panel.hidden = false;
  content.innerHTML = `
    <article class="list-card workflow-runbook-card">
      <strong>完整运行手册</strong>
      <span>这一段是最终可直接交给 AI 执行的完整技能内容。</span>
      <pre class="runbook-preview">${escapeHtml(item.promptTemplate)}</pre>
    </article>
  `;
}

function setFeedback(message) {
  const node = document.querySelector("[data-feedback]");
  if (node) {
    node.textContent = message;
  }
}

function renderSkillOverview() {}

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
      setFeedback(`已把技能插入当前输入框：${skill.name}`);
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
    container.innerHTML = "<p class='muted empty-state'>这里还没有内容。</p>";
    return;
  }

  container.innerHTML = items.slice(0, 12).map(renderer).join("");
}

function renderSkills(selector, skills, variants) {
  const container = document.querySelector(selector);
  if (!skills.length) {
    container.innerHTML = "<p class='muted empty-state'>还没有可复用技能。</p>";
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
    container.innerHTML = "<p class='muted empty-state'>还没有同场景优化版本。</p>";
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
    ? "直接升级成技能"
    : "生成技能";
  const editButton = linkedDraft
    ? `<button type="button" data-action="edit-conversation-draft" data-id="${item.id}">编辑整理结果</button>`
    : "";
  const badgeText = pending
    ? "正在整理中 / 原始素材"
    : failed
      ? "整理失败 / 原始素材"
      : "原始素材";
  return `
    <article class="list-card clickable-card queue-card queue-card-raw ${pending ? "queue-card-pending" : ""} ${failed ? "queue-card-failed" : ""}" data-detail-kind="conversation" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.selectedText || item.sourceTitle || "原始对话")}</strong>
      <label class="inline-check">
        <input type="checkbox" data-select-conversation="${item.id}" ${selectedConversationIds.has(item.id) ? "checked" : ""} />
        <span>选择</span>
      </label>
      <span class="queue-badge ${pending ? "queue-badge-pending" : ""} ${failed ? "queue-badge-failed" : ""}">${badgeText}</span>
      <span>来源：${escapeHtml(item.sourcePlatform || "other")}</span>
      <div class="meta-block">
        <small>${hasAutoDraft
          ? `整理状态：${escapeHtml(linkedDraft.status === "draft" ? "可继续编辑" : "已生成建议")}`
          : pending
            ? "系统正在整理这条素材。"
            : failed
              ? "这条素材整理失败了，可以手动重新生成。"
              : "这条素材还没有整理建议。"
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
      <span>${escapeHtml(localizeScenario(item.scenario || "可复用工作流"))} · 可直接复用</span>
      <div class="meta-block">
        <small>${escapeHtml(item.useWhen || item.goal || "这条技能已经可以直接复用。").slice(0, 72)}</small>
        <small>已使用 ${item.usageCount || 0} 次 · 优化版本 ${variantsForSkill.length} 个${platforms ? ` · ${escapeHtml(platforms)}` : ""}</small>
      </div>
      <div class="action-row">
        <button type="button" data-action="edit-skill" data-id="${item.id}">编辑</button>
        <button type="button" data-action="apply-skill" data-id="${item.id}">立即应用</button>
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
      <span>基于 ${escapeHtml(baseSkill?.name || item.baseSkillId)} 的优化版本</span>
      <div class="meta-block">
        <small>${escapeHtml(item.changeSummary || "这一版用于继续优化工作流结果。")}</small>
        ${platforms ? `<small>${escapeHtml(platforms)}</small>` : ""}
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
      sourceTitleLabel.textContent = isFlowCapture ? "工作流标题" : "内容标题";
    }
    if (sourceContentLabel) {
      sourceContentLabel.textContent = isFlowCapture ? "工作流内容" : "内容正文";
    }
    if (sourceSaveButton) {
      sourceSaveButton.textContent = isFlowCapture ? "保存工作流原文" : "保存内容";
    }
    if (sourceOptimizeButton) {
      sourceOptimizeButton.textContent = isFlowCapture ? "整理这段工作流" : "一键优化内容";
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
    renderVariantCompare(item, kind);
    renderSourcePreview(item);
    renderWorkflowAlignment();
    renderRunbookPrimary(linkedDraft);
    renderWorkflowStatus();
    if (note) {
      note.hidden = false;
      note.textContent = isFlowCapture
        ? "这是你保存下来的整段工作流原文。系统会优先把它整理成运行手册和工作流。"
        : "原始素材只保留来源、标题和捕获内容。结构化字段只属于技能。";
    }
    updateSupportingPanelVisibility();
    return;
  }
  if (sourceTitleLabel) {
    sourceTitleLabel.textContent = "内容标题";
  }
  if (sourceContentLabel) {
    sourceContentLabel.textContent = "内容正文";
  }
  if (sourceSaveButton) {
    sourceSaveButton.textContent = "保存内容";
  }
  if (sourceOptimizeButton) {
    sourceOptimizeButton.textContent = "一键优化内容";
    sourceOptimizeButton.hidden = false;
  }
  if (sourceContentWrap) {
    sourceContentWrap.classList.remove("flow-source-wrap");
  }
  form.elements.id.value = item.id || "";
  form.elements.kind.value = kind;
  form.elements.name.value = item.name || "";
  form.elements.scenario.value = localizeScenario(item.scenario || item.scenarioOverride || "");
  form.elements.useWhen.value = item.useWhen || "";
  form.elements.notFor.value = item.notFor || "";
  form.elements.goal.value = item.goal || item.changeSummary || "";
  form.elements.outputFormat.value = item.outputFormat || "";
  form.elements.successCriteria.value = (item.successCriteria || []).join("\n");
  renderExtractionPreview(item.extraction);
  renderValidationPreview(kind === "variant" ? null : item.validation);
  renderRunCheckPreview(null);
  renderStepMapPreview(item.stepSources || [], item.steps || []);
  renderVariantCompare(item, kind);
  renderSourcePreview(item);
  renderWorkflowAlignment();
  renderRunbookPrimary(item);
  renderWorkflowStatus();
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
  const workflowEditorPanel = document.querySelector("[data-workflow-editor-panel]");
  const workflowPromptForm = document.querySelector("[data-workflow-prompt-form]");
  const workflowPromptCheck = document.querySelector("[data-workflow-prompt-check]");
  const comparePanel = document.querySelector("[data-compare-panel]");
  const compareContent = document.querySelector("[data-compare-content]");
  const runbookPrimaryPanel = document.querySelector("[data-runbook-primary-panel]");
  const runbookPrimaryContent = document.querySelector("[data-runbook-primary-content]");
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
  if (runbookPrimaryPanel) {
    runbookPrimaryPanel.hidden = true;
  }
  if (runbookPrimaryContent) {
    runbookPrimaryContent.innerHTML = "";
  }
  renderWorkflowAlignment();
  renderRunbookPrimary(null);
  renderWorkflowStatus();
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
      <strong>${escapeHtml(item.optimizedTitle || "优化后的内容")}</strong>
      ${item.inferredScenario ? `<span>${escapeHtml(localizeScenario(item.inferredScenario))}</span>` : ""}
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
  form.elements.title.value = normalizeWorkflowPromptTitle(item, index);
  form.elements.prompt.value = item.prompt || "";
  checkNode.innerHTML = promptCheck
    ? `
      <article class="list-card ${promptCheck.running ? "status-running" : ""}">
        <strong>${escapeHtml(promptCheck.running ? "正在检查这一步工作流..." : promptCheck.ok ? "这一步工作流可以使用" : "这一步工作流还需要继续优化")}</strong>
        <span>${escapeHtml(promptCheck.summary || "")}</span>
        ${(Array.isArray(promptCheck.issues) && promptCheck.issues.length)
          ? `<div class="meta-block"><small>${escapeHtml(promptCheck.issues.join(" | "))}</small></div>`
          : "<p class='muted'>当前没有额外问题。</p>"}
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
        : "<p class='muted'>这里优先编辑工作流本身。改完后，运行手册会自动跟着更新。</p>"}
    `;
  renderWorkflowStatus();
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
        <small>工作流检查结果</small>
      </div>
      ${result.promptChecks.map((item, index) => `
        <article class="list-card">
          <strong>第 ${index + 1} 步 · ${escapeHtml(normalizeWorkflowPromptTitle(item, index))}</strong>
          <span>${escapeHtml(item.ok ? "可用" : "还需要继续优化")}</span>
          <div class="meta-block">
            <small>${escapeHtml(item.summary || "")}</small>
            ${(Array.isArray(item.issues) && item.issues.length)
              ? `<small>${escapeHtml(item.issues.join(" | "))}</small>`
              : "<small>这一步当前没有额外问题。</small>"}
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

  const currentAsset = getCurrentDetailAsset();
  const workflowPrompts = currentAsset?.workflowPrompts || [];
  const normalizedStepSources = Array.isArray(stepSources) && stepSources.length >= workflowPrompts.length
    ? stepSources
    : workflowPrompts.map((prompt, index) => ({
      step: `第 ${index + 1} 步：${normalizeWorkflowPromptTitle(prompt, index)}`,
      sourceTurnIds: prompt?.sourceTurnIds || [],
      sourcePreview: String(prompt?.prompt || "").slice(0, 220)
    }));

  if ((!Array.isArray(normalizedStepSources) || normalizedStepSources.length === 0) && (!Array.isArray(fallbackItems) || fallbackItems.length === 0)) {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  if (!Array.isArray(normalizedStepSources) || normalizedStepSources.length === 0) {
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
    renderWorkflowAlignment();
    renderWorkflowStatus();
    return;
  }

  panel.hidden = false;
  content.innerHTML = normalizedStepSources.map((item, index) => `
    <article class="list-card workflow-step-card ${selectedWorkflowPrompt?.index === index ? "linked-focus-card" : ""}" data-step-index="${index}">
      <strong>第 ${index + 1} 步</strong>
      <span>${escapeHtml(item.step || "")}</span>
      <div class="action-row">
        ${item.sourceTurnIds?.length ? item.sourceTurnIds.map((turnId) => `<button type="button" data-action="jump-to-turn" data-turn-id="${escapeHtml(turnId)}">定位到 ${escapeHtml(turnId)}</button>`).join("") : ""}
      </div>
      ${item.sourcePreview ? `<div class="meta-block"><small>来源摘要</small><small>${escapeHtml(item.sourcePreview)}</small></div>` : ""}
    </article>
  `).join("");
  renderWorkflowAlignment();
  renderWorkflowStatus();
}

function focusWorkflowIndex(index) {
  if (!Number.isInteger(index) || index < 0) {
    return;
  }

  selectedWorkflowPrompt = { index };
  const asset = getCurrentDetailAsset();
  if (asset && selectedDetail && selectedDetail.kind !== "conversation") {
    renderStepMapPreview(asset.stepSources || [], asset.steps || []);
    renderWorkflowAlignment();
    renderWorkflowStatus();
  }

  requestAnimationFrame(() => {
    const promptNode = document.querySelector(`[data-workflow-index="${CSS.escape(String(index))}"]`);
    const stepNode = document.querySelector(`[data-step-index="${CSS.escape(String(index))}"]`);
    promptNode?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    stepNode?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function renderWorkflowAlignment() {
  const panel = document.querySelector("[data-workflow-alignment-panel]");
  const content = document.querySelector("[data-workflow-alignment-content]");
  if (!(panel instanceof HTMLElement) || !content) {
    return;
  }

  const asset = getCurrentDetailAsset();
  if (!asset || selectedDetail?.kind === "conversation" || !Array.isArray(asset.workflowPrompts) || !asset.workflowPrompts.length) {
    panel.hidden = true;
    content.innerHTML = "";
    return;
  }

  const prompts = asset.workflowPrompts || [];
  panel.hidden = false;
  content.innerHTML = prompts.map((prompt, index) => `
    <article class="list-card workflow-alignment-row ${selectedWorkflowPrompt?.index === index ? "linked-focus-card" : ""}">
      <div class="workflow-alignment-col workflow-alignment-col-single">
        <strong>第 ${index + 1} 步</strong>
        <span>${escapeHtml(normalizeWorkflowPromptTitle(prompt, index))}</span>
        <div class="meta-block">
          <small>${escapeHtml(prompt.prompt || "")}</small>
        </div>
        <div class="action-row">
          <button type="button" data-action="edit-workflow-prompt" data-index="${index}">编辑</button>
          ${prompt.sourceTurnIds?.length ? prompt.sourceTurnIds.map((turnId) => `<button type="button" data-action="jump-to-turn" data-turn-id="${escapeHtml(turnId)}">定位到 ${escapeHtml(turnId)}</button>`).join("") : ""}
        </div>
      </div>
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
      <small>平台：${escapeHtml(item.sourcePlatform || "other")}</small>
      <small>方式：${escapeHtml(item.captureMode || "selection")}</small>
      <small>链接：${escapeHtml(item.sourceUrl || "")}</small>
      <small>对话轮次：${escapeHtml(String(item.turns?.length || 0))}</small>
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
    content.innerHTML = "<p class='muted'>当前使用：本地规则抽取</p>";
    return;
  }

  panel.hidden = false;
  content.innerHTML = `
    <div class="meta-block">
      <small>模式：${escapeHtml(extraction.mode || "unknown")}</small>
      <small>服务商：${escapeHtml(extraction.provider || "local")}</small>
      <small>模型：${escapeHtml(extraction.model || "heuristic")}</small>
      <small>抽取时间：${escapeHtml(extraction.extractedAt || "")}</small>
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
    content.innerHTML = "<p class='muted'>系统会在生成技能、保存编辑、升级为可复用技能时自动做检查。</p>";
    return;
  }

  const modeMap = {
    local: "本地规则",
    api: "模型复核"
  };
  const statusMap = {
    strong: "通过",
    needs_review: "需要复查",
    weak: "偏弱",
    pending_setup: "待配置"
  };
  const translateIssue = (issue) => {
    const map = {
      "API validation mode is configured but not fully enabled yet.": "你已经打开模型复核，但当前 API 配置还没有完整生效。",
      "Local heuristic validation is still recommended as the fallback.": "在模型复核可用之前，当前会继续使用本地规则作为兜底。",
      "Name is too short.": "名称太短，不足以表达这条技能的作用。",
      "Use When is missing or too vague.": "适用场景缺失，或写得太模糊。",
      "Run prompt is short. Review whether the steps are detailed enough.": "运行手册偏短，建议检查步骤是否足够完整。",
      "Skill should have at least 2 clear steps.": "这条技能至少应有 2 个清晰步骤。",
      "Output format is missing.": "输出格式缺失。",
      "Success criteria should contain at least 2 checks.": "成功标准至少要有 2 条。",
      "No source conversation is linked.": "没有关联原始来源对话。",
      "No inputs were extracted. Review manually.": "还没有识别出输入变量，建议手动检查。"
    };
    return map[issue] || issue;
  };

  panel.hidden = false;
  const issues = validation.issues?.length
    ? validation.issues.map((issue) => `<li>${escapeHtml(translateIssue(issue))}</li>`).join("")
    : "<li>当前没有明显问题。</li>";

  content.innerHTML = `
    <div class="validation-card status-${escapeHtml(validation.status || "unknown")}">
      <div class="validation-topline">
        <div class="status-pill status-${escapeHtml(validation.status || "unknown")}">
          ${escapeHtml(modeMap[validation.mode] || validation.mode || "本地规则")} · ${escapeHtml(statusMap[validation.status] || validation.status || "未知状态")}
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
      <strong>${escapeHtml(baseSkill.name || "基础技能")}</strong>
      <span>${escapeHtml(localizeScenario(baseSkill.scenario || "暂未填写场景"))}</span>
      <div class="meta-block">
        <small>基础版本运行手册摘要</small>
        <small>${escapeHtml((baseSkill.promptTemplate || "").slice(0, 180) || "暂时还没有运行手册")}</small>
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
      <span>平台：${escapeHtml(source.sourcePlatform || "other")}</span>
      <span>方式：${escapeHtml(source.captureMode || "unknown")}</span>
      ${source.selectedText ? `<div class="meta-block"><small>选中文本</small><small>${escapeHtml(source.selectedText.slice(0, 180))}</small></div>` : ""}
      <details class="raw-json-wrap">
        <summary>查看完整来源时间线</summary>
        <div class="meta-block"><small>来源链接</small><small>${escapeHtml(source.sourceUrl || "")}</small></div>
        ${turnsPreview ? `<div class="source-turns"><small>对话时间线</small>${turnsPreview}</div>` : ""}
      </details>
      <div class="action-row">
        <button type="button" data-action="re-save-source-prompt" data-source-id="${source.id}">另存为单条内容</button>
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
      setFeedback("请先选择至少一条内容。");
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
      setFeedback("已把选中的内容合并成一条技能草稿。");
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
      setFeedback("没有找到这一步工作流。");
      return;
    }
    focusWorkflowIndex(index);
    renderWorkflowPromptEditor(prompt, index);
    setFeedback("已打开这一步工作流，准备编辑。");
    return;
  }

  if (action === "focus-workflow-step") {
    const index = Number(target.dataset.index);
    focusWorkflowIndex(index);
    setFeedback(`已定位到第 ${index + 1} 步。`);
    return;
  }

  if (action === "focus-workflow-prompt") {
    const index = Number(target.dataset.index);
    focusWorkflowIndex(index);
    setFeedback(`已定位到第 ${index + 1} 步工作流。`);
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
      setFeedback("请先选择一步工作流。");
      return;
    }
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这一步工作流。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index, {
      ok: false,
      running: true,
      summary: "系统正在调用模型检查这一步工作流，请稍等。",
      issues: []
    });
    setFeedback(`正在检查第 ${index + 1} 步工作流...`);
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.RUN_WORKFLOW_PROMPT_CHECK,
      payload: { id: selectedDetail.id, index }
    });
    const latestAsset = getCurrentDetailAsset();
    const latestPrompt = latestAsset?.workflowPrompts?.[index] || prompt;
    renderWorkflowPromptEditor(latestPrompt, index, response?.result || null);
    setFeedback(`第 ${index + 1} 步工作流检查已完成。`);
    return;
  }

  if (action === "optimize-workflow-prompt") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    const index = Number(selectedWorkflowPrompt?.index);
    if (!Number.isInteger(index) || index < 0) {
      setFeedback("请先选择一步工作流。");
      return;
    }
    const asset = getCurrentDetailAsset();
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这一步工作流。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index, {
      ok: false,
      running: true,
      summary: "系统正在优化这一步工作流，请稍等。",
      issues: []
    });
      setFeedback(`正在优化第 ${index + 1} 步工作流...`);
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
      focusWorkflowIndex(index);
      renderWorkflowPromptEditor(nextPrompt, index, {
        ok: true,
        summary: "这一步工作流已优化完成。",
        issues: []
      });
    }
      setFeedback(`第 ${index + 1} 步工作流已优化完成。`);
    return;
  }

  if (action === "optimize-workflow-prompt-inline") {
    if (!selectedDetail || selectedDetail.kind === "conversation") {
      setFeedback("请先选中一条草稿、技能或优化版本。");
      return;
    }
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index) || index < 0) {
      setFeedback("没有找到这一步工作流。");
      return;
    }
    const asset = getCurrentDetailAsset();
    const prompt = asset?.workflowPrompts?.[index];
    if (!prompt) {
      setFeedback("没有找到这一步工作流。");
      return;
    }
    renderWorkflowPromptEditor(prompt, index, {
      ok: false,
      running: true,
      summary: "系统正在优化这一步工作流，请稍等。",
      issues: []
    });
    setFeedback(`正在优化第 ${index + 1} 步工作流...`);
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
      focusWorkflowIndex(index);
      renderWorkflowPromptEditor(nextPrompt, index, response?.result ? {
        ok: true,
        summary: "这一步工作流已优化完成。",
        issues: []
      } : null);
    }
    setFeedback(`第 ${index + 1} 步工作流已优化完成。`);
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
        useWhen: item.useWhen || "",
        notFor: item.notFor || "",
        goal: item.changeSummary || "",
        outputFormat: item.outputFormat || "",
        successCriteria: item.successCriteria || [],
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
      setFeedback("已把来源内容另存为单条内容。");
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
      setFeedback("这条内容已优化完成。");
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
        useWhen: item.useWhen || "",
        notFor: item.notFor || "",
        goal: item.changeSummary || "",
        outputFormat: item.outputFormat || "",
        successCriteria: item.successCriteria || [],
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
  const currentAsset = getCurrentDetailAsset();
  const payload = {
    id: String(formData.get("id") || ""),
    name: String(formData.get("name") || ""),
    scenario: canonicalizeScenario(String(formData.get("scenario") || "")),
    useWhen: String(formData.get("useWhen") || ""),
    notFor: String(formData.get("notFor") || ""),
    goal: String(formData.get("goal") || ""),
    promptTemplate: currentAsset?.promptTemplate || "",
    outputFormat: String(formData.get("outputFormat") || ""),
    successCriteria: String(formData.get("successCriteria") || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
    steps: currentAsset?.steps || []
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
  setFeedback("内容已保存。");
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
  setFeedback("工作流已保存。");
});

load();
