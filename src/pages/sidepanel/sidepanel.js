import { MESSAGE_TYPES } from "../../lib/constants.js";

let latestState = null;

async function load() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  const state = response.result;
  latestState = state;

  const activeConversations = state.conversations.filter((item) => !item.archivedAt);
  const activeDrafts = state.drafts.filter((item) => item.status !== "archived");
  const activeSkills = state.skills.filter((item) => item.status !== "archived");
  const archivedItems = [
    ...state.conversations.filter((item) => item.archivedAt).map((item) => ({ ...item, archiveKind: "conversation" })),
    ...state.drafts.filter((item) => item.status === "archived").map((item) => ({ ...item, archiveKind: "draft" })),
    ...state.skills.filter((item) => item.status === "archived").map((item) => ({ ...item, archiveKind: "skill" }))
  ];

  renderList("[data-inbox]", activeConversations, renderConversation);
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
  return `
    <article class="list-card">
      <strong>${escapeHtml(item.selectedText || item.sourceTitle || "Captured conversation")}</strong>
      <span>Source / 来源: ${escapeHtml(item.sourcePlatform || "other")} · Mode / 方式: ${escapeHtml(item.captureMode)}</span>
      <div class="action-row">
        <button type="button" data-action="archive-conversation" data-id="${item.id}">Archive</button>
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
      </div>
    </article>
  `;
}

function renderVariant(item, baseSkill) {
  return `
    <article class="list-card">
      <strong>${escapeHtml(item.name)}</strong>
      <span>Variant / 技能变体 · For Skill / 所属技能: ${escapeHtml(baseSkill?.name || item.baseSkillId)}</span>
      <div class="meta-block">
        <small>${escapeHtml(item.changeSummary || "Variant")}</small>
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

  return `
    <article class="list-card">
      <strong>${escapeHtml(item.name || item.selectedText || item.sourceTitle || "Archived item")}</strong>
      <span>Archived / 已归档 · ${escapeHtml(kindMap[item.archiveKind] || item.archiveKind || "item")}</span>
    </article>
  `;
}

function showDetailPanel(item, kind) {
  const form = document.querySelector("[data-detail-form]");
  const empty = document.querySelector("[data-detail-empty]");
  if (!form || !empty) {
    return;
  }

  empty.hidden = true;
  form.hidden = false;
  form.elements.id.value = item.id || "";
  form.elements.kind.value = kind;
  form.elements.name.value = item.name || "";
  form.elements.scenario.value = item.scenario || "";
  form.elements.goal.value = item.goal || "";
  form.elements.promptTemplate.value = item.promptTemplate || "";
  form.elements.steps.value = (item.steps || []).join("\n");
  renderSourcePreview(item);
}

function hideDetailPanel() {
  const form = document.querySelector("[data-detail-form]");
  const empty = document.querySelector("[data-detail-empty]");
  const sourcePanel = document.querySelector("[data-source-panel]");
  const sourceContent = document.querySelector("[data-source-content]");
  if (!form || !empty) {
    return;
  }

  form.hidden = true;
  form.reset();
  empty.hidden = false;
  if (sourcePanel) {
    sourcePanel.hidden = true;
  }
  if (sourceContent) {
    sourceContent.innerHTML = "";
  }
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

  if (action === "create-variant" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CREATE_VARIANT, payload: { skillId: id } });
    return;
  }

  if (action === "archive-conversation" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ARCHIVE_CONVERSATION, payload: { conversationId: id } });
    return;
  }

  if (action === "archive-draft" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ARCHIVE_DRAFT, payload: { draftId: id } });
    return;
  }

  if (action === "archive-skill" && id) {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ARCHIVE_SKILL, payload: { skillId: id } });
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
});

document.querySelector("[data-detail-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    id: String(formData.get("id") || ""),
    name: String(formData.get("name") || ""),
    scenario: String(formData.get("scenario") || ""),
    goal: String(formData.get("goal") || ""),
    promptTemplate: String(formData.get("promptTemplate") || ""),
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
});

load();
