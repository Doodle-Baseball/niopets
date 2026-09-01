/* QuickFill Affiliate — options page. */

/* Every editable profile key, in display order. */
const FIELD_DEFS = [
  { key: "fullName",         label: "Full name" },
  { key: "firstName",        label: "First name" },
  { key: "lastName",         label: "Last name" },
  { key: "username",         label: "Username" },
  { key: "email",            label: "Email" },
  { key: "paymentEmail",     label: "Payment / PayPal email" },
  { key: "password",         label: "Password", secret: true },
  { key: "promoCode",        label: "Promo / affiliate code" },
  { key: "website",          label: "Website", wide: true },
  { key: "phone",            label: "Phone (full, no plus)" },
  { key: "phoneCountryCode", label: "Phone country code" },
  { key: "phoneLocal",       label: "Phone (local part)" },
  { key: "country",          label: "Country" },
  { key: "promoText",        label: "How will you promote?", wide: true, textarea: true }
];

const SETTING_IDS = ["overwriteExisting", "acceptNewsletters", "fillOnLoad"];

const state = {
  profiles: {},
  activeProfile: "Main",
  settings: { overwriteExisting: false, acceptNewsletters: false, fillOnLoad: false },
  overrides: {}
};

const $ = (id) => document.getElementById(id);
let dirty = false;

function markDirty() {
  dirty = true;
  $("dirty").hidden = false;
}

function toast(message, isError) {
  const node = $("toast");
  node.textContent = message;
  node.className = "toast" + (isError ? " err" : "");
  node.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { node.hidden = true; }, 2600);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function renderProfileSelect() {
  const select = $("profileSelect");
  select.innerHTML = "";
  Object.keys(state.profiles).forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  select.value = state.activeProfile;
}

function currentProfile() {
  if (!state.profiles[state.activeProfile]) state.profiles[state.activeProfile] = {};
  return state.profiles[state.activeProfile];
}

function renderFields() {
  const host = $("fields");
  host.innerHTML = "";
  const profile = currentProfile();

  FIELD_DEFS.forEach((def) => {
    const wrap = document.createElement("div");
    wrap.className = "field" + (def.wide ? " wide" : "");

    const label = document.createElement("label");
    label.setAttribute("for", "f_" + def.key);
    label.innerHTML = def.label + ' <span class="key">' + def.key + "</span>";
    wrap.appendChild(label);

    let input;
    if (def.textarea) {
      input = document.createElement("textarea");
    } else {
      input = document.createElement("input");
      input.type = def.secret ? "password" : "text";
    }
    input.id = "f_" + def.key;
    input.value = profile[def.key] != null ? profile[def.key] : "";
    input.addEventListener("input", () => {
      currentProfile()[def.key] = input.value;
      markDirty();
    });

    if (def.secret) {
      /* Masked by default, with a show/hide toggle. */
      const line = document.createElement("div");
      line.className = "with-btn";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "btn ghost";
      toggle.textContent = "Show";
      toggle.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        toggle.textContent = showing ? "Show" : "Hide";
      });
      line.append(input, toggle);
      wrap.appendChild(line);
    } else {
      wrap.appendChild(input);
    }

    host.appendChild(wrap);
  });
}

function renderSettings() {
  SETTING_IDS.forEach((id) => {
    const box = $(id);
    box.checked = !!state.settings[id];
    box.onchange = () => {
      state.settings[id] = box.checked;
      markDirty();
    };
  });
}

function overrideRow(domain, selector, key) {
  const row = document.createElement("div");
  row.className = "ov-row";

  const domainInput = document.createElement("input");
  domainInput.type = "text";
  domainInput.placeholder = "example.com";
  domainInput.value = domain || "";

  const selectorInput = document.createElement("input");
  selectorInput.type = "text";
  selectorInput.placeholder = "#weird_field_id";
  selectorInput.value = selector || "";

  const keySelect = document.createElement("select");
  FIELD_DEFS.forEach((def) => {
    const opt = document.createElement("option");
    opt.value = def.key;
    opt.textContent = def.key;
    keySelect.appendChild(opt);
  });
  keySelect.value = key || "username";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = "Remove";
  remove.addEventListener("click", () => {
    row.remove();
    markDirty();
  });

  [domainInput, selectorInput, keySelect].forEach((el) =>
    el.addEventListener("input", markDirty)
  );

  row.append(domainInput, selectorInput, keySelect, remove);
  return row;
}

function renderOverrides() {
  const host = $("overrides");
  host.innerHTML = "";
  Object.keys(state.overrides).forEach((domain) => {
    const map = state.overrides[domain] || {};
    Object.keys(map).forEach((selector) => {
      host.appendChild(overrideRow(domain, selector, map[selector]));
    });
  });
}

/** Read the override rows back into the nested { domain: { selector: key } } shape. */
function collectOverrides() {
  const out = {};
  document.querySelectorAll("#overrides .ov-row").forEach((row) => {
    const [domainInput, selectorInput, keySelect] = row.querySelectorAll("input, select");
    const domain = domainInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const selector = selectorInput.value.trim();
    if (!domain || !selector) return;
    if (!out[domain]) out[domain] = {};
    out[domain][selector] = keySelect.value;
  });
  return out;
}

