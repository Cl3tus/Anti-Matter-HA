"""Home Assistant REST API client via Supervisor."""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import httpx

SUPERVISOR_CORE = "http://supervisor/core/api"


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
        (`/config/devices/device/<id>`) without ever needing an entity_id itself."""
        if not self.enabled:
            return []
        url = f"{SUPERVISOR_CORE}/template"
        template = (
            "{% set ids = states | map(attr='entity_id') | map('device_id')"
            " | reject('none') | unique | list %}"
            "{% set ns = namespace(items=[]) %}"
            "{% for id in ids %}"
            "{% set ns.items = ns.items + [{'id': id,"
            " 'name': device_attr(id, 'name_by_user') or device_attr(id, 'name') or id}] %}"
            "{% endfor %}"
            "{{ ns.items | to_json }}"
        )
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, headers=self._headers(), json={"template": template})
                resp.raise_for_status()
                raw = resp.text.strip()
        except httpx.HTTPError:
            return []
        try:
            devices = json.loads(raw)
        except (ValueError, TypeError):
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
