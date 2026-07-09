# Changelog

## 1.0.37

- Show the date/time a code was added: new sortable "Added" column in table
  view, and an "Added" line in the code quickview detail.

## 1.0.36

- Toolbar filter dropdowns (Vendor, Product, Type, Area, etc.) capped to ~6 rows
  with a scrollbar instead of growing unbounded; rows now have hover highlight
  and wrap long labels instead of overflowing. Panels also clamp to the
  viewport edge on open so they don't get clipped on narrow/mobile screens.
  Values were already alphabetically sorted.

## 1.0.35

- Mobile layout: the categories panel is now collapsed by default (was
  permanently open at the bottom, eating screen space) and expands as a
  slide-down overlay when tapped. Closes automatically after picking a
  category or tapping outside it.

## 1.0.34

- Table view ("Excel mode") column headers are now clickable to sort — click again
  to reverse direction. Works on all columns including computed ones (Categories,
  Connectivity).

## 1.0.33

- Camera QR scanning now downscales each frame onto an offscreen canvas before
  detecting (phones commonly stream 1080p+, far more than a QR code needs — that's
  extra work every tick for no benefit and part of what could crash the tab during a
  long scan) and also asks the camera for a more modest 1280x720 instead of whatever
  resolution it defaults to.
- The scanner now briefly draws a highlight box around a detected QR code (like a
  phone's native camera app) before closing, so a successful read is visibly
  confirmed instead of the view just cutting out.

## 1.0.32

- Found the actual root cause of the mobile crash-reload during scanning (present
  before the flash feature too, not just with it on): the camera scan loop sampled
  every displayed video frame via `requestAnimationFrame` — up to 60-120 times a
  second on a phone — with no throttling at all. On devices without a hardware
  barcode-detection backend that's enough sustained CPU/memory pressure to crash
  the tab's renderer while scanning, which Chrome recovers from by silently
  reloading the page. Throttled to ~8 scans/sec (matching the older-browser
  fallback's own long-established rate), still plenty responsive.

## 1.0.31

- Fixed a mobile-only crash: stopping the camera right after a successful scan while
  the flash/torch was on could crash the phone's camera hardware, which Chrome
  recovers from by silently reloading the page — looking like the whole app crashed
  right after reading a code. The torch is now always turned off first and its own
  turn-off is awaited before the camera track is stopped.

## 1.0.30

- Fixed a real bug where "Upload photo" silently did nothing on a failed scan: a
  cleanup call (`Html5Qrcode.clear()`) could return `undefined` instead of a Promise,
  and calling `.catch()` on that crashed *before* the actual error message ever got
  a chance to show. The error now also shows inline right under the button instead
  of only a modal, so it's not missed.
- Added a Flash button in the Scan dialog (mobile) to turn the camera's torch on for
  extra light — only shown when the device/browser actually reports the capability.

## 1.0.29

- Upload photo (New/Edit dialog) now reads "Upload photo" right on the button itself,
  the redundant heading above it is gone.
- The Z-Wave device-database link in the decode dialog now jumps straight to the
  matched device on devices.zwave-js.io (`?jumpTo=mfg:type:id`) when the QR's TLV tail
  carries that metadata, instead of always linking to the site's homepage.
- Fixed the category checkboxes in the New/Edit dialog rendering centered/stacked
  instead of left-aligned — a generic `dialog label { flex-direction: column }` rule
  was leaking into them.

## 1.0.28

- The category field in the New/Edit dialog is now a dropdown with checkboxes (like
  the toolbar's Vendor/Product/Type filters) instead of a horizontally-scrolling row —
  cleaner with a lot of categories, and scrolls vertically inside the panel instead.
- HomeKit and Z-Wave pairing cards have their thin black border back, matching Matter's.
- Upload photo (New/Edit dialog) is now a pill-shaped button instead of a plain native
  file input with its default boxy frame.
- Z-Wave decode now looks up the official manufacturer/product name (like Matter's CSA
  DCL lookup) against a local snapshot of the zwave-js project's own device config
  database — the same data devices.zwave-js.io itself is generated from. Z-Wave has no
  live public registry API to query, so this ships as a bundled index refreshed via
  `tools/build_zwave_device_db.py` rather than a network call per lookup.
- Selecting Z-Wave as the protocol now also turns on the Z-Wave connectivity checkbox
  automatically (a Z-Wave code is Z-Wave connectivity by definition) — doesn't touch it
  again once you've saved a code, so unchecking it by hand still sticks.
- The category color picker now shows 12 preset swatches to pick from, alongside the
  native color picker.

## 1.0.27

- A code can now belong to **multiple categories**. The category field in the New/Edit
  dialog is a checkbox row instead of a single-select dropdown; if it has more entries
  than fit, it scrolls horizontally instead of wrapping. Old vaults with a single
  `category_id` per code are migrated automatically on load.

## 1.0.26

- Added a **Clear filters** button next to the filter dropdowns.
- **In use** filter is now All/Yes/No (exclusive, like a radio button) instead of
  Yes/No checkboxes that could both be checked at once with no clear meaning.
- Every checkbox filter that can apply to an unset field (Vendor, Product, Type, Area,
  Connectivity) now has an **(Empty)** option, so codes with nothing set there are still
  reachable through the filter instead of just disappearing once you check something else.
- Fixed **Upload photo inside the New/Edit dialog silently doing nothing** on some
  browsers/devices: it was a hidden `<input>` behind a styled label, which apparently
  doesn't reliably forward clicks everywhere — swapped for a plain visible file input,
  the same one already confirmed working in the standalone Scan dialog.
- **Categories are case-insensitive** (already true for duplicate detection) and now
  always display with a capitalized first letter, regardless of how they were typed —
  the stored name itself isn't changed.
- Added a link to the Z-Wave JS device database (devices.zwave-js.io) in the Z-Wave
  decode popup, next to Close.

## 1.0.25

- Z-Wave card: dropped the manufacturer/type/ID summary line — just PIN and the full DSK
  below the QR now.
- HomeKit and Z-Wave cards: removed the border, matching a plain borderless card.

## 1.0.24

- **HomeKit and Z-Wave cards redesigned to match Matter's**: same white card, thin black
  border, size, and layout (wordmark logo on top, QR in the middle, code printed below).
  Previously HomeKit used a thick black Apple-style frame with a big digit-box display,
  and Z-Wave used a dark navy card — both looked out of place next to Matter's cards.
  Uses the official HomeKit and Z-Wave wordmark/icon logos, bundled the same way as
  Matter's own logo (falls back to plain text if the asset is ever missing).

## 1.0.23

- **Z-Wave decode expanded**: Version (S2/SmartStart), Security classes (S2 Access
  Control/Authenticated/Unauthenticated, S0) and Supported protocols (Z-Wave/Long Range)
  as read-only checkboxes, plus hex values alongside decimal for device class/manufacturer/
  product fields and a split App version (major/minor) — matches zwave-js-ui's own layout.
- Fixed a real parsing bug: the Product Id TLV type constant was wrong (2 instead of the
  spec's 1), so manufacturer/product metadata from a real SmartStart QR's TLV tail was
  never actually recognized — only appeared to work in hand-built test data that
  (accidentally) used the same wrong constant on both ends.
- Fixed `hasScannableQr`/`extractQrString` wrongly requiring a QR string to be at least 90
  characters — valid SmartStart QR codes with a short or missing TLV tail are shorter than
  that and were being rejected as "no code yet" or misclassified as Matter during a scan.
- **All toolbar filters are now checkbox dropdowns** (matching any checked value), including
  a new **Protocol** filter (Matter/HomeKit/Z-Wave) — Vendor/Product/Type/Area/In use were
  previously single-select.
- **HomeKit card redesigned**: adds the "HomeKit" wordmark under the house icon, and prints
  the xxx-xx-xxx pairing code under the QR (previously icon + big digit boxes only).
- **HomeKit and Z-Wave cards now match Matter's**: same width, and the download/edit/delete
  icons are hidden until hover (previously always visible, and smaller than Matter's card).
- No live vendor/product name lookup for Z-Wave (unlike Matter's CSA DCL) — the Z-Wave
  Alliance product catalog has no public API for this, only an anti-bot-protected search
  page, so nothing to reliably call.

## 1.0.22

- Fixed the generated Z-Wave card: the QR code rendered far smaller than intended, with a
  big empty gap before the DSK digits. The qrcode library labels its own SVG in
  millimeters, and embedding that verbatim inside our unitless card viewBox made the
  browser apply an independent mm→px conversion on top of our own scaling — the QR is
  now full-size and correctly centered.
- Added a **Z-Wave decode** view (matching the Matter one): DSK, PIN, QR version, and —
  when a full SmartStart QR (not just a bare DSK) is available — manufacturer ID, product
  type/ID, application version, device class and installer icon type, all parsed straight
  from the payload. Available in the New/Edit form, the quick-view popup, and via
  double-clicking a Z-Wave card.

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
