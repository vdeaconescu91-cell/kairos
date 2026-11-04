# TA Rundown

Rundown live pentru **Turneul Artiștilor · Charity Padel Cup** (15.11.2026, Padel One București), după modelul Rundown Studio, cu un design inspirat din AICA.

## Ce face
- **Rundown editabil direct în tabel.** Fiecare celulă se editează direct. Pentru durată se scriu minutele, iar orele de start se recalculează singure. Rândurile se mută trăgând de mânerul ⋮⋮. Se pot adăuga segmente și secțiuni, se pot duplica și șterge, iar orice modificare se anulează cu Ctrl+Z.
- **Plan.** Aplicația arată segmentul curent după ceas, pe baza orei de start a show-ului.
- **Live.** Butonul *Start show* pornește cronometrul, iar *Următorul ▶* (sau tasta `N`) trece la segmentul următor. Aplicația arată:
  - timpul rămas din segment, galben în ultimul minut și roșu când segmentul a depășit timpul;
  - cât de în urmă sau de înainte e show-ul față de plan.
- **Pop-up (tasta `P`).** E o fereastră mică, mereu deasupra celorlalte, cu:
  - ce e acum și cât mai e din segment;
  - ce urmează, în cât timp și ce se spune.

  În Chrome și Edge rămâne deasupra oricărei aplicații (Document Picture-in-Picture). În alte browsere se deschide ca fereastră obișnuită.
- **Filtre** pe tipuri de segment: meci live, interviu, grafică, platformă, caritabil, ING, donații, giveaway, pauză.
- **Export / import JSON** și **print**, din meniul ⋯.

## Unde se salvează
În browserul în care lucrezi (localStorage). Tab-urile deschise în același browser se sincronizează între ele.
Între calculatoare diferite nu există sincronizare: rundown-ul se mută prin **⋯ → Exportă JSON**, iar pe celălalt calculator prin **Importă JSON**.

## Fișiere
- `index.html`, `styles.css`, `app.js`: aplicația, fără build și fără dependențe.
- `rundown-data.js`: rundown-ul implicit, cel care se încarcă la prima deschidere sau din **⋯ → Revino la rundown-ul implicit**.

Se deschide direct `index.html` în browser sau se publică pe GitHub Pages.
