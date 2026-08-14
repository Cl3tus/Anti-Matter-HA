/**
 * Shared vault cards (Matter + HomeKit stickers) for Cloud + HA Ingress.
 */
(function (global) {
  function actionLabel(key, fallback) {
    const i18n = global.AntiMatterI18n;
    return i18n && typeof i18n.t === "function"
      ? i18n.t("action." + key)
      : fallback;
  }

  function codeProtocol(code) {
    const ct = String(code?.code_type || "").toLowerCase();
    if (ct === "zwave" || ct === "homekit" || ct === "other") return ct;
    const ZW = global.AntiMatterZWavePayload;
    if (ZW?.hasScannableQr?.(code?.qr_payload)) return "zwave";
    const q = String(code.qr_payload || "").trim();
    if (q.toUpperCase().startsWith("X-HM://")) return "homekit";
    if (q.toUpperCase().startsWith("MT:")) return "matter";
    return "matter";
  }

  function hasMtPayload(code) {
    const q = String(code.qr_payload || "").trim();
    return q.toUpperCase().startsWith("MT:");
  }

  function displayManual(code) {
    if (codeProtocol(code) === "homekit") {
      const HK = global.AntiMatterHomeKitPayload;
      if (HK) return HK.formatPairingDisplay(code.manual_code);
    }
    if (codeProtocol(code) === "zwave") {
      const ZW = global.AntiMatterZWavePayload;
      if (ZW) return ZW.formatDskDisplay(code.manual_code);
    }
    const manual = String(code.manual_code || "").trim();
    if (!manual) return "";
    if (codeProtocol(code) === "other") return manual;
    const digits = manual.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
    return manual;
  }

  // Shared logo slot for the native protocols (Matter/HomeKit/Z-Wave) — same
  // fixed-height slot pattern as "Other"'s brand logo, so every protocol's
  // wordmark occupies identical space regardless of its own aspect ratio.
  function brandLogoHtml(file, label, opts) {
    const assetsPrefix = opts.assetsPrefix || "/assets";
    return `<div class="matter-sticker-brand" aria-label="${label}">
      <img class="matter-sticker-logo" src="${assetsPrefix}/${file}" alt="" decoding="async" />
    </div>`;
  }

  function matterBrandHtml(opts) {
    return brandLogoHtml("matter_logo.svg", "matter", opts);
  }

  // Shared QR slot for every protocol — a bare qr.png (no baked-in logo/card
  // chrome) sized into the same fixed slot as Matter's, so Matter/HomeKit/
  // Z-Wave/Other QR codes are all pixel-identical in the grid.
  function qrSlotHtmlFor(hasQr, code, opts, qrClass) {
    const apiPrefix = opts.qrApiPrefix || "/api";
    if (hasQr) {
      return `<div class="matter-sticker-qr-slot">
        <img class="${qrClass}" src="${apiPrefix}/codes/${code.id}/qr.png?fit=1" alt="" loading="lazy" decoding="async" />
      </div>`;
    }
    return `<div class="matter-sticker-qr-slot" aria-hidden="true">
      <div class="matter-sticker-qr-placeholder">
        <svg class="matter-sticker-qr-ph-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
          <path fill="currentColor" stroke="none" d="M7 12h.01M12 12h.01M17 12h.01M12 17h.01"/>
        </svg>
      </div>
    </div>`;
  }

  function qrSlotHtml(code, opts) {
    return qrSlotHtmlFor(hasMtPayload(code), code, opts, "matter-sticker-qr");
  }

  function buildMatterStickerHtml(code, opts) {
    const escapeHtml = opts.escapeHtml;
    const hasMt = hasMtPayload(code);
    const pin = displayManual(code);
    const brand = matterBrandHtml(opts);

    if (!hasMt && !pin) {
      return `
        <div class="matter-sticker matter-sticker--empty">
          <div class="matter-sticker-box">
            ${brand}
            <p class="matter-sticker-empty-msg">No setup code yet</p>
          </div>
        </div>`;
    }

    const pinBlock = pin
      ? `<p class="matter-sticker-pin">${escapeHtml(pin)}</p>`
      : "";

    return `
      <div class="matter-sticker">
        <div class="matter-sticker-box matter-sticker-box--full">
          ${brand}
          ${qrSlotHtml(code, opts)}
          ${pinBlock}
        </div>
      </div>`;
  }

  // HomeKit and Z-Wave grid cards are now composed exactly like Matter's —
  // logo slot + QR slot (bare qr.png, not the baked server card.svg) + a
  // CSS-styled pin — so the QR size and pin typography are pixel-identical
  // across every protocol instead of depending on how a flattened SVG scales.
  function buildHomeKitStickerHtml(code, opts) {
    const escapeHtml = opts.escapeHtml;
    const HK = global.AntiMatterHomeKitPayload;
    const hasQr =
      HK && typeof HK.hasScannableQr === "function"
        ? HK.hasScannableQr(code.qr_payload)
        : String(code.qr_payload || "")
            .toUpperCase()
            .startsWith("X-HM://");
    const pin = displayManual(code);
    const brand = brandLogoHtml("homekit_logo.png", "homekit", opts);

    if (!hasQr && !pin) {
      return `
        <div class="homekit-sticker">
          <div class="homekit-sticker-box">
            ${brand}
            <p class="matter-sticker-empty-msg">No HomeKit code yet</p>
          </div>
        </div>`;
    }

    const pinBlock = pin ? `<p class="matter-sticker-pin">${escapeHtml(pin)}</p>` : "";
    return `
      <div class="homekit-sticker">
        <div class="homekit-sticker-box homekit-sticker-box--full">
          ${brand}
          ${qrSlotHtmlFor(hasQr, code, opts, "matter-sticker-qr")}
          ${pinBlock}
        </div>
      </div>`;
  }

  function buildZWaveStickerHtml(code, opts) {
    const escapeHtml = opts.escapeHtml;
    const ZW = global.AntiMatterZWavePayload;
    const hasQr = ZW?.hasScannableQr?.(code.qr_payload);
    const dsk = String(code.manual_code || "").trim();
    const pin = dsk ? ZW?.pinFromDsk?.(dsk) || "" : "";
    const brand = brandLogoHtml("zwave_logo.png", "z-wave", opts);

    if (!hasQr && !pin) {
      return `
        <div class="zwave-sticker">
          <div class="zwave-sticker-box">
            ${brand}
            <p class="matter-sticker-empty-msg">No Z-Wave code yet</p>
          </div>
        </div>`;
    }

    const pinBlock = pin ? `<p class="matter-sticker-pin">${escapeHtml(pin)}</p>` : "";
    return `
      <div class="zwave-sticker">
        <div class="zwave-sticker-box zwave-sticker-box--full">
          ${brand}
          ${qrSlotHtmlFor(hasQr, code, opts, "matter-sticker-qr")}
          ${pinBlock}
        </div>
      </div>`;
  }

  function hasGenericPayload(code) {
    return Boolean(String(code.qr_payload || "").trim());
  }

  function genericQrSlotHtml(code, opts) {
    // .generic-sticker-qr is now visually identical to .matter-sticker-qr
    // (the old dblclick-to-decode class conflict this avoided no longer
    // exists — grid double-click always opens quick-view) but keeping its
    // own class name costs nothing and avoids implying "Other" has decode.
    return qrSlotHtmlFor(hasGenericPayload(code), code, opts, "generic-sticker-qr");
  }

  // Known standards get a bundled brand logo, same treatment as Matter's own
  // wordmark — falls back to the plain text label if the asset is missing (or
  // not one of these), so adding a new standard's logo later is a drop-in.
  const KNOWN_OTHER_STANDARDS = [
    { test: /zigbee/i, file: "zigbee_logo.png" },
    { test: /tuya/i, file: "tuya_logo.svg" },
  ];

  // Shared with the quickview overlay (app.js) so both places agree on which
  // "Other" standards get a bundled logo, without duplicating the list.
  function otherStandardLogoFile(standard) {
    const known = KNOWN_OTHER_STANDARDS.find((s) => s.test.test(standard || ""));
    return known ? known.file : null;
  }

  function standardBrandHtml(standard, opts) {
    const file = otherStandardLogoFile(standard);
    if (!file) return "";
    const assetsPrefix = opts.assetsPrefix || "/assets";
    return `<div class="generic-sticker-brand" aria-label="${opts.escapeHtml(standard)}">
      <img class="generic-sticker-logo" src="${assetsPrefix}/${file}" alt=""
           decoding="async" onerror="this.style.display='none'" />
    </div>`;
  }

  function buildGenericStickerHtml(code, opts) {
    const escapeHtml = opts.escapeHtml;
    const hasQr = hasGenericPayload(code);
    const pin = displayManual(code);
    const standard = String(code.custom_standard || "").trim();
    const brand = standardBrandHtml(standard, opts);
    // A recognized standard shows its logo instead of the plain text label
    // (mirrors Matter/HomeKit/Z-Wave, which show a logo rather than the
    // protocol name spelled out).
    const standardBlock = brand
      ? brand
      : standard
        ? `<p class="generic-sticker-standard">${escapeHtml(standard)}</p>`
        : "";

    if (!hasQr && !pin) {
      return `
        <div class="generic-sticker generic-sticker--empty">
          <div class="generic-sticker-box">
            ${standardBlock}
            <p class="matter-sticker-empty-msg">No code yet</p>
          </div>
        </div>`;
    }

    const pinBlock = pin
      ? `<p class="matter-sticker-pin">${escapeHtml(pin)}</p>`
      : "";

    return `
      <div class="generic-sticker">
        <div class="generic-sticker-box generic-sticker-box--full">
          ${standardBlock}
          ${genericQrSlotHtml(code, opts)}
          ${pinBlock}
        </div>
      </div>`;
  }

  function buildStickerHtml(code, opts) {
    const proto = codeProtocol(code);
    if (proto === "homekit") return buildHomeKitStickerHtml(code, opts);
    if (proto === "zwave") return buildZWaveStickerHtml(code, opts);
    if (proto === "other") return buildGenericStickerHtml(code, opts);
    return buildMatterStickerHtml(code, opts);
  }

  function buildCodeCardHtml(code, opts) {
    const escapeHtml = opts.escapeHtml;
    const iconsHref = opts.iconsHref || "/brand/icons.svg";
    const proto = codeProtocol(code);
    const icons =
      global.AntiMatterVaultShareUi?.cardIconButtonsHtml({
        iconsHref,
        showDownload: true,
        showDecode: proto === "matter" || proto === "zwave",
        downloadLabel: actionLabel("download", "Download"),
        editLabel: actionLabel("edit", "Edit"),
        deleteLabel: actionLabel("delete", "Delete"),
        decodeLabel: actionLabel("decode", "Decode"),
      }) || "";

    const wrapClass =
      proto === "homekit"
        ? "homekit-label-wrap"
        : proto === "zwave"
          ? "zwave-label-wrap"
          : proto === "other"
            ? "other-label-wrap"
            : "matter-label-wrap";
    const cardClass =
      proto === "homekit"
        ? "code-card homekit-sticker-card"
        : proto === "zwave"
          ? "code-card zwave-sticker-card"
          : proto === "other"
            ? "code-card generic-sticker-card"
            : "code-card matter-sticker-card";

    return `
      <div class="${wrapClass}">
        <div class="card-actions-overlay">${icons}</div>
        ${buildStickerHtml(code, opts)}
      </div>
      <p class="code-card-caption" title="${escapeHtml(code.name)}">${escapeHtml(code.name)}</p>
    `;
  }

  function wireCodeCard(card, code, handlers) {
    const decodeBtn = card.querySelector("[data-decode]");
    if (decodeBtn && handlers.onDecode) {
      decodeBtn.onclick = (e) => {
        e.stopPropagation();
        handlers.onDecode(code);
      };
    }
    // Double-click anywhere on the card — including the QR image — opens
    // quickview (wired at the card level in app.js); decode is reached via the
    // small icon button above, not via double-click.
    const dlBtn = card.querySelector("[data-download]");
    if (dlBtn && handlers.onDownload) {
      dlBtn.onclick = (e) => {
        e.stopPropagation();
        handlers.onDownload(code);
      };
    }
    const editBtn = card.querySelector("[data-edit]");
    if (editBtn && handlers.onEdit) {
      editBtn.onclick = (e) => {
        e.stopPropagation();
        handlers.onEdit(code);
      };
    }
    const delBtn = card.querySelector("[data-delete]");
    if (delBtn && handlers.onDelete) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        handlers.onDelete(code);
      };
    }
  }

  // Category names are stored exactly as typed (matching is already case-insensitive,
  // see _find_category_by_name in main.py) — only capitalized for display.
  function capitalizeFirst(s) {
    s = String(s || "");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function categoryNameDefault(vault, categoryId) {
    const c = vault.categories.find((x) => x.id === categoryId);
    const none =
      global.AntiMatterI18n?.t?.("categories.none") ?? "Uncategorized";
    return c ? capitalizeFirst(c.name) : none;
  }

  function fillCategoryChecks(panel, toggle, vault, selectedIds) {
    const selected = new Set(selectedIds || []);
    const baseLabel = global.AntiMatterI18n?.t?.("code.category") ?? "Category";
    const noneLabel = global.AntiMatterI18n?.t?.("code.category_none") ?? "No category";
    const updateToggle = () => {
      if (!toggle) return;
      const count = panel.querySelectorAll("input[type=checkbox]:checked").length;
      toggle.textContent = count ? `${baseLabel} (${count})` : noneLabel;
    };
    panel.innerHTML = "";
    if (!vault.categories.length) {
      const hint = global.AntiMatterI18n?.t?.("filter.no_options") ?? "No options";
      panel.innerHTML = `<p class="form-hint">${hint}</p>`;
      updateToggle();
      return;
    }
    for (const cat of vault.categories) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = cat.id;
      input.checked = selected.has(cat.id);
      input.onchange = updateToggle;
      const span = document.createElement("span");
      span.textContent = capitalizeFirst(cat.name);
      label.appendChild(input);
      label.appendChild(span);
      panel.appendChild(label);
    }
    updateToggle();
  }

  global.AntiMatterVaultCards = {
    actionLabel,
    codeProtocol,
    hasMtPayload,
    displayManual,
    otherStandardLogoFile,
    buildCodeCardHtml,
    wireCodeCard,
    categoryNameDefault,
    fillCategoryChecks,
  };
})(typeof window !== "undefined" ? window : globalThis);
