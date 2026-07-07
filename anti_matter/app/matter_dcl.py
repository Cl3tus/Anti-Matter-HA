"""Optional lookup of official vendor/product names from the CSA Distributed
Compliance Ledger (the public Matter certification registry) — the same
public, unauthenticated read API the generate.matterqr.codes tool proxies to.
Best-effort only: any network/DNS/timeout failure just means no official name,
never an error surfaced to the user.
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

DCL_BASE = "https://on.dcl.csa-iot.org/dcl"


async def fetch_vendor_info(vendor_id: int) -> Optional[dict[str, Any]]:
    url = f"{DCL_BASE}/vendorinfo/vendors/{vendor_id}"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    record = data.get("vendorInfo")
    if isinstance(record, list):
        record = record[0] if record else None
    if not isinstance(record, dict):
        return None
    name = (record.get("vendorName") or record.get("companyPreferredName") or "").strip()
    if not name:
        return None
    return {"vendor_id": vendor_id, "name": name}


async def fetch_model_info(vendor_id: int, product_id: int) -> Optional[dict[str, Any]]:
    url = f"{DCL_BASE}/model/models/{vendor_id}/{product_id}"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    record = data.get("model")
    if not isinstance(record, dict):
        return None
    name = (record.get("productLabel") or record.get("productName") or "").strip()
    if not name:
        return None
    return {"vendor_id": vendor_id, "product_id": product_id, "name": name}
