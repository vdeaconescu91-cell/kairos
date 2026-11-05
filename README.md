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
| `styles.css`, `home.css` | Stiluri pentru editor, respectiv pentru paginile de start/invitație |
| `kairos-sphere.js` | Sfera de sticlă în WebGL (hero) |
| `kairos-orb.js` | Varianta 2D a sferei, pentru browserele fără WebGL |
| `rundown-data.js` | Rundown-ul implicit (Turneul Artiștilor, 15.11.2026) |
| `firestore.rules` | Regulile de acces din Firebase. Se publică manual din consola Firebase. |
| `brand/` | Wordmark-ul și favicon-urile |
| `preview.html`, `tools/build-preview.js` | Previzualizare statică a rundown-ului (generată) |

## Cum se publică
Push pe `main` → GitHub Pages publică în ~1 minut. Fișierele CSS/JS au `?v=AAAALLZZOOMM` în linkuri; schimbă versiunea când le modifici, altfel browserele țin varianta veche. Paginile HTML pot rămâne în cache ~10 minute (Ctrl+Shift+R).

Nu există build și nici dependențe instalate: Firebase se încarcă de pe CDN (compat SDK 10.14.1).
