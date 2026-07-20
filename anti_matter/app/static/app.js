/**
 * AntiMatter admin UI — relative API paths for HA ingress.
 */
const API = "./api";
const { t, initI18n, setLocale } = window.AntiMatterI18n;

let vault = { categories: [], codes: [] };
let activeCategories = new Set();

// HA integration state, filled by loadAddonInfo / loadHaDevices.
let haAvailable = false;
let haDevices = []; // [{id, name, area}] from /api/ha/devices
let haDeviceById = new Map(); // id -> device
let haDisplayToId = new Map(); // datalist display string -> id

// Multi-select for bulk delete (shift/ctrl+click) — separate from the filter
// selection above and from the category "active" filter state.
let selectedCodeIds = new Set();
let lastSelectedCodeIndex = null;
let selectedCategoryIds = new Set();
let lastSelectedCategoryIndex = null;
let categoryIconPicker = null;
const NONE_CATEGORY_ID = "__none__";
// Set right before opening the category dialog from the "+" inside the code form,
// so the freshly created category gets selected there instead of just in the sidebar list.
let categoryCreateTargetSelectId = null;

const BRAND_PREFIX = "./static/brand";

function ensureCategoryIconPicker() {
  if (categoryIconPicker) return categoryIconPicker;
  const Icons = window.AntiMatterCategoryIcons;
  const host = document.getElementById("category-icon-picker");
  const input = document.getElementById("category-icon");
  if (!Icons || !host || !input) return null;
  categoryIconPicker = Icons.mountPicker(host, {
    brandPrefix: BRAND_PREFIX,
    hiddenInput: input,
    searchPlaceholder: t("icons.search"),
  });
  return categoryIconPicker;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // detail is either a plain string, or {message, existing} for duplicate-code 409s.
    const detail = err.detail;
    const message = typeof detail === "string" ? detail : detail?.message;
    const e = new Error(message || res.statusText);
    e.status = res.status;
    e.existing = typeof detail === "object" ? detail?.existing : undefined;
    throw e;
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

// Fire-and-forget log line for client-only state the server has no other way to see
// (view mode, QR invert, resolved theme/language, scan captured). Never send raw codes.
function logEvent(message) {
  api("/log", { method: "POST", body: JSON.stringify({ message }) }).catch(() => {});
}

let lastVaultJson = "";

async function loadVault() {
  vault = await api("/vault");
  lastVaultJson = JSON.stringify(vault);
  selectedCodeIds.clear();
  lastSelectedCodeIndex = null;
  selectedCategoryIds.clear();
  lastSelectedCategoryIndex = null;
  render();
}

// Category names are stored exactly as typed (matching is already case-insensitive,
// see _find_category_by_name in main.py) — only capitalized for display.
function capitalizeFirst(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function categoryName(id) {
  if (window.AntiMatterVaultCards) {
    return capitalizeFirst(window.AntiMatterVaultCards.categoryNameDefault(vault, id));
  }
  const c = vault.categories.find((x) => x.id === id);
  return c ? capitalizeFirst(c.name) : "Uncategorized";
}

function categoryNamesJoined(ids) {
  const list = Array.isArray(ids) ? ids : [];
  if (!list.length) return categoryName(null);
  return list.map((id) => categoryName(id)).join(", ");
}

// Every toolbar filter is a checkbox dropdown: within one field, checked values
// are OR'd together; across fields, results are AND'd.
const DYNAMIC_FILTER_FIELDS = [
  ["filter-vendor", "device_vendor", "filter.vendor"],
  ["filter-product", "device_product", "filter.product"],
  ["filter-type", "device_type", "filter.type"],
  ["filter-area", "area", "filter.area"],
];
const dynamicFilters = {
  device_vendor: new Set(),
  device_product: new Set(),
  device_type: new Set(),
  area: new Set(),
};

const PROTOCOL_FILTER_OPTIONS = [
  ["matter", "code.protocol_matter"],
  ["homekit", "code.protocol_homekit"],
  ["zwave", "code.protocol_zwave"],
];
const protocolFilter = new Set();

// In-use is exclusive (All/Yes/No), unlike every other filter — a code can't be both
// in-use and not, so OR-ing checkboxes here wouldn't mean anything.
const IN_USE_FILTER_OPTIONS = [
  ["", "filter.all_short"],
  ["yes", "filter.yes"],
  ["no", "filter.no"],
];
let inUseFilterValue = "";

const CONN_FILTER_FIELDS = [
  ["conn_wifi", "code.conn_wifi"],
  ["conn_matter", "code.conn_matter"],
  ["conn_zigbee", "code.conn_zigbee"],
  ["conn_bluetooth", "code.conn_bluetooth"],
  ["conn_zwave", "code.conn_zwave"],
];
// Pseudo-field: "none of the 5 connectivity types are set" — not a real code field,
// so filteredCodes() special-cases it instead of checking c[CONN_EMPTY_VALUE].
const CONN_EMPTY_VALUE = "__conn_empty__";
const connFilters = new Set();

function filterToggleLabel(baseLabel, count) {
  return count ? `${baseLabel} (${count})` : baseLabel;
}

// options: array of [value, alreadyTranslatedLabel] pairs.
function renderCheckboxFilterPanel(panelId, toggleId, baseLabelKey, options, selectedSet) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  const baseLabel = t(baseLabelKey);
  if (panel) {
    if (!options.length) {
      panel.innerHTML = `<p class="form-hint">${escapeHtml(t("filter.no_options"))}</p>`;
    } else {
      panel.innerHTML = options
        .map(
          ([value, label]) =>
            `<label><input type="checkbox" value="${escapeHtml(value)}" ${selectedSet.has(value) ? "checked" : ""} /> <span>${escapeHtml(label)}</span></label>`
        )
        .join("");
      panel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.onchange = () => {
          if (cb.checked) selectedSet.add(cb.value);
          else selectedSet.delete(cb.value);
          if (toggle) toggle.textContent = filterToggleLabel(baseLabel, selectedSet.size);
          renderCodes();
        };
      });
    }
  }
  if (toggle) toggle.textContent = filterToggleLabel(baseLabel, selectedSet.size);
}

// options: array of [value, alreadyTranslatedLabel] pairs. Only one can be selected —
// used for In-use (All/Yes/No), unlike the OR-multi-select checkbox panels above.
function renderRadioFilterPanel(panelId, toggleId, baseLabelKey, options, getValue, setValue) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  const baseLabel = t(baseLabelKey);
  const current = getValue();
  if (panel) {
    panel.innerHTML = options
      .map(
        ([value, label]) =>
          `<label><input type="radio" name="${panelId}-radio" value="${escapeHtml(value)}" ${current === value ? "checked" : ""} /> <span>${escapeHtml(label)}</span></label>`
      )
      .join("");
    panel.querySelectorAll("input[type=radio]").forEach((rb) => {
      rb.onchange = () => {
        setValue(rb.value);
        const opt = options.find(([v]) => v === rb.value);
        if (toggle) toggle.textContent = rb.value && opt ? `${baseLabel}: ${opt[1]}` : baseLabel;
        renderCodes();
      };
    });
  }
  if (toggle) {
    const activeOpt = options.find(([v]) => v === current);
    toggle.textContent = current && activeOpt ? `${baseLabel}: ${activeOpt[1]}` : baseLabel;
  }
}

function fillDynamicFilterPanels() {
  for (const [idPrefix, field, labelKey] of DYNAMIC_FILTER_FIELDS) {
    const rawValues = vault.codes.map((c) => (c[field] || "").trim());
    const hasEmpty = rawValues.some((v) => !v);
    const values = Array.from(new Set(rawValues.filter(Boolean))).sort((a, b) => a.localeCompare(b));
    // "" (empty) is itself a valid entry in the selected-values Set — no code above
    // needs to special-case it, since filteredCodes() just checks Set membership
    // against each code's (possibly empty) trimmed field value.
    for (const v of [...dynamicFilters[field]]) {
      if (v !== "" && !values.includes(v)) dynamicFilters[field].delete(v);
      if (v === "" && !hasEmpty) dynamicFilters[field].delete(v);
    }
    const options = values.map((v) => [v, v]);
    if (hasEmpty) options.unshift(["", t("filter.empty")]);
    renderCheckboxFilterPanel(
      `${idPrefix}-panel`,
      `${idPrefix}-toggle`,
      labelKey,
      options,
      dynamicFilters[field]
    );
  }
}

function fillProtocolFilterPanel() {
  renderCheckboxFilterPanel(
    "filter-protocol-panel",
    "filter-protocol-toggle",
    "code.protocol",
    PROTOCOL_FILTER_OPTIONS.map(([v, key]) => [v, t(key)]),
    protocolFilter
  );
}

function fillInUseFilterPanel() {
  renderRadioFilterPanel(
    "filter-in-use-panel",
    "filter-in-use-toggle",
    "code.in_use",
    IN_USE_FILTER_OPTIONS.map(([v, key]) => [v, t(key)]),
    () => inUseFilterValue,
    (v) => {
      inUseFilterValue = v;
    }
  );
}

function fillConnFilterPanel() {
  renderCheckboxFilterPanel(
    "filter-conn-panel",
    "filter-conn-toggle",
    "code.connectivity",
    [[CONN_EMPTY_VALUE, t("filter.empty")], ...CONN_FILTER_FIELDS.map(([field, key]) => [field, t(key)])],
    connFilters
  );
}

