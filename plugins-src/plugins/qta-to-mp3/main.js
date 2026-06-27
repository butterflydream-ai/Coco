(async function() {
  // Install dir name is fixed by the monorepo folder name ("qta-to-mp3"), which
  // the Store uses verbatim as the install_dir_name. So the bundled encoder
  // always lives here — no coco.* path API needed.
  const LAME = "$HOME/Library/Application Support/Coco/plugins/qta-to-mp3/bin/lame";
  // VBR quality for LAME: -V2 ~= 190 kbps, near-transparent. Matches the source
  // AAC's ~200 kbps without bloating the file.
  const VBR_QUALITY = "2";
  // Conservative upper bound on the intermediate WAV: 48 kHz * 16-bit * stereo.
  // Mono / lower-rate recordings need less, so this never under-reserves.
  const WAV_BYTES_PER_SEC = 192000;

  try {
    await coco.log("qta-to-mp3 plugin loaded");

    coco.commands.on("convert", async function(args, ctx) {
      let progress = null;
      try {
        const files = await collectInputs(args);
        if (files.length === 0) {
          await coco.toast("No recordings selected");
          return;
        }

        progress = await coco.progress.start({
          taskID: ctx && ctx.taskID,
          title: files.length === 1 ? "Converting to MP3…" : "Converting " + files.length + " files…"
        });

        let converted = 0;
        let failed = 0;
        const outputs = [];

        for (let i = 0; i < files.length; i++) {
          throwIfCancelled(ctx);
          const inputPath = files[i];
          const name = filename(inputPath);
          await progress.update({
            message: (files.length > 1 ? "(" + (i + 1) + "/" + files.length + ") " : "") + name
          });

          try {
            const outputPath = await convertOne(inputPath, ctx);
            converted++;
            outputs.push(outputPath);
          } catch (err) {
            if (isAbort(err)) throw err;
            failed++;
            await coco.log("qta-to-mp3 failed input=" + inputPath + " error=" + errorMessage(err));
          }
        }

        if (converted === 0) {
          await progress.fail({ message: "No files converted" });
          await coco.toast("Conversion failed — see Coco log for details");
          return;
        }

        // Drop the result path on the clipboard, mirroring the other Coco
        // media plugins so the user can paste it straight into Finder/Terminal.
        if (outputs.length === 1) {
          await coco.clipboard.set(outputs[0]);
        } else {
          await coco.clipboard.set(parentDirectory(outputs[0]));
        }

        const summary = converted + " MP3" + (converted === 1 ? "" : "s") +
          (failed ? ", " + failed + " failed" : "");
        await progress.finish({ message: summary + " — path copied" });
        await coco.toast("Converted " + summary + " -> path on clipboard");
      } catch (err) {
        if (progress) {
          try { await progress.fail({ message: isAbort(err) ? "Cancelled" : "Conversion failed" }); }
          catch (_) {}
        }
        await coco.toast(isAbort(err) ? "Conversion cancelled" : "QTA conversion failed");
        await coco.log("qta-to-mp3 command failed: " + errorMessage(err));
      }
    });
  } catch (err) {
    console.error("qta-to-mp3 bootstrap error", err);
  }

  // Decode <input> with the system afconvert into a temp WAV on the same volume
  // as the output, then encode that WAV to MP3 with the bundled LAME. The temp
  // WAV is always removed, even on failure or cancel (shell `trap`).
  async function convertOne(inputPath, ctx) {
    const outputPath = await uniqueOutputPath(inputPath);
    const dir = parentDirectory(outputPath);
    const tempWav = dir + "/.coco-qta-" + Date.now() + "-" + Math.floor(Math.random() * 1e6) + ".wav";

    await ensureDiskSpace(inputPath, dir, ctx);
    throwIfCancelled(ctx);

    const script = [
      'LAME="' + LAME + '"',
      'IN=' + shq(inputPath),
      'OUT=' + shq(outputPath),
      'TMP=' + shq(tempWav),
      "trap 'rm -f \"$TMP\"' EXIT",
      // Defensive: the Store install already keeps the +x bit and the binary is
      // ad-hoc signed, but a fresh download can carry a quarantine xattr.
      'chmod +x "$LAME" 2>/dev/null',
      'xattr -d com.apple.quarantine "$LAME" 2>/dev/null',
      '[ -x "$LAME" ] || { echo "bundled lame missing or not executable: $LAME" >&2; exit 10; }',
      'afconvert -f WAVE -d LEI16 "$IN" "$TMP" || { echo "afconvert (decode) failed" >&2; exit 11; }',
      '"$LAME" -V ' + VBR_QUALITY + ' --quiet "$TMP" "$OUT" || { echo "lame (encode) failed" >&2; exit 12; }'
    ].join("\n");

    const result = await coco.shell.exec(script, {
      signal: ctx && ctx.signal,
      taskID: ctx && ctx.taskID
    });
    if (!result || result.exitCode !== 0) {
      throwIfCancelled(ctx);
      const detail = (result && (result.stderr || result.stdout) || "").trim();
      throw new Error(detail || ("exit " + (result ? result.exitCode : "?")));
    }
    return outputPath;
  }

  // Refuse the job up front if the volume can't hold the intermediate WAV,
  // rather than failing mid-decode with a cryptic afconvert error.
  async function ensureDiskSpace(inputPath, dir, ctx) {
    const probe = await coco.shell.exec(
      'afinfo ' + shq(inputPath) + ' 2>/dev/null; echo "---"; df -k -P ' + shq(dir) + ' 2>/dev/null',
      { signal: ctx && ctx.signal, taskID: ctx && ctx.taskID }
    );
    const out = (probe && probe.stdout) || "";
    const durMatch = out.match(/estimated duration:\s*([0-9.]+)/i);
    const dfLine = (out.split("---")[1] || "").trim().split("\n").pop() || "";
    const cols = dfLine.split(/\s+/);
    // df -P columns: Filesystem 1024-blocks Used Available Capacity Mounted-on
    const availKB = cols.length >= 4 ? parseInt(cols[3], 10) : NaN;
    if (!durMatch || !isFinite(availKB)) return; // can't estimate -> let it try
    const neededKB = Math.ceil((parseFloat(durMatch[1]) * WAV_BYTES_PER_SEC) / 1024 * 1.1);
    if (availKB < neededKB) {
      throw new Error(
        "Not enough disk space: need ~" + humanMB(neededKB) +
        " for decoding, only " + humanMB(availKB) + " free"
      );
    }
  }

  async function collectInputs(args) {
    // Prefer a Finder selection if Coco seeded one with the command.
    const ctx = args && args.context ? args.context : null;
    const seeded = ctx && Array.isArray(ctx.selectedPaths)
      ? ctx.selectedPaths.filter(Boolean)
      : [];
    if (seeded.length > 0) return seeded.filter(looksConvertible);

    // .qta has no registered UTType, so we can't filter the open panel by type;
    // accept any file and let afconvert reject anything it can't decode.
    const selected = await coco.fs.openPanel({
      title: "Pick QTA / audio recordings",
      allowMultiple: true,
      allowDirectories: false,
      allowFiles: true
    });
    return Array.isArray(selected) ? selected : [];
  }

  function looksConvertible(path) {
    const lower = String(path).toLowerCase();
    return !lower.endsWith(".mp3"); // skip files that are already MP3
  }

  async function uniqueOutputPath(inputPath) {
    const base = withoutExtension(inputPath);
    const primary = base + ".mp3";
    if (!(await pathExists(primary))) return primary;
    for (let i = 1; i < 1000; i++) {
      const candidate = base + "-" + i + ".mp3";
      if (!(await pathExists(candidate))) return candidate;
    }
    throw new Error("too many existing MP3 outputs for " + inputPath);
  }

  async function pathExists(path) {
    try {
      const matches = await coco.fs.listFiles(path, { recursive: false });
      return Array.isArray(matches) && matches.length > 0;
    } catch (_) {
      return false;
    }
  }

  // Single-quote a string for POSIX sh: close, escape the quote, reopen.
  function shq(s) {
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
  }

  function withoutExtension(path) {
    const slash = path.lastIndexOf("/");
    const dot = path.lastIndexOf(".");
    if (dot > slash) return path.slice(0, dot);
    return path;
  }

  function parentDirectory(path) {
    const slash = path.lastIndexOf("/");
    if (slash <= 0) return "/";
    return path.slice(0, slash);
  }

  function filename(path) {
    const slash = path.lastIndexOf("/");
    return slash >= 0 ? path.slice(slash + 1) : path;
  }

  function humanMB(kb) {
    return (kb / 1024).toFixed(0) + " MB";
  }

  function errorMessage(err) {
    return err && err.message ? err.message : String(err);
  }

  function isAbort(err) {
    const msg = errorMessage(err).toLowerCase();
    return msg.includes("abort") || msg.includes("cancel");
  }

  function throwIfCancelled(ctx) {
    if (ctx && ctx.signal && ctx.signal.aborted) {
      throw new Error("cancelled");
    }
  }
})();
