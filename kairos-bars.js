/* KAIROS · barele din panoul de login: fiecare bară e un moment din rundown (lungimea = durata).
   Momentul curent se umple cu lumină de la capătul din față spre spate, apoi trece la următorul.
   Desen 2D în proiecție oblică, fără WebGL. */
(() => {
  "use strict";
  const cv = document.getElementById("bars");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // un rundown de exemplu (minute)
  const SEG = [
    ["Starting Soon", 15], ["Opening", 7], ["The cause", 10], ["Partner moment", 4], ["Format", 4],
    ["Group draw", 16], ["Block 1 · Group A", 31], ["Block 2 · Group C", 31], ["Block 3 · Group B", 31], ["Semifinals", 28]
  ];
  const STEP = 7.5;                                        // secunde de animație pe moment
  let W = 0, H = 0;
  function resize() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // proiecția: x de-a lungul barei (spre stânga sus), y peste bare (spre dreapta sus), z în sus
  function P(x, y, z, k, ox, oy) {
    return [ox + (-0.84 * x + 0.66 * y) * k, oy + (-0.47 * x - 0.30 * y - z) * k];
  }
  function quad(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const k = Math.min(W, H) / 9.5;
    const ox = W * .66, oy = H * .74;
    const n = SEG.length;
    const cur = Math.floor(t / STEP) % n, f = (t % STEP) / STEP;
    const bw = .92, gap = .34;
    // de la cea mai îndepărtată la cea mai apropiată
    for (let i = n - 1; i >= 0; i--) {
      const y0 = (i - 3) * (bw + gap), y1 = y0 + bw;
      const x0 = -i * .55 + 1.4;                           // capetele din față formează o diagonală
      const L = 2.2 + SEG[i][1] * .32;
      const z = .55 + ((i * 37) % 5) * .16;                 // înălțimi ușor diferite, ca o scară
      const base = i === cur ? [34, 62, 170] : i < cur ? [24, 44, 120] : [16, 28, 80];
      const top = mix(base, [120, 160, 255], .22), side = mix(base, [0, 0, 0], .35), end = mix(base, [190, 210, 255], .16);
      const A = (x, y, zz) => P(x, y, zz, k, ox, oy);
      quad([A(x0, y0, 0), A(x0 + L, y0, 0), A(x0 + L, y0, z), A(x0, y0, z)], rgb(side));      // latura vizibilă
      quad([A(x0, y0, z), A(x0 + L, y0, z), A(x0 + L, y1, z), A(x0, y1, z)], rgb(top));       // fața de sus
      quad([A(x0, y0, 0), A(x0, y1, 0), A(x0, y1, z), A(x0, y0, z)], rgb(end));              // capătul din față
      if (i === cur) {
        // lumina care umple momentul curent, de la capătul din față spre spate
        const e = 1 - Math.pow(1 - f, 2), Lf = Math.max(.02, L * e);
        ctx.save();
        ctx.shadowColor = "rgba(120,170,255,.95)"; ctx.shadowBlur = 38;
        const gTop = ctx.createLinearGradient(...A(x0, y0, z), ...A(x0 + Lf, y0, z));
        gTop.addColorStop(0, "rgba(235,242,255,1)"); gTop.addColorStop(.55, "rgba(140,180,255,.95)"); gTop.addColorStop(1, "rgba(61,123,255,.0)");
        quad([A(x0, y0, z), A(x0 + Lf, y0, z), A(x0 + Lf, y1, z), A(x0, y1, z)], gTop);
        const gSide = ctx.createLinearGradient(...A(x0, y0, z), ...A(x0 + Lf, y0, z));
        gSide.addColorStop(0, "rgba(190,212,255,1)"); gSide.addColorStop(.6, "rgba(80,130,255,.85)"); gSide.addColorStop(1, "rgba(61,123,255,0)");
        quad([A(x0, y0, 0), A(x0 + Lf, y0, 0), A(x0 + Lf, y0, z), A(x0, y0, z)], gSide);
        quad([A(x0, y0, 0), A(x0, y1, 0), A(x0, y1, z), A(x0, y0, z)], "rgba(225,236,255,1)");
        ctx.restore();
        // playhead-ul: o linie verticală la frontul luminii
        const [hx, hy] = A(x0 + Lf, y1, z), [lx, ly] = A(x0 + Lf, y0, 0);
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx, hy - k * .35); ctx.lineTo(lx, ly); ctx.stroke();
      }
    }
    // umbrire spre colțul din spate, ca barele să se piardă în întuneric
    const g = ctx.createLinearGradient(W, H, 0, 0);
    g.addColorStop(0, "rgba(4,7,20,0)"); g.addColorStop(.7, "rgba(4,7,20,.35)"); g.addColorStop(1, "rgba(4,7,20,.85)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // textele din panou
    const secs = Math.round((1 - f) * SEG[cur][1] * 60);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
    window.dispatchEvent(new CustomEvent("kairos-bars", { detail: { now: SEG[cur][0], next: SEG[(cur + 1) % n][0], left: `${mm}:${ss}`, idx: cur } }));
  }
  let t0 = performance.now();
  function loop(now) { draw((now - t0) / 1000 + 2.5); if (!reduce) requestAnimationFrame(loop); }
  addEventListener("resize", () => { resize(); if (reduce) draw(5); });
  resize();
  requestAnimationFrame(loop);
})();
