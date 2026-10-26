# Lessons — Margherite

> Erreurs passées et règles apprises. Relire au début de chaque session.

## 2026-10-23 — Tests Playwright
**Erreur :** une assertion sur `innerText` d'un `<h2>` échouait : `innerText` applique `text-transform: uppercase` (« NOUVEAU TIRAGE » ≠ « Nouveau tirage »).
**Règle :** comparer du texte avec `textContent` dès que le CSS transforme la casse ; réserver `innerText` à ce que l'utilisatrice voit.

## 2026-10-26 — Publication d'Artifact depuis le scratchpad
**Erreur :** publier avec le chemin court Windows (`C:\Users\VICTOR~1\...`) a été bloqué par une règle de lecture.
**Règle :** passer le chemin long (`C:\Users\Victor MICHEL\...`) pour `root`, `file_path` et les fichiers écrits ; un fichier écrit via le chemin court doit être relu via le chemin long avant édition.

## 2026-10-26 — Maquettes Artifact Design non vérifiées visuellement
**Erreur :** deux versions publiées sans voir le rendu (navigateur intégré non connecté à claude.ai) ; au premier rendu, 3 défauts visibles (texte coupé, libellé qui déborde, aiguille sur le texte).
**Règle :** générer un rendu local (`scratchpad/gen_preview.mjs` → `preview.html`, servi en `http://localhost`, pas en `file://` qui bloque les scripts) et regarder chaque écran à 390×844 avant de publier. Sous Windows, `python` écrit en CRLF : normaliser (`sed -i 's/\r$//'`) avant de comparer ou publier.

## 2026-10-26 — Horaires du cadran invisibles dans le canevas
**Erreur :** les heures du cadran (`<text>{{trou}}</text>` dans un `<svg>`) s'affichaient dans mon aperçu maison mais pas dans le canevas : le moteur Design enveloppe chaque trou de texte dans un `<span>` HTML, invisible en SVG. Un remplacement de bloc CSS « de A jusqu'à B » avait en plus effacé les styles des Tendances, sans que je le voie.
**Règle :** jamais de texte variable dans un `<svg>` d'artboard : poser les libellés en HTML par-dessus. Vérifier avec le vrai moteur (`artifact-type/dc-runtime.js` servi comme `support.js` à côté des `.dc.html`, en `http://localhost`) et non un aperçu maison. Après tout remplacement de bloc, comparer la liste des sélecteurs CSS avant/après.

## 2026-10-26 — Canevas modifié depuis la page pendant le travail
**Erreur :** Victor a déplacé des planches et la page a réenregistré des fichiers pendant que je publiais ; deux publications ont été refusées, et une autre a remplacé des planches que je n'avais pas relues.
**Règle :** avant de republier `canvas.json` ou un fichier ancien, le relire (`Artifact` action `read`), comparer avec ma copie (`diff --strip-trailing-cr`) et ne reporter que mes changements. Signaler à Victor tout fichier remplacé sans relecture.

## 2026-10-26 — Une nouvelle version ne doit jamais écraser la précédente
**Erreur :** évitée — Victor a exigé que la v3 soit un canevas séparé pour comparer avec la v2.
**Règle :** pour toute nouvelle proposition de design, créer un nouvel Artifact (ou une nouvelle page) et y copier la version précédente comme référence (`Reference.dc.html`) ; ne plus publier dans l'ancien.

<!-- Format :
## [YYYY-MM-DD] — [contexte]
**Erreur :** ce qui s'est passé
**Règle :** ce qu'il faut faire à la place
-->