function renderAll() {
  renderProfileSelect();
  renderFields();
  renderSettings();
  renderOverrides();
}

/* ------------------------------------------------------------------ *
 * Load / save
 * ------------------------------------------------------------------ */

async function load() {
  const s = await chrome.storage.local.get(["profiles", "activeProfile", "settings", "overrides"]);
  state.profiles = s.profiles && Object.keys(s.profiles).length ? s.profiles : { Main: {} };
  state.activeProfile = s.activeProfile && state.profiles[s.activeProfile]
    ? s.activeProfile
    : Object.keys(state.profiles)[0];
  state.settings = Object.assign({}, state.settings, s.settings || {});
  state.overrides = s.overrides || {};
  renderAll();
}

async function save() {
  state.overrides = collectOverrides();
  await chrome.storage.local.set({
    profiles: state.profiles,
    activeProfile: state.activeProfile,
    settings: state.settings,
    overrides: state.overrides,
    /* Mirror of the active profile, so the content script needs a single read. */
    profile: currentProfile()
  });
  await chrome.runtime.sendMessage({ type: "QFA_SYNC_MIRROR" }).catch(() => {});
  dirty = false;
  $("dirty").hidden = true;
  renderOverrides();
  toast("Saved");
}

/* ------------------------------------------------------------------ *
 * Profile management
 * ------------------------------------------------------------------ */

function uniqueName(base) {
  let name = base;
  let n = 2;
  while (state.profiles[name]) name = base + " " + n++;
  return name;
}

$("profileSelect").addEventListener("change", (e) => {
  state.activeProfile = e.target.value;
  renderFields();
  markDirty();
});

$("newProfile").addEventListener("click", async () => {
  const name = (prompt("Name for the new profile:", uniqueName("Secondary")) || "").trim();
  if (!name) return;
  if (state.profiles[name]) return toast("A profile called “" + name + "” already exists", true);
  const res = await chrome.runtime.sendMessage({ type: "QFA_DEFAULT_PROFILE" }).catch(() => null);
  const blank = {};
  FIELD_DEFS.forEach((d) => { blank[d.key] = ""; });
  state.profiles[name] = res && res.ok ? res.profile : blank;
  state.activeProfile = name;
  renderAll();
  markDirty();
});

$("dupProfile").addEventListener("click", () => {
  const name = (prompt("Name for the copy:", uniqueName(state.activeProfile + " copy")) || "").trim();
  if (!name) return;
  if (state.profiles[name]) return toast("A profile called “" + name + "” already exists", true);
  state.profiles[name] = Object.assign({}, currentProfile());
  state.activeProfile = name;
  renderAll();
  markDirty();
});

$("renameProfile").addEventListener("click", () => {
  const name = (prompt("Rename profile to:", state.activeProfile) || "").trim();
  if (!name || name === state.activeProfile) return;
  if (state.profiles[name]) return toast("A profile called “" + name + "” already exists", true);
  /* Rebuild the map so the profile keeps its position in the list. */
  const rebuilt = {};
  Object.keys(state.profiles).forEach((k) => {
    if (k === state.activeProfile) rebuilt[name] = state.profiles[k];
    else rebuilt[k] = state.profiles[k];
  });
  state.profiles = rebuilt;
  state.activeProfile = name;
  renderAll();
  markDirty();
});

$("deleteProfile").addEventListener("click", () => {
  const names = Object.keys(state.profiles);
  if (names.length < 2) return toast("Keep at least one profile", true);
  if (!confirm("Delete the profile “" + state.activeProfile + "”?")) return;
  delete state.profiles[state.activeProfile];
  state.activeProfile = Object.keys(state.profiles)[0];
  renderAll();
  markDirty();
});

$("resetProfile").addEventListener("click", async () => {
  if (!confirm("Reset “" + state.activeProfile + "” to the seeded defaults?")) return;
  const res = await chrome.runtime.sendMessage({ type: "QFA_DEFAULT_PROFILE" }).catch(() => null);
  if (!res || !res.ok) return toast("Could not load defaults", true);
  state.profiles[state.activeProfile] = res.profile;
  renderFields();
  markDirty();
});

/* ------------------------------------------------------------------ *
 * Overrides / backup
 * ------------------------------------------------------------------ */

$("addOverride").addEventListener("click", () => {
  $("overrides").appendChild(overrideRow("", "", "username"));
  markDirty();
});

$("exportBtn").addEventListener("click", () => {
  const payload = {
    _format: "quickfill-affiliate/v1",
    exportedAt: new Date().toISOString(),
    profiles: state.profiles,
    activeProfile: state.activeProfile,
    settings: state.settings,
    overrides: collectOverrides()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quickfill-affiliate-profiles.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Exported");
});

$("importBtn").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || !data.profiles) throw new Error("not a QuickFill export");
    state.profiles = data.profiles;
    state.activeProfile = data.activeProfile && data.profiles[data.activeProfile]
      ? data.activeProfile
      : Object.keys(data.profiles)[0];
    state.settings = Object.assign({}, state.settings, data.settings || {});
    state.overrides = data.overrides || {};
    renderAll();
    await save();
    toast("Imported");
  } catch (err) {
    toast("Import failed: " + (err.message || err), true);
  } finally {
    e.target.value = "";
  }
});

$("save").addEventListener("click", save);

window.addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

load();
