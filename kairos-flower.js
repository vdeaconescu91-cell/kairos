/* KAIROS · floarea din login, randată în Blender și redată printr-un filtru „ASCII”.
   Două secvențe: înflorirea (72 de cadre, o dată la intrare) și o buclă de vânt (60 de cadre, fără cusătură),
   în care fiecare petală flutură cu faza ei. Între cadre se face o tranziție, ca mișcarea să fie continuă.
   Straturi: imaginea se recompune la fiecare cadru de ecran (60 fps); glifele, care sunt scumpe, doar de ~12 ori pe secundă. */
(() => {
  "use strict";
  const cv = document.getElementById("flower"), panel = document.getElementById("aRight"), stage = document.querySelector(".login");
  if (!cv || !panel || !stage) return;
  const ctx = cv.getContext("2d");
  const NB = 72, NW = 60, BLOOM = 11, DELAY = .6, WIND_FPS = 10;   // bucla de vânt: 6 s
  const SW = 416, SH = 576;                                        // mărimea cadrelor randate
  const CELL = 7, Q = CELL / 8, BAND = 3, RUN = 6;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const load = (p) => { const im = new Image(); im.decoding = "async"; im.src = p; return im; };
  const bloom = Array.from({ length: NB }, (_, i) => load(`hero/fb_${String(i).padStart(2, "0")}.webp`));
  let wind = null;   // se încarcă după ce pornește înflorirea
  const ok = (im) => im && im.complete && im.naturalWidth > 0;

  const fc = document.createElement("canvas"), fx = fc.getContext("2d");            // floarea compusă
  const tintM = document.createElement("canvas"), tintC = document.createElement("canvas");
  const gc = document.createElement("canvas"), gx = gc.getContext("2d");            // stratul de glife
  const small = document.createElement("canvas"), sx = small.getContext("2d", { willReadFrequently: true });
  let W = 0, H = 0, pw = 0, ph = 0, dpr = 1, cols = 0, rows = 0, top = 0, t0 = 0, lastGlyph = -1;

  function layout() {
    const st = stage.getBoundingClientRect(), r = panel.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    pw = r.width; ph = r.height;
    H = ph * 1.5; W = pw; top = ph * .3;                         // floarea iese din casetă sus și jos
    Object.assign(cv.style, { left: `${r.left - st.left}px`, top: `${r.top - st.top - top}px`, width: `${W}px`, height: `${H}px` });
    cv.width = gc.width = Math.round(W * dpr); cv.height = gc.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // imaginea compusă nu are nevoie de mai mult decât rezoluția cadrelor
    const s = Math.min(1, SW / Math.max(1, W) * 1.25);
    for (const c of [fc, tintM, tintC]) { c.width = Math.max(1, Math.round(W * s)); c.height = Math.max(1, Math.round(H * s)); }
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    small.width = cols; small.height = rows;
    lastGlyph = -1;
  }

  function frameAt(t) {
    // înflorire aproape liniară (cadrele au deja propria încetinire), apoi bucla de vânt
    const x = reduce ? 1 : Math.min(1, Math.max(0, (t - DELAY) / BLOOM));
    if (x < 1 || !wind || !ok(wind[0])) {
      const k = .55 * x + .45 * x * x * (3 - 2 * x), f = k * (NB - 1), i = Math.floor(f);
      return [bloom[i], bloom[Math.min(NB - 1, i + 1)], f - i];
    }
    const f = ((t - DELAY - BLOOM) * WIND_FPS) % NW, i = Math.floor(f);
    return [wind[i], wind[(i + 1) % NW], f - i];
  }

  function compose(a, b, m) {
    const w = fc.width, h = fc.height, s = w / W;
    const iw = Math.min(H * (SW / SH), W * 1.12), ih = iw * (SH / SW), ix = (W - iw) / 2, iy = top * .15;
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, w, h);
    fx.globalAlpha = 1; fx.drawImage(a, ix * s, iy * s, iw * s, ih * s);
    if (m > .02 && ok(b) && b !== a) { fx.globalAlpha = m; fx.drawImage(b, ix * s, iy * s, iw * s, ih * s); }
    fx.globalAlpha = 1;
    for (const [c, col] of [[tintM, "rgb(255,40,170)"], [tintC, "rgb(40,220,255)"]]) {
      const x = c.getContext("2d");
      x.globalCompositeOperation = "copy"; x.drawImage(fc, 0, 0);
      x.globalCompositeOperation = "multiply"; x.fillStyle = col; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = "destination-in"; x.drawImage(fc, 0, 0);
    }
    return iy + ih;
  }

  const hash = (a, b, c) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0);
  function glyphs(now) {
    gx.clearRect(0, 0, W, H);
    sx.clearRect(0, 0, cols, rows); sx.drawImage(fc, 0, 0, fc.width, fc.height, 0, 0, W / CELL, H / CELL);
    const d = sx.getImageData(0, 0, cols, rows).data;
    const r0 = Math.ceil(top / CELL), r1 = Math.min(rows, Math.floor((top + ph) / CELL));   // doar în interiorul casetei
    const seed = Math.floor(now / 90), bandSeed = Math.floor(now / 700);
    gx.lineWidth = .75;
    for (let y = r0; y < r1; y++) {
      const band = Math.floor(y / BAND);
      if (y % BAND === BAND - 1) continue;                                   // un rând gol între benzi
      if (hash(band, 7, bandSeed) % 100 > 66) continue;                      // banda e stinsă
      for (let x = 0; x < cols; x++) {
        if (hash(band, Math.floor(x / RUN), bandSeed) % 100 > 74) continue;  // banda e ruptă în segmente
        const o = (y * cols + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2], a = d[o + 3];
        const L = (r * .3 + g * .55 + b * .15) / 255 * (a / 255);
        if (L < .3) continue;                                                // doar luminile
        const h = hash(x, y, seed);
        if ((h % 100) < 14) continue;                                        // sclipire
        const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2, lift = Math.min(1, (L - .3) * 1.6), tint = (h >> 4) % 12;
        gx.fillStyle = gx.strokeStyle = tint === 0 ? "rgba(120,235,255,.95)" : tint === 1 ? "rgba(255,120,220,.95)" : tint === 2 ? "rgba(255,220,130,.95)"
          : `rgb(${Math.round(r + (255 - r) * lift * .6)},${Math.round(g + (255 - g) * lift * .6)},${Math.round(b + (255 - b) * lift * .5)})`;
        const kind = L < .4 ? 0 : L < .52 ? 1 : L < .64 ? 2 : L < .76 ? 3 : 4;
        const pick = (h >> 8) % 7 === 0 ? (kind + 1) % 5 : kind;
        gx.beginPath();
        if (pick === 0) { gx.arc(cx, cy, Math.max(.6, .9 * Q), 0, 7); gx.fill(); }
        else if (pick === 1) { gx.arc(cx, cy, 2.2 * Q, 0, 7); gx.stroke(); }
        else if (pick === 2) { gx.arc(cx, cy, 2.4 * Q, 0, 7); gx.stroke(); gx.beginPath(); gx.arc(cx, cy, Math.max(.5, .9 * Q), 0, 7); gx.fill(); }
        else if (pick === 3) { gx.moveTo(cx, cy - 2.6 * Q); gx.lineTo(cx + 2.6 * Q, cy + 2 * Q); gx.lineTo(cx - 2.6 * Q, cy + 2 * Q); gx.closePath(); gx.fill(); }
        else { gx.fillRect(cx - 2.3 * Q, cy - 2.3 * Q, 4.6 * Q, 4.6 * Q); }
      }
    }
  }

  function draw(now) {
    if (!cols || !rows || stage.hidden || !pw) return;
    const t = (now - t0) / 1000;
    const [a, b, m] = frameAt(t);
    if (!ok(a)) return;
    if (!wind && t > 1) wind = Array.from({ length: NW }, (_, i) => load(`hero/fw_${String(i).padStart(2, "0")}.webp`));
    const ie = compose(a, b, m);
    if (lastGlyph < 0 || now - lastGlyph > 80) { glyphs(now); lastGlyph = now; }
    ctx.clearRect(0, 0, W, H);
    // imaginea, cu aberație cromatică (magenta la stânga, cyan la dreapta), apoi glifele
    ctx.globalAlpha = .72; ctx.drawImage(fc, 0, 0, W, H);
    ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = .55;
    ctx.drawImage(tintM, -3, 0, W, H); ctx.drawImage(tintC, 3, 1, W, H);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.drawImage(gc, 0, 0, W, H);
    // ce iese deasupra și dedesubt se stinge spre margini (ca o mască); tulpinile se sting înainte de capătul imaginii
    ctx.globalCompositeOperation = "destination-out";
    const gt = ctx.createLinearGradient(0, 0, 0, top); gt.addColorStop(0, "rgba(0,0,0,1)"); gt.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = gt; ctx.fillRect(0, 0, W, top);
    const gb = ctx.createLinearGradient(0, top + ph, 0, H); gb.addColorStop(0, "rgba(0,0,0,.45)"); gb.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gb; ctx.fillRect(0, top + ph, W, H - top - ph);
    const ge = ctx.createLinearGradient(0, ie - 110, 0, ie); ge.addColorStop(0, "rgba(0,0,0,0)"); ge.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = ge; ctx.fillRect(0, ie - 110, W, H - ie + 110);
    ctx.globalCompositeOperation = "source-over";
  }
  function loop(now) { draw(now); requestAnimationFrame(loop); }
  addEventListener("resize", layout);
  new ResizeObserver(layout).observe(panel);
  layout();
  bloom[0].onload = () => { t0 = performance.now(); };
  t0 = performance.now();
  requestAnimationFrame(loop);
})();
