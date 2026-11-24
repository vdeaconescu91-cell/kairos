/* KAIROS · previzualizarea grafică a segmentului (ce se vede pe ecran în acel moment).
   it.visual = cheia unei imagini din hero/previews (capturi din panoul de broadcast, pe un cadru de teren),
   sau {url, name} pentru o imagine încărcată separat. Folosit în rundown și în Preview.
   Clic pe miniatură = imaginea mare (Esc sau clic ca s-o închizi). */
(() => {
  "use strict";
  const T = (s, v) => (window.KI18N ? window.KI18N.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));
  const LIB = {
    "starting-soon": T("Starting soon"), "lower-third": T("Lower third"), "partener": T("Partner pop-up"), "ing": T("ING card"),
    "reguli": T("Tournament rules"), "tragerea": T("The draw"), "interviu": T("Interview PiP"), "donatii": T("Donations bar"),
    "game-intro": T("Game intro"), "scor-teren": T("Court score"), "scor-meci": T("Match score"), "clasament": T("Group standings"),
    "eliminatorie": T("Knockout stage"), "road-to-final": T("Road to the final"), "brb": T("Be right back"),
    "campioni": T("Champions"), "sponsori": T("Sponsors"), "thanks": T("Thanks for watching"),
  };
  const V = "3";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function resolve(v) {
    if (!v) return null;
    if (typeof v === "string") return LIB[v] ? { url: `hero/previews/${v}.webp?v=${V}`, name: LIB[v], key: v } : null;
    return v.url ? { url: v.url, name: v.name || T("Image"), key: "" } : null;
  }
  // miniatura; `extra` = butoanele de editare
  function html(v, extra = "", cls = "") {
    const r = resolve(v); if (!r) return "";
    return `<figure class="vis ${cls}"><button type="button" class="vthumb" data-vis="${esc(r.url)}" data-vname="${esc(r.name)}" title="${T("View larger: {name}", { name: esc(r.name) })}" aria-label="${T("View larger: {name}", { name: esc(r.name) })}">`
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
