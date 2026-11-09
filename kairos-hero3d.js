/* KAIROS · sfera de blană din login, randată în Blender (Cycles).
   Blana e o singură imagine care se rotește foarte încet; clepsidra e o secvență de 24 de cadre randate,
   în care cerneala se scurge în 10 s, apoi clepsidra se întoarce și o ia de la capăt. */
(() => {
  "use strict";
  const box = document.querySelector(".orb3d");
  const cv = document.getElementById("hgc");
  if (!box || !cv) return;
  const ctx = cv.getContext("2d");
  const N = 24, DRAIN = 10, FLIP = 1.1;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frames = Array.from({ length: N }, (_, i) => { const im = new Image(); im.decoding = "async"; im.src = `hero/hg_${String(i).padStart(2, "0")}.webp`; return im; });
  function size() { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  addEventListener("resize", size); size();
  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function draw(t) {
    const c = Math.max(0, t) % (DRAIN + FLIP);
    let idx, rot = 0;
    if (c < DRAIN) idx = Math.min(N - 1, Math.floor(c / DRAIN * N));
    else { idx = N - 1; rot = Math.PI * ease((c - DRAIN) / FLIP); }
    const im = frames[idx];
    if (!im.complete || !im.naturalWidth) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.translate(cv.width / 2, cv.height / 2); ctx.rotate(rot);
    ctx.drawImage(im, -cv.width / 2, -cv.height / 2, cv.width, cv.height);
  }
  // mouse-ul înclină ușor tot globul
  let tx = 0, ty = 0, x = 0, y = 0;
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
  const t0 = performance.now();
  function loop(now) {
    x += (tx - x) * .04; y += (ty - y) * .04;
    box.style.setProperty("--mx", x.toFixed(3)); box.style.setProperty("--my", y.toFixed(3));
    draw((now - t0) / 1000);
    if (!reduce) requestAnimationFrame(loop);
  }
  if (reduce) frames[N - 1].onload = () => draw(DRAIN - .01);
  requestAnimationFrame(loop);
})();
