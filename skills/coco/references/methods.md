# Coco agent methods

Generated from `coco capabilities --json` (71 methods). Bold params are required.
Tiers: `read` changes nothing, `act` touches the Mac, `admin` installs/removes plugins.
Call any method as `coco <area> <method> --param value` or `coco call area.method …`; add `--json`.

## Contents

- [apps](#apps) (9)
- [bridge](#bridge) (15)
- [calc](#calc) (1)
- [captions](#captions) (5)
- [clipboard](#clipboard) (7)
- [coco](#coco) (4)
- [currency](#currency) (1)
- [emoji](#emoji) (1)
- [launchpad](#launchpad) (1)
- [panel](#panel) (2)
- [plugins](#plugins) (4)
- [quicklinks](#quicklinks) (2)
- [raycast](#raycast) (5)
- [screenshot](#screenshot) (1)
- [settings](#settings) (5)
- [snippets](#snippets) (1)
- [store](#store) (6)
- [units](#units) (1)

## apps

| Method | Tier | Params | Description |
|---|---|---|---|
| `apps.activate` | act | `bundleID` (string), `path` (string) | Activates (brings to front) a running app, or launches it if not running. Same effect as apps.open. |
| `apps.forceQuit` ⚠️ | act | `bundleID` (string), `path` (string) | Force-terminates a running app without giving it a chance to save. No-op if the app isn't running. |
| `apps.hide` | act | `bundleID` (string), `path` (string) | Hides a running app (like Cmd-H). No-op if the app isn't running. |
| `apps.list` | read | — | The full installed-app catalogue (as scanned by AppDiscovery), unranked. |
| `apps.open` | act | `bundleID` (string), `path` (string) | Opens (launches or activates) an app by bundle identifier or path. |
| `apps.quit` ⚠️ | act | `bundleID` (string), `path` (string) | Asks a running app to quit (equivalent to Cmd-Q). No-op if the app isn't running. |
| `apps.reveal` | act | `bundleID` (string), `path` (string) | Reveals the app's bundle in Finder (does not launch/activate the app itself). |
| `apps.running` | read | — | Currently-running apps, from AppDiscovery.runningApps(). |
| `apps.search` | read | `limit` (number), **`query`** (string) | Ranked app search (pinyin/kana/initial-consonant + usage-frequency aware), the same pipeline behind the launcher's Apps tab. |

## bridge

| Method | Tier | Params | Description |
|---|---|---|---|
| `bridge.core.toast` | act | `duration` (number), **`message`** (string) | Shows a transient toast notification. |
| `bridge.fs.listFiles` | act | `allowedTypes` (string), `includeHidden` (boolean), **`path`** (string), `recursive` (boolean) | Lists files under a directory (optionally recursive/type-filtered). Refuses paths under Coco's secrets files or ~/Library/Keychains. |
| `bridge.fs.readBytes` | act | **`path`** (string) | Reads a file as base64. Refuses paths under Coco's secrets files or ~/Library/Keychains. |
| `bridge.fs.writeBytes` ⚠️ | act | **`base64`** (string), **`path`** (string) | Writes base64 bytes to a file. Refuses paths under Coco's secrets files or ~/Library/Keychains. |
| `bridge.http.fetch` | read | `body` (string), `headers` (string), `method` (string), **`url`** (string) | Performs an HTTP request and returns {status, headers, body, byteLength}. |
| `bridge.image.compressJPEG` | read | **`inputPath`** (string), **`outputPath`** (string), `quality` (number) | Compresses/re-encodes an image file to JPEG at the given quality. |
| `bridge.progress.fail` | act | `message` (string), **`taskID`** (string), `title` (string), `total` (number), `value` (number) | Progress HUD control (fail). Same as a plugin's coco.progress.fail. |
| `bridge.progress.finish` | act | `message` (string), **`taskID`** (string), `title` (string), `total` (number), `value` (number) | Progress HUD control (finish). Same as a plugin's coco.progress.finish. |
| `bridge.progress.start` | act | `message` (string), **`taskID`** (string), `title` (string), `total` (number), `value` (number) | Progress HUD control (start). Same as a plugin's coco.progress.start. |
| `bridge.progress.update` | act | `message` (string), **`taskID`** (string), `title` (string), `total` (number), `value` (number) | Progress HUD control (update). Same as a plugin's coco.progress.update. |
| `bridge.shell.exec` ⚠️ | act | **`command`** (string) | Runs a shell command via /bin/sh -lc and returns stdout/stderr/exitCode. Same as a plugin's coco.shell.exec. |
| `bridge.system.captureScreen` | act | — | Captures the whole screen and returns {base64, byteLength} PNG bytes. Requires Screen Recording permission. Prefer screenshot.capture for file output. |
| `bridge.system.pickColorFromScreen` | act | — | Opens the system color sampler and returns the picked color as {hex, r, g, b, a}. |
| `bridge.window.close` | act | **`id`** (string) | Closes a window opened by bridge.window.open. |
| `bridge.window.open` | act | `height` (number), `html` (string), `title` (string), `transparent` (boolean), `width` (number) | Opens an HTML window/overlay (the plugin window surface), owned by the Agent's own bridge instance. |

## calc

| Method | Tier | Params | Description |
|---|---|---|---|
| `calc.eval` | read | **`expression`** (string) | Evaluate a calculator expression (the same parser as the launcher's inline calculator). |

## captions

| Method | Tier | Params | Description |
|---|---|---|---|
| `captions.start` | act | — | Starts a Live Transcription session, capturing system audio and microphone audio together. |
| `captions.status` | read | — | Whether Live Transcription is running/paused, plus the tail of the current transcript. |
| `captions.stop` | act | — | Stops the active Live Transcription session and finalizes its transcript. |
| `captions.transcripts.list` | read | — | Past Live Transcription sessions, newest first. |
| `captions.transcripts.read` | read | `id` (string), `path` (string) | Read one session's transcript text, by session id (the base name from transcripts.list) or an explicit path inside the recordings directory. |

## clipboard

| Method | Tier | Params | Description |
|---|---|---|---|
| `clipboard.copy` | act | `imagePath` (string), `text` (string) | Writes text or an image file to the system clipboard. Exactly one of text/imagePath is required. |
| `clipboard.delete` ⚠️ | act | **`id`** (string) | Deletes a clipboard entry from history and/or favorites. |
| `clipboard.favorite` | act | **`favorite`** (boolean), **`id`** (string) | Sets whether a clipboard.list entry is favorited. |
| `clipboard.get` | read | **`id`** (string) | One clipboard entry by id. |
| `clipboard.list` | read | `favoritesOnly` (boolean), `limit` (number), `offset` (number) | Clipboard history entries, newest first, with concealed (password-manager sourced) entries filtered out. |
| `clipboard.paste` | act | `id` (string), `text` (string) | Pastes into the frontmost app: writes text (or a clipboard.list entry by id) to the clipboard, then sends Cmd-V. Requires Accessibility permission. |
| `clipboard.search` | read | `limit` (number), **`query`** (string) | Search clipboard history using the same matcher as the launcher's Clipboard tab. |

## coco

| Method | Tier | Params | Description |
|---|---|---|---|
| `coco.capabilities` | read | — | The full Agent method catalogue: every area.method this App version supports, with tier and schema. |
| `coco.consent.list` | read | — | The current AI-Agent access state: whether agent access is enabled and the user's blocked-methods list. Every method is allowed by default unless it appears here. |
| `coco.ping` | read | — | Liveness check. Returns "pong" if the App is reachable. |
| `coco.version` | read | — | The running App's version and build number. |

## currency

| Method | Tier | Params | Description |
|---|---|---|---|
| `currency.convert` | read | **`amount`** (number), **`from`** (string), `to` (string) | Convert an amount between currencies using the cached exchange-rate table (refreshed if stale). |

## emoji

| Method | Tier | Params | Description |
|---|---|---|---|
| `emoji.search` | read | `limit` (number), **`query`** (string) | Search the emoji catalogue by name/keyword/alias. |

## launchpad

| Method | Tier | Params | Description |
|---|---|---|---|
| `launchpad.layout.get` | read | — | The saved Launchpad grid layout (apps and folders, in order). |

## panel

| Method | Tier | Params | Description |
|---|---|---|---|
| `panel.hide` | act | — | Hides the launcher panel if it is visible. |
| `panel.show` | act | `mode` (string), `query` (string) | Shows the launcher panel, optionally on a specific tab and/or with a query already typed in. |

## plugins

| Method | Tier | Params | Description |
|---|---|---|---|
| `plugins.cancel` | act | **`taskID`** (string) | Cancels an in-flight plugin task started by plugins.run. |
| `plugins.commands` | read | `pluginID` (string) | Commands across every installed plugin, or one plugin's commands with pluginID. |
| `plugins.list` | read | — | Installed plugins (id, name, version, enabled state). |
| `plugins.run` | act | `args` (string), **`commandID`** (string), **`pluginID`** (string) | Runs an installed plugin command. Returns a taskID for correlating progress/cancellation. |

## quicklinks

| Method | Tier | Params | Description |
|---|---|---|---|
| `quicklinks.list` | read | — | All saved quick links. |
| `quicklinks.open` | act | `argument` (string), **`id`** (string) | Opens a saved quick link by id, resolving {clipboard}/{date}/{time}/{datetime}/{day}/{uuid}/{argument} placeholders in its URL. |

## raycast

| Method | Tier | Params | Description |
|---|---|---|---|
| `raycast.list` | read | — | Installed Raycast extension commands, with their compatibility layer (legacy no-view vs. declarative). |
| `raycast.run` | act | **`command`** (string) | Runs a legacy no-view Raycast extension command to completion and returns the actions it applied (clipboard writes, toasts, opened URLs). |
| `raycast.session.cancel` | act | **`sessionID`** (string) | Cancels a declarative-UI session started by raycast.session.start. |
| `raycast.session.read` | read | **`sessionID`** (string) | Reads a declarative-UI session's status. RaycastUIPresentation doesn't expose a rendered tree/text snapshot today, so this returns {sessionID, healthy, failureSummary} rather than the view content. |
| `raycast.session.start` | act | **`command`** (string) | Starts a declarative-UI Raycast extension command's session and returns a sessionID for raycast.session.read/cancel. |

## screenshot

| Method | Tier | Params | Description |
|---|---|---|---|
| `screenshot.capture` | act | `bundleID` (string), `display` (number), `mode` (string), `outputPath` (string), `rect` (string), `windowID` (number) | Captures the screen, one window, or a rectangular region to a PNG file. Requires Screen Recording permission. |

## settings

| Method | Tier | Params | Description |
|---|---|---|---|
| `settings.get` | read | **`key`** (string) | One config value by top-level key, or a dot path into it (e.g. "toggleHotKey.keyCode"). |
| `settings.list` | read | — | The full Coco configuration as JSON. Secret-shaped keys (apiKey/token/secret/password/license) are always stripped; those live in separate files this method never reads. |
| `settings.patch` | act | **`changes`** (object), `confirm` (boolean) | Set several top-level Coco config keys atomically. Unknown keys are rejected (-32602). See settings.set for the access rule. |
| `settings.schema` | read | — | Every top-level Coco config key with its JSON type, consent tier (act/admin), and hot-reload status (live/relaunch). |
| `settings.set` | act | `confirm` (boolean), **`key`** (string), **`value`** (object) | Set one top-level Coco config key. Unknown keys are rejected (-32602). Allowed by default unless agent access is disabled or the key is blocked in Settings > Agent Access. |

## snippets

| Method | Tier | Params | Description |
|---|---|---|---|
| `snippets.list` | read | — | All saved text snippets. |

## store

| Method | Tier | Params | Description |
|---|---|---|---|
| `store.install` | admin | **`id`** (string) | Installs (or updates, if already installed) a plugin by its Coco Store index id. |
| `store.installed` | read | — | Installed plugins that came from (or match) the Store index. |
| `store.list` | read | — | The published Coco Store plugin index. |
| `store.search` | read | **`query`** (string) | Search the Coco Store index by name/description/author. |
| `store.uninstall` ⚠️ | admin | **`id`** (string) | Uninstalls a plugin by id. |
| `store.update` | admin | — | Updates one plugin (by id) or every installed plugin with an available update, to the latest Store index version. |

## units

| Method | Tier | Params | Description |
|---|---|---|---|
| `units.convert` | read | `expression` (string), `from` (string), `to` (string), `value` (number) | Convert a unit expression, either as free text ("5 km to mi") or as value/from/to. |

⚠️ marks methods Coco flags as destructive (quit, delete, uninstall, shell/file writes).
