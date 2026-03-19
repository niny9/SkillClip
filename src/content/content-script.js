(function () {
  if (window.__skillclipContentScriptLoaded) {
    return;
  }

  window.__skillclipContentScriptLoaded = true;

  const MESSAGE_TYPES = {
    PING: "skillclip/ping",
    OPEN_ACTION_BAR: "skillclip/open-action-bar",
    OPEN_SKILL_PALETTE: "skillclip/open-skill-palette",
    SAVE_PROMPT: "skillclip/save-prompt",
    SAVE_FLOW: "skillclip/save-flow",
    COMPILE_SKILL: "skillclip/compile-skill",
    INSERT_SKILL: "skillclip/insert-skill",
    GET_STATE: "skillclip/get-state",
    GET_SETTINGS: "skillclip/get-settings",
    STORAGE_UPDATED: "skillclip/storage-updated",
    OPEN_SIDE_PANEL: "skillclip/open-side-panel"
  };

  const PLATFORMS = {
    CHATGPT: "chatgpt",
    CLAUDE: "claude",
    GEMINI: "gemini",
    DEEPSEEK: "deepseek",
    PERPLEXITY: "perplexity",
    OTHER: "other"
  };

  const platformAdapters = [
    {
      id: PLATFORMS.CHATGPT,
      matches: (hostname) => hostname === "chatgpt.com" || hostname === "chat.openai.com",
      inputSelectors: ["#prompt-textarea", "textarea", "div[contenteditable='true'][id*='prompt']"],
      titleSelectors: ["main h1", "header h1", "title"],
      modelSelectors: ["button[data-testid*='model']", "button[aria-haspopup='menu']", "[data-testid='model-switcher-dropdown-button']"],
      messageSelectors: ["[data-message-author-role]", "article[data-testid*='conversation-turn']"],
      roleFromNode: (node) => {
        const explicit = node.getAttribute("data-message-author-role");
        if (explicit === "assistant" || explicit === "user" || explicit === "system") {
          return explicit;
        }
        const label = node.getAttribute("aria-label") || "";
        return /assistant|chatgpt/i.test(label) ? "assistant" : "user";
      },
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.CLAUDE,
      matches: (hostname) => hostname === "claude.ai",
      inputSelectors: ["div[contenteditable='true'][data-slate-editor='true']", "div[contenteditable='true']", "textarea"],
      titleSelectors: ["main h1", "header h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[data-testid*='model']"],
      messageSelectors: ["div[data-testid='user-message']", "div[data-testid='assistant-message']", "div[class*='Message']"],
      roleFromNode: (node) => {
        const testId = node.getAttribute("data-testid") || "";
        if (testId.includes("assistant")) {
          return "assistant";
        }
        if (testId.includes("user")) {
          return "user";
        }
        const label = node.getAttribute("aria-label") || "";
        return /assistant|claude/i.test(label) ? "assistant" : "user";
      },
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.GEMINI,
      matches: (hostname) => hostname === "gemini.google.com",
      inputSelectors: ["div[contenteditable='true']", "textarea"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["message-content", "[data-test-id='conversation-turn']", "article"],
      roleFromNode: (node) => {
        const text = node.textContent || "";
        return /gemini/i.test(text.slice(0, 30)) ? "assistant" : "user";
      },
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.DEEPSEEK,
      matches: (hostname) => hostname === "chat.deepseek.com",
      inputSelectors: ["textarea", "div[contenteditable='true']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["[class*='message']", "[data-role]", "article"],
      roleFromNode: (node) => {
        const dataRole = node.getAttribute("data-role");
        if (dataRole === "assistant" || dataRole === "user") {
          return dataRole;
        }
        return guessRoleFromText(node.textContent || "");
      },
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.PERPLEXITY,
      matches: (hostname) => hostname === "www.perplexity.ai" || hostname === "perplexity.ai",
      inputSelectors: ["textarea", "div[contenteditable='true']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["main article", "main [class*='thread']", "[class*='message']"],
      roleFromNode: (node) => {
        const label = node.getAttribute("aria-label") || "";
        if (/assistant|perplexity/i.test(label)) {
          return "assistant";
        }
        return guessRoleFromText(node.textContent || "");
      },
      textFromNode: (node) => readRichText(node)
    }
  ];

  let actionBar;
  let palette;
  let toast;
  let voiceStatus;
  let activeRecognition = null;
  let cachedSkills = [];
  let lastVoiceTranscript = "";

  init();

  function init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === MESSAGE_TYPES.PING) {
        sendResponse?.({ ok: true });
        return;
      }
      if (message.type === MESSAGE_TYPES.OPEN_ACTION_BAR) {
        openActionBar();
      }
      if (message.type === MESSAGE_TYPES.OPEN_SKILL_PALETTE) {
        openSkillPalette();
      }
      if (message.type === MESSAGE_TYPES.STORAGE_UPDATED) {
        loadState();
      }
      sendResponse?.({ ok: true });
    });

    document.addEventListener("keydown", onKeydown, true);
    loadState();
  }

  async function loadState() {
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_STATE });
    cachedSkills = response?.result?.skills || [];
  }

  function onKeydown(event) {
    const target = event.target;
    const isInput = target instanceof HTMLElement && matchesInputTarget(target);

    if (isInput && event.key === "/" && !event.metaKey && !event.ctrlKey) {
      window.setTimeout(() => {
        if ((target.textContent || target.value || "").trim() === "/") {
          openSkillPalette();
        }
      }, 0);
    }

    if (event.key === "Escape") {
      closeActionBar();
      closeSkillPalette();
      stopVoiceCapture();
    }
  }

  function openActionBar() {
    closeSkillPalette();
    ensureActionBar();
    renderActionBarMeta();
    actionBar.classList.add("skillclip-visible");
  }

  function closeActionBar() {
    actionBar?.classList.remove("skillclip-visible");
  }

  function openSkillPalette() {
    closeActionBar();
    ensureSkillPalette();
    renderSkillList("");
    palette.classList.add("skillclip-visible");
    const input = palette.querySelector("input");
    input.value = "";
    input.focus();
  }

  function closeSkillPalette() {
    palette?.classList.remove("skillclip-visible");
  }

  function ensureActionBar() {
    if (actionBar) {
      return;
    }

    actionBar = document.createElement("div");
    actionBar.className = "skillclip-panel";
    actionBar.innerHTML = `
      <div class="skillclip-panel-header">
        <div>
          <strong>SkillClip</strong>
          <p class="skillclip-panel-meta" data-platform-meta></p>
        </div>
        <button type="button" data-close>Close</button>
      </div>
      <div class="skillclip-panel-body">
        <button type="button" data-action="save-prompt">Save Prompt</button>
        <button type="button" data-action="compile-skill">Compile to Skill</button>
        <button type="button" data-action="save-flow">Save Whole Flow</button>
        <button type="button" data-action="toggle-voice">Voice to Input</button>
        <p class="skillclip-voice-status" data-voice-status>Voice is ready</p>
        <div class="skillclip-voice-actions" data-voice-actions hidden></div>
      </div>
    `;

    voiceStatus = actionBar.querySelector("[data-voice-status]");

    actionBar.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.dataset.close !== undefined) {
        stopVoiceCapture();
        closeActionBar();
        return;
      }

      const action = target.dataset.action;
      if (!action) {
        return;
      }

      if (action === "toggle-voice") {
        toggleVoiceCapture(target);
        return;
      }

      if (action === "save-voice-prompt") {
        await saveVoiceResult("save-prompt");
        return;
      }

      if (action === "compile-voice-skill") {
        await saveVoiceResult("compile-skill");
        return;
      }

      if (action === "dismiss-voice-result") {
        clearVoiceActions();
        return;
      }

      const payload = buildCapturePayload(action);
      const settingsResponse = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS });
      const settings = settingsResponse?.result || {};

      if (action === "save-prompt") {
        const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SAVE_PROMPT, payload });
        showToast(response?.result?.preview ? "Saved and compiled into preview" : "Saved to Inbox");
      }

      if (action === "save-flow") {
        const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SAVE_FLOW, payload });
        showToast(response?.result?.preview ? "Flow saved and compiled into preview" : "Whole flow saved");
      }

      if (action === "compile-skill") {
        await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COMPILE_SKILL, payload });
        showToast("Compiled into preview");
      }

      if (settings.openWorkspaceAfterCapture !== false) {
        await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_SIDE_PANEL });
      }
      closeActionBar();
    });

    document.body.appendChild(actionBar);
  }

  function renderActionBarMeta() {
    if (!actionBar) {
      return;
    }

    const metaNode = actionBar.querySelector("[data-platform-meta]");
    const metadata = getConversationMetadata();
    const parts = [
      metadata.platform,
      metadata.model || "model unknown"
    ].filter(Boolean);
    metaNode.textContent = parts.join(" · ");
  }

  function ensureSkillPalette() {
    if (palette) {
      return;
    }

    palette = document.createElement("div");
    palette.className = "skillclip-panel skillclip-palette";
    palette.innerHTML = `
      <div class="skillclip-panel-header">
        <strong>Skill Palette</strong>
        <button type="button" data-close>Close</button>
      </div>
      <div class="skillclip-panel-body">
        <input type="text" placeholder="Search skills" />
        <div data-results class="skillclip-list"></div>
      </div>
    `;

    palette.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.dataset.close !== undefined) {
        closeSkillPalette();
        return;
      }

      const skillId = target.dataset.skillId;
      if (!skillId) {
        return;
      }

      const skill = cachedSkills.find((item) => item.id === skillId);
      if (!skill) {
        return;
      }

      insertSkill(skill);
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.INSERT_SKILL,
        payload: { skillId }
      });
      showToast(`Inserted "${skill.name}"`);
      closeSkillPalette();
    });

    palette.querySelector("input").addEventListener("input", (event) => {
      renderSkillList(event.target.value || "");
    });

    document.body.appendChild(palette);
  }

  function renderSkillList(query) {
    const results = palette.querySelector("[data-results]");
    const normalized = query.trim().toLowerCase();
    const skills = cachedSkills.filter((skill) => {
      if (!normalized) {
        return true;
      }

      return [skill.name, skill.scenario, ...(skill.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    if (skills.length === 0) {
      results.innerHTML = `<div class="skillclip-empty">No skills found yet</div>`;
      return;
    }

    results.innerHTML = skills
      .slice(0, 8)
      .map((skill) => `
        <button type="button" class="skillclip-skill-item" data-skill-id="${skill.id}">
          <span>${escapeHtml(skill.name)}</span>
          <small>${escapeHtml(skill.scenario || "Reusable workflow")}</small>
        </button>
      `)
      .join("");
  }

  function buildCapturePayload(action, preferredText = "") {
    const metadata = getConversationMetadata();
    return {
      ...metadata,
      selectedText: getSelectedText(preferredText),
      turns: action === "save-prompt" ? [] : readConversationTurns(8)
    };
  }

  async function saveVoiceResult(action) {
    const payload = buildCapturePayload(action, lastVoiceTranscript);
    if (!payload.selectedText) {
      showToast("No voice text available yet");
      return;
    }

    if (action === "save-prompt") {
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SAVE_PROMPT, payload });
      showToast("Voice text saved to Inbox");
    }

    if (action === "compile-skill") {
      await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.COMPILE_SKILL, payload });
      showToast("Voice text compiled into a skill draft");
    }

    clearVoiceActions();
    await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_SIDE_PANEL });
  }

  function getCurrentAdapter() {
    const hostname = window.location.hostname;
    return platformAdapters.find((adapter) => adapter.matches(hostname)) || createFallbackAdapter();
  }

  function createFallbackAdapter() {
    return {
      id: PLATFORMS.OTHER,
      inputSelectors: ["textarea", "div[contenteditable='true']", "div[role='textbox']", "input[type='text']"],
      titleSelectors: ["main h1", "h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["main article", "main section", "main div"],
      roleFromNode: (node) => guessRoleFromText(node.textContent || ""),
      textFromNode: (node) => readRichText(node)
    };
  }

  function getConversationMetadata() {
    const adapter = getCurrentAdapter();
    return {
      platform: adapter.id,
      url: window.location.href,
      title: findFirstText(adapter.titleSelectors) || document.title,
      model: findFirstText(adapter.modelSelectors)
    };
  }

  function readConversationTurns(limit) {
    const adapter = getCurrentAdapter();
    const nodes = collectAdapterMessageNodes(adapter);
    const turns = nodes
      .map((node, index) => {
        const text = (adapter.textFromNode ? adapter.textFromNode(node) : readRichText(node)).trim();
        if (!text || text.length < 2) {
          return null;
        }

        return {
          id: `turn_${index}_${Math.random().toString(36).slice(2, 8)}`,
          role: normalizeRole(adapter.roleFromNode ? adapter.roleFromNode(node) : guessRoleFromText(text)),
          text: text.slice(0, 1200)
        };
      })
      .filter(Boolean);

    return collapseDuplicateTurns(turns).slice(-limit);
  }

  function collectAdapterMessageNodes(adapter) {
    const seen = new Set();
    const nodes = [];

    adapter.messageSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }
        if (seen.has(node)) {
          return;
        }
        seen.add(node);
        nodes.push(node);
      });
    });

    return nodes.filter((node) => readRichText(node).trim().length > 0);
  }

  function collapseDuplicateTurns(turns) {
    const deduped = [];
    const seen = new Set();

    turns.forEach((turn) => {
      const fingerprint = `${turn.role}:${turn.text}`;
      if (seen.has(fingerprint)) {
        return;
      }
      seen.add(fingerprint);
      deduped.push(turn);
    });

    return deduped;
  }

  function getSelectedText(preferredText = "") {
    if (preferredText && preferredText.trim()) {
      return preferredText.trim();
    }

    const selected = window.getSelection()?.toString()?.trim();
    if (selected) {
      return selected;
    }

    const activeInput = getActiveInput();
    if (!activeInput) {
      return "";
    }

    if (activeInput instanceof HTMLTextAreaElement || activeInput instanceof HTMLInputElement) {
      return activeInput.value.trim();
    }

    return activeInput.textContent?.trim() || "";
  }

  function getActiveInput() {
    const adapter = getCurrentAdapter();
    const selectors = [...(adapter.inputSelectors || []), "textarea", "div[contenteditable='true']", "div[role='textbox']", "input[type='text']"];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement && isVisible(element)) {
        return element;
      }
    }

    return null;
  }

  function matchesInputTarget(target) {
    return target.matches("textarea, input, [contenteditable='true'], div[role='textbox']");
  }

  function insertSkill(skill) {
    const activeInput = document.activeElement instanceof HTMLElement && matchesInputTarget(document.activeElement)
      ? document.activeElement
      : getActiveInput();

    const text = resolveTemplate(skill);
    if (!activeInput) {
      showToast("No AI input found on this page");
      return;
    }

    insertTextIntoInput(activeInput, text, false);
  }

  function resolveTemplate(skill) {
    let template = skill.promptTemplate || "";
    (skill.inputs || []).forEach((input) => {
      const value = window.prompt(`Value for ${input.label || input.key}`) || "";
      template = template.replaceAll(`{{${input.key}}}`, value);
    });
    return template;
  }

  function toggleVoiceCapture(button) {
    if (activeRecognition) {
      stopVoiceCapture();
      button.textContent = "Voice to Input";
      updateVoiceStatus("Voice stopped");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      updateVoiceStatus("Voice input is not supported in this browser");
      showToast("Speech recognition is unavailable here");
      return;
    }

    const activeInput = document.activeElement instanceof HTMLElement && matchesInputTarget(document.activeElement)
      ? document.activeElement
      : getActiveInput();

    if (!activeInput) {
      updateVoiceStatus("Focus an AI input before starting voice");
      showToast("No writable AI input found");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = "";
    let lastInterim = "";
    lastVoiceTranscript = "";

    recognition.onstart = () => {
      activeRecognition = recognition;
      button.textContent = "Stop Voice";
      updateVoiceStatus("Listening...");
      clearVoiceActions();
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          finalTranscript += `${transcript} `;
          lastVoiceTranscript = finalTranscript.trim();
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript.trim() && finalTranscript.trim() !== lastInterim.trim()) {
        insertTextIntoInput(activeInput, `${finalTranscript.trim()} `, true);
        lastInterim = finalTranscript.trim();
      }

      updateVoiceStatus(interimTranscript ? `Listening: ${interimTranscript}` : "Listening...");
    };

    recognition.onerror = (event) => {
      updateVoiceStatus(`Voice error: ${event.error}`);
      activeRecognition = null;
      button.textContent = "Voice to Input";
    };

    recognition.onend = () => {
      activeRecognition = null;
      button.textContent = "Voice to Input";
      if (lastVoiceTranscript.trim()) {
        updateVoiceStatus("Voice captured. Choose what to do next.");
        showVoiceActions();
      } else if (voiceStatus?.textContent === "Listening...") {
        updateVoiceStatus("Voice finished");
      }
    };

    recognition.start();
  }

  function stopVoiceCapture() {
    if (activeRecognition) {
      activeRecognition.stop();
      activeRecognition = null;
    }
    const button = actionBar?.querySelector("[data-action='toggle-voice']");
    if (button) {
      button.textContent = "Voice to Input";
    }
  }

  function updateVoiceStatus(message) {
    if (voiceStatus) {
      voiceStatus.textContent = message;
    }
  }

  function showVoiceActions() {
    const container = actionBar?.querySelector("[data-voice-actions]");
    if (!container) {
      return;
    }

    container.hidden = false;
    container.innerHTML = `
      <p class="skillclip-voice-hint">Voice result ready. Save it directly:</p>
      <div class="skillclip-inline-actions">
        <button type="button" data-action="save-voice-prompt">Save as Prompt</button>
        <button type="button" data-action="compile-voice-skill">Compile to Skill</button>
        <button type="button" data-action="dismiss-voice-result">Keep Only In Input</button>
      </div>
    `;
  }

  function clearVoiceActions() {
    const container = actionBar?.querySelector("[data-voice-actions]");
    if (!container) {
      return;
    }

    container.hidden = true;
    container.innerHTML = "";
  }

  function insertTextIntoInput(element, text, append) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const nextValue = append ? `${element.value}${text}` : text;
      element.value = nextValue;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.focus();
      return;
    }

    element.focus();

    if (!append) {
      if (typeof document.execCommand === "function") {
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, text);
      } else {
        element.textContent = text;
      }
    } else if (typeof document.execCommand === "function") {
      document.execCommand("insertText", false, text);
    } else {
      element.textContent = `${element.textContent || ""}${text}`;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function findFirstText(selectors) {
    for (const selector of selectors || []) {
      const node = document.querySelector(selector);
      const text = node?.textContent?.trim();
      if (text) {
        return text.slice(0, 120);
      }
    }
    return "";
  }

  function readRichText(node) {
    const text = node.innerText || node.textContent || "";
    return text.replace(/\n{3,}/g, "\n\n").replace(/\s+\n/g, "\n").trim();
  }

  function guessRoleFromText(text) {
    return /assistant|claude|chatgpt|gemini|perplexity/i.test(text.slice(0, 24)) ? "assistant" : "user";
  }

  function normalizeRole(role) {
    if (role === "assistant" || role === "user" || role === "system") {
      return role;
    }
    return "user";
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function showToast(message) {
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "skillclip-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("skillclip-visible");
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      toast.classList.remove("skillclip-visible");
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
