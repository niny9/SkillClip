import { MESSAGE_TYPES } from "../../lib/constants.js";

let latestState = null;
let selectedAssetSnapshot = null;

const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "chat.deepseek.com",
  "perplexity.ai",
  "www.perplexity.ai",
  "kimi.moonshot.cn",
  "www.kimi.com",
  "kimi.com"
];

async function load() {
  const [stateResponse, settingsResponse] = await Promise.all([
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS })
  ]);
  const state = stateResponse.result;
  latestState = state;
  const settings = settingsResponse.result;

  updateCount("conversations", state.conversations.filter((item) => !item.archivedAt).length);
  updateCount("supported_tabs", await countSupportedTabs());
  updateCount("in_progress", state.drafts.filter((item) => item.status === "preview" || item.status === "draft").length);
  updateCount("skills", state.skills.filter((item) => item.status !== "archived").length);
  updateCount("variants", state.variants.length);
  updateCount(
    "archived",
    state.conversations.filter((item) => item.archivedAt).length
      + state.drafts.filter((item) => item.status === "archived").length
      + state.skills.filter((item) => item.status === "archived").length
  );
  renderJson(state);
  renderAssetBrowser(state);
  populateSettings(settings || {});
  await renderActiveTabStatus();
}

function updateCount(key, value) {
  const node = document.querySelector(`[data-count='${key}']`);
  if (node) {
    node.textContent = String(value);
  }
}

function renderJson(state) {
  const node = document.querySelector("[data-json-output]");
  node.value = JSON.stringify(state, null, 2);
  selectedAssetSnapshot = null;
  setAssetFeedback("Showing full snapshot / 当前显示全部快照。点击下方资产卡片可查看单条数据。");
}

function renderAssetBrowser(state) {
  const node = document.querySelector("[data-asset-browser]");
  if (!node) {
    return;
  }

  const inboxItems = state.conversations.filter((item) => !item.archivedAt);
  const previewItems = state.drafts.filter((item) => item.status === "preview").map((item) => ({ ...item, uiStage: "preview" }));
  const draftItems = state.drafts.filter((item) => item.status === "draft").map((item) => ({ ...item, uiStage: "draft" }));
  const inProgressItems = [...previewItems, ...draftItems];
  const skillItems = state.skills.filter((item) => item.status !== "archived");
  const variantItems = state.variants || [];
  const archivedItems = [
    ...state.conversations.filter((item) => item.archivedAt).map((item) => ({ ...item, kind: "conversation" })),
    ...state.drafts.filter((item) => item.status === "archived").map((item) => ({ ...item, kind: "draft" })),
    ...state.skills.filter((item) => item.status === "archived").map((item) => ({ ...item, kind: "skill" }))
  ];

  node.innerHTML = [
    renderBrowserList("Inbox / 待整理素材", "inbox", inboxItems, (item) => {
      const title = item.sourceTitle || item.selectedText || item.sourcePlatform || "Untitled capture";
      const subtitle = `${item.sourcePlatform || "unknown"} · ${item.captureMode || "capture"}`;
      const preview = item.selectedText || item.turns?.[0]?.text || "";
      return `
        <article class="browser-item clickable-card" data-asset-kind="conversation" data-asset-id="${item.id}">
          <strong>${escapeHtml(title)}</strong>
          <p class="muted">${escapeHtml(subtitle)}</p>
          <p>${escapeHtml(preview.slice(0, 180) || "No preview text yet.")}</p>
          <div class="action-row">
            <button type="button" data-action="archive-asset" data-kind="conversation" data-id="${item.id}">Archive / 归档</button>
            <button type="button" data-action="delete-asset" data-kind="conversation" data-id="${item.id}">Delete / 删除</button>
          </div>
        </article>
      `;
    }),
    renderBrowserList("Pending Skills / 待确认技能", "pending", inProgressItems, (item) => `
      <article class="browser-item clickable-card" data-asset-kind="draft" data-asset-id="${item.id}">
        <strong>${escapeHtml(item.name || "Untitled skill in progress")}</strong>
        <p class="muted">${escapeHtml(item.uiStage === "preview" ? "Preview / 系统刚生成，待你确认" : "Draft / 你已确认，可继续编辑")}</p>
        <p class="muted">${escapeHtml(item.useWhen || item.scenario || "No use-when summary yet.")}</p>
        <p>${escapeHtml((item.outputFormat || item.goal || "").slice(0, 180) || "No output format summary yet.")}</p>
        <div class="action-row">
          <button type="button" data-action="archive-asset" data-kind="draft" data-id="${item.id}">Archive / 归档</button>
          <button type="button" data-action="delete-asset" data-kind="draft" data-id="${item.id}">Delete / 删除</button>
        </div>
      </article>
    `),
    renderBrowserList("Ready Skills / 可复用技能", "ready", skillItems, (item) => {
      const variantCount = variantItems.filter((variant) => variant.baseSkillId === item.id).length;
      return `
        <article class="browser-item clickable-card" data-asset-kind="skill" data-asset-id="${item.id}">
          <strong>${escapeHtml(item.name || "Untitled skill")}</strong>
          <p class="muted">${escapeHtml(item.useWhen || item.scenario || "No use-when summary yet.")}</p>
          <p>${escapeHtml((item.successCriteria || item.outputFormat || "").slice(0, 180) || "No success criteria yet.")}</p>
          <p class="muted">Variants / 变体: ${variantCount}</p>
          <div class="action-row">
            <button type="button" data-action="archive-asset" data-kind="skill" data-id="${item.id}">Archive / 归档</button>
            <button type="button" data-action="delete-asset" data-kind="skill" data-id="${item.id}">Delete / 删除</button>
          </div>
        </article>
      `;
    }),
    renderBrowserList("Variants / 同场景优化版本", "variant", variantItems, (item) => `
      <article class="browser-item clickable-card" data-asset-kind="variant" data-asset-id="${item.id}">
        <strong>${escapeHtml(item.name || "Untitled variant")}</strong>
        <p class="muted">${escapeHtml(item.baseSkillId ? `Base / 基础技能: ${item.baseSkillId}` : "No base skill linked.")}</p>
        <p>${escapeHtml((item.goal || item.promptTemplate || "").slice(0, 180) || "No variant summary yet.")}</p>
        <div class="action-row">
          <button type="button" data-action="delete-asset" data-kind="variant" data-id="${item.id}">Delete / 删除</button>
        </div>
      </article>
    `),
    renderBrowserList("Archived / 已归档", "archived", archivedItems, (item) => `
      <article class="browser-item clickable-card" data-asset-kind="${escapeHtml(item.kind || "conversation")}" data-asset-id="${item.id}">
        <strong>${escapeHtml(item.name || item.title || "Archived item")}</strong>
        <p class="muted">${escapeHtml(item.kind || "asset")}</p>
        <div class="action-row">
          <button type="button" data-action="restore-asset" data-kind="${escapeHtml(item.kind || "conversation")}" data-id="${item.id}">Restore / 恢复</button>
          <button type="button" data-action="delete-asset" data-kind="${escapeHtml(item.kind || "conversation")}" data-id="${item.id}">Delete / 删除</button>
        </div>
      </article>
    `)
  ].join("");
}

