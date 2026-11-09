/* KAIROS · floarea din login: 32 de cadre randate în Blender (o floare care înflorește),
   redate printr-un filtru „ASCII”: peste imagine se desenează puncte, cercuri, triunghiuri și pătrate
   după luminozitatea fiecărei celule, cu o ușoară separare de culori. Înflorește o dată la intrare,
   apoi rămâne deschisă și sclipește. Partea din floare care iese sub card se vede stinsă, fără glife. */
(() => {
  "use strict";
  const cv = document.getElementById("flower"), panel = document.getElementById("aRight"), stage = document.querySelector(".login");
  if (!cv || !panel || !stage) return;
  const ctx = cv.getContext("2d");
  const N = 32, BLOOM = 3.6, DELAY = .35, CELL = 7, Q = CELL / 8;   // glife aproape de mărimea din referință; benzile le lasă loc imaginii
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frames = Array.from({ length: N }, (_, i) => { const im = new Image(); im.src = `hero/fl_${String(i).padStart(2, "0")}.webp`; return im; });
  const small = document.createElement("canvas"), sx = small.getContext("2d", { willReadFrequently: true });
  let W = 0, H = 0, pw = 0, ph = 0, dpr = 1, cols = 0, rows = 0, t0 = 0, last = -1;

  let top = 0;            // cât iese canvas-ul deasupra cardului (px)
  function layout() {
    const st = stage.getBoundingClientRect(), r = panel.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    pw = r.width; ph = r.height;
    // floarea e mai mare decât caseta: iese cu ~30% în sus și cu ~20% în jos
    H = ph * 1.5; W = pw; top = ph * .3;
    Object.assign(cv.style, { left: `${r.left - st.left}px`, top: `${r.top - st.top - top}px`, width: `${W}px`, height: `${H}px` });
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    small.width = cols; small.height = rows;
    last = -1;
  }
  const BAND = 3, RUN = 6;   // înălțimea unei benzi (rânduri de glife) și lungimea unui segment (coloane)
  // copiile colorate pentru aberația cromatică, refăcute doar când se schimbă cadrul
  const tintM = document.createElement("canvas"), tintC = document.createElement("canvas"); let tintIdx = -1;
  function tintFrame(im) {
    for (const [c, col] of [[tintM, "rgb(255,40,170)"], [tintC, "rgb(40,220,255)"]]) {
      c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext("2d");
      x.globalCompositeOperation = "source-over"; x.drawImage(im, 0, 0);
      x.globalCompositeOperation = "multiply"; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "destination-in"; x.drawImage(im, 0, 0);
    }
  }
  const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

  function draw(now) {
    if (!cols || !rows || stage.hidden || !pw) return;
    const t = (now - t0) / 1000;
    const k = reduce ? 1 : easeOut((t - DELAY) / BLOOM);
    const idx = Math.min(N - 1, Math.round(k * (N - 1)));
    const im = frames[idx];
    if (!im.complete || !im.naturalWidth) return;
    // după ce a înflorit, sclipirea merge mai rar
    const blooming = k < 1;
    const step = blooming ? 33 : 80;
    if (last >= 0 && now - last < step) return;
    last = now;
    ctx.clearRect(0, 0, W, H);
    // imaginea de bază (cadrele au fundal transparent), cu aberație cromatică: o copie magenta la stânga, una cyan la dreapta
    const iw = Math.min(H * (520 / 720), W * 1.12), ih = iw * (720 / 520), ix = (W - iw) / 2, iy = top * .15;   // capul florii iese puțin peste marginea de sus
    if (tintIdx !== idx) { tintFrame(im); tintIdx = idx; }
    ctx.globalAlpha = .72; ctx.drawImage(im, ix, iy, iw, ih);
    ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = .55;
    ctx.drawImage(tintM, ix - 3, iy, iw, ih); ctx.drawImage(tintC, ix + 3, iy + 1, iw, ih);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    // glifele: doar în benzi orizontale (rânduri de „text” întrerupte), doar pe zonele luminoase și doar în interiorul casetei
    sx.clearRect(0, 0, cols, rows); sx.drawImage(im, ix / CELL, iy / CELL, iw / CELL, ih / CELL);
    const d = sx.getImageData(0, 0, cols, rows).data;
    const r0 = Math.ceil(top / CELL), r1 = Math.min(rows, Math.floor((top + ph) / CELL));
    const seed = Math.floor(now / 90), bandSeed = Math.floor(now / 700);           // benzile se schimbă mai rar decât sclipirea
    const hash = (a, b, c) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0);
    for (let y = r0; y < r1; y++) {
      const band = Math.floor(y / BAND);
      if (y % BAND === BAND - 1) continue;                                          // un rând gol între benzi
      if (hash(band, 7, bandSeed) % 100 > 66) continue;                             // banda e stinsă
      for (let x = 0; x < cols; x++) {
        if (hash(band, Math.floor(x / RUN), bandSeed) % 100 > 74) continue;         // banda e ruptă în segmente
        const o = (y * cols + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2], a = d[o + 3];
        const L = (r * .3 + g * .55 + b * .15) / 255 * (a / 255);
        if (L < .3) continue;                                                       // doar luminile
        const h = hash(x, y, seed);
        if ((h % 100) < 14) continue;                                               // sclipire
        const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        const lift = Math.min(1, (L - .3) * 1.6);
        const tint = (h >> 4) % 12;                                                 // câteva celule bat în cyan, magenta sau auriu
        ctx.fillStyle = tint === 0 ? "rgba(120,235,255,.95)" : tint === 1 ? "rgba(255,120,220,.95)" : tint === 2 ? "rgba(255,220,130,.95)"
          : `rgb(${Math.round(r + (255 - r) * lift * .6)},${Math.round(g + (255 - g) * lift * .6)},${Math.round(b + (255 - b) * lift * .5)})`;
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .75;
        const kind = L < .4 ? 0 : L < .52 ? 1 : L < .64 ? 2 : L < .76 ? 3 : 4;
        const pick = (h >> 8) % 7 === 0 ? (kind + 1) % 5 : kind;
        ctx.beginPath();
        if (pick === 0) { ctx.arc(cx, cy, Math.max(.6, .9 * Q), 0, 7); ctx.fill(); }
        else if (pick === 1) { ctx.arc(cx, cy, 2.2 * Q, 0, 7); ctx.stroke(); }
        else if (pick === 2) { ctx.arc(cx, cy, 2.4 * Q, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, Math.max(.5, .9 * Q), 0, 7); ctx.fill(); }
        else if (pick === 3) { ctx.moveTo(cx, cy - 2.6 * Q); ctx.lineTo(cx + 2.6 * Q, cy + 2 * Q); ctx.lineTo(cx - 2.6 * Q, cy + 2 * Q); ctx.closePath(); ctx.fill(); }
        else { ctx.fillRect(cx - 2.3 * Q, cy - 2.3 * Q, 4.6 * Q, 4.6 * Q); }
      }
    }
    // ce iese deasupra și dedesubt: doar imaginea, care se stinge spre margini (ca o mască)
    ctx.globalCompositeOperation = "destination-out";
    const gt = ctx.createLinearGradient(0, 0, 0, top); gt.addColorStop(0, "rgba(0,0,0,1)"); gt.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = gt; ctx.fillRect(0, 0, W, top);
    const gb = ctx.createLinearGradient(0, top + ph, 0, H); gb.addColorStop(0, "rgba(0,0,0,.45)"); gb.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gb; ctx.fillRect(0, top + ph, W, H - top - ph);
    // tulpinile se sting înainte de capătul imaginii, ca să nu se vadă o tăietură dreaptă
    const ie = iy + ih, ge = ctx.createLinearGradient(0, ie - 110, 0, ie); ge.addColorStop(0, "rgba(0,0,0,0)"); ge.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = ge; ctx.fillRect(0, ie - 110, W, H - ie + 110);
    ctx.globalCompositeOperation = "source-over";
  }
  function loop(now) { draw(now); requestAnimationFrame(loop); }
  addEventListener("resize", layout);
  new ResizeObserver(layout).observe(panel);
  layout();
  frames[0].onload = () => { t0 = performance.now(); };
  t0 = performance.now();
  requestAnimationFrame(loop);
})();
