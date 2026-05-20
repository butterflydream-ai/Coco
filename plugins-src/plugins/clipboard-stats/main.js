(async function() {
  try {
    await coco.log("clipboard-stats plugin loaded");

    coco.commands.on("show", async function() {
      try {
        const text = await coco.clipboard.get();
        const stats = computeStats(text || "");
        const html = renderPanel(stats, text || "");
        const result = await coco.window.open({
          title: "Clipboard Stats",
          width: 520,
          height: 360,
          html: html
        });
        await coco.log("clipboard-stats panel id=" + (result && result.id));
      } catch (err) {
        await coco.toast("Failed to open stats panel");
        await coco.log("clipboard-stats failed: " + (err && err.message ? err.message : String(err)));
      }
    });

    function computeStats(text) {
      const charCount = text.length;
      const wordCount = (text.match(/\S+/g) || []).length;
      const lineCount = text.length === 0 ? 0 : text.split(/\r?\n/).length;
      const byteCount = unicodeByteLength(text);
      return { charCount, wordCount, lineCount, byteCount };
    }

    function unicodeByteLength(text) {
      let bytes = 0;
      for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c < 0x80) bytes += 1;
        else if (c < 0x800) bytes += 2;
        else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; }
        else bytes += 3;
      }
      return bytes;
    }

    function escapeHTML(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderPanel(stats, text) {
      const previewSource = text.length > 800 ? text.slice(0, 800) + "…" : text;
      const preview = escapeHTML(previewSource).replace(/\n/g, "<br>");
      return [
        "<!doctype html><html><head><meta charset='utf-8'><style>",
        "html,body{margin:0;height:100%;background:#1c1c1e;color:#f5f5f7;font-family:-apple-system,system-ui,sans-serif;}",
        "main{padding:24px;display:flex;flex-direction:column;gap:18px;height:100%;box-sizing:border-box;}",
        ".grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}",
        ".tile{background:#2c2c2e;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px;}",
        ".tile .v{font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;}",
        ".tile .k{font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#a1a1a6;}",
        ".preview{background:#2c2c2e;border-radius:12px;padding:14px;flex:1;overflow:auto;font-family:ui-monospace,Menlo,monospace;font-size:12px;line-height:1.5;color:#d2d2d7;white-space:pre-wrap;word-break:break-word;}",
        ".empty{color:#6b6b70;font-style:italic;}",
        "</style></head><body><main>",
        "<div class='grid'>",
        "<div class='tile'><div class='v'>", stats.charCount, "</div><div class='k'>chars</div></div>",
        "<div class='tile'><div class='v'>", stats.wordCount, "</div><div class='k'>words</div></div>",
        "<div class='tile'><div class='v'>", stats.lineCount, "</div><div class='k'>lines</div></div>",
        "<div class='tile'><div class='v'>", stats.byteCount, "</div><div class='k'>bytes utf8</div></div>",
        "</div>",
        "<div class='preview'>", preview.length === 0 ? "<span class='empty'>(clipboard is empty)</span>" : preview, "</div>",
        "</main></body></html>"
      ].join("");
    }
  } catch (err) {
    console.error("clipboard-stats bootstrap error", err);
  }
})();