function renderBrowserList(title, stage, items, renderer) {
  const content = items.length
    ? items.map((item) => renderer(item)).join("")
    : `<p class="muted">Nothing here yet.</p>`;

  return `
    <section class="browser-section browser-section-${stage}">
      <div class="status-line">
        <span>${title}</span>
        <strong>${items.length}</strong>
      </div>
      <div class="browser-list">${content}</div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function populateSettings(settings) {
  const provider = document.querySelector("[data-setting='apiProvider']");
  const mode = document.querySelector("[data-setting='validationMode']");
  const apiBaseUrl = document.querySelector("[data-setting='apiBaseUrl']");
  const apiModel = document.querySelector("[data-setting='apiModel']");
  const apiKey = document.querySelector("[data-setting='apiKey']");
  const autoCompileAfterCapture = document.querySelector("[data-setting='autoCompileAfterCapture']");
  const openWorkspaceAfterCapture = document.querySelector("[data-setting='openWorkspaceAfterCapture']");

  if (provider) {
    provider.value = settings.apiProvider || "custom";
  }
  if (mode) {
    mode.value = settings.validationMode || "local";
  }
  if (apiBaseUrl) {
    apiBaseUrl.value = settings.apiBaseUrl || "";
  }
  if (apiModel) {
    apiModel.value = settings.apiModel || "";
  }
  if (apiKey) {
    apiKey.value = settings.apiKey || "";
  }
  if (autoCompileAfterCapture) {
    autoCompileAfterCapture.checked = settings.autoCompileAfterCapture !== false;
  }
  if (openWorkspaceAfterCapture) {
    openWorkspaceAfterCapture.checked = settings.openWorkspaceAfterCapture !== false;
  }
}

async function renderActiveTabStatus() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tab = pickBestSupportedTab(tabs) || pickBestExternalTab(tabs);
  const activeTabNode = document.querySelector("[data-active-tab]");

  if (!tab?.url) {
    activeTabNode.textContent = "No supported page";
    return;
  }

  const url = new URL(tab.url);
  activeTabNode.textContent = hostnameToPlatformLabel(url.hostname);
}

async function countSupportedTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((tab) => {
    if (!tab.url) {
      return false;
    }
    try {
      const url = new URL(tab.url);
      return SUPPORTED_HOSTS.includes(url.hostname);
    } catch (error) {
      return false;
    }
  }).length;
}

function hostnameToPlatformLabel(hostname) {
  if (hostname.includes("chatgpt") || hostname.includes("openai")) {
    return "ChatGPT";
  }
  if (hostname.includes("claude")) {
    return "Claude";
  }
  if (hostname.includes("gemini")) {
    return "Gemini";
  }
  if (hostname.includes("deepseek")) {
    return "DeepSeek";
  }
  if (hostname.includes("perplexity")) {
    return "Perplexity";
  }
  if (hostname.includes("moonshot") || hostname.includes("kimi")) {
    return "Kimi";
  }
  return hostname;
}

function pickBestExternalTab(tabs) {
  const externalTabs = tabs
    .filter((tab) => /^https?:\/\//.test(tab.url || ""))
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0));

  return externalTabs[0] || null;
}

function pickBestSupportedTab(tabs) {
  return tabs
    .filter((tab) => {
      if (!tab.url) {
        return false;
      }
      try {
        const url = new URL(tab.url);
        return SUPPORTED_HOSTS.includes(url.hostname);
      } catch (error) {
        return false;
      }
    })
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0))[0] || null;
}

async function withActiveTab(callback) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tab = pickBestSupportedTab(tabs) || pickBestExternalTab(tabs);
  if (!tab?.id) {
    setFeedback("No active tab found.");
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.ENSURE_CONTENT_SCRIPT,
      payload: { tabId: tab.id }
    });
    await callback(tab);
    setFeedback("Action sent to active tab.");
  } catch (error) {
    setFeedback(`Action failed: ${error.message}`);
  }
}

function setFeedback(message) {
  const node = document.querySelector("[data-action-feedback]");
  if (node) {
    node.textContent = message;
  }
}

function setSettingsFeedback(message) {
  const node = document.querySelector("[data-settings-feedback]");
  if (node) {
    node.textContent = message;
  }
}

function setAssetFeedback(message) {
  const node = document.querySelector("[data-asset-feedback]");
  if (node) {
    node.textContent = message;
  }
}

function getAssetByKindAndId(kind, id) {
  if (!latestState) {
    return null;
  }

  if (kind === "conversation") {
    return latestState.conversations.find((item) => item.id === id) || null;
  }
  if (kind === "draft") {
    return latestState.drafts.find((item) => item.id === id) || null;
  }
  if (kind === "skill") {
    return latestState.skills.find((item) => item.id === id) || null;
  }
  if (kind === "variant") {
    return latestState.variants.find((item) => item.id === id) || null;
  }
  return null;
}

function showSelectedAssetJson(kind, id) {
  const asset = getAssetByKindAndId(kind, id);
  if (!asset) {
    setAssetFeedback("Could not find the selected asset.");
    return;
  }

  const node = document.querySelector("[data-json-output]");
  node.value = JSON.stringify(asset, null, 2);
  selectedAssetSnapshot = { kind, id };
  document.querySelector(".raw-json-wrap")?.setAttribute("open", "open");
  setAssetFeedback(`Showing selected ${kind} / 当前显示选中的 ${kind} 数据。`);
}

async function deleteAsset(kind, id) {
  const typeMap = {
    conversation: MESSAGE_TYPES.DELETE_CONVERSATION,
    draft: MESSAGE_TYPES.DELETE_DRAFT,
    skill: MESSAGE_TYPES.DELETE_SKILL,
    variant: MESSAGE_TYPES.DELETE_VARIANT
  };
  const payloadKeyMap = {
    conversation: "conversationId",
    draft: "draftId",
    skill: "skillId",
    variant: "variantId"
  };

  const type = typeMap[kind];
  const payloadKey = payloadKeyMap[kind];
  if (!type || !payloadKey) {
    setAssetFeedback("This asset type cannot be deleted.");
    return;
  }

  await chrome.runtime.sendMessage({
    type,
    payload: { [payloadKey]: id }
  });
  await load();
  setAssetFeedback(`Deleted ${kind} / 已删除 ${kind}。`);
}

async function archiveAsset(kind, id) {
  const typeMap = {
    conversation: MESSAGE_TYPES.ARCHIVE_CONVERSATION,
    draft: MESSAGE_TYPES.ARCHIVE_DRAFT,
    skill: MESSAGE_TYPES.ARCHIVE_SKILL
  };
  const payloadKeyMap = {
    conversation: "conversationId",
    draft: "draftId",
    skill: "skillId"
  };

  const type = typeMap[kind];
  const payloadKey = payloadKeyMap[kind];
  if (!type || !payloadKey) {
    setAssetFeedback("This asset type cannot be archived.");
    return;
  }

  await chrome.runtime.sendMessage({
    type,
    payload: { [payloadKey]: id }
  });
  await load();
  setAssetFeedback(`Archived ${kind} / 已归档 ${kind}。`);
}

async function restoreAsset(kind, id) {
  const typeMap = {
    conversation: MESSAGE_TYPES.RESTORE_CONVERSATION,
    draft: MESSAGE_TYPES.RESTORE_DRAFT,
    skill: MESSAGE_TYPES.RESTORE_SKILL
  };
  const payloadKeyMap = {
    conversation: "conversationId",
    draft: "draftId",
    skill: "skillId"
  };

  const type = typeMap[kind];
  const payloadKey = payloadKeyMap[kind];
  if (!type || !payloadKey) {
    setAssetFeedback("This asset type cannot be restored.");
    return;
  }

  await chrome.runtime.sendMessage({
    type,
    payload: { [payloadKey]: id }
  });
  await load();
  setAssetFeedback(`Restored ${kind} / 已恢复 ${kind}。`);
}

function collectSettingsFromForm() {
  const provider = document.querySelector("[data-setting='apiProvider']")?.value || "custom";
  const baseUrlInput = document.querySelector("[data-setting='apiBaseUrl']");
  const modelInput = document.querySelector("[data-setting='apiModel']");
  const keyInput = document.querySelector("[data-setting='apiKey']");
  const resolvedBaseUrl = baseUrlInput?.value.trim() || getSuggestedBaseUrl(provider);

  return {
    validationMode: document.querySelector("[data-setting='validationMode']")?.value || "local",
    apiProvider: provider,
    apiBaseUrl: resolvedBaseUrl,
    apiModel: modelInput?.value.trim() || "",
    apiKey: keyInput?.value.trim() || "",
    autoCompileAfterCapture: document.querySelector("[data-setting='autoCompileAfterCapture']")?.checked ?? true,
    openWorkspaceAfterCapture: document.querySelector("[data-setting='openWorkspaceAfterCapture']")?.checked ?? true
  };
}

function getSuggestedBaseUrl(provider) {
  if (provider === "zhipu") {
    return "https://open.bigmodel.cn/api/paas/v4";
  }
  return "";
}

function downloadJson(text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "skillclip-state.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  if (action === "open-sidepanel") {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow?.id) {
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      setFeedback("Workspace opened.");
    }
  }

  if (action === "open-actionbar") {
    await withActiveTab((tab) => chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OPEN_ACTION_BAR }));
  }

  if (action === "open-palette") {
    await withActiveTab((tab) => chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OPEN_SKILL_PALETTE }));
  }

  if (action === "refresh-state") {
    await load();
    setFeedback("State refreshed.");
  }

  if (action === "show-full-json") {
    renderJson(latestState || {});
    return;
  }

  if (action === "copy-json") {
    const text = document.querySelector("[data-json-output]").value;
    await navigator.clipboard.writeText(text);
    setFeedback("JSON copied.");
  }

  if (action === "download-json") {
    downloadJson(document.querySelector("[data-json-output]").value);
    setFeedback("JSON download started.");
  }

  if (action === "reset-state") {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESET_STATE });
    await load();
    setFeedback("Local data reset.");
  }

  if (action === "seed-demo") {
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SEED_DEMO });
    await load();
    setFeedback("Demo skill seeded.");
  }

  if (action === "save-settings") {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      payload: collectSettingsFromForm()
    });
    await load();
    setSettingsFeedback("Validation settings saved.");
  }

  if (action === "test-api") {
    setSettingsFeedback("Testing API connection...");
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.TEST_API_CONNECTION,
      payload: collectSettingsFromForm()
    });
    setSettingsFeedback(response.result?.message || "Test finished.");
  }

  if (action === "delete-asset") {
    await deleteAsset(target.dataset.kind, target.dataset.id);
    return;
  }

  if (action === "archive-asset") {
    await archiveAsset(target.dataset.kind, target.dataset.id);
    return;
  }

  if (action === "restore-asset") {
    await restoreAsset(target.dataset.kind, target.dataset.id);
    return;
  }

  const assetCard = target.closest("[data-asset-id]");
  if (assetCard instanceof HTMLElement && !target.closest("button")) {
    showSelectedAssetJson(assetCard.dataset.assetKind, assetCard.dataset.assetId);
    return;
  }
});

document.querySelector("[data-setting='apiProvider']")?.addEventListener("change", (event) => {
  const provider = event.target.value;
  const baseUrlInput = document.querySelector("[data-setting='apiBaseUrl']");
  const modelInput = document.querySelector("[data-setting='apiModel']");

  if (provider === "zhipu") {
    if (baseUrlInput && !baseUrlInput.value.trim()) {
      baseUrlInput.value = "https://open.bigmodel.cn/api/paas/v4";
    }
    if (modelInput && !modelInput.value.trim()) {
      modelInput.value = "glm-4.5-air";
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.STORAGE_UPDATED) {
    load();
  }
});

load();
