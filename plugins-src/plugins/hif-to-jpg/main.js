(async function() {
  const SOURCE_TYPES = ["public.heif", "public.heic"];
  const JPEG_QUALITY = 0.95;

  try {
    await coco.log("hif-to-jpg plugin loaded");

    coco.commands.on("convert", async function(args, ctx) {
      try {
        const roots = await collectRoots(args);
        if (roots.length === 0) {
          await coco.toast("No files selected");
          return;
        }

        const files = await collectHIFPaths(roots);
        if (files.length === 0) {
          await coco.toast("No HIF / HEIF photos found");
          return;
        }

        if (files.length > 1) {
          await coco.toast("Converting 0 / " + files.length, { duration: 60 });
        }

        let converted = 0;
        let failed = 0;
        const outputs = [];
        let lastTick = 0;
        for (let i = 0; i < files.length; i++) {
          if (ctx && ctx.signal && ctx.signal.aborted) {
            throw new Error("cancelled");
          }

          const inputPath = files[i];
          const outputPath = await uniqueOutputPath(inputPath);

          try {
            const result = await coco.image.compressJPEG(inputPath, outputPath, JPEG_QUALITY);
            converted++;
            outputs.push(result && result.outputPath ? result.outputPath : outputPath);
          } catch (err) {
            failed++;
            await coco.log("hif-to-jpg failed input=" + inputPath + " error=" + errorMessage(err));
          }

          if (files.length > 1) {
            const done = i + 1;
            const now = Date.now();
            if (done === files.length || now - lastTick > 350) {
              lastTick = now;
              await coco.toast(
                "Converting " + done + " / " + files.length +
                  " (" + converted + " JPG" + (failed ? ", " + failed + " failed" : "") + ")",
                { duration: 60 }
              );
            }
          }
        }

        if (converted === 0) {
          await coco.toast("No photos converted");
          return;
        }

        if (outputs.length === 1) {
          await coco.clipboard.set(outputs[0]);
        } else {
          await coco.clipboard.set(parentDirectory(outputs[0]));
        }

        const summary = converted + " JPG" + (converted === 1 ? "" : "s") + (failed ? ", " + failed + " failed" : "");
        await coco.toast("Converted " + summary + " -> path on clipboard");
      } catch (err) {
        await coco.toast(isAbort(err) ? "Conversion cancelled" : "HIF conversion failed");
        await coco.log("hif-to-jpg command failed: " + errorMessage(err));
      }
    });
  } catch (err) {
    console.error("hif-to-jpg bootstrap error", err);
  }

  async function collectRoots(args) {
    const ctx = args && args.context ? args.context : null;
    const seeded = ctx && Array.isArray(ctx.selectedPaths)
      ? ctx.selectedPaths.filter(Boolean)
      : [];
    if (seeded.length > 0) return seeded;

    const selected = await coco.fs.openPanel({
      title: "Pick HIF / HEIF photos or folders",
      allowMultiple: true,
      allowDirectories: true,
      allowFiles: true,
      allowedTypes: SOURCE_TYPES
    });
    return Array.isArray(selected) ? selected : [];
  }

  async function collectHIFPaths(roots) {
    const seen = new Set();
    const out = [];
    for (const root of roots) {
      let entries = [];
      try {
        entries = await coco.fs.listFiles(root, {
          recursive: true,
          allowedTypes: SOURCE_TYPES
        });
      } catch (err) {
        await coco.log("hif-to-jpg listFiles failed root=" + root + " error=" + errorMessage(err));
      }

      for (const path of entries || []) {
        if (!isHIFPath(path) || seen.has(path)) continue;
        seen.add(path);
        out.push(path);
      }
    }
    return out.sort();
  }

  function isHIFPath(path) {
    const lower = String(path).toLowerCase();
    return lower.endsWith(".hif") || lower.endsWith(".heif") || lower.endsWith(".heic");
  }

  async function uniqueOutputPath(inputPath) {
    const base = withoutExtension(inputPath);
    const primary = base + ".JPG";
    if (!(await pathExists(primary))) return primary;

    const converted = base + "-converted.JPG";
    if (!(await pathExists(converted))) return converted;

    for (let i = 2; i < 1000; i++) {
      const candidate = base + "-converted-" + i + ".JPG";
      if (!(await pathExists(candidate))) return candidate;
    }
    throw new Error("too many existing JPG outputs for " + inputPath);
  }

  async function pathExists(path) {
    try {
      const matches = await coco.fs.listFiles(path, { recursive: false });
      return Array.isArray(matches) && matches.length > 0;
    } catch (_) {
      return false;
    }
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

  function errorMessage(err) {
    return err && err.message ? err.message : String(err);
  }

  function isAbort(err) {
    const msg = errorMessage(err).toLowerCase();
    return msg.includes("abort") || msg.includes("cancel");
  }
})();
