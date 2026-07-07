/**
 * AntiMatter admin UI — relative API paths for HA ingress.
 */
const API = "./api";
const { t, initI18n, setLocale } = window.AntiMatterI18n;

let vault = { categories: [], codes: [] };
let activeCategories = new Set();

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
    const e = new Error(err.detail || res.statusText);
    e.status = res.status;
    e.existing = err.existing;
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

function categoryName(id) {
  if (window.AntiMatterVaultCards) {
    return window.AntiMatterVaultCards.categoryNameDefault(vault, id);
  }
  const c = vault.categories.find((x) => x.id === id);
  return c ? c.name : "Uncategorized";
}

const ATTR_FILTER_FIELDS = [
  ["filter-vendor", "device_vendor", "filter.vendor"],
  ["filter-product", "device_product", "filter.product"],
  ["filter-type", "device_type", "filter.type"],
  ["filter-area", "area", "filter.area"],
];
const activeFilters = { device_vendor: "", device_product: "", device_type: "", area: "" };

const BOOL_FILTER_FIELDS = [
  ["filter-in-use", "in_use", "code.in_use"],
];
const boolFilters = {};

// Connectivity: one dropdown with checkboxes instead of 5 separate selects.
// Checking any box OR-filters codes down to ones with at least one of the checked types.
const CONN_FILTER_FIELDS = [
  ["conn_wifi", "code.conn_wifi"],
  ["conn_matter", "code.conn_matter"],
  ["conn_zigbee", "code.conn_zigbee"],
  ["conn_bluetooth", "code.conn_bluetooth"],
  ["conn_zwave", "code.conn_zwave"],
];
const connFilters = new Set();

