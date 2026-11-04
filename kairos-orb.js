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

  /* ---------- cerneala: un ciclu întreg, scris → ținut → dizolvat ---------- */
  // un ciclu durează CYCLE secunde; la fiecare ciclu se scrie alt semn
  const CYCLE = 9.5;
  const TAU = Math.PI * 2;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  function drawInk(g, S, t, low) {
    const c = S / 2, R = S * 0.42, r0 = R * 0.63;
    const cyc = low ? 0 : Math.floor(t / CYCLE), p = t - cyc * CYCLE, seed = cyc * 97.13 + 11;
    // logo-urile mici din bare nu dispar: semnul rămâne scris și doar se mișcă
    const dis = low ? 0 : clamp((p - 6.1) / 2.6);          // 0 → 1: se dizolvă în fum
    g.clearRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";
    if (!low && p > 8.9) return { dis: 1, empty: true };
    g.fillStyle = "#2b63f0";
    const dot = (x, y, r) => { if (r > 0.25) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } };

    // intro: cerneala pornește ca o picătură în centru și se deschide spre cerc
    // fiecare bucată ajunge cu o mică întârziere a ei, ca să pară lichid, nu un cerc care crește uniform
    const arrive = (key) => low ? 1 : easeOut(clamp((p - 0.12 * rnd(seed + key)) / (1.9 + 0.5 * rnd(seed + key + 0.5))));
    const swirl = rnd(seed + 9) > 0.5 ? 1 : -1;            // în ce sens se rotește puțin cât se deschide
    const swell = (n) => R * 0.13 * dis * n;               // outro: cerneala se umflă în afară

    // inelul
    const N = low ? 120 : 320;
    for (let i = 0; i < N; i++) {
      const e = arrive(i * 0.731);
      const a = (i / N) * TAU + swirl * (1 - e) * 0.9;
      const ca = Math.cos(a), sa = Math.sin(a);
      const body = fbm(Math.cos((i / N) * TAU) * 1.3 + seed, Math.sin((i / N) * TAU) * 1.3 + seed * 0.7, t * 0.08);
      const gap = fbm(Math.cos((i / N) * TAU) * 0.8 + seed * 1.3, Math.sin((i / N) * TAU) * 0.8 + 3, 0.5);
      let w = R * (0.022 + 0.13 * Math.pow(Math.max(0, body + 0.3), 1.3));
      if (gap < -0.2) w *= Math.max(0, (gap + 0.38) / 0.18);
      w *= 1 + 1.6 * (1 - e);                                // la început petele se suprapun: o pată plină în centru
      const n = fbm(ca * 3 + seed, sa * 3, t * 0.4);
      const target = r0 + R * 0.05 * fbm(ca * 2 + seed, sa * 2 + 2, t * 0.06);
      const rr = target * e + R * 0.04 * (1 - e) * n + swell(n);
      dot(c + ca * rr, c + sa * rr, w * (1 + dis * 0.9));
    }

    // perișorii: cresc din inel abia după ce cerneala a ajuns la el
    const K = low ? 22 : 90;
    for (let k = 0; k < K; k++) {
      const e = arrive(k * 1.37 + 40);
      const sprout = clamp((e - 0.55) / 0.45);
      if (sprout <= 0) continue;
      const a0 = rnd(seed + k * 3.1) * TAU + swirl * (1 - e) * 0.9;
      const out = rnd(seed + k * 5.7) > 0.45 ? 1 : -1;
      const len = R * (0.045 + 0.17 * Math.pow(rnd(seed + k * 7.3), 2)) * sprout * (out > 0 ? 1 : 0.7);
      const curl = (rnd(seed + k * 9.9) - 0.5) * 0.9;
      const w0 = R * (0.016 + 0.028 * rnd(seed + k * 2.2));
      const steps = low ? 6 : 14;
      const base = (r0 + R * 0.05 * fbm(Math.cos(a0) * 2 + seed, Math.sin(a0) * 2 + 2, t * 0.06)) * e;
      for (let j = 1; j <= steps; j++) {
        const f = j / steps;
        const ang = a0 + curl * f * 0.35 + fbm(k * 0.37, f * 2, t * 0.4) * 0.12 * f;
        const rad = base + out * len * f + swell(fbm(k, f, t * 0.4) + 0.4) * f;
        dot(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad, (w0 * Math.pow(1 - f, 1.2) + R * 0.0018) * (1 + dis * 1.2));
      }
    }

    // nuanțe pe lichid: mai deschis sus-stânga, mai adânc jos
    g.globalCompositeOperation = "source-atop";
    const sh = g.createRadialGradient(c - R * 0.35, c - R * 0.45, 0, c, c, R * 1.1);
    sh.addColorStop(0, "#cfe0ff"); sh.addColorStop(0.35, "#6f9bff"); sh.addColorStop(0.7, "#2f66f2"); sh.addColorStop(1, "#1238b8");
    g.fillStyle = sh; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = "source-over";
    return { dis, empty: false, intro: low ? 0 : 1 - easeOut(clamp(p / 2.2)) };
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

    // lichidul albastru: strălucire difuză, apoi miezul; la dizolvare se umflă în fum și se stinge
    const st = drawInk(inkCtx, S, t, low);
    if (!st.empty) {
      const d = st.dis, it = st.intro, sc = 1 + 0.07 * d;
      const soft = S * (0.0045 + 0.016 * it);                // cerneala nu e niciodată tăioasă; în intro e și mai moale
      const put = () => ctx.drawImage(ink, c - c * sc, c - c * sc, S * sc, S * sc);
      if (!low) { ctx.globalAlpha = 0.55 * (1 - d * 0.6); ctx.filter = `blur(${S * (0.035 + 0.06 * d + 0.03 * it)}px)`; put(); }
      ctx.globalAlpha = 0.6 * (1 - d); ctx.filter = `blur(${Math.max(1, S * (0.012 + 0.03 * d) + soft)}px)`; put();
      ctx.globalAlpha = Math.pow(1 - d, 1.6) * (1 - 0.35 * it); ctx.filter = low ? `blur(${Math.max(0.3, S * 0.006)}px)` : `blur(${Math.max(0.6, soft + S * 0.02 * d)}px)`; put();
      ctx.filter = "none"; ctx.globalAlpha = 1;
    }

    // ---- cristalul ----
    const arcBand = (r1, r2, a1, a2) => { ctx.beginPath(); ctx.arc(c, c, r2, a1, a2); ctx.arc(c, c, r1, a2, a1, true); ctx.closePath(); };

    // lumina mediului: sus puțin mai rece, jos o urmă de albastru
    g = ctx.createLinearGradient(0, c - R, 0, c + R);
    g.addColorStop(0, "rgba(220,232,255,.07)"); g.addColorStop(0.45, "rgba(220,232,255,0)"); g.addColorStop(1, "rgba(110,150,255,.1)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);

    // lumina focalizată jos, înăuntru (caustica unui glob de cristal)
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    ctx.translate(c, c + R * 0.74); ctx.scale(1, 0.32);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.62);
    g.addColorStop(0, "rgba(170,200,255,.42)"); g.addColorStop(0.5, "rgba(110,150,255,.16)"); g.addColorStop(1, "rgba(110,150,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.fill();
    ctx.restore();

    // grosimea sticlei: margine luminoasă spre exterior, o bandă mai întunecată imediat în interior
    g = ctx.createRadialGradient(c, c, R * 0.68, c, c, R);
    g.addColorStop(0, "rgba(200,220,255,0)"); g.addColorStop(0.82, "rgba(200,220,255,.05)"); g.addColorStop(0.93, "rgba(4,10,30,.22)"); g.addColorStop(0.975, "rgba(225,236,255,.22)"); g.addColorStop(1, "rgba(240,246,255,.5)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);

    // reflexia mare, curbă, ca o fereastră în sticlă
    g = ctx.createLinearGradient(c - R * 0.8, c - R * 0.8, c - R * 0.1, c - R * 0.1);
    g.addColorStop(0, "rgba(255,255,255,.42)"); g.addColorStop(0.55, "rgba(255,255,255,.1)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.filter = `blur(${Math.max(0.5, S * 0.007)}px)`;
    ctx.fillStyle = g; arcBand(R * 0.73, R * 0.9, Math.PI * 1.08, Math.PI * 1.42); ctx.fill();
    // un al doilea panou, mai subțire, lângă ea
    ctx.fillStyle = "rgba(255,255,255,.1)"; arcBand(R * 0.66, R * 0.7, Math.PI * 1.12, Math.PI * 1.36); ctx.fill();
    ctx.filter = "none";
    // punctul de lumină
    ctx.save(); ctx.translate(c - R * 0.42, c - R * 0.52); ctx.rotate(-0.7);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.13);
    g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.4, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.scale(1, 0.5); ctx.beginPath(); ctx.arc(0, 0, R * 0.13, 0, TAU); ctx.fill();
    ctx.restore();
    // reflexia mică, opusă, jos-dreapta
    ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, R * 0.03);
    g = ctx.createLinearGradient(c + R * 0.9, c, c, c + R * 0.9);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.32)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(c, c, R * 0.86, Math.PI * 0.08, Math.PI * 0.42); ctx.stroke();
    ctx.restore();

    // irizarea marginii: cyan sus-stânga, violet jos-dreapta
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = Math.max(0.75, S * 0.004);
    ctx.strokeStyle = "rgba(120,220,255,.35)"; ctx.beginPath(); ctx.arc(c - S * 0.002, c - S * 0.002, R - ctx.lineWidth, Math.PI * 0.85, Math.PI * 1.75); ctx.stroke();
    ctx.strokeStyle = "rgba(170,130,255,.3)"; ctx.beginPath(); ctx.arc(c + S * 0.002, c + S * 0.002, R - ctx.lineWidth, Math.PI * -0.15, Math.PI * 0.75); ctx.stroke();
    ctx.restore();

    // marginea sferei
    ctx.lineWidth = Math.max(0.75, S * 0.004);
    ctx.strokeStyle = "rgba(225,236,255,.55)";
    ctx.beginPath(); ctx.arc(c, c, R - ctx.lineWidth / 2, 0, TAU); ctx.stroke();

    // lumina pe care globul o aruncă dedesubt
    if (!low) {
      ctx.save(); ctx.translate(c, c + R + S * 0.035); ctx.scale(1, 0.18);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.7);
      g.addColorStop(0, "rgba(120,160,255,.35)"); g.addColorStop(1, "rgba(120,160,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.fill();
      ctx.restore();
    }
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
      seed: el.dataset.seed != null ? Number(el.dataset.seed) : (el.dataset.detail === "low" ? 3.5 : 0), t0: performance.now() };
    el.__orb = o; orbs.push(o); size(o);
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => es.forEach((e) => { o.visible = e.isIntersecting; })).observe(el);
    drawOrb(o, reduce ? 4 : o.seed);
  }
  function loop(ts) {
    if (!document.hidden) {
      for (const o of orbs) {
        if (!o.visible) continue;
        const fps = o.low ? 24 : 60;
        if (ts - o.last < 1000 / fps - 2) continue;
        o.last = ts;
        drawOrb(o, (ts - o.t0) / 1000 + o.seed);
      }
    }
    requestAnimationFrame(loop);
  }
  function start() {
    document.querySelectorAll("canvas[data-kairos-orb]").forEach(init);
    if (!reduce) requestAnimationFrame(loop);
  }
  window.addEventListener("resize", () => orbs.forEach((o) => { size(o); drawOrb(o, reduce ? 4 : (performance.now() - o.t0) / 1000 + o.seed); }));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.KairosOrb = { init: (el) => { init(el); } };
})();
