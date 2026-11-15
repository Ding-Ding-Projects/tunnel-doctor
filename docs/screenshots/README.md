# Screenshots

Captured on 2026-11-15 (America/Toronto) from the real web interface served by
`server/index.js` at source commit `d71f965` plus the uncommitted interface fixes
committed alongside these files. Captured offscreen with Electron
`webContents.capturePage()` against a fresh data folder, checking the public
hostname `ha.example.com` with no API token. No private hostnames, addresses or
tokens appear in any image.

| File | State | Viewport | Theme |
| --- | --- | --- | --- |
| `diagnose-light.png` | Diagnose, results after a run | 1424 x 835 | Light |
| `diagnose-dark.png` | Diagnose, failing public DNS selected | 1424 x 835 | Dark |
| `settings-dark.png` | Settings with its own regex builder open | 1424 x 835 | Dark |
| `diagnose-narrow.png` | Diagnose at phone width | 374 x 779 | Light |

SHA-256:

```
66177911eead7374269133122fd8d6cbdb1b848d7d7eae93c89fe80634c8fcbf  diagnose-dark.png
b0a61b95499f0c2c584121675922c26518d7937950ba552739e80923e459736f  diagnose-light.png
848af6b61c01d790b73a7b8f86f4e06916c1d3e823effbfb766974931180e6a8  diagnose-narrow.png
de08a5205b1b90850a74b438c96d80ca58c6850e5643c467e6ac6a5cd6fb1b9c  settings-dark.png
```

These show the interface in a browser. The installed desktop app loads the
same interface; captures of the installed desktop window are still to come
(see `ROADMAP.md`).
