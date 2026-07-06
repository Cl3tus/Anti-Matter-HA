"""JSON file persistence for the Anti-Matter vault.

Data lives under STORAGE_DIR (set to the add-on config folder `/config` by run.sh, which
Home Assistant exposes over Samba at \\<HA-IP>\addon_configs\<slug>). Falls back to /data.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from threading import Lock

from models import Vault

DEFAULT_DATA_DIR = "/data"
VAULT_FILENAME = "anti_matter.json"


def _resolve_data_dir(data_dir: str | None) -> Path:
    if data_dir:
        return Path(data_dir)
    return Path(
        os.environ.get("STORAGE_DIR")
        or os.environ.get("ANTIMATTER_DATA")
        or DEFAULT_DATA_DIR
    )


class VaultStorage:
    def __init__(self, data_dir: str | None = None) -> None:
        self.data_dir = _resolve_data_dir(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.data_dir / VAULT_FILENAME
        self._lock = Lock()

    def load(self) -> Vault:
        with self._lock:
            if not self.path.exists():
                vault = Vault()
                self._write_unlocked(vault)
                return vault
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return Vault.model_validate(raw)

    def save(self, vault: Vault) -> None:
        with self._lock:
            self._write_unlocked(vault)

    def export_json(self) -> str:
        from models import utc_now

        vault = self.load()
        vault.meta.exported_at = utc_now()
        return vault.model_dump_json(indent=2)

    def import_json(self, payload: str, *, merge: bool = False) -> Vault:
        incoming = Vault.model_validate(json.loads(payload))
        with self._lock:
            if merge and self.path.exists():
                current = Vault.model_validate(
                    json.loads(self.path.read_text(encoding="utf-8"))
                )
                # Skip incoming items whose id already exists locally — importing the
                # same export twice (or re-importing after a partial sync) must not
                # create a second record sharing an id with an existing one.
                existing_cat_ids = {c.id for c in current.categories}
                existing_code_ids = {c.id for c in current.codes}
                current.categories.extend(
                    c for c in incoming.categories if c.id not in existing_cat_ids
                )
                current.codes.extend(
                    c for c in incoming.codes if c.id not in existing_code_ids
                )
                self._write_unlocked(current)
                return current
            self._write_unlocked(incoming)
            return incoming

    def backup_local_copy(self, keep_count: int = 10) -> Path:
        """Create a timestamped local backup under STORAGE_DIR/backups and prune old ones."""
        from datetime import datetime, timezone

        backup_dir = self.data_dir / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dest = backup_dir / f"anti_matter_{stamp}.json"
        shutil.copy2(self.path, dest)
        self._prune_backups(backup_dir, keep_count)
        return dest

    @staticmethod
    def _prune_backups(backup_dir: Path, keep_count: int) -> None:
        keep_count = max(1, int(keep_count or 1))
        backups = sorted(
            backup_dir.glob("anti_matter_*.json"),
            key=lambda p: p.name,
            reverse=True,
        )
        for old in backups[keep_count:]:
            try:
                old.unlink()
            except OSError:
                pass

    def _write_unlocked(self, vault: Vault) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(
            vault.model_dump_json(indent=2),
            encoding="utf-8",
        )
        tmp.replace(self.path)
