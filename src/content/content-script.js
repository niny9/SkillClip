(function () {
  if (window.__skillclipContentScriptLoaded) {
    return;
  }

  window.__skillclipContentScriptLoaded = true;

  const MESSAGE_TYPES = {
    PING: "skillclip/ping",
    OPEN_ACTION_BAR: "skillclip/open-action-bar",
    OPEN_SKILL_PALETTE: "skillclip/open-skill-palette",
    APPLY_SKILL: "skillclip/apply-skill",
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
    KIMI: "kimi",
    DOUBAO: "doubao",
    YUANBAO: "yuanbao",
    QWEN: "qwen",
    COPILOT: "copilot",
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
      messageSelectors: [
        "message-content",
        "[data-test-id='conversation-turn']",
        "[data-message-id]",
        "[role='listitem']",
        "main article"
      ],
      roleFromNode: (node) => {
        const ariaLabel = node.getAttribute("aria-label") || "";
        const dataRole = node.getAttribute("data-role") || "";
        const text = node.textContent || "";
        if (/user|you/i.test(ariaLabel) || /user/i.test(dataRole)) {
          return "user";
        }
        if (/gemini|model|assistant/i.test(ariaLabel) || /assistant/i.test(dataRole)) {
          return "assistant";
        }
        if (/^you\b/i.test(text.trim())) {
          return "user";
        }
        return /gemini/i.test(text.slice(0, 60)) ? "assistant" : guessRoleFromText(text);
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
    },
    {
      id: PLATFORMS.KIMI,
      matches: (hostname) => hostname === "kimi.moonshot.cn" || hostname === "www.kimi.com" || hostname === "kimi.com",
      inputSelectors: ["textarea", "div[contenteditable='true']", "div[role='textbox']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']", "[class*='Model']"],
      messageSelectors: ["main article", "[data-message-id]", "[role='listitem']", "[class*='message']"],
      roleFromNode: (node) => {
        const ariaLabel = node.getAttribute("aria-label") || "";
        const text = node.textContent || "";
        if (/user|you/i.test(ariaLabel) || /^you\b/i.test(text.trim())) {
          return "user";
        }
        if (/kimi|assistant|moonshot/i.test(ariaLabel) || /kimi/i.test(text.slice(0, 60))) {
          return "assistant";
        }
        return guessRoleFromText(text);
      },
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.DOUBAO,
      matches: (hostname) => hostname === "www.doubao.com" || hostname === "doubao.com",
      inputSelectors: ["textarea", "div[contenteditable='true']", "div[role='textbox']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["main article", "[data-message-id]", "[role='listitem']", "[class*='message']"],
      roleFromNode: (node) => guessRoleFromText(node.textContent || ""),
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.YUANBAO,
      matches: (hostname) => hostname === "yuanbao.tencent.com",
      inputSelectors: ["textarea", "div[contenteditable='true']", "div[role='textbox']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["main article", "[data-message-id]", "[role='listitem']", "[class*='message']"],
      roleFromNode: (node) => guessRoleFromText(node.textContent || ""),
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.QWEN,
      matches: (hostname) => hostname === "tongyi.aliyun.com" || hostname === "qianwen.aliyun.com",
      inputSelectors: ["textarea", "div[contenteditable='true']", "div[role='textbox']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["main article", "[data-message-id]", "[role='listitem']", "[class*='message']"],
      roleFromNode: (node) => guessRoleFromText(node.textContent || ""),
      textFromNode: (node) => readRichText(node)
    },
    {
      id: PLATFORMS.COPILOT,
      matches: (hostname) => hostname === "copilot.microsoft.com",
      inputSelectors: ["textarea", "div[contenteditable='true']", "div[role='textbox']"],
      titleSelectors: ["main h1", "title"],
      modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
      messageSelectors: ["main article", "[data-message-id]", "[role='listitem']", "[class*='message']"],
      roleFromNode: (node) => guessRoleFromText(node.textContent || ""),
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
  let dragState = null;
  let lastFocusedInput = null;

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
      if (message.type === MESSAGE_TYPES.APPLY_SKILL) {
        const ok = insertSkill(message.payload?.skill);
        sendResponse?.({ ok });
        return;
      }
      if (message.type === MESSAGE_TYPES.STORAGE_UPDATED) {
        loadState();
      }
      sendResponse?.({ ok: true });
    });

    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("focusin", onFocusIn, true);
    loadState();
  }

  function onFocusIn(event) {
    const target = event.target;
    if (target instanceof HTMLElement && matchesInputTarget(target) && isVisible(target)) {
      lastFocusedInput = target;
    }
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
    ensurePanelVisible(actionBar);
    actionBar.classList.add("skillclip-visible");
  }

  function closeActionBar() {
    actionBar?.classList.remove("skillclip-visible");
  }

  function openSkillPalette() {
    closeActionBar();
    ensureSkillPalette();
    renderSkillList("");
    ensurePanelVisible(palette);
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
    makePanelDraggable(actionBar);

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
        if (!payload.turns.length && !payload.selectedText) {
          showToast("No flow found on this page yet");
        } else if (payload.fallbackFlow) {
          showToast("Whole flow saved to queue as fallback content");
        } else {
          showToast(response?.result?.preview ? "Whole flow saved and added to pending skills" : "Whole flow saved to queue");
        }
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
      const searchInput = palette.querySelector("input");
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        searchInput.select();
      }
    });

    palette.querySelector("input").addEventListener("input", (event) => {
      renderSkillList(event.target.value || "");
    });

    makePanelDraggable(palette);
    document.body.appendChild(palette);
  }

  function makePanelDraggable(panel) {
    const header = panel.querySelector(".skillclip-panel-header");
    if (!header) {
      return;
    }

    header.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest("button, input")) {
        return;
      }

      const rect = panel.getBoundingClientRect();
      dragState = {
        panel,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      panel.dataset.dragged = "true";
      panel.setPointerCapture?.(event.pointerId);
      window.addEventListener("pointermove", onPanelDrag);
      window.addEventListener("pointerup", stopPanelDrag, { once: true });
    });
  }

  function onPanelDrag(event) {
    if (!dragState?.panel) {
      return;
    }

    const panel = dragState.panel;
    const left = Math.max(12, Math.min(window.innerWidth - panel.offsetWidth - 12, event.clientX - dragState.offsetX));
    const top = Math.max(12, Math.min(window.innerHeight - panel.offsetHeight - 12, event.clientY - dragState.offsetY));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function ensurePanelVisible(panel) {
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(12, window.innerWidth - rect.width - 12);
    const maxTop = Math.max(12, window.innerHeight - rect.height - 12);
    const outOfBounds = rect.right > window.innerWidth || rect.bottom > window.innerHeight || rect.left < 0 || rect.top < 0;

    if (!panel.dataset.dragged || outOfBounds) {
      panel.style.left = "auto";
      panel.style.bottom = "auto";
      panel.style.right = "18px";
      panel.style.top = "18px";
      if (panel.classList.contains("skillclip-palette")) {
        panel.style.top = `${Math.min(64, maxTop)}px`;
      }
      return;
    }

    const left = Math.max(12, Math.min(maxLeft, rect.left));
    const top = Math.max(12, Math.min(maxTop, rect.top));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function stopPanelDrag() {
    dragState = null;
    window.removeEventListener("pointermove", onPanelDrag);
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
    const selectedText = getSelectedText(preferredText);
    let turns = action === "save-prompt" ? [] : readConversationTurns(8);

    if (!turns.length && selectedText) {
      turns = [
        {
          id: `turn_fallback_${Date.now()}`,
          role: "user",
          text: selectedText.slice(0, 1200)
        }
      ];
    }

    return {
      ...metadata,
      selectedText,
      turns,
      fallbackFlow: action === "save-flow" && turns.length === 1
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

    const filtered = nodes.filter((node) => readRichText(node).trim().length > 0 && !isInsideSkillclipUi(node));
    if (filtered.length >= 2) {
      return filtered;
    }

    const fallbackNodes = collectFallbackMessageNodes();
    fallbackNodes.forEach((node) => {
      if (!seen.has(node)) {
        seen.add(node);
        filtered.push(node);
      }
    });

    return filtered;
  }

  function collectFallbackMessageNodes() {
    const main = document.querySelector("main") || document.body;
    const candidates = Array.from(main.querySelectorAll("article, section, div, p"))
      .filter((node) => node instanceof HTMLElement)
      .filter((node) => isVisible(node) && !isInsideSkillclipUi(node))
      .filter((node) => {
        const text = readRichText(node);
        return text.length >= 40 && text.length <= 1600;
      })
      .filter((node) => {
        const childTextLength = Array.from(node.children).reduce((sum, child) => sum + readRichText(child).length, 0);
        return childTextLength < readRichText(node).length * 0.85;
      });

    return candidates.slice(-12);
  }

  function isInsideSkillclipUi(node) {
    return Boolean(node.closest(".skillclip-panel, .skillclip-toast"));
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
    if (lastFocusedInput instanceof HTMLElement && lastFocusedInput.isConnected && isVisible(lastFocusedInput)) {
      return lastFocusedInput;
    }

    const adapter = getCurrentAdapter();
    const selectors = [...(adapter.inputSelectors || []), "textarea", "div[contenteditable='true']", "div[role='textbox']", "input[type='text']"];

    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const element = elements.find((node) => node instanceof HTMLElement && isVisible(node) && !isInsideSkillclipUi(node));
      if (element instanceof HTMLElement) {
        return element;
      }
    }

    return null;
  }

  function matchesInputTarget(target) {
    return target.matches("textarea, input, [contenteditable='true'], div[role='textbox']") && !isInsideSkillclipUi(target);
  }

  function insertSkill(skill) {
    if (!skill) {
      showToast("No skill payload received");
      return false;
    }

    const adapter = getCurrentAdapter();
    const activeInput = lastFocusedInput instanceof HTMLElement && lastFocusedInput.isConnected && isVisible(lastFocusedInput)
      ? lastFocusedInput
      : document.activeElement instanceof HTMLElement && matchesInputTarget(document.activeElement)
      ? document.activeElement
      : getActiveInput();

    const text = buildRuntimeSkillText(skill);
    if (!activeInput) {
      showToast("No AI input found on this page");
      return false;
    }

    insertTextIntoInput(activeInput, text, false, adapter.id);
    lastFocusedInput = activeInput;
    const insertedValue = readInputValue(activeInput);
    const success = normalizeForCompare(insertedValue).includes(normalizeForCompare(text).slice(0, 40));
    if (!success) {
      showToast("Skill inserted, but this site may need manual review");
    }
    return success;
  }

  function buildRuntimeSkillText(skill) {
    const values = {};
    (skill.inputs || []).forEach((input) => {
      values[input.key] = window.prompt(`Value for ${input.label || input.key}`) || "";
    });

    const resolvedTemplate = applyInputValues(skill.promptTemplate || "", values);
    const steps = (skill.steps || []).map((step, index) => `${index + 1}. ${applyInputValues(step, values)}`);
    const successCriteria = (skill.successCriteria || []).map((item) => `- ${applyInputValues(item, values)}`);
    const providedInputs = Object.entries(values)
      .filter(([, value]) => value && value.trim())
      .map(([key, value]) => `- ${key}: ${value.trim()}`);

    const lines = [
      skill.goal ? `Goal: ${applyInputValues(skill.goal, values)}` : "",
      skill.useWhen ? `Use when: ${applyInputValues(skill.useWhen, values)}` : "",
      providedInputs.length ? "Inputs:" : "",
      ...providedInputs,
      steps.length ? "Steps:" : "",
      ...steps,
      skill.outputFormat ? `Output format: ${applyInputValues(skill.outputFormat, values)}` : "",
      successCriteria.length ? "Success criteria:" : "",
      ...successCriteria,
      resolvedTemplate ? "Reference prompt:" : "",
      resolvedTemplate || ""
    ].filter(Boolean);

    return lines.join("\n");
  }

  function applyInputValues(template, values) {
    return Object.entries(values || {}).reduce((current, [key, value]) => (
      current.replaceAll(`{{${key}}}`, value)
    ), template || "");
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

    lastFocusedInput = activeInput;

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

  function insertTextIntoInput(element, text, append, platformId = PLATFORMS.OTHER) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const nextValue = append ? `${element.value}${text}` : text;
      setNativeInputValue(element, nextValue);
      element.focus();
      return;
    }

    element.focus();
    insertIntoContentEditable(element, text, append, platformId);
  }

  function setNativeInputValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: value,
      inputType: "insertText"
    }));

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      data: value,
      inputType: "insertText"
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  function insertIntoContentEditable(element, text, append, platformId) {
    if (platformId === PLATFORMS.GEMINI || platformId === PLATFORMS.DEEPSEEK || platformId === PLATFORMS.DOUBAO || platformId === PLATFORMS.QWEN || platformId === PLATFORMS.COPILOT) {
      setStructuredEditableContent(element, text, append);
      return;
    }

    if (!append) {
      selectAllContent(element);
    } else {
      placeCaretAtEnd(element);
    }

    let inserted = false;
    try {
      inserted = document.execCommand?.("insertText", false, text) || false;
    } catch (error) {
      inserted = false;
    }

    if (!inserted) {
      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        placeCaretAtEnd(element);
      } else {
        element.textContent = append ? `${element.textContent || ""}${text}` : text;
      }
    }

    element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: append ? "insertText" : "insertReplacementText"
    }));
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      data: text,
      inputType: append ? "insertText" : "insertReplacementText"
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  function setStructuredEditableContent(element, text, append) {
    const finalText = append ? `${readInputValue(element)}${text}` : text;
    const lines = finalText.split("\n");
    element.innerHTML = "";

    lines.forEach((line, index) => {
      if (index > 0) {
        element.appendChild(document.createElement("br"));
      }
      element.appendChild(document.createTextNode(line));
    });

    placeCaretAtEnd(element);
    element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: append ? "insertText" : "insertReplacementText"
    }));
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      data: text,
      inputType: append ? "insertText" : "insertReplacementText"
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  function selectAllContent(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function placeCaretAtEnd(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function readInputValue(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return element.value || "";
    }
    return readRichText(element);
  }

  function normalizeForCompare(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
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