function clearAllFilters() {
  protocolFilter.clear();
  for (const [, field] of DYNAMIC_FILTER_FIELDS) dynamicFilters[field].clear();
  inUseFilterValue = "";
  connFilters.clear();
  fillDynamicFilterPanels();
  fillProtocolFilterPanel();
  fillInUseFilterPanel();
  fillConnFilterPanel();
  document.querySelectorAll(".filter-dropdown-panel").forEach((p) => p.classList.add("hidden"));
  renderCodes();
}

function filteredCodes() {
  let codes = vault.codes;
  if (activeCategories.size) {
    codes = codes.filter((c) => {
      const ids = c.category_ids?.length ? c.category_ids : [NONE_CATEGORY_ID];
      return ids.some((id) => activeCategories.has(id));
    });
  }
  if (protocolFilter.size) {
    const Cards = window.AntiMatterVaultCards;
    codes = codes.filter((c) => protocolFilter.has(Cards?.codeProtocol?.(c) || "matter"));
  }
  for (const [, field] of DYNAMIC_FILTER_FIELDS) {
    const selected = dynamicFilters[field];
    if (selected.size) codes = codes.filter((c) => selected.has((c[field] || "").trim()));
  }
  if (inUseFilterValue === "yes") codes = codes.filter((c) => c.in_use);
  else if (inUseFilterValue === "no") codes = codes.filter((c) => !c.in_use);
  if (connFilters.size) {
    const wantEmpty = connFilters.has(CONN_EMPTY_VALUE);
    const realFields = [...connFilters].filter((f) => f !== CONN_EMPTY_VALUE);
    codes = codes.filter((c) => {
      if (realFields.some((field) => c[field])) return true;
      return wantEmpty && CONN_FILTER_FIELDS.every(([field]) => !c[field]);
    });
  }
  const q = document.getElementById("search").value.trim().toLowerCase();
  if (!q) return codes;
  const hay = (c) =>
    [
      c.name,
      c.device_type,
      c.device_vendor,
      c.device_product,
      c.area,
      c.description,
      c.manual_code,
      c.qr_payload,
      c.notes,
    ]
      .map((x) => (x || "").toLowerCase())
      .join(" ");
  return codes.filter((c) => hay(c).includes(q));
}

// Shift = range-select, Ctrl/Cmd = toggle-select. Plain clicks keep their
// original behavior (category filter toggle; nothing for code cards).
function updateCodeSelectionUi() {
  const bar = document.getElementById("code-selection-bar");
  const count = document.getElementById("code-selection-count");
  if (bar) bar.classList.toggle("hidden", selectedCodeIds.size === 0);
  if (count) count.textContent = t("status.selected", { count: selectedCodeIds.size });
  document.querySelectorAll("#codes-grid .code-card[data-code-id]").forEach((card) => {
    card.classList.toggle("selected", selectedCodeIds.has(card.dataset.codeId));
  });
  document.querySelectorAll("#codes-table-body tr[data-code-id]").forEach((tr) => {
    tr.classList.toggle("selected", selectedCodeIds.has(tr.dataset.codeId));
  });
}

function updateCategorySelectionUi() {
  const bar = document.getElementById("category-selection-bar");
  const count = document.getElementById("category-selection-count");
  if (bar) bar.classList.toggle("hidden", selectedCategoryIds.size === 0);
  if (count) count.textContent = t("status.selected", { count: selectedCategoryIds.size });
  document.querySelectorAll("#category-list .category-btn[data-category-id]").forEach((btn) => {
    btn.classList.toggle("selected-for-delete", selectedCategoryIds.has(btn.dataset.categoryId));
  });
}

function handleCodeSelectClick(e, code, index, orderedCodes) {
  if (e.shiftKey && lastSelectedCodeIndex != null) {
    const [lo, hi] = [lastSelectedCodeIndex, index].sort((a, b) => a - b);
    for (let i = lo; i <= hi; i++) selectedCodeIds.add(orderedCodes[i].id);
  } else {
    if (selectedCodeIds.has(code.id)) selectedCodeIds.delete(code.id);
    else selectedCodeIds.add(code.id);
    lastSelectedCodeIndex = index;
  }
  updateCodeSelectionUi();
}

function handleCategorySelectClick(e, cat, index, orderedCats) {
  if (e.shiftKey && lastSelectedCategoryIndex != null) {
    const [lo, hi] = [lastSelectedCategoryIndex, index].sort((a, b) => a - b);
    for (let i = lo; i <= hi; i++) selectedCategoryIds.add(orderedCats[i].id);
  } else {
    if (selectedCategoryIds.has(cat.id)) selectedCategoryIds.delete(cat.id);
    else selectedCategoryIds.add(cat.id);
    lastSelectedCategoryIndex = index;
  }
  updateCategorySelectionUi();
}

async function deleteSelectedCodes() {
  const ids = [...selectedCodeIds];
  if (!ids.length) return;
  if (!(await uiConfirm(t("confirm.delete_selected", { count: ids.length }), t("action.delete")))) return;
  for (const id of ids) await api(`/codes/${id}`, { method: "DELETE" });
  await loadVault();
}

async function deleteSelectedCategories() {
  const ids = [...selectedCategoryIds];
  if (!ids.length) return;
  if (!(await uiConfirm(t("confirm.delete_selected_categories", { count: ids.length }), t("action.delete")))) return;
  for (const id of ids) await api(`/categories/${id}`, { method: "DELETE" });
  await loadVault();
}

function trashListItemHtml(item, kind) {
  const name = kind === "category" ? capitalizeFirst(item.name) : item.name;
  return `<li>
    <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
    <button type="button" class="rm-btn rm-btn-secondary" data-restore="${escapeHtml(item.id)}" data-kind="${kind}">${escapeHtml(t("action.restore"))}</button>
    <button type="button" class="rm-btn rm-btn-danger" data-purge="${escapeHtml(item.id)}" data-kind="${kind}">${escapeHtml(t("action.delete_forever"))}</button>
  </li>`;
}

async function loadTrash() {
  const trash = await api("/trash");
  const catSection = document.getElementById("trash-categories-section");
  const codeSection = document.getElementById("trash-codes-section");
  const empty = document.getElementById("trash-empty");
  const catList = document.getElementById("trash-category-list");
  const codeList = document.getElementById("trash-code-list");
  if (catList) catList.innerHTML = trash.categories.map((c) => trashListItemHtml(c, "category")).join("");
  if (codeList) codeList.innerHTML = trash.codes.map((c) => trashListItemHtml(c, "code")).join("");
  catSection?.classList.toggle("hidden", trash.categories.length === 0);
  codeSection?.classList.toggle("hidden", trash.codes.length === 0);
  empty?.classList.toggle("hidden", trash.categories.length > 0 || trash.codes.length > 0);
}

async function openTrashDialog() {
  await loadTrash();
  document.getElementById("trash-dialog")?.showModal();
}

