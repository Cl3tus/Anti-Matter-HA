"""Lucide category icons (bundled under static/brand/category-icons, ISC license)."""

from __future__ import annotations

import json
import os
import re

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
MANIFEST = os.path.join(STATIC_DIR, "brand", "category-icons", "manifest.json")
DEFAULT = "folder"

_ALLOWED: list[str] | None = None


def allowed_ids() -> list[str]:
    global _ALLOWED
    if _ALLOWED is not None:
        return _ALLOWED
    if not os.path.isfile(MANIFEST):
        _ALLOWED = [DEFAULT]
        return _ALLOWED
    with open(MANIFEST, encoding="utf-8") as f:
        data = json.load(f)
    icons = data.get("icons") or []
    ids = [str(item["id"]) for item in icons if isinstance(item, dict) and item.get("id")]
    _ALLOWED = ids or [DEFAULT]
    return _ALLOWED


def normalize(icon: str | None) -> str:
    raw = re.sub(r"[^a-z0-9-]", "", (icon or "").strip().lower())
    if raw in allowed_ids():
        return raw
    return DEFAULT
