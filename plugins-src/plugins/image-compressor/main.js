(async function() {
  // Truly lossless image compression. Shells out to a tiny Node script that
  // wraps imagemin + imagemin-jpegtran (lossless JPEG) + imagemin-optipng
  // (lossless PNG). The Node toolchain lives outside the plugin dir at
  //
  //   ~/Library/Application Support/Coco/lossless-tools/
  //
  // because the plugin loader wipes the plugin dir on every version bump and
  // we don't want to re-`npm install` (~50MB) every time we ship a fix.
  // Assumes the user already has Node + npm — this is documented in
  // AGENTS.md as a single-user-app assumption.

  // Inline the worker script so we don't have to resolve the plugin's own
  // path from JS. The plugin first writes these two files into TOOLS_DIR,
  // runs `npm install` once, and from then on just `node compress.mjs in out`.
  const PACKAGE_JSON = JSON.stringify({
    name: "coco-image-compress-lossless",
    version: "1.0.0",
    private: true,
    type: "module",
    dependencies: {
      "imagemin": "^9.0.1",
      "imagemin-jpegtran": "^8.0.0",
      "imagemin-optipng": "^8.0.0"
    }
  }, null, 2) + "\n";

  const COMPRESS_MJS = [
    "import { readFile, writeFile, mkdir } from 'node:fs/promises';",
    "import { dirname, extname } from 'node:path';",
    "import imagemin from 'imagemin';",
    "import imageminJpegtran from 'imagemin-jpegtran';",
    "import imageminOptipng from 'imagemin-optipng';",
    "",
    "const [, , inputPath, outputPath] = process.argv;",
    "if (!inputPath || !outputPath) {",
    "  console.error('usage: node compress.mjs <input> <output>');",
    "  process.exit(2);",
    "}",
    "",
    "const ext = extname(inputPath).toLowerCase();",
    "let plugin;",
    "if (ext === '.jpg' || ext === '.jpeg') plugin = imageminJpegtran();",
    "else if (ext === '.png') plugin = imageminOptipng();",
    "else { console.error(`unsupported format: ${ext}`); process.exit(3); }",
    "",
    "const buf = await readFile(inputPath);",
    "const out = await imagemin.buffer(buf, { plugins: [plugin] });",
    "await mkdir(dirname(outputPath), { recursive: true });",
    "await writeFile(outputPath, out);",
    "console.log(JSON.stringify({ inputBytes: buf.length, outputBytes: out.length }));"
  ].join("\n") + "\n";

  try {
    await coco.log("image-compressor plugin loaded");

    coco.commands.on("compress", async function(args) {
      try {
        const plan = await collectInputs(args);
        if (plan.files.length === 0) {
          await coco.toast(plan.outputDir ? "Nothing new to compress" : "No images selected");
          return;
        }

        // First-time setup. Show a toast so the user knows we're not stuck —
        // npm install can take 10-30s.
        const toolsReady = await ensureToolsInstalled();
        if (!toolsReady.ok) {
          await coco.toast("Tool install failed — check log");
          await coco.log("ensureToolsInstalled failed: " + toolsReady.error);
          return;
        }

        const total = plan.files.length;
        if (total > 1) {
          await coco.toast("Compressing 0 / " + total, { duration: 60 });
        }

        let okCount = 0;
        let lastOutputPath = null;
        let lastTick = 0;
        let totalSavedBytes = 0;
        for (let i = 0; i < total; i++) {
          const inputPath = plan.files[i];
          const outputPath = outputPathFor(inputPath, plan.outputDir);
          try {
            const result = await runCompress(toolsReady.toolsDir, inputPath, outputPath);
            okCount++;
            lastOutputPath = outputPath;
            if (result && result.inputBytes && result.outputBytes) {
              totalSavedBytes += (result.inputBytes - result.outputBytes);
            }
          } catch (err) {
            await coco.log("compress failed path=" + inputPath + " err=" + (err && err.message ? err.message : String(err)));
          }

          if (total > 1) {
            const done = i + 1;
            const now = Date.now();
            if (done === total || now - lastTick > 200) {
              lastTick = now;
              await coco.toast("Compressing " + done + " / " + total, { duration: 60 });
            }
          }
        }

        if (okCount === 0) {
          await coco.toast("Failed to compress any image");
        } else if (okCount === 1 && lastOutputPath) {
          await coco.clipboard.set(lastOutputPath);
          await coco.toast("Compressed → path on clipboard");
        } else {
          await coco.clipboard.set(plan.outputDir);
          await coco.toast("Compressed " + okCount + " / " + total + " · saved " + formatBytes(totalSavedBytes) + " → folder on clipboard");
        }
      } catch (err) {
        await coco.toast("Compress cancelled");
        await coco.log("compress dispatch failed: " + (err && err.message ? err.message : String(err)));
      }
    });

    function formatBytes(n) {
      if (!n || n <= 0) return "0 B";
      if (n < 1024) return n + " B";
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
      return (n / (1024 * 1024)).toFixed(2) + " MB";
    }

    async function ensureToolsInstalled() {
      // Resolve $HOME via the shell — the plugin runs in a WKWebView so it
      // has no FS context of its own.
      const homeRes = await coco.shell.exec("printf %s \"$HOME\"");
      if (homeRes.exitCode !== 0 || !homeRes.stdout) {
        return { ok: false, error: "could not resolve $HOME: " + homeRes.stderr };
      }
      const home = homeRes.stdout.trim();
      const toolsDir = home + "/Library/Application Support/Coco/lossless-tools";
      const compressMjs = toolsDir + "/compress.mjs";
      const packageJson = toolsDir + "/package.json";
      const sentinel = toolsDir + "/node_modules/imagemin/package.json";

      // Already set up? Cheap exists-check via shell.
      const existsRes = await coco.shell.exec("test -f \"" + sentinel + "\" && echo ok || echo no");
      if (existsRes.stdout && existsRes.stdout.trim() === "ok") {
        return { ok: true, toolsDir: toolsDir };
      }

      await coco.toast("Installing image tools (first run, ~30s)…", { duration: 60 });

      const mkdirRes = await coco.shell.exec("mkdir -p \"" + toolsDir + "\"");
      if (mkdirRes.exitCode !== 0) {
        return { ok: false, error: "mkdir failed: " + mkdirRes.stderr };
      }

      // coco.fs only exposes binary write today, so route the script + manifest
      // through the shell with base64 to dodge any quoting issues.
      const writePkg = await writeViaShell(packageJson, PACKAGE_JSON);
      if (!writePkg.ok) return { ok: false, error: "write package.json failed: " + writePkg.error };
      const writeMjs = await writeViaShell(compressMjs, COMPRESS_MJS);
      if (!writeMjs.ok) return { ok: false, error: "write compress.mjs failed: " + writeMjs.error };

      const installRes = await coco.shell.exec(
        "cd \"" + toolsDir + "\" && npm install --no-audit --no-fund --loglevel=error 2>&1"
      );
      if (installRes.exitCode !== 0) {
        return { ok: false, error: "npm install failed (exit " + installRes.exitCode + "): " + (installRes.stderr || installRes.stdout) };
      }

      return { ok: true, toolsDir: toolsDir };
    }

    async function writeViaShell(targetPath, content) {
      // Encode as base64 then decode via shell — avoids any quoting issue
      // with the content (newlines, quotes, dollar signs, etc.).
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const cmd = "printf %s '" + b64 + "' | base64 -D > \"" + targetPath + "\"";
      const res = await coco.shell.exec(cmd);
      if (res.exitCode !== 0) {
        return { ok: false, error: res.stderr || ("exit " + res.exitCode) };
      }
      return { ok: true };
    }

    async function runCompress(toolsDir, inputPath, outputPath) {
      const cmd = "cd \"" + toolsDir + "\" && node compress.mjs "
        + shellQuote(inputPath) + " " + shellQuote(outputPath);
      const res = await coco.shell.exec(cmd);
      if (res.exitCode !== 0) {
        throw new Error(res.stderr || res.stdout || ("exit " + res.exitCode));
      }
      try {
        return JSON.parse(res.stdout.trim());
      } catch (_) {
        return null;
      }
    }

    function shellQuote(s) {
      return "'" + String(s).replace(/'/g, "'\\''") + "'";
    }

    // Resolve inputs in priority order:
    //   1. Finder selection passed in via args.context.selectedPaths
    //   2. Otherwise prompt with an open panel that allows files + folders
    // Folders are recursively expanded into image files. Outputs go to a
    // shared `compressed/` directory under the deepest common ancestor.
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
          entries = await coco.fs.listFiles(root, {
            recursive: true,
            allowedTypes: ["public.image"]
          });
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
      const filtered = expanded.filter(function(p) {
        return !p.startsWith(outputDir + "/");
      });
      return { files: filtered, outputDir: outputDir };
    }

    function isSupportedFormat(path) {
      const lower = path.toLowerCase();
      return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
    }

    function computeOutputDir(filePaths) {
      const dirs = filePaths.map(parentDirectory);
      const common = commonPrefixSegments(dirs.map(function(d) { return d.split("/"); }));
      const base = common.length === 0 ? "" : common.join("/");
      return base + "/compressed";
    }

    function parentDirectory(path) {
      const i = path.lastIndexOf("/");
      if (i < 0) return "";
      if (i === 0) return "/";
      return path.slice(0, i);
    }

    function commonPrefixSegments(splits) {
      if (splits.length === 0) return [];
      const minLen = Math.min.apply(null, splits.map(function(s) { return s.length; }));
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
      // Lossless preserves the original filename AND extension.
      const slash = inputPath.lastIndexOf("/");
      const filename = slash < 0 ? inputPath : inputPath.slice(slash + 1);
      return outputDir + "/" + filename;
    }
  } catch (err) {
    console.error("image-compressor bootstrap error", err);
  }
})();
