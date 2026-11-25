/* KAIROS · limba interfeței (EN, RO, FR, ES, IT, RU, ZH = chineza simplificată).
   Se traduce doar interfața: butoane, meniuri, etichete, mesaje. Conținutul rundown-ului (titluri, texte, scripturi,
   nume, comentarii) rămâne exact cum a fost scris.
   - textele fixe din HTML se traduc o dată, la încărcare (KI18N.apply), înainte să apară conținutul;
   - textele generate din cod trec prin KI18N.t("Text englezesc cu {var}", { var });
   - zonele cu conținut se marchează cu data-ni și nu sunt atinse niciodată;
   - limba aleasă se ține în localStorage („kairos-lang”); schimbarea reîncarcă pagina.
   Dicționarul e în kairos-i18n-dict.js (cheia = textul englezesc, valorile = [ro, fr, es, it, ru, zh]). */
(() => {
  "use strict";
  const LANGS = [
    { code: "en", name: "English", short: "EN" },
    { code: "ro", name: "Română", short: "RO" },
    { code: "fr", name: "Français", short: "FR" },
    { code: "es", name: "Español", short: "ES" },
    { code: "it", name: "Italiano", short: "IT" },
    { code: "ru", name: "Русский", short: "RU" },
    { code: "zh", name: "简体中文", short: "ZH" },
  ];
  const IDX = { ro: 0, fr: 1, es: 2, it: 3, ru: 4, zh: 5 };
  const KEY = "kairos-lang";
  const qs = new URLSearchParams(location.search);
  let lang = "en";
  try { lang = qs.get("lang") || localStorage.getItem(KEY) || "en"; } catch (e) { lang = qs.get("lang") || "en"; }
  if (!LANGS.some((l) => l.code === lang)) lang = "en";
  const DEBUG = qs.has("i18n-debug");
  // eticheta HTML: chineza e cea simplificată (contează la alegerea formei caracterelor)
  const TAG = () => (lang === "zh" ? "zh-Hans" : lang);
  const missing = new Set();

  const dict = () => window.KAIROS_I18N_DICT || {};
  // „Start@@prompter”: același text englezesc, alt sens (în engleză se afișează doar partea dinainte de @@)
  function raw(s) {
    const en = s.split("@@")[0];
    if (lang === "en") { if (DEBUG && !(s in dict())) missing.add(s); return en; }
    const row = dict()[s];
    const v = row && row[IDX[lang]];
    if (v == null || v === "") { if (DEBUG) missing.add(s); return en; }
    return v;
  }
  // t("Moved {dir}", { dir }) · valorile se pun ca atare (escaparea HTML rămâne treaba apelantului)
  function t(s, vars) {
    let out = raw(String(s));
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    // română: de la 20 în sus vine „de” între număr și substantiv (39 de segmente, 101 segmente, 120 de momente)
    if (lang === "ro" && vars) out = out.replace(/(^|[^\d.:])(\d+)( (?:segmente|momente|rânduri|titluri|zile|comentarii|scripturi)\b)/g,
      (m, pre, n, rest) => { const r = Number(n) % 100; return pre + n + (Number(n) >= 20 && (r === 0 || r >= 20) ? " de" : "") + rest; });
    return out;
  }

  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "SVG", "CANVAS", "CODE", "KBD"]);
  const HAS_LETTER = /\p{L}/u;
  const ATTRS = ["title", "aria-label", "placeholder", "alt", "data-l"];
  // traduce textele fixe dintr-o bucată de DOM; data-ni = conținut, nu se atinge; data-i18n-html = tot elementul e o cheie
  function apply(root = document) {
    if (!root) return;
    const base = root.nodeType === 9 ? root.documentElement : root;
    if (root.nodeType === 9) root.documentElement.lang = TAG();
    base.querySelectorAll("[data-i18n-html]").forEach((el) => {
      if (el.closest("[data-ni]")) return;
      const k = el.getAttribute("data-i18n-html") || el.innerHTML.trim().replace(/\s+/g, " ");
      el.setAttribute("data-i18n-html", k);
      el.innerHTML = t(k);
      el.setAttribute("data-i18n-done", "");
    });
    const walk = (el) => {
      if (el.nodeType !== 1 || SKIP.has(el.tagName.toUpperCase()) || el.hasAttribute("data-ni")) return;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v && HAS_LETTER.test(v)) { const k = v.trim(); const tr = t(k); if (tr !== k) el.setAttribute(a, tr); }
      }
      if (el.hasAttribute("data-i18n-done")) return;
      for (const n of [...el.childNodes]) {
        if (n.nodeType === 3) {
          const v = n.nodeValue; if (!HAS_LETTER.test(v)) continue;
          const k = v.trim().replace(/\s+/g, " "); const tr = t(k);
          if (tr !== k) { const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0]; n.nodeValue = lead + tr + tail; }
        } else walk(n);
      }
    };
    walk(base);
  }

  function set(code) {
    if (!LANGS.some((l) => l.code === code) || code === lang) return;
    try { localStorage.setItem(KEY, code); } catch (e) {}
    const u = new URL(location.href); u.searchParams.delete("lang");
    location.replace(u.toString());
  }

  // selectorul: un <select> nativ (merge la fel pe telefon, cu tastatura și cu cititorul de ecran)
  function select(cls = "") {
    const s = document.createElement("select");
    s.className = "lang-select " + cls;
    s.setAttribute("aria-label", t("Interface language"));
    s.title = t("Interface language");
    s.setAttribute("data-ni", "");
    s.innerHTML = LANGS.map((l) => `<option value="${l.code}"${l.code === lang ? " selected" : ""}>${l.short} · ${l.name}</option>`).join("");
    s.onchange = () => { const v = s.value; if (!window.KI18N.beforeChange || window.KI18N.beforeChange(v) !== false) set(v); else s.value = lang; };
    return s;
  }
  // formatul local al datelor (zi, lună) în limba aleasă
  const locale = () => ({ en: "en-GB", ro: "ro-RO", fr: "fr-FR", es: "es-ES", it: "it-IT", ru: "ru-RU", zh: "zh-CN" }[lang]);

  window.KI18N = { get lang() { return lang; }, langs: LANGS, t, apply, set, select, locale, missing, debug: DEBUG, beforeChange: null };
  document.documentElement.lang = TAG();
  // scriptul stă după markup, înaintea celorlalte scripturi: textele fixe se traduc înainte să apară conținutul
  apply(document);
})();
