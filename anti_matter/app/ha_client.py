"""Home Assistant REST API client via Supervisor."""

from __future__ import annotations

import os
import re
from typing import Any, Optional

import httpx

SUPERVISOR_CORE = "http://supervisor/core/api"

# domain.object_id — HA's own entity_id grammar. Anything else is refused before
# it ever reaches the Jinja template below.
_ENTITY_ID_RE = re.compile(r"^[a-z0-9_]+\.[a-z0-9_]+$")


class HomeAssistantClient:
    def __init__(self) -> None:
        self.token = os.environ.get("SUPERVISOR_TOKEN", "")
        self.enabled = bool(self.token)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def get_state(self, entity_id: str) -> Optional[dict[str, Any]]:
        if not self.enabled:
            return None
        url = f"{SUPERVISOR_CORE}/states/{entity_id}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=self._headers())
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    async def get_attribute(
        self, entity_id: str, attribute: str
    ) -> Optional[Any]:
        state = await self.get_state(entity_id)
        if not state:
            return None
        attrs = state.get("attributes") or {}
        if attribute in attrs:
            return attrs[attribute]
        return None

    async def list_entities(self, domain: Optional[str] = None) -> list[str]:
        if not self.enabled:
            return []
        url = f"{SUPERVISOR_CORE}/states"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._headers())
            resp.raise_for_status()
            states = resp.json()
        ids = [s["entity_id"] for s in states if "entity_id" in s]
        if domain:
            prefix = f"{domain}."
            ids = [e for e in ids if e.startswith(prefix)]
        return sorted(ids)

    async def get_device_id(self, entity_id: str) -> Optional[str]:
        """Resolve the HA device registry id behind an entity, via the template
        API's `device_id()` function (no REST device-registry endpoint exists)."""
        if not self.enabled or not _ENTITY_ID_RE.match(entity_id or ""):
            return None
        url = f"{SUPERVISOR_CORE}/template"
        body = {"template": f"{{{{ device_id('{entity_id}') | default('', true) }}}}"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, headers=self._headers(), json=body)
                resp.raise_for_status()
                device_id = resp.text.strip()
        except httpx.HTTPError:
            return None
        return device_id or None

    async def list_areas(self) -> list[str]:
        """Area names via the HA template API (areas aren't in the REST states list)."""
        if not self.enabled:
            return []
        url = f"{SUPERVISOR_CORE}/template"
        body = {"template": "{{ areas() | map('area_name') | list | to_json }}"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, headers=self._headers(), json=body)
                resp.raise_for_status()
                raw = resp.text.strip()
        except (httpx.HTTPError, ValueError):
            return []
        try:
            import json

            names = json.loads(raw)
        except (ValueError, TypeError):
            return []
        if not isinstance(names, list):
            return []
        return sorted({str(n) for n in names if n})
