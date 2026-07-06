/**
 * AntiMatter admin UI — relative API paths for HA ingress.
 */
const API = "./api";
const { t, initI18n, setLocale } = window.AntiMatterI18n;

let vault = { categories: [], codes: [] };
let activeCategories = new Set();
let categoryIconPicker = null;
const NONE_CATEGORY_ID = "__none__";

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

let lastVaultJson = "";

async function loadVault() {
  vault = await api("/vault");
  lastVaultJson = JSON.stringify(vault);
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
  for (const cat of sorted) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "category-btn" + (activeCategories.has(cat.id) ? " active" : "");
    const mark = window.AntiMatterCategoryIcons
      ? window.AntiMatterCategoryIcons.markMarkup(cat, BRAND_PREFIX)
      : `<span class="category-dot" style="background:${cat.color}"></span>`;
    btn.innerHTML = `${mark}${escapeHtml(cat.name)}`;
    btn.onclick = () => {
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
  }
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

function renderTable() {
  const tbody = document.getElementById("codes-table-body");
  if (!tbody) return;
  const codes = filteredCodes();
  tbody.innerHTML = codes
    .map((c) => {
      const proto =
        window.AntiMatterVaultCards?.codeProtocol?.(c) || c.code_type || "matter";
      return `<tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(proto)}</td>
        <td>${escapeHtml(c.device_vendor)}</td>
        <td>${escapeHtml(c.device_product)}</td>
        <td>${escapeHtml(c.device_type)}</td>
        <td>${escapeHtml(c.area)}</td>
        <td>${escapeHtml(categoryName(c.category_id))}</td>
      </tr>`;
    })
    .join("");
}

function openTableDialog() {
  renderTable();
  document.getElementById("table-dialog").showModal();
}

function renderCodes() {
  const grid = document.getElementById("codes-grid");
  const empty = document.getElementById("empty-state");
  const codes = filteredCodes();
  grid.innerHTML = "";
  empty.classList.toggle("hidden", codes.length > 0);
  updateStatusbar(codes.length);

  const Cards = window.AntiMatterVaultCards;
  for (const code of codes) {
    const card = document.createElement("article");
    const proto = Cards?.codeProtocol?.(code) || "matter";
    card.className =
      "code-card " +
      (proto === "homekit"
        ? "homekit-sticker-card"
        : proto === "zwave"
          ? "zwave-sticker-card"
          : "matter-sticker-card");
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
      });
    }
    grid.appendChild(card);
  }
}

function render() {
  fillAttributeFilters();
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
  setVal("code-homekit-pairing", code?.manual_code);
  setVal("code-homekit-setup-id", code?.setup_id);
  const catEl = document.getElementById("code-homekit-category");
  if (catEl) catEl.value = code?.homekit_category || "other";
  setVal("code-homekit-uri", proto === "homekit" ? code?.qr_payload : "");
  if (proto === "homekit") syncHomeKitDerived();
  setVal("code-zwave-dsk", proto === "zwave" ? code?.manual_code : "");
  setVal("code-zwave-qr", proto === "zwave" ? code?.qr_payload : "");
  setVal("code-notes", code?.notes);
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
  if (id) {
    await api(`/categories/${id}`, { method: "PUT", body: JSON.stringify(body) });
  } else {
    await api("/categories", { method: "POST", body: JSON.stringify(body) });
  }
  document.getElementById("category-dialog").close();
  await loadVault();
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
  document.getElementById("btn-add-code").onclick = () => openCodeDialog();
  document.getElementById("btn-add-category").onclick = () => openCategoryDialog();
  document.getElementById("code-form").onsubmit = saveCode;
  document.getElementById("category-form").onsubmit = saveCategory;
  document.getElementById("search").oninput = renderCodes;

  for (const [id, field] of ATTR_FILTER_FIELDS) {
    document.getElementById(id)?.addEventListener("change", (e) => {
      activeFilters[field] = e.target.value;
      renderCodes();
    });
  }

  document.getElementById("btn-table-view").onclick = openTableDialog;

  document.getElementById("filter-all").onclick = () => {
    activeCategories.clear();
    render();
  };

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
    try {
      await api(`/codes/${id}/sync-from-ha`, { method: "POST" });
      await loadVault();
      openCodeDialog(vault.codes.find((c) => c.id === id));
    } catch (err) {
      await uiAlert(err.message);
    }
  };

  initQrInvert();

  window.addEventListener("antimatter:locale", () => {
    render();
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
      libUrl: SCAN_LIB_URL,
    });
  }
  await loadVault();
  await loadAreas();
  updateStorageHint();
  startVaultPolling();
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
