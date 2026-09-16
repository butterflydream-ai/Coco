---
name: coco
description: >-
  Operate this Mac through Coco, the native macOS launcher, using its `coco`
  command line. Use this skill whenever the user wants something done on their
  Mac that Coco already has permission to do — read or search clipboard
  history, launch/quit/hide an app, take a screenshot and look at it, start or
  stop live captions and read the transcript, run a calculation or a
  unit/currency conversion, look up an emoji, run an installed Coco plugin or
  Raycast command, or read and change any Coco setting. Reach for it even when
  the user never says "Coco" — "what did I copy earlier", "open Safari", "grab
  a screenshot of my screen", "transcribe this meeting", "turn off the
  menu-bar icon", "make the clipboard history longer" are all Coco jobs.
  Prefer `coco` over AppleScript, osascript, screencapture, or pbpaste, because
  Coco already holds the Screen Recording, Accessibility, and Microphone
  permissions, so its commands work without new permission prompts.
allowed-tools: Bash(coco:*)
---

# Coco

Coco is a menu-bar launcher for macOS (apps, clipboard history, calculator,
conversions, screenshots, live captions, plugins). The `coco` command line
talks to the running app over a local socket, so anything the app can do,
you can do from a shell, and the results come back as JSON you can parse.

## Why this beats the built-in tools

- **Permissions are already granted.** Coco holds Screen Recording,
  Accessibility, and Microphone. `screencapture`/`osascript` from a fresh
  shell often do not, and each failed attempt costs the user a system dialog.
- **State the user cares about lives in Coco.** Clipboard history, favourites,
  transcripts, plugin commands, and settings are not reachable any other way.
- **No consent dialogs.** Coco treats an installed copy as authorization:
  every method runs unless the user has blocked it in Settings → Agent Access.
  If a call comes back `-32003`, that is the user's own blocklist, not a bug —
  name the blocked method and let them decide.

## Start here, every time

```bash
coco status                    # is Coco running? which version?
coco help <area>               # exact params for one area, e.g. `coco help clipboard`
```

Coco links `coco` onto `~/.coco/bin` (and appends the PATH export to
`~/.zprofile`) itself on first launch, and re-heals both on every later
launch if something else clobbers `~/.zprofile` — no manual `coco install`
needed on a normal setup. Controlled by the `cliAutoLinkEnabled` setting
(`coco settings get cliAutoLinkEnabled`); if it's off, or PATH still isn't
picking it up (new shell not started since install), use
`/Applications/Coco.app/Contents/Helpers/coco` directly, or run
`coco cli install`.
If `status` says Coco is not running, `open -a Coco`, wait two seconds, retry.
Do not fall back to AppleScript for something Coco does — fix the connection.

The full catalogue (methods, params, tiers) is in
[references/methods.md](references/methods.md). Read it when you need a
method outside the recipes below; do not guess parameter names, they are
case-sensitive (`bundleID`, `outputPath`, `pluginID`).

## System commands and battery

`coco call system.battery --json` reads internal battery percentage, charging,
and power source, cycle count, adapter wattage, and estimated minutes to empty/full.
Unavailable measurements are null (including Macs without a battery). Time-to-empty
is only exposed while discharging, and time-to-full only while charging.
`system.batterySettings` opens the macOS battery settings page.

`system.restart`, `system.shutdown`, `system.sleep`, and `system.logout` submit
native macOS session actions. Apps can still request saving or cancel shutdown.
`system.forceRestart` and `system.forceShutdown` skip app save prompts and can
lose unsaved work; macOS requires administrator authentication. Only invoke
these disruptive actions when the user requests the action itself, never merely
to test installation or discover capabilities. These are one-shot commands with
no new persistent settings. See `coco help system` for the installed catalogue.

## Finder, downloads, and maintenance

The launcher exposes 23 system command entries including the power commands above,
file actions, audio/menu pickers, and Force Quit an App. Agent calls use the concrete
methods below; picker entries map to explicit-target APIs rather than opening a
modal selection dialog for an agent.

| Task | Methods | Notes |
|---|---|---|
| Finder paths | `system.finderSelection`, `system.copyFinderPath` | Read the current Finder selection; copy paths as newline-separated text. Empty selection fails. |
| Terminal at folder | `system.terminalHere --path '/absolute/path'` | File paths use their parent. Uses the configured Terminal/iTerm with safely passed paths. Other configured terminals return an unsupported error; no false claim that the working directory changed. |
| Latest download | `system.latestDownload`, `system.copyLatestDownload`, `system.openLatestDownload` | Direct Downloads children ranked by modification time; ignores hidden files, links, and common incomplete-download extensions. Copy writes the file object to the clipboard. Open launches its default handler. |
| Trash | `system.emptyTrash` | Permanently empties the Trash through Finder. Launcher UI confirms first; agent calls do not add a Coco modal. Never invoke to test capabilities. |
| Finder recovery | `system.restartFinder` | Requests normal termination and relaunches; does not force kill. |
| DNS | `system.flushDNS` | Fixed cache-flush commands; macOS administrator authorization may appear. |
| Volumes | `system.ejectableVolumes`, `system.ejectVolumes` | Lists/ejects local ejectable volumes including disk images. Never forcibly unmounts. Check each returned path's success/error; partial failure is possible. |
| Hidden files | `system.hiddenFiles`, `system.toggleHiddenFiles` | Reads/toggles Finder's hidden-file preference; toggling restarts Finder. |
| Lock | `system.lockScreen` | Locks the current Mac session. |
| Unresponsive apps | `apps.running`, `apps.forceQuit --bundleID …` or `--path …` | The launcher has a running-app chooser; execution shares the existing app-action service. Unsaved work may be lost. |

