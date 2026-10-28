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

## 2026-10-26 — Maquettes : rendre avec le vrai moteur avant de publier (suite)
**Erreur :** évitée — la première mise en page v3.1 débordait de l'écran (carte « pourquoi » coupée sous la barre d'onglets, `=` qui chevauche une valeur) ; vu seulement au rendu.
**Règle :** `Prototype.dc.html` est en `overflow:hidden` sur 844 px : après chaque ajout, rendre avec `support.js` (= `dc-runtime.js`) en `http://localhost` via Playwright (`page.screenshot` avec `clip` 390×844 dans le scratchpad) et vérifier aussi les états à bannière de minuteur (−52 px). Pas de `{{x.0.y}}` : exposer `e0/e1/e2`.

## 2026-10-26 — Données de démo inventées qui contredisent le vrai bébé
**Erreur :** la maquette affichait 6,7 repas/j, 3 h 15 de sommeil d'affilée et un lait en mL/j ; les vraies données (capture de l'app actuelle) donnent ≈ 11,5 repas/j, ≈ 2 h de sommeil d'affilée et aucune quantité.
**Règle :** dès que Victor fournit des données réelles, les mettre dans la maquette (une seule source, `data/`), supprimer ce qui n'existe pas dans les données (quantités, période 28 j) et afficher « trop peu noté » plutôt qu'une moyenne fausse. Extraction par pixels : annoncer l'incertitude (±15 min, échelle de l'axe).
**Aussi :** sous Bash Windows, `python` n'accepte pas `/c/...` (utiliser `C:/...`) et un gros heredoc Python peut échouer : écrire le script avec Write puis l'exécuter.

## 2026-10-26 — Une visualisation doit se comprendre sans légende
**Erreur :** la frise « Sa nuit » (une ligne par nuit, 19 h → 9 h, violet/vert) a été jugée « absolument pas compréhensible » ; j'avais mis une phrase d'explication au lieu de simplifier.
**Règle :** pour Victor, « je veux comprendre direct » : préférer une liste étape par étape (heure, libellé, écart) ou un graphique à barres avec valeurs écrites. Si une légende est nécessaire, c'est que le graphique est trop complexe.

## 2026-10-26 — Une variable en double casse tout le Prototype sans erreur visible
**Erreur :** `const sel` déclaré deux fois dans `renderVals()` → `[dc-runtime] logic class eval FAILED … Identifier 'sel' has already been declared` : le gabarit s'affiche sans logique, boutons introuvables (timeout Playwright).
**Règle :** après chaque patch, lire la console (`page.on('console')` filtré sur `dc-runtime`) ; préfixer les variables nouvelles (`nsl`, `ntX`…) ; l'erreur `Expected moveto` sur `<path d="{{…}}">` est normale (avant rendu).

## 2026-10-26 — Un splice peut supprimer du contenu voisin
**Erreur :** remplacer « de la carte A jusqu'à `];` » a supprimé la carte suivante de « À retenir » (vu seulement à l'écran).
**Règle :** après tout remplacement de bloc de données, compter les éléments avant/après (`INS`, `K`, `regRaw`…) et regarder l'écran concerné.

## 2026-10-26 — Message coupé ou ambigu
**Erreur :** « il y a pas assez d'espace e… » (tronqué) : j'ai deviné.
**Règle :** annoncer l'interprétation en une ligne dans la réponse et demander la suite si doute ; ne pas multiplier les itérations sur une devinette.

## 2026-10-26 — Environnement Windows (outils)
`pkill` n'existe pas dans Git Bash : arrêter un serveur local avec `Get-NetTCPConnection -LocalPort 8765 | Stop-Process` (PowerShell). Les outils Playwright (MCP) se déconnectent parfois : `ToolSearch` « playwright browser_run_code_unsafe » les recharge.

## 2026-10-28 — Cartes écrasées dans la colonne qui défile
**Erreur :** les nouvelles cartes « À retenir » apparaissaient coupées : `.scroll` est une colonne flex et ses enfants rétrécissent (`flex-shrink:1`) avec `overflow:hidden`. Aucune erreur, vu seulement à la capture.
**Règle :** tout nouveau bloc enfant direct de `.scroll` reçoit `flex:none` ; regarder la capture de chaque écran modifié avant de publier.

## 2026-10-28 — Écart calculé sur une valeur et affiché sur une autre
**Erreur :** la phrase de nuit disait « 45 min de plus » alors que les tuiles montraient 4 h 10 contre 3 h 30 (écart calculé sur la médiane brute, tuile arrondie à 5 min).
**Règle :** calculer les écarts affichés à partir des valeurs arrondies que l'écran montre (`r5`), y compris les repères des frises.

<!-- Format :
## [YYYY-MM-DD] — [contexte]
**Erreur :** ce qui s'est passé
**Règle :** ce qu'il faut faire à la place
-->
