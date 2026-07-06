"""Read add-on options from /data/options.json (grouped, with flat fallback).

Home Assistant writes the Configuration tab into /data/options.json. We store options
grouped into sections (interface / backup) so the Config tab renders headers, and read
them here with a flat-key fallback for backward compatibility.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

OPTIONS_PATH = Path(os.environ.get("ANTIMATTER_OPTIONS", "/data/options.json"))


def load_options() -> dict:
    try:
        return json.loads(OPTIONS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def opt(group: str, key: str, default=None):
    data = load_options()
    grp = data.get(group)
    if isinstance(grp, dict) and key in grp:
        return grp[key]
    if key in data:  # flat fallback
        return data[key]
    return default


def norm_language(value) -> str:
    v = str(value or "auto").strip().lower()
    if v in ("nl", "nederlands", "dutch"):
        return "nl"
    if v in ("en", "english", "engels"):
        return "en"
    return "auto"


def norm_theme(value) -> str:
    v = str(value or "auto").strip().lower()
    if v in ("light", "licht"):
        return "light"
    if v in ("dark", "donker"):
        return "dark"
    return "auto"


def backup_keep_count() -> int:
    try:
        n = int(opt("backup", "keep_count", 10))
    except (TypeError, ValueError):
        n = 10
    return max(1, min(100, n))
