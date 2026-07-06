"""Z-Wave SmartStart QR (SDS13937) — parity with zwave-js/qr."""

from __future__ import annotations

import hashlib
import re
from typing import Any

LEAD_IN = 90
VERSION_SMART_START = 1
TLV_PRODUCT_TYPE = 0
TLV_PRODUCT_ID = 2


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def format_dsk(dsk_digits: str) -> str:
    d = _digits_only(dsk_digits)
    if len(d) != 40:
        return (dsk_digits or "").strip()
    return "-".join(d[i : i + 5] for i in range(0, 40, 5))


def parse_dsk_groups(dsk_digits: str) -> list[int] | None:
    d = _digits_only(dsk_digits)
    if len(d) != 40:
        return None
    groups: list[int] = []
    for i in range(8):
        g = int(d[i * 5 : i * 5 + 5], 10)
        if g < 0 or g > 65535:
            return None
        groups.append(g)
    return groups


def is_valid_dsk_formatted(value: str) -> bool:
    s = (value or "").strip()
    if not re.fullmatch(r"\d{5}(-\d{5}){7}", s):
        return False
    return parse_dsk_groups(s) is not None


def pin_from_dsk(dsk_digits: str) -> str:
    d = _digits_only(dsk_digits)
    return d[:5] if len(d) >= 5 else ""


def checksum_valid(qr_digits: str) -> bool:
    if len(qr_digits) < 9:
        return False
    given = int(qr_digits[4:9])
    body = qr_digits[9:]
    digest = hashlib.sha1(body.encode("ascii")).digest()
    expected = (digest[0] << 8) | digest[1]
    return given == expected


def _parse_tlvs(tail: str) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    pos = 0
    while pos + 4 <= len(tail):
        type_crit = int(tail[pos : pos + 2])
        pos += 2
        typ = type_crit >> 1
        length = int(tail[pos : pos + 2])
        pos += 2
        if length < 0 or pos + length > len(tail):
            break
        data = tail[pos : pos + length]
        pos += length
        if typ == TLV_PRODUCT_TYPE and length >= 10:
            word = int(data[0:5])
            meta["generic_device_class"] = word >> 8
            meta["specific_device_class"] = word & 0xFF
            meta["installer_icon_type"] = int(data[5:10])
        elif typ == TLV_PRODUCT_ID and length >= 20:
            meta["manufacturer_id"] = int(data[0:5])
            meta["product_type"] = int(data[5:10])
            meta["product_id"] = int(data[10:15])
            app = int(data[15:20])
            meta["application_version"] = f"{app >> 8}.{app & 0xFF}"
    return meta


def parse_qr_digits(qr_digits: str) -> dict[str, Any] | None:
    d = _digits_only(qr_digits)
    if len(d) < 52 or not d.startswith("90"):
        return None
    version = int(d[2:4])
    dsk_raw = d[12:52]
    if parse_dsk_groups(dsk_raw) is None:
        return None
    if not checksum_valid(d):
        return None
    meta = _parse_tlvs(d[52:])
    return {
        "qr": d,
        "dsk": format_dsk(dsk_raw),
        "pin": pin_from_dsk(dsk_raw),
        "meta": meta,
        "version": version,
        "smart_start": version == VERSION_SMART_START,
    }


def extract_qr_string(text: str) -> str:
    d = _digits_only(text)
    if not d.startswith("90"):
        return ""
    best = ""
    for end in range(90, min(len(d), 200) + 1):
        trial = d[:end]
        if parse_qr_digits(trial):
            best = trial
    if best:
        return best
    parsed = parse_qr_digits(d)
    return parsed["qr"] if parsed else ""


def has_scannable_qr(qr_payload: str | None) -> bool:
    return len(extract_qr_string(qr_payload or "")) >= 90


def qr_encode_payload(qr_payload: str | None) -> str | None:
    extracted = extract_qr_string(qr_payload or "")
    return extracted or None


def normalize_fields(manual_code: str = "", qr_payload: str = "") -> dict[str, Any]:
    qr_in = (qr_payload or "").strip()
    qr_extracted = extract_qr_string(qr_in) if qr_in else ""
    parsed = parse_qr_digits(qr_extracted) if qr_extracted else None

    dsk_digits = ""
    if parsed:
        dsk_digits = _digits_only(parsed["dsk"])
    elif is_valid_dsk_formatted(manual_code):
        dsk_digits = _digits_only(manual_code)
    else:
        m = _digits_only(manual_code)
        if len(m) == 40:
            dsk_digits = m

    return {
        "manual_code": format_dsk(dsk_digits) if dsk_digits else (manual_code or "").strip(),
        "qr_payload": parsed["qr"] if parsed else qr_extracted,
        "zwave_pin": pin_from_dsk(dsk_digits or manual_code),
        "zwave_meta": parsed["meta"] if parsed else {},
    }


def code_protocol(data: dict[str, Any]) -> str:
    ct = str(data.get("code_type") or "matter").strip().lower()
    if ct == "zwave":
        return "zwave"
    if ct == "homekit":
        return "homekit"
    if has_scannable_qr(str(data.get("qr_payload") or "")):
        return "zwave"
    qr = str(data.get("qr_payload") or "").strip().upper()
    if qr.startswith("X-HM://"):
        return "homekit"
    return "matter"


def meta_summary(meta: dict[str, Any]) -> str:
    if not meta.get("manufacturer_id"):
        return ""
    parts = [f"Mfg {meta['manufacturer_id']}"]
    if meta.get("product_type") is not None and meta.get("product_id") is not None:
        parts.append(f"Type {meta['product_type']} / ID {meta['product_id']}")
    return " · ".join(parts)
