import { MESSAGE_TYPES } from "../../lib/constants.js";

async function load() {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
  const state = response.result;

  updateCount("conversations", state.conversations.length);
  updateCount("drafts", state.drafts.length);
  updateCount("skills", state.skills.length);
  renderRecentSkills(state.skills);
}

async function ensureScriptReady(tabId) {
  await chrome.runtime.sendMessage({
    type: MESSAGE_TYPES.ENSURE_CONTENT_SCRIPT,
    payload: { tabId }
  });
}

function setFeedback(message) {
  const node = document.querySelector("[data-feedback]");
  if (node) {
    node.textContent = message;
  }
}

function updateCount(key, value) {
  const node = document.querySelector(`[data-count='${key}']`);
  if (node) {
    node.textContent = String(value);
  }
}

function renderRecentSkills(skills) {
  const container = document.querySelector("[data-recent-skills]");
  if (!skills.length) {
    container.innerHTML = "<p class='muted'>Your compiled skills will show up here.</p>";
    return;
  }

  container.innerHTML = skills
    .slice(0, 4)
    .map((skill) => `
      <article class="list-card">
        <strong>${skill.name}</strong>
        <span>${skill.scenario || "Reusable workflow"}</span>
      </article>
    `)
    .join("");
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.action === "open-sidepanel") {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow?.id) {
      await chrome.sidePanel.open({ windowId: currentWindow.id });
      setFeedback("Workspace opened.");
    }
  }

  if (target.dataset.action === "open-options") {
    await chrome.runtime.openOptionsPage();
    setFeedback("Control Center opened.");
  }

  if (target.dataset.action === "open-actionbar") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await ensureScriptReady(tab.id);
        await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OPEN_ACTION_BAR });
        setFeedback("Action bar sent to page. Look on the left side.");
      } catch (error) {
        setFeedback("Could not reach page. Reload extension and refresh the AI tab.");
      }
    }
  }

  if (target.dataset.action === "open-palette") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await ensureScriptReady(tab.id);
        await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.OPEN_SKILL_PALETTE });
        setFeedback("Skill palette sent to page. Look on the left side.");
      } catch (error) {
        setFeedback("Could not reach page. Reload extension and refresh the AI tab.");
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPES.STORAGE_UPDATED) {
    load();
  }
});

load();
