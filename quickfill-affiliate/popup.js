/* QuickFill Affiliate — popup controller. */

const els = {
  count: document.getElementById("count"),
  countLabel: document.getElementById("countLabel"),
  fill: document.getElementById("fill"),
  highlight: document.getElementById("highlight"),
  status: document.getElementById("status"),
  frames: document.getElementById("frames"),
  profileName: document.getElementById("profileName"),
  shortcutHint: document.getElementById("shortcutHint"),
  openOptions: document.getElementById("openOptions")
};

let activeTab = null;

function setStatus(text, kind) {
  els.status.hidden = !text;
  els.status.textContent = text || "";
  els.status.className = "status" + (kind ? " " + kind : "");
}

function busy(state) {
  els.fill.disabled = state;
  els.highlight.disabled = state;
}

/** Ask the background worker to run an operation across every frame. */
function runOp(op) {
  return chrome.runtime.sendMessage({ type: "QFA_RUN", op, tabId: activeTab.id });
}

function renderFrames(frames, verbPast) {
  const sub = frames.filter((f) => !f.isTop);
  if (!sub.length) {
    els.frames.hidden = true;
    return;
  }
  els.frames.hidden = false;
  els.frames.innerHTML = "";
  frames.forEach((f) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const value = document.createElement("span");
    let host = f.frame;
    try { host = new URL(f.frame).host || f.frame; } catch (_) {}
    name.textContent = f.isTop ? "main page" : host;
    value.textContent = (f.filled || f.detected || 0) + " " + verbPast;
    li.append(name, value);
    els.frames.appendChild(li);
  });
}

async function scan() {
  try {
    const res = await runOp("scan");
    if (!res || !res.ok) throw new Error((res && res.error) || "scan failed");
    /* No frame answered at all: the page refused injection. */
    if (!res.frames.length) throw new Error(res.error || "no frame responded");
    const total = res.summary.detected;
    els.count.textContent = String(total);
    els.countLabel.textContent =
      total === 1 ? "field detected on this page" : "fields detected on this page";
    renderFrames(res.frames, "detected");
    if (!total) {
      setStatus(
        "Nothing recognised here. Try “Fill & Highlight Only” on a signup page, or add a site override in options.",
        "warn"
      );
    }
  } catch (err) {
    els.count.textContent = "–";
    els.countLabel.textContent = "cannot read this page";
    setStatus("This page is off-limits to extensions (chrome://, the Web Store, or a PDF).", "err");
    busy(true);
  }
}

async function doRun(op) {
  busy(true);
  setStatus(op === "highlight" ? "Highlighting…" : "Filling…");
  try {
    const res = await runOp(op);
    if (!res || !res.ok) throw new Error((res && res.error) || "run failed");
    if (!res.frames.length) throw new Error(res.error || "no frame responded");
    const { filled, review } = res.summary;
    const verb = op === "highlight" ? "Would fill" : "Filled";
    if (!filled) {
      setStatus("No matching fields found on this page", "warn");
    } else {
      setStatus(
        verb + " " + filled + " field" + (filled === 1 ? "" : "s") +
          (review ? " · " + review + " need review" : ""),
        review ? "warn" : null
      );
    }
    renderFrames(res.frames, op === "highlight" ? "to fill" : "filled");
  } catch (err) {
    setStatus(String(err.message || err), "err");
  } finally {
    busy(false);
  }
}

async function loadProfileName() {
  const s = await chrome.storage.local.get(["activeProfile", "profiles"]);
  els.profileName.textContent = s.activeProfile || Object.keys(s.profiles || {})[0] || "none";
}

async function loadShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === "quickfill-fill");
    if (cmd && cmd.shortcut) els.shortcutHint.textContent = cmd.shortcut;
    else els.shortcutHint.textContent = "no shortcut";
  } catch (_) {}
}

els.fill.addEventListener("click", () => doRun("fill"));
els.highlight.addEventListener("click", () => doRun("highlight"));
els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  loadProfileName();
  loadShortcut();
  if (!tab || !tab.id || /^(chrome|edge|about|devtools|chrome-extension):/.test(tab.url || "")) {
    els.count.textContent = "–";
    els.countLabel.textContent = "not a fillable page";
    setStatus("Open a signup page in a normal tab first.", "err");
    busy(true);
    return;
  }
  scan();
})();
