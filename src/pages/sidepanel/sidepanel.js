import { MESSAGE_TYPES } from "../../lib/constants.js";

let latestState = null;
let selectedDetail = null;

async function load() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  const state = response.result;
  latestState = state;

  const activeConversations = state.conversations.filter((item) => !item.archivedAt);
  const previewDrafts = state.drafts.filter((item) => item.status === "preview");
  const activeDrafts = state.drafts.filter((item) => item.status === "draft");
  const activeSkills = state.skills.filter((item) => item.status !== "archived");
  const archivedItems = [
    ...state.conversations.filter((item) => item.archivedAt).map((item) => ({ ...item, archiveKind: "conversation" })),
    ...state.drafts.filter((item) => item.status === "archived").map((item) => ({ ...item, archiveKind: "draft" })),
    ...state.skills.filter((item) => item.status === "archived").map((item) => ({ ...item, archiveKind: "skill" }))
  ];

  renderList("[data-inbox]", activeConversations, renderConversation);
  renderList("[data-previews]", previewDrafts, renderPreviewDraft);
  renderList("[data-drafts]", activeDrafts, renderDraft);
  renderSkills("[data-skills]", activeSkills, state.variants);
  renderVariants("[data-variants]", state.variants, state.skills);
  renderList("[data-archived]", archivedItems, renderArchivedItem);
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
    setFeedback("No active tab found.");
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.ENSURE_CONTENT_SCRIPT,
      payload: { tabId: tab.id }
    });
    await chrome.tabs.sendMessage(tab.id, message);
    setFeedback("Action sent to active tab.");
  } catch (error) {
    setFeedback("Could not reach the active page. This tab may not allow injection yet.");
  }
}

function renderList(selector, items, renderer) {
  const container = document.querySelector(selector);
  if (!items.length) {
    container.innerHTML = "<p class='muted'>Nothing here yet.</p>";
    return;
  }

  container.innerHTML = items.slice(0, 12).map(renderer).join("");
}

function renderSkills(selector, skills, variants) {
  const container = document.querySelector(selector);
  if (!skills.length) {
    container.innerHTML = "<p class='muted'>No validated skills yet.</p>";
    return;
  }

  container.innerHTML = skills
    .map((skill) => {
      const variantsForSkill = variants.filter((variant) => variant.baseSkillId === skill.id || variant.baseSkillId === skill.baseSkillId);
      return renderSkill(skill, variantsForSkill);
    })
    .join("");
}

function renderVariants(selector, variants, skills) {
  const container = document.querySelector(selector);
  if (!variants.length) {
    container.innerHTML = "<p class='muted'>No variants yet.</p>";
    return;
  }

  container.innerHTML = variants
    .map((variant) => renderVariant(
      variant,
      skills.find((skill) => skill.id === variant.baseSkillId || skill.baseSkillId === variant.baseSkillId)
    ))
    .join("");
}

function renderConversation(item) {
  const hasAutoPreview = latestState?.drafts?.some((draft) => (
    (draft.status === "preview" || draft.status === "draft")
      && (draft.sourceConversationIds || []).includes(item.id)
  ));
  return `
    <article class="list-card">
      <strong>${escapeHtml(item.selectedText || item.sourceTitle || "Captured conversation")}</strong>
      <span>Source / 来源: ${escapeHtml(item.sourcePlatform || "other")} · Mode / 方式: ${escapeHtml(item.captureMode)}</span>
      <div class="meta-block">
        <small>${hasAutoPreview ? "A preview already exists for this source. / 这条素材已经生成过预览。" : "Next step / 下一步: compile this source into a preview."}</small>
      </div>
      <div class="action-row">
        <button type="button" data-action="compile-conversation" data-id="${item.id}">Compile to Preview / 编译为预览</button>
        <button type="button" data-action="archive-conversation" data-id="${item.id}">Archive</button>
        <button type="button" data-action="delete-conversation" data-id="${item.id}">Delete / 删除</button>
      </div>
    </article>
  `;
}

