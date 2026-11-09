/* KAIROS · „sfera de fire” din cardul de login: mii de fire subțiri care pleacă dintr-o calotă și se leagănă,
   luminate aditiv, iar în centru o clepsidră prin care curge cerneala albastră. Canvas 2D, fără WebGL.
   Se desenează în <canvas id="burst">. Firele se apleacă puțin după mouse. */
(() => {
  "use strict";
  const cv = document.getElementById("burst");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let W = 0, H = 0, R = 0, dpr = 1, strands = [], mx = 0, my = 0, tmx = 0, tmy = 0;
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  function build() {
    const n = Math.round(Math.min(1700, Math.max(800, W * H / 200)));
    strands = Array.from({ length: n }, () => {
      const th = rnd() * Math.PI * 2;
      // rădăcinile stau pe o calotă privită din față: mai dese spre margine
      const u = Math.pow(rnd(), .45);
      const r0 = .34 + u * .2;
      const out = rnd() < .86;                              // cele mai multe fire ies în afară, câteva intră spre centru
      return { th, r0, len: (out ? .28 + rnd() * .5 : -(.06 + rnd() * .14)) * (1 + (u - .5) * .4),
        bend: (rnd() - .5) * .9, ph: rnd() * 6.28, sp: .4 + rnd() * .9, w: .35 + rnd() * .9,
        hue: rnd(), a: .05 + rnd() * .16 };
    });
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height; R = Math.min(W, H) * .5;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }
  addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(); tmx = ((e.clientX - r.left) / r.width - .5) * 2; tmy = ((e.clientY - r.top) / r.height - .5) * 2; }, { passive: true });

  // ——— clepsidra ———
  const CY = 12;                                             // 10 s curge, apoi se întoarce
  function hourglass(t, cx, cy, s) {
    const c = t % CY, k = Math.min(1, c / 10);
    const flip = c > 10.8 ? Math.min(1, (c - 10.8) / 1.2) : 0;
    const fe = flip < .5 ? 4 * flip ** 3 : 1 - (-2 * flip + 2) ** 3 / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI * fe);
    const h = s, w = s * .62, neck = s * .045;
    const half = (y) => { const u = Math.min(1, Math.abs(y) / h); return neck + (w - neck) * Math.pow(Math.sin(u * 1.57), 1.3); };
    // conturul de sticlă
    const outline = () => { ctx.beginPath(); for (let y = -h; y <= h; y += h / 30) ctx.lineTo(half(y), y); for (let y = h; y >= -h; y -= h / 30) ctx.lineTo(-half(y), y); ctx.closePath(); };
    outline();
    const glass = ctx.createLinearGradient(-w, 0, w, 0);
    glass.addColorStop(0, "rgba(214,228,255,.10)"); glass.addColorStop(.5, "rgba(214,228,255,.03)"); glass.addColorStop(1, "rgba(214,228,255,.12)");
    ctx.fillStyle = glass; ctx.fill();
    ctx.save(); outline(); ctx.clip();
    // cerneala: sus scade de la gât în sus, jos crește de la bază
    const top = h * .78 * (1 - k), bot = h * .78 * k;
    const ink = (y0, y1) => { ctx.beginPath(); ctx.moveTo(-half(y0), y0); for (let y = y0; y <= y1; y += h / 40) ctx.lineTo(-half(y), y); for (let y = y1; y >= y0; y -= h / 40) ctx.lineTo(half(y), y); ctx.closePath(); };
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, "#2a5ff0"); g.addColorStop(.5, "#123aa8"); g.addColorStop(1, "#3d7bff");
    ctx.fillStyle = g; ctx.shadowColor = "rgba(61,123,255,.9)"; ctx.shadowBlur = s * .25;
    if (top > 1 && flip === 0) { ink(-top - h * .02, -neck * .2); ctx.fill(); }
    if (flip > 0) { ink(-h, -h + h * .78); ctx.fill(); }           // în timpul întoarcerii, cerneala e toată într-o parte
    else if (bot > 1) { ink(h - bot, h); ctx.fill(); }
    // firul care cade prin gât
    if (k > 0 && k < 1 && flip === 0) {
      ctx.strokeStyle = "rgba(170,200,255,.95)"; ctx.lineWidth = Math.max(1, s * .022); ctx.beginPath();
      for (let y = 0; y <= h - bot; y += 2) ctx.lineTo(Math.sin(y * .18 + t * 9) * s * .008, y);
      ctx.stroke();
    }
    ctx.restore();
    outline(); ctx.strokeStyle = "rgba(214,228,255,.75)"; ctx.lineWidth = Math.max(1, s * .018); ctx.shadowColor = "rgba(150,190,255,.8)"; ctx.shadowBlur = s * .15; ctx.stroke();
    // capacele
    ctx.fillStyle = "rgba(214,228,255,.9)"; ctx.shadowBlur = s * .1;
    ctx.fillRect(-w * 1.18, -h - s * .07, w * 2.36, s * .07); ctx.fillRect(-w * 1.18, h, w * 2.36, s * .07);
    ctx.restore();
  }

  function frame(now) {
    const t = now / 1000;
    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    // strălucirea din spate
    const halo = ctx.createRadialGradient(cx, cy, R * .05, cx, cy, R * .95);
    halo.addColorStop(0, "rgba(220,232,255,.55)"); halo.addColorStop(.25, "rgba(110,160,255,.28)"); halo.addColorStop(.6, "rgba(40,80,220,.10)"); halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    // firele se grupează după culoare, transparență și grosime: câteva zeci de trasee pe cadru, nu mii
    const COLS = ["150,185,255", "214,228,255", "61,123,255"];
    const paths = new Map();
    const P = (key) => { let p = paths.get(key); if (!p) { p = new Path2D(); paths.set(key, p); } return p; };
    for (const s of strands) {
      const sway = Math.sin(t * s.sp + s.ph) * .06 + Math.sin(t * .37 + s.th * 3) * .04;
      const th = s.th + sway * (s.len > 0 ? 1 : .4);
      const x0 = cx + Math.cos(s.th) * s.r0 * R, y0 = cy + Math.sin(s.th) * s.r0 * R;
      const rl = s.r0 + s.len, lean = s.len > 0 ? s.len : 0;
      const x2 = cx + Math.cos(th + s.bend * .25) * rl * R + mx * lean * R * .35, y2 = cy + Math.sin(th + s.bend * .25) * rl * R + my * lean * R * .35;
      const x1 = cx + Math.cos(s.th + s.bend * .5 + sway) * (s.r0 + s.len * .55) * R, y1 = cy + Math.sin(s.th + s.bend * .5 + sway) * (s.r0 + s.len * .55) * R;
      // curba împărțită în două: rădăcina luminoasă, vârful stins
      const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2, bx = (x1 + x2) / 2, by = (y1 + y2) / 2, mxp = (ax + bx) / 2, myp = (ay + by) / 2;
      const ci = s.hue < .7 ? 0 : s.hue < .92 ? 1 : 2, ab = Math.min(4, Math.floor(s.a / .045)), wb = s.w > .8 ? 1 : 0;
      const p1 = P(`${ci}|${ab}|${wb}|0`); p1.moveTo(x0, y0); p1.quadraticCurveTo(ax, ay, mxp, myp);
      const p2 = P(`${ci}|${ab}|${wb}|1`); p2.moveTo(mxp, myp); p2.quadraticCurveTo(bx, by, x2, y2);
    }
    for (const [key, path] of paths) {
      const [ci, ab, wb, seg] = key.split("|").map(Number);
      const a = (.05 + ab * .045) * (seg ? .55 : 1.7);
      ctx.strokeStyle = `rgba(${COLS[ci]},${a.toFixed(3)})`; ctx.lineWidth = wb ? 1.05 : .5;
      ctx.stroke(path);
    }
    ctx.globalCompositeOperation = "source-over";
    // interiorul calotei, întunecat, ca să se vadă clepsidra
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .4);
    inner.addColorStop(0, "rgba(4,8,30,.55)"); inner.addColorStop(.8, "rgba(4,8,30,.25)"); inner.addColorStop(1, "rgba(4,8,30,0)");
    ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(cx, cy, R * .4, 0, 7); ctx.fill();
    hourglass(t, cx + mx * R * .03, cy + my * R * .03, R * .24);
    if (!reduce) requestAnimationFrame(frame);
  }
  addEventListener("resize", () => { resize(); if (reduce) frame(4000); });
  resize();
  if ("IntersectionObserver" in window) new IntersectionObserver(() => {}).observe(cv);
  requestAnimationFrame(frame);
})();
