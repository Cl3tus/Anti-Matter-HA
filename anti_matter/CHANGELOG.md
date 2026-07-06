# Changelog

## 1.0.2

- Follow Home Assistant's accent/primary colours live (reads `--accent-color` /
  `--primary-color` from the parent frame, like E-Ink Studio); falls back to amber
  when standalone.
- Follow Home Assistant's UI language: Auto now also reads the parent frame `<html lang>`
  before the browser language.
- Compact top bar (~56px, matching the HA header) with smaller buttons.

## 1.0.1

- Restyle the whole UI to match E-Ink Studio / Home Assistant: neutral greys with an
  amber accent, in both light and dark themes.
- Switch typography to IBM Plex Sans / Mono, bundled locally (no Google Fonts CDN).
- Recolour the app logo to amber.

## 1.0.0

Initial release. A local, cloud-free vault for Matter / HomeKit / Z-Wave pairing codes,
rebuilt from the ground up.

- Add / edit / scan / delete pairing codes with branded, scannable QR cards.
- New fields: device vendor, device product name, area (with HA area suggestions), description.
- Categories sidebar with colours and icons.
- Home Assistant entity link + Pull-from-HA.
- Local, SAMBA-reachable storage in the add-on config folder; **Backup now** with automatic
  pruning; Export / Import.
- Webcam scanning (mobile-friendly) with a bundled, offline-capable fallback and photo upload.
- NL / EN / Auto language and Light / Dark / Auto theme that follows Home Assistant.
- No cloud, no account, no outbound connections.