function renderDraft(item) {
  return `
    <article class="list-card clickable-card" data-detail-kind="draft" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>Draft / 草稿 · ${escapeHtml(item.scenario || "Draft skill")}</span>
      <div class="action-row">
        <button type="button" data-action="promote-draft" data-id="${item.id}">Promote to Skill</button>
        <button type="button" data-action="archive-draft" data-id="${item.id}">Archive</button>
        <button type="button" data-action="delete-draft" data-id="${item.id}">Delete / 删除</button>
      </div>
    </article>
  `;
}

function renderPreviewDraft(item) {
  return `
    <article class="list-card clickable-card" data-detail-kind="draft" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>Preview / 编译预览 · ${escapeHtml(item.scenario || "Skill preview")}</span>
      <div class="meta-block">
        <small>Review this result before saving it as a draft.</small>
      </div>
      <div class="action-row">
        <button type="button" data-action="approve-preview" data-id="${item.id}">Save as Draft / 保存为草稿</button>
        <button type="button" data-action="archive-draft" data-id="${item.id}">Dismiss / 归档</button>
        <button type="button" data-action="delete-draft" data-id="${item.id}">Delete / 删除</button>
      </div>
    </article>
  `;
}

function renderSkill(item, variantsForSkill = []) {
  return `
    <article class="list-card clickable-card" data-detail-kind="skill" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>Skill / 正式技能 · ${escapeHtml(item.scenario || "Reusable workflow")} · Used ${item.usageCount || 0} times</span>
      <div class="meta-block">
        <small>Variants / 变体数: ${variantsForSkill.length}</small>
        ${variantsForSkill.length ? variantsForSkill.map((variant) => `<small>${escapeHtml(variant.name)}</small>`).join("") : "<small>No variants yet.</small>"}
      </div>
      <div class="action-row">
        <button type="button" data-action="create-variant" data-id="${item.id}">New Variant</button>
        <button type="button" data-action="archive-skill" data-id="${item.id}">Archive</button>
        <button type="button" data-action="delete-skill" data-id="${item.id}">Delete / 删除</button>
      </div>
    </article>
  `;
}

function renderVariant(item, baseSkill) {
  return `
    <article class="list-card clickable-card" data-detail-kind="variant" data-detail-id="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>Variant / 技能变体 · For Skill / 所属技能: ${escapeHtml(baseSkill?.name || item.baseSkillId)}</span>
      <div class="meta-block">
        <small>${escapeHtml(item.changeSummary || "Variant")}</small>
      </div>
      <div class="action-row">
        <button type="button" data-action="delete-variant" data-id="${item.id}">Delete / 删除</button>
      </div>
    </article>
  `;
}

function renderArchivedItem(item) {
  const kindMap = {
    conversation: "Raw capture / 原始素材",
    draft: "Draft / 技能草稿",
    skill: "Skill / 正式技能"
  };

  const restoreAction = item.archiveKind === "conversation"
    ? "restore-conversation"
    : item.archiveKind === "draft"
      ? "restore-draft"
      : "restore-skill";
  const restoreId = item.id;

  return `
    <article class="list-card">
      <strong>${escapeHtml(item.name || item.selectedText || item.sourceTitle || "Archived item")}</strong>
      <span>Archived / 已归档 · ${escapeHtml(kindMap[item.archiveKind] || item.archiveKind || "item")}</span>
      <div class="action-row">
        <button type="button" data-action="${restoreAction}" data-id="${restoreId}">Restore / 恢复</button>
        <button type="button" data-action="delete-${item.archiveKind}" data-id="${restoreId}">Delete / 删除</button>
      </div>
    </article>
  `;
}

