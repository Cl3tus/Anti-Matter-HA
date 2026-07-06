/**
 * Anti-Matter UI translations. Default locale: en.
 * Auto (follow Home Assistant, then the browser) is the persistent default, set
 * via the add-on `language` option. A single toggle button overrides the language
 * for this session only — reloading the page returns to Auto. No dropdown.
 * Set window.ANTIMATTER_LOCALE_BASE before load (e.g. "./static/locales/").
 */
(function (global) {
  const DEFAULT_LOCALE = "en";
  const SUPPORTED = ["en", "nl"];
  const LOCALE_LABELS = { en: "EN", nl: "NL" };
  // Inline flag SVGs (E-Ink Studio style) so the flag isn't at the mercy of the
  // OS emoji font's colour palette.
  const LOCALE_FLAGS = {
    en:
      '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true">' +
      '<clipPath id="am-flag-uk-s"><path d="M0,0 v30 h60 v-30 z"/></clipPath>' +
      '<clipPath id="am-flag-uk-t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>' +
      '<g clip-path="url(#am-flag-uk-s)">' +
      '<path d="M0,0 v30 h60 v-30 z" fill="#012169"/>' +
      '<path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>' +
      '<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#am-flag-uk-t)" stroke="#c8102e" stroke-width="4"/>' +
      '<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>' +
      '<path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6"/>' +
      "</g></svg>",
    nl:
      '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true">' +
      '<rect width="60" height="10" y="0" fill="#AE1C28"/>' +
      '<rect width="60" height="10" y="10" fill="#ffffff"/>' +
      '<rect width="60" height="10" y="20" fill="#21468B"/>' +
      "</svg>",
  };

  function localeBase() {
    const base = global.ANTIMATTER_LOCALE_BASE || "/assets/locales/";
    return base.endsWith("/") ? base : base + "/";
  }

  let locale = DEFAULT_LOCALE;
  let strings = {};
  let _override = null; // session-only manual toggle

  function t(key, vars) {
    let text = strings[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  }

  function readHALang() {
    const frames = [];
    try { if (global.parent && global.parent !== global) frames.push(global.parent); } catch (e) {}
    try { if (global.top && global.top !== global && frames.indexOf(global.top) === -1) frames.push(global.top); } catch (e) {}
    for (let i = 0; i < frames.length; i++) {
      try {
        const lang = String(frames[i].document.documentElement.lang || "").toLowerCase();
        if (lang.startsWith("nl")) return "nl";
        if (lang.startsWith("en")) return "en";
      } catch (e) { /* cross-origin — skip */ }
    }
    return null;
  }

  function resolveLocale(requested) {
    if (requested && SUPPORTED.includes(requested)) return requested;
    if (_override) return _override;
    const param = new URLSearchParams(location.search).get("lang");
    if (param && SUPPORTED.includes(param)) return param;
    // Add-on option (auto | nl | en) set from /api/info.
    const addon = String(global.ADDON_LANGUAGE || "auto").toLowerCase();
    if (SUPPORTED.includes(addon)) return addon;
    // Follow Home Assistant's UI language (parent frame <html lang>).
    const haLang = readHALang();
    if (haLang) return haLang;
    // Autodetect from the browser.
    const nav = String(navigator.language || "en").toLowerCase();
    if (nav.startsWith("nl")) return "nl";
    return DEFAULT_LOCALE;
  }

  async function loadLocaleFile(code) {
    const res = await fetch(`${localeBase()}${code}.json`);
    if (!res.ok) throw new Error(`Locale ${code} not found`);
    return res.json();
  }

  function applyToDom() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.title = t(key);
    });
    document.querySelectorAll("[data-i18n-tip]").forEach((el) => {
      const key = el.getAttribute("data-i18n-tip");
      if (key) {
        const text = t(key);
        el.setAttribute("data-tip", text);
        el.setAttribute("aria-label", text);
      }
    });
    updateLangButton();
  }

  function updateLangButton() {
    const flag = document.getElementById("btn-lang-flag");
    const label = document.getElementById("btn-lang-label");
    if (flag) flag.innerHTML = LOCALE_FLAGS[locale] || LOCALE_FLAGS.en;
    if (label) label.textContent = LOCALE_LABELS[locale] || "EN";
  }

  async function setLocale(next) {
    locale = resolveLocale(next);
    document.documentElement.lang = locale;
    try {
      strings = await loadLocaleFile(locale);
    } catch {
      strings = await loadLocaleFile(DEFAULT_LOCALE);
      locale = DEFAULT_LOCALE;
    }
    applyToDom();
    refreshDynamicUi();
    global.dispatchEvent(new CustomEvent("antimatter:locale", { detail: { locale } }));
  }

  function toggleLocale() {
    _override = locale === "nl" ? "en" : "nl";
    setLocale(_override);
  }

  function bindButton() {
    const btn = document.getElementById("btn-lang");
    if (btn) btn.addEventListener("click", toggleLocale);
  }

  function refreshDynamicUi() {
    if (typeof global.AntiMatterUI?.refreshBackupStatus === "function") {
      global.AntiMatterUI.refreshBackupStatus();
    }
  }

  async function initI18n() {
    bindButton();
    locale = resolveLocale();
    document.documentElement.lang = locale;
    try {
      strings = await loadLocaleFile(locale);
    } catch {
      strings = await loadLocaleFile(DEFAULT_LOCALE);
      locale = DEFAULT_LOCALE;
      document.documentElement.lang = locale;
    }
    applyToDom();
    refreshDynamicUi();
  }

  global.AntiMatterI18n = {
    t,
    initI18n,
    setLocale,
    toggleLocale,
    getLocale: () => locale,
    SUPPORTED,
    LOCALE_LABELS,
    LOCALE_FLAGS,
  };
})(window);
