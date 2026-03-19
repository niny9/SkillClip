import { PLATFORMS } from "./constants.js";
import { shorten } from "./utils.js";

function hostnameMatches(hostname, expected) {
  return hostname === expected || hostname.endsWith(`.${expected}`);
}

function readText(node) {
  return (node?.innerText || node?.textContent || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function guessRole(text = "") {
  return /assistant|claude|chatgpt|gemini|perplexity/i.test(text.slice(0, 40)) ? "assistant" : "user";
}

export const PLATFORM_ADAPTERS = [
  {
    id: PLATFORMS.CHATGPT,
    matches: (hostname) => hostnameMatches(hostname, "chatgpt.com") || hostnameMatches(hostname, "chat.openai.com"),
    inputSelectors: ["#prompt-textarea", "textarea", "div[contenteditable='true'][id*='prompt']"],
    messageSelectors: ["[data-message-author-role]", "article[data-testid*='conversation-turn']"],
    modelSelectors: ["button[data-testid*='model']", "[data-testid='model-switcher-dropdown-button']"],
    roleFromNode: (node) => node.getAttribute("data-message-author-role") || guessRole(readText(node))
  },
  {
    id: PLATFORMS.CLAUDE,
    matches: (hostname) => hostnameMatches(hostname, "claude.ai"),
    inputSelectors: ["div[contenteditable='true'][data-slate-editor='true']", "div[contenteditable='true']", "textarea"],
    messageSelectors: ["div[data-testid='user-message']", "div[data-testid='assistant-message']", "div[class*='Message']"],
    modelSelectors: ["button[aria-haspopup='menu']", "[data-testid*='model']"],
    roleFromNode: (node) => {
      const testId = node.getAttribute("data-testid") || "";
      if (testId.includes("assistant")) {
        return "assistant";
      }
      if (testId.includes("user")) {
        return "user";
      }
      return guessRole(readText(node));
    }
  },
  {
    id: PLATFORMS.GEMINI,
    matches: (hostname) => hostnameMatches(hostname, "gemini.google.com"),
    inputSelectors: ["div[contenteditable='true']", "textarea"],
    messageSelectors: ["message-content", "[data-test-id='conversation-turn']", "article"],
    modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
    roleFromNode: (node) => guessRole(readText(node))
  },
  {
    id: PLATFORMS.DEEPSEEK,
    matches: (hostname) => hostnameMatches(hostname, "chat.deepseek.com"),
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    messageSelectors: ["[class*='message']", "[data-role]", "article"],
    modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
    roleFromNode: (node) => node.getAttribute("data-role") || guessRole(readText(node))
  },
  {
    id: PLATFORMS.PERPLEXITY,
    matches: (hostname) => hostnameMatches(hostname, "perplexity.ai") || hostnameMatches(hostname, "www.perplexity.ai"),
    inputSelectors: ["textarea", "div[contenteditable='true']"],
    messageSelectors: ["main article", "main [class*='thread']", "[class*='message']"],
    modelSelectors: ["button[aria-haspopup='menu']", "[class*='model']"],
    roleFromNode: (node) => guessRole(readText(node))
  }
];

export function detectPlatform(locationLike = window.location) {
  const hostname = locationLike.hostname;
  return PLATFORM_ADAPTERS.find((adapter) => adapter.matches(hostname))?.id || PLATFORMS.OTHER;
}

export function getConversationMetadata() {
  const adapter = PLATFORM_ADAPTERS.find((item) => item.matches(window.location.hostname));
  const model = adapter
    ? firstMatchingText(adapter.modelSelectors)
    : firstMatchingText(["button[aria-haspopup='menu']", "[class*='model']"]);

  return {
    platform: detectPlatform(window.location),
    url: window.location.href,
    title: document.title,
    model: model ? shorten(model, 80) : ""
  };
}

export function getActiveInput() {
  const adapter = PLATFORM_ADAPTERS.find((item) => item.matches(window.location.hostname));
  const selectors = adapter?.inputSelectors || ["textarea", "div[contenteditable='true']", "div[role='textbox']", "input[type='text']"];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  return null;
}

export function readConversationTurns(limit = 6) {
  const adapter = PLATFORM_ADAPTERS.find((item) => item.matches(window.location.hostname));
  const selectors = adapter?.messageSelectors || ["main article", "main section", "main div"];
  const nodes = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  const seen = new Set();

  const turns = nodes
    .filter((node) => {
      if (!(node instanceof HTMLElement) || seen.has(node)) {
        return false;
      }
      seen.add(node);
      return true;
    })
    .map((node, index) => {
      const text = readText(node);
      if (!text) {
        return null;
      }

      return {
        id: `turn_${index}`,
        role: adapter?.roleFromNode?.(node) || guessRole(text),
        text: shorten(text, 700)
      };
    })
    .filter(Boolean);

  return turns.slice(-limit);
}

function firstMatchingText(selectors = []) {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }
  return "";
}
