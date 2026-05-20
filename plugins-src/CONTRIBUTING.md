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
3. To have your plugin ship in Coco's first-launch default set, a maintainer adds
   its `id` to the `default_plugins` list in `scripts/build-index.mjs`
   (`DEFAULT_PLUGINS`). Third-party submission policy is still being defined —
   for now the default set is curated by maintainers.
4. Open a PR. CI runs `npm test` (manifest validation + index generation). On
   merge to `main`, the gallery + index redeploy automatically.

## Categories

One of: `productivity`, `utilities`, `developer`, `media`, `fun`, `other`.
