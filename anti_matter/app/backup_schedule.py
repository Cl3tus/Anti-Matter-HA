"""Automatic backup schedule: runtime settings + due-check, independent of HA options.

Settings live in STORAGE_DIR/backup_settings.json (not the add-on's options.json, which
is supervisor-owned) so the in-app Backup modal can read/write them directly.

Frequency is one of: hourly | daily | weekly | monthly.
- hourly: runs once per hour, at the configured minute.
- daily: runs once per day, at the configured hour:minute.
- weekly: runs once per week, on the configured weekday, at hour:minute.
- monthly: runs once per month, on the configured day_of_month, at hour:minute.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

FREQUENCIES = ("hourly", "daily", "weekly", "monthly")

DEFAULTS: dict[str, Any] = {
    "enabled": False,
    "frequency": "daily",
    "hour": 3,
    "minute": 0,
    "weekday": 0,  # 0=Monday .. 6=Sunday (weekly)
    "day_of_month": 1,  # 1-28 (monthly)
    "keep_count": 10,
    "last_run_key": None,
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
    if merged.get("frequency") not in FREQUENCIES:
        merged["frequency"] = "daily"
    merged["hour"] = max(0, min(23, int(merged.get("hour") or 0)))
    merged["minute"] = max(0, min(59, int(merged.get("minute") or 0)))
    merged["weekday"] = max(0, min(6, int(merged.get("weekday") or 0)))
    merged["day_of_month"] = max(1, min(28, int(merged.get("day_of_month") or 1)))
    merged["keep_count"] = max(1, min(100, int(merged.get("keep_count") or 10)))
    merged["enabled"] = bool(merged.get("enabled"))
    _settings_path(data_dir).write_text(
        json.dumps(merged, indent=2), encoding="utf-8"
    )
    return merged


def period_key(frequency: str, now) -> str:
    """Opaque string identifying the current period, so each period backs up once."""
    if frequency == "hourly":
        return now.strftime("%Y-%m-%dT%H")
    if frequency == "weekly":
        year, week, _ = now.isocalendar()
        return f"{year}-W{week:02d}"
    if frequency == "monthly":
        return now.strftime("%Y-%m")
    return now.strftime("%Y-%m-%d")


def mark_ran(data_dir: Path, key: str) -> None:
    save_settings(data_dir, {"last_run_key": key})


def is_due(settings: dict[str, Any], now) -> bool:
    if not settings.get("enabled"):
        return False
    freq = settings.get("frequency", "daily")
    if freq not in FREQUENCIES:
        freq = "daily"
    if settings.get("last_run_key") == period_key(freq, now):
        return False
    if freq == "hourly":
        return now.minute == int(settings.get("minute", 0))
    if now.hour != int(settings.get("hour", 3)) or now.minute != int(
        settings.get("minute", 0)
    ):
        return False
    if freq == "weekly":
        return now.weekday() == int(settings.get("weekday", 0))
    if freq == "monthly":
        return now.day == int(settings.get("day_of_month", 1))
    return True  # daily