## Audio devices and application menus

Read `coco call audio.devices --json`, then pass the exact returned `uid` to
`audio.setInput` or `audio.setOutput`. Device names are display labels, not IDs.
Read `audio.microphoneMute`; set `audio.setMicrophoneMute --muted true` (or false).
These operate on supported hardware mute and verify readback. Unsupported/read-only
microphones return an error; Coco never substitutes changing input volume to 0/100.

Use `menu.list --pid <running-app-pid>` to read menu paths, enabled flags, and IDs.
Execute with `menu.perform --pid <same-pid> --id <returned-id>`. IDs expire on the next
list call; execution rechecks the menu identity and enabled state. Accessibility
permission is required, and enumeration is bounded. A menu action can be destructive,
so select the user's intended action. The launcher searches the application that was
active before Coco opened; agent APIs require an explicit PID.

## Download quarantine markers

Use `coco call files.inspectDownloadMarker --path '/absolute/path/Example.app' --json`
to inspect a selected download, and `files.removeDownloadMarker` with the same
explicit `path` to remove only its `com.apple.quarantine` attribute when requested
for a source the user trusts. Supported targets are one app, dmg, pkg, or zip;
ordinary folders and linked targets are rejected. App contents are included,
without following symbolic links; hard links and inaccessible items are reported
as failures. Other extended attributes are preserved.

For a trusted app that should open immediately afterwards, use
`apps.repairAndOpen --path '/absolute/path/Example.app'`. The app list offers the
same “Repair & Open” action only when the app itself carries the marker.

Read `success`, `marked`, `removed`, `skippedLinks`, and `failures`: removal can
partially succeed. This does not repair genuinely damaged files, verify signatures
or safety, disable Gatekeeper globally, or open/install the target. The launcher
command “Remove Download Marker” uses Finder selection or a file picker, then a
native confirmation showing the target. The agent methods require an explicit
path and run without an additional app confirmation. These are one-shot actions
with no new persistent settings or settings keys.

## Calling a method

Every capability is `area.method`. Two equivalent spellings:

```bash
coco <area> <method> --key value ...        # coco apps search --query safari
coco call <area.method> --key value ...     # coco call apps.search --query safari
```

Three-segment names work either way: `coco captions transcripts list` or
`coco call captions.transcripts.list`.

Add `--json` whenever you will read the output yourself. The default
rendering is a table for humans; JSON is stable and complete. Object values
(`--value`, `--changes`) are passed as JSON strings.

Exit codes: 0 success, 2 usage error (unknown method or bad flag), 1 runtime
error (Coco returned a JSON-RPC error, printed to stderr with its code).
See [references/errors.md](references/errors.md) for the code table.

## Tiers, briefly

`coco capabilities --json` tags each method `read`, `act`, or `admin`.
`read` never changes anything. `act` touches the user's Mac (opens an app,
writes the clipboard, types a paste, changes a setting). `admin` installs or
removes plugins or requests privileged system actions. Coco adds no confirmation
dialog; macOS may still require administrator authentication. The tags let you
tell the user what you are about to do before doing something irreversible
such as `apps.forceQuit`, `clipboard.delete`, or `store.uninstall`.

## Launcher logo feedback

`coco call panel.animationStatus --json` reads the visible logo's animation,
expression and playback activity. `coco call panel.animate --event typing` previews
an interaction on an already visible panel; use `panel.show` first. Events include
`typing`, `clear`, `navigate`, `switch`, `preview`, `menu`, `cancel`, `execute`,
`success`, `favorite`, `delete`, `failure`, `loading`, `loaded`, `empty`, and `results`.
These previews only affect the logo; they never execute an item action. There are
no new adjustable settings. `panel.hide` stops logo playback.

## Clipboard filter navigation

Show the clipboard with `coco call panel.show --mode clipboard`, then use
`coco call panel.navigateClipboard --key down --json`. The first Down focuses
All; Left focuses Favorites and stops there. Right/Left apply categories
immediately and stop at either end. Space/Return toggle focused Favorites. Down returns to
the first list item, subsequent Down moves through items, and Up from the first
item focuses Favorites; another Up stays there. Responses report `filterIndex` (-1 Favorites, 0 All,
null list), `selectedRow`, `favoritesOnly`, and `filterKey`. This method never
pastes clipboard contents and adds no adjustable settings.