function showDetailPanel(item, kind) {
  const form = document.querySelector("[data-detail-form]");
  const empty = document.querySelector("[data-detail-empty]");
  const title = document.querySelector("[data-detail-title]");
  if (!form || !empty) {
    return;
  }

  selectedDetail = { id: item.id, kind };
  updateSelectedCards();
  if (title) {
    const kindLabel = kind === "draft" ? "Draft / 草稿" : kind === "skill" ? "Skill / 正式技能" : "Variant / 变体";
    title.textContent = `Selected / 当前选中: ${kindLabel} - ${item.name || item.id}`;
  }

  if (kind === "variant") {
    empty.hidden = false;
    empty.textContent = "Variant details are visible as summary only for now. You can compare it in the list or delete it.";
    form.hidden = true;
    renderExtractionPreview(null);
    renderValidationPreview(null);
    renderSourcePreview({ sourceConversationIds: [] });
    return;
  }

  empty.hidden = true;
  form.hidden = false;
  form.elements.id.value = item.id || "";
  form.elements.kind.value = kind;
  form.elements.name.value = item.name || "";
  form.elements.scenario.value = item.scenario || "";
  form.elements.useWhen.value = item.useWhen || "";
  form.elements.notFor.value = item.notFor || "";
  form.elements.goal.value = item.goal || "";
  form.elements.promptTemplate.value = item.promptTemplate || "";
  form.elements.steps.value = (item.steps || []).join("\n");
  form.elements.outputFormat.value = item.outputFormat || "";
  form.elements.successCriteria.value = (item.successCriteria || []).join("\n");
  renderExtractionPreview(item.extraction);
  renderValidationPreview(item.validation);
  renderSourcePreview(item);
}

function hideDetailPanel() {
  const form = document.querySelector("[data-detail-form]");
  const empty = document.querySelector("[data-detail-empty]");
  const sourcePanel = document.querySelector("[data-source-panel]");
  const sourceContent = document.querySelector("[data-source-content]");
  const extractionPanel = document.querySelector("[data-extraction-panel]");
  const extractionContent = document.querySelector("[data-extraction-content]");
  const validationPanel = document.querySelector("[data-validation-panel]");
  const validationContent = document.querySelector("[data-validation-content]");
  const title = document.querySelector("[data-detail-title]");
  if (!form || !empty) {
    return;
  }

  selectedDetail = null;
  updateSelectedCards();
  form.hidden = true;
  form.reset();
  empty.hidden = false;
  if (title) {
    title.textContent = "Nothing selected / 当前未选中任何条目";
  }
  if (sourcePanel) {
    sourcePanel.hidden = true;
  }
  if (sourceContent) {
    sourceContent.innerHTML = "";
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
    content.innerHTML = "<p class='muted'>No validation result yet.</p>";
    return;
  }

  panel.hidden = false;
  const issues = validation.issues?.length
    ? validation.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")
    : "<li>No major issues found.</li>";

  content.innerHTML = `
    <div class="validation-card status-${escapeHtml(validation.status || "unknown")}">
      <div class="validation-topline">
        <div class="status-pill status-${escapeHtml(validation.status || "unknown")}">
          ${escapeHtml(validation.mode || "local")} · ${escapeHtml(validation.status || "unknown")}
        </div>
        ${validation.score != null ? `<strong class="validation-score">${escapeHtml(String(validation.score))}</strong>` : ""}
      </div>
      <p class="muted">${validation.checkedAt ? `Checked at / 检查时间: ${escapeHtml(validation.checkedAt)}` : "No timestamp yet."}</p>
      <ul class="detail-list">${issues}</ul>
    </div>
  `;
}

function renderSourcePreview(item) {
  const sourcePanel = document.querySelector("[data-source-panel]");
  const sourceContent = document.querySelector("[data-source-content]");
  if (!sourcePanel || !sourceContent || !latestState) {
    return;
  }

  const sourceIds = item.sourceConversationIds || [];
  const sources = latestState.conversations.filter((conversation) => sourceIds.includes(conversation.id));

  if (!sources.length) {
    sourcePanel.hidden = false;
    sourceContent.innerHTML = "<p class='muted'>No linked source conversation yet.</p>";
    return;
  }

  sourcePanel.hidden = false;
  sourceContent.innerHTML = sources.map(renderSourceCard).join("");
}

