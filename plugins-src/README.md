# Coco Plugins

The official plugin source for [Coco](https://coco.butterflydream.ai/). Every
plugin is a folder under `plugins/`. The build step validates manifests, packages
each plugin as a zip, computes its sha256, and generates `index.json` + a
browsable gallery in `dist/`. Those built artifacts get copied to `../plugins/`
at the repo root, which the Coco public site serves directly via GitHub Pages.

Coco reads <https://coco.butterflydream.ai/plugins/index.json> and installs the
`default_plugins` set on first launch.

This monorepo lives at `plugins-src/` inside the public Coco distribution repo
(`butterflydream-ai/Coco`). Repo root layout:

```
plugins/             # built artifacts, served by Pages (index.json + zips/)
plugins-src/         # this monorepo (source + build script)
```

## Layout

```
plugins-src/plugins/<plugin-id>/
  manifest.json     # required — see CONTRIBUTING.md
  main.js           # required
  icon.png          # optional, 128x128 recommended
  README.md         # optional
```

## Adding / updating a plugin

See [CONTRIBUTING.md](CONTRIBUTING.md). The build is currently manual — after
editing a plugin under `plugins/`, regenerate the served artifacts:

```sh
cd plugins-src
npm test            # runs scripts/build-index.test.mjs
npm run build       # writes dist/{index.json, zips/, index.html}
rm -rf ../plugins/zips
cp -R dist/index.json dist/index.html dist/zips ../plugins/
[ -d dist/icons ] && cp -R dist/icons ../plugins/ || true
```

Then commit both `plugins/` and `plugins-src/` together.
