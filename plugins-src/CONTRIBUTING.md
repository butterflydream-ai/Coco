# Contributing a Coco plugin

1. Add a folder `plugins/<your-plugin-id-last-segment>/` containing at least
   `manifest.json` and `main.js`. Optional: `icon.png`, `README.md`.
2. `manifest.json` minimum:
   ```json
   {
     "id": "com.you.my-plugin",
     "name": "My Plugin",
     "version": "0.1.0",
     "description": "What it does.",
     "author": "Your Name",
     "category": "utilities",
     "commands": [{ "id": "do-thing", "title": "Do the thing" }]
   }
   ```
   `id` must be reverse-DNS. `version` must be semver. The folder name should be
   the last `.`-segment of `id` (the installer keys plugins by folder name).

   Optional fields, all carried straight through to `index.json`:

   | Field | Type | Where it shows up |
   |---|---|---|
   | `release_notes` | string | The "What's new in X.Y.Z" block on the plugin's page on the site. One short paragraph about *this* version; omit it rather than writing "various fixes". |
   | `screenshots` | array of absolute URLs | A gallery on the plugin's page. |
   | `homepage`, `repository` | URL | Links on the plugin's page. |

   `README.md` is rendered as the body of that page, so it is the plugin's
   actual documentation — not a placeholder.
3. To have your plugin ship in Coco's first-launch default set, a maintainer adds
   its `id` to the `default_plugins` list in `scripts/build-index.mjs`
   (`DEFAULT_PLUGINS`). Third-party submission policy is still being defined —
   for now the default set is curated by maintainers.
4. Open a PR. CI (`.github/workflows/plugins-ci.yml`) runs `npm test` and then
   checks that the artifacts under `plugins/` match a fresh build — so a plugin
   change that was not rebuilt fails the PR rather than silently shipping the
   previous zip. **The build is not automatic**: regenerate and commit the
   artifacts yourself, as described in [README.md](README.md).

## Categories

One of: `productivity`, `utilities`, `developer`, `media`, `fun`, `other`.