function renderCategories() {
  const ul = document.getElementById("category-list");
  ul.innerHTML = "";

  // Virtual "None" group for codes without a category — not editable/deletable.
  const noneLi = document.createElement("li");
  const noneBtn = document.createElement("button");
  noneBtn.type = "button";
  noneBtn.className =
    "category-btn" + (activeCategories.has(NONE_CATEGORY_ID) ? " active" : "");
  noneBtn.innerHTML = `<span class="category-mark" style="--cat-color:var(--rm-text-muted)"><i class="mdi mdi-tag-off-outline category-icon-mdi" aria-hidden="true"></i></span>${escapeHtml(t("categories.none"))}`;
  noneBtn.onclick = () => {
    if (activeCategories.has(NONE_CATEGORY_ID)) activeCategories.delete(NONE_CATEGORY_ID);
    else activeCategories.add(NONE_CATEGORY_ID);
    render();
    closeSidebarOnMobile();
  };
  noneBtn.oncontextmenu = (e) => e.preventDefault();
  noneLi.appendChild(noneBtn);
  ul.appendChild(noneLi);

  const sorted = [...vault.categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
  sorted.forEach((cat, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.categoryId = cat.id;
    btn.className =
      "category-btn" +
      (activeCategories.has(cat.id) ? " active" : "") +
      (selectedCategoryIds.has(cat.id) ? " selected-for-delete" : "");
    const mark = window.AntiMatterCategoryIcons
      ? window.AntiMatterCategoryIcons.markMarkup(cat, BRAND_PREFIX)
      : `<span class="category-dot" style="background:${cat.color}"></span>`;
    btn.innerHTML = `${mark}${escapeHtml(capitalizeFirst(cat.name))}`;
    btn.onclick = (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        handleCategorySelectClick(e, cat, i, sorted);
        return;
      }
      if (activeCategories.has(cat.id)) activeCategories.delete(cat.id);
      else activeCategories.add(cat.id);
      render();
      closeSidebarOnMobile();
    };
    btn.oncontextmenu = (e) => {
      e.preventDefault();
      openCategoryDialog(cat);
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
  updateCategorySelectionUi();
}

function closeSidebarOnMobile() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebar.classList.remove("open");
  document.getElementById("btn-toggle-sidebar")?.setAttribute("aria-expanded", "false");
}

function updateStatusbar(shown) {
  const el = document.getElementById("statusbar-count");
  if (!el) return;
  const total = vault.codes.length;
  el.textContent =
    shown === total
      ? t("status.codes", { count: total })
      : t("status.filtered", { shown, total });
}

const VIEW_MODE_KEY = "antimatter-view-mode";
let viewMode = localStorage.getItem(VIEW_MODE_KEY) === "table" ? "table" : "grid";

const CONN_LABELS = {
  conn_wifi: "WiFi",
  conn_matter: "Thread",
  conn_zigbee: "Zigbee",
  conn_bluetooth: "Bluetooth",
  conn_zwave: "Z-Wave",
};

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function connectivitySummary(c) {
  return Object.keys(CONN_LABELS)
    .filter((k) => c[k])
    .map((k) => CONN_LABELS[k])
    .join(", ");
}

let tableSortKey = null;
let tableSortDir = 1; // 1 = ascending, -1 = descending

const TABLE_SORT_ACCESSORS = {
  name: (c) => c.name || "",
  protocol: (c) => window.AntiMatterVaultCards?.codeProtocol?.(c) || c.code_type || "matter",
  device_vendor: (c) => c.device_vendor || "",
  device_product: (c) => c.device_product || "",
  device_type: (c) => c.device_type || "",
  area: (c) => c.area || "",
  categories: (c) => categoryNamesJoined(c.category_ids),
  in_use: (c) => (c.in_use ? 1 : 0),
  connectivity: (c) => connectivitySummary(c),
  added_at: (c) => c.created_at || "",
};

function sortTableCodes(codes) {
  const accessor = tableSortKey && TABLE_SORT_ACCESSORS[tableSortKey];
  if (!accessor) return codes;
  return [...codes].sort((a, b) => {
    const va = accessor(a);
    const vb = accessor(b);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * tableSortDir;
    return String(va).localeCompare(String(vb), undefined, { sensitivity: "base", numeric: true }) * tableSortDir;
  });
}

function updateTableSortIndicators() {
  document.querySelectorAll("#codes-table thead th[data-sort-key]").forEach((th) => {
    th.classList.toggle("sorted-asc", th.dataset.sortKey === tableSortKey && tableSortDir === 1);
    th.classList.toggle("sorted-desc", th.dataset.sortKey === tableSortKey && tableSortDir === -1);
  });
}

function renderTable() {
  const tbody = document.getElementById("codes-table-body");
  if (!tbody) return;
  const codes = sortTableCodes(filteredCodes());
  updateTableSortIndicators();
  tbody.innerHTML = codes
    .map((c) => {
      const proto =
        window.AntiMatterVaultCards?.codeProtocol?.(c) || c.code_type || "matter";
      return `<tr data-code-id="${escapeHtml(c.id)}" class="${selectedCodeIds.has(c.id) ? "selected" : ""}">
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(proto)}</td>
        <td>${escapeHtml(c.device_vendor)}</td>
        <td>${escapeHtml(c.device_product)}</td>
        <td>${escapeHtml(c.device_type)}</td>
        <td>${escapeHtml(c.area)}</td>
        <td>${escapeHtml(categoryNamesJoined(c.category_ids))}</td>
        <td>${c.in_use ? "✓" : ""}</td>
        <td>${escapeHtml(connectivitySummary(c))}</td>
        <td>${escapeHtml(formatDateTime(c.created_at))}</td>
        <td class="table-row-actions">
          <button type="button" class="card-icon-btn card-icon-btn-danger" data-table-delete title="${escapeHtml(t("action.delete"))}">
            <svg class="rm-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="./static/brand/icons.svg#rm-icon-trash"/></svg>
          </button>
        </td>
      </tr>`;
    })
    .join("");
}

function applyViewMode() {
  document.getElementById("codes-grid").classList.toggle("hidden", viewMode !== "grid");
  document.getElementById("codes-table-view").classList.toggle("hidden", viewMode !== "table");
  const icon = document.getElementById("btn-table-view-icon");
  if (icon) icon.className = viewMode === "grid" ? "mdi mdi-table" : "mdi mdi-qrcode";
  const btn = document.getElementById("btn-table-view");
  if (btn) {
    const key = viewMode === "grid" ? "table.tooltip" : "table.tooltip_grid";
    btn.setAttribute("data-i18n-tip", key);
    btn.setAttribute("data-tip", t(key));
  }
}

function toggleViewMode() {
  viewMode = viewMode === "grid" ? "table" : "grid";
  try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch (e) { /* ignore */ }
  applyViewMode();
  logEvent(`View mode: ${viewMode}`);
}

function decodeDiscoveryFlags(bits) {
  if (bits == null) return null;
  const flags = [];
  if (bits & 0x01) flags.push("Soft-AP");
  if (bits & 0x02) flags.push("BLE");
  if (bits & 0x04) flags.push(t("code.decode_ip"));
  return flags.length ? flags.join(", ") : t("code.decode_none");
}

function hex4(n) {
  return "0x" + n.toString(16).toUpperCase().padStart(4, "0");
}

// Best-effort official vendor/product name from the CSA Distributed
// Compliance Ledger (public Matter certification registry). Any failure
// (offline, unassigned VID, timeout) just means no name — never an error.
async function lookupOfficialName(path) {
  try {
    return await api(path);
  } catch (e) {
    return null;
  }
}

// http(s)-only anchor — matches the safety check generate.matterqr.codes uses
// before linking out to a DCL-supplied URL.
function officialLinkHtml(url, label) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
  } catch (e) {
    return "";
  }
}

// Decode a Matter QR/manual payload into its fields (vendor/product ID, passcode,
// discriminator, discovery capabilities, commissioning flow) — fully client-side,
// reuses the same Base38/Verhoeff parser the scanner already ships. Renders the
// base fields immediately, then enriches the Vendor/Product ID rows and adds the
// official DCL links (vendor site / product page / support page) if found.
async function renderDecodeInto(box, parsed, opts = {}) {
  if (!box) return;
  if (!parsed) {
    box.innerHTML = `<p class="form-hint">${escapeHtml(t("code.decode_mt_empty"))}</p>`;
    return;
  }
  const vidText = parsed.vid != null ? `${hex4(parsed.vid)} (${parsed.vid})` : "—";
  const pidText = parsed.pid != null ? `${hex4(parsed.pid)} (${parsed.pid})` : "—";
  const rows = [
    [t("code.decode_vid"), vidText],
    [t("code.decode_pid"), pidText],
    [t("code.decode_passcode"), parsed.pincode != null ? String(parsed.pincode).padStart(8, "0") : "—"],
    [
      t("code.decode_discriminator"),
      parsed.long_discriminator ?? parsed.short_discriminator ?? "—",
    ],
    [t("code.decode_discovery"), decodeDiscoveryFlags(parsed.discovery) || "—"],
    [t("code.decode_flow"), parsed.flow != null ? t(`code.decode_flow_${parsed.flow}`) || parsed.flow : "—"],
  ];
  let linksHtml = "";
  const paint = () =>
    `<table class="mt-decode-table">` +
    rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join("") +
    `</table>` +
    linksHtml;
  box.innerHTML = paint();

  if (parsed.vid == null) return;
  const [vendorInfo, modelInfo] = await Promise.all([
    lookupOfficialName(`/matter/vendor/${parsed.vid}`),
    parsed.pid != null
      ? lookupOfficialName(`/matter/model/${parsed.vid}/${parsed.pid}`)
      : Promise.resolve(null),
  ]);
  if (!vendorInfo?.name && !modelInfo?.name) return;
  if (vendorInfo?.name) rows[0][1] = `${vidText} — ${vendorInfo.name}`;
  if (modelInfo?.name) rows[1][1] = `${pidText} — ${modelInfo.name}`;
  if (typeof opts.onNames === "function") {
    opts.onNames(vendorInfo?.name || null, modelInfo?.name || null);
  }
  const links = [
    officialLinkHtml(vendorInfo?.landing_page, t("code.decode_vendor_site")),
    officialLinkHtml(modelInfo?.product_page, t("code.decode_product_page")),
    officialLinkHtml(modelInfo?.support_page, t("code.decode_support_page")),
  ].filter(Boolean);
  if (links.length) {
    linksHtml = `<div class="mt-decode-links">${links.join("")}</div>`;
  }
  box.innerHTML = paint();
}

// Once a field is edited by hand (or already had a value when the dialog opened),
// decode-derived names must never silently overwrite it again.
function markDeviceFieldUserEdited(id) {
  const el = document.getElementById(id);
  if (el) el.dataset.userEdited = "1";
}

function applyDecodedDeviceNames(vendorName, productName) {
  const vendorEl = document.getElementById("code-device-vendor");
  if (vendorEl && vendorName && vendorEl.dataset.userEdited !== "1") {
    vendorEl.value = vendorName;
  }
  const productEl = document.getElementById("code-device-product");
  if (productEl && productName && productEl.dataset.userEdited !== "1") {
    productEl.value = productName;
  }
}

function renderMtDecode() {
  const box = document.getElementById("code-mt-decode-result");
  if (!box) return;
  const M = window.AntiMatterMatterPayload;
  const qr = trimVal("code-qr");
  const manual = trimVal("code-manual");
  let parsed = null;
  try {
    if (M && qr) parsed = M.parseQrPayload(qr);
    else if (M && manual) parsed = M.parseManualPayload(manual);
  } catch (e) {
    parsed = null;
  }
  renderDecodeInto(box, parsed, { onNames: applyDecodedDeviceNames });
}

function openMtDecodeDialog(code) {
  const dlg = document.getElementById("mt-decode-dialog");
  const box = document.getElementById("mt-decode-dialog-result");
  if (!dlg || !box) return;
  const M = window.AntiMatterMatterPayload;
  let parsed = null;
  try {
    if (M && code.qr_payload) parsed = M.parseQrPayload(code.qr_payload);
    else if (M && code.manual_code) parsed = M.parseManualPayload(code.manual_code);
  } catch (e) {
    parsed = null;
  }
  renderDecodeInto(box, parsed);
  dlg.showModal();
}

