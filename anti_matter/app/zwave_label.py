"""Z-Wave SmartStart label SVG — same minimal layout as the Matter label (logo, QR,
code, thin border) for a consistent look across protocols."""

from __future__ import annotations

import base64
import html
import io
import os
import re

import qrcode
from PIL import Image
from qrcode.image.svg import SvgPathImage

from zwave_payload import format_dsk, parse_qr_digits, pin_from_dsk, qr_encode_payload

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
WORDMARK = os.path.join(STATIC_DIR, "assets", "zwave_logo.png")

CARD_W = 288
PAD_X = 12
PAD_Y = 10
GAP = 8
QR_SIZE = 260


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
        f'font-size="26" font-weight="700" fill="#000000">Z-Wave</text>',
        height,
    )


def _qr_block(qr: str, x: int, y: int) -> str:
    q = qrcode.QRCode(
        version=3,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=1,
        border=2,
    )
    q.add_data(qr)
    q.make(fit=True)

    buf = io.BytesIO()
    q.make_image(image_factory=SvgPathImage).save(buf)
    svg = buf.getvalue().decode("utf-8")
    match = re.search(r"<svg([^>]*)>(.*)</svg>", svg, re.DOTALL | re.IGNORECASE)
    if not match:
        return f'<text x="{x + QR_SIZE / 2}" y="{y + QR_SIZE / 2}" text-anchor="middle">QR</text>'
    attrs, body = match.group(1), match.group(2)
    # qrcode's SvgPathImage sizes its own <svg width/height> in "mm" — embedding that
    # unit-suffixed size verbatim inside our unitless viewBox makes the browser resolve
    # it via CSS mm->px conversion, independent of the scale we apply below, shrinking
    # the QR to a fraction of its intended size. Strip the unit so the nested viewport
    # is unitless (1:1 with its own viewBox), and scale off that viewBox's actual width
    # rather than assuming 1 unit == 1 module.
    box_w_match = re.search(r'width="([\d.]+)mm"', attrs)
    box_w = float(box_w_match.group(1)) if box_w_match else 3.3
    attrs = re.sub(r'(width|height)="[\d.]+mm"', rf'\1="{box_w:g}"', attrs)
    scale = QR_SIZE / box_w
    return f'<g transform="translate({x},{y}) scale({scale:.4f})"><svg{attrs}>{body}</svg></g>'


def compose_card_svg(*, dsk: str, qr_payload: str, compact: bool = False) -> str:
    qr = qr_encode_payload(qr_payload) or ""
    parsed = parse_qr_digits(qr) if qr else None
    dsk_fmt = format_dsk(dsk)
    if parsed:
        dsk_fmt = parsed["dsk"]
    pin = pin_from_dsk(dsk_fmt)

    groups = dsk_fmt.split("-") if dsk_fmt else []
    dsk_row1 = " · ".join(groups[:4]) if len(groups) >= 4 else dsk_fmt
    dsk_row2 = " · ".join(groups[4:8]) if len(groups) >= 8 else ""

    logo_w = QR_SIZE
    logo_svg, logo_h = _logo_block(logo_w)
    logo_x = (CARD_W - logo_w) // 2
    logo_y = PAD_Y
    qr_x = (CARD_W - QR_SIZE) // 2
    qr_y = logo_y + logo_h + GAP

    qr_svg = ""
    if qr:
        qr_svg = _qr_block(qr, qr_x, qr_y)
        text_y = qr_y + QR_SIZE + GAP
    else:
        text_y = qr_y

    pin_line = f'<text x="{CARD_W / 2}" y="{text_y + 18}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="16" fill="black">PIN {html.escape(pin)}</text>' if pin else ""
    # Compact mode (quickview) drops the border and the full DSK — the PIN alone
    # is what people actually key in, the full DSK is only for printed labels.
    if compact:
        dsk_line1 = dsk_line2 = ""
        border = ""
        card_h = text_y + (26 if pin else 6)
    else:
        dsk_line1 = f'<text x="{CARD_W / 2}" y="{text_y + 40}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="#333333">{html.escape(dsk_row1)}</text>' if dsk_row1 else ""
        dsk_line2 = f'<text x="{CARD_W / 2}" y="{text_y + 54}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="#333333">{html.escape(dsk_row2)}</text>' if dsk_row2 else ""
        card_h = text_y + (60 if pin else 20)
        border = f'<rect x="1" y="1" width="{CARD_W - 2}" height="{card_h - 2}" rx="16" fill="white" stroke="black" stroke-width="2"/>'

    return f"""<?xml version="1.0" encoding="utf-8"?>
<svg viewBox="0 0 {CARD_W} {card_h}" xmlns="http://www.w3.org/2000/svg">
  <title>Z-Wave SmartStart</title>
  {border}
  <g transform="translate({logo_x},{logo_y})">{logo_svg}</g>
  {qr_svg}
  {pin_line}
  {dsk_line1}
  {dsk_line2}
</svg>"""


def card_svg_for_code(code: dict, *, compact: bool = False) -> str:
    return compose_card_svg(
        dsk=str(code.get("manual_code") or ""),
        qr_payload=str(code.get("qr_payload") or ""),
        compact=compact,
    )
