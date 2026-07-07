"""Rebuild app/zwave_device_db.json from a checkout of the zwave-js project's
own device config database (MIT licensed, the same data devices.zwave-js.io
is generated from).

Not run by the add-on itself — a maintainer tool for refreshing the bundled
snapshot when zwave-js adds/updates device entries upstream.

Usage:
    pip install json5
    git clone --depth 1 --filter=blob:none --sparse \\
        https://github.com/zwave-js/node-zwave-js.git /tmp/zwave-js-src
    git -C /tmp/zwave-js-src sparse-checkout set packages/config/config/devices
    python tools/build_zwave_device_db.py /tmp/zwave-js-src/packages/config/config/devices
"""

from __future__ import annotations

import json
import os
import re
import sys

import json5

OUT = os.path.join(os.path.dirname(__file__), "..", "app", "zwave_device_db.json")


def resolve_conditional(value: object, product_id_int: int) -> str:
    """A handful of device files give `label`/`description` as a list of
    {"$if": "productId === 0x1234", "value": "..."} entries (one device file
    shared by several product IDs) plus a plain-string fallback at the end."""
    if isinstance(value, str):
        return value.strip()
    if not isinstance(value, list):
        return ""
    fallback = ""
    for item in value:
        if isinstance(item, str):
            fallback = item
        elif isinstance(item, dict):
            cond = str(item.get("$if") or "")
            m = re.search(r"productId\s*===?\s*(0x[0-9a-fA-F]+|\d+)", cond)
            if m and int(m.group(1), 0) == product_id_int:
                return str(item.get("value") or "").strip()
    return fallback.strip()


def norm_hex(v: object) -> str | None:
    if v is None:
        return None
    s = str(v).strip().lower()
    if not s.startswith("0x"):
        try:
            s = hex(int(s))
        except ValueError:
            return None
    try:
        return f"{int(s, 16):04x}"
    except ValueError:
        return None


def build(src: str) -> dict[str, dict[str, str]]:
    index: dict[str, dict[str, str]] = {}
    scanned = skipped = 0
    for root, _dirs, files in os.walk(src):
        for fn in files:
            if not fn.endswith(".json") or fn.startswith("template"):
                continue
            path = os.path.join(root, fn)
            scanned += 1
            try:
                with open(path, encoding="utf-8") as f:
                    raw = f.read()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    data = json5.loads(raw)  # these config files allow // comments
            except (ValueError, UnicodeDecodeError):
                skipped += 1
                continue
            if not isinstance(data, dict):
                skipped += 1
                continue
            manufacturer = data.get("manufacturer") if isinstance(data.get("manufacturer"), str) else ""
            manufacturer_id = norm_hex(data.get("manufacturerId"))
            label_raw = data.get("label")
            description_raw = data.get("description")
            devices = data.get("devices")
            if not manufacturer_id or not label_raw or not isinstance(devices, list):
                skipped += 1
                continue
            for dev in devices:
                if not isinstance(dev, dict):
                    continue
                pt = norm_hex(dev.get("productType"))
                pid = norm_hex(dev.get("productId"))
                if not pt or not pid:
                    continue
                label = resolve_conditional(label_raw, int(pid, 16))
                description = resolve_conditional(description_raw, int(pid, 16))
                if not label:
                    continue
                key = f"{manufacturer_id}:{pt}:{pid}"
                if key not in index:  # keep the first if a duplicate key shows up
                    index[key] = {
                        "manufacturer": (manufacturer or "").strip(),
                        "label": label,
                        "description": description,
                    }
    print(f"files scanned: {scanned}, skipped: {skipped}, index entries: {len(index)}", file=sys.stderr)
    return index


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        raise SystemExit(1)
    result = build(sys.argv[1])
    out_path = os.path.abspath(OUT)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)", file=sys.stderr)