// Z-Wave SmartStart decode: DSK/PIN plus, when a full QR payload is available (a bare
// DSK alone doesn't carry this), manufacturer/product/device-class metadata from the
// QR's TLV tail. Manufacturer/product name (like Matter's DCL) comes from a local
// snapshot of the zwave-js project's own device config database — Z-Wave has no live
// public registry API to query, so /api/zwave/device/... looks it up server-side
// against a bundled JSON index instead of a network call per lookup.
function parseZwavePayload(qrPayload, manualCode) {
  const ZW = window.AntiMatterZWavePayload;
  if (!ZW) return null;
  const extracted = qrPayload ? ZW.extractQrString(qrPayload) : "";
  if (extracted) {
    const parsed = ZW.parseQrDigits(extracted);
    if (parsed) return parsed;
  }
  if (manualCode && ZW.isValidDskFormatted(manualCode)) {
    return {
      dsk: ZW.formatDsk(manualCode),
      pin: ZW.pinFromDsk(manualCode),
      meta: {},
      version: null,
      smartStart: false,
    };
  }
  return null;
}

// Lowercase, 4-digit hex — matches how zwave-js-ui itself displays these fields
// (unlike Matter's uppercase hex4(), which follows the CSA/Matter spec's own convention).
function hex4z(n) {
  return "0x" + (n >>> 0).toString(16).padStart(4, "0");
}

function decVal(n) {
  return n == null ? "—" : `${n} (${hex4z(n)})`;
}

function zwaveCheckRow(label, checked) {
  return `<label><input type="checkbox" disabled ${checked ? "checked" : ""} /> ${escapeHtml(label)}</label>`;
}

