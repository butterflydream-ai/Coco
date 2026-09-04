#!/usr/bin/env python3
"""Regenerate references/methods.md from the running Coco's live catalogue.

Run this whenever a Coco release adds or changes agent methods, so the skill
never describes parameters the app does not have:

    python3 skills/coco/scripts/generate-methods.py

It shells out to `coco capabilities --json` (falling back to the bundle path)
and writes a per-area table with tier, params (required ones starred), and
the registry description. The registry inside Coco is the single source of
truth; this file is a snapshot of it.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from collections import defaultdict

CANDIDATES = [shutil.which("coco"), "/Applications/Coco.app/Contents/Helpers/coco"]
OUT = os.path.join(os.path.dirname(__file__), "..", "references", "methods.md")


def catalogue() -> list[dict]:
    for exe in CANDIDATES:
        if exe and os.path.exists(exe):
            return json.loads(subprocess.check_output([exe, "capabilities", "--json"]))
    sys.exit("coco CLI not found; install Coco or put `coco` on PATH")


def params(m: dict) -> str:
    p = m.get("params") or {}
    props = p.get("properties", {}) if isinstance(p, dict) else {}
    req = set(p.get("required", []) or []) if isinstance(p, dict) else set()
    parts = []
    for name, spec in props.items():
        typ = spec.get("type", "") if isinstance(spec, dict) else ""
        star = "**" if name in req else ""
        parts.append(f"{star}`{name}`{star} ({typ})" if typ else f"{star}`{name}`{star}")
    return ", ".join(parts) or "—"


def main() -> None:
    ms = catalogue()
    by_area: dict[str, list[dict]] = defaultdict(list)
    for m in ms:
        by_area[m["area"]].append(m)
    lines = [
        "# Coco agent methods",
        "",
        f"Generated from `coco capabilities --json` ({len(ms)} methods). Bold params are required.",
        "Tiers: `read` changes nothing, `act` touches the Mac, `admin` installs/removes plugins.",
        "Call any method as `coco <area> <method> --param value` or `coco call area.method …`; add `--json`.",
        "",
        "## Contents",
        "",
    ]
    for area in sorted(by_area):
        lines.append(f"- [{area}](#{area}) ({len(by_area[area])})")
    for area in sorted(by_area):
        lines += ["", f"## {area}", "", "| Method | Tier | Params | Description |", "|---|---|---|---|"]
        for m in sorted(by_area[area], key=lambda m: m["method"]):
            desc = (m.get("description") or "").replace("|", "\\|").replace("\n", " ")
            hints = m.get("annotations") or {}
            flag = " ⚠️" if hints.get("destructiveHint") else ""
            lines.append(f"| `{area}.{m['method']}`{flag} | {m['tier']} | {params(m)} | {desc} |")
    lines += ["", "⚠️ marks methods Coco flags as destructive (quit, delete, uninstall, shell/file writes)."]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"wrote {os.path.relpath(OUT)} with {len(ms)} methods across {len(by_area)} areas")


if __name__ == "__main__":
    main()
