# Changelog

## 1.0.21

- Docs only: My-Home-Assistant install badge, Rematters/Jesse Hulswit credits, links to
  the new bilingual (EN/NL) wiki. No app behavior changes.

## 1.0.20

- Fixed the **Device dropdown in the Home Assistant link being empty**: the template
  used `states | map('device_id')`, but `device_id` is only a template *function* in HA,
  not a registered filter, so the request errored and silently returned no devices. Also
  fixed `map(attr=...)` → `map(attribute=...)` (wrong keyword, same silent failure).
- Fixed **pinch-to-zoom on the scan camera not doing anything** on phones whose camera
  doesn't report a hardware zoom capability (most of them) — it now falls back to a CSS
  zoom on the video preview so pinching always does something, and `touch-action: none`
  is set unconditionally so the browser's own page-zoom doesn't hijack the gesture instead.

## 1.0.19

- Fixed the Matter label PNG: the code name pushed the **matter** logo down but the QR
  wasn't shifted to match, so the logo landed behind the QR. Also made the whole label
  bigger and sharper (larger QR, bundled DejaVu Sans Mono in the container instead of
  silently falling back to a tiny bitmap font, and rendered at 2x then downsampled).
- **HA link redesigned again**: it's a real device picker now (`Device` dropdown, listing
  every HA device by name) instead of typing a raw entity ID — "Open device in Home
  Assistant" is a direct link to `/config/devices/device/<id>`, no server round-trip.
- Fixed the add-on serving a **stale cached page** after updates: the entry `index.html`
  was the one response missing a no-cache header (every other asset already had one), so a
  browser-cached copy could keep pointing at old script versions indefinitely. It's
  `Cache-Control: no-store` now.

## 1.0.18

- **Home Assistant link replaced**: "Pull from HA" (entity + attribute sync) is gone;
  instead the Entity ID field now shows an **"Open device in Home Assistant"** link that
  jumps straight to that device's page in HA.
- Mobile scan camera: **pinch-to-zoom** (two fingers) and **tap-to-focus**, where the
  browser/device supports it (Chrome on Android).
- Fixed the New/Edit code dialog showing a **horizontal scrollbar**.
- Matter payload decode (and its vendor/product auto-fill) now also runs right after a
  **scan**, not only after manually opening "Decode Matter payload" or editing the field —
  scanning a code fills the form without firing an input event, which is why it didn't
  trigger before.
- **Duplicate codes are now also blocked on restore from Trash** (same QR-payload/manual-code
  check as creating or editing a code): if the trashed code duplicates one already in your
  vault, you're asked to Cancel or Merge (merge discards the trashed copy).
- Fixed a latent bug where the duplicate-code warning's "open the existing one" action never
  actually worked (the server never sent which code it was — now it does).
- QR invert button icon now has a small fixed-contrast chip so it stays visible in both
  light and dark theme.
- Removed the "Vault and backups are stored in…" hint text under Categories.
- Trash button now has a visible "Trash" label next to its icon.
- Version badges in both READMEs now track the actual add-on version.

## 1.0.17

- Connectivity filter dropdown restyled to match the other filter controls exactly
  (same height/border/radius as the selects, not the pill-shaped button) — checkboxes
  underneath are also now a consistent size, and the search box lines up with the
  filters again.
- The inline "+ category" button in the New/Edit dialog now matches the Category
  select's height, with the `+` centered.
- **Device type** is now a suggest-dropdown (light, switch, sensor, lock, cover, …)
  while still accepting free text, same pattern as Area.
- The downloadable Matter label PNG (and its saved-to-media copy) now prints the
  code's name at the top, not just in the filename.
- New/Edit code dialog is ~10% wider (more room for the device-details fields).

## 1.0.16

- **Trash now has its own file**, `anti-matter-bin.json`, next to the vault on the SAMBA
  share — trashed items no longer live inside `anti_matter.json`. Existing trashed items are
  migrated automatically on first start.
- Trash button moved between Scan and Backup in the header.
- **New/Edit code dialog**: a `+` next to Category creates a category without leaving the
  form, and it's selected automatically once saved.
- Connectivity renamed **Matter → Thread** throughout (it's the radio, not the protocol).
- The 5 connectivity filter dropdowns are now a single **Connectivity** dropdown with
  checkboxes (matches any checked type).
- Decoding a Matter payload in the New/Edit form now auto-fills Device vendor/product from
  the official DCL record — unless you've already typed something there, which always wins.
- Double-clicking a QR image (card or quick-view) opens the decode popup directly.
- Table view: a single click on a code's name opens the quick-view popup (previously only
  double-click); double-click no longer risks a duplicate-open error.