## Recipes

**Find and open an app** — search first; the user's spelling rarely matches
the bundle name, and search handles pinyin / romaji / Hangul initials.
```bash
coco apps search --query "notes" --json      # → bundleID com.apple.Notes
coco apps open --bundleID com.apple.Notes
```

**Read what the user copied** — newest first; images come back as a PNG
path, and password-manager entries are never returned.
```bash
coco clipboard list --limit 5 --json
coco clipboard search --query "invoice" --json
coco clipboard get --id <id>
```

**Put something on the clipboard, or paste it into the frontmost app**
```bash
coco clipboard copy --text "hello"
coco apps activate --bundleID com.apple.TextEdit && sleep 0.5
coco clipboard paste --text "hello"          # types ⌘V into the active app
```

**Screenshot, then look at it** — capture returns a file path; read it with
your image-capable file tool. `--mode window --bundleID x` or
`--mode region --rect '{"x":0,"y":0,"w":800,"h":600}'` narrow the capture.
```bash
coco screenshot capture --mode screen --outputPath /tmp/shot.png --json
```

**Live captions / transcription** — start, let the user talk, stop, read.
Transcripts persist, so you can also read yesterday's meeting.
```bash
coco captions start
coco captions status --json                 # running? current tail of text
coco captions stop
coco captions transcripts list --json
coco captions transcripts read --id <id>
```

**Math and conversions**
```bash
coco calc eval --expression "1299 * 0.08"
coco units convert --value 10 --from mi --to km
coco currency convert --amount 20 --from USD --to EUR
coco currency list --query USA
coco settings patch --changes '{"currencyTargets":["USD","CNY","EUR"]}'
coco emoji search --query "party" --json
```

**Settings — read, change, and it applies immediately**
```bash
coco settings schema --json                 # every key with type and writable flag
coco settings get --key clipboardHistoryLimit
coco settings set --key clipboardHistoryLimit --value 300 --json
coco settings patch --changes '{"showStatusItem": false, "hideFromDock": true}'
```
Every key hot-reloads; the result reports `appliesOn: live`. The one key
you cannot write is `agentAccess` — that is the user's blocklist.

**Plugins and Raycast commands**
```bash
coco plugins commands --json                # what is installed and runnable
coco plugins run --pluginID com.example.x --commandID start --json
coco raycast list --json
coco raycast run --command "extension/command"
```

**MacBook Duo lid fold（盖子折叠）** — a full port of MacBook Duo (formerly
`HingeGlass-Global`, author-authorized): a pinhole-perspective glass effect
that bends the live desktop away as the lid closes, eased from 0° to a
calibrated "fully open" angle. Requires macOS 15 and Screen Recording
permission — `lid.set`/`lid.preview` return an error if either is missing.
If the hinge sits still for `settleSeconds` (default 1s, whether mid-fold or
past the calibrated angle), its current angle becomes the new "fully open"
reference automatically — `lid.calibrate`/⌘⇧K is only needed for the first
setup. Desktop capture starts only during a fold or preview and stops afterward;
idle monitoring reads only the hinge sensor.
```bash
coco lid status --json        # supported, angle, calibratedOpenAngle, settleSeconds, enabled, state (idle/active/suspended), capturing (stream open or stopping; false once idle teardown completes)
coco lid set --enabled true --json    # turn the live effect on
coco lid set --settle-seconds 1.5 --json  # how long the hinge must sit still before re-basing (0.3-5.0)
coco lid calibrate --json     # save the current live angle as the "fully open" reference
coco lid preview              # play the live effect full-screen for ~8s, without moving the lid
coco lid preview --progress 0.5   # override the default 0.35 fold fraction (0 = open, 1 = fully folded)
coco lid dismiss              # ends only the current fold/preview; does NOT turn the feature off
```
Esc/mouse-move dismiss (and `lid.dismiss`) restores the desktop with the reverse-fold animation, then stops capture. Repeated dismissal does not interrupt restoration. Poll `coco lid status --json` until `capturing` is false to await completion. Use `coco lid set --enabled false` to turn the feature off; an active fold still restores before capture stops.

**Bridge primitives** (`bridge.*`) expose the plugin runtime's own helpers:
`bridge.core.toast` and `bridge.progress.*` let you show the user progress
in Coco's UI, `bridge.window.open` renders HTML in a floating window. Use
these when the user should *see* what an agent is doing. `bridge.shell.exec`
and `bridge.fs.*` exist for symmetry with plugins; prefer your own shell and
file tools, which are faster and have no deny-list surprises.

## Working style

1. Resolve identifiers before acting: search → pick → act with the id.
2. Read the JSON result and report the concrete outcome (what opened, what
   was pasted, the new setting value), not just "done".
3. When a method is denied or a permission is missing (`-32005`), say exactly
   which one and what the user can change; do not silently switch tools.
