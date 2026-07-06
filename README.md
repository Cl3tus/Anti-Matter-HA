# Anti-Matter — Home Assistant Add-on Repository

A local, cloud-free vault for your **Matter**, **HomeKit** and **Z-Wave** pairing codes and
QR payloads, running inside Home Assistant.

## Install

1. In Home Assistant go to **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
2. Add this repository URL:
   ```
   https://github.com/Cl3tus/Anti-Matter-HA
   ```
3. Install the **Anti-Matter** add-on and start it. Open it from the sidebar (it runs through
   Home Assistant ingress).

The add-on itself lives in [`anti_matter/`](anti_matter/) — see its
[README](anti_matter/README.md) and [docs](anti_matter/DOCS.md) for full details.

## Highlights

- Add, edit, scan and organize pairing codes with branded, scannable QR cards.
- Extra fields: vendor, product name, area (with HA area suggestions), description, category.
- Webcam scanning (mobile-friendly) + photo upload, fully offline.
- Local, SAMBA-reachable storage in the add-on config folder, included in HA backups.
- **Backup now** with automatic pruning, plus Export / Import.
- NL / EN / Auto language and Light / Dark / Auto theme that follows Home Assistant.
- No cloud, no account, no outbound connections.

## License

MIT — see [LICENSE](LICENSE).