async function renderZwaveDecodeInto(box, parsed, opts = {}) {
  if (!box) return;
  if (!parsed) {
    box.innerHTML = `<p class="form-hint">${escapeHtml(t("code.decode_zwave_empty"))}</p>`;
    return;
  }
  const meta = parsed.meta || {};
  const sec = parsed.requestedSecurityClasses;
  const proto = meta.supportedProtocols;

  let headHtml = "";
  if (parsed.version != null) {
    const label = parsed.smartStart ? t("code.decode_zwave_smartstart") : t("code.decode_zwave_s2");
    headHtml +=
      `<table class="mt-decode-table">` +
      `<tr><th>${escapeHtml(t("code.decode_zwave_version"))}</th><td>${escapeHtml(label)} (${parsed.version})</td></tr>` +
      `</table>`;
  }
  if (sec) {
    headHtml +=
      `<p class="form-field-label">${escapeHtml(t("code.decode_zwave_security_classes"))}</p>` +
      `<div class="connectivity-options zwave-decode-checks">` +
      zwaveCheckRow(t("code.decode_zwave_s2_access_control"), sec.s2AccessControl) +
      zwaveCheckRow(t("code.decode_zwave_s2_authenticated"), sec.s2Authenticated) +
      zwaveCheckRow(t("code.decode_zwave_s2_unauthenticated"), sec.s2Unauthenticated) +
      zwaveCheckRow(t("code.decode_zwave_s0"), sec.s0Legacy) +
      `</div>`;
  }
  if (proto) {
    headHtml +=
      `<p class="form-field-label">${escapeHtml(t("code.decode_zwave_protocols"))}</p>` +
      `<div class="connectivity-options zwave-decode-checks">` +
      zwaveCheckRow(t("code.decode_zwave_protocol_zwave"), proto.zwave) +
      zwaveCheckRow(t("code.decode_zwave_protocol_lr"), proto.zwaveLongRange) +
      `</div>`;
  }

  const rows = [[t("code.decode_zwave_dsk"), parsed.dsk || "—"]];
  if (meta.genericDeviceClass != null) rows.push([t("code.decode_zwave_generic_class"), decVal(meta.genericDeviceClass)]);
  if (meta.specificDeviceClass != null) rows.push([t("code.decode_zwave_specific_class"), decVal(meta.specificDeviceClass)]);
  if (meta.installerIconType != null) rows.push([t("code.decode_zwave_icon"), decVal(meta.installerIconType)]);
  let mfgIdx = -1;
  let productIdx = -1;
  if (meta.manufacturerId != null) {
    mfgIdx = rows.length;
    rows.push([t("code.decode_zwave_mfg"), decVal(meta.manufacturerId)]);
  }
  if (meta.productType != null) rows.push([t("code.decode_zwave_product_type"), decVal(meta.productType)]);
  if (meta.productId != null) {
    productIdx = rows.length;
    rows.push([t("code.decode_zwave_product_id"), decVal(meta.productId)]);
  }
  if (meta.applicationVersion) {
    const [major, minor] = meta.applicationVersion.split(".");
    rows.push([t("code.decode_zwave_app_version_major"), major ?? "—"]);
    rows.push([t("code.decode_zwave_app_version_minor"), minor ?? "—"]);
  }
  rows.push([t("code.decode_zwave_pin"), parsed.pin || "—"]);

  const paint = () =>
    headHtml +
    `<table class="mt-decode-table">` +
    rows.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`).join("") +
    `</table>`;
  box.innerHTML = paint();

  if (meta.manufacturerId == null || meta.productType == null || meta.productId == null) return;
  const device = await lookupOfficialName(
    `/zwave/device/${meta.manufacturerId}/${meta.productType}/${meta.productId}`
  );
  if (!device) return;
  if (mfgIdx >= 0 && device.manufacturer) rows[mfgIdx][1] = `${rows[mfgIdx][1]} — ${device.manufacturer}`;
  if (productIdx >= 0 && device.label) {
    const productName = device.description ? `${device.label} (${device.description})` : device.label;
    rows[productIdx][1] = `${rows[productIdx][1]} — ${productName}`;
  }
  if (typeof opts.onNames === "function") {
    opts.onNames(device.manufacturer || null, device.label || null);
  }
  box.innerHTML = paint();
}

function renderZwaveDecode() {
  const box = document.getElementById("code-zwave-decode-result");
  if (!box) return;
  renderZwaveDecodeInto(box, parseZwavePayload(trimVal("code-zwave-qr"), trimVal("code-zwave-dsk")), {
    onNames: applyDecodedDeviceNames,
  });
}

// devices.zwave-js.io supports jumping straight to a specific device via
// ?jumpTo=manufacturerId:productType:productId:firmwareVersion — falls back to
// the plain homepage when the QR's TLV tail didn't carry that metadata.
function zwaveDeviceDbUrl(meta) {
  const base = "https://devices.zwave-js.io/";
  if (!meta || meta.manufacturerId == null || meta.productType == null || meta.productId == null) {
    return base;
  }
  const h = (n) => "0x" + (n >>> 0).toString(16).padStart(4, "0");
  return `${base}?jumpTo=${h(meta.manufacturerId)}:${h(meta.productType)}:${h(meta.productId)}:0.0`;
}

function openZwaveDecodeDialog(code) {
  const dlg = document.getElementById("zwave-decode-dialog");
  const box = document.getElementById("zwave-decode-dialog-result");
  if (!dlg || !box) return;
  const parsed = parseZwavePayload(code.qr_payload, code.manual_code);
  const link = document.getElementById("zwave-decode-device-db-link");
  if (link) link.href = zwaveDeviceDbUrl(parsed?.meta);
  renderZwaveDecodeInto(box, parsed);
  if (!dlg.open) dlg.showModal();
}

// Card decode icon/dblclick is wired once per card regardless of protocol — dispatch
// to the right dialog here instead of duplicating the protocol check at each call site.
function openDecodeDialogForCode(code) {
  const proto = window.AntiMatterVaultCards?.codeProtocol?.(code) || "matter";
  if (proto === "zwave") openZwaveDecodeDialog(code);
  else openMtDecodeDialog(code);
}

function buildQuickMeta(code, proto) {
  const parts = [];
  if (code.device_vendor) parts.push(`${t("filter.vendor")}: ${code.device_vendor}`);
  if (code.device_product) parts.push(`${t("filter.product")}: ${code.device_product}`);
  if (code.device_type) parts.push(`${t("filter.type")}: ${code.device_type}`);
  if (code.area) parts.push(`${t("filter.area")}: ${code.area}`);
  parts.push(`${t("code.category")}: ${categoryNamesJoined(code.category_ids)}`);
  parts.push(`${t("code.protocol")}: ${proto}`);
  parts.push(`${t("code.in_use")}: ${code.in_use ? t("filter.yes") : t("filter.no")}`);
  const conn = connectivitySummary(code);
  if (conn) parts.push(`${t("code.connectivity")}: ${conn}`);
  if (code.created_at) parts.push(`${t("code.added_at")}: ${formatDateTime(code.created_at)}`);
  return parts.join(" · ");
}

function openQuickView(code) {
  if (!code) return;
  const Cards = window.AntiMatterVaultCards;
  const proto = Cards?.codeProtocol?.(code) || "matter";
  document.getElementById("quickview-name").textContent = code.name || "";
  const wrap = document.getElementById("quickview-image-wrap");
  const src =
    proto === "homekit" || proto === "zwave"
      ? `${API}/codes/${code.id}/card.svg?compact=1`
      : `${API}/codes/${code.id}/qr.png`;
  // HomeKit/Z-Wave card.svg already bakes in their brand logo server-side; Matter's
  // qr.png doesn't, so overlay the same logo the card grid shows next to its QR.
  const logo =
    proto === "matter"
      ? `<img class="quickview-protocol-logo" src="./static/assets/matter_logo.svg" alt="" />`
      : "";
  wrap.innerHTML = `${logo}<img class="quickview-code-img" src="${src}" alt="" />`;
  const codeImg = wrap.querySelector(".quickview-code-img");
  const decode =
    proto === "matter"
      ? () => openMtDecodeDialog(code)
      : proto === "zwave"
        ? () => openZwaveDecodeDialog(code)
        : null;
  // Single click = enlarge fullscreen for scanning; double click = decode
  // (Matter/Z-Wave only). A click always precedes a dblclick, so defer the
  // enlarge briefly and cancel it if a second click lands.
  let clickTimer = null;
  wrap.onclick = () => {
    if (clickTimer) return; // 2nd click of a double — let ondblclick handle it
    clickTimer = setTimeout(() => {
      clickTimer = null;
      openQrFullscreen(src, logo);
    }, 250);
  };
  codeImg.ondblclick = () => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    if (decode) decode();
  };
  wrap.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openQrFullscreen(src, logo);
    }
  };
  document.getElementById("quickview-manual").textContent =
    Cards?.displayManual?.(code) || code.manual_code || "";
  document.getElementById("quickview-meta").textContent = buildQuickMeta(code, proto);
  updateQuickViewHaLinks(code, proto);
  document.getElementById("quickview-edit").onclick = () => {
    document.getElementById("quickview-dialog").close();
    openCodeDialog(code);
  };
  document.getElementById("quickview-download").onclick = () => downloadCode(code);
  const decodeBtn = document.getElementById("quickview-decode");
  if (decodeBtn) {
    decodeBtn.classList.toggle("hidden", proto !== "matter" && proto !== "zwave");
    decodeBtn.onclick = () => (proto === "zwave" ? openZwaveDecodeDialog(code) : openMtDecodeDialog(code));
  }
  const dlg = document.getElementById("quickview-dialog");
  if (!dlg.open) dlg.showModal();
}

// HA integration page per protocol — HA has no documented URL to *prefill* the setup
// code, so this just lands on the integration's "Add device" page; the user taps Add
// there, then scans the enlarged QR.
const HA_ADD_URLS = {
  matter: "/config/integrations/integration/matter",
  zwave: "/config/integrations/integration/zwave_js",
  homekit: "/config/integrations/integration/homekit_controller",
};

function updateQuickViewHaLinks(code, proto) {
  const addLink = document.getElementById("quickview-add-ha");
  const openLink = document.getElementById("quickview-open-ha-device");
  if (addLink) {
    const url = HA_ADD_URLS[proto];
    if (haAvailable && url) {
      addLink.href = url;
      addLink.classList.remove("hidden");
    } else {
      addLink.classList.add("hidden");
    }
  }
  if (openLink) {
    const deviceId = code?.ha_link?.device_id;
    if (deviceId) {
      openLink.href = `/config/devices/device/${deviceId}`;
      openLink.classList.remove("hidden");
    } else {
      openLink.classList.add("hidden");
    }
  }
}

// Blow the code image up to fill the screen for scanning; reuses the qr-invert body
// class so it reads in any theme. Tap / Esc closes.
function openQrFullscreen(src, logo) {
  const dlg = document.getElementById("qr-fullscreen-dialog");
  const wrap = document.getElementById("qr-fullscreen-wrap");
  if (!dlg || !wrap) return;
  wrap.innerHTML = `${logo}<img class="qr-fullscreen-img" src="${src}" alt="" />`;
  logEvent("QR fullscreen opened");
  if (!dlg.open) dlg.showModal();
}

function renderCodes() {
  const grid = document.getElementById("codes-grid");
  const empty = document.getElementById("empty-state");
  const codes = filteredCodes();
  grid.innerHTML = "";
  empty.classList.toggle("hidden", codes.length > 0);
  updateStatusbar(codes.length);
  renderTable();

  const Cards = window.AntiMatterVaultCards;
  codes.forEach((code, index) => {
    const card = document.createElement("article");
    const proto = Cards?.codeProtocol?.(code) || "matter";
    card.dataset.codeId = code.id;
    card.className =
      "code-card " +
      (proto === "homekit"
        ? "homekit-sticker-card"
        : proto === "zwave"
          ? "zwave-sticker-card"
          : "matter-sticker-card") +
      (selectedCodeIds.has(code.id) ? " selected" : "");
    if (Cards) {
      card.innerHTML = Cards.buildCodeCardHtml(code, {
        escapeHtml,
        categoryName,
        iconsHref: "./static/brand/icons.svg",
        assetsPrefix: "./static/assets",
        qrApiPrefix: "./api",
      });
      Cards.wireCodeCard(card, code, {
        onDownload: downloadCode,
        onEdit: openCodeDialog,
        onDelete: deleteCode,
        onDecode: openDecodeDialogForCode,
      });
    }
    card.addEventListener("click", (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        handleCodeSelectClick(e, code, index, codes);
      }
    });
    grid.appendChild(card);
  });
  updateCodeSelectionUi();
}

function render() {
  fillDynamicFilterPanels();
  fillProtocolFilterPanel();
  fillInUseFilterPanel();
  renderCategories();
  renderCodes();
  fillCategoryChecks();
  const fa = document.getElementById("filter-all");
  if (fa) fa.classList.toggle("active", activeCategories.size === 0);
}

function fillCategoryChecks(selectedIds) {
  const panel = document.getElementById("code-category-checks");
  const toggle = document.getElementById("code-category-toggle");
  if (!panel) return;
  const keep = selectedIds || getCheckedCategoryIds(panel);
  if (window.AntiMatterVaultCards) {
    window.AntiMatterVaultCards.fillCategoryChecks(panel, toggle, vault, keep);
    return;
  }
  const keepSet = new Set(keep);
  panel.innerHTML = "";
  for (const cat of vault.categories) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = cat.id;
    input.checked = keepSet.has(cat.id);
    const span = document.createElement("span");
    span.textContent = capitalizeFirst(cat.name);
    label.appendChild(input);
    label.appendChild(span);
    panel.appendChild(label);
  }
}

function getCheckedCategoryIds(container) {
  return [...container.querySelectorAll("input[type=checkbox]:checked")].map((i) => i.value);
}

function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function syncHomeKitDerived() {
  const HK = window.AntiMatterHomeKitPayload;
  const hint = document.getElementById("code-homekit-derived");
  const uriEl = document.getElementById("code-homekit-uri");
  if (!HK || !hint || !uriEl) return;
  const parsed = HK.parseSetupUri(uriEl.value.trim());
  if (!parsed) {
    hint.classList.add("hidden");
    hint.textContent = "";
    return;
  }
  const decoded = HK.decodeFieldsFromUri(parsed.uri);
  let pin = HK.pairingDigits(
    document.getElementById("code-homekit-pairing")?.value || ""
  );
  if (!pin && HK.decodePairingFromUri) {
    pin = HK.decodePairingFromUri(parsed.uri);
  }
  const pairingEl = document.getElementById("code-homekit-pairing");
  if (pin && pairingEl && !pairingEl.value.trim()) {
    pairingEl.value = HK.formatPairingDisplay(pin);
  }
  document.getElementById("code-homekit-setup-id").value =
    decoded.setup_id || parsed.setupId || "";
  if (decoded.homekit_category) {
    document.getElementById("code-homekit-category").value =
      decoded.homekit_category;
  }
  const parts = [];
  if (pin) {
    parts.push(
      `${t("code.homekit_pairing")}: ${HK.formatPairingDisplay(pin)}`
    );
  }
  const sid = decoded.setup_id || parsed.setupId;
  if (sid) parts.push(`Setup ID: ${sid}`);
  if (decoded.homekit_category) {
    parts.push(`${t("code.homekit_category")}: ${decoded.homekit_category}`);
  }
  hint.textContent = parts.join(" · ");
  hint.classList.toggle("hidden", parts.length === 0);
}

function syncCodeTypeFields() {
  const type = document.getElementById("code-type")?.value || "matter";
  document.getElementById("code-fields-matter")?.classList.toggle("hidden", type !== "matter");
  document.getElementById("code-fields-homekit")?.classList.toggle("hidden", type !== "homekit");
  document.getElementById("code-fields-zwave")?.classList.toggle("hidden", type !== "zwave");
}

// Only wired to the protocol dropdown's own onchange (not called when a dialog opens
// for an existing code) — a Z-Wave code is Z-Wave connectivity by definition, but this
// must never override a value the user already saved by unchecking it. Matter/HomeKit
// don't get the same treatment: those protocols don't imply one specific radio (Matter
// devices are commonly WiFi-only, HomeKit ones commonly WiFi too), so guessing would
// just be wrong as often as right.
function onCodeTypeChanged() {
  syncCodeTypeFields();
  if (document.getElementById("code-type")?.value === "zwave") {
    const cb = document.getElementById("code-conn-zwave");
    if (cb) cb.checked = true;
  }
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function trimVal(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function openCodeDialog(code = null) {
  const dlg = document.getElementById("code-dialog");
  const proto =
    code && window.AntiMatterVaultCards
      ? window.AntiMatterVaultCards.codeProtocol(code)
      : "matter";
  document.getElementById("code-type").value = code?.code_type || proto;
  syncCodeTypeFields();
  document.getElementById("code-dialog-title").textContent = code
    ? t("code.dialog_edit")
    : t("code.dialog_new");
  setVal("code-id", code?.id);
  setVal("code-name", code?.name);
  setVal("code-device-type", code?.device_type);
  setVal("code-device-vendor", code?.device_vendor);
  setVal("code-device-product", code?.device_product);
  // A field already carrying a value counts as "set" — decode must not clobber it.
  document.getElementById("code-device-vendor").dataset.userEdited = code?.device_vendor ? "1" : "";
  document.getElementById("code-device-product").dataset.userEdited = code?.device_product ? "1" : "";
  setVal("code-area", code?.area);
  setVal("code-description", code?.description);
  const details = document.getElementById("code-details");
  if (details) {
    details.open = Boolean(
      code?.device_vendor || code?.device_product || code?.device_type ||
      code?.description || code?.area
    );
  }
  const haDetails = document.getElementById("code-ha-details");
  if (haDetails) {
    haDetails.open = Boolean(code?.ha_link?.device_id);
  }
  fillCategoryChecks(code?.category_ids || []);
  setVal("code-manual", code?.manual_code);
  setVal("code-qr", code?.qr_payload);
  const mtDecode = document.getElementById("code-mt-decode");
  if (mtDecode) mtDecode.open = false;
  renderMtDecode();
  setVal("code-homekit-pairing", code?.manual_code);
  setVal("code-homekit-setup-id", code?.setup_id);
  const catEl = document.getElementById("code-homekit-category");
  if (catEl) catEl.value = code?.homekit_category || "other";
  setVal("code-homekit-uri", proto === "homekit" ? code?.qr_payload : "");
  if (proto === "homekit") syncHomeKitDerived();
  setVal("code-zwave-dsk", proto === "zwave" ? code?.manual_code : "");
  setVal("code-zwave-qr", proto === "zwave" ? code?.qr_payload : "");
  const zwaveDecode = document.getElementById("code-zwave-decode");
  if (zwaveDecode) zwaveDecode.open = false;
  renderZwaveDecode();
  setVal("code-notes", code?.notes);
  document.getElementById("code-in-use").checked = Boolean(code?.in_use);
  document.getElementById("code-conn-wifi").checked = Boolean(code?.conn_wifi);
  document.getElementById("code-conn-matter").checked = Boolean(code?.conn_matter);
  document.getElementById("code-conn-zigbee").checked = Boolean(code?.conn_zigbee);
  document.getElementById("code-conn-bluetooth").checked = Boolean(code?.conn_bluetooth);
  document.getElementById("code-conn-zwave").checked = Boolean(code?.conn_zwave);
  const savedDeviceId = code?.ha_link?.device_id || "";
  document.getElementById("code-ha-device").value = savedDeviceId;
  const nameInput = document.getElementById("code-ha-device-name");
  if (nameInput) {
    const dev = haDeviceById.get(savedDeviceId);
    nameInput.value = dev ? haDeviceDisplay(dev) : "";
  }
  updateHaDeviceLink();
  suggestHaDevice(code);
  dlg.showModal();
}

// The hidden #code-ha-device holds the device_id; the visible #code-ha-device-name
// is a searchable datalist input. "Open device in Home Assistant" is a straight
// substitution — no server round-trip (target=_top navigates the HA frontend, not
// just the ingress iframe this add-on runs in).
function updateHaDeviceLink() {
  const link = document.getElementById("btn-open-ha-device");
  const deviceId = document.getElementById("code-ha-device")?.value;
  if (!link) return;
  if (!deviceId) {
    link.classList.add("hidden");
    return;
  }
  link.href = `/config/devices/device/${deviceId}`;
  link.classList.remove("hidden");
}

// Datalist options carry the device *name* as their value (users type/recognize
// names, not opaque ids), so same-named devices are disambiguated by area to keep
// the display -> id mapping unambiguous.
function haDeviceDisplay(dev) {
  const seen = haDevices.filter((d) => d.name === dev.name);
  if (seen.length > 1 && dev.area) return `${dev.name} — ${dev.area}`;
  return dev.name;
}

async function loadHaDevices() {
  const list = document.getElementById("ha-device-options");
  if (!list) return;
  try {
    const devices = await api("/ha/devices");
    haDevices = Array.isArray(devices) ? devices : [];
  } catch {
    haDevices = []; // HA unavailable — field just stays free/empty
  }
  haDeviceById = new Map(haDevices.map((d) => [d.id, d]));
  haDisplayToId = new Map();
  list.innerHTML = "";
  for (const dev of haDevices) {
    const display = haDeviceDisplay(dev);
    haDisplayToId.set(display, dev.id);
    const opt = document.createElement("option");
    opt.value = display;
    list.appendChild(opt);
  }
}

// Resolve the visible device-name input to a device_id in the hidden field. A link
// is stored only on an exact match, so partial/garbage text never persists an id.
function resolveHaDeviceInput() {
  const nameInput = document.getElementById("code-ha-device-name");
  const hidden = document.getElementById("code-ha-device");
  if (!nameInput || !hidden) return;
  const id = haDisplayToId.get(nameInput.value.trim()) || "";
  hidden.value = id;
  updateHaDeviceLink();
}

// Fuzzy auto-match: propose the HA device whose name best overlaps the code's own
// name / vendor / product. Suggestion only — never overwrites an existing link.
function suggestHaDevice(code) {
  const hint = document.getElementById("code-ha-device-suggest");
  const applyLink = document.getElementById("code-ha-device-suggest-apply");
  if (!hint || !applyLink) return;
  hint.classList.add("hidden");
  if (!haDevices.length || code?.ha_link?.device_id) return;
  const needle = [code?.name, code?.device_vendor, code?.device_product]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!needle) return;
  const tokens = needle.split(/\s+/).filter((w) => w.length >= 3);
  if (!tokens.length) return;
  let best = null;
  let bestScore = 0;
  for (const dev of haDevices) {
    const hay = `${dev.name} ${dev.area}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) if (hay.includes(tok)) score += tok.length;
    if (score > bestScore) {
      bestScore = score;
      best = dev;
    }
  }
  if (!best) return;
  const display = haDeviceDisplay(best);
  applyLink.textContent = display;
  applyLink.onclick = (e) => {
    e.preventDefault();
    document.getElementById("code-ha-device-name").value = display;
    resolveHaDeviceInput();
    hint.classList.add("hidden");
    document.getElementById("code-ha-details")?.setAttribute("open", "");
  };
  hint.classList.remove("hidden");
}

