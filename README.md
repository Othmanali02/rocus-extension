# Rocus Browser Extension

Browser extension for [Rocus](https://rocus.io) — save pages to your Rocus
albums straight from any site.

- **Quick add** — a small Rocus icon appears on ordinary pages a moment after
  they load; click it to save the page in one step.
- **Save to album** — open the extension popup to pick a specific album (or
  quick-save with no album) before saving.

In both cases, if Rocus isn't already open in a tab, the extension opens it
in the background, saves the page, and closes it again — no need to have
rocus.io open yourself.

## Structure

This repo holds both browser builds, which share almost all of their source:

- [`chrome/`](./chrome) — Manifest V3 build for Chrome (and other
  Chromium-based browsers).
- [`firefox/`](./firefox) — Manifest V3 build for Firefox.

## Development

Each folder is a standalone unpacked extension:

**Chrome**
1. Go to `chrome://extensions`, enable Developer mode.
2. "Load unpacked" → select the `chrome/` folder.

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`.
2. "Load Temporary Add-on" → select any file inside the `firefox/` folder
   (e.g. `manifest.json`).

## Related

- [Rocus web app](https://github.com/Othmanali02/Rocus)
- [rocus.io](https://rocus.io)

## License

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See [LICENSE](./LICENSE).

The Rocus extension was released under the MIT License until 12 November 2026 and is licensed under AGPL-3.0 thereafter.