- **Download** on a code also saves a copy under Home Assistant's Media folder
  (`media/anti_matter/`), alongside the browser download.
- Fixed **Scan/Upload photo inside the New or Edit dialog silently doing nothing** — it was
  trying to reopen the already-open code dialog, which throws and drops the scanned data.
- QR invert button now uses a `mdi:qrcode` icon that flips black/white with the toggle state.
- Grid/table view toggle moved down into the status bar (bottom-right, next to the code count).

## 1.0.15

- **Trash bin**: deleting a code or category now moves it to Trash instead of removing it
  immediately — a new Trash button in the header lists everything currently trashed, with
  Restore and Delete forever (permanent, with confirm) per item.
- Matter payload decode (inline in New/Edit, the popup, and the quick-view) now also shows
  the official DCL **Vendor site / Product page / Support page** links when the CSA
  registry has them.
- Added a small **decode button** next to Download/Edit/Delete on the QR card itself (Matter
  codes only), not just in the quick-view popup.
- Fixed the quick-view decode button looking out of place next to Download/Edit — it now
  uses the same button style/height as its neighbors.
- **Notes** field moved to the bottom of the Device details section in the New/Edit form.

## 1.0.14

- **Fixed dialogs staying visible when scrolled to**: a CSS rule meant to pin the dialog
  action row unconditionally applied `display: flex` to every `<dialog>`, which — because
  author styles always beat the browser's own `dialog:not([open]) { display: none }` —
  kept every closed dialog rendered in the page flow instead of hidden. This is also why
  **Cancel didn't visibly close the edit dialog**. Scoped the rule to `dialog[open]`.
- Removed the **Stock** field added in 1.0.13 — In use already covers it.
- **Matter payload decode now looks up the official vendor/product name** from the CSA
  Distributed Compliance Ledger (the public Matter certification registry — same source
  generate.matterqr.codes uses), shown next to the Vendor ID / Product ID rows when a
  match is found. Best-effort: no internet or an unassigned ID just shows the raw IDs.
- The quick-view popup gained a small **decode button** that opens the same Matter
  payload decode table in its own popup (only shown for Matter codes).

## 1.0.13

- **Logging overhaul**: server now logs export/import counts, backup runs (startup and
  manual), settings on boot, and every category/code add/remove/edit — with names redacted
  and pairing codes/QR payloads never written to the log. Removed the noisy repeated
  `GET /api/vault` polling lines from the log (custom access-log filter), and silenced an
  `invalid escape sequence` warning from `storage.py`.
- **Fixed "Pull from HA" false failure**: the alert lumped "code not saved" and "no
  attribute filled in" into one misleading message. Now split into two clear alerts, and
  the Home Assistant link section auto-expands if either field is missing.
- **Matter payload decoder**: expand "Decode Matter payload" under the QR/manual code
  fields to see the Vendor ID, Product ID, setup passcode, discriminator, discovery
  capabilities and commissioning flow — fully client-side, no external service.
- **No duplicate category names** — creating or renaming a category to a name that already
  exists (case-insensitive) is now rejected with a clear error.
- **Independent scrolling**: the categories sidebar and the code grid/table now scroll on
  their own, so a long category list no longer pushes "All categories" or the storage hint
  off-screen, and a long code list no longer scrolls the whole page.
- Dialogs (New/Edit code, categories, etc.) now keep their Cancel/Save button row **pinned**
  at the bottom while the form content above scrolls.
- Table view gained **In use**, **Stock**, and **Connectivity** columns; the quick-view
  popup's meta line now also shows In use, Stock, and Connectivity. (Stock was removed
  again in 1.0.14 — In use covers the same distinction.)
- **Multi-select + mass delete**: shift-click for a range, ctrl/cmd-click to toggle,
  on both the categories sidebar and the code grid/table. A selection bar shows the count
  with Delete selected / Clear buttons. Plain clicks keep their existing behavior (category
  filter toggle; nothing changes for a single code click).
- **Mobile layout**: categories now sit below the code grid instead of above it, so the
  code list is the first thing you see on a phone.
- **Scanning improvements**: the "this code is already saved" duplicate notice now uses the
  app's own popup instead of the browser's native alert/confirm (which could silently fail
  inside the Home Assistant ingress frame). Scanning several codes in a row without typing a
  name now numbers the default name ("Scanned device", "Scanned device 2", "Scanned device
  3", …) instead of colliding on the same name.

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
