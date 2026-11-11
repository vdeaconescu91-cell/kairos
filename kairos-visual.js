/* KAIROS · previzualizarea grafică a segmentului (ce se vede pe ecran în acel moment).
   it.visual = cheia unei imagini din hero/previews (capturi din panoul de broadcast, pe un cadru de teren),
   sau {url, name} pentru o imagine încărcată separat. Folosit în rundown și în Preview.
   Clic pe miniatură = imaginea mare (Esc sau clic ca s-o închizi). */
(() => {
  "use strict";
  const LIB = {
    "starting-soon": "Starting soon", "lower-third": "Lower third", "partener": "Popup partener", "ing": "Card ING",
    "reguli": "Regulile turneului", "tragerea": "Tragerea la sorți", "interviu": "PiP interviu", "donatii": "Bara donații",
    "game-intro": "Game intro", "scor-teren": "Scor teren", "scor-meci": "Scor meci", "clasament": "Clasament grupă",
    "eliminatorie": "Faza eliminatorie", "road-to-final": "Road to the final", "brb": "Be right back",
    "campioni": "Campioni", "sponsori": "Sponsori", "thanks": "Thanks for watching",
  };
  const V = "1";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function resolve(v) {
    if (!v) return null;
    if (typeof v === "string") return LIB[v] ? { url: `hero/previews/${v}.webp?v=${V}`, name: LIB[v], key: v } : null;
    return v.url ? { url: v.url, name: v.name || "Imagine", key: "" } : null;
  }
  // miniatura; `extra` = butoanele de editare
  function html(v, extra = "", cls = "") {
    const r = resolve(v); if (!r) return "";
    return `<figure class="vis ${cls}"><button type="button" class="vthumb" data-vis="${esc(r.url)}" data-vname="${esc(r.name)}" title="Vezi mare: ${esc(r.name)}">`
      + `<img src="${esc(r.url)}" alt="${esc(r.name)}" loading="lazy" decoding="async"></button><figcaption>${esc(r.name)}${extra}</figcaption></figure>`;
  }
  // lightbox
  let box = null;
  function show(url, name) {
    if (!box) {
      box = document.createElement("div"); box.className = "vbox"; box.hidden = true;
      box.innerHTML = `<figure><img alt=""><figcaption></figcaption></figure>`;
      box.addEventListener("click", hide); document.body.appendChild(box);
    }
    box.querySelector("img").src = url; box.querySelector("img").alt = name; box.querySelector("figcaption").textContent = name;
    box.hidden = false;
  }
  function hide() { if (box) box.hidden = true; }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-vis]"); if (!t) return;
    e.preventDefault(); show(t.dataset.vis, t.dataset.vname);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.KVisual = { LIB, resolve, html, show, hide, thumb: (k) => `hero/previews/${k}.webp?v=${V}` };
})();
