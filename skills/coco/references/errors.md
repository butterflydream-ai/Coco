# Coco CLI errors and how to recover

`coco` exits 0 on success, 2 on a usage error you can fix in the command line
(unknown method, unknown flag, value of the wrong type), and 1 when Coco
itself returned a JSON-RPC error. With `--json` the error object is printed
so you can branch on `code`.

| Code | Meaning | What to do |
|---|---|---|
| -32601 | Method not found | Check the exact `area.method` in `coco capabilities --json`; names are case-sensitive. |
| -32602 | Invalid params | Run `coco help <area>`; a required param is missing or has the wrong type. Object values must be JSON strings. |
| -32600 | Message too large | A single request exceeded 4 MiB; split the payload (e.g. write large files with your own tools). |
| -32001 | Unauthorized client | The caller is not a Coco-signed process. Only happens if something other than the real `coco` binary talks to the socket. |
| -32003 | Access denied | The user turned Agent Access off, blocked this method in Settings → Agent Access, or the path is on the secrets deny-list (AI keys, ASR keys, license cache, Keychains, ssh). Tell the user which method or path; do not work around it. |
| -32004 | Not found | The id or path you passed does not exist (stale clipboard id, unknown plugin, missing transcript). Re-list and retry with a fresh id. |
| -32005 | Permission required | macOS has not granted Coco a TCC permission this method needs (Accessibility for paste, Screen Recording for screenshots). Ask the user to grant it in System Settings → Privacy & Security, then retry. |

## Connection problems

- `Coco is not running` — start it with `open -a Coco`, wait about two
  seconds, retry. If the message mentions a stale socket, the app exited
  uncleanly; launching it recreates the socket.
- `Coco did not accept the connection (busy)` — transient under heavy
  parallel load; retry once after a short pause.
- `coco: command not found` — use the full path
  `/Applications/Coco.app/Contents/Helpers/coco`, then run
  `coco cli install` once so future shells find it in `~/.coco/bin`.
