# Anti-Matter — Documentation

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
  code and/or QR payload.
- **Scan** (top bar, or inside the form) opens the camera. Point it at the QR on the device
  or its manual. On phones the rear camera is used. If the browser can't use the camera, use
  **Or upload a photo**.
- **Home Assistant link (optional)**: pick a **Device** from the dropdown and an **Open
  device in Home Assistant** link appears, jumping straight to that device's page in HA.

## Area suggestions

The **Area** field is a free-text input with autocomplete: it suggests the areas from your
Home Assistant area registry (read through the Supervisor API), but you can type any value.
If HA doesn't return areas, the field simply behaves as plain text.

## Filtering and the table view

- The search box and the **Vendor / Product / Type / Area** dropdowns (filled from your own
  data) combine with the category selection in the sidebar — click several categories to
  filter by all of them at once.
- The table-view button swaps the QR canvas for a filterable, spreadsheet-style list (your
  filters stay active). Click it again to switch back.
- Double-click a row to open a quick-view popup with the rendered QR/card image and the
  manual/pairing code.

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

Anti-Matter has **no cloud** and makes no outbound internet connections. It only talks to
your Home Assistant Supervisor (to read entity states and area names) and stores data locally.
