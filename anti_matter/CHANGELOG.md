# Changelog

## 1.0.6

- Add/Edit code modal reorganised: Protocol, Name, Category, the code fields, then a
  collapsible **Device details** (now also holds Device type, order: vendor, product,
  device type, description, area) and a collapsible **Home Assistant link**, then Notes.
- Categories can now be **deleted** (delete button in the category modal); the codes stay
  and fall back to no category.
- **Multi-select categories**: click several to combine them; click again to unselect.
  "All codes" clears the selection.
- The status bar now lines up under the code canvas (categories panel spans full height).
- **Live refresh**: codes added from another device (e.g. a phone scan) appear within a few
  seconds without reloading.

## 1.0.5

- Bottom **status bar** showing how many codes are stored (and how many are shown when filtered).
- "All codes" moved to the top of the sidebar; selecting it now correctly deselects the active
  category.
- "Backup created" and other alerts now use an in-app modal instead of the browser popup.
- Fixed **Cancel** not closing the Scan dialog.
- Add/Edit code modal: optional fields (vendor, product, description, area) moved behind a
  collapsible **Device details** section; Description and Area swapped. Mandatory fields stay
  visible.
- Card **Download / Edit / Delete** buttons now follow the active light/dark theme.

## 1.0.4

- Per-card **Download** button: saves the code as a PNG (Matter) or SVG (HomeKit / Z-Wave).
- **Dark-friendly QR** toggle in the top bar: shows codes in negative. Off by default
  (white background, black QR) — flip it if you prefer inverted, in any theme.
- Delete now uses an in-app confirmation modal instead of the browser dialog.
- **Category icons** are now Material Design Icons with a searchable picker (bundled
  offline); the whole MDI set is available.
- Category dialog: removed the redundant colour swatch (kept the colour picker + hex).
- Top-bar buttons are all the same height; fixed a stray dark strip at the bottom of the page.

## 1.0.3

- Top bar uses the same grey as the sidebar / Home Assistant header (flat panel, no glass).

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
