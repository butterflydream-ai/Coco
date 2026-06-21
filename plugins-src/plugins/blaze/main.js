(async function () {
  try {
    await coco.log("blaze plugin loaded");

    var overlayWindowId = null;

    coco.commands.on("start", async function () {
      if (overlayWindowId) {
        await coco.toast("Blaze is already running");
        return;
      }
      try {
        var prefs = await coco.preferences.all();
        var theme = (prefs && prefs.theme) || "fire";
        var result = await coco.window.open({
          transparent: true,
          clickThrough: true,
          fullscreen: true,
          level: "screenSaver",
          joinAllSpaces: true,
          hasShadow: false,
          html: buildOverlayHTML(theme),
        });
        overlayWindowId = result && result.id;
        await coco.log("blaze overlay opened id=" + overlayWindowId + " theme=" + theme);
      } catch (err) {
        await coco.toast("Failed to start Blaze");
        await coco.log(
          "blaze start failed: " +
            (err && err.message ? err.message : String(err))
        );
      }
    });

    coco.commands.on("stop", async function () {
      if (!overlayWindowId) {
        await coco.toast("Blaze is not running");
        return;
      }
      try {
        await coco.window.close(overlayWindowId);
      } catch (err) {}
      overlayWindowId = null;
      await coco.log("blaze stopped");
    });

    coco.preferences.onChange("theme", async function (newTheme) {
      if (!overlayWindowId) return;
      await coco.log("blaze theme changed to " + newTheme + ", restarting overlay");
      try { await coco.window.close(overlayWindowId); } catch (err) {}
      overlayWindowId = null;
      var theme = newTheme || "fire";
      try {
        var result = await coco.window.open({
          transparent: true,
          clickThrough: true,
          fullscreen: true,
          level: "screenSaver",
          joinAllSpaces: true,
          hasShadow: false,
          html: buildOverlayHTML(theme),
        });
        overlayWindowId = result && result.id;
      } catch (err) {
        await coco.log("blaze theme restart failed: " + (err && err.message ? err.message : String(err)));
      }
    });

    function buildOverlayHTML(theme) {
      return [
        "<!doctype html><html><head><meta charset='utf-8'>",
        "<style>",
        "html,body{margin:0;padding:0;overflow:hidden;background:transparent;width:100%;height:100%;}",
        "canvas{display:block;width:100%;height:100%;}",
        "</style>",
        "</head><body>",
        "<canvas id='c'></canvas>",
        "<script>",
        "var BLAZE_THEME='" + theme + "';",
        OVERLAY_SCRIPT,
        "</script>",
        "</body></html>",
      ].join("");
    }

    var OVERLAY_SCRIPT = `(function(){
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
var dpr = window.devicePixelRatio || 1;
var W, H;

var THEMES = {
  fire:   { inner: [255,220,40],  outer: [220,40,20]   },
  frost:  { inner: [240,248,255], outer: [60,170,240]  },
  venom:  { inner: [200,255,60],  outer: [40,180,60]   },
  arcane: { inner: [200,160,255], outer: [130,40,200]  },
  sakura: { inner: [255,190,210], outer: [240,60,120]  }
};
var palette = THEMES[BLAZE_THEME] || THEMES.fire;
var CI = palette.inner;
var CO = palette.outer;

var mx = -200, my = -200, clicked = false;
var points = [];
var MAX_POINTS = 80;
var ripples = [];

var HEAD_WIDTH = 7;
var TAIL_WIDTH = 0.5;
var TRAIL_LIFE = 350;

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

var lastX = -200, lastY = -200;

coco.system.onMouseMove(function(e) {
  mx = e.x; my = e.y;
  var now = performance.now();
  var dx = mx - lastX, dy = my - lastY;
  if (dx * dx + dy * dy > 1) {
    points.push({ x: mx, y: my, t: now });
    if (points.length > MAX_POINTS) points.shift();
  }
  if (e.clicked && !clicked) {
    ripples.push({ x: mx, y: my, t: now });
  }
  clicked = e.clicked;
  lastX = mx; lastY = my;
});

function catmullRom(p0, p1, p2, p3, t) {
  var t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5 * ((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

// Build ribbon outline from smooth points: left edge forward, right edge backward
function buildRibbon(pts, now, widthScale) {
  var left = [], right = [];
  var total = pts.length;
  if (total < 2) return null;

  for (var i = 0; i < total; i++) {
    var p = pts[i];
    var frac = i / (total - 1);
    var age = (now - p.t) / TRAIL_LIFE;
    if (age >= 1) { left.push(null); right.push(null); continue; }

    // tangent direction
    var tx, ty;
    if (i === 0) {
      tx = pts[1].x - p.x; ty = pts[1].y - p.y;
    } else if (i === total - 1) {
      tx = p.x - pts[i-1].x; ty = p.y - pts[i-1].y;
    } else {
      tx = pts[i+1].x - pts[i-1].x; ty = pts[i+1].y - pts[i-1].y;
    }
    var len = Math.sqrt(tx * tx + ty * ty) || 1;
    // normal (perpendicular)
    var nx = -ty / len, ny = tx / len;

    var w = TAIL_WIDTH + (HEAD_WIDTH - TAIL_WIDTH) * frac * (1 - age * 0.3);
    var half = w * widthScale * 0.5;

    left.push({ x: p.x + nx * half, y: p.y + ny * half, frac: frac, age: age });
    right.push({ x: p.x - nx * half, y: p.y - ny * half });
  }
  return { left: left, right: right };
}

function fillRibbon(ribbon, color) {
  var left = ribbon.left, right = ribbon.right;
  var total = left.length;

  // find first valid point
  var start = -1;
  for (var i = 0; i < total; i++) { if (left[i]) { start = i; break; } }
  if (start < 0) return;

  // draw in alpha-banded chunks for smooth fade along length
  var BANDS = 20;
  for (var b = 0; b < BANDS; b++) {
    var bStart = start + Math.floor((total - start) * b / BANDS);
    var bEnd = start + Math.floor((total - start) * (b + 1) / BANDS);
    if (bEnd <= bStart) continue;

    // use midpoint's alpha for this band
    var mid = Math.floor((bStart + bEnd) / 2);
    var mp = left[mid];
    if (!mp) continue;
    var alpha = (1 - mp.age) * mp.frac;
    if (alpha <= 0.01) continue;

    ctx.beginPath();
    // forward along left edge
    var first = true;
    for (var i = bStart; i <= bEnd && i < total; i++) {
      if (!left[i]) continue;
      if (first) { ctx.moveTo(left[i].x, left[i].y); first = false; }
      else ctx.lineTo(left[i].x, left[i].y);
    }
    // backward along right edge
    for (var i = Math.min(bEnd, total - 1); i >= bStart; i--) {
      if (!right[i]) continue;
      ctx.lineTo(right[i].x, right[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba('+color[0]+','+color[1]+','+color[2]+','+alpha.toFixed(3)+')';
    ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  var now = performance.now();

  while (points.length > 0 && (now - points[0].t) > TRAIL_LIFE) points.shift();

  if (points.length >= 2) {
    var smooth = [];
    var n = points.length;
    for (var i = 0; i < n - 1; i++) {
      var p0 = points[Math.max(0, i - 1)];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[Math.min(n - 1, i + 2)];
      var segDist = Math.sqrt((p2.x-p1.x)*(p2.x-p1.x)+(p2.y-p1.y)*(p2.y-p1.y));
      var steps = Math.max(3, Math.ceil(segDist / 3));
      for (var s = 0; s < steps; s++) {
        var t = s / steps;
        var pt = catmullRom(p0, p1, p2, p3, t);
        pt.t = p1.t + (p2.t - p1.t) * t;
        smooth.push(pt);
      }
    }
    smooth.push(points[n - 1]);

    // outer flame ribbon
    var outerRibbon = buildRibbon(smooth, now, 1.8);
    if (outerRibbon) fillRibbon(outerRibbon, CO);

    // inner flame ribbon
    var innerRibbon = buildRibbon(smooth, now, 0.6);
    if (innerRibbon) fillRibbon(innerRibbon, CI);
  }

  // cursor dot
  if (mx > -50) {
    ctx.beginPath();
    ctx.arc(mx, my, clicked ? 5.5 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb('+CO[0]+','+CO[1]+','+CO[2]+')';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, clicked ? 3 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb('+CI[0]+','+CI[1]+','+CI[2]+')';
    ctx.fill();
  }

  // click ripples
  for (var k = ripples.length - 1; k >= 0; k--) {
    var rp = ripples[k];
    var rAge = (now - rp.t) / 500;
    if (rAge > 1) { ripples.splice(k, 1); continue; }
    var rr = 6 + rAge * 35;
    var ra = (1 - rAge) * 0.7;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba('+CO[0]+','+CO[1]+','+CO[2]+','+ra.toFixed(3)+')';
    ctx.lineWidth = 3 * (1 - rAge);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
})();`;
  } catch (err) {
    console.error("blaze bootstrap error", err);
  }
})();
