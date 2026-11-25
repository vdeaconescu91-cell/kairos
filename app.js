/* TA Rundown · aplicație de run-of-show fără build.
   Starea se ține în localStorage; tab-urile deschise în același browser se sincronizează între ele. */
(() => {
  "use strict";

  // limba interfeței: textele de mai jos trec prin T(); conținutul rundown-ului rămâne neatins
  const T = (s, v) => (window.KI18N ? window.KI18N.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const KS0 = window.KSYNC;
  const LEGACY = !KS0 || KS0.isLegacy;
  // fiecare rundown își are copia lui locală; cel vechi (ta-2026) păstrează cheia de la început
  const STORE_KEY = LEGACY ? "ta-rundown-v1" : `ta-rundown-v1:${KS0.showId}`;
  const CATS = {
    live:      { label: T("Live match"), var: "--c-live" },
    interviu:  { label: T("Interview"),  var: "--c-interviu" },
    grafica:   { label: T("Graphics"),   var: "--c-grafica" },
    platforma: { label: T("Platform"),   var: "--c-platforma" },
    caritabil: { label: T("Charity"),    var: "--c-caritabil" },
    ing:       { label: "ING",         var: "--c-ing" },
    donatii:   { label: T("Donations"),  var: "--c-donatii" },
    giveaway:  { label: T("Giveaway"),    var: "--c-giveaway" },
    pauza:     { label: T("Break / buffer"), var: "--c-pauza" }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // iconițe desenate, aceeași grosime peste tot (în loc de caractere Unicode)
  const svg = (d, extra = "") => `<svg class="ic" viewBox="0 0 16 16" aria-hidden="true" ${extra}>${d}</svg>`;
  const IC = {
    grip: svg(`<g fill="currentColor"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></g>`),
    cmt: svg(`<path d="M3 3.5h10a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 11.5H8l-3.2 2.4v-2.4H3A1.5 1.5 0 0 1 1.5 10V5A1.5 1.5 0 0 1 3 3.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`),
    jump: svg(`<path d="M5 3.5v9l7-4.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`),
    add: svg(`<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),
    dup: svg(`<rect x="5.5" y="5.5" width="8" height="8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 10.5h-.3A1.2 1.2 0 0 1 2 9.3V3.2A1.2 1.2 0 0 1 3.2 2h6.1a1.2 1.2 0 0 1 1.2 1.2v.3" fill="none" stroke="currentColor" stroke-width="1.4"/>`),
    del: svg(`<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`),
    prev: svg(`<path d="M10.5 3.5 6 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    next: svg(`<path d="M5.5 3.5 10 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    stop: svg(`<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>`),
    menu: svg(`<g fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></g>`)
  };

  /* ---------------- sincronizare (sync.js) ---------------- */
  const S = window.KSYNC || null;
  const cloud = () => !!(S && S.user);
  const canEdit = () => !S || S.canEdit();
  const nowMs = () => (S ? S.now() : Date.now());
  // câmpuri editate local, care încă n-au ajuns înapoi de la server: nu le suprascriem cu o versiune mai veche
  const localDirty = new Map();
  function pushItems() { if (cloud()) S.items(state.show, state.items); }
  function pushLive() {
    if (!cloud()) return;
    const cur = segs()[state.live.idx];
    S.live({ mode: state.mode, advance: state.advance || "manual", running: !!state.live.running, idx: state.live.idx,
      curId: cur ? cur.id : null, itemStart: state.live.itemStart || 0, showStart: state.live.showStart || 0,
      ended: !!state.live.ended, endedAt: state.live.endedAt || 0 });
  }

  /* ---------------- stare ---------------- */
  let state = load();
  let hiddenCats = new Set();
  let undoStack = [];
  let popupWin = null;
  // ?screen=1: pagina arată doar pop-up-ul, pe tot ecranul (pentru monitor, TV sau browser source în OBS/vMix)
  const SCREEN = new URLSearchParams(location.search).has("screen");

  function fromDefault() {
    const d = clone(window.TA_DEFAULT_RUNDOWN);
    d.items = d.items.map((it) => ({ id: uid(), type: it.type || "segment", title: "", min: 5, cat: "platforma",
      video: "", gfx: "", talk: "", who: "", ...it }));
    d.mode = "plan"; d.advance = "manual";
    d.live = { running: false, idx: -1, itemStart: 0, showStart: 0 };
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.items)) {
          s.live = s.live || { running: false, idx: -1, itemStart: 0, showStart: 0 };
          s.mode = s.mode || "plan";
          s.items.forEach((it) => { if (!it.id) it.id = uid(); });
          return s;
        }
      }
    } catch (e) { /* stocare indisponibilă */ }
    if (!LEGACY) {   // un rundown nou vine din cloud; până atunci pagina e goală
      return { show: { title: T("Loading…"), date: "", start: "18:00", venue: "" }, items: [], mode: "plan", advance: "manual",
        live: { running: false, idx: -1, itemStart: 0, showStart: 0 } };
    }
    return fromDefault();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignor */ }
  }

  function snapshot() {
    undoStack.push(JSON.stringify(state.items));
    if (undoStack.length > 60) undoStack.shift();
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) return toast(T("Nothing to undo"));
    state.items = JSON.parse(prev);
    save(); pushItems(); renderTable(); tick();
    toast(T("Undone"));
  }

  // alt tab din același browser a schimbat ceva
  window.addEventListener("storage", (e) => {
    if (e.key !== STORE_KEY || !e.newValue) return;
    try {
      state = JSON.parse(e.newValue);
      if (!document.activeElement || !document.activeElement.classList.contains("cell")) renderTable();
      renderMode(); tick();
    } catch (err) { /* ignor */ }
  });

  /* ---------------- timp ---------------- */
  const segs = () => state.items.filter((i) => i.type !== "header");
  const segIndex = (id) => segs().findIndex((s) => s.id === id);

  function plannedOffsets() {
    // minute de la începutul show-ului, pe fiecare segment
    let t = 0; const out = {};
    for (const it of state.items) {
      if (it.type === "header") continue;
      out[it.id] = t;
      t += Number(it.min) || 0;
    }
    out.__total = t;
    return out;
  }

  function showStartDate() {
    const [y, m, d] = (state.show.date || "2026-11-15").split("-").map(Number);
    const [hh, mm] = (state.show.start || "15:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }

  const pad = (n) => String(n).padStart(2, "0");
  function hhmm(totalMin) {
    const base = showStartDate();
    const d = new Date(base.getTime() + totalMin * 60000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDur(ms, withSign = false) {
    const neg = ms < 0; let s = Math.floor(Math.abs(ms) / 1000);
    const days = Math.floor(s / 86400); s -= days * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    let body = h || days ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    if (days) body = `${days}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    return (neg ? "−" : withSign ? "+" : "") + body;
  }

  // ce segment e acum: în Live după butoane, în Plan după ceas
  function position(now = nowMs()) {
    const list = segs(); const off = plannedOffsets();
    if (!list.length) return { cur: null, next: null, list, off };

    if (state.mode === "live" && state.live.ended) {
      return { mode: "post", ended: true, list, off, idx: list.length, cur: null, next: null, after: null };
    }
    if (state.mode === "live" && state.live.running) {
      const idx = Math.min(Math.max(state.live.idx, 0), list.length - 1);
      const cur = list[idx];
      const elapsed = now - state.live.itemStart;
      const durMs = (Number(cur.min) || 0) * 60000;
      // întârzierea se măsoară față de ora din program (14:45 + offset) când show-ul rulează în ziua lui,
      // altfel (repetiție în altă zi) față de momentul în care s-a apăsat Start show
      const sched = showStartDate().getTime() + off[cur.id] * 60000;
      const vsSchedule = Math.abs(state.live.itemStart - sched) < 6 * 3600000;
      const base = vsSchedule ? state.live.itemStart - sched : (state.live.itemStart - state.live.showStart) - off[cur.id] * 60000;
      // depășirea segmentului curent se adaugă la întârziere, ca statusul să nu spună „la timp” cu timerul pe minus
      const drift = base + Math.max(0, elapsed - durMs);
      return { mode: "live", list, off, idx, cur, next: list[idx + 1] || null, after: list[idx + 2] || null,
        remain: durMs - elapsed, elapsed, durMs, drift, vsSchedule, nextInMs: durMs - elapsed };
    }

    const start = showStartDate().getTime();
    const mins = (now - start) / 60000;
    if (mins < 0) {
      return { mode: "pre", list, off, idx: -1, cur: null, next: list[0], after: list[1] || null, nextInMs: start - now };
    }
    if (mins >= off.__total) {
      return { mode: "post", list, off, idx: list.length, cur: null, next: null, after: null };
    }
    let idx = list.findIndex((s, i) => mins >= off[s.id] && (i === list.length - 1 || mins < off[list[i + 1].id]));
    if (idx < 0) idx = 0;
    const cur = list[idx];
    const durMs = (Number(cur.min) || 0) * 60000;
    const elapsed = (mins - off[cur.id]) * 60000;
    return { mode: "plan", list, off, idx, cur, next: list[idx + 1] || null, after: list[idx + 2] || null,
      remain: durMs - elapsed, elapsed, durMs, drift: null, nextInMs: durMs - elapsed };
  }

  /* ---------------- timeline: tot show-ul pe o bară, un bloc pe fiecare secțiune (nu pe fiecare segment), ca să se citească dintr-o privire ---------------- */
  let tlSecs = [];
  // categoriile cu culori neutre (alb/gri) nu se văd ca umplere: pe timeline primesc albastrul-gheață KAIROS
  const TL_NEUTRAL = new Set(["platforma", "pauza"]);
  function renderTimeline() {
    const off = plannedOffsets(), total = off.__total || 1;
    tlSecs = []; let g = null;
    for (const it of state.items) {
      if (it.type === "header") { g = { id: it.id, title: (it.title || "").split("·")[0].trim(), segs: [] }; tlSecs.push(g); continue; }
      if (!g) { g = { id: null, title: T("Show"), segs: [] }; tlSecs.push(g); }
      g.segs.push(it);
    }
    tlSecs = tlSecs.filter((x) => x.segs.length);
    // o secțiune în care toate segmentele au un prefix comun repetat („Bloc 1 · …”, „Bloc 2 · …”) se împarte pe acele prefixe
    tlSecs = tlSecs.flatMap((x) => {
      const pre = (s) => ((s.title || "").split("·")[0] || "").trim();
      const count = {}; x.segs.forEach((s) => { const p = pre(s); count[p] = (count[p] || 0) + 1; });
      const keys = Object.keys(count);
      if (keys.length < 2 || keys.some((k) => !k || count[k] < 2)) return [x];
      const parts = [];
      for (const s of x.segs) { const p = pre(s); const last = parts[parts.length - 1]; if (last && last.title === p) last.segs.push(s); else parts.push({ id: s.id, title: p, section: x.title, segs: [s] }); }
      // eticheta, în limbaj de producție: Match Window 1…N (MWn); ce se joacă rămâne în tooltip
      parts.forEach((pt, n) => {
        const live = pt.segs.find((s) => s.cat === "live") || pt.segs[Math.floor(pt.segs.length / 2)];
        const mid = (live.title || "").split("·").map((t) => t.trim()).filter((t) => t && t !== pt.title && !/^live$/i.test(t))[0];
        pt.block = T("Match Window {n}", { n: n + 1 }) + (mid ? ` · ${mid}` : "");
        pt.title = `MW${n + 1}` + (/decid/i.test(mid || "") ? " · " + T("Decider") : ""); pt.keep = true;
      });
      return parts;
    });
    for (const x of tlSecs) {
      x.from = off[x.segs[0].id]; x.dur = x.segs.reduce((a, s) => a + (Number(s.min) || 0), 0);
      // culoarea blocului = categoria care ocupă cele mai multe minute din secțiune
      const by = {}; x.segs.forEach((s) => { by[s.cat] = (by[s.cat] || 0) + (Number(s.min) || 0); });
      x.cat = Object.entries(by).sort((a, b) => b[1] - a[1])[0][0];
    }
    const pct = (m) => (m / total) * 100;
    $("#tlBlocks").innerHTML = tlSecs.map((x, k) =>
      `<button type="button" class="tl-sec" data-k="${k}" style="${TL_NEUTRAL.has(x.cat) ? "--cc:#8b6cff" : catStyle(x.cat)};left:${pct(x.from)}%;width:${pct(x.dur)}%" title="${esc(`${x.section ? x.section + " · " : ""}${x.block || x.title} · ${hhmm(x.from)}–${hhmm(x.from + x.dur)} · ${T("{n} segments", { n: x.segs.length })}`)}"><span class="tl-fill"></span><canvas class="tl-cv" aria-hidden="true"></canvas><span class="tl-name">${esc(!x.keep && x.title === x.title.toUpperCase() ? x.title.charAt(0) + x.title.slice(1).toLowerCase() : x.title)}</span></button>`).join("");
    const start = showStartDate();
    let ticks = "";
    for (let m = start.getMinutes() ? 60 - start.getMinutes() : 0; m <= total; m += 60) ticks += `<span style="left:${pct(m)}%">${hhmm(m)}</span>`;
    $("#tlTicks").innerHTML = ticks;
    $("#tlStart").textContent = hhmm(0); $("#tlEnd").textContent = hhmm(total);
    $("#tlSum").textContent = T("Show · {h}h {m}m · {n} segments", { h: Math.floor(total / 60), m: pad(total % 60), n: segs().length });
  }
  function tickTimeline(pos) {
    const off = pos.off || plannedOffsets(), total = off.__total || 1;
    let m = null;
    if (pos.cur) m = off[pos.cur.id] + Math.max(0, Math.min(pos.elapsed || 0, pos.durMs || 0)) / 60000;
    else if (pos.mode === "post") m = total;
    // fără linie: secțiunea curentă se umple (ca o lampă cu lavă) cât s-a parcurs din ea; cele terminate rămân pline
    $$("#tlBlocks .tl-sec").forEach((b) => {
      const x = tlSecs[+b.dataset.k]; if (!x) return;
      const p = m == null ? 0 : Math.min(1, Math.max(0, (m - x.from) / (x.dur || 1)));
      b.classList.toggle("cur", m != null && m >= x.from && m < x.from + x.dur); b.classList.toggle("done", p >= 1);
      b.style.setProperty("--p", `${(p * 100).toFixed(2)}%`);
    });
    kickSlosh();
  }
  // secțiunea curentă: lichid care „se clatină” (slosh) — corp închis la culoare, front luminos și curbat care se leagănă
  const tlReduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // bucla rulează doar cât există o secțiune curentă, tab-ul se vede și mișcarea nu e redusă; altfel desenează o dată și se oprește
  let sloshRaf = 0;
  function kickSlosh() { if (!sloshRaf) sloshRaf = requestAnimationFrame(drawSlosh); }
  function drawSlosh(now) {
    sloshRaf = 0;
    const b = $("#tlBlocks .tl-sec.cur"); if (!b) return;
    if (!tlReduce && !document.hidden) sloshRaf = requestAnimationFrame(drawSlosh);
    const cv = b.querySelector(".tl-cv"); if (!cv) return;
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    if (!r.width) return;
    if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
    const x = cv.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    const w = r.width, h = r.height, t = tlReduce ? 0 : now / 1000;
    const p = parseFloat(getComputedStyle(b).getPropertyValue("--p")) / 100 || 0;
    const fx = Math.max(0, p * w);
    const cc = getComputedStyle(b).getPropertyValue("--cc").trim() || "#3d7bff";
    x.clearRect(0, 0, w, h);
    if (fx < 1) return;
    // frontul: o burtă care respiră + o înclinare care se leagănă dintr-o parte în alta
    const bulge = 9 + 4 * Math.sin(t * 1.1), lean = 12 * Math.sin(t * .7) + 4 * Math.sin(t * 1.9 + 1);
    const edge = (y) => Math.max(0, fx - 8 + bulge * Math.sin(Math.PI * y / h) + lean * (y / h - .5));
    const path = () => { x.beginPath(); x.moveTo(0, 0); for (let y = 0; y <= h; y += 1.5) x.lineTo(edge(y), y); x.lineTo(edge(h), h); x.lineTo(0, h); x.closePath(); };
    // corpul: aproape negru în spate, culoarea secțiunii spre front, aproape alb pe margine
    const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c.trim()); const n = m ? parseInt(m[1], 16) : 0x3d7bff; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const mix = (a, b2, k) => `rgb(${a.map((v, i) => Math.round(v * k + b2[i] * (1 - k))).join(",")})`;
    const C = hex(cc), DARK = [5, 8, 24], WHITE = [255, 255, 255];
    const g = x.createLinearGradient(0, 0, fx + bulge, 0), back = Math.max(0, (fx - 150) / (fx + bulge)), mid = Math.max(back, (fx - 60) / (fx + bulge));
    g.addColorStop(0, "#050818"); g.addColorStop(back, mix(C, DARK, .12));
    g.addColorStop(mid, mix(C, DARK, .7)); g.addColorStop(Math.max(mid, (fx - 16) / (fx + bulge)), mix(C, WHITE, .75));
    g.addColorStop(1, "#eaf3ff");
    path(); x.fillStyle = g; x.fill();
    // strălucire pe margine
    x.save(); x.shadowColor = mix(C, WHITE, .85); x.shadowBlur = 22; x.strokeStyle = "rgba(235,245,255,.9)"; x.lineWidth = 2.2;
    x.beginPath(); for (let y = 0; y <= h; y += 1.5) { const ex = edge(y); y ? x.lineTo(ex, y) : x.moveTo(ex, y); } x.stroke(); x.restore();
    // lumina se revarsă puțin în fața frontului
    const fg = x.createLinearGradient(fx - 4, 0, fx + 46, 0); fg.addColorStop(0, `rgba(${C.join(",")},.35)`); fg.addColorStop(1, `rgba(${C.join(",")},0)`);
    x.fillStyle = fg; x.fillRect(fx - 4, 0, 50, h);
    // luciu discret sus, ca pe un lichid
    const gl = x.createLinearGradient(0, 0, 0, h * .45); gl.addColorStop(0, "rgba(255,255,255,.14)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    x.save(); path(); x.clip(); x.fillStyle = gl; x.fillRect(0, 0, w, h * .45); x.restore();
  }

  $("#tlBlocks").addEventListener("click", (e) => {
    const b = e.target.closest(".tl-sec"); if (!b) return;
    const x = tlSecs[+b.dataset.k]; if (!x) return;
    const tr = $(`#rows tr[data-id="${x.id || x.segs[0].id}"]`);
    if (tr) { tr.scrollIntoView({ behavior: "smooth", block: "start" }); tr.classList.add("flash"); setTimeout(() => tr.classList.remove("flash"), 1200); }
  });

  /* ---------------- tabel ---------------- */
  function catStyle(cat) { return `--cc: var(${(CATS[cat] || CATS.platforma).var})`; }
  function chip(cat) { return `<span class="chip" style="${catStyle(cat)}">${esc((CATS[cat] || CATS.platforma).label)}</span>`; }

  function renderFilters() {
    $("#filters").innerHTML = Object.entries(CATS).map(([k, c]) =>
      `<button class="chip ${hiddenCats.has(k) ? "off" : ""}" data-cat="${k}" style="${catStyle(k)}" aria-pressed="${hiddenCats.has(k) ? "false" : "true"}" title="${T("Show / hide")}">${esc(c.label)}</button>`).join("");
  }

  function renderTable() {
    renderTimeline();
    const off = plannedOffsets();
    let n = 0;
    const html = state.items.map((it) => {
      if (it.type === "header") {
        return `<tr class="header-row" data-id="${it.id}" draggable="false">
          <td class="drag"><button type="button" class="grip" data-a="grip" title="${T("Drag to move, or focus and use Alt+↑ / Alt+↓")}" aria-label="${T("Move section {t}", { t: esc(it.title) })}">${IC.grip}</button></td>
          <td colspan="8"><input class="cell" data-f="title" value="${esc(it.title)}" aria-label="${T("Section title")}"></td>
          <td><div class="acts"><button class="icon del" data-a="del" title="${T("Delete section")}" aria-label="${T("Delete section")}">${IC.del}</button></div></td></tr>`;
      }
      n++;
      return `<tr class="seg-row" data-id="${it.id}" style="${catStyle(it.cat)}">
        <td class="drag"><button type="button" class="grip" data-a="grip" title="${T("Drag to move, or focus and use Alt+↑ / Alt+↓")}" aria-label="${T("Move segment {n}", { n })}">${IC.grip}</button></td>
        <td class="num"><span class="cue">Q${n}</span><span class="cue-state" aria-live="off"></span></td>
        <td class="start"><span data-start>${hhmm(off[it.id])}</span>
          <select class="cell cat" data-f="cat" aria-label="${T("Category")}">${Object.entries(CATS).map(([k, c]) =>
            `<option value="${k}" ${k === it.cat ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select></td>
        <td class="c-durcell" data-l="${T("Min")}"><input class="cell dur" data-f="min" inputmode="decimal" value="${esc(it.min)}" aria-label="${T("Length in minutes")}"></td>
        <td class="c-titlecell">
          <textarea class="cell title-cell" data-f="title" rows="1" aria-label="${T("Segment")}">${esc(it.title)}</textarea>
          ${musicCell(it)}
        </td>
        <td data-l="${T("Video")}"><textarea class="cell" data-f="video" rows="1" aria-label="${T("Video")}">${esc(it.video)}</textarea></td>
        <td data-l="${T("Graphics")}">${visCell(it)}<textarea class="cell" data-f="gfx" rows="1" aria-label="${T("Graphics")}">${esc(it.gfx)}</textarea></td>
        <td class="c-talkcell" data-l="${T("What’s said")}"><textarea class="cell" data-f="talk" rows="1" aria-label="${T("What’s said")}">${esc(it.talk)}</textarea>
          <textarea class="cell script-cell" data-f="script" rows="1" placeholder="${T("+ prompter script")}" aria-label="${T("Prompter script")}">${esc(it.script)}</textarea></td>
        <td data-l="${T("Who")}"><textarea class="cell" data-f="who" rows="1" aria-label="${T("Who")}">${esc(it.who)}</textarea></td>
        <td class="c-actcell"><div class="acts">
          <button class="cmt-btn icon" data-a="cmt" title="${T("Comments on this segment")}" aria-label="${T("Comments on segment {n}", { n })}">${IC.cmt}<span class="n"></span></button>
          <button class="icon jump" data-a="jump" title="${T("Go live from here")}" aria-label="${T("Go live from segment {n}", { n })}">${IC.jump}</button>
          <button class="icon" data-a="add" title="${T("New segment below")}" aria-label="${T("New segment below")}">${IC.add}</button>
          <button class="icon" data-a="dup" title="${T("Duplicate")}" aria-label="${T("Duplicate segment {n}", { n })}">${IC.dup}</button>
          <button class="icon del" data-a="del" title="${T("Delete")}" aria-label="${T("Delete segment {n}", { n })}">${IC.del}</button>
        </div></td></tr>`;
    }).join("");
    $("#rows").innerHTML = html;
    $$("#rows textarea").forEach(autosize);
    if (!canEdit()) $$("#rows .cell").forEach((c) => { c.readOnly = true; if (c.tagName === "SELECT") c.disabled = true; });
    renderCommentBadges();
    applyFilters();
    updateTotals();
    markRows(position());
  }

  // previzualizarea grafică: miniatură + alegere din bibliotecă pentru cine editează
  function visCell(it) {
    const KV = window.KVisual; if (!KV) return "";
    const edit = canEdit();
    const cur = KV.html(it.visual, edit ? `<span class="vacts"><button type="button" class="icon" data-a="vpick" title="${T("Another image")}" aria-label="${T("Another image")}">${IC.dup}</button><button type="button" class="icon del" data-a="vdel" title="${T("Remove image")}" aria-label="${T("Remove image")}">${IC.del}</button></span>` : "");
    return cur || (edit ? `<button type="button" class="madd vadd" data-a="vpick" title="${T("Choose how it looks on screen")}">${T("+ Screen image")}</button>` : "");
  }
  let visFor = null;
  const visPop = document.createElement("div"); visPop.className = "vpick card"; visPop.hidden = true; document.body.appendChild(visPop);
  function openVisPick(id, anchor) {
    const KV = window.KVisual; visFor = id;
    const it = state.items.find((x) => x.id === id), curKey = it && typeof it.visual === "string" ? it.visual : "";
    visPop.innerHTML = `<div class="vp-h">${T("How it looks on screen")}<button type="button" class="icon" data-vp-close title="${T("Close")}" aria-label="${T("Close")}">${IC.del}</button></div><div class="vp-grid">`
      + Object.entries(KV.LIB).map(([k, n]) => `<button type="button" class="vp-it ${k === curKey ? "on" : ""}" data-vp="${k}"><img src="${KV.thumb(k)}" alt="" loading="lazy"><span>${esc(n)}</span></button>`).join("") + `</div>`;
    visPop.hidden = false;
    const r = anchor.getBoundingClientRect(), w = Math.min(560, innerWidth - 24);
    visPop.style.width = `${w}px`;
    visPop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left))}px`;
    const h = visPop.offsetHeight;
    visPop.style.top = `${r.bottom + 6 + h > innerHeight ? Math.max(12, r.top - h - 6) : r.bottom + 6}px`;
  }
  function setVisual(id, v) {
    const it = state.items.find((x) => x.id === id); if (!it) return;
    snapshot(); if (v) it.visual = v; else delete it.visual; save();
    if (cloud()) S.field(id, "visual", v || null);
    renderTable();
  }
  visPop.addEventListener("click", (e) => {
    if (e.target.closest("[data-vp-close]")) { visPop.hidden = true; return; }
    const b = e.target.closest("[data-vp]"); if (!b || !visFor) return;
    visPop.hidden = true; setVisual(visFor, b.dataset.vp);
  });
  document.addEventListener("mousedown", (e) => { if (!visPop.hidden && !visPop.contains(e.target) && !e.target.closest("[data-a=vpick]")) visPop.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") visPop.hidden = true; });

  // muzica segmentului: player (în rundown și în Preview) + încărcare / înlocuire / ștergere pentru cine editează
  function musicCell(it) {
    const up = uploading.get(it.id);
    if (up != null) return `<div class="music up"><span class="mname">♪ ${T("Uploading… {p}%", { p: Math.round(up * 100) })}</span><span class="mtrack"><span style="width:${up * 100}%"></span></span></div>`;
    const edit = canEdit() && cloud();
    if (it.music && it.music.url && window.KAudio) {
      return window.KAudio.html(it.music, edit ? `<div class="macts"><button type="button" class="icon" data-a="mrep" title="${T("Replace track")}" aria-label="${T("Replace track")}">${IC.dup}</button><button type="button" class="icon del" data-a="mdel" title="${T("Remove music")}" aria-label="${T("Remove music")}">${IC.del}</button></div>` : "", { download: edit });
    }
    return edit ? `<button type="button" class="madd" data-a="madd" title="${T("Choose an audio file or drop it on the row")}">${T("+ Music")}</button>` : "";
  }
  const uploading = new Map();
  let musicFor = null;
  const musicInput = Object.assign(document.createElement("input"), { type: "file", accept: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac", hidden: true });
  document.body.appendChild(musicInput);
  musicInput.onchange = () => { const f = musicInput.files[0]; musicInput.value = ""; if (f && musicFor) attachMusic(musicFor, f); };
  async function attachMusic(id, file) {
    if (!cloud()) return toast(T("Sign in to upload music"));
    const it = state.items.find((x) => x.id === id); if (!it) return;
    const old = it.music;
    uploading.set(id, 0); renderTable();
    let lastPaint = 0;
    try {
      const m = await S.uploadMusic(file, id, (p) => {
        uploading.set(id, p);
        const now = performance.now(); if (now - lastPaint > 150) { lastPaint = now; const td = $(`#rows tr[data-id="${id}"] .music.up`); if (td) td.outerHTML = musicCell(it); }
      });
      uploading.delete(id);
      const cur = state.items.find((x) => x.id === id); if (!cur) return;
      snapshot(); cur.music = m; save(); S.field(id, "music", m); renderTable();
      toast(T("Music added: {name}", { name: m.name }));
      if (old && old.path) S.deleteMusic(old.path);
    } catch (e) {
      uploading.delete(id); renderTable();
      const c = e && (e.message || e.code) || "";
      toast(T(c === "not_audio" ? "That file is not audio (MP3, WAV, M4A…)" : c === "too_big" ? "That file is too large (50 MB max)"
        : /unauthorized|permission/i.test(c) ? "You don't have permission to upload music here" : /bucket|not-found|no_storage/i.test(c) ? "Music storage isn't enabled yet" : "The music didn't upload. Try again."));
      console.error(e);
    }
  }
  // un fișier audio tras peste un rând se asignează acelui segment
  $("#rows").addEventListener("dragover", (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes("Files") || !canEdit()) return;
    const tr = e.target.closest("tr.seg-row"); if (!tr) return;
    e.preventDefault(); $$("#rows tr.music-over").forEach((r) => r !== tr && r.classList.remove("music-over")); tr.classList.add("music-over");
  });
  $("#rows").addEventListener("dragleave", (e) => { const tr = e.target.closest("tr"); if (tr && !tr.contains(e.relatedTarget)) tr.classList.remove("music-over"); });
  $("#rows").addEventListener("drop", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    const tr = e.target.closest("tr.seg-row"); $$("#rows tr.music-over").forEach((r) => r.classList.remove("music-over"));
    if (!tr || !canEdit()) return;
    e.preventDefault(); e.stopImmediatePropagation(); attachMusic(tr.dataset.id, e.dataTransfer.files[0]);
  }, true);

  function updateStarts() {
    const off = plannedOffsets();
    $$("#rows tr.seg-row").forEach((tr) => { const c = tr.querySelector("[data-start]"); if (c) c.textContent = hhmm(off[tr.dataset.id]); });
    updateTotals();
  }

  function updateTotals() {
    const off = plannedOffsets();
    const end = hhmm(off.__total);
    const h = Math.floor(off.__total / 60), m = off.__total % 60;
    $("#totalInfo").textContent = `${state.show.start} → ${end} · ` + T("{h}h {m}m · {n} segments", { h, m: pad(m), n: segs().length });
  }

  function applyFilters() {
    $$("#rows tr.seg-row").forEach((tr) => {
      const it = state.items.find((i) => i.id === tr.dataset.id);
      tr.classList.toggle("hidden-cat", !!it && hiddenCats.has(it.cat));
    });
  }

  function autosize(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }

  function markRows(pos) {
    const curId = pos.cur && pos.cur.id, nextId = pos.next && pos.next.id;
    let seen = false;
    $$("#rows tr.seg-row").forEach((tr) => {
      const id = tr.dataset.id;
      const isCur = id === curId;
      if (isCur) seen = true;
      tr.classList.toggle("current", isCur);
      tr.classList.toggle("next-row", id === nextId);
      const past = (pos.mode === "post") || (!!curId && !seen && !isCur);
      tr.classList.toggle("past", past);
      // starea cue-ului, ca în caietul de regie: GO pe ce rulează, STANDBY pe ce urmează (doar în Live)
      const cs = tr.querySelector(".cue-state"); if (!cs) return;
      const live = pos.mode === "live";
      const st = isCur ? (live ? T("GO") : T("NOW")) : id === nextId ? (live ? T("STANDBY") : T("NEXT")) : "";
      if (cs.textContent !== st) cs.textContent = st;
    });
  }

  /* ---------------- editare ---------------- */
  let typingSnap = null;
  $("#rows").addEventListener("focusin", (e) => {
    if (e.target.classList.contains("cell")) typingSnap = JSON.stringify(state.items);
  });
  $("#rows").addEventListener("input", (e) => {
    const el = e.target; if (!el.classList.contains("cell")) return;
    const tr = el.closest("tr"); const it = state.items.find((i) => i.id === tr.dataset.id); if (!it) return;
    if (typingSnap) { undoStack.push(typingSnap); typingSnap = null; }
    const f = el.dataset.f;
    if (f === "min") {
      const v = parseFloat(String(el.value).replace(",", "."));
      it.min = isFinite(v) && v >= 0 ? v : 0;
      updateStarts();
    } else {
      it[f] = el.value;
    }
    if (f === "cat") tr.style.cssText = catStyle(it.cat);
    if (el.tagName === "TEXTAREA") autosize(el);
    save(); tick();
    if (cloud()) { const v = f === "min" ? it.min : el.value; localDirty.set(`${it.id}.${f}`, v); S.field(it.id, f, v); }
  });

  $("#rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const tr = b.closest("tr"); const i = state.items.findIndex((x) => x.id === tr.dataset.id); if (i < 0) return;
    const a = b.dataset.a;
    if (a === "grip") return;
    if (a === "jump") return jumpTo(state.items[i].id, b);
    if (a === "cmt") return openDrawer(state.items[i].id);
    if (!canEdit()) return;
    if (a === "vpick") { openVisPick(state.items[i].id, b); return; }
    if (a === "vdel") { setVisual(state.items[i].id, null); return; }
    if (a === "madd" || a === "mrep") { musicFor = state.items[i].id; musicInput.click(); return; }
    if (a === "mdel") {
      const it = state.items[i]; if (!it.music) return;
      if (!confirm(T("Remove “{name}” from this segment?", { name: it.music.name }))) return;
      const path = it.music.path; snapshot(); delete it.music; save(); if (cloud()) { S.field(it.id, "music", null); S.deleteMusic(path); }
      if (window.KAudio) window.KAudio.stop(); renderTable(); return;
    }
    snapshot();
    if (a === "del") {
      const it = state.items[i];
      state.items.splice(i, 1);
      toast(T("Deleted: {t} · Ctrl+Z to undo", { t: it.title || T("row") }));
    } else if (a === "dup") {
      state.items.splice(i + 1, 0, { ...clone(state.items[i]), id: uid() });
    } else if (a === "add") {
      state.items.splice(i + 1, 0, newSeg());
    }
    save(); pushItems(); renderTable(); tick();
    if (a === "add") focusRow(state.items[i + 1].id);
  });

  function newSeg() { return { id: uid(), type: "segment", title: T("New segment"), min: 5, cat: "platforma", video: "", gfx: "", talk: "", script: "", who: "" }; }
  function focusRow(id) { const t = $(`#rows tr[data-id="${id}"] .title-cell`); if (t) { t.focus(); t.select(); } }

  $("#btnAddRow").onclick = () => { snapshot(); const s = newSeg(); state.items.push(s); save(); pushItems(); renderTable(); focusRow(s.id); tick(); };
  $("#btnAddHeader").onclick = () => {
    snapshot(); const h = { id: uid(), type: "header", title: T("NEW SECTION") }; state.items.push(h); save(); pushItems(); renderTable();
    const inp = $(`#rows tr[data-id="${h.id}"] input`); if (inp) { inp.focus(); inp.select(); }
  };

  // drag & drop: rândurile se mută doar din mânerul ⋮⋮
  let dragId = null;
  $("#rows").addEventListener("mousedown", (e) => {
    const h = e.target.closest(".drag"); const tr = e.target.closest("tr");
    $$("#rows tr").forEach((r) => r.setAttribute("draggable", "false"));
    if (h && tr) tr.setAttribute("draggable", "true");
  });
  $("#rows").addEventListener("dragstart", (e) => {
    const tr = e.target.closest("tr"); if (!tr || tr.getAttribute("draggable") !== "true") return e.preventDefault();
    dragId = tr.dataset.id; e.dataTransfer.effectAllowed = "move";
  });
  $("#rows").addEventListener("dragover", (e) => {
    if (!dragId) return; e.preventDefault();
    $$("#rows tr.drag-over").forEach((r) => r.classList.remove("drag-over"));
    const tr = e.target.closest("tr"); if (tr) tr.classList.add("drag-over");
  });
  $("#rows").addEventListener("drop", (e) => {
    e.preventDefault(); const tr = e.target.closest("tr");
    $$("#rows tr.drag-over").forEach((r) => r.classList.remove("drag-over"));
    if (!dragId || !tr || tr.dataset.id === dragId) { dragId = null; return; }
    snapshot();
    const from = state.items.findIndex((x) => x.id === dragId);
    const [moved] = state.items.splice(from, 1);
    const to = state.items.findIndex((x) => x.id === tr.dataset.id);
    state.items.splice(to, 0, moved);
    dragId = null; save(); pushItems(); renderTable(); tick();
  });
  $("#rows").addEventListener("dragend", () => { dragId = null; $$("#rows tr.drag-over").forEach((r) => r.classList.remove("drag-over")); });
  // aceeași mutare din tastatură: focus pe mâner, apoi Alt+↑ / Alt+↓
  $("#rows").addEventListener("keydown", (e) => {
    const g = e.target.closest(".grip"); if (!g || !e.altKey || !canEdit()) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const id = g.closest("tr").dataset.id, from = state.items.findIndex((x) => x.id === id);
    const to = from + (e.key === "ArrowUp" ? -1 : 1);
    if (from < 0 || to < 0 || to >= state.items.length) return;
    snapshot(); const [moved] = state.items.splice(from, 1); state.items.splice(to, 0, moved);
    save(); pushItems(); renderTable(); tick();
    const ng = $(`#rows tr[data-id="${id}"] .grip`); if (ng) ng.focus();
    toast(e.key === "ArrowUp" ? T("Moved up") : T("Moved down"));
  });

  $("#filters").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]"); if (!c) return;
    const k = c.dataset.cat; hiddenCats.has(k) ? hiddenCats.delete(k) : hiddenCats.add(k);
    renderFilters(); applyFilters();
  });

  /* ---------------- live ---------------- */
  // acțiunile care schimbă show-ul pentru toată echipa cer două apăsări: prima „armează” butonul, a doua confirmă (4 s)
  function armed(btn, label, fn) {
    if (!btn) return fn();
    if (btn.dataset.armed === "1") { disarm(btn); return fn(); }
    $$("[data-armed='1']").forEach(disarm);
    btn.dataset.armed = "1"; btn.dataset.label = btn.innerHTML; btn.classList.add("armed");
    btn.innerHTML = esc(label); btn.setAttribute("aria-live", "assertive");
    btn._t = setTimeout(() => disarm(btn), 4000);
  }
  function disarm(btn) {
    if (btn.dataset.armed !== "1") return;
    clearTimeout(btn._t); btn.dataset.armed = ""; btn.classList.remove("armed");
    btn.innerHTML = btn.dataset.label || btn.innerHTML; btn.removeAttribute("aria-live");
  }
  function setMode(m, btn) {
    if (m === state.mode) return;
    if (m === "live" && cloud() && btn) return armed(btn, T("Confirm: Live for everyone"), () => setMode("live"));
    state.mode = m;
    if (m === "plan") { state.live.running = false; state.live.ended = false; }
    save(); pushLive(); renderMode(); tick();
    if (m === "live") toast(cloud() ? T("Live mode is on for the whole team") : T("Live mode is on"));
  }
  function renderMode() {
    $$(".seg-btn[data-mode]").forEach((b) => { const on = b.dataset.mode === state.mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $$(".seg-btn[data-adv]").forEach((b) => { const on = b.dataset.adv === (state.advance || "manual"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $("#advSeg").classList.toggle("show", state.mode === "live");
    const live = state.mode === "live";
    const running = live && state.live.running && !state.live.ended;
    const last = running && state.live.idx >= segs().length - 1;
    const go = $("#btnGo"); disarm(go);
    go.innerHTML = !live ? esc(T("Go live")) : state.live.ended ? esc(T("Show ended")) : running ? (last ? esc(T("End show")) : `${esc(T("Next"))} ${IC.next}`) : esc(T("Start show"));
    go.disabled = live && !!state.live.ended;
    go.classList.toggle("end", last);
    $("#btnPrev").disabled = !running || state.live.idx <= 0; $("#btnStop").disabled = !(live && (state.live.running || state.live.ended));
    document.body.classList.toggle("live-on", running);
    document.body.classList.toggle("mode-live", live);
  }
  $$(".seg-btn[data-mode]").forEach((b) => b.onclick = () => setMode(b.dataset.mode, b));
  $$(".seg-btn[data-adv]").forEach((b) => b.onclick = () => {
    state.advance = b.dataset.adv; save(); pushLive(); renderMode(); tick();
    toast(state.advance === "auto" ? T("Auto: at zero the next segment starts on its own") : T("Manual: at zero the timer runs over until you press Next"));
  });

  // ora la care a pornit fiecare segment în Live, ca „Înapoi” să-i redea timpul, nu să-l ia de la zero
  const liveStarts = new Map();
  function noteStart() { const cur = segs()[state.live.idx]; if (cur && state.live.running) liveStarts.set(cur.id, state.live.itemStart); }

  // Auto: segmentul următor pornește exact când trebuia să se termine cel curent, ca întârzierile să nu se adune
  function autoAdvance(now) {
    if (state.mode !== "live" || !state.live.running || state.live.ended || state.advance !== "auto") return false;
    const list = segs(); let moved = false;
    while (state.live.idx < list.length - 1) {
      const cur = list[state.live.idx];
      const end = state.live.itemStart + (Number(cur.min) || 0) * 60000;
      if (now < end) break;
      state.live.idx++; state.live.itemStart = end; noteStart(); moved = true;
    }
    if (moved) { save(); pushLive(); renderMode(); setTimeout(scrollToCurrent, 50); }
    return moved;
  }

  let lastGo = 0;
  // src: nimic = butonul din bara de sus; true = tastatura; un element = butonul care a fost apăsat (și cel din pop-up)
  function go(src) {
    const fromKey = src === true;
    const btn = fromKey ? null : (src && src.nodeType === 1 ? src : $("#btnGo"));
    if (state.mode !== "live") return setMode("live", btn || $("#btnGo"));
    if (state.live.ended) return;
    const now = nowMs(); const list = segs();
    if (!state.live.running) {
      if (fromKey) return toast(T("Press Start show to begin"));
      return armed(btn, cloud() ? T("Confirm: start for everyone") : T("Confirm: start show"), () => {
        const t = nowMs(); state.live = { running: true, idx: 0, itemStart: t, showStart: t, ended: false }; noteStart();
        lastGo = t; save(); pushLive(); renderMode(); tick(); scrollToCurrent();
      });
    }
    // o apăsare dublă (sau N ținut apăsat) nu mai sare peste un segment
    if (now - lastGo < 700) return;
    if (state.live.idx < list.length - 1) {
      lastGo = now; state.live.idx++; state.live.itemStart = now; noteStart();
      save(); pushLive(); renderMode(); tick(); scrollToCurrent();
    } else if (!fromKey) {
      armed(btn, T("Confirm: end show"), endShow);
    } else toast(T("This is the last segment. Press End show to finish."));
  }
  function endShow() {
    state.live.ended = true; state.live.running = false; state.live.endedAt = nowMs();
    save(); pushLive(); renderMode(); tick();
  }
  function prev() {
    if (!state.live.running || state.live.ended || state.live.idx <= 0) return;
    const list = segs(), back = list[state.live.idx - 1];
    // segmentul anterior își recapătă ora de start reală; dacă nu o știm, presupunem că a mers după plan
    state.live.itemStart = liveStarts.get(back.id) ?? (state.live.itemStart - (Number(back.min) || 0) * 60000);
    state.live.idx--; lastGo = nowMs();
    save(); pushLive(); renderMode(); tick(); scrollToCurrent();
    toast(T("Back to {t}", { t: back.title || T("the previous segment") }));
  }
  function stop() {
    if (!(state.live.running || state.live.ended)) return;
    armed($("#btnStop"), T("Confirm: reset timer"), () => {
      state.live = { running: false, idx: -1, itemStart: 0, showStart: 0, ended: false }; liveStarts.clear();
      save(); pushLive(); renderMode(); tick(); toast(T("Live timer reset. The rundown is unchanged."));
    });
  }
  function jumpTo(id, btn) {
    const idx = segIndex(id); if (idx < 0) return;
    const doJump = () => {
      const now = nowMs();
      if (state.mode !== "live" || !state.live.running) {
        state.mode = "live";
        // pornim show-ul ca și cum ar fi început la ora planificată a segmentului
        state.live = { running: true, idx, itemStart: now, showStart: now - plannedOffsets()[id] * 60000, ended: false };
      } else { state.live.idx = idx; state.live.itemStart = now; }
      noteStart(); lastGo = now; save(); pushLive(); renderMode(); tick();
    };
    if (state.mode === "live" && state.live.running && !btn) return doJump();
    armed(btn, T("Go?"), doJump);
  }
  function scrollToCurrent() {
    const tr = $("#rows tr.current"); if (!tr) return;
    // rândul curent vine sub banda cu timerul (care rămâne lipită sus), nu peste ea
    const stick = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stick")) || ($(".topbar")?.offsetHeight || 0);
    const top = (innerWidth > 900 ? stick + ($(".rundown thead")?.offsetHeight || 0) : ($(".topbar")?.offsetHeight || 0)) + 12;
    const r = tr.getBoundingClientRect();
    if (r.top < top || r.bottom > innerHeight - 24) window.scrollBy({ top: r.top - top - 8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  $("#btnGo").onclick = () => go(); $("#btnPrev").onclick = prev; $("#btnStop").onclick = stop;

  /* ---------------- hero + pop-up ---------------- */
  function driftText(pos) {
    if (pos.drift == null) return { text: "", cls: "" };
    const d = pos.drift, vp = !!pos.vsSchedule;
    if (Math.abs(d) < 30000) return { text: T("On time"), cls: "ok" };
    return d > 0 ? { text: T(vp ? "+{d} late vs plan" : "+{d} late vs start", { d: fmtDur(d) }), cls: "late" }
      : { text: T(vp ? "{d} ahead vs plan" : "{d} ahead vs start", { d: fmtDur(-d) }), cls: "early" };
  }
  let announced = "";
  function tick() {
    const now = new Date(nowMs());
    $("#clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    autoAdvance(now.getTime());
    const pos = position(now.getTime());
    tickTimeline(pos);
    const nowCard = $(".now");
    const live = pos.mode === "live";

    if (pos.cur) {
      $("#nowLabel").textContent = live ? (state.advance === "auto" ? T("NOW · LIVE · AUTO") : T("NOW · LIVE · MANUAL")) : T("NOW · BY THE PLAN");
      $("#nowCue").textContent = `Q${pos.idx + 1}`;
      $("#nowTitle").textContent = pos.cur.title || "—";
      $("#nowMeta").innerHTML = `${chip(pos.cur.cat)}<span>${hhmm(pos.off[pos.cur.id])} · ${T("{n} min", { n: pos.cur.min })}</span>${pos.cur.who ? `<span data-ni>· ${esc(pos.cur.who)}</span>` : ""}`;
      $("#nowRemain").textContent = fmtDur(pos.remain);
      const over = pos.remain < 0, last = !over && pos.remain < 60000;
      $("#nowRemain").className = "big-time" + (over ? " over" : last ? " last" : "");
      nowCard.classList.toggle("over", over); nowCard.classList.toggle("last", last);
      $("#nowProgress").style.width = Math.min(100, Math.max(0, (pos.elapsed / (pos.durMs || 1)) * 100)) + "%";
      const endAt = new Date(now.getTime() + Math.max(0, pos.remain));
      $("#nowEnds").textContent = over ? T("Over by {d}", { d: fmtDur(-pos.remain) }) : T(live && state.advance === "auto" ? "Moves on at {t}" : "Ends at {t}", { t: `${pad(endAt.getHours())}:${pad(endAt.getMinutes())}` });
      const dt = driftText(pos); const el = $("#drift");
      el.textContent = dt.text; el.className = "drift " + dt.cls;
      $("#nowTalk").textContent = pos.cur.talk || "";
      $("#miniRemain").textContent = fmtDur(pos.remain); $("#miniRemain").className = "mini-remain" + (over ? " over" : last ? " last" : "");
    } else {
      nowCard.classList.remove("over", "last");
      $("#nowLabel").textContent = pos.mode === "pre" ? T("BEFORE THE SHOW") : T("SHOW ENDED");
      $("#nowCue").textContent = "";
      $("#nowTitle").textContent = pos.mode === "pre" ? T("Starts in") : T("Thank you!");
      const endNote = pos.ended && state.live.endedAt ? " · " + T("ended at {t}", { t: new Date(state.live.endedAt).toTimeString().slice(0, 5) }) : "";
      $("#nowMeta").innerHTML = `<span>${esc(state.show.title)} · ${esc(fmtDate())} · ${esc(state.show.start)}${endNote}</span>`;
      $("#nowRemain").textContent = pos.mode === "pre" ? fmtDur(pos.nextInMs) : "00:00";
      $("#nowRemain").className = "big-time";
      $("#nowProgress").style.width = pos.mode === "post" ? "100%" : "0%";
      $("#nowEnds").textContent = pos.mode === "pre" ? T("For a rehearsal: Go live, then Start show") : pos.ended ? T("Reset the timer (■) to run it again") : "";
      $("#drift").textContent = ""; $("#nowTalk").textContent = "";
      $("#miniRemain").textContent = "";
    }

    $("#nextState").textContent = live ? T("STANDBY") : T("NEXT");
    if (pos.next) {
      $("#nextCue").textContent = `Q${segIndex(pos.next.id) + 1}`;
      $("#nextTitle").textContent = pos.next.title || "—";
      $("#nextCat").innerHTML = `${chip(pos.next.cat)} <span class="next-len">${T("{n} min", { n: pos.next.min })}${pos.next.who ? `<span data-ni> · ${esc(pos.next.who)}</span>` : ""}</span>`;
      $("#nextTalk").textContent = pos.next.talk || "";
      $("#nextIn").textContent = pos.nextInMs != null ? (pos.nextInMs >= 0 ? T("in {d}", { d: fmtDur(pos.nextInMs) }) : T("due now")) : "";
      $("#afterNext").innerHTML = pos.after ? `<span>${T("Then {t} · {n} min", { t: `<b data-ni>${esc(pos.after.title)}</b>`, n: pos.after.min })}</span>` : "";
      $(".next").classList.remove("empty");
    } else {
      $("#nextCue").textContent = ""; $("#nextTitle").textContent = pos.mode === "post" ? T("Nothing left to call") : "—";
      $("#nextCat").innerHTML = ""; $("#nextTalk").textContent = pos.mode === "post" ? T("{n} segments, {t}.", { n: segs().length, t: state.show.title || T("the show") }) : "";
      $("#nextIn").textContent = ""; $("#afterNext").innerHTML = "";
      $(".next").classList.add("empty");
    }

    // culoarea momentului = culoarea categoriei; trece în roșu doar în ultimul minut
    nowCard.style.setProperty("--ac", accentFor(pos));

    const curKey = pos.cur ? pos.cur.id : pos.mode;
    if (lastCurKey !== null && curKey !== lastCurKey) playMorph(pos.cur ? pos.cur.title : pos.mode === "post" ? T("Thank you!") : "");
    lastCurKey = curKey;
    // cititorul de ecran aude doar schimbarea de segment, nu fiecare secundă
    const say = pos.cur ? T("Now: {t}.", { t: pos.cur.title }) + (pos.next ? " " + T("Next: {t}", { t: pos.next.title }) : "") : $("#nowTitle").textContent;
    if (say !== announced) { announced = say; $("#liveAnnounce").textContent = say; }

    markRows(pos);
    renderPopup(pos);
  }

  // în ultimul minut culoarea momentului trece treptat în roșu; la zero e roșu de tot. Roșul nu apare nicăieri altundeva.
  const RED = "#ff4d5e";
  function mixHex(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }
  function accentFor(pos) {
    const base = (pos.cur && CAT_HEX[pos.cur.cat]) || "#3d7bff";
    if (!pos.cur) return base;
    if (pos.remain <= 0) return RED;
    if (pos.remain < 60000) return mixHex(base, RED, 1 - pos.remain / 60000);
    return base;
  }

  let lastCurKey = null;
  function playMorph(text) {
    const n = $(".now"); if (!n || !text) return;
    n.classList.remove("enter"); void n.offsetWidth; n.classList.add("enter");
    setTimeout(() => n.classList.remove("enter"), 1100);
    // semnătura: cue-ul care tocmai a fost „chemat” se aprinde GO pe rând, iar linia de cue îl leagă de timer
    const tr = $("#rows tr.current"); if (tr) { tr.classList.remove("called"); void tr.offsetWidth; tr.classList.add("called"); setTimeout(() => tr.classList.remove("called"), 900); }
    const au = $(".now .aurora"); if (au) { au.classList.add("flash"); setTimeout(() => au.classList.remove("flash"), 1600); }
    setTimeout(drawCueLine, 480);
    if (popupWin && !popupWin.closed) { const b = popupWin.document.body; b.classList.remove("flip"); void b.offsetWidth; b.classList.add("flip"); setTimeout(() => b.classList.remove("flip"), 800); }
  }

  // linia de cue: o riglă de 2px în albastrul semnal, din cutia cue-ului (rândul care rulează) până la timer, apoi se stinge
  function drawCueLine() {
    const svgEl = $("#cueLine"), cue = $("#rows tr.current .cue"), timer = $("#nowRemain");
    if (!svgEl || !cue || !timer || state.mode !== "live") return;
    const a = cue.getBoundingClientRect(), t = timer.getBoundingClientRect();
    if (a.bottom < 0 || a.top > innerHeight || !a.width) return;   // rândul nu se vede: nu desenăm nimic
    const x0 = Math.round(a.left + a.width / 2), y0 = Math.round(a.top), x1 = Math.round(t.left - 10), y1 = Math.round(t.top + t.height / 2);
    const xm = Math.round(Math.min(x0, x1) - 18);
    // din cutia cue-ului urcă puțin, merge spre stânga pe lângă banda de cue, apoi intră în timer
    svgEl.firstChild.setAttribute("d", `M${x0} ${y0} L${x0} ${y0 - 10} L${xm} ${y0 - 10} L${xm} ${y1} L${x1} ${y1}`);
    svgEl.classList.remove("on"); void svgEl.getBoundingClientRect(); svgEl.classList.add("on");
    clearTimeout(drawCueLine.t); drawCueLine.t = setTimeout(() => svgEl.classList.remove("on"), 1400);
  }

  function fmtDate() { const [y, m, d] = (state.show.date || "").split("-"); return d ? `${d}.${m}.${y}` : ""; }

  // ecranul de broadcast (?screen=1): stilul rămâne cel aprobat; nu-l atinge fără acord
  const SCREEN_CSS = `
    @property --ac{syntax:"<color>";inherits:true;initial-value:#3d7bff}
    @property --nc{syntax:"<color>";inherits:true;initial-value:#3d7bff}
    *{box-sizing:border-box} html,body{margin:0;height:100%;background:#000;color:#f2f4f8;font-family:"Inter Tight","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
    body{--ac:#3d7bff;--nc:#3d7bff;transition:--ac 1.2s ease,--nc 1.2s ease;display:flex;flex-direction:column;overflow:hidden;position:relative;
      background:linear-gradient(180deg,#010207 0%,color-mix(in srgb,var(--ac) 8%,#02040c) 70%,color-mix(in srgb,var(--ac) 24%,#02040c) 100%)}
    .aur{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
    .aur::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.95) 0%,rgba(0,0,0,.72) 38%,rgba(0,0,0,.25) 78%,rgba(0,0,0,.08) 100%)}
    .beam{position:absolute;top:-8%;bottom:-2%;left:var(--x);width:var(--w);opacity:var(--o);filter:blur(var(--b));mix-blend-mode:screen;transform-origin:50% 100%;
      background:linear-gradient(180deg,transparent 0%,color-mix(in srgb,var(--ac) 50%,transparent) 40%,var(--ac) 68%,color-mix(in srgb,var(--ac) 55%,#fff) 88%,color-mix(in srgb,var(--ac) 25%,#fff) 100%);
      animation:sway var(--d) ease-in-out var(--dl) infinite alternate,pulse var(--p) ease-in-out var(--dl) infinite}
    @keyframes sway{from{transform:translateX(-14px) scaleX(.8)}to{transform:translateX(14px) scaleX(1.25)}}
    @keyframes pulse{0%,100%{opacity:var(--o)}50%{opacity:calc(var(--o)*.35)}}
    .main{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:16px 18px 10px}
    .k{font-size:11px;letter-spacing:.16em;font-weight:700;color:#8a93a6;display:flex;align-items:center;gap:8px}
    .k .sp{flex:1}.dot{width:7px;height:7px;border-radius:50%;background:#3d7bff;box-shadow:0 0 10px #3d7bff}
    .clock{font-family:"JetBrains Mono",monospace;color:#d6e4ff;letter-spacing:.02em}
    .tg{font:600 11px/1 "Inter Tight",sans-serif;letter-spacing:.06em;color:#d6e4ff;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 10px;cursor:pointer}
    .tg.on{background:color-mix(in srgb,var(--ac) 30%,transparent);border-color:color-mix(in srgb,var(--ac) 70%,transparent);color:#fff}
    .t{font-size:clamp(20px,6.2vw,34px);font-weight:600;letter-spacing:-.02em;line-height:1.04;text-transform:uppercase;margin:calc(2px - .18em) 0 0;padding-top:.18em;background:linear-gradient(90deg,#fff,#fff 60%,#6b7486);-webkit-background-clip:text;background-clip:text;color:transparent}
    .meta{font-size:12px;color:#8a93a6}.drift.late{color:#ff4d5e}.drift.early{color:#6ee7a8}
    .time{font-family:"JetBrains Mono",monospace;font-size:clamp(52px,18vw,108px);font-weight:500;line-height:.95;letter-spacing:-.03em;color:#fff;
      text-shadow:0 2px 26px rgba(0,8,40,.8),0 0 40px color-mix(in srgb,var(--ac) 55%,transparent)}
    .time.warn{color:#ffb547}.time.over{color:#ff4d5e}
    .bar{height:4px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;flex:none}
    .bar i{display:block;height:100%;background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 70%,#000),color-mix(in srgb,var(--ac) 45%,#fff));box-shadow:0 0 12px var(--ac)}
    .tw{flex:1;min-height:0;position:relative;margin-top:4px}
    .talk{position:absolute;inset:0;overflow:hidden}
    .talk p{margin:0;font-size:clamp(15px,4.4vw,21px);line-height:1.45;color:#e6eaf3;white-space:pre-wrap;text-shadow:0 1px 14px rgba(0,0,0,.85)}
    .talk .lbl{font-size:10px;letter-spacing:.16em;font-weight:700;color:#6b7486;margin-bottom:6px}
    /* prompter */
    body.prompt .time{font-size:clamp(30px,9vw,46px)} body.prompt .t{font-size:clamp(15px,4vw,20px)} body.prompt .meta{display:none}
    body.prompt .talk{overflow-y:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 80%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 80%,transparent 100%)}
    body.prompt .talk::-webkit-scrollbar{display:none}
    body.prompt .talk .lbl{display:none}
    body.prompt .talk p{font-size:var(--ps,34px);line-height:1.35;font-weight:500;color:#fff;padding:28vh 2px 70vh}
    body.prompt.mirror .talk p{transform:scaleX(-1)}
    .guide{display:none;position:absolute;left:-14px;top:calc(28vh + var(--ps,34px) * .7);width:0;height:0;border:7px solid transparent;border-left:9px solid var(--ac);filter:drop-shadow(0 0 6px var(--ac));pointer-events:none;z-index:2}
    body.prompt .guide{display:block}
    .ctl{display:none;gap:6px;align-items:center;justify-content:center;flex:none}
    body.prompt .ctl{display:flex}
    .ctl button{font:600 12px/1 "Inter Tight",sans-serif;color:#e6eaf3;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:6px 10px;cursor:pointer;min-width:30px}
    .ctl button:hover{background:rgba(255,255,255,.14)} .ctl .play{background:color-mix(in srgb,var(--ac) 35%,transparent);border-color:color-mix(in srgb,var(--ac) 70%,transparent);min-width:64px}
    .ctl .v{font-family:"JetBrains Mono",monospace;font-size:11px;color:#8a93a6;min-width:40px;text-align:center}
    .next{position:relative;z-index:1;flex:none;margin:0 12px 12px;display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:14px;
      background:rgba(4,6,12,.72);backdrop-filter:blur(14px);border:1px solid color-mix(in srgb,var(--nc) 35%,transparent)}
    .next .nd{width:8px;height:8px;border-radius:50%;flex:none;background:var(--nc);box-shadow:0 0 10px var(--nc)}
    .next .nl{font-size:10px;letter-spacing:.16em;font-weight:700;color:#8a93a6;flex:none}
    .next .nt{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;text-transform:uppercase;letter-spacing:-.01em}
    .next .ni{font-family:"JetBrains Mono",monospace;font-size:12px;color:color-mix(in srgb,var(--nc) 55%,#fff);flex:none}
    body.flip .main>*{animation:pflip 1s cubic-bezier(.22,.8,.25,1)}
    @keyframes pflip{0%{opacity:0;filter:blur(14px);transform:translateY(6px)}100%{opacity:1;filter:none;transform:none}}
    @media (prefers-reduced-motion:reduce){.beam{animation:none}}
    /* ecranul mare (?screen=1): același pop-up, pe toată pagina, fără butoane */
    body.screen .tg,body.screen .ctl{display:none!important}
    body.screen.ui .tg{display:inline-block!important} body.screen.ui.prompt .ctl{display:flex!important} body.screen.ui{cursor:default}
    /* a doua linie „Apoi”: doar pe ecranul mare și doar când prompterul e oprit */
    .next.after{display:none;--nc:var(--nc2)}
    body.screen:not(.prompt) .next.after{display:flex} body.screen:not(.prompt) .next:not(.after){margin-bottom:1.4vmin}
    body.screen .main{padding:4vmin 5vmin 2vmin;gap:1.6vmin}
    body.screen .k{font-size:clamp(12px,1.9vmin,28px)} body.screen .dot{width:1.3vmin;height:1.3vmin}
    body.screen .t{font-size:clamp(28px,7vmin,120px)}
    body.screen .meta{font-size:clamp(13px,2.4vmin,36px)}
    body.screen .time{font-size:min(30vmin,17vw);white-space:nowrap} body.screen .time.long{font-size:min(30vmin,8.5vw)}
    body.screen .bar{height:max(4px,.9vmin)}
    body.screen .talk p{font-size:clamp(18px,3.6vmin,56px)} body.screen .talk .lbl{font-size:clamp(10px,1.6vmin,22px)}
    body.screen .next{margin:0 3vmin 3vmin;padding:2vmin 3vmin;gap:2vmin;border-radius:2vmin}
    body.screen .next .nd{width:1.6vmin;height:1.6vmin} body.screen .next .nl{font-size:clamp(10px,1.8vmin,26px)}
    body.screen .next .nt{font-size:clamp(14px,4vmin,64px)} body.screen .next .ni{font-size:clamp(12px,3vmin,48px)}
    body.screen{cursor:none} body.screen .next.after{opacity:.8}
    body.screen.prompt .time{font-size:min(14vmin,9vw)} body.screen.prompt .t{font-size:clamp(20px,4.5vmin,72px)}`;

  // pop-up-ul (fereastră mică, PiP sau tab pe telefon): caietul de regie la purtător, cu transport pentru regie
  const MARK_SVG = `<svg class="mk" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="15" height="17" fill="#fff"/><rect x="28" y="22" width="15" height="17" fill="#fff"/><rect x="21" y="4" width="6" height="40" fill="#3D7BFF"/></svg>`;
  const POPUP_CSS = `
    @property --ac{syntax:"<color>";inherits:true;initial-value:#3d7bff}
    :root{--bg:#05070d;--ink:#06175a;--desk:#0a1433;--line:rgba(214,228,255,.13);--ice:#d6e4ff;--text:#eef3ff;--muted:#a3b0cc;--signal:#3d7bff;--standby:#f2b33d;--red:#ff4d5e;
      --display:"Archivo","Inter Tight",Arial,sans-serif;--ui:"Inter Tight","Helvetica Neue",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace;color-scheme:dark}
    *{box-sizing:border-box} html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:var(--ui);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
    ::selection{background:var(--signal);color:#fff}
    body{--ac:#3d7bff;display:flex;flex-direction:column;overflow:hidden;min-height:100dvh;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
      background:linear-gradient(180deg,var(--bg) 0%,var(--bg) 55%,color-mix(in srgb,var(--ink) 70%,var(--bg)) 100%);transition:--ac .6s linear}
    button{font:inherit;color:inherit;-webkit-user-select:none;user-select:none;touch-action:manipulation}
    button:focus-visible{outline:2px solid var(--ice);outline-offset:2px}
    .ic{width:18px;height:18px;display:block}
    .k{display:flex;align-items:center;gap:10px;padding:14px 16px 0;font-size:12px;color:var(--muted)}
    .mk{width:18px;height:18px;flex:none}
    .st{display:inline-flex;align-items:center;gap:7px;color:var(--ice);font-weight:600}.mrest{display:contents}
    .dot{width:8px;height:8px;border-radius:50%;background:#56607a}
    body.is-live .dot{background:var(--signal);outline:3px solid color-mix(in srgb,var(--signal) 30%,transparent)}
    .cue{font-family:var(--mono);font-size:16px;letter-spacing:0;padding:2px 7px;border:1px solid rgba(214,228,255,.3);border-radius:4px;color:var(--ice)}
    .sp{flex:1}.clock{font-family:var(--mono);font-size:14px;letter-spacing:0;color:var(--ice);font-variant-numeric:tabular-nums}
    .main{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:12px 16px 10px}
    .trow{display:flex;align-items:baseline;gap:10px}.trow .cue{flex:none;position:relative;top:-3px}.cue:empty{display:none}
    .t{font-family:var(--display);font-stretch:125%;font-size:clamp(20px,6.4vw,30px);font-weight:700;line-height:1.08;letter-spacing:-.01em;text-transform:uppercase;margin:0;text-wrap:balance;overflow-wrap:anywhere}
    .meta{font-size:13px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 10px}
    .drift{font-family:var(--mono);font-weight:600}.drift.late{color:#fff}.drift.early{color:var(--ice)}.drift.ok{color:var(--muted)}
    .time{font-family:var(--mono);font-size:clamp(56px,21vw,112px);font-weight:500;line-height:.95;letter-spacing:-.04em;color:#fff;font-variant-numeric:tabular-nums}
    .time.last,.time.over{color:var(--red)}
    .bar{position:relative;height:3px;background:var(--line);flex:none}
    .bar i{position:absolute;left:0;top:0;bottom:0;background:var(--ac)}
    .bar i::after{content:"";position:absolute;right:-1px;top:-5px;width:2px;height:13px;background:#fff}
    .tw{flex:1;min-height:0;position:relative;margin-top:6px}
    .talk{position:absolute;inset:0;overflow:hidden}
    .talk p{margin:0;font-size:clamp(16px,4.6vw,21px);line-height:1.5;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
    .lbl{font-size:11px;letter-spacing:.1em;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase}
    body.prompt .time{font-size:clamp(34px,11vw,52px)} body.prompt .t{font-size:clamp(15px,4.2vw,20px)} body.prompt .meta{display:none}
    body.prompt .talk{overflow-y:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 80%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 80%,transparent 100%)}
    body.prompt .talk::-webkit-scrollbar{display:none} body.prompt .lbl{display:none}
    body.prompt .talk p{font-size:var(--ps,34px);line-height:1.35;font-weight:500;color:#fff;padding:28vh 2px 70vh}
    body.prompt.mirror .talk p{transform:scaleX(-1)}
    .guide{display:none;position:absolute;left:-12px;top:calc(28vh + var(--ps,34px) * .7);width:0;height:0;border:7px solid transparent;border-left:9px solid var(--signal);pointer-events:none;z-index:2}
    body.prompt .guide{display:block}
    .ctl{display:none;grid-template-columns:repeat(4,1fr);gap:6px;flex:none}
    body.prompt .ctl{display:grid}
    .ctl button,.tr button{min-height:44px;border-radius:8px;border:1px solid var(--line);background:var(--desk);color:var(--text);font-weight:600;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px}
    .ctl button:active,.tr button:active{transform:translateY(1px)}
    .ctl .play{grid-column:span 2;background:var(--ink);border-color:color-mix(in srgb,var(--signal) 60%,transparent)}
    .ctl .v{grid-column:span 2;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:13px;color:var(--muted)}
    .tr{display:grid;grid-template-columns:1fr 2.2fr 1fr;gap:8px;padding:0 16px 10px;flex:none}
    .tr .go{min-height:56px;background:#2b63e6;border-color:#2b63e6;color:#fff;font-size:17px;font-weight:700;letter-spacing:.02em}
    .tr .go.armed{background:var(--standby);border-color:var(--standby);color:#1a1000}
    .tr .go.end{background:var(--ink);border-color:var(--ice)}
    .tr button:disabled{opacity:.4;cursor:default}
    .tr .ptg.on{background:var(--ink);border-color:var(--ice);color:#fff}
    body.ro .tr .go,body.ro .tr .back{display:none} body.ro .tr{grid-template-columns:1fr}
    .next{flex:none;display:flex;align-items:center;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:color-mix(in srgb,var(--ink) 55%,var(--bg))}
    .sb{flex:none;font:700 11px/1 var(--ui);letter-spacing:.08em;padding:5px 7px;border-radius:4px;border:1.5px solid var(--standby);color:var(--standby)}
    body:not(.is-live) .sb{border-color:var(--line);color:var(--muted)}
    .next .nq{font-family:var(--mono);font-size:12px;color:var(--muted);flex:none}
    .next .nt{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
    .next .ni{font-family:var(--mono);font-size:13px;color:var(--ice);flex:none;font-variant-numeric:tabular-nums}
    .next.after{display:none}
    body.flip .main>*{animation:pflip .5s cubic-bezier(.16,1,.3,1)}
    body.flip .sb{animation:sbgo .6s steps(1)}
    @keyframes pflip{0%{opacity:.2;transform:translateY(4px)}100%{opacity:1;transform:none}}
    @keyframes sbgo{0%{background:var(--signal);border-color:var(--signal);color:#fff}100%{background:transparent}}
    @media (prefers-reduced-motion:reduce){body.flip .main>*{animation:none}}
    @media (min-width:600px) and (min-height:500px){.t{font-size:32px}.time{font-size:104px}}
    /* luminile verticale, ca în cardurile din editor */
    body{position:relative;background:linear-gradient(180deg,#010207 0%,color-mix(in srgb,var(--ac) 8%,#02040c) 70%,color-mix(in srgb,var(--ac) 24%,#02040c) 100%)}
    body>*:not(.aur){position:relative;z-index:1}
    .aur{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
    .aur::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.95) 0%,rgba(0,0,0,.72) 38%,rgba(0,0,0,.25) 78%,rgba(0,0,0,.08) 100%)}
    .beam{position:absolute;top:-8%;bottom:-2%;left:var(--x);width:var(--w);opacity:var(--o);filter:blur(var(--b));mix-blend-mode:screen;transform-origin:50% 100%;
      background:linear-gradient(180deg,transparent 0%,color-mix(in srgb,var(--ac) 50%,transparent) 40%,var(--ac) 68%,color-mix(in srgb,var(--ac) 55%,#fff) 88%,color-mix(in srgb,var(--ac) 25%,#fff) 100%);
      animation:sway var(--d) ease-in-out var(--dl) infinite alternate,bpulse var(--p) ease-in-out var(--dl) infinite}
    @keyframes sway{from{transform:translateX(-14px) scaleX(.8)}to{transform:translateX(14px) scaleX(1.25)}}
    @keyframes bpulse{0%,100%{opacity:var(--o)}50%{opacity:calc(var(--o)*.35)}}
    .talk p,.meta{text-shadow:0 1px 14px rgba(0,0,0,.85)}
    .next{background:rgba(4,6,12,.72)}
    @media (prefers-reduced-motion:reduce){.beam{animation:none}}`;

  const CAT_HEX = { live: "#3d7bff", interviu: "#a78bfa", grafica: "#22d3ee", platforma: "#c9d4ea", caritabil: "#f472b6", ing: "#ff6200", donatii: "#e4f53b", giveaway: "#34d399", pauza: "#8a93a6" };

  // setările prompter-ului rămân salvate între sesiuni
  const PROMPT_KEY = "ta-rundown-prompter";
  const prompter = Object.assign({ on: false, playing: false, speed: 40, size: 34, mirror: false },
    (() => { try { return JSON.parse(localStorage.getItem(PROMPT_KEY)) || {}; } catch (e) { return {}; } })());
  prompter.playing = false;
  const savePrompter = () => { try { localStorage.setItem(PROMPT_KEY, JSON.stringify({ ...prompter, playing: false })); } catch (e) {} };
  let promptAcc = 0, promptLast = 0, promptTextKey = "";
  // viteza ca treaptă (1–40), nu în pixeli pe secundă
  const speedStep = () => Math.round(prompter.speed / 5);

  async function openPopup() {
    if (popupWin && !popupWin.closed) { try { popupWin.focus(); } catch (e) {} return; }
    let w = null;
    try {
      if ("documentPictureInPicture" in window) {
        w = await window.documentPictureInPicture.requestWindow({ width: 440, height: 720 });
      }
    } catch (e) { w = null; }
    if (!w) {
      w = window.open("", "ta-rundown-popup", "width=440,height=760");
      if (!w) return toast(T("The browser blocked the pop-up. Allow pop-ups for this page."));
      if (!matchMedia("(max-width: 900px)").matches) toast(T("Pop-up open. For always-on-top, use Chrome or Edge."));
    }
    mountPopup(w);
  }

  // construiește conținutul pop-up-ului într-o fereastră (pop-up, PiP sau ecranul mare din ?screen=1)
  function mountPopup(w) {
    const d = w.document;
    const screen = d.body.classList.contains("screen");
    d.title = "KAIROS · " + T("Now");
    d.documentElement.lang = window.KI18N ? (window.KI18N.lang === "zh" ? "zh-Hans" : window.KI18N.lang) : "en";
    const fonts = `<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,600;125,700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">`;
    d.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#05070d">${fonts}<style>${screen ? SCREEN_CSS : POPUP_CSS}</style>`;
    if (screen) {
      // ecranul de broadcast: același aspect ca până acum, doar textele în engleză și marca KAIROS corectă
      d.body.innerHTML = `<div class="aur" id="paur"></div>
      <div class="main">
        <div class="k">${MARK_SVG.replace('class="mk"', 'width="14" height="14" style="flex:none"')}<span class="dot"></span><span id="pl">${T("NOW")}</span><span class="sp"></span><button class="tg" id="ptg" title="${T("Prompter (T)")}">${T("PROMPTER")}</button><span class="clock" id="pc"></span></div>
        <div><div class="t" id="pt">—</div><div class="meta" id="pm"></div></div>
        <div class="time" id="pr">--:--</div>
        <div class="bar"><i id="pb"></i></div>
        <div class="tw"><div class="talk" id="pk"><div class="lbl">${T("WHAT’S SAID")}</div><p id="pkt"></p></div><div class="guide"></div></div>
        <div class="ctl">
          <button class="play" id="pp" title="${T("Start / pause (Space)")}">▶ ${T("Start@@prompter")}</button>
          <button id="ps-" title="${T("Slower (↓)")}">−</button><span class="v" id="pv"></span><button id="ps+" title="${T("Faster (↑)")}">+</button>
          <button id="pa-" title="${T("Smaller text (-)")}">A−</button><button id="pa+" title="${T("Bigger text (+)")}">A+</button>
          <button id="pz" title="${T("Back to the top (R)")}">↺</button><button id="pmr" title="${T("Mirrored, for a glass prompter (M)")}">⇋</button>
        </div>
      </div>
      <div class="next"><span class="nd"></span><span class="nl">${T("NEXT")}</span><span class="nt" id="nt">—</span><span class="ni" id="pi"></span></div>
      <div class="next after" id="pafter"><span class="nd"></span><span class="nl">${T("THEN")}</span><span class="nt" id="nt2">—</span><span class="ni" id="pi2"></span></div>`;
      buildAurora(d.getElementById("paur"), 911);
    } else {
      d.body.innerHTML = `<div class="aur" id="paur"></div>
      <div class="k">${MARK_SVG}<span class="sp"></span><span class="clock" id="pc"></span></div>
      <div class="main">
        <div><div class="trow"><span class="cue" id="pq"></span><h1 class="t" id="pt">—</h1></div><div class="meta"><span class="st"><span class="dot"></span><span id="pl">${T("Now")}</span></span><span class="mrest" id="pm"></span></div></div>
        <div class="time" id="pr" role="timer" aria-label="${T("Time left")}">--:--</div>
        <div class="bar"><i id="pb"></i></div>
        <div class="tw"><div class="talk" id="pk"><div class="lbl">${T("What’s said")}</div><p id="pkt"></p></div><div class="guide"></div></div>
        <div class="ctl" aria-label="${T("Prompter controls")}">
          <button class="play" id="pp" title="${T("Start / pause (Space)")}">${T("Start@@prompter")}</button>
          <span class="v" id="pv"></span>
          <button id="ps-" title="${T("Slower (↓)")}" aria-label="${T("Slower")}">${T("Slower")}</button><button id="ps+" title="${T("Faster (↑)")}" aria-label="${T("Faster")}">${T("Faster")}</button>
          <button id="pa-" title="${T("Smaller text (-)")}" aria-label="${T("Smaller text")}">A−</button><button id="pa+" title="${T("Bigger text (+)")}" aria-label="${T("Bigger text")}">A+</button>
          <button id="pz" title="${T("Back to the top (R)")}">${T("Top")}</button><button id="pmr" title="${T("Mirrored, for a glass prompter (M)")}">${T("Mirror")}</button>
        </div>
      </div>
      <div class="tr">
        <button class="back" id="pback" title="${T("Back (B)")}" aria-label="${T("Back to the previous segment")}">${IC.prev}${T("Back")}</button>
        <button class="go" id="pgo">${T("Next")}</button>
        <button class="ptg" id="ptg" title="${T("Prompter (T)")}" aria-pressed="false">${T("Prompter")}</button>
      </div>
      <div class="next"><span class="sb" id="psb">${T("STANDBY")}</span><span class="nq" id="pnq"></span><span class="nt" id="nt">—</span><span class="ni" id="pi"></span></div>
      <div class="next after" id="pafter"><span class="nt" id="nt2"></span><span class="ni" id="pi2"></span></div>`;
      buildAurora(d.getElementById("paur"), 911);
      d.getElementById("pgo").onclick = (e) => go(e.currentTarget);
      d.getElementById("pback").onclick = prev;
    }
    popupWin = w;
    promptTextKey = "";

    const g = (id) => d.getElementById(id);
    const talk = g("pk");
    const sync = () => {
      d.body.classList.toggle("prompt", prompter.on);
      d.body.classList.toggle("mirror", prompter.mirror);
      g("ptg").classList.toggle("on", prompter.on); g("ptg").setAttribute("aria-pressed", prompter.on);
      g("pp").textContent = screen ? (prompter.playing ? "❚❚ " + T("Pause") : "▶ " + T("Start@@prompter")) : (prompter.playing ? T("Pause") : T("Start@@prompter"));
      g("pv").textContent = screen ? `${prompter.speed}px/s` : T("Speed {n}", { n: speedStep() });
      d.body.style.setProperty("--ps", prompter.size + "px");
      savePrompter();
    };
    const act = {
      toggle() { prompter.on = !prompter.on; prompter.playing = false; talk.scrollTop = 0; sync(); },
      play() { if (!prompter.on) { prompter.on = true; } prompter.playing = !prompter.playing; promptLast = 0; sync(); },
      slower() { prompter.speed = Math.max(5, prompter.speed - 5); sync(); },
      faster() { prompter.speed = Math.min(200, prompter.speed + 5); sync(); },
      smaller() { prompter.size = Math.max(18, prompter.size - 2); sync(); },
      bigger() { prompter.size = Math.min(80, prompter.size + 2); sync(); },
      top() { talk.scrollTop = 0; promptAcc = 0; },
      mirror() { prompter.mirror = !prompter.mirror; sync(); }
    };
    g("ptg").onclick = act.toggle; g("pp").onclick = act.play;
    g("ps-").onclick = act.slower; g("ps+").onclick = act.faster;
    g("pa-").onclick = act.smaller; g("pa+").onclick = act.bigger;
    g("pz").onclick = act.top; g("pmr").onclick = act.mirror;
    d.addEventListener("keydown", (e) => {
      const k = e.key;
      if (e.repeat && (k === "n" || k === "N" || k === "b" || k === "B")) return;
      if (k === " ") { e.preventDefault(); act.play(); }
      else if (k === "ArrowUp") { e.preventDefault(); act.faster(); }
      else if (k === "ArrowDown") { e.preventDefault(); act.slower(); }
      else if (k === "+" || k === "=") act.bigger();
      else if (k === "-") act.smaller();
      else if (k === "r" || k === "R") act.top();
      else if (k === "t" || k === "T") act.toggle();
      else if (k === "m" || k === "M") act.mirror();
      else if ((k === "n" || k === "N") && !SCREEN) { if (state.mode === "live") go(true); }
      else if ((k === "b" || k === "B") && !SCREEN) prev();
      else if (k === "f" || k === "F") { const el = d.documentElement; if (d.fullscreenElement) d.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); }
    });
    // derularea prompter-ului, lină, pe ceasul ferestrei; bucla rulează doar cât prompterul chiar derulează
    let raf = 0;
    const step = (ts) => {
      raf = 0;
      if (!popupWin || popupWin.closed || !(prompter.on && prompter.playing)) { promptLast = 0; return; }
      if (promptLast) {
        promptAcc += prompter.speed * (ts - promptLast) / 1000;
        const whole = Math.floor(promptAcc);
        if (whole) { talk.scrollTop += whole; promptAcc -= whole; }
      }
      promptLast = ts; raf = w.requestAnimationFrame(step);
    };
    const kick = () => { if (!raf && prompter.on && prompter.playing) raf = w.requestAnimationFrame(step); };
    w.__kick = kick;
    const play = act.play; act.play = () => { play(); kick(); }; g("pp").onclick = act.play;
    w.addEventListener("pagehide", () => { popupWin = null; });
    sync();
    tick();
  }

  function renderPopup(pos) {
    if (!popupWin || popupWin.closed) return;
    const d = popupWin.document; const g = (id) => d.getElementById(id); if (!g("pt")) return;
    const screen = d.body.classList.contains("screen");
    const now = new Date(nowMs());
    g("pc").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const hexOf = (it) => (it && CAT_HEX[it.cat]) || "#3d7bff";
    d.body.style.setProperty("--ac", accentFor(pos));
    d.body.style.setProperty("--nc", hexOf(pos.next));
    d.body.classList.toggle("is-live", pos.mode === "live");
    d.body.classList.toggle("ro", !canEdit());
    let text = "";
    if (pos.cur) {
      g("pl").textContent = screen ? (pos.mode === "live" ? (state.advance === "auto" ? T("NOW · LIVE · AUTO") : T("NOW · LIVE · MANUAL")) : T("NOW · BY THE PLAN"))
        : (pos.mode === "live" ? T(state.advance === "auto" ? "Live · Auto" : "Live · Manual") : T("Plan"));
      if (g("pq")) g("pq").textContent = `Q${pos.idx + 1}`;
      g("pt").textContent = pos.cur.title;
      let meta = `<span>${hhmm(pos.off[pos.cur.id])} · ${T("{n} min", { n: pos.cur.min })}</span>${pos.cur.who ? `<span>${esc(pos.cur.who)}</span>` : ""}`;
      const dt = driftText(pos);
      if (dt.text && (screen ? dt.cls !== "ok" : true)) meta += `<span class="drift ${dt.cls}">${esc(dt.text)}</span>`;
      if (!screen) g("pm").innerHTML = meta;
      else g("pm").innerHTML = `${hhmm(pos.off[pos.cur.id])} · ${T("{n} min", { n: pos.cur.min })}${pos.cur.who ? " · " + esc(pos.cur.who) : ""}${dt.cls === "late" || dt.cls === "early" ? ` · <span class="drift ${dt.cls}">${esc(dt.text)}</span>` : ""}`;
      g("pr").textContent = fmtDur(pos.remain);
      g("pr").className = "time" + (pos.remain < 0 ? " over" : pos.remain < 60000 ? " last" : "");
      g("pb").style.width = Math.min(100, Math.max(0, (pos.elapsed / (pos.durMs || 1)) * 100)) + "%";
      text = prompter.on ? ((pos.cur.script || "").trim() || pos.cur.talk || "") : (pos.cur.talk || "");
    } else {
      g("pl").textContent = screen ? (pos.mode === "pre" ? T("BEFORE THE SHOW") : T("SHOW ENDED")) : (pos.mode === "pre" ? T("Before the show") : T("Show ended"));
      if (g("pq")) g("pq").textContent = "";
      g("pt").textContent = pos.mode === "pre" ? T("Starts in") : T("Thank you!");
      g("pm").textContent = ""; g("pr").textContent = pos.mode === "pre" ? fmtDur(pos.nextInMs) : "00:00"; g("pr").className = "time";
      g("pb").style.width = pos.mode === "post" ? "100%" : "0%";
    }
    { const t = g("pr"); t.classList.toggle("long", t.textContent.length > 6); }   // timp lung (ore/zile): mai mic, ca să rămână pe un rând
    // butonul mare din pop-up urmează butonul din bara de sus
    const pgo = g("pgo");
    if (pgo && pgo.dataset.armed !== "1") {
      const live = state.mode === "live", running = live && state.live.running && !state.live.ended, last = running && state.live.idx >= segs().length - 1;
      pgo.textContent = !live ? T("Go live") : state.live.ended ? T("Show ended") : running ? (last ? T("End show") : T("Next")) : T("Start show");
      pgo.disabled = live && !!state.live.ended; pgo.classList.toggle("end", last);
      g("pback").disabled = !running || state.live.idx <= 0;
    }
    // textul se schimbă doar când se schimbă segmentul sau modul, ca să nu sară derularea
    const key = (pos.cur ? pos.cur.id : pos.mode) + "|" + prompter.on + "|" + text;
    if (key !== promptTextKey) {
      const segChanged = !promptTextKey || promptTextKey.split("|")[0] !== key.split("|")[0];
      promptTextKey = key;
      g("pkt").textContent = text;
      if (segChanged) { g("pk").scrollTop = 0; promptAcc = 0; }
    }
    if (popupWin.__kick) popupWin.__kick();
    if (pos.next) {
      g("pi").textContent = pos.nextInMs != null && pos.nextInMs >= 0 ? T("in {d}", { d: fmtDur(pos.nextInMs) }) : T("due now");
      g("nt").textContent = pos.next.title;
      if (g("pnq")) g("pnq").textContent = `Q${segIndex(pos.next.id) + 1}`;
      if (g("psb")) { g("psb").textContent = pos.mode === "live" ? T("STANDBY") : T("NEXT"); g("psb").hidden = false; }
    } else { g("pi").textContent = ""; g("nt").textContent = "—"; if (g("pnq")) g("pnq").textContent = ""; if (g("psb")) g("psb").hidden = true; }
    // al doilea eveniment de după cel activ (se vede doar pe ecranul mare, cu prompterul oprit)
    const after = pos.next ? pos.after : null;
    g("pafter").style.visibility = after ? "" : "hidden";
    if (after) {
      d.body.style.setProperty("--nc2", hexOf(after));
      g("nt2").textContent = after.title;
      const inMs = pos.nextInMs != null ? Math.max(0, pos.nextInMs) + (pos.next.min || 0) * 60000 : null;
      g("pi2").textContent = inMs != null ? T("in {d}", { d: fmtDur(inMs) }) : "";
    }
  }

  $("#btnPopup").onclick = openPopup;

  /* ---------------- meniu, setări, import/export ---------------- */
  const setMenu = (open) => { $("#menuList").hidden = !open; $("#btnMenu").setAttribute("aria-expanded", open); if (open) { const f = $("#menuList button:not([hidden])"); if (f && !mqMobile.matches) f.focus(); } };
  $("#btnMenu").onclick = (e) => { e.stopPropagation(); setMenu($("#menuList").hidden); };
  document.addEventListener("click", (e) => { if (!e.target.closest("#menuList")) setMenu(false); });
  // avatarul deschide același meniu (pe mobil e singurul buton din dreapta sus)
  $("#account").addEventListener("click", (e) => {
    if (!e.target.closest(".who-chip")) return;
    e.stopPropagation(); setMenu($("#menuList").hidden);
  });
  // mobil: Plan/Live și Auto/Manual intră în meniu, iar meniul devine bottom sheet
  // (îl mutăm în <body>, pentru că backdrop-filter de pe topbar strică position:fixed)
  const mqMobile = window.matchMedia("(max-width: 900px)");
  function placeForViewport() {
    const list = $("#menuList"), main = $(".ctl-main");
    if (mqMobile.matches) {
      $("#mmMode").append($("#modeSeg")); $("#mmAdv").append($("#advSeg"));
      document.body.append(list);
    } else {
      main.prepend($("#advSeg")); main.prepend($("#modeSeg"));
      $(".menu").append(list);
    }
    list.hidden = true;
  }
  mqMobile.addEventListener("change", placeForViewport); placeForViewport();
  // limba interfeței: schimbarea reîncarcă pagina (show-ul și Live-ul sunt salvate; pop-up-ul se închide)
  if (window.KI18N && $("#langSlot")) {
    const ls = window.KI18N.select(); $("#langSlot").append(ls);
    ls.addEventListener("click", (e) => e.stopPropagation());
    window.KI18N.beforeChange = () => {
      const open = popupWin && !popupWin.closed;
      if (!open && !(state.mode === "live" && state.live.running)) return true;
      return confirm(T("Changing the language reloads this page. The show keeps running for everyone; the pop-up closes and you open it again. Continue?"));
    };
  }
  $("#menuList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    setMenu(false);
    if (a === "keys") $("#keysDlg").showModal();
    if (a === "export") exportJSON();
    if (a === "import") $("#importFile").click();
    if (a === "importScripts") $("#scriptsFile").click();
    if (a === "print") window.print();
    if (a === "screen") copyScreenLink();
    if (a === "prompter") { const u = new URL(screenUrl()); u.searchParams.set("prompter", "1"); location.href = u.toString(); }
    if (a === "settings") openSettings();
    if (a === "team") openTeam();
    if (a === "home") location.href = "./";
    if (a === "preview") window.open($("#btnPreview").href, "_blank", "noopener");
    if (a === "signout" && S) S.signOut();
    if (a === "reset" && window.confirm(T(cloud() ? "Replace “{t}” with the sample rundown for the whole team? You can undo with Ctrl+Z right after." : "Replace “{t}” with the sample rundown? You can undo with Ctrl+Z right after.", { t: state.show.title || T("this rundown") }))) {
      snapshot(); const keep = { mode: state.mode, advance: state.advance, live: state.live }; state = { ...fromDefault(), ...keep };
      save(); pushItems(); renderAll(); toast(cloud() ? T("The default rundown is loaded for the whole team · Ctrl+Z to undo") : T("The default rundown is loaded · Ctrl+Z to undo"));
    }
  });

  function exportJSON() {
    const data = { version: 1, show: state.show, items: state.items.map(({ id, ...rest }) => rest) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ta-rundown-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.items)) throw new Error("no items");
      snapshot();
      state.show = { ...state.show, ...(d.show || {}) };
      state.items = d.items.map((it) => ({ id: uid(), type: "segment", min: 5, cat: "platforma", title: "", video: "", gfx: "", talk: "", who: "", ...it }));
      save(); pushItems(); renderAll(); toast(T("Imported: {n} segments", { n: segs().length }));
    } catch (err) { toast(T("That file isn't a KAIROS rundown (JSON export)")); }
    e.target.value = "";
  });

  // scripturi de prompter dintr-un fișier { "scripts": { "Titlu segment": "text" } }:
  // atinge doar câmpul Script, potrivit după titlu; ID-urile, comentariile și muzica rămân neatinse
  $("#scriptsFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (!canEdit()) return toast(T("Only editors can change scripts"));
    let map;
    try { const d = JSON.parse(await f.text()); map = d && typeof d.scripts === "object" ? d.scripts : d; if (!map || typeof map !== "object" || Array.isArray(map)) throw 0; }
    catch (err) { return toast(T("That file isn't a scripts file ({ \"scripts\": { \"Segment title\": \"text\" } })")); }
    const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
    const byTitle = new Map(segs().map((it) => [norm(it.title), it]));
    const hits = [], miss = [];
    for (const [t, v] of Object.entries(map)) { const it = byTitle.get(norm(t)); if (it && typeof v === "string") hits.push([it, v]); else miss.push(t); }
    const changed = hits.filter(([it, v]) => (it.script || "") !== v);
    if (!changed.length) return toast(miss.length ? T("No new scripts. Titles not found: {n}", { n: miss.length }) : T("Scripts are already up to date"));
    const msg = T("Replace the script on {n} segments? The rest of the rundown stays as it is.", { n: changed.length })
      + (miss.length ? "\n\n" + T("Not found in the rundown: {list}", { list: miss.join(", ") }) : "");
    if (!confirm(msg)) return;
    snapshot();
    for (const [it, v] of changed) {
      it.script = v;
      if (cloud()) { localDirty.set(`${it.id}.script`, v); S.field(it.id, "script", v); }
    }
    save(); renderTable(); tick();
    toast(T("Scripts updated: {n}", { n: changed.length }) + (miss.length ? " · " + T("not found: {n}", { n: miss.length }) : ""));
  });

  function openSettings() {
    const dlg = $("#settingsDlg"); const f = dlg.querySelector("form");
    f.title.value = state.show.title || ""; f.date.value = state.show.date || ""; f.start.value = state.show.start || ""; f.venue.value = state.show.venue || "";
    dlg.showModal();
    dlg.onclose = () => {
      if (dlg.returnValue !== "ok") return;
      state.show = { ...state.show, title: f.title.value, date: f.date.value, start: f.start.value || "15:00", venue: f.venue.value };
      save(); pushItems(); renderAll();
    };
  }

  let toastT = null;
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3200);
  }
  // erorile Firebase devin propoziții: ce nu a mers și ce poți face, fără coduri tehnice
  function friendlyErr(what, err) {
    const c = String((err && (err.code || err.message)) || "");
    if (/permission|unauth/i.test(c)) return T("{what}: you don't have permission for this rundown.", { what });
    if (/unavailable|network|offline|deadline/i.test(c)) return T("{what}: no connection. Check the internet and try again.", { what });
    return T("{what}. Try again.", { what });
  }

  /* ---------------- tastatură ---------------- */
  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest && e.target.closest("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); return undo(); }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.repeat) return;
    if (e.key === "n" || e.key === "N") { if (state.mode === "live") go(true); }
    if (e.key === "b" || e.key === "B") prev();
    if (e.key === "p" || e.key === "P") openPopup();
    if (e.key === "Escape") { if (!$("#menuList").hidden) { setMenu(false); $("#btnMenu").focus(); } $$("[data-armed='1']").forEach(disarm); }
    if (e.key === "?") $("#keysDlg").showModal();
  });

  /* ---------------- aurora (fundalul cardurilor de sus și al ecranului de broadcast) ---------------- */
  function buildAurora(el, seed) {
    let r = seed;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    let html = "";
    for (let i = 0; i < 16; i++) {
      const x = (i / 16) * 100 + rnd() * 5 - 2;
      const w = 18 + rnd() * 70, b = 6 + rnd() * 16, o = (0.35 + rnd() * 0.6).toFixed(2);
      const d = (6 + rnd() * 9).toFixed(1), p = (4 + rnd() * 6).toFixed(1), dl = (-rnd() * 10).toFixed(1);
      html += `<span class="beam" style="--x:${x.toFixed(1)}%;--w:${w.toFixed(0)}px;--b:${b.toFixed(0)}px;--o:${o};--d:${d}s;--p:${p}s;--dl:${dl}s"></span>`;
    }
    el.innerHTML = html;
  }

  /* ---------------- cloud: rundown comun, Live comun, cont ---------------- */
  let needsRender = false;
  function focusedCell() { const a = document.activeElement; return a && a.classList && a.classList.contains("cell") && $("#rows").contains(a); }
  $("#rows").addEventListener("focusout", () => setTimeout(() => { if (needsRender && !focusedCell()) { needsRender = false; renderTable(); } }, 0));

  function applyRemote(data) {
    if (!data) {                       // cloud gol: primul editor urcă rundown-ul lui
      if (LEGACY && cloud() && canEdit()) { pushItems(); toast(T("The rundown is now shared with the whole team")); }
      else if (!LEGACY && cloud()) toast(T("This rundown doesn't exist, or you don't have access to it."));
      return;
    }
    const items = data.items.map((it) => {
      const o = { ...it };
      for (const [k, v] of localDirty) {
        const [id, f] = k.split(".");
        if (id !== it.id) continue;
        if (String(o[f]) === String(v)) localDirty.delete(k); else o[f] = v;
      }
      return o;
    });
    state.show = { ...state.show, ...data.show }; state.items = items; save();
    $("#showTitle").textContent = state.show.title;
    $("#showMeta").textContent = `${fmtDate()} · ${state.show.start} · ${state.show.venue || ""}`;
    if (focusedCell()) needsRender = true; else renderTable();
    tick();
  }
  function applyLive(d) {
    const prevKey = `${state.live.running}|${state.live.idx}|${state.live.itemStart}`;
    state.mode = d.mode || "plan"; state.advance = d.advance || "manual";
    let idx = Number.isFinite(d.idx) ? d.idx : -1;
    if (d.curId) { const i = segIndex(d.curId); if (i >= 0) idx = i; }
    state.live = { running: !!d.running, idx, itemStart: d.itemStart || 0, showStart: d.showStart || 0, ended: !!d.ended, endedAt: d.endedAt || 0 };
    noteStart();
    save(); renderMode(); tick();
    if (prevKey !== `${state.live.running}|${state.live.idx}|${state.live.itemStart}`) scrollToCurrent();
  }

  const ROLE_LABEL = { owner: T("Owner"), editor: T("Editor"), viewer: T("Read only"), local: "" };
  function renderAccount() {
    const el = $("#account"); if (!el) return;
    const st = S ? S.status : "local";
    if (!S || !S.ready) { el.innerHTML = ""; return; }
    if (!S.user) {
      el.innerHTML = `<button class="btn" data-signin title="${T("Sign in to work on the shared rundown")}">${T("Sign in with Google")}</button>`;
    } else {
      const u = S.user; const ini = esc((u.name || u.email || "?").trim().charAt(0).toUpperCase());
      const stl = T(st === "online" ? "Synced" : st === "error" ? "Sync error" : "Connecting…");
      el.innerHTML = `<span class="sync-dot ${st}" role="img" aria-label="${stl}" title="${stl}"></span>
        <span class="who-chip" title="${esc(u.email)}">${u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${ini}</i>`}<span>${esc((u.name || "").split(" ")[0])}</span><em>${ROLE_LABEL[S.role] || ""}</em></span>`;
    }
    document.body.classList.toggle("cloud", !!S.user);
    document.body.classList.toggle("ro", !canEdit());
    document.body.classList.toggle("is-owner", !!(S.user && S.isOwner()));
    document.body.classList.toggle("is-admin", !!(S.user && S.isAdmin));
  }
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-signin]") || !S) return;
    try { await S.signIn(); } catch (err) { toast(err && /popup-closed|cancelled/.test(err.code || "") ? T("Sign-in was cancelled") : T("Sign-in didn't work. Check your connection and try again.")); }
  });

  function openTeam() {
    if (!S || !S.user || !S.isOwner()) return;
    const dlg = $("#teamDlg"); const f = dlg.querySelector("form");
    f.emails.value = (S.showMeta.editors || []).join("\n");
    dlg.showModal();
    dlg.onclose = async () => {
      if (dlg.returnValue !== "ok") return;
      try { await S.setEditors(f.emails.value.split(/[\s,;]+/)); toast(T("Editors saved")); }
      catch (err) { toast(friendlyErr(T("Couldn't save the editors"), err)); }
    };
  }
  // linkul de invitație: îl generezi și îl trimiți, cine îl acceptă devine editor
  $("#inviteMake").onclick = async () => {
    try {
      const r = await S.createInvite({ showId: S.showId, showTitle: state.show.title || "", team: $("#inviteTeam").checked });
      $("#inviteUrl").value = r.url; $("#inviteCopy").disabled = false; $("#inviteUrl").select();
      toast(T("Link created, valid for 7 days"));
    } catch (err) { toast(friendlyErr(T("Couldn't create the link"), err)); }
  };
  $("#inviteCopy").onclick = async () => {
    const v = $("#inviteUrl").value; if (!v) return;
    try { await navigator.clipboard.writeText(v); toast(T("Link copied")); } catch (e) { $("#inviteUrl").select(); toast(T("Selected: press Ctrl+C")); }
  };
  $("#inviteRevoke").onclick = async () => {
    try { const n = await S.revokeInvites(S.showId); $("#inviteUrl").value = ""; $("#inviteCopy").disabled = true; toast(n ? T("Your invite links are disabled") : T("You had no active links")); }
    catch (err) { toast(friendlyErr(T("That didn't work"), err)); }
  };

  /* ---------------- comentarii ---------------- */
  let drawerSeg = null; // null = toate
  const openComments = () => (S ? S.comments : []).filter((c) => !c.resolved);
  function renderCommentBadges() {
    const counts = {};
    openComments().forEach((c) => { counts[c.segId] = (counts[c.segId] || 0) + 1; });
    $$("#rows tr.seg-row").forEach((tr) => {
      const n = counts[tr.dataset.id] || 0; const b = tr.querySelector(".cmt-btn"); if (!b) return;
      b.classList.toggle("has", n > 0); b.querySelector(".n").textContent = n ? n : "";
    });
    const total = openComments().length;
    $("#cmtCount").textContent = total ? total : "";
  }
  function timeAgo(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return T("just now"); if (s < 3600) return T("{n} min ago", { n: Math.floor(s / 60) });
    if (s < 86400) return T("{n} h ago", { n: Math.floor(s / 3600) });
    const d = new Date(ms); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function openDrawer(segId) {
    drawerSeg = segId || null;
    $("#drawer").hidden = false; document.body.classList.add("drawer-open");
    renderDrawer();
    if (drawerSeg && S && S.user) setTimeout(() => $("#cmtText").focus(), 50);
  }
  function closeDrawer() { $("#drawer").hidden = true; document.body.classList.remove("drawer-open"); }
  function renderDrawer() {
    if ($("#drawer").hidden) return;
    const seg = drawerSeg && state.items.find((i) => i.id === drawerSeg);
    $("#drawerTitle").textContent = seg ? (seg.title || T("Segment")) : T("Comments");
    $("#drawerLabel").textContent = seg ? `${T("Comments")} · Q${segIndex(seg.id) + 1} · ${hhmm(plannedOffsets()[seg.id] || 0)}` : T("All segments");
    $("#drawerAll").hidden = !seg;
    const showRes = $("#showResolved").checked;
    const list = (S ? S.comments : []).filter((c) => (!seg || c.segId === seg.id) && (showRes || !c.resolved));
    const me = S && S.user ? S.user.uid : null;
    $("#cmtList").innerHTML = list.length ? list.map((c) => {
      const segNow = state.items.find((i) => i.id === c.segId);
      return `<article class="cmt ${c.resolved ? "resolved" : ""}" data-id="${esc(c.id)}">
        <header>${c.photo ? `<img src="${esc(c.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${esc((c.name || "?").charAt(0).toUpperCase())}</i>`}
          <b>${esc(c.name || T("Anonymous"))}</b><span>${esc(timeAgo(c.createdAt))}</span>${c.kind === "text" ? `<span class="tag">${T("Script suggestion")}</span>` : ""}</header>
        ${!seg ? `<button class="seg-link" data-goto="${esc(c.segId)}">${esc(segNow ? segNow.title : c.segTitle || T("deleted segment"))}</button>` : ""}
        <p>${esc(c.text)}</p>
        <footer>
          ${canEdit() && cloud() && c.kind === "text" && segNow ? `<button class="mini" data-c="apply">${T("Use as “What’s said”")}</button>` : ""}
          ${canEdit() && cloud() ? `<button class="mini" data-c="resolve">${c.resolved ? T("Reopen") : T("Resolve")}</button>` : ""}
          ${cloud() && (canEdit() || c.uid === me) ? `<button class="mini del" data-c="del">${T("Delete")}</button>` : ""}
        </footer></article>`;
    }).join("") : `<p class="empty">${seg ? T("No comments on this segment yet.") : T("No open comments.")}</p>`;
    const signed = !!(S && S.user);
    $("#composer").hidden = !signed || !seg;
    $("#signinBox").hidden = signed || !(S && S.ready);
    $("#composerHint").textContent = signed && seg ? T("as {name}", { name: S.user.name || S.user.email }) : "";
    if (signed && !seg) $("#cmtList").insertAdjacentHTML("beforeend", `<p class="empty">${T("To write a comment, open it from its segment (the speech-bubble button on the row).")}</p>`);
  }
  $("#btnComments").onclick = () => openDrawer(null);
  $("#drawerClose").onclick = closeDrawer;
  $("#drawerAll").onclick = () => { drawerSeg = null; renderDrawer(); };
  $("#showResolved").onchange = renderDrawer;
  $("#cmtList").addEventListener("click", async (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) { drawerSeg = g.dataset.goto; renderDrawer(); const tr = $(`#rows tr[data-id="${g.dataset.goto}"]`); if (tr) tr.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
    const b = e.target.closest("[data-c]"); if (!b || !S) return;
    const id = b.closest(".cmt").dataset.id; const c = S.comments.find((x) => x.id === id); if (!c) return;
    try {
      if (b.dataset.c === "resolve") await S.resolveComment(id, !c.resolved);
      if (b.dataset.c === "del" && window.confirm(T("Delete this comment?"))) await S.deleteComment(id);
      if (b.dataset.c === "apply") {
        const it = state.items.find((i) => i.id === c.segId); if (!it) return;
        snapshot(); it.talk = c.text; save(); pushItems(); renderTable(); tick();
        await S.resolveComment(id, true); toast(T("Moved into “What’s said”"));
      }
    } catch (err) { toast(friendlyErr(T("That didn't work"), err)); }
  });
  $("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#cmtText").value.trim(); if (!text || !drawerSeg || !S) return;
    const seg = state.items.find((i) => i.id === drawerSeg);
    const kind = $("#composer").querySelector("input[name=kind]:checked").value;
    $("#cmtSend").disabled = true;
    try { await S.addComment({ segId: drawerSeg, segTitle: seg ? seg.title : "", text, kind }); $("#cmtText").value = ""; toast(T("Comment sent")); }
    catch (err) { toast(friendlyErr(T("The comment wasn't sent"), err)); }
    $("#cmtSend").disabled = false;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer(); });

  if (S) {
    S.on("auth", () => { renderAccount(); renderTable(); renderMode(); renderDrawer(); });
    S.on("status", renderAccount);
    S.on("show", applyRemote);
    S.on("live", applyLive);
    S.on("comments", () => { renderCommentBadges(); renderDrawer(); });
  }

  if (S && !LEGACY) { const pv = $("#btnPreview"); if (pv) pv.href = `client.html?id=${encodeURIComponent(S.showId)}`; }

  $$(".hero .aurora").forEach((el, i) => buildAurora(el, 17 + i * 101));
  // luminile se opresc când tab-ul nu se vede (economisește bateria laptopului de regie)
  document.addEventListener("visibilitychange", () => document.body.classList.toggle("paused", document.hidden));

  // capul de tabel rămâne lipit sub bara de sus (și sub banda cu timerul, în Live)
  const setStick = () => {
    const tb = $(".topbar").offsetHeight, h = $(".hero"), live = document.body.classList.contains("mode-live") && innerWidth > 900;
    document.documentElement.style.setProperty("--stick", `${tb + (live ? h.offsetHeight + 16 : 0)}px`);
  };
  new ResizeObserver(setStick).observe($(".hero")); new MutationObserver(setStick).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  addEventListener("resize", setStick);

  /* ---------------- pornire ---------------- */
  function renderAll() {
    $("#showTitle").textContent = state.show.title;
    $("#showMeta").textContent = `${fmtDate()} · ${state.show.start} · ${state.show.venue || ""}`;
    renderFilters(); renderTable(); renderMode(); renderAccount(); tick();
  }
  /* ---------------- ecranul mare ---------------- */
  function screenUrl() {
    const u = new URL(location.href); u.hash = ""; u.searchParams.set("screen", "1");
    if (S && S.showId && !u.searchParams.get("id") && !LEGACY) u.searchParams.set("id", S.showId);
    return u.toString();
  }
  async function copyScreenLink() {
    const url = screenUrl();
    try { await navigator.clipboard.writeText(url); toast(T("Screen link copied. Open it on the screen computer, signed in with Google.")); }
    catch (e) { prompt(T("Screen link:"), url); }
  }
  function mountScreen() {
    document.documentElement.style.overflow = "hidden";
    const f = Object.assign(document.createElement("iframe"), { title: "KAIROS · " + T("Screen") });
    f.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483647;background:#000";
    document.body.appendChild(f);
    const fd = f.contentDocument; fd.open(); fd.write("<!doctype html><html><head></head><body></body></html>"); fd.close();
    fd.body.classList.add("screen");
    if (new URLSearchParams(location.search).get("prompter") === "1") prompter.on = true;   // &prompter=1: pornește direct cu prompterul
    mountPopup(f.contentWindow);
    // butoanele (Prompter, Start, viteză…) apar doar când miști mouse-ul, apoi dispar după 3 s
    let uiT = 0;
    const showUi = () => { fd.body.classList.add("ui"); clearTimeout(uiT); uiT = setTimeout(() => fd.body.classList.remove("ui"), 3000); };
    fd.addEventListener("mousemove", showUi);
    fd.addEventListener("pointerdown", showUi);   // tabletă: o atingere arată butoanele
    // ecranul nu se stinge cât e deschis (tabletă/telefon folosit ca prompter)
    let wake = null;
    const keepAwake = async () => { try { if ("wakeLock" in navigator && document.visibilityState === "visible") wake = await navigator.wakeLock.request("screen"); } catch (e) {} };
    keepAwake(); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

    fd.title = document.title = `KAIROS · ${T("Screen")} · ${state.show.title || ""}`;
    f.contentWindow.focus();
    // dublu-clic = ecran complet
    fd.addEventListener("dblclick", () => { const el = fd.documentElement; if (fd.fullscreenElement) fd.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); });
  }

  renderAll();
  if (SCREEN) mountScreen();
  setInterval(tick, 250);
})();