function openCategoryDialog(cat = null) {
  const dlg = document.getElementById("category-dialog");
  document.getElementById("category-dialog-title").textContent = cat
    ? t("categories.dialog_edit")
    : t("categories.dialog_new");
  document.getElementById("category-id").value = cat?.id || "";
  document.getElementById("category-name").value = cat?.name || "";
  document.getElementById("category-color").value = cat?.color || "#c9791a";
  window.AntiMatterCategoryColor?.sync();
  document.getElementById("category-icon").value =
    cat?.icon || window.AntiMatterCategoryIcons?.DEFAULT_ICON || "folder";
  ensureCategoryIconPicker()?.setValue(cat?.icon || "folder");
  const delBtn = document.getElementById("category-delete");
  if (delBtn) {
    delBtn.hidden = !cat;
    delBtn.onclick = cat ? () => deleteCategory(cat.id) : null;
  }
  dlg.showModal();
}

async function deleteCategory(id) {
  if (!id) return;
  if (!(await uiConfirm(t("confirm.delete_category"), t("action.delete")))) return;
  await api(`/categories/${id}`, { method: "DELETE" });
  activeCategories.delete(id);
  document.getElementById("category-dialog").close();
  await loadVault();
}

// Local, bundled scanner fallback for browsers without BarcodeDetector (offline-safe).
const SCAN_LIB_URL = "./static/vendor/html5-qrcode.min.js";

function baseBody(codeType) {
  return {
    name: trimVal("code-name"),
    code_type: codeType,
    device_type: trimVal("code-device-type"),
    device_vendor: trimVal("code-device-vendor"),
    device_product: trimVal("code-device-product"),
    area: trimVal("code-area"),
    description: trimVal("code-description"),
    category_ids: getCheckedCategoryIds(document.getElementById("code-category-checks")),
    notes: trimVal("code-notes"),
    in_use: document.getElementById("code-in-use").checked,
    conn_wifi: document.getElementById("code-conn-wifi").checked,
    conn_matter: document.getElementById("code-conn-matter").checked,
    conn_zigbee: document.getElementById("code-conn-zigbee").checked,
    conn_bluetooth: document.getElementById("code-conn-bluetooth").checked,
    conn_zwave: document.getElementById("code-conn-zwave").checked,
    ha_link: {
      device_id: document.getElementById("code-ha-device").value || null,
    },
  };
}

