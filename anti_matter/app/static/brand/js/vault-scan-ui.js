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
    const fileInput = document.getElementById("scan-file-input");

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
        nameEl.value = t("scan.default_name");
      }
    }

    function handleParsedText(text) {
      const parsed = global.AntiMatterScan.parseScannedText(text);
      if (!parsed) {
        alert(t("scan.unrecognized"));
        return;
      }
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
        if (confirm(msg + "\n\n" + t("scan.duplicate_open"))) {
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

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      global.AntiMatterScanner.scanImageFile(
        file,
        handleParsedText,
        (err) => alert(err.message || t("scan.photo_fail")),
        opts.libUrl
      );
    });
  }

  global.AntiMatterVaultScanUi = { bindVaultScanUi };
})(typeof window !== "undefined" ? window : globalThis);
