(async function() {
  // Image compression via a tiny Node worker that wraps `sharp`.
  //
  // sharp ships prebuilt Apple-Silicon (arm64) binaries, unlike the abandoned
  // imagemin *-bin packages (jpegtran-bin / optipng-bin), which are x86_64-only
  // and fail with `EBADARCH` (-86) on Apple Silicon without Rosetta. PNG stays
  // truly lossless (no palette quantization); JPEG is re-encoded with mozjpeg at
  // high quality (near-lossless) — there is no maintained arm64-native
  // lossless-JPEG package.
  //
  // The Node toolchain lives outside the plugin dir at
  //   ~/Library/Application Support/Coco/lossless-tools/
  // because the plugin loader wipes the plugin dir on every version bump and we
  // don't want to re-`npm install` (~30MB) every time we ship a fix. Assumes the
  // user already has Node + npm — documented in AGENTS.md as a single-user-app
  // assumption.
  const PACKAGE_JSON = JSON.stringify({
    name: "coco-image-compress",
    version: "2.0.0",
    private: true,
    type: "module",
    dependencies: {
      "sharp": "^0.35.1"
    }
  }, null, 2) + "\n";

  const COMPRESS_MJS = [
    "import { stat, mkdir } from 'node:fs/promises';",
    "import { extname, dirname } from 'node:path';",
    "import sharp from 'sharp';",
    "",
    "const [, , inputPath, outputPath, levelArg, stripArg] = process.argv;",
    "if (!inputPath || !outputPath) {",
    "  console.error('usage: node compress.mjs <input> <output> [level] [strip]');",
    "  process.exit(2);",
    "}",
    "const level = Number(levelArg || '2');",
    "const strip = (stripArg || 'true') === 'true';",
    "",
    "const ext = extname(inputPath).toLowerCase();",
    "let pipeline = sharp(inputPath, { failOn: 'none' }).rotate();", // bake in EXIF orientation
    "if (!strip) pipeline = pipeline.withMetadata();",
    "if (ext === '.jpg' || ext === '.jpeg') {",
    "  const quality = level >= 3 ? 72 : (level <= 1 ? 85 : 80);",
    "  pipeline = pipeline.jpeg({ quality, mozjpeg: true });",
    "} else if (ext === '.png') {",
    "  const effort = level >= 3 ? 10 : (level <= 1 ? 4 : 7);",
    "  pipeline = pipeline.png({ compressionLevel: 9, effort, palette: false });",
    "} else { console.error(`unsupported format: ${ext}`); process.exit(3); }",
    "",
    "await mkdir(dirname(outputPath), { recursive: true });",
    "await pipeline.toFile(outputPath);",
    "const inputBytes = (await stat(inputPath)).size;",
    "const outputBytes = (await stat(outputPath)).size;",
    "console.log(JSON.stringify({ inputBytes, outputBytes }));"
  ].join("\n") + "\n";

  await coco.log("image-compressor v1.1.1 loaded");

  coco.commands.on("compress", async function(args, ctx) {
    const signal = ctx && ctx.signal;
    const taskID = ctx && ctx.taskID;
    try {
      const plan = await collectInputs(args);
      if (plan.files.length === 0) {
        await coco.toast(plan.outputDir ? "Nothing new to compress" : "No images selected");
        return;
      }

      const prefs = await coco.preferences.all();
      const level = prefs.optimizationLevel || "2";
      const strip = prefs.stripMetadata !== false;

      const toolsReady = await ensureToolsInstalled(signal);
      if (!toolsReady.ok) {
        await coco.toast("Tool install failed: " + (toolsReady.error || "").slice(0, 80));
        return;
      }

      const task = await coco.progress.start({
        taskID: taskID,
        title: "Compressing images",
        total: plan.files.length
      });

      let okCount = 0;
      let lastOutputPath = null;
      let totalSavedBytes = 0;
      for (let i = 0; i < plan.files.length; i++) {
        if (signal && signal.aborted) {
          await task.fail({ message: "Cancelled at " + i + " / " + plan.files.length });
          return;
        }
        const inputPath = plan.files[i];
        const outputPath = outputPathFor(inputPath, plan.outputDir);
        await task.update({
          value: i,
          message: filenameOnly(inputPath)
        });
        try {
          const result = await runCompress(toolsReady.toolsDir, inputPath, outputPath, level, strip, ctx);
          okCount++;
          lastOutputPath = outputPath;
          if (result && result.inputBytes && result.outputBytes) {
            totalSavedBytes += (result.inputBytes - result.outputBytes);
          }
        } catch (err) {
          if (signal && signal.aborted) {
            await task.fail({ message: "Cancelled at " + i + " / " + plan.files.length });
            return;
          }
          await coco.log("compress failed path=" + inputPath + " err=" + (err && err.message ? err.message : String(err)));
        }
      }

      if (okCount === 0) {
        await task.fail({ message: "Failed to compress any image" });
      } else {
        await task.update({ value: plan.files.length });
        const msg = okCount === plan.files.length
          ? "Compressed " + okCount + " · saved " + formatBytes(totalSavedBytes)
          : "Compressed " + okCount + " / " + plan.files.length + " · saved " + formatBytes(totalSavedBytes);
        await task.finish({ message: msg });
        if (okCount === 1 && lastOutputPath) {
          await coco.clipboard.set(lastOutputPath);
        } else {
          await coco.clipboard.set(plan.outputDir);
        }
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      await coco.log("compress dispatch failed: " + msg + " stack=" + (err && err.stack ? err.stack : "(none)"));
    }
  });

  function formatBytes(n) {
    if (!n || n <= 0) return "0 B";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function filenameOnly(p) {
    const i = p.lastIndexOf("/");
    return i < 0 ? p : p.slice(i + 1);
  }

  async function ensureToolsInstalled(signal) {
    const homeRes = await coco.shell.exec('printf %s "$HOME"', { signal: signal });
    if (homeRes.exitCode !== 0 || !homeRes.stdout) {
      return { ok: false, error: "could not resolve $HOME: " + homeRes.stderr };
    }
    const home = homeRes.stdout.trim();
    const toolsDir = home + "/Library/Application Support/Coco/lossless-tools";
    const compressMjs = toolsDir + "/compress.mjs";
    const packageJson = toolsDir + "/package.json";
    const sentinel = toolsDir + "/node_modules/sharp/package.json";

    const existsRes = await coco.shell.exec("test -f \"" + sentinel + "\" && echo ok || echo no", { signal: signal });
    if (existsRes.stdout && existsRes.stdout.trim() === "ok") {
      // Always refresh the script so option-forwarding stays in sync with main.js.
      const refresh = await writeViaShell(compressMjs, COMPRESS_MJS, signal);
      if (!refresh.ok) return { ok: false, error: "refresh compress.mjs failed: " + refresh.error };
      return { ok: true, toolsDir: toolsDir };
    }

    const mkdirRes = await coco.shell.exec("mkdir -p \"" + toolsDir + "\"", { signal: signal });
    if (mkdirRes.exitCode !== 0) return { ok: false, error: "mkdir failed: " + mkdirRes.stderr };
    const writePkg = await writeViaShell(packageJson, PACKAGE_JSON, signal);
    if (!writePkg.ok) return { ok: false, error: "write package.json failed: " + writePkg.error };
    const writeMjs = await writeViaShell(compressMjs, COMPRESS_MJS, signal);
    if (!writeMjs.ok) return { ok: false, error: "write compress.mjs failed: " + writeMjs.error };

    const installRes = await coco.shell.exec(
      "cd \"" + toolsDir + "\" && npm install --no-audit --no-fund --loglevel=error 2>&1",
      { signal: signal }
    );
    if (installRes.exitCode !== 0) {
      return { ok: false, error: "npm install failed (exit " + installRes.exitCode + "): " + (installRes.stderr || installRes.stdout) };
    }
    return { ok: true, toolsDir: toolsDir };
  }

  async function writeViaShell(targetPath, content, signal) {
    const b64 = btoa(unescape(encodeURIComponent(content)));
    const cmd = "printf %s '" + b64 + "' | base64 -D > \"" + targetPath + "\"";
    const res = await coco.shell.exec(cmd, { signal: signal });
    if (res.exitCode !== 0) return { ok: false, error: res.stderr || ("exit " + res.exitCode) };
    return { ok: true };
  }

  async function runCompress(toolsDir, inputPath, outputPath, level, strip, ctx) {
    const stripArg = strip ? "true" : "false";
    const cmd = "cd \"" + toolsDir + "\" && node compress.mjs "
      + shellQuote(inputPath) + " " + shellQuote(outputPath) + " " + level + " " + stripArg;
    const res = await coco.shell.exec(cmd, { signal: ctx && ctx.signal, taskID: ctx && ctx.taskID });
    if (res.exitCode !== 0) {
      throw new Error(res.stderr || res.stdout || ("exit " + res.exitCode));
    }
    try { return JSON.parse(res.stdout.trim()); } catch (_) { return null; }
  }

  function shellQuote(s) {
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
  }

  async function collectInputs(args) {
    const ctx = args && args.context ? args.context : null;
    const seeded = ctx && Array.isArray(ctx.selectedPaths) ? ctx.selectedPaths.filter(Boolean) : [];
    let roots;
    if (seeded.length > 0) {
      roots = seeded;
    } else {
      roots = await coco.fs.openPanel({
        title: "Pick images or folders to compress",
        allowMultiple: true,
        allowDirectories: true,
        allowFiles: true,
        allowedTypes: ["public.image"]
      });
    }
    if (!roots || roots.length === 0) return { files: [], outputDir: null };

    const expanded = [];
    const seen = new Set();
    for (const root of roots) {
      let entries;
      try {
        entries = await coco.fs.listFiles(root, { recursive: true, allowedTypes: ["public.image"] });
      } catch (err) {
        await coco.log("listFiles failed path=" + root + " err=" + (err && err.message ? err.message : String(err)));
        continue;
      }
      if (!entries) continue;
      for (const file of entries) {
        if (!isSupportedFormat(file)) continue;
        if (seen.has(file)) continue;
        seen.add(file);
        expanded.push(file);
      }
    }
    if (expanded.length === 0) return { files: [], outputDir: null };

    const outputDir = computeOutputDir(expanded);
    const filtered = expanded.filter(p => !p.startsWith(outputDir + "/"));
    return { files: filtered, outputDir: outputDir };
  }

  function isSupportedFormat(path) {
    const lower = path.toLowerCase();
    return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
  }
  function computeOutputDir(paths) {
    const dirs = paths.map(parentDirectory);
    const common = commonPrefixSegments(dirs.map(d => d.split("/")));
    const base = common.length === 0 ? "" : common.join("/");
    return base + "/compressed";
  }
  function parentDirectory(p) {
    const i = p.lastIndexOf("/");
    if (i < 0) return "";
    if (i === 0) return "/";
    return p.slice(0, i);
  }
  function commonPrefixSegments(splits) {
    if (splits.length === 0) return [];
    const minLen = Math.min.apply(null, splits.map(s => s.length));
    const out = [];
    for (let i = 0; i < minLen; i++) {
      const seg = splits[0][i];
      let allMatch = true;
      for (let j = 1; j < splits.length; j++) {
        if (splits[j][i] !== seg) { allMatch = false; break; }
      }
      if (!allMatch) break;
      out.push(seg);
    }
    return out;
  }
  function outputPathFor(inputPath, outputDir) {
    const slash = inputPath.lastIndexOf("/");
    const filename = slash < 0 ? inputPath : inputPath.slice(slash + 1);
    return outputDir + "/" + filename;
  }
})();
