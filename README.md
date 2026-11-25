# KAIROS

Rundown live pentru show-uri și transmisiuni: timer comun pentru toată echipa, mod Live, pop-up mereu deasupra, prompter, comentarii de la clienți.

Live: https://vdeaconescu91-cell.github.io/kairos/

## Pagini
| Pagina | Ce face |
|---|---|
| `index.html` | Pagina de start. Te conectezi cu Google, vezi rundown-urile la care ai acces, pornești unul nou. |
| `rundown.html?id=…` | Editorul: tabelul, modurile Plan / Live, Auto / Manual, pop-up (`P`) și prompter (`T`). |
| `client.html?id=…` | Pagina pentru clienți. Citesc rundown-ul și lasă comentarii; fiecare își vede doar comentariile lui. |
| `join.html?t=…` | Linkul de invitație. Cine îl acceptă devine editor al rundown-ului (sau al echipei). |

## Fișiere
| Fișier | Rol |
|---|---|
| `app.js` | Logica editorului: tabel, Live, pop-up, prompter, comentarii, invitații |
| `sync.js` | Firebase: login, rundown-uri, Live comun, comentarii, invitații, ora serverului |
| `styles.css` | Editorul, în lumea „caietului de regie” (vezi `DESIGN.md`) |
| `kairos-home.css`, `home.css` | Pagina de start, respectiv pagina de invitație |
| `kairos-flower.js` | Floarea din login (cadrele din `hero/`) |
| `rundown-data.js` | Rundown-ul implicit (Turneul Artiștilor, 15.11.2026) |
| `firestore.rules` | Regulile de acces din Firebase. Se publică manual din consola Firebase. |
| `brand/` | Wordmark-ul și favicon-urile |
| `preview.html`, `tools/build-preview.js` | Previzualizare statică a rundown-ului (generată) |

## Cum se publică
Push pe `main` → GitHub Pages publică în ~1 minut. Fișierele CSS/JS au `?v=AAAALLZZOOMM` în linkuri; schimbă versiunea când le modifici, altfel browserele țin varianta veche. Paginile HTML pot rămâne în cache ~10 minute (Ctrl+Shift+R).

Nu există build și nici dependențe instalate: Firebase se încarcă de pe CDN (compat SDK 10.14.1).

## Design
- `PRODUCT.md`: cine folosește KAIROS și ce trebuie să rămână adevărat.
- `DESIGN.md`: lumea vizuală (caietul de regie): culori, fonturi, cue-uri, reguli.
- Interfața e în engleză implicit, cu selector de limbă (EN, RO, FR, ES, IT, RU, ZH) în meniu, pe pagina de start și pe pagina clientului. Se traduce doar interfața; conținutul rundown-ului rămâne în limba în care e scris.
- Texte noi în interfață: scrise în engleză și trecute prin `T()` / `KI18N`, apoi adăugate în `kairos-i18n-dict.js` cu cele 6 traduceri.
- Ecranul de broadcast (`?screen=1`) are stilul lui separat (`SCREEN_CSS` în `app.js`); nu se schimbă odată cu restul.
