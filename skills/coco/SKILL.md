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

If `coco` is not on PATH, use `/Applications/Coco.app/Contents/Helpers/coco`.
If `status` says Coco is not running, `open -a Coco`, wait two seconds, retry.
Do not fall back to AppleScript for something Coco does — fix the connection.

The full catalogue (71 methods, params, tiers) is in
[references/methods.md](references/methods.md). Read it when you need a
method outside the recipes below; do not guess parameter names, they are
case-sensitive (`bundleID`, `outputPath`, `pluginID`).

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
removes plugins. All three run without prompting; the tags exist so you can
tell the user what you are about to do before doing something irreversible
such as `apps.forceQuit`, `clipboard.delete`, or `store.uninstall`.

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
