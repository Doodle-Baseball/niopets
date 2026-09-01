/*
 * QuickFill Affiliate — content script
 *
 * Injected into every frame (all_frames: true). Detects affiliate-signup form
 * fields, fills them from the active profile, and highlights what it touched.
 * It NEVER submits a form and NEVER makes a network request.
 *
 * The whole script is wrapped in a try/catch so that a crash on one hostile
 * page cannot take the extension down anywhere else.
 */
try {
  (function () {
    "use strict";

    /* Injected twice (manifest + scripting.executeScript top-up)? Do nothing. */
    if (window.__QFA && window.__QFA.version) return;

    const VERSION = "1.0.0";
    const HIGHLIGHT_MS = 3000;
    const TOAST_MS = 4000;

    /* ================================================================== *
     * 1. Token vocabulary
     * ================================================================== */

    const T = {
      password: /(password|passwd|pwd|\bpass\b)/,
      confirm: /(confirm|repeat|retype|re-?type|again|verify|verification|_2|\bre-?enter\b|re_enter|second)/,
      email: /(e-?mail|\bmail\b)/,
      search: /(search|query|autocomplete-?search)/,
      newsletter: /(newsletter|marketing email|promotional email|subscribe|mailing list|keep me (up to date|informed)|send me|offers|updates)/,
      terms: /(terms|agree|accept|policy|policies|privacy|conditions|18 years|21 years|over 18|over 21|confirm that|research use|i certify|i understand|i am a)/,
      countryCode: /(country ?code|dial(l)?ing ?code|dial ?code|phone ?code|\bprefix\b|\bidd\b|calling code)/
    };

    /* Words that mean "the name of a thing", not "the name of a person". */
    const NON_PERSON_NAME = /(company|business|organi[sz]ation|brand|store|shop|site|website|domain|product|bank|card ?holder ?name|file|page|channel|app|project|coupon|program|user ?name)/;

    /* ================================================================== *
     * 2. FIELD_RULES — the whole matching brain, in one ordered array.
     *
     * Evaluated top to bottom; FIRST MATCH WINS and a filled element is never
     * reconsidered. Add a rule by dropping an object in at the right priority.
     *
     *   key       identifier used in the console table and site overrides
     *   valueKey  which profile key supplies the value
     *   example   a real field this rule is meant to catch
     *   applies   optional element-kind guard
     *   strong    regex whose match is unambiguous  -> confidence "high"
     *   weak      regex that is a plausible-but-loose match -> "review" (amber)
     *   review    optional predicate forcing amber regardless of strong/weak
     * ================================================================== */

    const FIELD_RULES = [
      {
        // 1. <input type="password" name="password_confirmation">  "Confirm password"
        key: "confirmPassword",
        valueKey: "password",
        example: 'name="password2" / "Repeat your password"',
        strong: (c) => T.password.test(c.hay) && T.confirm.test(c.hay)
      },
      {
        // 2. "Confirm your email address" / name="email_confirmation"
        key: "confirmEmail",
        valueKey: "email",
        example: 'name="email_confirm" / "Re-enter email"',
        strong: (c) => T.email.test(c.hay) && T.confirm.test(c.hay)
      },
      {
        // 3. "PayPal email for payouts" — must beat the generic email rule.
        key: "paymentEmail",
        valueKey: "paymentEmail",
        example: '"PayPal address", "Payout email", "Wise account"',
        strong: (c) => /(paypal|payment|payout|pay ?to|remittance|\bwise\b)/.test(c.hay)
      },
      {
        // 4. Any plain password box.
        key: "password",
        valueKey: "password",
        example: '<input type="password"> / "Choose a password"',
        strong: (c) => c.type === "password" || /(password|pwd|passwd)/.test(c.hay)
      },
      {
        // 5. "First name" / autocomplete="given-name"
        key: "firstName",
        valueKey: "firstName",
        example: 'name="fname" / "Given name"',
        strong: (c) => /(first ?name|first_name|\bfname\b|given[ _-]?name)/.test(c.hay)
      },
      {
        // 6. "Last name" / autocomplete="family-name"
        key: "lastName",
        valueKey: "lastName",
        example: 'name="lname" / "Surname"',
        strong: (c) => /(last ?name|last_name|\blname\b|surname|family[ _-]?name)/.test(c.hay)
      },
      {
        // 7. "Full name" / "Your name" — or a bare "Name" that reached this far,
        //    which means rules 5 and 6 already declined it.
        key: "fullName",
        valueKey: "fullName",
        example: '"Full name", "Contact name", or a lone "Name"',
        strong: (c) => /(full ?name|your name|contact name|account holder|legal name|name on account)/.test(c.hay),
        weak: (c) => /\bname\b/.test(c.hay) && !NON_PERSON_NAME.test(c.hay)
      },
      {
        // 8. "Username" / "Choose a login"
        key: "username",
        valueKey: "username",
        example: 'name="user_name" / "Screen name"',
        strong: (c) => /(user ?name|user_name|\blogin\b|nick ?name|display name|screen name|\buserid\b|user id)/.test(c.hay),
        weak: (c) => /\bhandle\b/.test(c.hay)
      },
      {
        // 9. "Desired affiliate code" / "Preferred coupon code"
        key: "promoCode",
        valueKey: "promoCode",
        example: '"Requested promo code", "Vanity code"',
        applies: (c) => !c.isTextarea,
        strong: (c) =>
          /(promo[ _-]?code|coupon|discount code|referral code|affiliate code|desired code|preferred code|requested code|vanity)/.test(c.hay) &&
          !/(promot(e|ing|ion)|how will you|describe)/.test(c.hay),
        weak: (c) => /\bpromo\b/.test(c.hay) && !/(promot(e|ing|ion)|how will you|describe)/.test(c.hay)
      },
      {
        // 10a. "Instagram profile", "YouTube channel" — filled with the website
        //      URL but always flagged amber, because it is probably wrong.
        key: "socialUrl",
        valueKey: "website",
        example: '"Instagram handle URL", "TikTok profile"',
        strong: (c) => /(instagram|youtube|tiktok|twitter|facebook|linked ?in|pinterest|snapchat|telegram|discord|social)/.test(c.hay),
        review: () => true
      },
      {
        // 10b. "Website URL", "Your blog", "Domain you will promote on"
        key: "website",
        valueKey: "website",
        example: 'name="site_url" / "Homepage"',
        strong: (c) => /(web ?site|site ?url|web address|\bblog\b|\bdomain\b|home ?page|\burl\b|web ?page|site name)/.test(c.hay)
      },
      {
        // 11a. A dedicated country / dialling code box next to the phone field.
        key: "phoneCountryCode",
        valueKey: "phoneCountryCode",
        example: '<select name="dial_code"> with "+44 United Kingdom"',
        strong: (c) => isCountryCodeField(c)
      },
      {
        // 11b. "Phone number", "Mobile", "WhatsApp"
        key: "phone",
        valueKey: "phone", // resolved at fill time to phone vs phoneLocal
        example: 'name="tel" / "Contact number"',
        strong: (c) => /(phone|mobile|\bcell\b|telephone|\btel\b|whats ?app|contact number|msisdn)/.test(c.hay)
      },
      {
        // 11c. A country <select> — matched to United Kingdom / UK / GB.
        key: "country",
        valueKey: "country",
        example: '<select name="country">',
        applies: (c) => c.isSelect,
        strong: (c) => /\bcountry\b|\bnation\b/.test(c.hay)
      },
      {
        // 12. "Email address"
        key: "email",
        valueKey: "email",
        example: 'type="email" / "Your e-mail"',
        strong: (c) => c.type === "email" || /e-?mail/.test(c.hay),
        weak: (c) => /\bmail\b/.test(c.hay)
      },
      {
        // 13. "How will you promote us?" and every other free-text box.
        key: "promoText",
        valueKey: "promoText",
        example: '<textarea> / "Describe your traffic sources"',
        strong: (c) =>
          c.isTextarea ||
          /(promote|promotion|how will you|describe|traffic|audience|marketing|strategy|tell us)/.test(c.hay),
        weak: (c) => /(experience|about you|\bmessage\b|comments?)/.test(c.hay)
      }
    ];

    /* ================================================================== *
     * 3. Haystack construction
     * ================================================================== */

    function norm(s) {
      return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function cssEscape(s) {
      if (window.CSS && CSS.escape) return CSS.escape(s);
      return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
    }

    /** Text of the <label> associated with an element, by any of the usual routes. */
    function labelText(el) {
      const bits = [];

      if (el.id) {
        try {
          const forLabel = el.ownerDocument.querySelector(
            'label[for="' + cssEscape(el.id) + '"]'
          );
          if (forLabel) bits.push(forLabel.textContent);
        } catch (_) {}
      }

      const wrapping = el.closest("label");
      if (wrapping) bits.push(wrapping.textContent);

      const ariaLabelledBy = el.getAttribute("aria-labelledby");
      if (ariaLabelledBy) {
        ariaLabelledBy.split(/\s+/).forEach((id) => {
          const node = el.ownerDocument.getElementById(id);
          if (node) bits.push(node.textContent);
        });
      }

      /* Nearest preceding text node or short sibling element ("Email *" spans). */
      let prev = el.previousSibling;
      let hops = 0;
      while (prev && hops < 4) {
        const text = norm(prev.textContent);
        if (text && text.length < 80) {
          bits.push(text);
          break;
        }
        prev = prev.previousSibling;
        hops++;
      }

      return bits.join(" ");
    }

    /** Text of the closest wrapping container, but only when it is short. */
    function containerText(el) {
      const box = el.closest("div, fieldset, section, li, td, p");
      if (!box) return "";
      const text = norm(box.textContent);
      return text.length < 120 ? text : "";
    }

    function buildHaystack(el) {
      const parts = [
        el.getAttribute("name"),
        el.id,
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("autocomplete"),
        el.getAttribute("data-name"),
        el.getAttribute("data-testid"),
        el.getAttribute("title"),
        String(el.className || "").slice(0, 200),
        labelText(el),
        containerText(el)
      ];
      /* Underscores/dashes become spaces too, so "first_name" also reads as
         "first name" — but keep the raw form for patterns like "_2". */
      const raw = norm(parts.filter(Boolean).join(" "));
      return raw + " " + raw.replace(/[_\-.]+/g, " ");
    }

    /* ================================================================== *
     * 4. Eligibility
     * ================================================================== */

    const SKIP_TYPES = new Set([
      "hidden", "submit", "button", "image", "reset", "file", "range", "color",
      /* radios are never a profile field — leave the user's choice alone */
      "radio"
    ]);

    function isVisible(el) {
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      if (!style) return false;
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (el.offsetParent === null && style.position !== "fixed") return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      return true;
    }

    function hasValue(el) {
      if (el.tagName === "SELECT") {
        /* A select always reports the first option; only a deliberate choice
           past the placeholder counts as "already answered". */
        return el.selectedIndex > 0 && !!el.value;
      }
      return String(el.value || "").trim() !== "";
    }

    function isSearchField(el, hay) {
      if (norm(el.getAttribute("name")) === "q") return true;
      if (el.type === "search") return true;
      return T.search.test(hay);
    }

    /** Reasons a field is off-limits, or null when it is fair game. */
    function skipReason(el, hay, settings) {
      const type = norm(el.type);
      if (el.tagName === "INPUT" && SKIP_TYPES.has(type)) return "type:" + type;
      if (el.disabled) return "disabled";
      if (el.readOnly) return "readonly";
      if (el.getAttribute("aria-hidden") === "true") return "aria-hidden";
      if (!isVisible(el)) return "not visible";
      if (isSearchField(el, hay)) return "search box";
      if (hasValue(el) && !settings.overwriteExisting) return "already has a value";
      return null;
    }

    /* ================================================================== *
     * 5. Matching
     * ================================================================== */

    function describe(el) {
      const bits = [el.tagName.toLowerCase()];
      if (el.type) bits.push('type="' + el.type + '"');
      if (el.name) bits.push('name="' + el.name + '"');
      else if (el.id) bits.push('id="' + el.id + '"');
      return bits.join(" ");
    }

    function isCountryCodeField(c) {
      if (T.countryCode.test(c.hay)) return true;
      /* <select> whose options look like "+44 (UK)" */
      if (c.isSelect) {
        const opts = Array.from(c.el.options).slice(0, 40);
        const plusCount = opts.filter((o) => /\+\d{1,4}/.test(o.textContent + " " + o.value)).length;
        if (plusCount >= 3) return true;
      }
      /* A short text input sitting next to the phone box, labelled "+" */
      if (!c.isSelect && /(^|\s)\+(\s|$)/.test(c.hay) && /(phone|mobile|tel)/.test(c.hay)) return true;
      return false;
    }

    function matchRule(ctx) {
      for (const rule of FIELD_RULES) {
        if (rule.applies && !rule.applies(ctx)) continue;
        let confidence = null;
        if (rule.strong && rule.strong(ctx)) confidence = "high";
        else if (rule.weak && rule.weak(ctx)) confidence = "review";
        if (!confidence) continue;
        if (rule.review && rule.review(ctx)) confidence = "review";
        return { rule, confidence };
      }
      return null;
    }

    /* ================================================================== *
     * 6. Writing values (framework-safe)
     * ================================================================== */

    /**
     * React/Vue/Svelte keep their own copy of the value. Assigning el.value
     * directly is silently reverted on submit, so we go through the native
     * prototype setter and then fire the events the framework listens for.
     */
    function setValue(el, value) {
      try { el.focus({ preventScroll: true }); } catch (_) {}

      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      const setter = descriptor && descriptor.set;
      if (setter) setter.call(el, value);
      else el.value = value;

      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      try { el.blur(); } catch (_) {}
    }

    /** Pick the option whose text or value contains the wanted string. */
    function setSelectValue(el, value, key) {
      const wanted = [String(value)];
      if (key === "country") wanted.push("united kingdom", "uk", "gb", "gbr", "great britain");
      if (key === "phoneCountryCode") wanted.push("+44", "44", "united kingdom", "uk");

      const options = Array.from(el.options);
      let chosen = null;

      for (const want of wanted) {
        const needle = norm(want);
        if (!needle) continue;
        /* Exact match on value or text first, then a contains match. */
        chosen =
          options.find((o) => norm(o.value) === needle || norm(o.textContent) === needle) ||
          options.find((o) => norm(o.value).includes(needle) || norm(o.textContent).includes(needle));
        if (chosen) break;
      }

      if (!chosen) return false;

      try { el.focus({ preventScroll: true }); } catch (_) {}
      el.value = chosen.value;
      if (el.value !== chosen.value) el.selectedIndex = options.indexOf(chosen);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      try { el.blur(); } catch (_) {}
      return true;
    }

    function tickCheckbox(el) {
      try { el.focus({ preventScroll: true }); } catch (_) {}
      const proto = HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "checked");
      const setter = descriptor && descriptor.set;
      if (setter) setter.call(el, true);
      else el.checked = true;
      el.dispatchEvent(new Event("click", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      try { el.blur(); } catch (_) {}
    }

    /* ================================================================== *
     * 7. Visual feedback
     * ================================================================== */

    const STYLE_ID = "qfa-style-block";

    function injectStyles() {
      const doc = document;
      if (!doc.head || doc.getElementById(STYLE_ID)) return;
      const style = doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = [
        ".qfa-hit{transition:outline-color .45s ease,background-color .45s ease,box-shadow .45s ease !important;}",
        ".qfa-hit-high{outline:2px solid #22c55e !important;outline-offset:1px !important;background-color:rgba(34,197,94,.12) !important;box-shadow:0 0 0 4px rgba(34,197,94,.12) !important;}",
        ".qfa-hit-review{outline:2px solid #f59e0b !important;outline-offset:1px !important;background-color:rgba(245,158,11,.14) !important;box-shadow:0 0 0 4px rgba(245,158,11,.12) !important;}",
        ".qfa-hit-fade{outline-color:transparent !important;background-color:transparent !important;box-shadow:none !important;}",
        "#qfa-toast{position:fixed;top:16px;right:16px;z-index:2147483647;max-width:320px;",
        "font:600 13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
        "color:#e8eef5;background:#131a24;border:1px solid #2a3644;border-left:4px solid #22c55e;",
        "border-radius:10px;padding:11px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer;",
        "opacity:0;transform:translateY(-8px);transition:opacity .2s ease,transform .2s ease;}",
        "#qfa-toast.qfa-show{opacity:1;transform:translateY(0);}",
        "#qfa-toast.qfa-warn{border-left-color:#f59e0b;}",
        "#qfa-toast.qfa-empty{border-left-color:#64748b;}",
        "#qfa-toast small{display:block;margin-top:3px;font-weight:400;color:#94a3b8;}"
      ].join("");
      doc.head.appendChild(style);
    }

    function highlight(el, confidence) {
      try {
        injectStyles();
        const cls = confidence === "review" ? "qfa-hit-review" : "qfa-hit-high";
        el.classList.add("qfa-hit", cls);
        setTimeout(() => {
          el.classList.add("qfa-hit-fade");
          setTimeout(() => {
            el.classList.remove("qfa-hit", cls, "qfa-hit-fade");
          }, 500);
        }, HIGHLIGHT_MS);
      } catch (_) {}
    }

    let toastTimer = null;

    function toast(message, sub, kind) {
      try {
        if (!document.body) return;
        injectStyles();
        let node = document.getElementById("qfa-toast");
        if (!node) {
          node = document.createElement("div");
          node.id = "qfa-toast";
          node.addEventListener("click", () => node.remove());
          document.body.appendChild(node);
        }
        node.className = kind ? "qfa-" + kind : "";
        node.textContent = message;
        if (sub) {
          const small = document.createElement("small");
          small.textContent = sub;
          node.appendChild(small);
        }
        requestAnimationFrame(() => node.classList.add("qfa-show"));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
          node.classList.remove("qfa-show");
          setTimeout(() => node.remove(), 250);
        }, TOAST_MS);
      } catch (_) {}
    }

    function summaryToast(summary, dryRun) {
      const verb = dryRun ? "Would fill" : "Filled";
      if (!summary || !summary.filled) {
        toast("No matching fields found on this page", null, "empty");
        return;
      }
      let msg = verb + " " + summary.filled + " field" + (summary.filled === 1 ? "" : "s");
      if (summary.review) msg += " · " + summary.review + " need review";
      const sub = summary.frames > 1 ? "across " + summary.frames + " frames" : null;
      toast(msg, sub, summary.review ? "warn" : null);
    }

    /* ================================================================== *
     * 8. Storage
     * ================================================================== */

    const FALLBACK_SETTINGS = {
      overwriteExisting: false,
      acceptNewsletters: false,
      fillOnLoad: false
    };

    async function loadState() {
      const s = await chrome.storage.local.get([
        "profile", "profiles", "activeProfile", "settings", "overrides"
      ]);
      const profiles = s.profiles || {};
      const active = s.activeProfile || Object.keys(profiles)[0] || "Main";
      const profile = s.profile || profiles[active] || {};
      return {
        profile,
        activeProfile: active,
        settings: Object.assign({}, FALLBACK_SETTINGS, s.settings || {}),
        overrides: s.overrides || {}
      };
    }

    /** Site overrides for this hostname: { "#selector": "profileKey" } */
    function overridesForHost(all) {
      const host = norm(location.hostname);
      const merged = {};
      for (const domain of Object.keys(all || {})) {
        const d = norm(domain);
        if (!d) continue;
        if (host === d || host.endsWith("." + d)) Object.assign(merged, all[domain]);
      }
      return merged;
    }

    /* ================================================================== *
     * 9. The run
     * ================================================================== */

    function collectCandidates() {
      return Array.from(document.querySelectorAll("input, textarea, select"));
    }

    function buildContext(el) {
      const hay = buildHaystack(el);
      const tag = el.tagName.toLowerCase();
      return {
        el,
        hay,
        tag,
        type: norm(el.type),
        isTextarea: tag === "textarea",
        isSelect: tag === "select",
        maxLength: el.maxLength && el.maxLength > 0 ? el.maxLength : null
      };
    }

    /**
     * Resolve the string to write. Phone is the only key that depends on the
     * rest of the form: a separate country-code box means the main field gets
     * the local number, and a short maxlength forces the local number too.
     */
    function resolveValue(key, ctx, profile, hasCountryCodeField) {
      if (key === "phone") {
        if (hasCountryCodeField) return profile.phoneLocal || profile.phone || "";
        if (ctx.maxLength !== null && ctx.maxLength < 12) return profile.phoneLocal || "";
        return profile.phone || "";
      }
      return profile[key] != null ? String(profile[key]) : "";
    }

    /**
     * Checkboxes: terms/age/compliance boxes get ticked, newsletter opt-ins only
     * when the user asked for it. An already-ticked box is never touched.
     */
    function planCheckbox(el, ctx, settings) {
      if (el.checked) return null;
      if (el.disabled || el.readOnly) return null;
      if (!isVisible(el)) return null;

      const isNewsletter = T.newsletter.test(ctx.hay);
      const isTerms = T.terms.test(ctx.hay);

      if (isNewsletter && !settings.acceptNewsletters) return null;
      if (!isTerms && !(isNewsletter && settings.acceptNewsletters)) return null;

      return {
        el,
        ctx,
        kind: "checkbox",
        key: "checkbox",
        value: "checked",
        ruleName: isNewsletter && !isTerms ? "newsletterCheckbox" : "termsCheckbox",
        confidence: isNewsletter && !isTerms ? "review" : "high"
      };
    }

    /**
     * Work out everything that would be touched, without touching any of it.
     * Both scan() (the popup's live count) and run() go through this, so the
     * number in the popup always matches what a fill actually does.
     */
    async function plan() {
      const state = await loadState();
      const { profile, settings } = state;

      /* Site overrides run first and beat every generic rule. */
      const siteOverrides = overridesForHost(state.overrides);
      const overridden = new Map();
      for (const selector of Object.keys(siteOverrides)) {
        let nodes = [];
        try {
          nodes = Array.from(document.querySelectorAll(selector));
        } catch (_) {
          console.warn("[QuickFill] bad override selector:", selector);
          continue;
        }
        nodes.forEach((n) => overridden.set(n, siteOverrides[selector]));
      }

      const candidates = collectCandidates();

      /* Pre-pass: does this form carry a separate country-code box? */
      let hasCountryCodeField = false;
      for (const el of candidates) {
        if (el.type === "checkbox" || el.type === "radio") continue;
        if (isCountryCodeField(buildContext(el))) {
          hasCountryCodeField = true;
          break;
        }
      }

      const items = [];
      for (const el of candidates) {
        const ctx = buildContext(el);

        if (el.tagName === "INPUT" && ctx.type === "checkbox") {
          const cb = planCheckbox(el, ctx, settings);
          if (cb) items.push(cb);
          continue;
        }

        if (skipReason(el, ctx.hay, settings)) continue;

        const override = overridden.get(el);
        let key, confidence, ruleName;

        if (override) {
          key = override;
          confidence = "high";
          ruleName = "site override";
        } else {
          const match = matchRule(ctx);
          if (!match) continue;
          key = match.rule.valueKey;
          confidence = match.confidence;
          ruleName = match.rule.key;
        }

        const value = resolveValue(key, ctx, profile, hasCountryCodeField);
        if (!value) continue;

        items.push({
          el,
          ctx,
          kind: ctx.isSelect ? "select" : "text",
          key,
          value,
          ruleName,
          confidence
        });
      }

      return { items, state };
    }

    function frameInfo() {
      return { frame: location.href, isTop: window.top === window };
    }

    /** Non-destructive: how many fields would this frame fill? */
    async function scan() {
      try {
        const { items } = await plan();
        return Object.assign(
          { detected: items.length, filled: 0, review: 0, frames: 1 },
          frameInfo()
        );
      } catch (err) {
        console.warn("[QuickFill] scan failed:", err);
        return Object.assign({ detected: 0, filled: 0, review: 0, frames: 1 }, frameInfo());
      }
    }

    async function run(options) {
      const opts = options || {};
      const dryRun = !!opts.dryRun;
      const showToast = opts.showToast !== false;

      const { items, state } = await plan();
      const rows = [];
      let filled = 0;
      let review = 0;

      for (const item of items) {
        let wrote = true;

        if (!dryRun) {
          if (item.kind === "select") wrote = setSelectValue(item.el, item.value, item.key);
          else if (item.kind === "checkbox") tickCheckbox(item.el);
          else setValue(item.el, item.value);
        }

        if (!wrote) {
          /* A <select> with no option resembling the profile value. */
          rows.push({
            field: describe(item.el),
            rule: item.ruleName,
            key: item.key,
            value: "(no matching option)",
            confidence: "skipped",
            element: item.el
          });
          continue;
        }

        filled++;
        if (item.confidence === "review") review++;
        highlight(item.el, item.confidence);

        rows.push({
          field: describe(item.el),
          rule: item.ruleName,
          key: item.key,
          value: item.key === "password" ? "•".repeat(String(item.value).length) : item.value,
          confidence: item.confidence,
          element: item.el
        });
      }

      logTable(rows, dryRun, state.activeProfile);

      const summary = Object.assign(
        { detected: filled, filled, review, frames: 1 },
        frameInfo()
      );
      if (showToast) summaryToast(summary, dryRun);
      return summary;
    }

    function logTable(rows, dryRun, profileName) {
      try {
        const label =
          "[QuickFill Affiliate] " +
          (dryRun ? "highlight-only" : "fill") +
          " · profile: " + profileName +
          " · " + location.href;
        console.groupCollapsed(label);
        if (rows.length) {
          console.table(
            rows.map((r) => ({
              field: r.field,
              rule: r.rule,
              "profile key": r.key,
              "value written": r.value,
              confidence: r.confidence
            }))
          );
          rows.forEach((r) => console.log(r.confidence, r.rule, r.element));
        } else {
          console.log("No fields matched. Open the options page to add a site override.");
        }
        console.groupEnd();
      } catch (_) {}
    }

    /* ================================================================== *
     * 10. Public API + auto-fill on load
     * ================================================================== */

    window.__QFA = {
      version: VERSION,
      FIELD_RULES,
      scan,
      run,
      summaryToast,
      toast
    };

    /* "Fill on page load automatically" (default off). */
    (async () => {
      try {
        const state = await loadState();
        if (!state.settings.fillOnLoad) return;
        setTimeout(() => { run({ showToast: window.top === window }); }, 600);
      } catch (_) {}
    })();
  })();
} catch (err) {
  console.error("[QuickFill Affiliate] content script error:", err);
}
