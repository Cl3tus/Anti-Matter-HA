"""Official Z-Wave manufacturer/product names, looked up locally against a
snapshot of the zwave-js project's own device config database (MIT licensed,
https://github.com/zwave-js/node-zwave-js/tree/master/packages/config/config/devices
— the same data devices.zwave-js.io itself is generated from). Unlike Matter's
CSA DCL, Z-Wave has no live public registry API to query, so this ships as a
static local index (`zwave_device_db.json`) instead of a network call, and is
refreshed by re-running `tools/build_zwave_device_db.py` against a fresh
checkout of that repo.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "zwave_device_db.json")


@lru_cache(maxsize=1)
def _load_db() -> dict[str, dict[str, str]]:
    try:
        with open(DB_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def lookup_device(manufacturer_id: int, product_type: int, product_id: int) -> Optional[dict[str, Any]]:
    key = f"{manufacturer_id & 0xFFFF:04x}:{product_type & 0xFFFF:04x}:{product_id & 0xFFFF:04x}"
    record = _load_db().get(key)
    if not record:
        return None
    return {
        "manufacturer": record.get("manufacturer") or None,
        "label": record.get("label") or None,
        "description": record.get("description") or None,
    }
