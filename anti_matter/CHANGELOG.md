# Changelog

## 1.0.12

- **Connectivity** now includes **Z-Wave** alongside WiFi/Matter/Zigbee/Bluetooth.
- Right-click a table row to **edit** the code directly (same as right-click on a category).
- The table/QR view choice is now **remembered** across reloads (localStorage).
- **Filter dropdowns** for In use and each connectivity type (WiFi/Matter/Zigbee/Bluetooth/
  Z-Wave), each with All/Yes/No, next to the existing Vendor/Product/Type/Area filters.
- Quick-view popup: the Share button didn't work well, replaced with a plain **Download**
  button for the PNG/SVG, plus a **Delete** button (with the usual confirm).
- Empty-state text updated to match the renamed buttons ("Click New or Scan…").
- In-app logo/favicon now uses the new Anti-Matter icon instead of the old placeholder.
- Home Assistant add-on store page: the icon now sits in the icon slot; the big banner
  moved into the add-on's README (shown further down, in the description), instead of
  stretching across the top logo slot.

## 1.0.11

- **Fixed "Pull from HA" failing on existing entity links**: the button read the
  entity/attribute saved on the server, not what was currently typed in the form — so
  editing the link and clicking Pull immediately (without saving first) always failed with
  "No Home Assistant entity linked". It now saves the link before pulling.
- New fields: **In use** (checkbox) and **Connectivity** (WiFi / Matter / Zigbee /
  Bluetooth checkboxes) — e.g. a Shelly can be "in use, WiFi yes, Matter no". All off by
  default (stock/unused device).
- Manual "Upload photo" button next to every inline **Scan QR** button in the New/Edit
  code form (matter, HomeKit, Z-Wave) — pick an image file directly, no need to open the
  camera dialog first.
- Table view rows now have a **delete** button (with the usual confirm).
- Quick-view popup (double-click a table row): removed the red ✕ (Close button at the
  bottom is enough), added a small line of **vendor / product / type / area / category /
  protocol** under the pairing code, and a **Share** button (uses the Web Share API on
  mobile, falls back to download) next to Edit. Also fixed a horizontal scrollbar and
  widened the popup slightly.
- Tooltips restyled: consistent dark bubble with an arrow on every icon button (was a mix
  of the native browser tooltip and the custom one).
- Added the app icon, logo/banner and DOCS/README polish (badges, screenshots) for the
  GitHub repo and the Home Assistant add-on store listing.

## 1.0.10

- Reworked the table view: instead of a separate modal, it now **replaces the QR
  canvas in place** (search/filters/category selection stay active). The button
  icon flips between a table glyph and a QR-code glyph so it's clear it's a toggle.
- **Double-click a row** in the table to open a compact quick-view popup with the
  rendered QR code (or HomeKit/Z-Wave card) and the manual/pairing code, plus
  Edit and Close (red ✕) buttons.

## 1.0.9

- Search box and the Vendor/Product/Type/Area filter dropdowns are now the same height.
- Fixed the sidebar "+" (add category) not being centred in its accent box.
- Replaced the New-code button's 🆕 emoji with a plain "+" (same fix as the category
  button — some systems render heavy-plus emoji in a fixed colour that ignores accent).

## 1.0.8

- **Fixed a data-integrity bug**: importing/merging the same export twice (or a partial
  re-sync) could leave two codes sharing the same id — deleting one then deleted both.
  The vault now dedupes by id on every load and on merge-import, and heals itself if a
  vault file already has duplicates. (There's no database — it's a single JSON file,
  `anti_matter.json`, in the add-on config folder.)
- **Attribute filters**: dropdowns for Vendor, Product, Type and Area next to the search
  box, filled from your actual data. Combine them with category selection and search.
- **Table view**: a new button opens a spreadsheet-style table of the (filtered) codes in
  its own modal, closed with a red ✕.
- **Backup schedule**: added Hourly / Daily / Weekly / Monthly frequency, with a day-of-week
  or day-of-month picker where relevant.
- Theme toggle now uses a static yin-yang glyph (copied from E-Ink Studio) instead of an
  emoji that changed per state; language toggle uses proper inline flag SVGs (UK/NL)
  instead of emoji flags, so the colours don't depend on the OS emoji font.
- Bigger icons in the top bar; Export/Import/Backup/Scan/New all show text again; the
  QR-invert button is now an emoji (🌓) with an "Invert" label.
- Theme and language buttons moved to the far right of the bar behind a divider.
- Renamed "+ Code" to "New" with a 🆕 icon (was a hand/pencil, unclear); Scan and New are
  both accent-coloured now.
- The "+" add-category button no longer renders as a colourful emoji plus (which ignored
  the accent colour on some systems) — it's a plain, properly accent-coloured "+".

## 1.0.7

- Small grey version number next to the app title.
- Theme and language are now single toggle buttons (sun/moon, flag) like E-Ink Studio —
  the dropdowns are gone. "Auto" (follow Home Assistant) stays the persistent default from
  the add-on Configuration tab; clicking a button overrides light/dark or NL/EN for the
  current session only, and resets to Auto on reload.
- Import now asks **Cancel / Replace / Merge** in its own modal instead of a single
  merge/replace confirm.
- **Backup** is now a settings modal: enable a daily automatic backup, pick the time and
  how many backups to keep, plus a "Backup now" button — Cancel/OK on the right, Backup now
  on the far left. The add-on runs the scheduled backup itself in the background.
- Header buttons got compact icons (Export 📤, Import 📥, Backup 💾, Scan ⛶, manual add ✍️)
  with custom app-styled tooltips instead of the browser's default tooltip.
- "All codes" renamed to **All categories**; a virtual **Uncategorized** group now always
  shows codes without a category (not editable/deletable, no context menu).
- Categories can be combined: click several to filter by all of them at once.

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
