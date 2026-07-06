"""Category icon name normalization.

Icons are Material Design Icons names (e.g. "home", "motion-sensor"), rendered client
side with the bundled MDI webfont. We only sanitize the name here; the picker guarantees
it exists. An optional "mdi:" / "mdi-" prefix is stripped.
"""

from __future__ import annotations

import re

DEFAULT = "folder"


def normalize(icon: str | None) -> str:
    raw = (icon or "").strip().lower()
    raw = re.sub(r"^mdi[:-]", "", raw)
    raw = re.sub(r"[^a-z0-9-]", "", raw)
    return raw or DEFAULT