function renderSourceCard(source) {
  const turnsPreview = (source.turns || [])
    .slice(0, 4)
    .map((turn) => `
      <div class="source-turn">
        <strong>${escapeHtml(turn.role || "unknown")}</strong>
        <span>${escapeHtml(turn.text || "")}</span>
      </div>
    `)
    .join("");

  return `
    <article class="list-card source-card">
      <strong>${escapeHtml(source.sourceTitle || source.selectedText || "Source conversation")}</strong>
      <span>Platform / 平台: ${escapeHtml(source.sourcePlatform || "other")}</span>
      <span>Mode / 方式: ${escapeHtml(source.captureMode || "unknown")}</span>
      <span>URL: ${escapeHtml(source.sourceUrl || "")}</span>
      ${source.selectedText ? `<div class="meta-block"><small>Selected text / 选中文本</small><small>${escapeHtml(source.selectedText)}</small></div>` : ""}
      ${turnsPreview ? `<div class="source-turns"><small>Conversation preview / 对话预览</small>${turnsPreview}</div>` : ""}
      <div class="action-row">
        <button type="button" data-action="re-save-source-prompt" data-source-id="${source.id}">Save Source as Prompt / 另存为 Prompt</button>
        <button type="button" data-action="recompile-source-skill" data-source-id="${source.id}">Recompile to Draft / 重新编译为草稿</button>
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
    setFeedback("Preview saved as draft.");
    return;
  }

  if (action === "create-variant" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CREATE_VARIANT, payload: { skillId: id } });
    return;
  }

  if (action === "archive-conversation" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ARCHIVE_CONVERSATION, payload: { conversationId: id } });
    return;
  }

  if (action === "delete-conversation" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_CONVERSATION, payload: { conversationId: id } });
    setFeedback("Conversation deleted.");
    hideDetailPanel();
    return;
  }

  if (action === "compile-conversation" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COMPILE_CONVERSATION, payload: { conversationId: id } });
    setFeedback("Inbox item compiled into preview.");
    return;
  }

  if (action === "archive-draft" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ARCHIVE_DRAFT, payload: { draftId: id } });
    return;
  }

  if (action === "delete-draft" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_DRAFT, payload: { draftId: id } });
    setFeedback("Draft deleted.");
    hideDetailPanel();
    return;
  }

  if (action === "archive-skill" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ARCHIVE_SKILL, payload: { skillId: id } });
    return;
  }

  if (action === "delete-skill" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_SKILL, payload: { skillId: id } });
    setFeedback("Skill deleted.");
    hideDetailPanel();
    return;
  }

  if (action === "delete-variant" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.DELETE_VARIANT, payload: { variantId: id } });
    setFeedback("Variant deleted.");
    hideDetailPanel();
    return;
  }

  if (action === "restore-conversation" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESTORE_CONVERSATION, payload: { conversationId: id } });
    setFeedback("Conversation restored to Inbox.");
    return;
  }

  if (action === "restore-draft" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESTORE_DRAFT, payload: { draftId: id } });
    setFeedback("Draft restored.");
    return;
  }

  if (action === "restore-skill" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESTORE_SKILL, payload: { skillId: id } });
    setFeedback("Skill restored.");
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
    setFeedback("Control Center opened.");
    return;
  }

  if (action === "refresh-workspace") {
    await load();
    setFeedback("Workspace refreshed.");
    return;
  }

  if (action === "clear-detail") {
    hideDetailPanel();
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
      setFeedback("Source saved to Inbox as prompt.");
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
      setFeedback("Source recompiled into a draft.");
    }
    return;
  }

  if (target.closest("button")) {
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
    setFeedback("Draft updated.");
  }

  if (kind === "skill") {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.UPDATE_SKILL, payload });
    setFeedback("Skill updated.");
  }

  if (kind === "variant") {
    setFeedback("Variant editing is read-only for now. You can delete it or recreate it from a skill.");
  }
});

load();
