export async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "skillclip/ping" });
    return { injected: false };
  } catch (error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/content-script.js"]
    });
    return { injected: true };
  }
}
