import { MESSAGE_TYPES } from "../../lib/constants.js";

const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "chat.deepseek.com",
  "perplexity.ai",
  "www.perplexity.ai"
];

async function load() {
  const [stateResponse, settingsResponse] = await Promise.all([
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE }),
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS })
  ]);
  const state = stateResponse.result;
  const settings = settingsResponse.result;

  updateCount("conversations", state.conversations.filter((item) => !item.archivedAt).length);
  updateCount("previews", state.drafts.filter((item) => item.status === "preview").length);
  updateCount("drafts", state.drafts.filter((item) => item.status === "draft").length);
  updateCount("skills", state.skills.filter((item) => item.status !== "archived").length);
  updateCount("variants", state.variants.length);
  updateCount(
    "archived",
    state.conversations.filter((item) => item.archivedAt).length
      + state.drafts.filter((item) => item.status === "archived").length
      + state.skills.filter((item) => item.status === "archived").length
  );
  renderJson(state);
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
}

function populateSettings(settings) {
  const provider = document.querySelector("[data-setting='apiProvider']");
  const mode = document.querySelector("[data-setting='validationMode']");
  const apiBaseUrl = document.querySelector("[data-setting='apiBaseUrl']");
  const apiModel = document.querySelector("[data-setting='apiModel']");
  const apiKey = document.querySelector("[data-setting='apiKey']");

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
}

async function renderActiveTabStatus() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tab = pickBestExternalTab(tabs);
  const activeTabNode = document.querySelector("[data-active-tab]");
  const platformNode = document.querySelector("[data-platform-status]");

  if (!tab?.url) {
    activeTabNode.textContent = "No page found";
    platformNode.textContent = "Unknown";
    return;
  }

  const url = new URL(tab.url);
  activeTabNode.textContent = url.hostname;
  platformNode.textContent = SUPPORTED_HOSTS.includes(url.hostname) ? "Supported" : "Unsupported";
}

function pickBestExternalTab(tabs) {
  const externalTabs = tabs
    .filter((tab) => /^https?:\/\//.test(tab.url || ""))
    .sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0));

  return externalTabs[0] || null;
}

async function withActiveTab(callback) {
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
    await callback(tab);
    setFeedback("Action sent to active tab.");
  } catch (error) {
    setFeedback(`Action failed: ${error.message}`);
  }
}

function setFeedback(message) {
  const node = document.querySelector("[data-action-feedback]");
  node.textContent = message;
}

function setSettingsFeedback(message) {
  const node = document.querySelector("[data-settings-feedback]");
  if (node) {
    node.textContent = message;
  }
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
    apiKey: keyInput?.value.trim() || ""
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
  if (!action) {
    return;
  }

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
