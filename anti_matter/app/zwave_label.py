"""Z-Wave SmartStart label SVG (QR + DSK + PIN)."""

from __future__ import annotations

import html
import io
import re

import qrcode
from qrcode.image.svg import SvgPathImage

from zwave_payload import format_dsk, meta_summary, parse_qr_digits, pin_from_dsk, qr_encode_payload

QR_TARGET_PX = 200
QR_OFFSET_Y = 68


def compose_card_svg(*, dsk: str, qr_payload: str) -> str:
    qr = qr_encode_payload(qr_payload) or ""
    parsed = parse_qr_digits(qr) if qr else None
    dsk_fmt = format_dsk(dsk)
    if parsed:
        dsk_fmt = parsed["dsk"]
    pin = pin_from_dsk(dsk_fmt)
    meta = parsed["meta"] if parsed else {}
    meta_line = html.escape(meta_summary(meta))

    groups = dsk_fmt.split("-") if dsk_fmt else []
    dsk_row1 = " · ".join(groups[:4]) if len(groups) >= 4 else dsk_fmt
    dsk_row2 = " · ".join(groups[4:8]) if len(groups) >= 8 else ""

    qr_block = ""
    if qr:
        q = qrcode.QRCode(
            version=3,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=1,
            border=2,
        )
        q.add_data(qr)
        q.make(fit=True)
        offset_x = (300 - QR_TARGET_PX) / 2

        buf = io.BytesIO()
        q.make_image(image_factory=SvgPathImage).save(buf)
        svg = buf.getvalue().decode("utf-8")
        match = re.search(r"<svg([^>]*)>(.*)</svg>", svg, re.DOTALL | re.IGNORECASE)
        if match:
            attrs, body = match.group(1), match.group(2)
            # qrcode's SvgPathImage sizes its own <svg width/height> in "mm" — embedding
            # that unit-suffixed size verbatim inside our unitless viewBox makes the
            # browser resolve it via CSS mm->px conversion, independent of the scale we
            # apply below, so the QR rendered at a fraction of its intended size with a
            # large gap of unused space around it. Strip the unit so the nested viewport
            # is unitless (1:1 with its own viewBox), and scale off that viewBox's actual
            # width rather than assuming 1 unit == 1 module.
            box_w_match = re.search(r'width="([\d.]+)mm"', attrs)
            box_w = float(box_w_match.group(1)) if box_w_match else 3.3
            attrs = re.sub(r'(width|height)="[\d.]+mm"', rf'\1="{box_w:g}"', attrs)
            scale = QR_TARGET_PX / box_w
            qr_block = (
                f'<g transform="translate({offset_x:.1f},{QR_OFFSET_Y}) '
                f'scale({scale:.4f})"><svg{attrs}>{body}</svg></g>'
            )
        else:
            qr_block = f'<text x="150" y="140" text-anchor="middle">QR</text>'

    return f"""<?xml version="1.0" encoding="utf-8"?>
<svg viewBox="0 0 300 360" xmlns="http://www.w3.org/2000/svg">
  <title>Z-Wave SmartStart</title>
  <rect width="300" height="360" rx="16" fill="#0b1f3a"/>
  <rect x="6" y="6" width="288" height="348" rx="12" fill="#ffffff"/>
  <text x="150" y="36" text-anchor="middle" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#0b1f3a">Z-Wave SmartStart</text>
  {qr_block}
  <text x="150" y="58" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#475569">PIN {html.escape(pin)}</text>
  <text x="150" y="292" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="#334155">{html.escape(dsk_row1)}</text>
  <text x="150" y="306" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="#334155">{html.escape(dsk_row2)}</text>
  <text x="150" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" fill="#64748b">{meta_line}</text>
</svg>"""


def card_svg_for_code(code: dict) -> str:
    return compose_card_svg(
        dsk=str(code.get("manual_code") or ""),
        qr_payload=str(code.get("qr_payload") or ""),
    )
