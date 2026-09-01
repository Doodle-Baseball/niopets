# QuickFill Affiliate

A Manifest V3 Chrome extension that fills affiliate-program signup forms in one
click. It **never submits a form** — you review what it wrote and click submit
yourself.

- Vanilla JavaScript. No build step, no npm dependencies, no bundler.
- **Zero network requests.** Nothing in this extension talks to any server.
  Your profile lives in `chrome.storage.local` and never leaves the browser.
- Works inside same-origin iframes, and reports each frame's count separately.

---

## Install (load unpacked)

1. Download or clone this repository so that the `quickfill-affiliate/` folder
   is on your machine. That folder — the one containing `manifest.json` — is
   what you will load.
2. Open Chrome and go to **`chrome://extensions`**.
3. Turn on **Developer mode** with the toggle in the top-right corner.
4. Click **Load unpacked** (top-left).
5. Select the **`quickfill-affiliate`** folder itself. Do not select a file
   inside it, and do not select the repository root.
6. The green ⚡ card appears in the list. Pin it: click the puzzle-piece icon in
   the toolbar, then the pin next to **QuickFill Affiliate**.
7. Open **Options** (right-click the icon → Options, or the ⚙ in the popup) and
   confirm the seeded profile is what you want. **Change the password there** —
   the one seeded on install is a starting value, not a secret the extension
   protects.

To pick up code changes later, return to `chrome://extensions` and hit the
**reload** ↻ arrow on the extension card. Tabs that were already open get the
content script re-injected automatically on the next fill.

### Keyboard shortcut

`Ctrl+Shift+F` (`Command+Shift+F` on macOS) fills the active tab without opening
the popup. If another extension already claimed that combination, Chrome leaves
it unbound — set your own at **`chrome://extensions/shortcuts`**. The popup shows
the shortcut that is actually live, or "no shortcut" if there isn't one.

---

## Using it

Land on a signup page and click the icon. The popup shows how many fields it
recognised *before* you commit to anything.

| Control | What it does |
| --- | --- |
| **Fill This Form** | Fills every recognised field and highlights each one. |
| **Fill & Highlight Only** | Outlines what *would* be filled, writing nothing. Use this first on a form that looks unusual. |
| Field count | Live count for the current page, including same-origin iframes. |
| ⚙ | Opens the options page. |

Colour code on the page:

- **Green outline** — confident match.
- **Amber outline** — check this one. Social-profile URLs always get amber
  (they are filled with your website, which is usually not what the site wants),
  as does any field matched only by a loose pattern such as a bare "Name".

A toast in the top-right corner summarises the run (`Filled 9 fields · 2 need
review`) and dismisses itself after four seconds; click it to dismiss early.

### Options

- **Profiles** — create, duplicate, rename, switch, delete. The active profile
  is what the popup and shortcut use.
- **Profile fields** — every value, with the password masked behind Show/Hide.
- **Behaviour toggles** — *Overwrite existing values*, *Auto-accept newsletters*,
  *Fill on page load automatically*. All three default to **off**.
- **Site overrides** — pin a CSS selector on a domain to a profile key.
- **Backup** — Export/Import the whole configuration as JSON.

Nothing is written until you press **Save changes**.

---

## How to debug a form that doesn't fill

Every run prints a collapsed group to the page console. Open DevTools with
**F12**, go to the **Console** tab, run the fill, and expand the group labelled:

```
[QuickFill Affiliate] fill · profile: Main · https://example.com/affiliates
```

Inside is a table, one row per field it touched:

| field | rule | profile key | value written | confidence |
| --- | --- | --- | --- | --- |
| `input type="email" name="email"` | `email` | `email` | adamdan6688@gmail.com | high |
| `input name="insta"` | `socialUrl` | `website` | https://… | review |
| `select name="country"` | `country` | `country` | (no matching option) | skipped |

Read it like this:

