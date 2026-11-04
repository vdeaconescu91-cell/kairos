// Generează preview.html: varianta de citit + comentat pentru clienți, din rundown-data.js.
// Rulare: node tools/build-preview.js
const vm = require("vm"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "rundown-data.js"), "utf8"), ctx);
const d = ctx.window.TA_DEFAULT_RUNDOWN;

const CATS = {
  live: ["Meci live", "#4f86ff"], interviu: ["Interviu", "#a78bfa"], grafica: ["Grafică", "#22d3ee"],
  platforma: ["Platformă", "#c9d4ea"], caritabil: ["Caritabil", "#f472b6"], ing: ["ING", "#ff7a2e"],
  donatii: ["Donații", "#e4f53b"], giveaway: ["Giveaway", "#34d399"], pauza: ["Pauză / rezervă", "#8a93a6"]
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const [H, M] = d.show.start.split(":").map(Number);
const hhmm = (min) => { const t = H * 60 + M + min; return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

let t = 0, n = 0, sections = [], cur = null;
for (const it of d.items) {
  if (it.type === "header") { cur = { title: it.title, rows: [] }; sections.push(cur); continue; }
  if (!cur) { cur = { title: "", rows: [] }; sections.push(cur); }
  n++; cur.rows.push({ ...it, n, start: hhmm(t) }); t += Number(it.min) || 0;
}
const end = hhmm(t);
const [y, mo, da] = d.show.date.split("-");

const card = (r) => {
  const [label, color] = CATS[r.cat] || CATS.platforma;
  const script = (r.script || "").trim();
  return `<article class="seg" id="s${r.n}" data-comment-target style="--c:${color}">
    <div class="when"><span class="time">${r.start}</span><span class="dur">${esc(r.min)} min</span></div>
    <div class="body">
      <div class="head"><span class="chip">${esc(label)}</span>${r.who ? `<span class="who">${esc(r.who)}</span>` : ""}</div>
      <h3>${esc(r.title)}</h3>
      ${r.talk ? `<div class="say" data-comment-target><div class="k">Ce se spune</div><p>${esc(r.talk)}</p></div>` : ""}
      ${script ? `<details class="script" data-comment-target><summary>Scriptul complet</summary><p>${esc(script)}</p></details>` : ""}
      <dl class="prod">
        ${r.video ? `<div><dt>Video</dt><dd>${esc(r.video)}</dd></div>` : ""}
        ${r.gfx ? `<div><dt>Grafică</dt><dd>${esc(r.gfx)}</dd></div>` : ""}
      </dl>
      <div class="acts" data-uncommentable>
        <button type="button" class="act" data-target="s${r.n}" data-kind="seg">Comentează momentul</button>
        ${r.talk || script ? `<button type="button" class="act ghost" data-target="s${r.n}" data-kind="say">Sugerează alt text</button>` : ""}
      </div>
    </div>
  </article>`;
};

const html = `<title>KAIROS Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* layout: o coloană de citit, ora în stânga ca pe un rundown tipărit; un singur look, întunecat, ca aplicația KAIROS */
:root {
  --bg: #04060c; --panel: #0b0f1a; --line: #1c2333; --fg: #eef1f7; --muted: #8c95a8; --blue: #4f86ff; --ice: #d6e4ff;
  --display: "Inter Tight", "Helvetica Neue", Arial, sans-serif; --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--display); font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 920px; margin: 0 auto; padding-block: 0 72px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.top { position: relative; overflow: hidden; border-bottom: 1px solid var(--line); background: radial-gradient(60% 120% at 50% 130%, rgba(79,134,255,.32), rgba(79,134,255,0) 70%), var(--bg); }
.top .wrap { padding-block: 28px 30px; display: grid; gap: 18px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand svg { width: 26px; height: 26px; filter: drop-shadow(0 0 7px rgba(79,134,255,.7)); }
.brand b { font-weight: 600; font-size: 14px; letter-spacing: .32em; color: var(--ice); }
.brand span { color: var(--muted); font-size: 13px; margin-left: auto; font-family: var(--mono); }
h1 { margin: 0; font-size: clamp(30px, 6vw, 52px); font-weight: 600; letter-spacing: -.03em; line-height: 1; text-transform: uppercase; text-wrap: balance;
  background: linear-gradient(90deg, #fff 0%, #fff 55%, #7d879b 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.sub { margin-top: -8px; font-size: 14px; font-weight: 600; letter-spacing: .24em; text-transform: uppercase; color: var(--ice); }
.facts { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--muted); font-size: 14px; }
.facts b { color: var(--fg); font-weight: 500; font-family: var(--mono); font-size: 13px; }
.how { margin: 0; max-width: 62ch; color: #c7cede; font-size: 15px; }
.how strong { color: var(--fg); font-weight: 600; }
.legend { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); background: color-mix(in srgb, var(--c) 12%, transparent); }
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
section { margin-top: 34px; }
h2 { margin: 0 0 12px; font-size: 12px; font-weight: 700; letter-spacing: .18em; color: #9dbcff; text-transform: uppercase; }
.seg { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 16px; padding: 18px 18px 16px; border: 1px solid var(--line); border-left: 3px solid var(--c);
  border-radius: 14px; background: var(--panel); margin-bottom: 10px; scroll-margin-top: 16px; }
.seg:target { box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 55%, transparent); }
.when { display: grid; align-content: start; gap: 2px; }
.time { font-family: var(--mono); font-size: 17px; font-weight: 500; font-variant-numeric: tabular-nums; }
.dur { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.body { min-width: 0; display: grid; gap: 10px; }
.head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.who { font-size: 13px; color: var(--muted); }
h3 { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: -.01em; line-height: 1.2; text-wrap: balance; }
.say { border-radius: 10px; padding: 10px 12px; background: color-mix(in srgb, var(--c) 7%, #070a12); }
.k, summary { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.say p, .script p { margin: 4px 0 0; max-width: 68ch; white-space: pre-wrap; color: #e3e8f2; }
.script { border-radius: 10px; padding: 10px 12px; border: 1px dashed var(--line); }
summary { cursor: pointer; }
.script[open] summary { margin-bottom: 4px; }
.prod { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 18px; }
.prod div { min-width: 0; } dt { font-size: 11px; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
dd { margin: 2px 0 0; font-size: 13px; color: #b9c1d2; }
.acts { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 2px; }
.act { font: 600 13px/1 var(--display); color: #fff; background: color-mix(in srgb, var(--blue) 30%, transparent); border: 1px solid color-mix(in srgb, var(--blue) 65%, transparent);
  border-radius: 999px; padding: 8px 14px; cursor: pointer; }
.act.ghost { background: transparent; color: var(--ice); border-color: #2a3550; }
.act:hover { filter: brightness(1.2); } .act:focus-visible { outline: 2px solid var(--ice); outline-offset: 2px; }
.acts[hidden] { display: none !important; }
.note { font-size: 13px; color: var(--muted); }
.foot { margin-top: 40px; color: var(--muted); font-size: 13px; }
@media (max-width: 520px) { .seg { grid-template-columns: 1fr; gap: 8px; } .when { display: flex; gap: 10px; align-items: baseline; } }
</style>

<header class="top"><div class="wrap">
  <div class="brand"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M27.8 7.2A15 15 0 1 0 34.6 16" fill="none" stroke="#9dbcff" stroke-width="2.6" stroke-linecap="round"/><circle cx="31.9" cy="10.6" r="2.8" fill="#fff"/></svg><b>KAIROS</b><span>Preview rundown</span></div>
  <h1>${esc(d.show.title.split(" · ")[0])}</h1>${d.show.title.includes(" · ") ? `<div class="sub">${esc(d.show.title.split(" · ").slice(1).join(" · "))}</div>` : ""}
  <div class="facts"><span>Data <b>${da}.${mo}.${y}</b></span><span>Live <b>${d.show.start} – ${end}</b></span><span>Locația <b>${esc(d.show.venue || "")}</b></span><span><b>${n}</b> momente</span></div>
  <p class="how">Acesta e rundown-ul stream-ului, moment cu moment. <strong>Lasă un comentariu</strong> pe orice moment: apasă „Comentează momentul” sau „Sugerează alt text” pentru ce se spune. Poți da click și direct pe text, în modul de comentarii.</p>
  <p class="note" id="noComments" hidden>Comentariile nu sunt disponibile în această vizualizare. Deschide pagina din linkul primit, autentificat în Claude.</p>
  <div class="legend">${Object.values(CATS).map(([l, c]) => `<span class="chip" style="--c:${c}">${esc(l)}</span>`).join("")}</div>
</div></header>

<main class="wrap">
${sections.map((s) => `<section>${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.rows.map(card).join("")}</section>`).join("\n")}
<p class="foot">Versiunea din ${new Date().toLocaleDateString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" })}. Orele se pot schimba până la eveniment.</p>
</main>

<script>
(async () => {
  let comments = null;
  try { comments = await window.claude?.use?.("comments"); } catch (e) { comments = null; }
  const buttons = document.querySelectorAll(".acts");
  if (!comments) { buttons.forEach((b) => b.hidden = true); document.getElementById("noComments").hidden = false; return; }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".act"); if (!b) return;
    const card = document.getElementById(b.dataset.target);
    const el = b.dataset.kind === "say" ? (card.querySelector(".say") || card.querySelector(".script") || card) : card;
    try { await comments.openComposer({ element: el }); }
    catch (err) {
      if (err && (err.code === "unavailable" || err.code === "not_granted" || err.code === "capability_disabled")) {
        buttons.forEach((x) => x.hidden = true); document.getElementById("noComments").hidden = false;
      }
    }
  });
})();
</script>
`;
fs.writeFileSync(path.join(root, "preview.html"), html);
console.log("preview.html:", n, "momente,", d.show.start, "→", end);
