# Anti-Matter — Documentation

For the full manual (including a Dutch translation), see the
[wiki](https://github.com/Cl3tus/Anti-Matter-HA/wiki). This file is a shorter overview.

## What it does

Anti-Matter is a local vault for your smart-home **pairing codes**: Matter setup codes,
HomeKit setup URIs and Z-Wave SmartStart DSKs. It parses each code, stores it, and renders
a scannable QR card so you can re-commission a device without hunting for the original label.

## Install

1. Add this repository to Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ →
   Repositories** and paste the repository URL.
2. Install **Anti-Matter**.
3. Start it and open it from the sidebar (it runs through Home Assistant ingress — no ports
   are exposed).

## Adding a code

- **+ Code** opens a modal. Pick the protocol (Matter / HomeKit / Z-Wave), fill in the name
  and any details (vendor, product, area, description, category, notes), and paste the manual
  code and/or QR payload. The inline **+** next to Category creates a new one without
  leaving the form.
- **Scan** (top bar, or inside the form) opens the camera. Point it at the QR on the device
  or its manual, with pinch-to-zoom and tap-to-focus where supported. On phones the rear
  camera is used. If the browser can't use the camera, use **Or upload a photo**.
- Opening or editing a Matter code decodes its payload in the background (vendor/product ID,
  passcode, discriminator, official CSA DCL name/links where available) and auto-fills
  Device vendor/product — typing something by hand always wins.
- Z-Wave codes get their own decode view (DSK, PIN, QR version, and — from a full
  SmartStart QR — manufacturer/product/device-class fields), available in the form, the
  quick-view popup, and by double-clicking a Z-Wave card.
- Saving or restoring a code that matches an existing one by QR payload or manual code is
  caught, with a Cancel/open-existing (or Cancel/Merge, when restoring) choice.
- **Home Assistant link (optional)**: pick a **Device** from the dropdown and an **Open
  device in Home Assistant** link appears, jumping straight to that device's page in HA.

## Area suggestions

The **Area** field is a free-text input with autocomplete: it suggests the areas from your
Home Assistant area registry (read through the Supervisor API), but you can type any value.
If HA doesn't return areas, the field simply behaves as plain text.

## Filtering and the table view

- The search box, the **Vendor / Product / Type / Area** dropdowns (filled from your own
  data) and the **Connectivity** dropdown (checkboxes, matches any type checked) combine
  with the category selection in the sidebar — click several categories to filter by all of
  them at once.
- The grid/table toggle (bottom-right, next to the code count) swaps the QR card grid for
  a filterable, spreadsheet-style table (your filters stay active). In table view, a single
  click on a code's name opens the quick-view popup.
- Double-click a QR image (grid card or quick-view popup) to open the Matter decode view.
- The **Invert** button renders QR codes in a dark-friendly negative for reading on dark
  screens.

## Backups & storage

- Your vault is `anti_matter.json` in the add-on config folder, reachable over SAMBA at
  `\\<HA-IP>\addon_configs\<slug>_anti_matter\`.
- Deleted categories/codes live in their own `anti-matter-bin.json` next to it until you
  restore or permanently delete them from the **Trash** dialog.
- **Download** on a code also drops a copy of the image under Home Assistant's Media
  folder, in `media/anti_matter/` (requires the add-on's Media access, granted automatically).
- The **Backup** button opens a schedule: enable automatic backups Hourly, Daily, Weekly or
  Monthly, pick the time (and weekday/day-of-month where relevant), and how many backups to
  keep. **Backup now** in the same dialog runs one immediately.
- Timestamped copies are written to `backups/`; older ones beyond the keep count are pruned
  automatically.
- **Export** downloads the whole vault as JSON; **Import** asks to Replace or Merge before
  loading it back.
- Everything in the add-on config folder is included in Home Assistant's own backups.

## Language & theme

Set defaults on the **Configuration** tab:

- **Language**: `Auto` follows your Home Assistant language, then the browser; or force
  `Nederlands` / `English`. You can also switch in-app with the flag menu.
- **Theme**: `Auto` matches Home Assistant's light/dark setting; or force `Light` / `Dark`.
  You can also switch in-app with the theme menu.

## Privacy

Anti-Matter has **no cloud, no account**. The only outbound internet connection is a
best-effort, never-required lookup against the official CSA Distributed Compliance Ledger
(DCL) when decoding a Matter payload, to show the vendor/product's public certification
name and links if one exists. Otherwise it only talks to your Home Assistant Supervisor
(entity states, areas, devices) and stores everything locally.

## Credits

Anti-Matter is a rewrite of [Rematters](https://github.com/Rematters/Rematters-HA) by
Jesse Hulswit ([JesseFPV](https://rematters.casa/)), reworked into a cloud-free, local-only
add-on. Full credit to Jesse for the original Rematters add-on and its design.
