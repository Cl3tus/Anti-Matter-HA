# Wiki screenshots

The [wiki](https://github.com/Cl3tus/Anti-Matter-HA/wiki) pulls its screenshots from here,
via raw URLs like:

```
https://raw.githubusercontent.com/Cl3tus/Anti-Matter-HA/main/docs/screenshots/en/<name>.png
https://raw.githubusercontent.com/Cl3tus/Anti-Matter-HA/main/docs/screenshots/nl/<name>.png
```

Put the English UI shots in `en/` and the Dutch ones in `nl/`, using the **same file name**
in both folders. The wiki pages already reference these paths, so a shot appears the moment
its PNG is pushed here.

## Shot list

Use a **dummy code** (throwaway name + fake manual code) — these go public, and a real
Matter/Z-Wave setup code is a live pairing secret.

| File name | What it shows |
| --- | --- |
| `grid-view.png` | The QR-card grid with a few codes + categories in the sidebar. |
| `table-view.png` | The spreadsheet-style table view (grid/table toggle, bottom-right). |
| `edit-dialog.png` | New/Edit code dialog, ideally with the Matter decode section expanded. |
| `filter-connectivity.png` | The Connectivity filter dropdown open, showing the checkboxes. |
| `ha-device-search.png` | Edit dialog → "Home Assistant link" open, typing in the device field with filtered suggestions showing. |
| `ha-device-suggestion.png` | The "Suggested: &lt;device&gt;" auto-match hint under the device field. |
| `quickview-ha-links.png` | Quick-view popup showing "Add in Home Assistant" + "Open device in Home Assistant". |
| `qr-fullscreen.png` | The fullscreen scannable QR overlay (after tapping the QR in quick-view). |
| `trash-dialog.png` | The Trash dialog. |
| `backup-dialog.png` | The Backup dialog with a schedule configured. |

Shoot Light and Dark where the wiki shows both; keep the same browser width across the set;
crop to the add-on panel and avoid showing real device names / MAC / IP.
