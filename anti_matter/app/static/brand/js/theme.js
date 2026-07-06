/**
 * AntiMatter theme: light | dark | auto.
 * "auto" matches Home Assistant's light/dark setting (canvas color-scheme probe,
 * then HA's --primary-background-color from the parent frame, then OS preference).
 * The add-on `theme` option (auto|light|dark) is the default until the user picks
 * one in the dropdown. Preference key: antimatter-theme
 */
(function () {
  var STORAGE_KEY = "antimatter-theme";
  var CHOSEN_KEY = "antimatter-theme-chosen";
  var MODES = ["light", "dark", "auto"];
  var ICON_IDS = {
    light: "rm-icon-sun",
    dark: "rm-icon-moon",
    auto: "rm-icon-auto",
  };

  function chosen() {
    try {
      return localStorage.getItem(CHOSEN_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function normalizeMode(v) {
    return MODES.indexOf(v) >= 0 ? v : "auto";
  }

  function getStored() {
    try {
      return normalizeMode(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return "auto";
    }
  }

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function luminance(color) {
    if (!color) return null;
    var m = color.match(/rgba?\(([^)]+)\)/i);
    if (!m) return null;
    var parts = m[1].split(",").map(function (x) {
      return parseFloat(x.trim());
    });
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return (0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]) / 255;
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

  function resolve(mode) {
    return mode === "auto" ? haTheme() : mode;
  }

  function apply(mode) {
    mode = normalizeMode(mode);
    var resolved = resolve(mode);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-mode", mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) { /* ignore */ }
    updateToggleUI(mode);
  }

  function updateToggleUI(mode) {
    document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
      var active = btn.getAttribute("data-theme-set") === mode;
      btn.classList.toggle("is-active", active);
      if (btn.getAttribute("role") === "option") {
        btn.setAttribute("aria-selected", active ? "true" : "false");
      } else {
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      }
    });
    document.querySelectorAll("[data-theme-dropdown]").forEach(function (root) {
      var use = root.querySelector(".theme-dropdown-use");
      if (!use) return;
      var base = root.getAttribute("data-icons-href") || "/brand/icons.svg";
      var id = ICON_IDS[mode] || ICON_IDS.auto;
      use.setAttribute("href", base + "#" + id);
    });
  }

  function clearMenuPosition(menu) {
    menu.classList.remove("theme-dropdown-menu--open");
    menu.style.position = "";
    menu.style.top = "";
    menu.style.left = "";
    menu.style.right = "";
    menu.style.minWidth = "";
    menu.style.zIndex = "";
  }

  function positionMenu(menu, trigger) {
    var rect = trigger.getBoundingClientRect();
    var gap = 6;
    menu.classList.add("theme-dropdown-menu--open");
    menu.style.position = "fixed";
    menu.style.top = rect.bottom + gap + "px";
    menu.style.right = Math.max(8, window.innerWidth - rect.right) + "px";
    menu.style.left = "auto";
    menu.style.minWidth = Math.max(rect.width, 152) + "px";
    menu.style.zIndex = "1000";
  }

  function closeAllDropdowns() {
    document.querySelectorAll("[data-theme-dropdown]").forEach(function (root) {
      var menu = root.querySelector(".theme-dropdown-menu");
      var trigger = root.querySelector(".theme-dropdown-trigger");
      if (!menu || !trigger) return;
      menu.hidden = true;
      clearMenuPosition(menu);
      trigger.setAttribute("aria-expanded", "false");
    });
  }

  function toggleDropdown(root) {
    var menu = root.querySelector(".theme-dropdown-menu");
    var trigger = root.querySelector(".theme-dropdown-trigger");
    if (!menu || !trigger) return;
    var open = menu.hidden;
    closeAllDropdowns();
    if (open) {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      positionMenu(menu, trigger);
    }
  }

  function bindToggles() {
    document.querySelectorAll("[data-theme-set]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        try { localStorage.setItem(CHOSEN_KEY, "1"); } catch (err) {}
        apply(btn.getAttribute("data-theme-set"));
        closeAllDropdowns();
      });
    });

    document.querySelectorAll(".theme-dropdown-trigger").forEach(function (trigger) {
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var root = trigger.closest("[data-theme-dropdown]");
        if (root) toggleDropdown(root);
      });
    });

    document.querySelectorAll(".theme-dropdown-menu").forEach(function (menu) {
      menu.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    });

    document.addEventListener("click", function () {
      closeAllDropdowns();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllDropdowns();
    });

    window.addEventListener("resize", closeAllDropdowns);
    window.addEventListener("scroll", function () { closeAllDropdowns(); }, true);
  }

  // Re-apply on OS theme change while in auto.
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", function () {
    if (getStored() === "auto") apply("auto");
  });

  // Track live HA theme switches while in auto.
  function startPolling() {
    var last = document.documentElement.getAttribute("data-theme");
    setInterval(function () {
      if (getStored() !== "auto") return;
      var next = resolve("auto");
      if (next !== last) {
        last = next;
        apply("auto");
      }
    }, 1000);
  }

  // Pull the add-on `theme` option; if the user hasn't picked one, use it.
  function applyAddonTheme() {
    fetch("./api/info")
      .then(function (r) { return r.json(); })
      .then(function (info) {
        window.ADDON_THEME = info && info.theme ? info.theme : "auto";
        if (!chosen()) apply(normalizeMode(window.ADDON_THEME));
      })
      .catch(function () { /* ignore */ });
  }

  function init() {
    apply(chosen() ? getStored() : "auto");
    bindToggles();
    applyAddonTheme();
    startPolling();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AntiMatterTheme = { apply: apply, get: getStored };
})();
