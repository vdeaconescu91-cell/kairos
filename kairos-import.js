/* KAIROS · import de rundown din CSV / TSV, JSON sau Excel.
   Recunoaște coloanele după nume (română sau engleză), calculează duratele din orele de start
   când lipsesc și întoarce { show, items, stats } în formatul aplicației. Excel se citește cu SheetJS,
   încărcat doar când e nevoie. */
(() => {
  "use strict";
  const XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const ALIAS = {
    title: ["title", "titlu", "moment", "segment", "nume", "name", "item", "momentul", "denumire"],
    min: ["min", "mins", "minute", "durata", "duration", "dur", "length", "lungime", "durata min", "duration min", "timp"],
    start: ["start", "ora", "time", "ora start", "start time", "inceput", "ora de start", "at", "begins"],
    cat: ["cat", "categorie", "category", "tip", "type", "kind"],
    video: ["video", "camere", "camera", "cams", "vizual", "cut", "imagine", "camera cut"],
    gfx: ["gfx", "grafica", "graphics", "grafic", "overlay", "lower third"],
    talk: ["talk", "audio", "vorbit", "ce se spune", "text", "voce", "notes", "note", "descriere", "description", "detalii", "details"],
    who: ["who", "cine", "talent", "prezentator", "host", "hosts", "owner", "responsabil", "on air"],
    script: ["script", "prompter", "teleprompter"]
  };
  const CAT = [
    ["live", ["live", "meci", "match", "game", "joc"]], ["interviu", ["interviu", "interview"]], ["grafica", ["grafica", "graphics", "gfx", "video", "vt", "loop"]],
    ["platforma", ["platforma", "platform", "studio", "desk", "host", "talk"]], ["caritabil", ["caritabil", "charity", "cauza"]], ["ing", ["ing", "partner", "partener", "sponsor"]],
    ["donatii", ["donatii", "donations", "donation", "goal"]], ["giveaway", ["giveaway", "extragere", "raffle"]], ["pauza", ["pauza", "break", "pause", "rezerva", "buffer", "reserve"]]
  ];
  const HEADER_WORDS = ["header", "bloc", "block", "section", "sectiune", "titlu bloc", "act", "part", "parte"];

  function pickKey(keys, field) {
    const al = ALIAS[field];
    return keys.find((k) => al.includes(norm(k))) || keys.find((k) => al.some((a) => norm(k).startsWith(a + " ") || norm(k).endsWith(" " + a)));
  }
  // minute dintr-o durată: 15 · "15 min" · "15:00" (mm:ss) · "1:05:00" · 0.0104 (fracție de zi din Excel)
  function toMin(v) {
    if (v === "" || v == null) return null;
    if (typeof v === "number") return v > 0 && v < 1 ? Math.round(v * 1440 * 10) / 10 : v;
    const s = String(v).trim().replace(",", ".");
    const p = s.split(":").map(Number);
    if (p.length === 3 && p.every(isFinite)) return p[0] * 60 + p[1] + p[2] / 60;
    if (p.length === 2 && p.every(isFinite)) return p[0] + p[1] / 60;
    const m = s.match(/(\d+(?:\.\d+)?)\s*(h|ore|ora|hr)?/i);
    if (!m) return null;
    return m[2] ? parseFloat(m[1]) * 60 : parseFloat(m[1]);
  }
  // minute de la miezul nopții dintr-o oră: "14:45" · "2:45 PM" · 0.614 (Excel)
  function toClock(v) {
    if (v === "" || v == null) return null;
    if (typeof v === "number") return v < 1 ? Math.round(v * 1440) : null;
    const m = String(v).trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/i);
    if (!m) return null;
    let h = +m[1]; const mi = +m[2];
    if (m[3]) { const pm = m[3].toLowerCase() === "pm"; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return h * 60 + mi;
  }
  const hhmm = (t) => `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  function toCat(v) {
    const n = norm(v); if (!n) return "platforma";
    for (const [k, al] of CAT) if (al.some((a) => n === a || n.startsWith(a + " ") || n.includes(a))) return k;
    return "platforma";
  }

  function fromRows(rows) {
    rows = rows.filter((r) => r && typeof r === "object");
    if (!rows.length) throw new Error("The file has no rows I can read.");
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const K = {}; Object.keys(ALIAS).forEach((f) => (K[f] = pickKey(keys, f)));
    if (!K.title) throw new Error("I couldn't find a column for the moment name (title, moment, segment, titlu…).");
    if (!K.min && !K.start) throw new Error("I couldn't find a duration column (min, duration, durata…) or a start time column (start, ora…).");
    const get = (r, f) => (K[f] ? r[K[f]] : "");
    let skipped = 0;
    const raw = [];
    for (const r of rows) {
      const title = String(get(r, "title") ?? "").trim();
      if (!title) { skipped++; continue; }
      const typeVal = norm(get(r, "cat"));
      const min = toMin(get(r, "min")), start = toClock(get(r, "start"));
      const others = ["video", "gfx", "talk", "who", "script"].some((f) => String(get(r, f) ?? "").trim());
      const isHeader = HEADER_WORDS.includes(typeVal) || (min == null && start == null && !others);
      raw.push({ title, min, start, isHeader, r });
    }
    // duratele lipsă: din diferența dintre orele de start consecutive
    const segs = raw.filter((x) => !x.isHeader);
    segs.forEach((x, i) => {
      if (x.min != null) return;
      const nx = segs.slice(i + 1).find((y) => y.start != null);
      if (x.start != null && nx) { let d = nx.start - x.start; if (d < 0) d += 1440; x.min = d; }
    });
    const items = raw.map((x) => x.isHeader
      ? { type: "header", title: x.title }
      : { type: "segment", title: x.title, min: Math.max(0, Math.round((x.min ?? 5) * 10) / 10), cat: toCat(get(x.r, "cat")),
          video: String(get(x.r, "video") ?? ""), gfx: String(get(x.r, "gfx") ?? ""), talk: String(get(x.r, "talk") ?? ""),
          who: String(get(x.r, "who") ?? ""), script: String(get(x.r, "script") ?? "") });
    const first = segs.find((x) => x.start != null);
    const stats = { segments: segs.length, headers: raw.length - segs.length, skipped,
      minutes: Math.round(items.reduce((a, it) => a + (it.min || 0), 0)) };
    if (!stats.segments) throw new Error("I found only block titles, no moments with a duration.");
    return { show: { start: first ? hhmm(first.start) : "" }, items, stats };
  }

  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/)[0] || "";
    const delim = [["\t", (firstLine.match(/\t/g) || []).length], [";", (firstLine.match(/;/g) || []).length], [",", (firstLine.match(/,/g) || []).length]].sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const lines = rows.filter((r) => r.some((c) => String(c).trim()));
    if (lines.length < 2) throw new Error("The file needs a header row and at least one moment.");
    const head = lines[0].map((h) => h.trim());
    return lines.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h || `col${i + 1}`, (r[i] ?? "").trim()])));
  }

  function fromJSON(text) {
    let d; try { d = JSON.parse(text.replace(/^﻿/, "")); } catch (e) { throw new Error("This isn't valid JSON."); }
    const show = (d && d.show) || {};
    // formatul KAIROS: { show, items: [...] } sau { show, order, items: {id: item} }
    let list = Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : (d.order && d.items) ? d.order.map((id) => d.items[id]).filter(Boolean) : null;
    if (!list) throw new Error("I expected a list of moments, or an object with an items list.");
    const native = list.every((x) => x && (x.type === "header" || "min" in x));
    const r = native
      ? { items: list.map((x) => x.type === "header" ? { type: "header", title: String(x.title || "") } : { type: "segment", title: String(x.title || ""), min: Number(x.min) || 0, cat: x.cat || "platforma", video: x.video || "", gfx: x.gfx || "", talk: x.talk || "", who: x.who || "", script: x.script || "" }),
          show: {}, stats: null }
      : fromRows(list);
    if (!r.stats) { const segs = r.items.filter((x) => x.type !== "header"); r.stats = { segments: segs.length, headers: r.items.length - segs.length, skipped: 0, minutes: Math.round(segs.reduce((a, x) => a + (x.min || 0), 0)) }; }
    r.show = { ...r.show, title: show.title || "", date: show.date || "", start: show.start || r.show.start || "", venue: show.venue || "" };
    return r;
  }

  let xlsxP = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    xlsxP = xlsxP || new Promise((ok, bad) => { const s = document.createElement("script"); s.src = XLSX_URL; s.onload = () => ok(window.XLSX); s.onerror = () => bad(new Error("I couldn't load the Excel reader. Check your connection, or save the sheet as CSV.")); document.head.appendChild(s); });
    return xlsxP;
  }

  async function parseFile(file) {
    const name = (file.name || "").toLowerCase();
    if (file.size > 5 * 1024 * 1024) throw new Error("The file is larger than 5 MB.");
    let r;
    if (/\.(xlsx|xls)$/.test(name)) {
      const X = await loadXLSX();
      const wb = X.read(await file.arrayBuffer(), { type: "array" });
      // prima foaie care are un tabel cu un titlu și o durată sau o oră
      let lastErr = null;
      for (const sn of wb.SheetNames) {
        try { r = fromRows(X.utils.sheet_to_json(wb.Sheets[sn], { defval: "", raw: true })); break; } catch (e) { lastErr = e; }
      }
      if (!r) throw lastErr || new Error("The workbook is empty.");
    } else if (/\.json$/.test(name)) {
      r = fromJSON(await file.text());
    } else {
      const text = await file.text();
      r = /^\s*[[{]/.test(text) ? fromJSON(text) : fromRows(parseCSV(text));
    }
    r.show = { title: "", date: "", venue: "", ...r.show };
    return r;
  }
  window.KImport = { parseFile, _fromRows: fromRows, _parseCSV: parseCSV, _fromJSON: fromJSON };
})();
