"""Automatic backup schedule: runtime settings + due-check, independent of HA options.

Settings live in STORAGE_DIR/backup_settings.json (not the add-on's options.json, which
is supervisor-owned) so the in-app Backup modal can read/write them directly.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DEFAULTS: dict[str, Any] = {
    "enabled": False,
    "hour": 3,
    "minute": 0,
    "keep_count": 10,
    "last_run_date": None,
}

SETTINGS_FILENAME = "backup_settings.json"


def _settings_path(data_dir: Path) -> Path:
    return data_dir / SETTINGS_FILENAME


def load_settings(data_dir: Path) -> dict[str, Any]:
    p = _settings_path(data_dir)
    if p.exists():
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out = dict(DEFAULTS)
            out.update({k: v for k, v in data.items() if k in DEFAULTS})
            return out
        except (OSError, ValueError):
            pass
    out = dict(DEFAULTS)
    try:
        from options import backup_keep_count

        out["keep_count"] = backup_keep_count()
    except Exception:
        pass
    return out


def save_settings(data_dir: Path, updates: dict[str, Any]) -> dict[str, Any]:
    merged = load_settings(data_dir)
    merged.update({k: v for k, v in updates.items() if k in DEFAULTS})
    merged["hour"] = max(0, min(23, int(merged.get("hour") or 0)))
    merged["minute"] = max(0, min(59, int(merged.get("minute") or 0)))
    merged["keep_count"] = max(1, min(100, int(merged.get("keep_count") or 10)))
    merged["enabled"] = bool(merged.get("enabled"))
    _settings_path(data_dir).write_text(
        json.dumps(merged, indent=2), encoding="utf-8"
    )
    return merged


def mark_ran(data_dir: Path, date_str: str) -> None:
    save_settings(data_dir, {"last_run_date": date_str})


def is_due(settings: dict[str, Any], now) -> bool:
    if not settings.get("enabled"):
        return False
    today = now.strftime("%Y-%m-%d")
    if settings.get("last_run_date") == today:
        return False
    return now.hour == int(settings.get("hour", 3)) and now.minute == int(
        settings.get("minute", 0)
    )
