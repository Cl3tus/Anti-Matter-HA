/**
 * Z-Wave SmartStart QR (SDS13937) — aligned with zwave-js/qr and Silicon Labs format.
 * QR text: decimal digits only; lead-in 90 ('Z'), version 01 = SmartStart.
 */
(function (global) {
  const LEAD_IN = 90;
  const VERSION_SMART_START = 1;

  // Matches zwave-js's ProvisioningInformationType enum (packages/core/src/qr/definitions.ts).
  const TLV_PRODUCT_TYPE = 0;
  const TLV_PRODUCT_ID = 1;
  const TLV_SUPPORTED_PROTOCOLS = 4;

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  /** @returns {string} */
  function formatDsk(dskDigits) {
    const d = digitsOnly(dskDigits);
    if (d.length !== 40) return String(dskDigits || "").trim();
    const parts = [];
    for (let i = 0; i < 8; i++) {
      parts.push(d.slice(i * 5, i * 5 + 5));
    }
    return parts.join("-");
  }

  function parseDskGroups(dskDigits) {
    const d = digitsOnly(dskDigits);
    if (d.length !== 40) return null;
    const groups = [];
    for (let i = 0; i < 8; i++) {
      const g = parseInt(d.slice(i * 5, i * 5 + 5), 10);
      if (Number.isNaN(g) || g < 0 || g > 65535) return null;
      groups.push(g);
    }
    return groups;
  }

  function isValidDskFormatted(value) {
    const s = String(value || "").trim();
    if (!/^\d{5}(-\d{5}){7}$/.test(s)) return false;
    return parseDskGroups(s) !== null;
  }

  function pinFromDsk(dskDigits) {
    const d = digitsOnly(dskDigits);
    return d.length >= 5 ? d.slice(0, 5) : "";
  }

  function checksumForBody(body) {
    const enc = new TextEncoder().encode(body);
    return global.crypto.subtle.digest("SHA-1", enc).then((buf) => {
      const b = new Uint8Array(buf);
      return (b[0] << 8) | b[1];
    });
  }

  function checksumForBodySync(body) {
    return null;
  }

  async function validateChecksum(qrDigits) {
    if (qrDigits.length < 9) return false;
    const given = parseInt(qrDigits.slice(4, 9), 10);
    const body = qrDigits.slice(9);
    if (!global.crypto?.subtle) return true;
    const expected = await checksumForBody(body);
    return given === expected;
  }

  function parseTlvs(tail) {
    const meta = {};
    let pos = 0;
    while (pos + 4 <= tail.length) {
      const typeCrit = parseInt(tail.slice(pos, pos + 2), 10);
      pos += 2;
      const typ = typeCrit >> 1;
      const len = parseInt(tail.slice(pos, pos + 2), 10);
      pos += 2;
      if (len < 0 || pos + len > tail.length) break;
      const data = tail.slice(pos, pos + len);
      pos += len;
      if (typ === TLV_PRODUCT_TYPE && len >= 10) {
        meta.genericDeviceClass = parseInt(data.slice(0, 5), 10) >> 8;
        meta.specificDeviceClass = parseInt(data.slice(0, 5), 10) & 0xff;
        meta.installerIconType = parseInt(data.slice(5, 10), 10);
      } else if (typ === TLV_PRODUCT_ID && len >= 20) {
        meta.manufacturerId = parseInt(data.slice(0, 5), 10);
        meta.productType = parseInt(data.slice(5, 10), 10);
        meta.productId = parseInt(data.slice(10, 15), 10);
        const app = parseInt(data.slice(15, 20), 10);
        meta.applicationVersion = `${app >> 8}.${app & 0xff}`;
      } else if (typ === TLV_SUPPORTED_PROTOCOLS && (len === 2 || len === 3 || len === 5)) {
        const bits = parseInt(data, 10);
        meta.supportedProtocols = {
          zwave: !!(bits & 0x01),
          zwaveLongRange: !!(bits & 0x02),
        };
      }
    }
    return meta;
  }

  // RequestedKeys byte (3 decimal digits at QR position 9-12) — bit N corresponds to
  // SecurityClass ordinal N in zwave-js: 0=S2_Unauthenticated, 1=S2_Authenticated,
  // 2=S2_AccessControl, 7=S0_Legacy (bits 3-6 are unused/reserved).
  function parseRequestedSecurityClasses(requestedKeysDigits) {
    const bits = parseInt(requestedKeysDigits, 10) || 0;
    return {
      s2Unauthenticated: !!(bits & 0x01),
      s2Authenticated: !!(bits & 0x02),
      s2AccessControl: !!(bits & 0x04),
      s0Legacy: !!(bits & 0x80),
    };
  }

  /**
   * @returns {{ qr: string, dsk: string, pin: string, meta: object, version: number }|null}
   */
  function parseQrDigits(qrDigits) {
    const d = digitsOnly(qrDigits);
    if (d.length < 52 || !d.startsWith("90")) return null;
    const version = parseInt(d.slice(2, 4), 10);
    const dskRaw = d.slice(12, 52);
    if (!parseDskGroups(dskRaw)) return null;
    const meta = parseTlvs(d.slice(52));
    return {
      qr: d,
      dsk: formatDsk(dskRaw),
      pin: pinFromDsk(dskRaw),
      meta,
      version,
      smartStart: version === VERSION_SMART_START,
      requestedSecurityClasses: parseRequestedSecurityClasses(d.slice(9, 12)),
    };
  }

  function extractQrString(text) {
    const d = digitsOnly(text);
    if (!d.startsWith("90")) return "";
    let best = "";
    for (let end = 90; end <= Math.min(d.length, 200); end++) {
      const trial = d.slice(0, end);
      if (parseQrDigits(trial)) best = trial;
    }
    if (best) return best;
    const parsed = parseQrDigits(d);
    return parsed ? parsed.qr : "";
  }

  function hasScannableQr(qrPayload) {
    // extractQrString only ever returns non-empty when it found a subset that
    // parseQrDigits fully validated (checksum + DSK) — no extra length threshold
    // needed, and a hardcoded 90 wrongly rejected valid QR codes with a short or
    // missing TLV tail (the spec's actual minimum is 52: see parseQrDigits).
    return !!extractQrString(qrPayload);
  }

  function normalizeFields(manualCode, qrPayload) {
    const qrIn = String(qrPayload || "").trim();
    const qrExtracted = qrIn ? extractQrString(qrIn) : "";
    const parsed = qrExtracted ? parseQrDigits(qrExtracted) : null;

    let dskDigits = "";
    if (parsed) {
      dskDigits = digitsOnly(parsed.dsk);
    } else if (isValidDskFormatted(manualCode)) {
      dskDigits = digitsOnly(manualCode);
    } else {
      const m = digitsOnly(manualCode);
      if (m.length === 40) dskDigits = m;
    }

    return {
      manual_code: dskDigits ? formatDsk(dskDigits) : String(manualCode || "").trim(),
      qr_payload: parsed ? parsed.qr : qrExtracted,
      zwave_pin: dskDigits ? pinFromDsk(dskDigits) : pinFromDsk(manualCode),
      zwave_meta: parsed?.meta || {},
    };
  }

  function codeProtocol(code) {
    const ct = String(code?.code_type || "").toLowerCase();
    if (ct === "zwave") return "zwave";
    if (ct === "homekit") return "homekit";
    if (hasScannableQr(code?.qr_payload)) return "zwave";
    const q = String(code?.qr_payload || "").trim().toUpperCase();
    if (q.startsWith("X-HM://")) return "homekit";
    if (q.startsWith("MT:")) return "matter";
    return "matter";
  }

  function formatDskDisplay(manualCode) {
    const formatted = formatDsk(manualCode);
    return formatted || String(manualCode || "").trim();
  }

  function metaSummary(meta) {
    if (!meta || !meta.manufacturerId) return "";
    const parts = [];
    if (meta.manufacturerId != null) {
      parts.push(`Mfg ${meta.manufacturerId}`);
    }
    if (meta.productType != null && meta.productId != null) {
      parts.push(`Type ${meta.productType} / ID ${meta.productId}`);
    }
    return parts.join(" · ");
  }

  global.AntiMatterZWavePayload = {
    LEAD_IN,
    formatDsk,
    formatDskDisplay,
    pinFromDsk,
    isValidDskFormatted,
    parseQrDigits,
    extractQrString,
    hasScannableQr,
    normalizeFields,
    codeProtocol,
    metaSummary,
    validateChecksum,
  };
})(typeof window !== "undefined" ? window : globalThis);