function fillAttributeFilters() {
  for (const [id, field, labelKey] of ATTR_FILTER_FIELDS) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const current = activeFilters[field];
    const values = Array.from(
      new Set(vault.codes.map((c) => (c[field] || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    if (!values.includes(current)) activeFilters[field] = "";
    sel.innerHTML =
      `<option value="">${escapeHtml(t(labelKey))}</option>` +
      values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    sel.value = activeFilters[field];
  }
}

function fillBoolFilters() {
  for (const [id, field, labelKey] of BOOL_FILTER_FIELDS) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const label = t(labelKey);
    const current = boolFilters[field] || "";
    sel.innerHTML =
      `<option value="">${escapeHtml(label)}: ${escapeHtml(t("filter.all_short"))}</option>` +
      `<option value="yes">${escapeHtml(label)}: ${escapeHtml(t("filter.yes"))}</option>` +
      `<option value="no">${escapeHtml(label)}: ${escapeHtml(t("filter.no"))}</option>`;
    sel.value = current;
  }
}

function buildConnFilterPanel() {
  const panel = document.getElementById("conn-filter-panel");
  if (!panel) return;
  panel.innerHTML = CONN_FILTER_FIELDS.map(
    ([field, labelKey]) =>
      `<label><input type="checkbox" data-conn-field="${field}" ${connFilters.has(field) ? "checked" : ""} /> <span>${escapeHtml(t(labelKey))}</span></label>`
  ).join("");
  panel.querySelectorAll("input[data-conn-field]").forEach((cb) => {
    cb.onchange = () => {
      const field = cb.dataset.connField;
      if (cb.checked) connFilters.add(field);
      else connFilters.delete(field);
      updateConnFilterToggleLabel();
      renderCodes();
    };
  });
  updateConnFilterToggleLabel();
}

function updateConnFilterToggleLabel() {
  const btn = document.getElementById("conn-filter-toggle");
  if (!btn) return;
  const base = t("code.connectivity");
  btn.textContent = connFilters.size ? `${base} (${connFilters.size})` : base;
}

function filteredCodes() {
  let codes = vault.codes;
  if (activeCategories.size) {
    codes = codes.filter((c) =>
      activeCategories.has(c.category_id || NONE_CATEGORY_ID)
    );
  }
  for (const [, field] of ATTR_FILTER_FIELDS) {
    const val = activeFilters[field];
    if (val) codes = codes.filter((c) => (c[field] || "") === val);
  }
  for (const [, field] of BOOL_FILTER_FIELDS) {
    const val = boolFilters[field];
    if (val === "yes") codes = codes.filter((c) => Boolean(c[field]));
    else if (val === "no") codes = codes.filter((c) => !c[field]);
  }
  if (connFilters.size) {
    codes = codes.filter((c) => [...connFilters].some((field) => c[field]));
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
  return `<li>
    <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
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
    btn.innerHTML = `${mark}${escapeHtml(cat.name)}`;
    btn.onclick = (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        handleCategorySelectClick(e, cat, i, sorted);
        return;
      }
      if (activeCategories.has(cat.id)) activeCategories.delete(cat.id);
      else activeCategories.add(cat.id);
      render();
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

function connectivitySummary(c) {
  return Object.keys(CONN_LABELS)
    .filter((k) => c[k])
    .map((k) => CONN_LABELS[k])
    .join(", ");
}

function renderTable() {
  const tbody = document.getElementById("codes-table-body");
  if (!tbody) return;
  const codes = filteredCodes();
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
        <td>${escapeHtml(categoryName(c.category_id))}</td>
        <td>${c.in_use ? "✓" : ""}</td>
        <td>${escapeHtml(connectivitySummary(c))}</td>
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

function buildQuickMeta(code, proto) {
  const parts = [];
  if (code.device_vendor) parts.push(`${t("filter.vendor")}: ${code.device_vendor}`);
  if (code.device_product) parts.push(`${t("filter.product")}: ${code.device_product}`);
  if (code.device_type) parts.push(`${t("filter.type")}: ${code.device_type}`);
  if (code.area) parts.push(`${t("filter.area")}: ${code.area}`);
  parts.push(`${t("code.category")}: ${categoryName(code.category_id)}`);
  parts.push(`${t("code.protocol")}: ${proto}`);
  parts.push(`${t("code.in_use")}: ${code.in_use ? t("filter.yes") : t("filter.no")}`);
  const conn = connectivitySummary(code);
  if (conn) parts.push(`${t("code.connectivity")}: ${conn}`);
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
      ? `${API}/codes/${code.id}/card.svg`
      : `${API}/codes/${code.id}/qr.png`;
  wrap.innerHTML = `<img src="${src}" alt="" />`;
  if (proto === "matter") {
    wrap.querySelector("img").ondblclick = () => openMtDecodeDialog(code);
  }
  document.getElementById("quickview-manual").textContent =
    Cards?.displayManual?.(code) || code.manual_code || "";
  document.getElementById("quickview-meta").textContent = buildQuickMeta(code, proto);
  document.getElementById("quickview-edit").onclick = () => {
    document.getElementById("quickview-dialog").close();
    openCodeDialog(code);
  };
  document.getElementById("quickview-download").onclick = () => downloadCode(code);
  const decodeBtn = document.getElementById("quickview-decode");
  if (decodeBtn) {
    decodeBtn.classList.toggle("hidden", proto !== "matter");
    decodeBtn.onclick = () => openMtDecodeDialog(code);
  }
  const dlg = document.getElementById("quickview-dialog");
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
        onDecode: openMtDecodeDialog,
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
  fillAttributeFilters();
  fillBoolFilters();
  renderCategories();
  renderCodes();
  fillCategorySelect();
  const fa = document.getElementById("filter-all");
  if (fa) fa.classList.toggle("active", activeCategories.size === 0);
}

function fillCategorySelect() {
  const sel = document.getElementById("code-category");
  if (window.AntiMatterVaultCards) {
    window.AntiMatterVaultCards.fillCategorySelect(sel, vault);
    return;
  }
  sel.innerHTML = `<option value="">No category</option>`;
  for (const cat of vault.categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  }
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
    haDetails.open = Boolean(code?.ha_link?.entity_id || code?.ha_link?.attribute);
  }
  document.getElementById("code-category").value = code?.category_id || "";
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
  setVal("code-notes", code?.notes);
  document.getElementById("code-in-use").checked = Boolean(code?.in_use);
  document.getElementById("code-conn-wifi").checked = Boolean(code?.conn_wifi);
  document.getElementById("code-conn-matter").checked = Boolean(code?.conn_matter);
  document.getElementById("code-conn-zigbee").checked = Boolean(code?.conn_zigbee);
  document.getElementById("code-conn-bluetooth").checked = Boolean(code?.conn_bluetooth);
  document.getElementById("code-conn-zwave").checked = Boolean(code?.conn_zwave);
  setVal("code-ha-entity", code?.ha_link?.entity_id);
  setVal("code-ha-attr", code?.ha_link?.attribute);
  dlg.showModal();
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
    category_id: document.getElementById("code-category").value || null,
    notes: trimVal("code-notes"),
    in_use: document.getElementById("code-in-use").checked,
    conn_wifi: document.getElementById("code-conn-wifi").checked,
    conn_matter: document.getElementById("code-conn-matter").checked,
    conn_zigbee: document.getElementById("code-conn-zigbee").checked,
    conn_bluetooth: document.getElementById("code-conn-bluetooth").checked,
    conn_zwave: document.getElementById("code-conn-zwave").checked,
    ha_link: {
      entity_id: trimVal("code-ha-entity") || null,
      attribute: trimVal("code-ha-attr") || null,
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
    const sel = document.getElementById(categoryCreateTargetSelectId);
    if (sel) sel.value = created.id;
  }
  categoryCreateTargetSelectId = null;
}

async function loadAddonInfo() {
  try {
    const info = await api("/info");
    if (info?.language && info.language !== "auto") {
      window.ADDON_LANGUAGE = info.language;
    }
    const v = document.getElementById("app-version");
    if (v && info?.version) v.textContent = "v" + info.version;
  } catch {
    /* ignore — defaults apply */
  }
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

function updateStorageHint() {
  const el = document.getElementById("backup-status");
  if (el) el.textContent = t("storage.hint");
}

function bindUi() {
  window.AntiMatterCategoryColor?.bind();
  ensureCategoryIconPicker();
  document.getElementById("code-type").onchange = syncCodeTypeFields;
  document
    .getElementById("code-homekit-uri")
    ?.addEventListener("input", syncHomeKitDerived);
  document
    .getElementById("code-homekit-pairing")
    ?.addEventListener("input", syncHomeKitDerived);
  document.getElementById("code-mt-decode")?.addEventListener("toggle", renderMtDecode);
  document.getElementById("code-qr")?.addEventListener("input", renderMtDecode);
  document.getElementById("code-manual")?.addEventListener("input", renderMtDecode);
  document.getElementById("code-device-vendor")?.addEventListener("input", () => markDeviceFieldUserEdited("code-device-vendor"));
  document.getElementById("code-device-product")?.addEventListener("input", () => markDeviceFieldUserEdited("code-device-product"));
  document.getElementById("btn-add-code").onclick = () => openCodeDialog();
  document.getElementById("btn-add-category").onclick = () => {
    categoryCreateTargetSelectId = null;
    openCategoryDialog();
  };
  document.getElementById("btn-add-category-inline")?.addEventListener("click", () => {
    categoryCreateTargetSelectId = "code-category";
    openCategoryDialog();
  });
  document.getElementById("code-form").onsubmit = saveCode;
  document.getElementById("category-form").onsubmit = saveCategory;
  document.getElementById("search").oninput = renderCodes;

  for (const [id, field] of ATTR_FILTER_FIELDS) {
    document.getElementById(id)?.addEventListener("change", (e) => {
      activeFilters[field] = e.target.value;
      renderCodes();
    });
  }
  for (const [id, field] of BOOL_FILTER_FIELDS) {
    document.getElementById(id)?.addEventListener("change", (e) => {
      boolFilters[field] = e.target.value;
      renderCodes();
    });
  }

  document.getElementById("btn-table-view").onclick = toggleViewMode;
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
  };

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
      await api(`/${path}/${restoreBtn.dataset.restore}/restore`, { method: "POST" });
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

  document.getElementById("btn-sync-ha").onclick = async () => {
    const id = document.getElementById("code-id").value;
    if (!id) {
      await uiAlert(t("alert.save_before_sync"));
      return;
    }
    const entity_id = trimVal("code-ha-entity") || null;
    const attribute = trimVal("code-ha-attr") || null;
    if (!entity_id || !attribute) {
      const haDetails = document.getElementById("code-ha-details");
      if (haDetails) haDetails.open = true;
    }
    if (!entity_id) {
      await uiAlert(t("alert.ha_entity_required"));
      return;
    }
    if (!attribute) {
      await uiAlert(t("alert.ha_attribute_required"));
      return;
    }
    try {
      // The server pulls from the *saved* ha_link, not the live form — persist it first
      // so editing Entity ID/Attribute and clicking Pull immediately works.
      await api(`/codes/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ha_link: { entity_id, attribute } }),
      });
      await api(`/codes/${id}/sync-from-ha`, { method: "POST" });
      await loadVault();
      openCodeDialog(vault.codes.find((c) => c.id === id));
    } catch (err) {
      await uiAlert(err.message);
    }
  };

  buildConnFilterPanel();
  document.getElementById("conn-filter-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("conn-filter-panel")?.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    const dd = document.getElementById("conn-filter-dropdown");
    if (dd && !dd.contains(e.target)) {
      document.getElementById("conn-filter-panel")?.classList.add("hidden");
    }
  });

  initQrInvert();
  applyViewMode();

  window.addEventListener("antimatter:locale", () => {
    render();
    buildConnFilterPanel();
    updateStorageHint();
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
  refreshBackupStatus: updateStorageHint,
  syncCodeTypeFields,
  syncHomeKitDerived,
  openCodeDialog,
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
  updateStorageHint();
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
