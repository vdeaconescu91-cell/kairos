/* TA Rundown · aplicație de run-of-show fără build.
   Starea se ține în localStorage; tab-urile deschise în același browser se sincronizează între ele. */
(() => {
  "use strict";

  const STORE_KEY = "ta-rundown-v1";
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

  /* ---------------- stare ---------------- */
  let state = load();
  let hiddenCats = new Set();
  let undoStack = [];
  let popupWin = null;

  function fromDefault() {
    const d = clone(window.TA_DEFAULT_RUNDOWN);
    d.items = d.items.map((it) => ({ id: uid(), type: it.type || "segment", title: "", min: 5, cat: "platforma",
      video: "", gfx: "", talk: "", who: "", ...it }));
    d.mode = "plan";
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
    save(); renderTable(); tick();
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
  function position(now = Date.now()) {
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

  /* ---------------- tabel ---------------- */
  function catStyle(cat) { return `--cc: var(${(CATS[cat] || CATS.platforma).var})`; }
  function chip(cat) { return `<span class="chip" style="${catStyle(cat)}">${esc((CATS[cat] || CATS.platforma).label)}</span>`; }

  function renderFilters() {
    $("#filters").innerHTML = Object.entries(CATS).map(([k, c]) =>
      `<button class="chip ${hiddenCats.has(k) ? "off" : ""}" data-cat="${k}" style="${catStyle(k)}" title="Arată / ascunde">${esc(c.label)}</button>`).join("");
  }

  function renderTable() {
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
        <td class="start" data-start>${hhmm(off[it.id])}</td>
        <td><input class="cell dur" data-f="min" inputmode="numeric" value="${esc(it.min)}" aria-label="Durată în minute"></td>
        <td>
          <textarea class="cell title-cell" data-f="title" rows="1" aria-label="Segment">${esc(it.title)}</textarea>
          <select class="cell cat" data-f="cat" aria-label="Tip">${Object.entries(CATS).map(([k, c]) =>
            `<option value="${k}" ${k === it.cat ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        </td>
        <td><textarea class="cell" data-f="video" rows="1" aria-label="Video">${esc(it.video)}</textarea></td>
        <td><textarea class="cell" data-f="gfx" rows="1" aria-label="Grafică">${esc(it.gfx)}</textarea></td>
        <td><textarea class="cell" data-f="talk" rows="1" aria-label="Ce se spune">${esc(it.talk)}</textarea></td>
        <td><textarea class="cell" data-f="who" rows="1" aria-label="Cine">${esc(it.who)}</textarea></td>
        <td><div class="acts">
          <button class="icon jump" data-a="jump" title="Live: sari aici">▶</button>
          <button class="icon" data-a="add" title="Segment nou dedesubt">＋</button>
          <button class="icon" data-a="dup" title="Duplică">⧉</button>
          <button class="icon del" data-a="del" title="Șterge">✕</button>
        </div></td></tr>`;
    }).join("");
    $("#rows").innerHTML = html;
    $$("#rows textarea").forEach(autosize);
    applyFilters();
    updateTotals();
    markRows(position());
  }

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
  });

  $("#rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const tr = b.closest("tr"); const i = state.items.findIndex((x) => x.id === tr.dataset.id); if (i < 0) return;
    const a = b.dataset.a;
    if (a === "jump") return jumpTo(state.items[i].id);
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
    save(); renderTable(); tick();
    if (a === "add") focusRow(state.items[i + 1].id);
  });

  function newSeg() { return { id: uid(), type: "segment", title: "Segment nou", min: 5, cat: "platforma", video: "", gfx: "", talk: "", who: "" }; }
  function focusRow(id) { const t = $(`#rows tr[data-id="${id}"] .title-cell`); if (t) { t.focus(); t.select(); } }

  $("#btnAddRow").onclick = () => { snapshot(); const s = newSeg(); state.items.push(s); save(); renderTable(); focusRow(s.id); tick(); };
  $("#btnAddHeader").onclick = () => {
    snapshot(); const h = { id: uid(), type: "header", title: "SECȚIUNE NOUĂ" }; state.items.push(h); save(); renderTable();
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
    dragId = null; save(); renderTable(); tick();
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
    save(); renderMode(); tick();
  }
  function renderMode() {
    $$(".seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.mode === state.mode));
    const live = state.mode === "live";
    const running = live && state.live.running;
    $("#btnGo").textContent = !live ? "Treci pe Live" : running ? "Următorul ▶" : "Start show";
    $("#btnPrev").disabled = !running; $("#btnStop").disabled = !running;
    document.body.classList.toggle("live-on", running);
  }
  $$(".seg-btn").forEach((b) => b.onclick = () => setMode(b.dataset.mode));

  function go() {
    if (state.mode !== "live") return setMode("live");
    const now = Date.now(); const list = segs();
    if (!state.live.running) {
      state.live = { running: true, idx: 0, itemStart: now, showStart: now };
    } else if (state.live.idx < list.length - 1) {
      state.live.idx++; state.live.itemStart = now;
    } else {
      toast("Ăsta e ultimul segment");
    }
    save(); renderMode(); tick(); scrollToCurrent();
  }
  function prev() {
    if (!state.live.running || state.live.idx <= 0) return;
    state.live.idx--; state.live.itemStart = Date.now(); save(); tick(); scrollToCurrent();
  }
  function stop() {
    if (!state.live.running) return;
    if (!confirmInline("Oprești modul live? Cronometrul se resetează.")) return;
    state.live.running = false; save(); renderMode(); tick();
  }
  function jumpTo(id) {
    const idx = segIndex(id); if (idx < 0) return;
    const now = Date.now();
    if (state.mode !== "live" || !state.live.running) {
      state.mode = "live";
      // pornim show-ul ca și cum ar fi început la ora planificată a segmentului
      state.live = { running: true, idx, itemStart: now, showStart: now - plannedOffsets()[id] * 60000 };
    } else { state.live.idx = idx; state.live.itemStart = now; }
    save(); renderMode(); tick();
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
    const now = new Date();
    $("#clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const pos = position(now.getTime());
    const nowCard = $(".now");

    if (pos.cur) {
      $("#nowLabel").textContent = pos.mode === "live" ? "ACUM · LIVE" : "ACUM · DUPĂ PLAN";
      $("#nowTitle").textContent = pos.cur.title || "—";
      $("#nowMeta").innerHTML = `${chip(pos.cur.cat)}<span>${hhmm(pos.off[pos.cur.id])} · ${pos.cur.min} min</span>${pos.cur.who ? `<span>· ${esc(pos.cur.who)}</span>` : ""}`;
      $("#nowRemain").textContent = fmtDur(pos.remain);
      const over = pos.remain < 0, warn = !over && pos.remain < 60000;
      $("#nowRemain").className = "big-time" + (over ? " over" : warn ? " warn" : "");
      nowCard.classList.toggle("over", over);
      $("#nowProgress").style.width = Math.min(100, Math.max(0, (pos.elapsed / (pos.durMs || 1)) * 100)) + "%";
      const endAt = new Date(now.getTime() + Math.max(0, pos.remain));
      $("#nowEnds").textContent = over ? `peste timp cu ${fmtDur(-pos.remain)}` : `se termină la ${pad(endAt.getHours())}:${pad(endAt.getMinutes())}`;
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

    const curKey = pos.cur ? pos.cur.id : pos.mode;
    if (lastCurKey !== null && curKey !== lastCurKey) playMorph(pos.cur ? pos.cur.title : pos.mode === "post" ? "Mulțumim!" : "");
    lastCurKey = curKey;

    markRows(pos);
    renderPopup(pos);
  }

  let lastCurKey = null;
  function playMorph(text) {
    const m = $("#morph"); if (!m || !text) return;
    $("#morphText").textContent = text.length > 42 ? text.slice(0, 40) + "…" : text;
    m.classList.remove("play"); void m.offsetWidth; m.classList.add("play");
    const a = $(".now .aurora"); if (a) { a.classList.add("flash"); setTimeout(() => a.classList.remove("flash"), 1600); }
    setTimeout(() => m.classList.remove("play"), 2200);
    if (popupWin && !popupWin.closed) { const b = popupWin.document.body; b.classList.remove("flip"); void b.offsetWidth; b.classList.add("flip"); }
  }

  function fmtDate() { const [y, m, d] = (state.show.date || "").split("-"); return d ? `${d}.${m}.${y}` : ""; }

  // pop-up: Document Picture-in-Picture (mereu deasupra) în Chrome/Edge; altfel fereastră normală
  const POPUP_CSS = `
    *{box-sizing:border-box} html,body{margin:0;height:100%;background:#000;color:#f2f4f8;font-family:"Inter Tight","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
    body{padding:18px 20px;display:flex;flex-direction:column;gap:14px;position:relative;overflow:hidden}
    body::before{content:"";position:absolute;left:-20%;right:-20%;bottom:-55%;height:90%;background:radial-gradient(closest-side,rgba(61,123,255,.5),rgba(61,123,255,0));pointer-events:none}
    body.over::before{background:radial-gradient(closest-side,rgba(255,77,94,.42),rgba(255,77,94,0))}
    body>*{position:relative}
    .k{font-size:11px;letter-spacing:.16em;font-weight:700;color:#8a93a6;display:flex;justify-content:space-between;gap:8px}
    .k b{font-family:"JetBrains Mono",monospace;letter-spacing:.02em;color:#9dbcff}
    .t{font-size:clamp(20px,6.4vw,34px);font-weight:600;letter-spacing:-.02em;line-height:1.05;text-transform:uppercase;margin:4px 0 0;background:linear-gradient(90deg,#fff,#fff 60%,#6b7486);-webkit-background-clip:text;background-clip:text;color:transparent}
    .time{font-family:"JetBrains Mono",monospace;font-size:clamp(46px,17vw,96px);font-weight:500;line-height:.95;letter-spacing:-.03em;text-shadow:0 0 34px rgba(61,123,255,.6)}
    .time.warn{color:#ffb547}.time.over{color:#ff4d5e;text-shadow:0 0 34px rgba(255,77,94,.55)}
    .bar{height:4px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#2a5fe0,#9dbcff)}
    .next{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:14px 16px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));flex:1;min-height:0;overflow:auto}
    .talk{font-size:clamp(14px,4.2vw,19px);line-height:1.45;color:#e6eaf3;margin:10px 0 0;white-space:pre-wrap}
    .chip{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--cc);border:1px solid color-mix(in srgb,var(--cc) 45%,transparent);background:color-mix(in srgb,var(--cc) 14%,transparent)}
    .meta{font-size:12px;color:#8a93a6}.drift.late{color:#ff4d5e}.drift.early{color:#6ee7a8}
    .clock{font-family:"JetBrains Mono",monospace;color:#d6e4ff}
    body.flip>*{animation:pflip 1.1s cubic-bezier(.22,.8,.25,1)}
    @keyframes pflip{0%{opacity:0;filter:blur(14px);transform:scale(.97)}100%{opacity:1;filter:blur(0);transform:none}}`;

  const CAT_HEX = { live: "#3d7bff", interviu: "#a78bfa", grafica: "#22d3ee", platforma: "#dfe5f2", caritabil: "#f472b6", ing: "#ff6200", donatii: "#e4f53b", giveaway: "#34d399", pauza: "#6b7280" };

  async function openPopup() {
    if (popupWin && !popupWin.closed) { try { popupWin.focus(); } catch (e) {} return; }
    let w = null;
    try {
      if ("documentPictureInPicture" in window) {
        w = await window.documentPictureInPicture.requestWindow({ width: 440, height: 600 });
      }
    } catch (e) { w = null; }
    if (!w) {
      w = window.open("", "ta-rundown-popup", "width=440,height=640");
      if (!w) return toast("Browserul a blocat pop-up-ul. Permite pop-up-uri pentru pagina asta.");
      toast("Pop-up deschis. Pentru „mereu deasupra” folosește Chrome sau Edge.");
    }
    const d = w.document;
    d.title = "TA · Urmează";
    d.head.innerHTML = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"><style>${POPUP_CSS}</style>`;
    d.body.innerHTML = `<div class="k"><span id="pl">ACUM</span><span class="clock" id="pc"></span></div>
      <div><div class="t" id="pt">—</div><div class="meta" id="pm"></div></div>
      <div class="time" id="pr">--:--</div><div class="bar"><i id="pb"></i></div>
      <div class="next"><div class="k"><span>URMEAZĂ</span><b id="pi"></b></div><div class="t" id="nt" style="font-size:clamp(18px,5.2vw,26px)">—</div><span class="chip" id="nc"></span><p class="talk" id="nk"></p><div class="meta" id="na" style="margin-top:12px"></div></div>`;
    popupWin = w;
    w.addEventListener("pagehide", () => { popupWin = null; });
    tick();
  }

  function renderPopup(pos) {
    if (!popupWin || popupWin.closed) return;
    const d = popupWin.document; const g = (id) => d.getElementById(id); if (!g("pt")) return;
    const now = new Date();
    g("pc").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    if (pos.cur) {
      g("pl").textContent = pos.mode === "live" ? "ACUM · LIVE" : "ACUM · DUPĂ PLAN";
      g("pt").textContent = pos.cur.title;
      let meta = `${hhmm(pos.off[pos.cur.id])} · ${pos.cur.min} min`;
      if (pos.drift != null && Math.abs(pos.drift) >= 30000) meta += ` · <span class="drift ${pos.drift > 0 ? "late" : "early"}">${pos.drift > 0 ? fmtDur(pos.drift) + " în urmă" : fmtDur(-pos.drift) + " înainte"}</span>`;
      g("pm").innerHTML = meta;
      g("pr").textContent = fmtDur(pos.remain);
      g("pr").className = "time" + (pos.remain < 0 ? " over" : pos.remain < 60000 ? " warn" : "");
      d.body.classList.toggle("over", pos.remain < 0);
      g("pb").style.width = Math.min(100, Math.max(0, (pos.elapsed / (pos.durMs || 1)) * 100)) + "%";
    } else {
      g("pl").textContent = pos.mode === "pre" ? "ÎNAINTE DE SHOW" : "SHOW TERMINAT";
      g("pt").textContent = pos.mode === "pre" ? "Începem în" : "Mulțumim!";
      g("pm").textContent = ""; g("pr").textContent = pos.mode === "pre" ? fmtDur(pos.nextInMs) : "00:00"; g("pr").className = "time";
      d.body.classList.remove("over"); g("pb").style.width = "0%";
    }
    if (pos.next) {
      g("pi").textContent = pos.nextInMs != null && pos.nextInMs >= 0 ? `în ${fmtDur(pos.nextInMs)}` : "acum";
      g("nt").textContent = pos.next.title;
      g("nc").textContent = (CATS[pos.next.cat] || CATS.platforma).label; g("nc").style.setProperty("--cc", CAT_HEX[pos.next.cat] || "#dfe5f2"); g("nc").style.display = "";
      g("nk").textContent = pos.next.talk || "";
      g("na").textContent = pos.after ? `Apoi: ${pos.after.title} · ${pos.after.min} min` : "";
    } else {
      g("pi").textContent = ""; g("nt").textContent = "—"; g("nc").style.display = "none"; g("nk").textContent = ""; g("na").textContent = "";
    }
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
    if (a === "reset" && window.confirm("Înlocuiești rundown-ul curent cu cel implicit? Exportă-l înainte dacă vrei să-l păstrezi.")) {
      snapshot(); state = fromDefault(); save(); renderAll(); toast("Rundown-ul implicit a fost încărcat");
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
      save(); renderAll(); toast(`Importat: ${segs().length} segmente`);
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
      save(); renderAll();
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

  /* ---------------- pornire ---------------- */
  function renderAll() {
    $("#showTitle").textContent = state.show.title;
    $("#showMeta").textContent = `${fmtDate()} · ${state.show.start} · ${state.show.venue || ""}`;
    renderFilters(); renderTable(); renderMode(); tick();
  }
  renderAll();
  setInterval(tick, 250);
})();
