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
- **Pull from HA** reads a value from a linked entity attribute (e.g. a `matter_setup_code`
  attribute) and fills the code in.

## Area suggestions

The **Area** field is a free-text input with autocomplete: it suggests the areas from your
Home Assistant area registry (read through the Supervisor API), but you can type any value.
If HA doesn't return areas, the field simply behaves as plain text.

## Backups & storage

- Your vault is `anti_matter.json` in the add-on config folder, reachable over SAMBA at
  `\\<HA-IP>\addon_configs\<slug>_anti_matter\`.
- **Backup now** writes a timestamped copy into `backups/` there. Copies beyond the
  **Backups to keep** setting are removed automatically.
- **Export** downloads the whole vault as JSON; **Import** loads one back (merge or replace).
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
