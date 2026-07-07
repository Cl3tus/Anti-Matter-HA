"""Home Assistant REST API client via Supervisor."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

import httpx

SUPERVISOR_CORE = "http://supervisor/core/api"
_LOGGER = logging.getLogger("anti_matter.ha_client")


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

    async def list_devices(self) -> list[dict[str, str]]:
        """[{id, name}] for every HA device with at least one entity — via the
        template API's `device_id()`/`device_attr()` functions (no REST
        device-registry endpoint exists). Lets the UI link to a device's own page
        (`/config/devices/device/<id>`) without ever needing an entity_id itself.

        device_id() is only a template *function* in HA, not a registered filter —
        `states | map('device_id')` fails, so this collects ids via a plain for-loop
        instead of chaining it through `map`."""
        if not self.enabled:
            return []
        url = f"{SUPERVISOR_CORE}/template"
        template = (
            "{% set ns = namespace(ids=[], items=[]) %}"
            "{% for eid in states | map(attribute='entity_id') %}"
            "{% set did = device_id(eid) %}"
            "{% if did and did not in ns.ids %}"
            "{% set ns.ids = ns.ids + [did] %}"
            "{% endif %}"
            "{% endfor %}"
            "{% for did in ns.ids %}"
            "{% set ns.items = ns.items + [{'id': did,"
            " 'name': device_attr(did, 'name_by_user') or device_attr(did, 'name') or did}] %}"
            "{% endfor %}"
            "{{ ns.items | to_json }}"
        )
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, headers=self._headers(), json={"template": template})
                resp.raise_for_status()
                raw = resp.text.strip()
        except httpx.HTTPError as exc:
            _LOGGER.warning("list_devices: HA template request failed: %s", exc)
            return []
        try:
            devices = json.loads(raw)
        except (ValueError, TypeError):
            _LOGGER.warning("list_devices: HA returned non-JSON template result: %r", raw[:300])
            return []
        if not isinstance(devices, list):
            return []
        out = [
            {"id": str(d["id"]), "name": str(d.get("name") or d["id"])}
            for d in devices
            if isinstance(d, dict) and d.get("id")
        ]
        return sorted(out, key=lambda d: d["name"].lower())

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
            names = json.loads(raw)
        except (ValueError, TypeError):
            return []
        if not isinstance(names, list):
            return []
        return sorted({str(n) for n in names if n})
