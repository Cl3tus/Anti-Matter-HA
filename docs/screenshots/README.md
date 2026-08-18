# Wiki screenshots

The [wiki](https://github.com/Cl3tus/Anti-Matter-HA/wiki) pulls its screenshots from here,
via raw URLs like:

```
https://raw.githubusercontent.com/Cl3tus/Anti-Matter-HA/main/docs/screenshots/en/<name>-en.png
https://raw.githubusercontent.com/Cl3tus/Anti-Matter-HA/main/docs/screenshots/nl/<name>-nl.png
```

Put the English UI shots in `en/` and the Dutch ones in `nl/`, with the file name suffixed
by language in both (`grid-view-en.png` / `grid-view-nl.png`). The wiki pages already
reference these paths, so a shot appears the moment its PNG is pushed here.

## Shot list

Use a **dummy code** (throwaway name + fake manual code) — these go public, and a real
Matter/Z-Wave setup code is a live pairing secret.

| File name | What it shows |
| --- | --- |
| `anti-matter-dark-light-tear` | Hero shot: the grid split diagonally between Dark and Light theme, showing Matter/HomeKit/Z-Wave/Tuya/Zigbee/Wyze cards side by side. |
| `full_screen_black` / `full_screen_dark` | Full add-on window, Dark theme. (EN uses `full_screen_black`, NL uses `full_screen_dark` — same shot, historical naming mismatch between the two languages.) |
| `full_screen_light` | Full add-on window, Light theme. |
| `grid-view` | The QR-card grid with a few codes + categories in the sidebar. |
| `table-view` | The spreadsheet-style table view (grid/table toggle, bottom-right). |
| `new-dialog` | New/Edit code dialog, ideally with the Matter decode section expanded. |
| `filter-connectivity` | The Connectivity filter dropdown open, showing the checkboxes. |
| `ha-device-search` | Edit dialog → "Home Assistant link" open, typing in the device field with filtered suggestions showing. |
| `ha-device-suggestion` | The "Suggested: &lt;device&gt;" auto-match hint under the device field. |
| `quickview-ha-links` | Quick-view popup showing "Open device in Home Assistant" (only appears once a code is linked). |
| `trash-dialog` | The Trash dialog. |
| `backup-dialog` | The Backup dialog with a schedule configured. |

Shoot Light and Dark where the wiki shows both; keep the same browser width across the set;
crop to the add-on panel and avoid showing real device names / MAC / IP.
