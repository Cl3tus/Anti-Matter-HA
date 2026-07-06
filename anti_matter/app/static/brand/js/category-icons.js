/**
 * Category icons via Material Design Icons (bundled webfont, offline).
 * Icons are stored as bare MDI names (e.g. "home", "lightbulb"); rendered as
 * <i class="mdi mdi-<name>">. The picker searches the full MDI set.
 */
(function (global) {
  const DEFAULT_ICON = "folder";

  // A small curated set shown before the user searches.
  const COMMON = [
    "folder", "home", "lightbulb", "lamp", "ceiling-light", "led-strip",
    "power-plug", "toggle-switch", "lock", "door", "window-closed-variant",
    "blinds", "garage", "thermometer", "water", "fan", "air-conditioner",
    "television", "speaker", "cctv", "motion-sensor", "gauge", "battery",
    "wifi", "router-network", "remote", "sofa", "bed", "fridge",
    "washing-machine", "stove", "shower", "flower", "tree", "car",
    "key", "shield-home", "leaf", "weather-night", "white-balance-sunny",
    "star", "heart", "cog", "tag", "package-variant", "map-marker",
  ];

  function normalizeIconId(value) {
    let id = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^mdi[:-]/, "")
      .replace(/[^a-z0-9-]/g, "");
    return id || DEFAULT_ICON;
  }

  function iconMarkup(iconId) {
    const id = normalizeIconId(iconId);
    return `<i class="mdi mdi-${id} category-icon-mdi" aria-hidden="true"></i>`;
  }

  function markMarkup(cat) {
    const color = cat?.color || "#c9791a";
    const icon = normalizeIconId(cat?.icon);
    return `<span class="category-mark" style="--cat-color:${color}" title="${icon}">${iconMarkup(icon)}</span>`;
  }

  // Lazily load + cache the full MDI name list from the bundled CSS.
  function loadIconNames(vendorBase) {
    if (global.__mdiNames) return global.__mdiNames;
    const url = `${vendorBase}/mdi/css/materialdesignicons.min.css`;
    global.__mdiNames = fetch(url)
      .then((r) => r.text())
      .then((css) => {
        const names = new Set();
        const re = /\.mdi-([a-z0-9-]+)::before/g;
        let m;
        while ((m = re.exec(css)) !== null) names.add(m[1]);
        return Array.from(names);
      })
      .catch(() => COMMON.slice());
    return global.__mdiNames;
  }

  function mountPicker(container, options) {
    if (!container) return;
    const brandPrefix = options.brandPrefix || "/brand";
    const vendorBase = brandPrefix.replace(/\/brand\/?$/, "/vendor");
    const hiddenInput = options.hiddenInput;
    const placeholder = options.searchPlaceholder || "Search icons…";
    let selected = normalizeIconId(options.value || DEFAULT_ICON);
    let allNames = null;

    container.innerHTML = "";
    container.classList.add("category-icon-picker");
    const search = document.createElement("input");
    search.type = "search";
    search.className = "mdi-picker-search";
    search.placeholder = placeholder;
    const grid = document.createElement("div");
    grid.className = "mdi-picker-grid";
    container.appendChild(search);
    container.appendChild(grid);

    function renderGrid(names) {
      grid.innerHTML = "";
      const list = names.slice(0, 140);
      for (const name of list) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "category-icon-option";
        btn.dataset.icon = name;
        btn.title = name;
        btn.setAttribute("aria-label", name);
        btn.innerHTML = iconMarkup(name);
        btn.onclick = () => setSelected(name, true);
        grid.appendChild(btn);
      }
      highlight();
    }

    function highlight() {
      grid.querySelectorAll(".category-icon-option").forEach((el) => {
        el.classList.toggle("selected", el.dataset.icon === selected);
      });
    }

    function defaultNames() {
      const set = [];
      if (selected && !COMMON.includes(selected)) set.push(selected);
      return set.concat(COMMON);
    }

    function applyFilter(q) {
      q = q.trim().toLowerCase();
      if (!q) {
        renderGrid(defaultNames());
        return;
      }
      const src = allNames || COMMON;
      const starts = [];
      const contains = [];
      for (const n of src) {
        if (n.startsWith(q)) starts.push(n);
        else if (n.includes(q)) contains.push(n);
        if (starts.length >= 140) break;
      }
      renderGrid(starts.concat(contains));
    }

    function setSelected(iconId, notify) {
      selected = normalizeIconId(iconId);
      if (hiddenInput) hiddenInput.value = selected;
      highlight();
      if (notify && typeof options.onChange === "function") {
        options.onChange(selected);
      }
    }

    let timer = null;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => applyFilter(search.value), 120);
    });

    renderGrid(defaultNames());
    loadIconNames(vendorBase).then((names) => {
      allNames = names;
    });

    return {
      getValue: () => selected,
      setValue: (id) => {
        setSelected(id, false);
        search.value = "";
        renderGrid(defaultNames());
      },
    };
  }

  global.AntiMatterCategoryIcons = {
    DEFAULT_ICON,
    normalizeIconId,
    iconMarkup,
    markMarkup,
    mountPicker,
  };
})(typeof window !== "undefined" ? window : globalThis);