- **The field is in the table with the wrong `rule`** → a rule matched something
  it shouldn't have. Fix it with a site override (below), which is checked before
  every generic rule.
- **The field is missing from the table entirely** → nothing matched it, or it
  was skipped. Below the table each row is also logged as a clickable element
  reference, so you can hover a row to highlight the node on the page and check
  what its `name`, `id`, `placeholder` and `<label>` actually say. Common skip
  reasons: the field already had a value (turn on *Overwrite existing values*),
  it is `disabled`/`readonly`, it is invisible, or it looked like a search box.
- **`(no matching option)` on a `<select>`** → the dropdown had no option whose
  text or value contained your profile value. Pick it by hand, or change the
  profile value to match the site's wording.
- **Nothing logged at all** → the content script never ran. Pages like
  `chrome://`, the Chrome Web Store and the PDF viewer block all extensions; the
  popup says so. Cross-origin iframes are also off-limits by design.

> Only the top frame's console is shown by default. If the form is inside an
> iframe, use the frame selector at the top of the Console panel (the dropdown
> that says `top`) to switch to it, or the popup's per-frame counts to confirm
> the frame was reached at all.

### Adding a site override

Once you know the selector, teach the extension permanently:

1. In DevTools, right-click the stubborn field → **Copy** → **Copy selector**.
   Prefer something stable like `#affiliate_handle` over a long generated chain.
2. Options → **Site overrides** → **+ Add override**.
3. Fill in the three columns:

   | Domain | CSS selector | Profile key |
   | --- | --- | --- |
   | `example.com` | `#weird_field_id` | `username` |

4. **Save changes**.

Stored shape:

```json
{ "example.com": { "#weird_field_id": "username" } }
```

The domain matches subdomains too — `example.com` covers
`www.shop.example.com`. Overrides run before the generic rules, so they always
win.

---

## Adding a match rule

All matching lives in one ordered array, `FIELD_RULES`, near the top of
`content.js`. It is evaluated top to bottom, first match wins, and a filled
field is never reconsidered. Each rule carries a comment with an example of the
field it exists to catch.

```js
{
  // "Referral source" on some networks
  key: "referralSource",       // name shown in the console table
  valueKey: "promoText",       // which profile key supplies the value
  example: 'name="ref_source"',
  applies: (c) => !c.isSelect, // optional element-kind guard
  strong: (c) => /referral source/.test(c.hay),  // confident  -> green
  weak:   (c) => /\bsource\b/.test(c.hay)        // loose      -> amber
}
```

`c.hay` is the lowercased haystack for the element: its `name`, `id`,
`placeholder`, `aria-label`, `autocomplete`, `data-name`, `class`, the text of
its associated `<label>`, and the text of its wrapping container when that is
under 120 characters. Insert your rule at the priority it deserves — more
specific rules go higher.

---

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest, permissions, command registration. |
| `background.js` | Service worker: seeds storage, handles the shortcut, injects into every frame and aggregates per-frame results. |
| `content.js` | `FIELD_RULES`, haystack building, skip logic, framework-safe writes, highlighting and the console table. |
| `popup.html/js/css` | The 320px popup. |
| `options.html/js/css` | Profiles, toggles, site overrides, export/import. |
| `icons/` | 16/48/128 PNGs, the `icon.svg` they are drawn from, and `generate-icons.py` which regenerates them with the standard library alone. |

Regenerate the icons after editing `icon.svg`:

```bash
python3 icons/generate-icons.py
```

## A note on the seeded password

The password is not written as a plaintext literal in any source file. It is
seeded once, from an encoded constant in `background.js`, into
`chrome.storage.local` on install, and every other file reads it back out of
storage. That keeps it out of the code you edit day to day — but it is still
recoverable from this repository, and `chrome.storage.local` is not an encrypted
store. Treat it as a convenience default and change it in Options, especially
before sharing this folder or pushing it anywhere public.
