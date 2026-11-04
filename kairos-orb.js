/* KAIROS · semnul animat: o sferă de sticlă cu cerneală care se mișcă înăuntru.
   Orice <canvas data-kairos-orb> devine o sferă; data-detail="low" pentru variantele mici (bara de sus). */
(() => {
  "use strict";

  /* ---------- zgomot 3D (value noise neted) ---------- */
  const perm = new Uint8Array(512);
  (() => { const p = []; let s = 1337; for (let i = 0; i < 256; i++) p.push(i);
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const h = (x, y, z) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 127.5 - 1;
  function noise(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const fx = x - X, fy = y - Y, fz = z - Z, u = fade(fx), v = fade(fy), w = fade(fz);
    return lerp(
      lerp(lerp(h(X, Y, Z), h(X + 1, Y, Z), u), lerp(h(X, Y + 1, Z), h(X + 1, Y + 1, Z), u), v),
      lerp(lerp(h(X, Y, Z + 1), h(X + 1, Y, Z + 1), u), lerp(h(X, Y + 1, Z + 1), h(X + 1, Y + 1, Z + 1), u), v), w);
  }
  const fbm = (x, y, z) => noise(x, y, z) * 0.6 + noise(x * 2.1, y * 2.1, z * 1.7) * 0.3 + noise(x * 4.3, y * 4.3, z * 2.9) * 0.1;
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /* ---------- cerneala: un inel care se rupe, se îngroașă și scoate fire ---------- */
  function drawInk(g, S, t, low) {
    const c = S / 2, R = S * 0.42, r0 = R * 0.6;
    g.clearRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#2b63f0";
    const dot = (x, y, r) => { if (r > 0.25) { g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); } };

    // inelul
    const N = low ? 120 : 300;
    const ring = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + t * 0.03, ca = Math.cos(a), sa = Math.sin(a);
      const body = fbm(ca * 1.3 + 3, sa * 1.3 + 7, t * 0.18);
      const gap = fbm(ca * 0.8 + 11, sa * 0.8 + 5, t * 0.07);
      let w = R * (0.022 + 0.07 * Math.max(0, body + 0.35));
      if (gap < -0.3) w *= Math.max(0, (gap + 0.46) / 0.16);
      const rr = r0 + R * 0.06 * fbm(ca * 2 + 1, sa * 2 + 2, t * 0.12);
      ring.push({ ca, sa, rr, w });
      dot(c + ca * rr, c + sa * rr, w);
    }

    // fire de cerneală care pleacă din inel, spre afară sau spre centru
    const K = low ? 8 : 30;
    for (let k = 0; k < K; k++) {
      const s = fbm(k * 1.7, 3.1, t * 0.22) + 0.15;
      if (s < 0.08) continue;
      const base = ring[Math.floor(rnd(k) * N) % N];
      if (base.w < R * 0.01) continue;
      const out = rnd(k + 50) > 0.45 ? 1 : -1;
      const L = R * (0.08 + 0.5 * s) * (out > 0 ? 1 : 0.7);
      const steps = low ? 10 : 48;
      const a0 = Math.atan2(base.sa, base.ca);
      for (let j = 1; j <= steps; j++) {
        const f = j / steps;
        const ang = a0 + fbm(k * 0.31, f * 1.6, t * 0.3) * 0.55 * f;
        const rad = base.rr + out * L * f;
        dot(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad, base.w * 0.85 * Math.pow(1 - f, 1.3) + R * 0.002);
      }
    }

    // stropi mici, care apar și dispar
    if (!low) {
      for (let m = 0; m < 46; m++) {
        const vis = fbm(m * 0.9, 7.7, t * 0.25);
        if (vis < 0.12) continue;
        const a = rnd(m + 100) * Math.PI * 2 + t * 0.03;
        const d = r0 + (rnd(m + 200) - 0.5) * R * 0.62;
        dot(c + Math.cos(a) * d, c + Math.sin(a) * d, R * 0.004 + R * 0.018 * (vis - 0.12) * rnd(m + 300) * 3);
      }
    }

    // nuanțe pe lichid: mai deschis sus-stânga, mai adânc jos, ca un lichid luminat
    g.globalCompositeOperation = "source-atop";
    const sh = g.createRadialGradient(c - R * 0.35, c - R * 0.45, 0, c, c, R * 1.1);
    sh.addColorStop(0, "#cfe0ff"); sh.addColorStop(0.35, "#6f9bff"); sh.addColorStop(0.7, "#2f66f2"); sh.addColorStop(1, "#1238b8");
    g.fillStyle = sh; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";
  }

  /* ---------- sfera ---------- */
  function drawOrb(o, t) {
    const { ctx, ink, inkCtx, S, low } = o;
    const c = S / 2, R = S * 0.42;
    ctx.clearRect(0, 0, S, S);

    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, R, 0, 6.2832); ctx.clip();

    // sticla e transparentă: doar o urmă de volum pe margine (fresnel)
    let g = ctx.createRadialGradient(c, c, R * 0.55, c, c, R);
    g.addColorStop(0, "rgba(200,220,255,0)"); g.addColorStop(0.8, "rgba(200,220,255,.04)"); g.addColorStop(1, "rgba(200,220,255,.16)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);

    // lichidul albastru: o strălucire difuză în jur și miezul dens
    drawInk(inkCtx, S, t, low);
    if (!low) { ctx.globalAlpha = 0.55; ctx.filter = `blur(${S * 0.035}px)`; ctx.drawImage(ink, 0, 0); }
    ctx.globalAlpha = 0.6; ctx.filter = `blur(${Math.max(1, S * 0.012)}px)`; ctx.drawImage(ink, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = low ? "none" : `blur(${Math.max(0.4, S * 0.0016)}px)`; ctx.drawImage(ink, 0, 0);
    ctx.filter = "none";

    // reflexii pe sticlă
    g = ctx.createRadialGradient(c - R * 0.38, c - R * 0.48, 0, c - R * 0.38, c - R * 0.48, R * 0.5);
    g.addColorStop(0, "rgba(255,255,255,.22)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    ctx.save(); ctx.translate(c - R * 0.34, c - R * 0.56); ctx.rotate(-0.55);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.2);
    g.addColorStop(0, "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.scale(1, 0.42); ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, 6.2832); ctx.fill();
    ctx.restore();
    // o lumină subțire jos, prinsă în sticlă
    ctx.lineWidth = Math.max(1, R * 0.018); ctx.lineCap = "round";
    g = ctx.createLinearGradient(c - R, 0, c + R, 0);
    g.addColorStop(0, "rgba(214,228,255,0)"); g.addColorStop(0.5, "rgba(214,228,255,.3)"); g.addColorStop(1, "rgba(214,228,255,0)");
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(c, c, R * 0.93, Math.PI * 0.22, Math.PI * 0.78); ctx.stroke();
    ctx.restore();

    // marginea sferei
    ctx.lineWidth = Math.max(0.75, S * 0.005);
    ctx.strokeStyle = "rgba(214,228,255,.42)";
    ctx.beginPath(); ctx.arc(c, c, R - ctx.lineWidth / 2, 0, 6.2832); ctx.stroke();
  }

  /* ---------- pornire ---------- */
  const orbs = [];
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size(o) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const css = o.el.clientWidth || Number(o.el.getAttribute("width")) || 32;
    const S = Math.max(16, Math.round(css * dpr));
    if (S === o.S) return;
    o.S = S; o.el.width = S; o.el.height = S; o.ink.width = S; o.ink.height = S;
    o.low = o.el.dataset.detail === "low" || css < 80;
  }
  function init(el) {
    if (el.__orb) return;
    const ink = document.createElement("canvas");
    const o = { el, ctx: el.getContext("2d"), ink, inkCtx: ink.getContext("2d"), S: 0, low: false, visible: true, last: 0,
      seed: Number(el.dataset.seed || 0) };
    el.__orb = o; orbs.push(o); size(o);
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => { o.visible = e.isIntersecting; })).observe(el);
    drawOrb(o, 4 + o.seed);
  }
  function loop(ts) {
    if (!document.hidden) {
      for (const o of orbs) {
        if (!o.visible) continue;
        const fps = o.low ? 24 : 60;
        if (ts - o.last < 1000 / fps - 2) continue;
        o.last = ts;
        drawOrb(o, ts / 1000 + 4 + o.seed);
      }
    }
    requestAnimationFrame(loop);
  }
  function start() {
    document.querySelectorAll("canvas[data-kairos-orb]").forEach(init);
    if (!reduce) requestAnimationFrame(loop);
  }
  window.addEventListener("resize", () => orbs.forEach((o) => { size(o); drawOrb(o, performance.now() / 1000 + 4 + o.seed); }));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KairosOrb = { init: (el) => { init(el); } };
})();