async function saveCode(e) {
  e.preventDefault();
  const id = document.getElementById("code-id").value;
  const codeType = document.getElementById("code-type").value || "matter";
  let body;
  if (codeType === "homekit" && window.AntiMatterHomeKitPayload) {
    const n = window.AntiMatterHomeKitPayload.normalizeFields(
      trimVal("code-homekit-pairing"),
      trimVal("code-homekit-uri"),
      {
        setup_id: trimVal("code-homekit-setup-id"),
        homekit_category:
          document.getElementById("code-homekit-category").value || "other",
      }
    );
    body = {
      ...baseBody("homekit"),
      manual_code: n.manual_code,
      qr_payload: n.qr_payload,
      setup_id: n.setup_id,
      homekit_category: n.homekit_category,
      homekit_flag: n.homekit_flag,
    };
  } else if (codeType === "zwave" && window.AntiMatterZWavePayload) {
    const n = window.AntiMatterZWavePayload.normalizeFields(
      trimVal("code-zwave-dsk"),
      trimVal("code-zwave-qr")
    );
    body = {
      ...baseBody("zwave"),
      manual_code: n.manual_code,
      qr_payload: n.qr_payload,
      zwave_pin: n.zwave_pin,
    };
  } else {
    body = {
      ...baseBody("matter"),
      manual_code: trimVal("code-manual"),
      qr_payload: trimVal("code-qr"),
    };
  }
  const dup = window.AntiMatterScan?.findDuplicate(vault.codes, body, id || null);
  if (dup) {
    const msg = t("scan.duplicate", { name: dup.name || t("scan.unnamed") });
    if (confirm(msg + "\n\n" + t("scan.duplicate_open"))) {
      document.getElementById("code-dialog").close();
      openCodeDialog(dup);
    }
    return;
  }
  try {
    if (id) {
      await api(`/codes/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await api("/codes", { method: "POST", body: JSON.stringify(body) });
    }
  } catch (err) {
    if (err.status === 409 && err.existing?.id) {
      if (confirm((err.message || t("scan.duplicate", { name: "" })) + "\n\n" + t("scan.duplicate_open"))) {
        openCodeDialog(vault.codes.find((c) => c.id === err.existing.id) || null);
      }
      return;
    }
    throw err;
  }
  document.getElementById("code-dialog").close();
  await loadVault();
}

// Shared in-app message modal (falls back to native dialogs).
function uiMessage({ message, okLabel, danger = false, showCancel = true }) {
  return new Promise((resolve) => {
    const dlg = document.getElementById("confirm-dialog");
    if (!dlg) {
      resolve(showCancel ? window.confirm(message) : (window.alert(message), true));
      return;
    }
    document.getElementById("confirm-message").textContent = message;
    const okBtn = document.getElementById("confirm-ok");
    const cancelBtn = document.getElementById("confirm-cancel");
    okBtn.textContent = okLabel || t("action.ok");
    okBtn.classList.toggle("rm-btn-danger", danger);
    okBtn.classList.toggle("rm-btn-primary", !danger);
    cancelBtn.style.display = showCancel ? "" : "none";
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      dlg.removeEventListener("close", onClose);
      try { dlg.close(); } catch (e) { /* ignore */ }
      resolve(val);
    };
    const onClose = () => finish(false);
    okBtn.onclick = () => finish(true);
    cancelBtn.onclick = () => finish(false);
    dlg.addEventListener("close", onClose);
    dlg.showModal();
  });
}

function uiConfirm(message, okLabel) {
  return uiMessage({ message, okLabel, danger: true, showCancel: true });
}

function uiAlert(message, okLabel) {
  return uiMessage({ message, okLabel, danger: false, showCancel: false });
}

// Three-way choice for import: "cancel" | "replace" | "merge".
function uiImportChoice() {
  return new Promise((resolve) => {
    const dlg = document.getElementById("import-dialog");
    if (!dlg) {
      resolve(window.confirm(t("confirm.import_merge")) ? "merge" : "replace");
      return;
    }
    const cancelBtn = document.getElementById("import-cancel");
    const replaceBtn = document.getElementById("import-replace");
    const mergeBtn = document.getElementById("import-merge");
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      cancelBtn.onclick = null;
      replaceBtn.onclick = null;
      mergeBtn.onclick = null;
      dlg.removeEventListener("close", onClose);
      try { dlg.close(); } catch (e) { /* ignore */ }
      resolve(val);
    };
    const onClose = () => finish("cancel");
    cancelBtn.onclick = () => finish("cancel");
    replaceBtn.onclick = () => finish("replace");
    mergeBtn.onclick = () => finish("merge");
    dlg.addEventListener("close", onClose);
    dlg.showModal();
  });
}

function syncBackupFrequencyFields() {
  const freq = document.getElementById("backup-frequency").value;
  document.getElementById("backup-weekday-row").classList.toggle("hidden", freq !== "weekly");
  document.getElementById("backup-day-of-month-row").classList.toggle("hidden", freq !== "monthly");
  document.getElementById("backup-hourly-hint").classList.toggle("hidden", freq !== "hourly");
}

async function openBackupDialog() {
  const dlg = document.getElementById("backup-dialog");
  try {
    const s = await api("/backup/settings");
    document.getElementById("backup-auto-enabled").checked = Boolean(s.enabled);
    document.getElementById("backup-frequency").value = s.frequency || "daily";
    document.getElementById("backup-auto-time").value =
      String(s.hour ?? 3).padStart(2, "0") + ":" + String(s.minute ?? 0).padStart(2, "0");
    document.getElementById("backup-weekday").value = String(s.weekday ?? 0);
    document.getElementById("backup-day-of-month").value = s.day_of_month ?? 1;
    document.getElementById("backup-keep-count").value = s.keep_count ?? 10;
    syncBackupFrequencyFields();
    const info = document.getElementById("backup-last-info");
    if (info) {
      info.textContent = s.last_run_key
        ? t("backup.last_run", { date: s.last_run_key })
        : "";
    }
  } catch {
    /* ignore — defaults stay in the form */
  }
  dlg.showModal();
}

async function downloadCode(code) {
  const proto = window.AntiMatterVaultCards?.codeProtocol?.(code) || "matter";
  const isSvg = proto === "homekit" || proto === "zwave";
  const path = isSvg ? `/codes/${code.id}/card.svg` : `/codes/${code.id}/label.png`;
  try {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(t("alert.download_fail"));
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safe = (code.name || "code").replace(/[^\w.-]+/g, "_");
    a.download = isSvg ? `antimatter-${safe}.svg` : `antimatter-${safe}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    // Best-effort: also drop a copy under HA's Media folder. Silent no-op if /media isn't mounted.
    api(`/codes/${code.id}/save-to-media`, { method: "POST" }).catch(() => {});
  } catch (err) {
    await uiAlert(err.message || t("alert.download_fail"));
  }
}

async function deleteCode(code) {
  const id = typeof code === "string" ? code : code?.id;
  if (!id) return;
  if (!(await uiConfirm(t("confirm.delete_code"), t("action.delete")))) return;
  await api(`/codes/${id}`, { method: "DELETE" });
  await loadVault();
}

async function saveCategory(e) {
  e.preventDefault();
  const id = document.getElementById("category-id").value;
  const body = {
    name: document.getElementById("category-name").value.trim(),
    color: document.getElementById("category-color").value,
    icon: document.getElementById("category-icon").value,
  };
  let created = null;
  try {
    if (id) {
      await api(`/categories/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      created = await api("/categories", { method: "POST", body: JSON.stringify(body) });
    }
  } catch (err) {
    await uiAlert(err.message || t("alert.category_save_fail"));
    return;
  }
  document.getElementById("category-dialog").close();
  await loadVault();
  if (created && categoryCreateTargetSelectId) {
    const container = document.getElementById(categoryCreateTargetSelectId);
    const input = container?.querySelector(`input[value="${created.id}"]`);
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("change"));
    }
  }
  categoryCreateTargetSelectId = null;
}

async function loadAddonInfo() {
  try {
    const info = await api("/info");
    haAvailable = Boolean(info?.ha_available);
    if (info?.language && info.language !== "auto") {
      window.ADDON_LANGUAGE = info.language;
    }
    const v = document.getElementById("app-version");
    if (v && info?.version) v.textContent = "v" + info.version;
  } catch {
    /* ignore — defaults apply */
  }
}

// Common device types — suggestions only (datalist), free text still allowed so
// existing saved values that aren't in this list keep working.
const DEVICE_TYPE_OPTIONS = [
  "light", "switch", "plug", "sensor", "binary_sensor", "motion_sensor",
  "contact_sensor", "climate", "thermostat", "lock", "cover", "garage_door",
  "fan", "camera", "doorbell", "siren", "smoke_detector", "water_leak_sensor",
  "button", "remote", "media_player", "speaker", "vacuum", "hub", "other",
];

function fillDeviceTypeOptions() {
  const list = document.getElementById("device-type-options");
  if (!list) return;
  list.innerHTML = DEVICE_TYPE_OPTIONS.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
}

async function loadAreas() {
  try {
    const areas = await api("/ha/areas");
    const list = document.getElementById("area-options");
    if (!list || !Array.isArray(areas)) return;
    list.innerHTML = "";
    for (const name of areas) {
      const opt = document.createElement("option");
      opt.value = name;
      list.appendChild(opt);
    }
  } catch {
    /* ignore — free-text area still works */
  }
}

function bindUi() {
  window.AntiMatterCategoryColor?.bind();
  ensureCategoryIconPicker();
  document.getElementById("code-type").onchange = onCodeTypeChanged;
  document
    .getElementById("code-homekit-uri")
    ?.addEventListener("input", syncHomeKitDerived);
  document
    .getElementById("code-homekit-pairing")
    ?.addEventListener("input", syncHomeKitDerived);
  document.getElementById("code-mt-decode")?.addEventListener("toggle", renderMtDecode);
  document.getElementById("code-qr")?.addEventListener("input", renderMtDecode);
  document.getElementById("code-manual")?.addEventListener("input", renderMtDecode);
  document.getElementById("code-zwave-decode")?.addEventListener("toggle", renderZwaveDecode);
  document.getElementById("code-zwave-qr")?.addEventListener("input", renderZwaveDecode);
  document.getElementById("code-zwave-dsk")?.addEventListener("input", renderZwaveDecode);
  document.getElementById("code-device-vendor")?.addEventListener("input", () => markDeviceFieldUserEdited("code-device-vendor"));
  document.getElementById("code-device-product")?.addEventListener("input", () => markDeviceFieldUserEdited("code-device-product"));
  document.getElementById("code-ha-device-name")?.addEventListener("input", resolveHaDeviceInput);
  document.getElementById("code-ha-device-name")?.addEventListener("change", resolveHaDeviceInput);
  document.getElementById("qr-fullscreen-wrap")?.addEventListener("click", () =>
    document.getElementById("qr-fullscreen-dialog")?.close()
  );
  document.getElementById("btn-add-code").onclick = () => openCodeDialog();
  document.getElementById("btn-add-category").onclick = () => {
    categoryCreateTargetSelectId = null;
    openCategoryDialog();
  };
  document.getElementById("btn-add-category-inline")?.addEventListener("click", () => {
    categoryCreateTargetSelectId = "code-category-checks";
    openCategoryDialog();
  });
  document.getElementById("code-form").onsubmit = saveCode;
  document.getElementById("category-form").onsubmit = saveCategory;
  document.getElementById("search").oninput = renderCodes;

  document.getElementById("btn-table-view").onclick = toggleViewMode;
  document.querySelectorAll("#codes-table thead th[data-sort-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (tableSortKey === key) tableSortDir *= -1;
      else {
        tableSortKey = key;
        tableSortDir = 1;
      }
      renderTable();
    });
  });
  document.getElementById("codes-table-body").ondblclick = (e) => {
    if (e.target.closest("[data-table-delete]")) return;
    const tr = e.target.closest("tr[data-code-id]");
    if (!tr) return;
    const code = vault.codes.find((c) => c.id === tr.dataset.codeId);
    if (code) openQuickView(code);
  };
  document.getElementById("codes-table-body").onclick = (e) => {
    const btn = e.target.closest("[data-table-delete]");
    if (btn) {
      e.stopPropagation();
      const tr = btn.closest("tr[data-code-id]");
      if (tr) deleteCode(tr.dataset.codeId);
      return;
    }
    const tr = e.target.closest("tr[data-code-id]");
    if (!tr) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const codes = filteredCodes();
      const index = codes.findIndex((c) => c.id === tr.dataset.codeId);
      if (index >= 0) handleCodeSelectClick(e, codes[index], index, codes);
      return;
    }
    // Plain click on the name cell — "Excel mode" shortcut to open the QR quickview.
    if (e.target.closest("td:first-child")) {
      const code = vault.codes.find((c) => c.id === tr.dataset.codeId);
      if (code) openQuickView(code);
    }
  };
  document.getElementById("codes-table-body").oncontextmenu = (e) => {
    const tr = e.target.closest("tr[data-code-id]");
    if (!tr) return;
    e.preventDefault();
    const code = vault.codes.find((c) => c.id === tr.dataset.codeId);
    if (code) openCodeDialog(code);
  };

  document.getElementById("filter-all").onclick = () => {
    activeCategories.clear();
    render();
    closeSidebarOnMobile();
  };

  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    const btn = document.getElementById("btn-toggle-sidebar");
    const open = sidebar.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (e) => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || !sidebar.classList.contains("open")) return;
    if (!sidebar.contains(e.target)) closeSidebarOnMobile();
  });

  document.getElementById("btn-delete-selected-codes")?.addEventListener("click", deleteSelectedCodes);
  document.getElementById("btn-clear-code-selection")?.addEventListener("click", () => {
    selectedCodeIds.clear();
    lastSelectedCodeIndex = null;
    updateCodeSelectionUi();
  });
  document.getElementById("btn-delete-selected-categories")?.addEventListener("click", deleteSelectedCategories);
  document.getElementById("btn-clear-category-selection")?.addEventListener("click", () => {
    selectedCategoryIds.clear();
    lastSelectedCategoryIndex = null;
    updateCategorySelectionUi();
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.onclick = () => btn.closest("dialog").close();
  });

  document.getElementById("btn-export").onclick = () => {
    window.location.href = "./api/export";
  };

  document.getElementById("import-file").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = "";
    const choice = await uiImportChoice();
    if (choice === "cancel") return;
    await api("/import", {
      method: "POST",
      body: JSON.stringify({ data: text, merge: choice === "merge" }),
    });
    await loadVault();
  };

  document.getElementById("btn-trash").onclick = openTrashDialog;
  document.getElementById("trash-dialog")?.addEventListener("click", async (e) => {
    const restoreBtn = e.target.closest("[data-restore]");
    if (restoreBtn) {
      const path = restoreBtn.dataset.kind === "category" ? "categories" : "codes";
      const id = restoreBtn.dataset.restore;
      try {
        await api(`/${path}/${id}/restore`, { method: "POST" });
      } catch (err) {
        if (err.status === 409 && err.existing?.id) {
          const msg =
            t("scan.duplicate", { name: err.existing.name || t("scan.unnamed") }) +
            "\n" + t("trash.restore_duplicate_hint");
          if (await uiConfirm(msg, t("action.merge"))) {
            // "Merge" here means: the active vault already has this code, so the
            // trashed duplicate is discarded for good rather than restored as a copy.
            await api(`/${path}/${id}/purge`, { method: "DELETE" });
            await loadTrash();
          }
          return;
        }
        await uiAlert(err.message || t("alert.restore_fail"));
        return;
      }
      await loadTrash();
      await loadVault();
      return;
    }
    const purgeBtn = e.target.closest("[data-purge]");
    if (purgeBtn) {
      if (!(await uiConfirm(t("confirm.delete_forever"), t("action.delete_forever")))) return;
      const path = purgeBtn.dataset.kind === "category" ? "categories" : "codes";
      await api(`/${path}/${purgeBtn.dataset.purge}/purge`, { method: "DELETE" });
      await loadTrash();
      return;
    }
  });

  document.getElementById("btn-backup").onclick = openBackupDialog;
  document.getElementById("backup-frequency").onchange = syncBackupFrequencyFields;

  document.getElementById("backup-form").onsubmit = async (e) => {
    e.preventDefault();
    const [hh, mm] = (document.getElementById("backup-auto-time").value || "03:00")
      .split(":")
      .map((n) => parseInt(n, 10) || 0);
    const body = {
      enabled: document.getElementById("backup-auto-enabled").checked,
      frequency: document.getElementById("backup-frequency").value,
      hour: hh,
      minute: mm,
      weekday: parseInt(document.getElementById("backup-weekday").value, 10) || 0,
      day_of_month: parseInt(document.getElementById("backup-day-of-month").value, 10) || 1,
      keep_count: parseInt(document.getElementById("backup-keep-count").value, 10) || 10,
    };
    await api("/backup/settings", { method: "PUT", body: JSON.stringify(body) });
    document.getElementById("backup-dialog").close();
  };

  document.getElementById("backup-now-btn").onclick = async () => {
    document.getElementById("backup-dialog").close();
    try {
      const r = await api("/backup", { method: "POST" });
      await uiAlert(r.ok ? t("alert.backup_local_ok") : t("alert.backup_fail"));
    } catch (err) {
      await uiAlert(err.message || t("alert.backup_fail"));
    }
  };

  fillConnFilterPanel();
  document.getElementById("btn-clear-filters")?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearAllFilters();
  });
  document.querySelectorAll(".filter-dropdown-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = btn.nextElementSibling;
      document.querySelectorAll(".filter-dropdown-panel").forEach((p) => {
        if (p !== panel) {
          p.classList.add("hidden");
          p.classList.remove("align-right");
        }
      });
      const wasHidden = panel?.classList.contains("hidden");
      panel?.classList.toggle("hidden");
      if (panel && wasHidden) {
        panel.classList.remove("align-right");
        if (panel.getBoundingClientRect().right > window.innerWidth - 8) {
          panel.classList.add("align-right");
        }
      }
    });
  });
  document.addEventListener("click", (e) => {
    document.querySelectorAll(".filter-dropdown").forEach((dd) => {
      if (!dd.contains(e.target)) dd.querySelector(".filter-dropdown-panel")?.classList.add("hidden");
    });
  });

  initQrInvert();
  applyViewMode();

  window.addEventListener("antimatter:locale", () => {
    render();
    fillConnFilterPanel();
  });
}

const QR_INVERT_KEY = "antimatter-qr-invert";

function initQrInvert() {
  const btn = document.getElementById("btn-qr-invert");
  const on = localStorage.getItem(QR_INVERT_KEY) === "1";
  applyQrInvert(on);
  if (!btn) return;
  btn.onclick = () => {
    const next = !document.body.classList.contains("qr-invert");
    applyQrInvert(next);
    try { localStorage.setItem(QR_INVERT_KEY, next ? "1" : "0"); } catch (e) { /* ignore */ }
    logEvent(`QR invert: ${next ? "on" : "off"}`);
  };
}

function applyQrInvert(on) {
  document.body.classList.toggle("qr-invert", on);
  const btn = document.getElementById("btn-qr-invert");
  if (btn) {
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

window.AntiMatterUI = {
  syncCodeTypeFields,
  syncHomeKitDerived,
  openCodeDialog,
  renderMtDecode,
  renderZwaveDecode,
};

async function boot() {
  await loadAddonInfo();
  await initI18n();
  bindUi();
  if (window.AntiMatterVaultScanUi) {
    window.AntiMatterVaultScanUi.bindVaultScanUi({
      getVault: () => vault,
      openCodeDialog,
      t,
      uiAlert,
      uiConfirm,
      libUrl: SCAN_LIB_URL,
    });
  }
  await loadVault();
  await loadAreas();
  await loadHaDevices();
  fillDeviceTypeOptions();
  startVaultPolling();
  logEvent(
    `Session started: language=${window.AntiMatterI18n?.getLocale?.() || "?"} ` +
      `theme=${window.AntiMatterTheme?.get?.() || "?"} ` +
      `qr_invert=${document.body.classList.contains("qr-invert") ? "on" : "off"} ` +
      `view_mode=${viewMode}`
  );
}

// Live refresh: pick up codes added from another device (e.g. a phone scan) without F5.
function anyDialogOpen() {
  return !!document.querySelector("dialog[open]");
}

async function pollVault() {
  if (document.hidden || anyDialogOpen()) return;
  try {
    const v = await api("/vault");
    const j = JSON.stringify(v);
    if (j !== lastVaultJson) {
      lastVaultJson = j;
      vault = v;
      render();
    }
  } catch {
    /* ignore transient errors */
  }
}

function startVaultPolling() {
  setInterval(pollVault, 6000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pollVault();
  });
}

boot();
