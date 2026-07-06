/**
 * Anti-Matter theme: single toggle button (E-Ink Studio style).
 * "Auto" (follow Home Assistant) is the persistent default, set via the add-on
 * `theme` option. Clicking the button overrides light/dark for this session only —
 * reloading the page returns to Auto. No dropdown, no localStorage persistence.
 */
(function () {
  var _override = null; // session-only; null = follow Auto
  var _current = null;

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function luminance(color) {
    if (!color) return null;
    var c = String(color).trim();
    var r, g, b;
    if (c.charAt(0) === "#") {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length < 6) return null;
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      var m = c.match(/[\d.]+/g);
      if (!m || m.length < 3) return null;
      r = +m[0]; g = +m[1]; b = +m[2];
    }
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // Probe the browser's resolved color-scheme (HA propagates it into the ingress iframe).
  function detectFromCanvas() {
    if (!document.body) return null;
    try {
      var el = document.createElement("div");
      el.style.cssText =
        "position:absolute;left:-9999px;width:1px;height:1px;" +
        "background-color:Canvas;color-scheme:light dark;";
      document.body.appendChild(el);
      var bg = getComputedStyle(el).backgroundColor;
      document.body.removeChild(el);
      var lum = luminance(bg);
      if (lum != null) return lum < 0.5 ? "dark" : "light";
    } catch (e) { /* ignore */ }
    return null;
  }

  // Read HA's own background var from the parent/top frame (same-origin under ingress).
  function detectFromHAVar() {
    var frames = [];
    try { if (window.parent && window.parent !== window) frames.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window && window.top !== window.parent) frames.push(window.top); } catch (e) {}
    for (var i = 0; i < frames.length; i++) {
      try {
        var doc = frames[i].document;
        if (!doc) continue;
        var v = getComputedStyle(doc.documentElement)
          .getPropertyValue("--primary-background-color");
        var lum = luminance((v || "").trim());
        if (lum != null) return lum < 0.5 ? "dark" : "light";
      } catch (e) { /* cross-origin — skip */ }
    }
    return null;
  }

  function haTheme() {
    return detectFromCanvas() || detectFromHAVar() || systemTheme();
  }

  // Follow HA's --accent-color / --primary-color (same as E-Ink Studio). Inline on
  // <html> so they win over the token stylesheet; removed when HA exposes none.
  var _haColKey = null;
  function readHAColors() {
    var frames = [];
    try { if (window.parent && window.parent !== window) frames.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window && frames.indexOf(window.top) === -1) frames.push(window.top); } catch (e) {}
    for (var i = 0; i < frames.length; i++) {
      try {
        var cs = getComputedStyle(frames[i].document.documentElement);
        var acc = (cs.getPropertyValue("--accent-color") || "").trim();
        var pri = (cs.getPropertyValue("--primary-color") || "").trim();
        if (acc || pri) return { accent: acc, primary: pri };
      } catch (e) { /* cross-origin — skip */ }
    }
    return { accent: "", primary: "" };
  }
  function applyHAColors() {
    var c = readHAColors();
    var key = c.accent + "|" + c.primary;
    if (key === _haColKey) return;
    _haColKey = key;
    var s = document.documentElement.style;
    var accent = c.accent || c.primary;
    if (accent) {
      s.setProperty("--rm-accent", accent);
      s.setProperty("--rm-accent-2", accent);
      s.setProperty("--rm-accent-hover", "color-mix(in srgb, " + accent + " 82%, #000)");
      s.setProperty("--rm-accent-soft", "color-mix(in srgb, " + accent + " 14%, transparent)");
      s.setProperty("--rm-border-focus", "color-mix(in srgb, " + accent + " 55%, transparent)");
      s.setProperty("--rm-glow", "color-mix(in srgb, " + accent + " 24%, transparent)");
      s.setProperty("--rm-glow-strong", "color-mix(in srgb, " + accent + " 38%, transparent)");
      s.setProperty("--rm-brand-start", accent);
      s.setProperty("--rm-brand-end", "color-mix(in srgb, " + accent + " 82%, #000)");
      var l = luminance(accent);
      s.setProperty("--rm-text-inverse", (l !== null && l < 0.6) ? "#ffffff" : "#1a1407");
    } else {
      [
        "--rm-accent", "--rm-accent-2", "--rm-accent-hover", "--rm-accent-soft",
        "--rm-border-focus", "--rm-glow", "--rm-glow-strong",
        "--rm-brand-start", "--rm-brand-end", "--rm-text-inverse",
      ].forEach(function (p) { s.removeProperty(p); });
    }
  }

  function resolve() {
    if (_override === "light" || _override === "dark") return _override;
    if (window.ADDON_THEME === "light" || window.ADDON_THEME === "dark") return window.ADDON_THEME;
    return haTheme();
  }

  function updateButton(resolved) {
    var label = document.getElementById("btn-theme-label");
    var btn = document.getElementById("btn-theme");
    // Icon is a static yin-yang glyph (E-Ink Studio style) — only the word toggles.
    if (label) {
      var key = resolved === "dark" ? "theme.dark" : "theme.light";
      label.setAttribute("data-i18n", key);
      if (window.AntiMatterI18n) label.textContent = window.AntiMatterI18n.t(key);
    }
    if (btn) btn.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
  }

  function apply() {
    var resolved = resolve();
    _current = resolved;
    document.documentElement.setAttribute("data-theme", resolved);
    updateButton(resolved);
  }

  function toggle() {
    _override = resolve() === "dark" ? "light" : "dark";
    apply();
  }

  function bindButton() {
    var btn = document.getElementById("btn-theme");
    if (btn) btn.addEventListener("click", toggle);
  }

  // Re-apply on OS theme change while following Auto.
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", function () {
    if (!_override) apply();
  });

  // Track live HA theme switches while following Auto.
  function startPolling() {
    setInterval(function () {
      applyHAColors();
      if (_override) return;
      var next = resolve();
      if (next !== _current) apply();
    }, 800);
  }

  // Pull the add-on `theme` option; if the user hasn't overridden it, use it.
  function applyAddonTheme() {
    fetch("./api/info")
      .then(function (r) { return r.json(); })
      .then(function (info) {
        window.ADDON_THEME = info && info.theme ? info.theme : "auto";
        if (!_override) apply();
      })
      .catch(function () { /* ignore */ });
  }

  window.addEventListener("antimatter:locale", function () {
    if (_current) updateButton(_current);
  });

  function init() {
    apply();
    applyHAColors();
    bindButton();
    applyAddonTheme();
    startPolling();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AntiMatterTheme = { toggle: toggle, get: function () { return _current; } };
})();
