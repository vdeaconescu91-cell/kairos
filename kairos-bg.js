/* KAIROS · fundalul paginii de start: o rază de lumină care cade pe diagonală din dreapta sus,
   desenată la rezoluție mică și redusă la câteva trepte cu dither (granulația „pixelată”),
   plus praf care plutește prin rază. Un singur <canvas id="kbg"> fix, în spatele paginii. */
(() => {
  "use strict";
  const cv = document.getElementById("kbg");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const low = document.createElement("canvas"), lc = low.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SCALE = 3;                                           // 1 pixel de rază = 3x3 pixeli pe ecran
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + .5) / 16);
  const LEVELS = 7;
  // culorile treptelor: de la negru, prin albastrul KAIROS, spre gheață
  const RAMP = [[3, 4, 9], [6, 12, 34], [12, 28, 82], [26, 62, 170], [52, 110, 240], [120, 164, 255], [205, 222, 255]];
  let W = 0, H = 0, w = 0, h = 0, img = null, dust = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = Math.ceil(W / SCALE); h = Math.ceil(H / SCALE);
    low.width = w; low.height = h; img = lc.createImageData(w, h);
    const n = Math.round(Math.min(90, W * H / 18000));
    dust = Array.from({ length: n }, () => spawn(true));
  }
  // sursa razei și direcția ei, în coordonate de ecran
  // pe login raza cade din stânga sus spre panou; după login, din dreapta sus
  const signed = () => document.body.classList.contains("signed");
  const src = () => signed() ? [W * .82, H * -.02] : [W * .08, H * -.04];
  const tgt = () => signed() ? [W * .18, H * 1.1] : [W * .62, H * 1.08];
  function beamAt(x, y, t) {
    const [sx, sy] = src(), [tx, ty] = tgt();
    const ax = tx - sx, ay = ty - sy, al = Math.hypot(ax, ay);
    const px = x - sx, py = y - sy;
    const along = (px * ax + py * ay) / al;                  // cât de departe de sursă, pe axă
    if (along < 0) return 0;
    const across = Math.abs(px * ay - py * ax) / al;
    const k = along / al;
    const width = 14 + k * Math.min(W, H) * .24;              // conul se lărgește
    const shimmer = .82 + .18 * Math.sin(along * .012 - t * .9) * Math.sin(across * .05 + t * .5);
    const core = Math.exp(-Math.pow(across / width, 2)) * Math.pow(1 - Math.min(k, 1), 1.25) * shimmer;
    const halo = Math.exp(-Math.pow(across / (width * 3.2), 2)) * (1 - Math.min(k, 1)) * .16;
    return core * 1.25 + halo * 1.4;
  }
  function paintBeam(t) {
    const d = img.data, [sx, sy] = src();
    const R = Math.min(W, H);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const x = i * SCALE, y = j * SCALE;
        let v = beamAt(x, y, t);
        const dg = Math.hypot(x - sx, y - sy);
        v += Math.exp(-Math.pow(dg / (R * .028), 2)) * 1.2 + Math.exp(-dg / (R * .14)) * .22;   // sursa
        v += .03 * (1 - y / H);                               // un pic de aer sus
        const q = Math.min(LEVELS - 1, Math.max(0, Math.floor(v * (LEVELS - 1) + BAYER[(j & 3) * 4 + (i & 3)])));
        const c = RAMP[q], o = (j * w + i) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    lc.putImageData(img, 0, 0);
  }
  function spawn(anywhere) {
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : -10, s: Math.random() < .2 ? 2 : 1,
      vx: -(.05 + Math.random() * .18), vy: .05 + Math.random() * .22, ph: Math.random() * 6.28, tw: .6 + Math.random() * 1.6 };
  }
  let lastBeam = -1;
  new MutationObserver(() => { lastBeam = -1; }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  function frame(now) {
    const t = now / 1000;
    if (lastBeam < 0 || now - lastBeam > 110) { paintBeam(t); lastBeam = now; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, w * SCALE, h * SCALE);
    for (const p of dust) {
      p.x += p.vx; p.y += p.vy;
      if (p.y > H + 10 || p.x < -10) Object.assign(p, spawn(false), { x: Math.random() * W * 1.2 });
      const lit = Math.min(1, beamAt(p.x, p.y, t) * 3);
      const a = (.12 + .88 * lit) * (.55 + .45 * Math.sin(t * p.tw + p.ph));
      ctx.fillStyle = `rgba(${lit > .3 ? "214,228,255" : "120,150,230"},${a.toFixed(3)})`;
      const sz = p.s * SCALE * .67;
      ctx.fillRect(Math.round(p.x / SCALE) * SCALE, Math.round(p.y / SCALE) * SCALE, sz, sz);
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  addEventListener("resize", () => { resize(); lastBeam = -1; if (reduce) frame(performance.now()); });
  resize();
  requestAnimationFrame(frame);
})();
