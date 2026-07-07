"""HomeKit pairing card SVG — same minimal layout as the Matter label (logo, QR,
code, thin border) for a consistent look across protocols."""

from __future__ import annotations

import base64
import io
import os
import re

import qrcode
from PIL import Image
from qrcode.image.svg import SvgPathImage

from homekit_payload import (
    decode_pairing_from_uri,
    format_pairing_display,
    pairing_digits,
    qr_encode_payload,
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
WORDMARK = os.path.join(STATIC_DIR, "assets", "homekit_logo.png")

CARD_W = 288
PAD_X = 12
PAD_Y = 10
GAP = 8
QR_SIZE = 260
CODE_H = 34


def _qr_symbol_fragment(setup_uri: str) -> str:
    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_Q,
        box_size=1,
        border=0,
    )
    qr.add_data(setup_uri)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(image_factory=SvgPathImage).save(buf)
    svg = buf.getvalue().decode("utf-8")
    match = re.search(r"<svg([^>]*)>(.*)</svg>", svg, re.DOTALL | re.IGNORECASE)
    if not match:
        return f'<symbol id="qrCode">{svg}</symbol>'
    attrs = match.group(1)
    body = match.group(2)
    return f'<symbol id="qrCode"{attrs}>{body}</symbol>'


def _logo_block(width: int) -> tuple[str, int]:
    """Base64-embedded <image> for the wordmark, sized to `width` — returns the
    SVG fragment and its rendered height. Falls back to a plain text wordmark
    if the asset is missing, same as matter_label.py's own fallback."""
    if os.path.isfile(WORDMARK):
        with Image.open(WORDMARK) as img:
            ratio = img.height / img.width
            height = round(width * ratio)
        with open(WORDMARK, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        return (
            f'<image href="data:image/png;base64,{b64}" x="0" y="0" '
            f'width="{width}" height="{height}"/>',
            height,
        )
    height = 40
    return (
        f'<text x="0" y="{height - 8}" font-family="system-ui,sans-serif" '
        f'font-size="28" font-weight="700" fill="#000000">HomeKit</text>',
        height,
    )


def compose_card_svg(
    *,
    pairing_code: str,
    setup_uri: str,
) -> str:
    digits = pairing_digits(pairing_code)
    if len(digits) != 8:
        decoded = decode_pairing_from_uri(setup_uri)
        digits = pairing_digits(decoded) if decoded else ""
    if len(digits) != 8:
        raise ValueError("HomeKit pairing code must be 8 digits")

    uri = qr_encode_payload(setup_uri) or setup_uri
    if not uri or not uri.upper().startswith("X-HM://"):
        raise ValueError("Invalid HomeKit setup URI")

    qr_sym = _qr_symbol_fragment(uri)
    pairing_display = format_pairing_display(digits)

    logo_w = QR_SIZE
    logo_svg, logo_h = _logo_block(logo_w)
    logo_x = (CARD_W - logo_w) // 2
    logo_y = PAD_Y
    qr_x = (CARD_W - QR_SIZE) // 2
    qr_y = logo_y + logo_h + GAP
    code_y = qr_y + QR_SIZE + GAP
    card_h = code_y + CODE_H

    return f"""<?xml version="1.0" encoding="utf-8"?>
<svg viewBox="0 0 {CARD_W} {card_h}" xmlns="http://www.w3.org/2000/svg">
  <title>HomeKit QR Code</title>
  <defs>
    {qr_sym}
  </defs>
  <rect x="1" y="1" width="{CARD_W - 2}" height="{card_h - 2}" rx="16" fill="white" stroke="black" stroke-width="2"/>
  <g transform="translate({logo_x},{logo_y})">{logo_svg}</g>
  <use href="#qrCode" x="{qr_x}" y="{qr_y}" width="{QR_SIZE}" height="{QR_SIZE}"/>
  <text x="{CARD_W / 2}" y="{code_y + 24}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="22" fill="black">{pairing_display}</text>
</svg>"""


def card_svg_for_code(code: dict) -> str:
    manual = str(code.get("manual_code") or "")
    qr = str(code.get("qr_payload") or "")
    if not qr and manual:
        from homekit_payload import category_id_for, compose_setup_uri, normalize_setup_id

        cat = category_id_for(str(code.get("homekit_category") or "other"))
        flag = int(code.get("homekit_flag") or 2)
        sid = normalize_setup_id(str(code.get("setup_id") or ""))
        digits = pairing_digits(manual)
        if len(digits) == 8:
            qr = compose_setup_uri(
                category_id=cat, flag=flag, password=digits, setup_id=sid
            )
    return compose_card_svg(pairing_code=manual, setup_uri=qr)
