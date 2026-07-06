/**
 * Category icon picker (Lucide, bundled offline — see /brand/category-icons/LICENSE).
 */
(function (global) {
  const DEFAULT_ICON = "folder";

  function normalizeIconId(value) {
    const id = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    return id || DEFAULT_ICON;
  }

  function iconUrl(iconId, brandPrefix) {
    const prefix = brandPrefix || "/brand";
    return `${prefix}/category-icons/${normalizeIconId(iconId)}.svg`;
  }

  function spriteUrl(brandPrefix) {
    const prefix = brandPrefix || "/brand";
    return `${prefix}/category-icons/category-icons.svg`;
  }

  /** Inline SVG via local sprite (works offline in HA ingress). */
  function iconMarkup(iconId, brandPrefix) {
    const id = normalizeIconId(iconId);
    const href = `${spriteUrl(brandPrefix)}#cat-icon-${id}`;
    return `<svg class="category-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="${href}"/></svg>`;
  }

  function markMarkup(cat, brandPrefix) {
    const color = cat?.color || "#6366f1";
    const icon = normalizeIconId(cat?.icon);
    return `<span class="category-mark" style="--cat-color:${color}" title="${icon}">${iconMarkup(icon, brandPrefix)}</span>`;
  }

  function mountPicker(container, options) {
    if (!container) return;
    const brandPrefix = options.brandPrefix || "/brand";
    const hiddenInput = options.hiddenInput;
    const initial = normalizeIconId(options.value || DEFAULT_ICON);
    let selected = initial;

    const manifestUrl = `${brandPrefix}/category-icons/manifest.json`;
    fetch(manifestUrl)
      .then((r) => r.json())
      .then((data) => {
        const icons = Array.isArray(data.icons) ? data.icons : [];
        renderGrid(icons);
        setSelected(initial, false);
      })
      .catch(() => {
        renderGrid([{ id: DEFAULT_ICON, label: "Folder" }]);
        setSelected(initial, false);
      });

    function renderGrid(icons) {
      container.innerHTML = "";
      container.classList.add("category-icon-picker");
      for (const item of icons) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "category-icon-option";
        btn.dataset.icon = item.id;
        btn.title = item.label || item.id;
        btn.setAttribute("aria-label", item.label || item.id);
        btn.innerHTML = iconMarkup(item.id, brandPrefix);
        btn.onclick = () => setSelected(item.id, true);
        container.appendChild(btn);
      }
    }

    function setSelected(iconId, notify) {
      selected = normalizeIconId(iconId);
      if (hiddenInput) hiddenInput.value = selected;
      container.querySelectorAll(".category-icon-option").forEach((el) => {
        el.classList.toggle("selected", el.dataset.icon === selected);
      });
      if (notify && typeof options.onChange === "function") {
        options.onChange(selected);
      }
    }

    return {
      getValue: () => selected,
      setValue: (id) => setSelected(id, true),
    };
  }

  global.AntiMatterCategoryIcons = {
    DEFAULT_ICON,
    normalizeIconId,
    iconUrl,
    spriteUrl,
    iconMarkup,
    markMarkup,
    mountPicker,
  };
})(typeof window !== "undefined" ? window : globalThis);
