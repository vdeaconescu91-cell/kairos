/* KAIROS · un singur player pentru muzica segmentelor, folosit în rundown și în Preview.
   Orice buton cu data-music="URL" pornește/oprește piesa; o singură piesă cântă odată.
   Butonul primește clasa .playing, iar elementul [data-music-time] din același .music arată timpul scurs / durata. */
(() => {
  "use strict";
  const audio = new Audio(); audio.preload = "none";
  let cur = null;   // URL-ul care cântă acum
  const fmt = (s) => !isFinite(s) ? "--:--" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function paint() {
    document.querySelectorAll("[data-music]").forEach((b) => {
      const on = b.dataset.music === cur && !audio.paused;
      b.classList.toggle("playing", on);
      b.setAttribute("aria-label", on ? "Oprește muzica" : "Ascultă muzica");
      b.title = on ? "Oprește" : "Ascultă muzica asignată";
      const box = b.closest(".music"), tm = box && box.querySelector("[data-music-time]"), bar = box && box.querySelector("[data-music-bar]");
      if (tm) tm.textContent = b.dataset.music === cur ? `${fmt(audio.currentTime)} / ${fmt(audio.duration)}` : "";
      if (bar) bar.style.width = b.dataset.music === cur && audio.duration ? `${(audio.currentTime / audio.duration) * 100}%` : "0%";
    });
  }
  function toggle(url) {
    if (cur === url && !audio.paused) { audio.pause(); paint(); return; }
    if (cur !== url) { cur = url; audio.src = url; }
    audio.play().catch((e) => { console.warn("muzica nu pornește", e); cur = null; paint(); window.dispatchEvent(new CustomEvent("kaudio-error")); });
    paint();
  }
  function stop() { audio.pause(); cur = null; paint(); }
  for (const ev of ["timeupdate", "play", "pause", "loadedmetadata"]) audio.addEventListener(ev, paint);
  audio.addEventListener("ended", () => { cur = null; paint(); });

  // clic pe bară = sari în piesă
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-music]");
    if (b) { e.preventDefault(); e.stopPropagation(); toggle(b.dataset.music); return; }
    const track = e.target.closest("[data-music-track]");
    if (track && audio.duration) {
      const box = track.closest(".music"), btn = box && box.querySelector("[data-music]");
      if (btn && btn.dataset.music === cur) { const r = track.getBoundingClientRect(); audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; }
    }
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && cur) stop(); });

  // HTML-ul unui player mic: buton, nume, timp, bară
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function html(m, extra = "") {
    if (!m || !m.url) return "";
    return `<div class="music"><button type="button" class="mplay" data-music="${esc(m.url)}" aria-label="Ascultă muzica" title="Ascultă muzica asignată">`
      + `<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg><svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zm5 0h3v11H9z"/></svg></button>`
      + `<div class="mmeta"><span class="mname" title="${esc(m.name)}">♪ ${esc(m.name)}</span><span class="mtime" data-music-time></span>`
      + `<span class="mtrack" data-music-track><span data-music-bar></span></span></div>${extra}</div>`;
  }
  window.KAudio = { toggle, stop, html, paint };
})();
