/* TA Rundown · aplicație de run-of-show fără build.
   Starea se ține în localStorage; tab-urile deschise în același browser se sincronizează între ele. */
(() => {
  "use strict";

  const KS0 = window.KSYNC;
  const LEGACY = !KS0 || KS0.isLegacy;
  // fiecare rundown își are copia lui locală; cel vechi (ta-2026) păstrează cheia de la început
  const STORE_KEY = LEGACY ? "ta-rundown-v1" : `ta-rundown-v1:${KS0.showId}`;
  const CATS = {
    live:      { label: "Meci live",   var: "--c-live" },
    interviu:  { label: "Interviu",    var: "--c-interviu" },
    grafica:   { label: "Grafică",     var: "--c-grafica" },
    platforma: { label: "Platformă",   var: "--c-platforma" },
    caritabil: { label: "Caritabil",   var: "--c-caritabil" },
    ing:       { label: "ING",         var: "--c-ing" },
    donatii:   { label: "Donații",     var: "--c-donatii" },
    giveaway:  { label: "Giveaway",    var: "--c-giveaway" },
    pauza:     { label: "Pauză / rezervă", var: "--c-pauza" }
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
      curId: cur ? cur.id : null, itemStart: state.live.itemStart || 0, showStart: state.live.showStart || 0 });
  }

  /* ---------------- stare ---------------- */
  let state = load();
  let hiddenCats = new Set();
  let undoStack = [];
  let popupWin = null;

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
      return { show: { title: "Se încarcă…", date: "", start: "18:00", venue: "" }, items: [], mode: "plan", advance: "manual",
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
    if (!prev) return toast("Nimic de anulat");
    state.items = JSON.parse(prev);
    save(); pushItems(); renderTable(); tick();
    toast("Anulat");
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
    if (days) body = `${days}z ${pad(h)}:${pad(m)}:${pad(s)}`;
    return (neg ? "−" : withSign ? "+" : "") + body;
  }

  // ce segment e acum: în Live după butoane, în Plan după ceas
  function position(now = nowMs()) {
    const list = segs(); const off = plannedOffsets();
    if (!list.length) return { cur: null, next: null, list, off };

    if (state.mode === "live" && state.live.running) {
      const idx = Math.min(Math.max(state.live.idx, 0), list.length - 1);
      const cur = list[idx];
      const elapsed = now - state.live.itemStart;
      const durMs = (Number(cur.min) || 0) * 60000;
      const plannedStartMs = off[cur.id] * 60000;
      const actualStartMs = state.live.itemStart - state.live.showStart;
      return { mode: "live", list, off, idx, cur, next: list[idx + 1] || null, after: list[idx + 2] || null,
        remain: durMs - elapsed, elapsed, durMs, drift: actualStartMs - plannedStartMs,
        nextInMs: durMs - elapsed };
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
  // categoriile cu culori neutre (alb/gri) nu se văd ca umplere: pe timeline primesc liliachiul KAIROS
  const TL_NEUTRAL = new Set(["platforma", "pauza"]);
  function renderTimeline() {
    const off = plannedOffsets(), total = off.__total || 1;
    tlSecs = []; let g = null;
    for (const it of state.items) {
      if (it.type === "header") { g = { id: it.id, title: (it.title || "").split("·")[0].trim(), segs: [] }; tlSecs.push(g); continue; }
      if (!g) { g = { id: null, title: "Show", segs: [] }; tlSecs.push(g); }
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
      `<button type="button" class="tl-sec" data-k="${k}" style="${TL_NEUTRAL.has(x.cat) ? "--cc:#8b6cff" : catStyle(x.cat)};left:${pct(x.from)}%;width:${pct(x.dur)}%" title="${esc(`${x.section ? x.section + " · " : ""}${x.title} · ${hhmm(x.from)}–${hhmm(x.from + x.dur)} · ${x.segs.length} segmente`)}"><span class="tl-fill"></span><canvas class="tl-cv" aria-hidden="true"></canvas><span class="tl-name">${esc(x.title.charAt(0) + x.title.slice(1).toLowerCase())}</span></button>`).join("");
    const start = showStartDate();
    let ticks = "";
    for (let m = start.getMinutes() ? 60 - start.getMinutes() : 0; m <= total; m += 60) ticks += `<span style="left:${pct(m)}%">${hhmm(m)}</span>`;
    $("#tlTicks").innerHTML = ticks;
    $("#tlStart").textContent = hhmm(0); $("#tlEnd").textContent = hhmm(total);
    $("#tlSum").textContent = `Show · ${Math.floor(total / 60)}h ${pad(total % 60)}m · ${segs().length} segmente`;
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
  }
  // secțiunea curentă: lichid care „se clatină” (slosh) — corp închis la culoare, front luminos și curbat care se leagănă
  const tlReduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function drawSlosh(now) {
    requestAnimationFrame(drawSlosh);
    const b = $("#tlBlocks .tl-sec.cur"); if (!b) return;
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
  requestAnimationFrame(drawSlosh);

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
      `<button class="chip ${hiddenCats.has(k) ? "off" : ""}" data-cat="${k}" style="${catStyle(k)}" title="Arată / ascunde">${esc(c.label)}</button>`).join("");
  }

  function renderTable() {
    renderTimeline();
    const off = plannedOffsets();
    let n = 0;
    const html = state.items.map((it) => {
      if (it.type === "header") {
        return `<tr class="header-row" data-id="${it.id}" draggable="false">
          <td class="drag" title="Trage ca să muți">⋮⋮</td>
          <td colspan="8"><input class="cell" data-f="title" value="${esc(it.title)}" aria-label="Titlu secțiune"></td>
          <td><div class="acts"><button class="icon del" data-a="del" title="Șterge secțiunea">✕</button></div></td></tr>`;
      }
      n++;
      return `<tr class="seg-row" data-id="${it.id}" style="${catStyle(it.cat)}">
        <td class="drag" title="Trage ca să muți">⋮⋮</td>
        <td class="num">${n}</td>
        <td class="start"><span data-start>${hhmm(off[it.id])}</span>
          <select class="cell cat" data-f="cat" aria-label="Tip">${Object.entries(CATS).map(([k, c]) =>
            `<option value="${k}" ${k === it.cat ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select></td>
        <td><input class="cell dur" data-f="min" inputmode="numeric" value="${esc(it.min)}" aria-label="Durată în minute"></td>
        <td>
          <textarea class="cell title-cell" data-f="title" rows="1" aria-label="Segment">${esc(it.title)}</textarea>
          ${musicCell(it)}
        </td>
        <td><textarea class="cell" data-f="video" rows="1" aria-label="Video">${esc(it.video)}</textarea></td>
        <td><textarea class="cell" data-f="gfx" rows="1" aria-label="Grafică">${esc(it.gfx)}</textarea></td>
        <td><textarea class="cell" data-f="talk" rows="1" aria-label="Ce se spune">${esc(it.talk)}</textarea>
          <textarea class="cell script-cell" data-f="script" rows="1" placeholder="+ script pentru prompter" aria-label="Script prompter">${esc(it.script)}</textarea></td>
        <td><textarea class="cell" data-f="who" rows="1" aria-label="Cine">${esc(it.who)}</textarea></td>
        <td><button class="cmt-btn" data-a="cmt" title="Comentarii la acest moment"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><span class="n"></span></button>
          <div class="acts">
          <button class="icon jump" data-a="jump" title="Live: sari aici">▶</button>
          <button class="icon" data-a="add" title="Segment nou dedesubt">＋</button>
          <button class="icon" data-a="dup" title="Duplică">⧉</button>
          <button class="icon del" data-a="del" title="Șterge">✕</button>
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

  // muzica segmentului: player (în rundown și în Preview) + încărcare / înlocuire / ștergere pentru cine editează
  function musicCell(it) {
    const up = uploading.get(it.id);
    if (up != null) return `<div class="music up"><span class="mname">♪ Se încarcă… ${Math.round(up * 100)}%</span><span class="mtrack"><span style="width:${up * 100}%"></span></span></div>`;
    const edit = canEdit() && cloud();
    if (it.music && it.music.url && window.KAudio) {
      return window.KAudio.html(it.music, edit ? `<div class="macts"><button type="button" class="icon" data-a="mrep" title="Altă piesă">↻</button><button type="button" class="icon del" data-a="mdel" title="Scoate muzica">✕</button></div>` : "");
    }
    return edit ? `<button type="button" class="madd" data-a="madd" title="Alege un fișier audio sau trage-l peste rând">♪ Muzică</button>` : "";
  }
  const uploading = new Map();
  let musicFor = null;
  const musicInput = Object.assign(document.createElement("input"), { type: "file", accept: "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac", hidden: true });
  document.body.appendChild(musicInput);
  musicInput.onchange = () => { const f = musicInput.files[0]; musicInput.value = ""; if (f && musicFor) attachMusic(musicFor, f); };
  async function attachMusic(id, file) {
    if (!cloud()) return toast("Conectează-te ca să urci muzică");
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
      toast(`Muzică adăugată: ${m.name}`);
      if (old && old.path) S.deleteMusic(old.path);
    } catch (e) {
      uploading.delete(id); renderTable();
      const c = e && (e.message || e.code) || "";
      toast(c === "not_audio" ? "Fișierul nu e audio (MP3, WAV, M4A…)" : c === "too_big" ? "Fișierul e prea mare (maxim 50 MB)"
        : /unauthorized|permission/i.test(c) ? "Nu ai drept să urci muzică aici" : /bucket|not-found|no_storage/i.test(c) ? "Stocarea pentru muzică nu e activată încă" : "Muzica nu s-a încărcat");
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
    $("#totalInfo").textContent = `${state.show.start} → ${end} · ${h}h ${pad(m)}m · ${segs().length} segmente`;
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
      tr.classList.toggle("past", (pos.mode === "post") || (!!curId && !seen && !isCur));
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
    if (a === "jump") return jumpTo(state.items[i].id);
    if (a === "cmt") return openDrawer(state.items[i].id);
    if (!canEdit()) return;
    if (a === "madd" || a === "mrep") { musicFor = state.items[i].id; musicInput.click(); return; }
    if (a === "mdel") {
      const it = state.items[i]; if (!it.music) return;
      if (!confirm(`Scoți muzica „${it.music.name}” de pe acest segment?`)) return;
      const path = it.music.path; snapshot(); delete it.music; save(); if (cloud()) { S.field(it.id, "music", null); S.deleteMusic(path); }
      if (window.KAudio) window.KAudio.stop(); renderTable(); return;
    }
    snapshot();
    if (a === "del") {
      const it = state.items[i];
      state.items.splice(i, 1);
      toast(`Șters: ${it.title || "rând"} · Ctrl+Z ca să revii`);
    } else if (a === "dup") {
      state.items.splice(i + 1, 0, { ...clone(state.items[i]), id: uid() });
    } else if (a === "add") {
      state.items.splice(i + 1, 0, newSeg());
    }
    save(); pushItems(); renderTable(); tick();
    if (a === "add") focusRow(state.items[i + 1].id);
  });

  function newSeg() { return { id: uid(), type: "segment", title: "Segment nou", min: 5, cat: "platforma", video: "", gfx: "", talk: "", script: "", who: "" }; }
  function focusRow(id) { const t = $(`#rows tr[data-id="${id}"] .title-cell`); if (t) { t.focus(); t.select(); } }

  $("#btnAddRow").onclick = () => { snapshot(); const s = newSeg(); state.items.push(s); save(); pushItems(); renderTable(); focusRow(s.id); tick(); };
  $("#btnAddHeader").onclick = () => {
    snapshot(); const h = { id: uid(), type: "header", title: "SECȚIUNE NOUĂ" }; state.items.push(h); save(); pushItems(); renderTable();
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

  $("#filters").addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]"); if (!c) return;
    const k = c.dataset.cat; hiddenCats.has(k) ? hiddenCats.delete(k) : hiddenCats.add(k);
    renderFilters(); applyFilters();
  });

  /* ---------------- live ---------------- */
  function setMode(m) {
    state.mode = m;
    if (m === "plan") state.live.running = false;
    save(); pushLive(); renderMode(); tick();
  }
  function renderMode() {
    $$(".seg-btn[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === state.mode));
    $$(".seg-btn[data-adv]").forEach((b) => b.classList.toggle("on", b.dataset.adv === (state.advance || "manual")));
    $("#advSeg").classList.toggle("show", state.mode === "live");
    const live = state.mode === "live";
    const running = live && state.live.running;
    $("#btnGo").textContent = !live ? "Treci pe Live" : running ? "Următorul ▶" : "Start show";
    $("#btnPrev").disabled = !running; $("#btnStop").disabled = !running;
    document.body.classList.toggle("live-on", running);
  }
  $$(".seg-btn[data-mode]").forEach((b) => b.onclick = () => setMode(b.dataset.mode));
  $$(".seg-btn[data-adv]").forEach((b) => b.onclick = () => {
    state.advance = b.dataset.adv; save(); pushLive(); renderMode(); tick();
    toast(state.advance === "auto" ? "Auto: la zero trece singur la segmentul următor" : "Manual: la zero timerul devine roșu până apeși „Următorul”");
  });

  // Auto: segmentul următor pornește exact când trebuia să se termine cel curent, ca întârzierile să nu se adune
  function autoAdvance(now) {
    if (state.mode !== "live" || !state.live.running || state.advance !== "auto") return false;
    const list = segs(); let moved = false;
    while (state.live.idx < list.length - 1) {
      const cur = list[state.live.idx];
      const end = state.live.itemStart + (Number(cur.min) || 0) * 60000;
      if (now < end) break;
      state.live.idx++; state.live.itemStart = end; moved = true;
    }
    if (moved) { save(); pushLive(); setTimeout(scrollToCurrent, 50); }
    return moved;
  }

  function go() {
    if (state.mode !== "live") return setMode("live");
    const now = nowMs(); const list = segs();
    if (!state.live.running) {
      state.live = { running: true, idx: 0, itemStart: now, showStart: now };
    } else if (state.live.idx < list.length - 1) {
      state.live.idx++; state.live.itemStart = now;
    } else {
      toast("Ăsta e ultimul segment");
    }
    save(); pushLive(); renderMode(); tick(); scrollToCurrent();
  }
  function prev() {
    if (!state.live.running || state.live.idx <= 0) return;
    state.live.idx--; state.live.itemStart = nowMs(); save(); pushLive(); tick(); scrollToCurrent();
  }
  function stop() {
    if (!state.live.running) return;
    if (!confirmInline("Oprești modul live? Cronometrul se resetează.")) return;
    state.live.running = false; save(); pushLive(); renderMode(); tick();
  }
  function jumpTo(id) {
    const idx = segIndex(id); if (idx < 0) return;
    const now = nowMs();
    if (state.mode !== "live" || !state.live.running) {
      state.mode = "live";
      // pornim show-ul ca și cum ar fi început la ora planificată a segmentului
      state.live = { running: true, idx, itemStart: now, showStart: now - plannedOffsets()[id] * 60000 };
    } else { state.live.idx = idx; state.live.itemStart = now; }
    save(); pushLive(); renderMode(); tick();
  }
  function confirmInline(msg) { return window.confirm(msg); }
  function scrollToCurrent() {
    const tr = $("#rows tr.current"); if (!tr) return;
    const r = tr.getBoundingClientRect();
    if (r.top < 140 || r.bottom > innerHeight - 40) tr.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  $("#btnGo").onclick = go; $("#btnPrev").onclick = prev; $("#btnStop").onclick = stop;

  /* ---------------- hero + pop-up ---------------- */
  function tick() {
    const now = new Date(nowMs());
    $("#clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    autoAdvance(now.getTime());
    const pos = position(now.getTime());
    tickTimeline(pos);
    const nowCard = $(".now");

    if (pos.cur) {
      $("#nowLabel").textContent = pos.mode === "live" ? `ACUM · LIVE · ${state.advance === "auto" ? "AUTO" : "MANUAL"}` : "ACUM · DUPĂ PLAN";
      $("#nowTitle").textContent = pos.cur.title || "—";
      $("#nowMeta").innerHTML = `${chip(pos.cur.cat)}<span>${hhmm(pos.off[pos.cur.id])} · ${pos.cur.min} min</span>${pos.cur.who ? `<span>· ${esc(pos.cur.who)}</span>` : ""}`;
      $("#nowRemain").textContent = fmtDur(pos.remain);
      const over = pos.remain < 0, warn = false;
      $("#nowRemain").className = "big-time" + (over ? " over" : warn ? " warn" : "");
      nowCard.classList.toggle("over", over);
      $("#nowProgress").style.width = Math.min(100, Math.max(0, (pos.elapsed / (pos.durMs || 1)) * 100)) + "%";
      const endAt = new Date(now.getTime() + Math.max(0, pos.remain));
      $("#nowEnds").textContent = over ? `peste timp cu ${fmtDur(-pos.remain)}` : `${pos.mode === "live" && state.advance === "auto" ? "trece automat la" : "se termină la"} ${pad(endAt.getHours())}:${pad(endAt.getMinutes())}`;
      if (pos.drift != null) {
        const d = pos.drift; const el = $("#drift");
        el.textContent = Math.abs(d) < 30000 ? "pe timp" : d > 0 ? `${fmtDur(d)} în urmă` : `${fmtDur(-d)} înainte`;
        el.className = "drift " + (Math.abs(d) < 30000 ? "ok" : d > 0 ? "late" : "early");
      } else { $("#drift").textContent = ""; }
      $("#nowTalk").textContent = pos.cur.talk || "";
    } else {
      nowCard.classList.remove("over");
      $("#nowLabel").textContent = pos.mode === "pre" ? "ÎNAINTE DE SHOW" : "SHOW TERMINAT";
      $("#nowTitle").textContent = pos.mode === "pre" ? "Începem în" : "Mulțumim!";
      $("#nowMeta").innerHTML = `<span>${esc(state.show.title)} · ${esc(fmtDate())} · ${esc(state.show.start)}</span>`;
      $("#nowRemain").textContent = pos.mode === "pre" ? fmtDur(pos.nextInMs) : "00:00";
      $("#nowRemain").className = "big-time";
      $("#nowProgress").style.width = pos.mode === "post" ? "100%" : "0%";
      $("#nowEnds").textContent = pos.mode === "pre" ? "Apasă Live → Start show la repetiție" : "";
      $("#drift").textContent = ""; $("#nowTalk").textContent = "";
    }

    if (pos.next) {
      $("#nextTitle").textContent = pos.next.title || "—";
      $("#nextCat").innerHTML = `${chip(pos.next.cat)} <span style="color:var(--muted);font-size:13px">· ${pos.next.min} min${pos.next.who ? " · " + esc(pos.next.who) : ""}</span>`;
      $("#nextTalk").textContent = pos.next.talk || "—";
      $("#nextIn").textContent = pos.nextInMs != null ? (pos.nextInMs >= 0 ? `în ${fmtDur(pos.nextInMs)}` : "acum") : "";
      $("#afterNext").innerHTML = pos.after ? `<span>Apoi: <b>${esc(pos.after.title)}</b> · ${pos.after.min} min</span>` : "";
    } else {
      $("#nextTitle").textContent = "—"; $("#nextCat").innerHTML = ""; $("#nextTalk").textContent = ""; $("#nextIn").textContent = ""; $("#afterNext").innerHTML = "";
    }

    // culoarea luminilor = culoarea tipului de moment; roșu când segmentul a depășit timpul
    const hexOf = (it) => (it && CAT_HEX[it.cat]) || "#3d7bff";
    nowCard.style.setProperty("--ac", accentFor(pos));
    $(".next").style.setProperty("--ac", hexOf(pos.next));

    const curKey = pos.cur ? pos.cur.id : pos.mode;
    if (lastCurKey !== null && curKey !== lastCurKey) playMorph(pos.cur ? pos.cur.title : pos.mode === "post" ? "Mulțumim!" : "");
    lastCurKey = curKey;

    markRows(pos);
    renderPopup(pos);
  }

  // în ultimul minut culoarea momentului trece treptat în roșu; la zero e roșu de tot
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
    const a = $(".now .aurora"); if (a) { a.classList.add("flash"); setTimeout(() => a.classList.remove("flash"), 1600); }
    if (popupWin && !popupWin.closed) { const b = popupWin.document.body; b.classList.remove("flip"); void b.offsetWidth; b.classList.add("flip"); }
  }

  function fmtDate() { const [y, m, d] = (state.show.date || "").split("-"); return d ? `${d}.${m}.${y}` : ""; }

  // pop-up: Document Picture-in-Picture (mereu deasupra) în Chrome/Edge; altfel fereastră normală
  const POPUP_CSS = `
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
    .k .sp{flex:1}.dot{width:7px;height:7px;border-radius:50%;background:#ff4d5e;box-shadow:0 0 10px #ff4d5e}
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
    @media (prefers-reduced-motion:reduce){.beam{animation:none}}`;

  const CAT_HEX = { live: "#3d7bff", interviu: "#a78bfa", grafica: "#22d3ee", platforma: "#c9d4ea", caritabil: "#f472b6", ing: "#ff6200", donatii: "#e4f53b", giveaway: "#34d399", pauza: "#8a93a6" };

  // setările prompter-ului rămân salvate între sesiuni
  const PROMPT_KEY = "ta-rundown-prompter";
  const prompter = Object.assign({ on: false, playing: false, speed: 40, size: 34, mirror: false },
    (() => { try { return JSON.parse(localStorage.getItem(PROMPT_KEY)) || {}; } catch (e) { return {}; } })());
  prompter.playing = false;
  const savePrompter = () => { try { localStorage.setItem(PROMPT_KEY, JSON.stringify({ ...prompter, playing: false })); } catch (e) {} };
  let promptAcc = 0, promptLast = 0, promptTextKey = "";

  async function openPopup() {
    if (popupWin && !popupWin.closed) { try { popupWin.focus(); } catch (e) {} return; }
    let w = null;
    try {
      if ("documentPictureInPicture" in window) {
        w = await window.documentPictureInPicture.requestWindow({ width: 460, height: 680 });
      }
    } catch (e) { w = null; }
    if (!w) {
      w = window.open("", "ta-rundown-popup", "width=460,height=720");
      if (!w) return toast("Browserul a blocat pop-up-ul. Permite pop-up-uri pentru pagina asta.");
      toast("Pop-up deschis. Pentru „mereu deasupra” folosește Chrome sau Edge.");
    }
    const d = w.document;
    d.title = "KAIROS · Acum";
    d.head.innerHTML = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"><style>${POPUP_CSS}</style>`;
    d.body.innerHTML = `<div class="aur" id="paur"></div>
      <div class="main">
        <div class="k"><svg viewBox="0 0 40 40" width="14" height="14" style="flex:none;filter:drop-shadow(0 0 5px rgba(61,123,255,.7))"><path d="M27.8 7.2A15 15 0 1 0 34.6 16" fill="none" stroke="#9dbcff" stroke-width="3.4" stroke-linecap="round"/><circle cx="31.9" cy="10.6" r="3.4" fill="#fff"/></svg><span class="dot"></span><span id="pl">ACUM</span><span class="sp"></span><button class="tg" id="ptg" title="Prompter (T)">PROMPTER</button><span class="clock" id="pc"></span></div>
        <div><div class="t" id="pt">—</div><div class="meta" id="pm"></div></div>
        <div class="time" id="pr">--:--</div>
        <div class="bar"><i id="pb"></i></div>
        <div class="tw"><div class="talk" id="pk"><div class="lbl">CE SE SPUNE</div><p id="pkt"></p></div><div class="guide"></div></div>
        <div class="ctl">
          <button class="play" id="pp" title="Pornește / oprește (Space)">▶ Start</button>
          <button id="ps-" title="Mai încet (↓)">−</button><span class="v" id="pv"></span><button id="ps+" title="Mai repede (↑)">+</button>
          <button id="pa-" title="Text mai mic (-)">A−</button><button id="pa+" title="Text mai mare (+)">A+</button>
          <button id="pz" title="Înapoi la început (R)">↺</button><button id="pmr" title="Oglindit, pentru ecran cu sticlă (M)">⇋</button>
        </div>
      </div>
      <div class="next"><span class="nd"></span><span class="nl">URMEAZĂ</span><span class="nt" id="nt">—</span><span class="ni" id="pi"></span></div>`;
    buildAurora(d.getElementById("paur"), 911);
    popupWin = w;
    promptTextKey = "";

    const g = (id) => d.getElementById(id);
    const talk = g("pk");
    const sync = () => {
      d.body.classList.toggle("prompt", prompter.on);
      d.body.classList.toggle("mirror", prompter.mirror);
      g("ptg").classList.toggle("on", prompter.on);
      g("pp").textContent = prompter.playing ? "❚❚ Pauză" : "▶ Start";
      g("pv").textContent = `${prompter.speed}px/s`;
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
      if (k === " ") { e.preventDefault(); act.play(); }
      else if (k === "ArrowUp") { e.preventDefault(); act.faster(); }
      else if (k === "ArrowDown") { e.preventDefault(); act.slower(); }
      else if (k === "+" || k === "=") act.bigger();
      else if (k === "-") act.smaller();
      else if (k === "r" || k === "R") act.top();
      else if (k === "t" || k === "T") act.toggle();
      else if (k === "m" || k === "M") act.mirror();
      else if (k === "n" || k === "N") { if (state.mode === "live") go(); }
    });
    // derularea prompter-ului, lină, pe ceasul ferestrei pop-up
    const step = (ts) => {
      if (!popupWin || popupWin.closed) return;
      if (prompter.on && prompter.playing) {
        if (promptLast) {
          promptAcc += prompter.speed * (ts - promptLast) / 1000;
          const whole = Math.floor(promptAcc);
          if (whole) { talk.scrollTop += whole; promptAcc -= whole; }
        }
        promptLast = ts;
      } else promptLast = 0;
      w.requestAnimationFrame(step);
    };
    w.requestAnimationFrame(step);
    w.addEventListener("pagehide", () => { popupWin = null; });
    sync();
    tick();
  }

  function renderPopup(pos) {
    if (!popupWin || popupWin.closed) return;
    const d = popupWin.document; const g = (id) => d.getElementById(id); if (!g("pt")) return;
    const now = new Date();
    g("pc").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const hexOf = (it) => (it && CAT_HEX[it.cat]) || "#3d7bff";
    d.body.style.setProperty("--ac", accentFor(pos));
    d.body.style.setProperty("--nc", hexOf(pos.next));
    let text = "";
    if (pos.cur) {
      g("pl").textContent = pos.mode === "live" ? `ACUM · LIVE · ${state.advance === "auto" ? "AUTO" : "MANUAL"}` : "ACUM · DUPĂ PLAN";
      g("pt").textContent = pos.cur.title;
      let meta = `${hhmm(pos.off[pos.cur.id])} · ${pos.cur.min} min${pos.cur.who ? " · " + esc(pos.cur.who) : ""}`;
      if (pos.drift != null && Math.abs(pos.drift) >= 30000) meta += ` · <span class="drift ${pos.drift > 0 ? "late" : "early"}">${pos.drift > 0 ? fmtDur(pos.drift) + " în urmă" : fmtDur(-pos.drift) + " înainte"}</span>`;
      g("pm").innerHTML = meta;
      g("pr").textContent = fmtDur(pos.remain);
      g("pr").className = "time" + (pos.remain < 0 ? " over" : "");
      g("pb").style.width = Math.min(100, Math.max(0, (pos.elapsed / (pos.durMs || 1)) * 100)) + "%";
      text = prompter.on ? ((pos.cur.script || "").trim() || pos.cur.talk || "") : (pos.cur.talk || "");
    } else {
      g("pl").textContent = pos.mode === "pre" ? "ÎNAINTE DE SHOW" : "SHOW TERMINAT";
      g("pt").textContent = pos.mode === "pre" ? "Începem în" : "Mulțumim!";
      g("pm").textContent = ""; g("pr").textContent = pos.mode === "pre" ? fmtDur(pos.nextInMs) : "00:00"; g("pr").className = "time";
      g("pb").style.width = "0%";
    }
    // textul se schimbă doar când se schimbă segmentul sau modul, ca să nu sară derularea
    const key = (pos.cur ? pos.cur.id : pos.mode) + "|" + prompter.on + "|" + text;
    if (key !== promptTextKey) {
      const segChanged = !promptTextKey || promptTextKey.split("|")[0] !== key.split("|")[0];
      promptTextKey = key;
      g("pkt").textContent = text;
      if (segChanged) { g("pk").scrollTop = 0; promptAcc = 0; }
    }
    if (pos.next) {
      g("pi").textContent = pos.nextInMs != null && pos.nextInMs >= 0 ? `în ${fmtDur(pos.nextInMs)}` : "acum";
      g("nt").textContent = pos.next.title;
    } else { g("pi").textContent = ""; g("nt").textContent = "—"; }
  }

  $("#btnPopup").onclick = openPopup;

  /* ---------------- meniu, setări, import/export ---------------- */
  $("#btnMenu").onclick = (e) => { e.stopPropagation(); $("#menuList").hidden = !$("#menuList").hidden; };
  document.addEventListener("click", () => { $("#menuList").hidden = true; });
  $("#menuList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "export") exportJSON();
    if (a === "import") $("#importFile").click();
    if (a === "print") window.print();
    if (a === "settings") openSettings();
    if (a === "team") openTeam();
    if (a === "home") location.href = "./";
    if (a === "signout" && S) S.signOut();
    if (a === "reset" && window.confirm("Înlocuiești rundown-ul curent cu cel implicit? Exportă-l înainte dacă vrei să-l păstrezi.")) {
      snapshot(); const keep = { mode: state.mode, advance: state.advance, live: state.live }; state = { ...fromDefault(), ...keep };
      save(); pushItems(); renderAll(); toast(cloud() ? "Rundown-ul implicit a fost încărcat pentru toată echipa" : "Rundown-ul implicit a fost încărcat");
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
      if (!Array.isArray(d.items)) throw new Error("fără items");
      snapshot();
      state.show = { ...state.show, ...(d.show || {}) };
      state.items = d.items.map((it) => ({ id: uid(), type: "segment", min: 5, cat: "platforma", title: "", video: "", gfx: "", talk: "", who: "", ...it }));
      save(); pushItems(); renderAll(); toast(`Importat: ${segs().length} segmente`);
    } catch (err) { toast("Fișierul nu e un rundown valid"); }
    e.target.value = "";
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
    let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
  }

  /* ---------------- tastatură ---------------- */
  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest && e.target.closest("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) { e.preventDefault(); return undo(); }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "n" || e.key === "N") { if (state.mode === "live") go(); }
    if (e.key === "b" || e.key === "B") prev();
    if (e.key === "p" || e.key === "P") openPopup();
  });

  /* ---------------- aurora (fundalul cardurilor de sus) ---------------- */
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
  $$(".aurora").forEach((el, i) => buildAurora(el, 17 + i * 101));

  /* ---------------- cloud: rundown comun, Live comun, cont ---------------- */
  let needsRender = false;
  function focusedCell() { const a = document.activeElement; return a && a.classList && a.classList.contains("cell") && $("#rows").contains(a); }
  $("#rows").addEventListener("focusout", () => setTimeout(() => { if (needsRender && !focusedCell()) { needsRender = false; renderTable(); } }, 0));

  function applyRemote(data) {
    if (!data) {                       // cloud gol: primul editor urcă rundown-ul lui
      if (LEGACY && cloud() && canEdit()) { pushItems(); toast("Rundown-ul a fost urcat în cloud pentru toată echipa"); }
      else if (!LEGACY && cloud()) toast("Rundown-ul nu există sau nu ai acces la el.");
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
    state.live = { running: !!d.running, idx, itemStart: d.itemStart || 0, showStart: d.showStart || 0 };
    save(); renderMode(); tick();
    if (prevKey !== `${state.live.running}|${state.live.idx}|${state.live.itemStart}`) scrollToCurrent();
  }

  const ROLE_LABEL = { owner: "Proprietar", editor: "Editor", viewer: "Doar citire", local: "" };
  function renderAccount() {
    const el = $("#account"); if (!el) return;
    const st = S ? S.status : "local";
    if (!S || !S.ready) { el.innerHTML = ""; return; }
    if (!S.user) {
      el.innerHTML = `<button class="btn" data-signin title="Conectează-te ca să lucrezi pe rundown-ul comun">Conectare Google</button>`;
    } else {
      const u = S.user; const ini = esc((u.name || u.email || "?").trim().charAt(0).toUpperCase());
      el.innerHTML = `<span class="sync-dot ${st}" title="${st === "online" ? "Sincronizat" : st === "error" ? "Eroare de sincronizare" : "Se conectează…"}"></span>
        <span class="who-chip" title="${esc(u.email)}">${u.photo ? `<img src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${ini}</i>`}<span>${esc((u.name || "").split(" ")[0])}</span><em>${ROLE_LABEL[S.role] || ""}</em></span>`;
    }
    document.body.classList.toggle("cloud", !!S.user);
    document.body.classList.toggle("ro", !canEdit());
    document.body.classList.toggle("is-owner", !!(S.user && S.isOwner()));
    document.body.classList.toggle("is-admin", !!(S.user && S.isAdmin));
  }
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-signin]") || !S) return;
    try { await S.signIn(); } catch (err) { toast("Conectarea n-a mers: " + (err && err.code ? err.code : "eroare")); }
  });

  function openTeam() {
    if (!S || !S.user || !S.isOwner()) return;
    const dlg = $("#teamDlg"); const f = dlg.querySelector("form");
    f.emails.value = (S.showMeta.editors || []).join("\n");
    dlg.showModal();
    dlg.onclose = async () => {
      if (dlg.returnValue !== "ok") return;
      try { await S.setEditors(f.emails.value.split(/[\s,;]+/)); toast("Lista de editori a fost salvată"); }
      catch (err) { toast("N-am putut salva lista: " + (err.code || "eroare")); }
    };
  }
  // linkul de invitație: îl generezi și îl trimiți, cine îl acceptă devine editor
  $("#inviteMake").onclick = async () => {
    try {
      const r = await S.createInvite({ showId: S.showId, showTitle: state.show.title || "", team: $("#inviteTeam").checked });
      $("#inviteUrl").value = r.url; $("#inviteCopy").disabled = false; $("#inviteUrl").select();
      toast("Link generat, valabil 7 zile");
    } catch (err) { toast("N-am putut genera linkul: " + (err.code || "eroare")); }
  };
  $("#inviteCopy").onclick = async () => {
    const v = $("#inviteUrl").value; if (!v) return;
    try { await navigator.clipboard.writeText(v); toast("Link copiat"); } catch (e) { $("#inviteUrl").select(); toast("Selectat: apasă Ctrl+C"); }
  };
  $("#inviteRevoke").onclick = async () => {
    try { const n = await S.revokeInvites(S.showId); $("#inviteUrl").value = ""; $("#inviteCopy").disabled = true; toast(n ? "Linkurile de invitație au fost dezactivate" : "Nu aveai linkuri active"); }
    catch (err) { toast("N-a mers: " + (err.code || "eroare")); }
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
    if (s < 60) return "acum"; if (s < 3600) return `acum ${Math.floor(s / 60)} min`;
    if (s < 86400) return `acum ${Math.floor(s / 3600)} h`;
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
    $("#drawerLabel").textContent = seg ? `COMENTARII · ${hhmm(plannedOffsets()[seg.id] || 0)}` : "COMENTARII";
    $("#drawerTitle").textContent = seg ? (seg.title || "Moment") : "Toate momentele";
    $("#drawerAll").hidden = !seg;
    const showRes = $("#showResolved").checked;
    const list = (S ? S.comments : []).filter((c) => (!seg || c.segId === seg.id) && (showRes || !c.resolved));
    const me = S && S.user ? S.user.uid : null;
    $("#cmtList").innerHTML = list.length ? list.map((c) => {
      const segNow = state.items.find((i) => i.id === c.segId);
      return `<article class="cmt ${c.resolved ? "resolved" : ""}" data-id="${esc(c.id)}">
        <header>${c.photo ? `<img src="${esc(c.photo)}" alt="" referrerpolicy="no-referrer">` : `<i>${esc((c.name || "?").charAt(0).toUpperCase())}</i>`}
          <b>${esc(c.name || "Anonim")}</b><span>${esc(timeAgo(c.createdAt))}</span>${c.kind === "text" ? `<span class="tag">Sugestie de text</span>` : ""}</header>
        ${!seg ? `<button class="seg-link" data-goto="${esc(c.segId)}">${esc(segNow ? segNow.title : c.segTitle || "moment șters")}</button>` : ""}
        <p>${esc(c.text)}</p>
        <footer>
          ${canEdit() && cloud() && c.kind === "text" && segNow ? `<button class="mini" data-c="apply">Pune textul în „Ce se spune”</button>` : ""}
          ${canEdit() && cloud() ? `<button class="mini" data-c="resolve">${c.resolved ? "Redeschide" : "Rezolvat"}</button>` : ""}
          ${cloud() && (canEdit() || c.uid === me) ? `<button class="mini del" data-c="del">Șterge</button>` : ""}
        </footer></article>`;
    }).join("") : `<p class="empty">${seg ? "Niciun comentariu la acest moment." : "Niciun comentariu deschis."}</p>`;
    const signed = !!(S && S.user);
    $("#composer").hidden = !signed || !seg;
    $("#signinBox").hidden = signed || !(S && S.ready);
    $("#composerHint").textContent = signed && seg ? `ca ${S.user.name || S.user.email}` : "";
    if (signed && !seg) $("#cmtList").insertAdjacentHTML("beforeend", `<p class="empty">Ca să scrii un comentariu, deschide-l de la momentul la care se referă (iconița de lângă rând).</p>`);
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
      if (b.dataset.c === "del" && window.confirm("Ștergi comentariul?")) await S.deleteComment(id);
      if (b.dataset.c === "apply") {
        const it = state.items.find((i) => i.id === c.segId); if (!it) return;
        snapshot(); it.talk = c.text; save(); pushItems(); renderTable(); tick();
        await S.resolveComment(id, true); toast("Textul a fost pus în „Ce se spune”");
      }
    } catch (err) { toast("N-a mers: " + (err.code || "eroare")); }
  });
  $("#composer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#cmtText").value.trim(); if (!text || !drawerSeg || !S) return;
    const seg = state.items.find((i) => i.id === drawerSeg);
    const kind = $("#composer").querySelector("input[name=kind]:checked").value;
    $("#cmtSend").disabled = true;
    try { await S.addComment({ segId: drawerSeg, segTitle: seg ? seg.title : "", text, kind }); $("#cmtText").value = ""; toast("Comentariu trimis"); }
    catch (err) { toast("Comentariul nu s-a trimis: " + (err.code || err.message || "eroare")); }
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

  /* ---------------- pornire ---------------- */
  function renderAll() {
    $("#showTitle").textContent = state.show.title;
    $("#showMeta").textContent = `${fmtDate()} · ${state.show.start} · ${state.show.venue || ""}`;
    renderFilters(); renderTable(); renderMode(); renderAccount(); tick();
  }
  renderAll();
  setInterval(tick, 250);
})();
