(async function () {
  // Cursor Demo — a presentation overlay that highlights the pointer with a
  // glowing ring, a fading motion trail, and click ripples.
  //
  // The overlay is opened through coco.window.open with a set of overlay hints
  // (transparent / borderless / full-screen / click-through / top-most). Coco's
  // window host honors the ones it understands and ignores the rest, so the
  // same plugin degrades gracefully: with a true click-through overlay you can
  // keep using your apps while the trail follows the system cursor; without it
  // the window still opens and tracks the pointer while it has focus.
  //
  // To draw the trail the overlay needs the live cursor position. It listens,
  // in order of preference, for a native cursor feed (so it works even when the
  // window is click-through and never receives DOM events) and falls back to
  // ordinary DOM mouse events when the overlay itself is interactive.

  try {
    await coco.log("cursor-demo plugin loaded");

    // Remember the open overlay so "stop" can close it (and "start" won't stack
    // duplicates). Kept on a module-scoped variable that survives between
    // command invocations within a plugin session.
    let overlay = null;

    coco.commands.on("start", async function () {
      try {
        if (overlay) {
          await coco.toast("Cursor Demo is already running");
          return;
        }
        const config = await readConfig();
        const result = await coco.window.open(buildWindowOptions(renderOverlay(config)));
        overlay = result || { id: null };
        await coco.toast("Cursor Demo on — press Esc to stop");
        await coco.log("cursor-demo overlay opened id=" + (overlay && overlay.id));
      } catch (err) {
        overlay = null;
        await coco.toast("Couldn't start Cursor Demo");
        await coco.log("cursor-demo start failed: " + errorMessage(err));
      }
    });

    coco.commands.on("stop", async function () {
      try {
        const closed = await closeOverlay(overlay);
        overlay = null;
        await coco.toast(closed ? "Cursor Demo off" : "No Cursor Demo overlay to close");
      } catch (err) {
        overlay = null;
        await coco.toast("Cursor Demo stopped");
        await coco.log("cursor-demo stop failed: " + errorMessage(err));
      }
    });

    async function readConfig() {
      let prefs = {};
      try {
        prefs = (coco.preferences && (await coco.preferences.all())) || {};
      } catch (err) {
        await coco.log("cursor-demo prefs unavailable: " + errorMessage(err));
      }
      const palette = {
        amber: "255,176,32",
        red: "255,69,58",
        green: "48,209,88",
        blue: "10,132,255",
        purple: "191,90,242",
      };
      const ringSizes = { small: 26, medium: 40, large: 60 };
      const trailLengths = { off: 0, short: 22, medium: 42, long: 70 };
      const colorKey = palette[prefs.color] ? prefs.color : "amber";
      return {
        rgb: palette[colorKey],
        ring: ringSizes[prefs.ringSize] || ringSizes.medium,
        trail: prefs.trailLength in trailLengths ? trailLengths[prefs.trailLength] : trailLengths.medium,
        clickRipple: prefs.clickRipple !== false,
        spotlight: prefs.spotlight === true,
      };
    }

    function buildWindowOptions(html) {
      // Named option set covering the likely overlay hints. Unknown keys are
      // harmless; aliases improve the odds of matching the host's vocabulary.
      return {
        title: "Cursor Demo",
        html: html,
        overlay: true,
        transparent: true,
        opaque: false,
        background: "transparent",
        borderless: true,
        chrome: false,
        hasShadow: false,
        clickThrough: true,
        ignoresMouseEvents: true,
        fullscreen: true,
        fullScreen: true,
        coverAllScreens: true,
        level: "screenSaver",
        floating: true,
        alwaysOnTop: true,
        joinAllSpaces: true,
      };
    }

    async function closeOverlay(handle) {
      if (!handle) return false;
      // Try the handful of close shapes a window host might expose.
      try {
        if (typeof handle.close === "function") {
          await handle.close();
          return true;
        }
      } catch (err) {
        await coco.log("cursor-demo handle.close failed: " + errorMessage(err));
      }
      if (coco.window && typeof coco.window.close === "function") {
        try {
          await coco.window.close(handle.id);
          return true;
        } catch (err) {
          await coco.log("cursor-demo window.close failed: " + errorMessage(err));
        }
      }
      // No programmatic close available — the overlay still self-closes on Esc.
      return false;
    }

    function errorMessage(err) {
      return err && err.message ? err.message : String(err);
    }

    function renderOverlay(config) {
      const cfg = JSON.stringify(config);
      return [
        "<!doctype html><html><head><meta charset='utf-8'>",
        "<style>",
        "html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;cursor:none;}",
        "#c{position:fixed;inset:0;display:block;}",
        "#hint{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);",
        "font:600 13px/1 -apple-system,system-ui,sans-serif;color:#fff;",
        "background:rgba(0,0,0,.55);padding:8px 14px;border-radius:999px;",
        "letter-spacing:.02em;opacity:1;transition:opacity .6s ease;pointer-events:none;",
        "-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);}",
        "#hint.gone{opacity:0;}",
        "</style></head><body>",
        "<canvas id='c'></canvas>",
        "<div id='hint'>Cursor Demo — move to point, press Esc to stop</div>",
        "<script>(", overlayScript.toString(), ")(", cfg, ");</script>",
        "</body></html>",
      ].join("");
    }
  } catch (err) {
    console.error("cursor-demo bootstrap error", err);
  }

  // Runs inside the overlay webview. Self-contained so it can be stringified
  // into the page; receives the resolved config object as its only argument.
  function overlayScript(cfg) {
    var canvas = document.getElementById("c");
    var ctx = canvas.getContext("2d");
    var hint = document.getElementById("hint");
    var dpr = Math.max(1, window.devicePixelRatio || 1);

    function resize() {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    var rgb = cfg.rgb || "255,176,32";
    var ring = cfg.ring || 40;
    var trailMax = cfg.trail || 0; // points retained; 0 = ring only
    var hasPos = false;
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    var trail = []; // {x,y,t}
    var ripples = []; // {x,y,t}

    function setPos(nx, ny) {
      if (typeof nx !== "number" || typeof ny !== "number") return;
      x = nx;
      y = ny;
      hasPos = true;
      if (trailMax > 0) {
        trail.push({ x: x, y: y, t: performance.now() });
        if (trail.length > trailMax) trail.shift();
      }
    }

    function addRipple(nx, ny) {
      if (!cfg.clickRipple) return;
      ripples.push({ x: nx, y: ny, t: performance.now() });
      if (ripples.length > 12) ripples.shift();
    }

    // --- Cursor position feeds, most reliable first. ---------------------
    // 1) Native cursor feed: works even when the overlay is click-through and
    //    receives no DOM events. We accept a few plausible shapes so whichever
    //    one Coco's host emits will drive the trail.
    function nativePoint(d) {
      if (!d) return;
      var px = d.x, py = d.y;
      if (typeof px !== "number" || typeof py !== "number") return;
      // Native global coords may be screen-relative; the overlay covers the
      // screen, so treat them as page coords. Device-pixel coords are halved
      // back to CSS pixels when they clearly exceed the viewport.
      if (px > window.innerWidth || py > window.innerHeight) {
        px = px / dpr;
        py = py / dpr;
      }
      setPos(px, py);
      if (d.clicked || d.down || d.pressed) addRipple(px, py);
    }
    if (window.coco && coco.system && typeof coco.system.onMouseMove === "function") {
      try { coco.system.onMouseMove(nativePoint); } catch (e) {}
    }
    window.addEventListener("coco:mousemove", function (e) { nativePoint(e.detail); });
    window.addEventListener("coco:mousedown", function (e) {
      var d = e.detail || {};
      addRipple(typeof d.x === "number" ? d.x : x, typeof d.y === "number" ? d.y : y);
    });
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (d && d.type === "coco:mousemove") nativePoint(d);
    });

    // 2) DOM fallback: drives the trail whenever the overlay is interactive.
    window.addEventListener("mousemove", function (e) { setPos(e.clientX, e.clientY); });
    window.addEventListener("mousedown", function (e) { addRipple(e.clientX, e.clientY); });

    // --- Exit handling --------------------------------------------------
    function exit() {
      try { if (window.coco && coco.window && typeof coco.window.close === "function") coco.window.close(); } catch (e) {}
      try { window.close(); } catch (e) {}
    }
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); exit(); }
    });

    // Fade the hint out after a few seconds.
    setTimeout(function () { hint.classList.add("gone"); }, 3200);

    function draw() {
      var w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      var now = performance.now();

      // Spotlight: dim everything but a soft circle around the cursor.
      if (cfg.spotlight && hasPos) {
        var r = ring * 3.4;
        var g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      // Motion trail: connected segments fading from tail to head.
      if (trailMax > 0 && trail.length > 1) {
        for (var i = 1; i < trail.length; i++) {
          var p0 = trail[i - 1], p1 = trail[i];
          var frac = i / trail.length;
          ctx.strokeStyle = "rgba(" + rgb + "," + (0.45 * frac).toFixed(3) + ")";
          ctx.lineWidth = Math.max(1, ring * 0.5 * frac);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }

      // Click ripples: expand and fade over ~600ms.
      for (var j = ripples.length - 1; j >= 0; j--) {
        var rp = ripples[j];
        var age = (now - rp.t) / 600;
        if (age >= 1) { ripples.splice(j, 1); continue; }
        ctx.strokeStyle = "rgba(" + rgb + "," + (1 - age).toFixed(3) + ")";
        ctx.lineWidth = 2.5 * (1 - age);
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, ring * 0.5 + age * ring * 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Highlight ring + soft glow + a small solid pointer dot at the tip.
      if (hasPos) {
        var pulse = 1 + 0.06 * Math.sin(now / 260);
        var glow = ctx.createRadialGradient(x, y, ring * 0.2, x, y, ring * pulse);
        glow.addColorStop(0, "rgba(" + rgb + ",0.30)");
        glow.addColorStop(1, "rgba(" + rgb + ",0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, ring * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(" + rgb + ",0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, ring * 0.62 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(" + rgb + ",0.95)";
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }
})();
