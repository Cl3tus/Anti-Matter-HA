# Anti-Matter

Store, organize and back up your **Matter**, **HomeKit** and **Z-Wave** pairing codes
and QR payloads — right inside Home Assistant.

Anti-Matter keeps a tidy vault of every commissioning code you own, renders a clean
scannable QR card for each one, and stores everything in a local folder that is reachable
over SAMBA and included in Home Assistant's own backups. No cloud, no account.

## Features

- **+ Code** — add a code manually or by scanning.
- **Scan** — webcam QR scanning (works on mobile), with a photo-upload fallback. Fully
  offline: the scanner fallback library is bundled, nothing is loaded from a CDN.
- **Rich fields** — name, device type, **vendor**, **product name**, **area**,
  **description**, category, notes, plus the protocol code + QR payload.
- **Area suggestions** — the Area field suggests your Home Assistant areas, but you can
  type anything.
- **Home Assistant link** — link a code to an entity attribute and pull the value in.
- **Categories** — colour- and icon-tagged, in the sidebar.
- **Backup now** — writes a timestamped JSON copy into the add-on config folder; old copies
  are pruned to your configured count.
- **Export / Import** — move your vault between installs as a single JSON file.
- **NL / EN / Auto** language and **Light / Dark / Auto** theme that follows Home Assistant.

## Storage

Everything lives in the add-on config folder, mounted at `/config` inside the add-on and
reachable on your network at:

```
\\<HA-IP>\addon_configs\<slug>_anti_matter\
    anti_matter.json          # the vault
    backups/                  # timestamped backups
```

Because it sits in the add-on config folder, it is automatically included in Home Assistant
backups.

## Configuration

| Option | Values | Meaning |
| --- | --- | --- |
| Language | Auto / Nederlands / English | UI language. Auto follows HA, then the browser. |
| Theme | Auto / Light / Dark | Auto follows HA's light/dark setting. |
| Backups to keep | 1–100 | How many timestamped backup copies to retain. |
