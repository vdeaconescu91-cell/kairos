/* KAIROS · floarea din login: 32 de cadre randate în Blender (o floare care înflorește),
   redate printr-un filtru „ASCII”: peste imagine se desenează puncte, cercuri, triunghiuri și pătrate
   după luminozitatea fiecărei celule, cu o ușoară separare de culori. Înflorește o dată la intrare,
   apoi rămâne deschisă și sclipește. Partea din floare care iese sub card se vede stinsă, fără glife. */
(() => {
  "use strict";
  const cv = document.getElementById("flower"), panel = document.getElementById("aRight"), stage = document.querySelector(".login");
  if (!cv || !panel || !stage) return;
  const ctx = cv.getContext("2d");
  const N = 32, BLOOM = 3.6, DELAY = .35, CELL = 4, Q = CELL / 8;   // glifele la jumătate față de prima versiune
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
    // imaginea de bază, cu o separare de culori discretă
    // cadrele au deja fundalul transparent (negrul randării a fost transformat în alfa)
    const iw = H * (520 / 720), ix = (W - iw) / 2;                    // imaginea ocupă toată înălțimea, centrată
    ctx.globalAlpha = .5; ctx.drawImage(im, ix, 0, iw, H);
    ctx.globalAlpha = .14; ctx.drawImage(im, ix + 2.5, 0, iw, H); ctx.drawImage(im, ix - 2.5, 1, iw, H);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    // glifele, doar în interiorul cardului
    sx.clearRect(0, 0, cols, rows); sx.drawImage(im, ix / CELL, 0, iw / CELL, rows);
    const d = sx.getImageData(0, 0, cols, rows).data;
    const r0 = Math.ceil(top / CELL), r1 = Math.min(rows, Math.floor((top + ph) / CELL));   // glifele doar în interiorul casetei
    const seed = Math.floor(now / 90);
    for (let y = r0; y < r1; y++) {
      for (let x = 0; x < cols; x++) {
        const o = (y * cols + x) * 4, r = d[o], g = d[o + 1], b = d[o + 2];
        const L = (r * .3 + g * .55 + b * .15) / 255;
        if (L < .2) continue;
        const h = ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
        if ((h % 100) < 18) continue;                                  // sclipire: unele celule lipsesc în fiecare cadru
        const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
        const lift = Math.min(1, L * 1.7);
        const tint = (h >> 4) % 10;                                       // irizare: câteva celule bat în cyan sau liliachiu
        ctx.fillStyle = tint === 0 ? `rgba(130,235,255,${.55 + L * .45})` : tint === 1 ? `rgba(205,160,255,${.55 + L * .45})`
          : `rgb(${Math.round(r + (255 - r) * lift * .8)},${Math.round(g + (255 - g) * lift * .75)},${Math.round(b + (255 - b) * lift * .6)})`;
        ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .75;
        const kind = L < .32 ? 0 : L < .46 ? 1 : L < .6 ? 2 : L < .74 ? 3 : 4;
        const pick = (h >> 8) % 7 === 0 ? (kind + 1) % 5 : kind;        // câteva glife „greșite”, ca în ASCII-ul adevărat
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
