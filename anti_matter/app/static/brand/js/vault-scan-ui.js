/**
 * Shared scan dialog wiring for AntiMatter vault UIs.
 */
(function (global) {
  /**
   * @param {object} opts
   * @param {() => { codes: object[] }} opts.getVault
   * @param {(code: object|null, prefilled?: object) => void} opts.openCodeDialog
   * @param {(key: string, vars?: object) => string} [opts.t]
   * @param {string} [opts.libUrl] html5-qrcode fallback script
   */
  function bindVaultScanUi(opts) {
    const t =
      opts.t ||
      ((key, vars) => {
        let s = key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            s = s.replace(`{${k}}`, String(v));
          }
        }
        return s;
      });

    const scanDlg = document.getElementById("scan-dialog");
    const readerId = "scan-reader";
    const uiAlert = opts.uiAlert || ((msg) => Promise.resolve(window.alert(msg)));
    const uiConfirm = opts.uiConfirm || ((msg) => Promise.resolve(window.confirm(msg)));

    // Consecutive scans without a custom name would all collide on the same
    // "Scanned device" default — number them so each saved scan stays distinct.
    function nextDefaultName() {
      const base = t("scan.default_name");
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`^${escaped}(?: (\\d+))?$`);
      let maxN = 0;
      let found = false;
      for (const c of opts.getVault().codes || []) {
        const m = re.exec((c.name || "").trim());
        if (!m) continue;
        found = true;
        const n = m[1] ? parseInt(m[1], 10) : 1;
        if (n > maxN) maxN = n;
      }
      return found ? `${base} ${maxN + 1}` : base;
    }

    function applyParsedToForm(parsed) {
      const codeType = parsed.code_type || "matter";
      const typeEl = document.getElementById("code-type");
      if (typeEl) typeEl.value = codeType;
      global.AntiMatterUI?.syncCodeTypeFields?.();

      if (codeType === "homekit") {
        document.getElementById("code-homekit-uri").value =
          parsed.qr_payload || "";
        document.getElementById("code-homekit-pairing").value =
          parsed.manual_code || "";
        if (parsed.setup_id) {
          document.getElementById("code-homekit-setup-id").value =
            parsed.setup_id;
        }
        if (parsed.homekit_category) {
          document.getElementById("code-homekit-category").value =
            parsed.homekit_category;
        }
        global.AntiMatterUI?.syncHomeKitDerived?.();
      } else if (codeType === "zwave") {
        document.getElementById("code-zwave-dsk").value =
          parsed.manual_code || "";
        document.getElementById("code-zwave-qr").value = parsed.qr_payload || "";
      } else {
        document.getElementById("code-manual").value = parsed.manual_code || "";
        document.getElementById("code-qr").value = parsed.qr_payload || "";
      }

      const nameEl = document.getElementById("code-name");
      if (nameEl && !nameEl.value.trim()) {
        nameEl.value = nextDefaultName();
      }
    }

    async function handleParsedText(text) {
      const parsed = global.AntiMatterScan.parseScannedText(text);
      if (!parsed) {
        await uiAlert(t("scan.unrecognized"));
        global.logEvent?.("Scan: unrecognized code");
        return;
      }
      global.logEvent?.(`Scan: captured protocol=${parsed.code_type || "matter"}`);
      const excludeId = document.getElementById("code-id")?.value || null;
      const dup = global.AntiMatterScan.findDuplicate(
        opts.getVault().codes,
        parsed,
        excludeId || null
      );
      if (dup) {
        const msg = t("scan.duplicate", {
          name: dup.name || t("scan.unnamed"),
        });
        global.logEvent?.("Scan: duplicate of existing code detected");
        if (await uiConfirm(msg + "\n" + t("scan.duplicate_open"), t("action.ok"))) {
          scanDlg?.close();
          opts.openCodeDialog(dup);
        }
        return;
      }
      scanDlg?.close();
      opts.openCodeDialog(null);
      applyParsedToForm(parsed);
    }

    function openScanDialog() {
      if (!scanDlg) return;
      scanDlg.showModal();
      const hint = document.getElementById("scan-hint");
      if (hint) {
        hint.textContent = global.AntiMatterScanner.supportsNativeScan()
          ? t("scan.hint_native")
          : global.AntiMatterScanner.supportsCamera()
            ? t("scan.hint_fallback")
            : t("scan.hint_photo");
      }
      if (
        global.AntiMatterScanner.supportsCamera() &&
        (global.AntiMatterScanner.supportsNativeScan() || opts.libUrl)
      ) {
        global.AntiMatterScanner.startCamera({
          containerId: readerId,
          libUrl: opts.libUrl,
          onScan: handleParsedText,
          onError: (err) => {
            console.warn("scan", err);
            if (hint) hint.textContent = t("scan.camera_denied");
          },
        });
      }
    }

    function closeScanDialog() {
      global.AntiMatterScanner.stopCamera();
      const el = document.getElementById(readerId);
      if (el) el.innerHTML = "";
      scanDlg?.close();
    }

    const scanButtons = [
      "btn-scan-code",
      "btn-scan-in-form",
      "btn-scan-homekit",
      "btn-scan-zwave",
    ];
    for (const id of scanButtons) {
      document.getElementById(id)?.addEventListener("click", openScanDialog);
    }
    document.getElementById("scan-stop")?.addEventListener("click", closeScanDialog);
    scanDlg?.addEventListener("close", () => global.AntiMatterScanner.stopCamera());

    const fileInputIds = [
      "scan-file-input",
      "scan-file-in-form",
      "scan-file-homekit",
      "scan-file-zwave",
    ];
    for (const fid of fileInputIds) {
      document.getElementById(fid)?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        global.AntiMatterScanner.scanImageFile(
          file,
          handleParsedText,
          (err) => uiAlert(err.message || t("scan.photo_fail")),
          opts.libUrl
        );
      });
    }
  }

  global.AntiMatterVaultScanUi = { bindVaultScanUi };
})(typeof window !== "undefined" ? window : globalThis);
