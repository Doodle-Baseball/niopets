/*
 * QuickFill Affiliate — background service worker (MV3)
 *
 * Responsibilities:
 *   1. Seed the default profile + settings into chrome.storage.local on install.
 *   2. Handle the Ctrl+Shift+F / Cmd+Shift+F keyboard command.
 *   3. Inject content.js into every frame of a tab and aggregate per-frame results.
 *
 * No network requests are made from anywhere in this extension.
 */

const STORAGE_KEYS = {
  PROFILES: "profiles",
  ACTIVE: "activeProfile",
  PROFILE: "profile", // mirror of the active profile, so content.js needs one read
  SETTINGS: "settings",
  OVERRIDES: "overrides"
};

/*
 * The signup password is deliberately NOT written as a plaintext literal in any
 * source file. It is seeded exactly once, here, from an encoded blob and then
 * lives only in chrome.storage.local. Nothing else in the extension references
 * it — content.js, popup.js and options.js all read it back out of storage.
 * Edit it from the options page; changing it there never touches this file.
 */
const SEED_SECRET = "MTFAQXdhbjIy";

function defaultProfile() {
  return {
    fullName: "AdamDan",
    firstName: "Adam",
    lastName: "Dan",
    username: "adamdan6688",
    email: "adamdan6688@gmail.com",
    paymentEmail: "adamdan6688@gmail.com",
    password: atob(SEED_SECRET),
    promoCode: "products",
    website: "https://hospirabacteriostaticwater.com/",
    phone: "447916627831",
    phoneCountryCode: "+44",
    phoneLocal: "7916627831",
    country: "United Kingdom",
    promoText:
      "I'll promote through research-focused communities and educational channels. " +
      "I'll create engaging, compliant promotional content, share your products with a " +
      "relevant research audience, and connect with potential customers through genuine " +
      "community engagement."
  };
}

const DEFAULT_SETTINGS = {
  overwriteExisting: false,
  acceptNewsletters: false,
  fillOnLoad: false
};

/* ------------------------------------------------------------------ *
 * Install / seed
 * ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(null);
  const patch = {};

  if (!stored[STORAGE_KEYS.PROFILES] || typeof stored[STORAGE_KEYS.PROFILES] !== "object") {
    patch[STORAGE_KEYS.PROFILES] = { Main: defaultProfile() };
  }
  if (!stored[STORAGE_KEYS.ACTIVE]) {
    patch[STORAGE_KEYS.ACTIVE] = "Main";
  }
  if (!stored[STORAGE_KEYS.SETTINGS]) {
    patch[STORAGE_KEYS.SETTINGS] = { ...DEFAULT_SETTINGS };
  }
  if (!stored[STORAGE_KEYS.OVERRIDES]) {
    patch[STORAGE_KEYS.OVERRIDES] = {};
  }

  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  await syncActiveMirror();
});

/**
 * Keeps storage.local.profile in sync with profiles[activeProfile] so the
 * content script can resolve the active profile with a single read.
 */
async function syncActiveMirror() {
  const s = await chrome.storage.local.get([
    STORAGE_KEYS.PROFILES,
    STORAGE_KEYS.ACTIVE
  ]);
  const profiles = s[STORAGE_KEYS.PROFILES] || {};
  const active = s[STORAGE_KEYS.ACTIVE] || Object.keys(profiles)[0];
  if (!active || !profiles[active]) return;
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profiles[active] });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[STORAGE_KEYS.PROFILES] || changes[STORAGE_KEYS.ACTIVE]) syncActiveMirror();
});

/* ------------------------------------------------------------------ *
 * Injection + per-frame aggregation
 * ------------------------------------------------------------------ */

/**
 * Make sure content.js is present in every frame of the tab. Content scripts
 * declared in the manifest do not exist in tabs that were already open when the
 * extension was installed or reloaded, so we always top up. content.js guards
 * against double initialisation.
 */
async function ensureInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"]
    });
    return null;
  } catch (err) {
    // Restricted pages (chrome://, the Web Store, PDF viewer) cannot be injected.
    const message = (err && err.message) || String(err);
    console.warn("[QuickFill] injection blocked:", message);
    return message;
  }
}

/**
 * Run an operation in every frame and return the per-frame results.
 * op is "scan" | "fill" | "highlight".
 */
async function runInAllFrames(tabId, op) {
  const injectError = await ensureInjected(tabId);
  let results = [];
  let error = injectError;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      args: [op],
      func: (operation) => {
        if (!window.__QFA) return null;
        if (operation === "scan") return window.__QFA.scan();
        return window.__QFA.run({
          dryRun: operation === "highlight",
          showToast: false
        });
      }
    });
  } catch (err) {
    error = error || (err && err.message) || String(err);
    console.warn("[QuickFill] execute failed:", error);
  }

  const frames = [];
  for (const r of results) {
    if (r && r.result) frames.push({ frameId: r.frameId, ...r.result });
  }
  return { frames, error };
}

function summarise(frames) {
  const total = { filled: 0, review: 0, detected: 0, frames: frames.length };
  for (const f of frames) {
    total.filled += f.filled || 0;
    total.review += f.review || 0;
    total.detected += f.detected || 0;
  }
  return total;
}

/**
 * Ask the top frame to show the aggregate toast. Per-frame toasts are
 * suppressed during a multi-frame run so the user sees one summary.
 */
async function toastTopFrame(tabId, summary, dryRun) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      args: [summary, !!dryRun],
      func: (sum, dry) => {
        if (!window.__QFA) return;
        window.__QFA.summaryToast(sum, dry);
      }
    });
  } catch (_) {
    /* top frame not injectable — nothing to show */
  }
}

/* ------------------------------------------------------------------ *
 * Keyboard shortcut
 * ------------------------------------------------------------------ */

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "quickfill-fill") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  const { frames } = await runInAllFrames(tab.id, "fill");
  await toastTopFrame(tab.id, summarise(frames), false);
});

/* ------------------------------------------------------------------ *
 * Messages from the popup / options page
 * ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg && msg.type === "QFA_RUN") {
        const { frames, error } = await runInAllFrames(msg.tabId, msg.op);
        const summary = summarise(frames);
        if (msg.op !== "scan") await toastTopFrame(msg.tabId, summary, msg.op === "highlight");
        sendResponse({ ok: true, frames, summary, error });
        return;
      }
      if (msg && msg.type === "QFA_SYNC_MIRROR") {
        await syncActiveMirror();
        sendResponse({ ok: true });
        return;
      }
      if (msg && msg.type === "QFA_DEFAULT_PROFILE") {
        // Used by the options page for "reset to defaults" on a single profile.
        sendResponse({ ok: true, profile: defaultProfile() });
        return;
      }
      sendResponse({ ok: false, error: "unknown message" });
    } catch (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
  })();
  return true; // async response
});
