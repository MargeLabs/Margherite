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

## 2026-10-28 — Fiche « Détail du sommeil » illisible
**Erreur :** `.drow .m > span{display:block;font-size:13px;color:var(--mut)}` s'appliquait aussi au texte principal, que le moteur enveloppe dans un `<span>` : titre et détail sortaient en petit gris, et Victor ne comprenait plus la fiche.
**Règle :** dans un `.dc.html`, ne jamais cibler `> span` sous un conteneur qui reçoit un trou `{{…}}` directement ; donner une classe à chaque partie (intitulé, valeur, détail) et styler par classe.

## 2026-10-28 — Publication refusée « version non vue » sur un canevas Design
**Erreur :** trois refus d'affilée malgré la lecture de `project/Prototype.dc.html` seul ; ni `list` ni la lecture de fichiers ne comptaient comme « vue ».
**Règle :** relire l'artefact avec `read` + `page: true` (sans `path`), puis republier avec `root` = dossier contenant `project/` et `file_path` = chemin absolu du fichier modifié. Avant, comparer le fichier en ligne et `git show HEAD:…` (`diff --strip-trailing-cr`) pour ne rien écraser.

## 2026-10-29 — Collisions de noms de classe dans un gros .dc.html
**Erreur :** les étiquettes du graphe semaine (`wx cal`) héritaient de `.cal{display:grid}` du calendrier du Journal : 8 étiquettes dans 7 colonnes, la dernière passait à la ligne (déjà en V4). Puis un `sed s/class="hb"/…/g` pour lever une autre collision a aussi renommé la pastille de légende qui portait la même classe.
**Règle :** avant de créer une classe, `grep -n "\.nom[{ .:]"` sur tout le fichier ; renommer avec un motif qui inclut le contexte (balise ou parent), jamais un `s///g` sur la seule classe. Un défaut de mise en page inexpliqué : lire `getComputedStyle` (display, flex-wrap) avant de deviner.

## 2026-10-29 — Comparer deux rendus au pixel près
**Erreur :** évitée — la comparaison Accueil V4/V5 différait sur une zone… qui différait aussi entre deux captures de la V4 (soleil, marguerite et halo animés).
**Règle :** pour prouver qu’un écran est inchangé, capturer avec `reducedMotion: 'reduce'` (le CSS coupe les animations) et comparer avec `ImageChops.difference(...).getbbox()` ; vérifier aussi que le gabarit de l’écran est identique (`diff` entre les marqueurs de section).

## 2026-10-30 — Reprise d'un travail interrompu : noms déjà pris
**Erreur :** une session précédente avait laissé du CSS/gabarit à moitié écrit (`.wd`, `wDet`) ; ma logique a redéclaré `const wSel` (déjà pris par le Journal) et `.wd` entrait en collision avec les pastilles du Journal → logique du Prototype en échec, écran vide.
**Règle :** en reprenant un diff non commité, `git diff` d'abord ; avant tout nouveau `const` dans `renderVals()` ou toute classe : `grep -n "const nom\b"` et `grep -n "\.nom[{ .:]"`. Sous un conteneur qui reçoit un trou `{{…}}`, styler `> span`, jamais `span`.

## 2026-10-30 — Libellé de comparaison sans référence
**Erreur :** « La veille : dernière sieste finie 2 h 10 plus tard » : Victor ne savait ni de quel jour il s'agissait ni « plus tard que quoi » ; j'avais empilé deux blocs de pastilles qu'il fallait relier de tête.
**Règle :** un écart affiché doit porter sa référence (« que d'habitude ») et son jour ; préférer une ligne de plus dans une liste existante, dans l'ordre du temps, à un nouveau bloc. Quand la demande est « il faut comprendre pourquoi », vérifier que la cause possible est voisine de l'effet à l'écran.

## 2026-10-30 — Classe CSS déjà prise et règle « orpheline » encore utilisée
**Erreur :** ma classe `wk` (graphe en 4 colonnes) existait déjà (`.wk{display:flex;flex-direction:column}`, graphe de Pilotage) : les barres s'empilaient. Et en nettoyant les règles de « Ses chiffres », j'ai supprimé `.ans`, encore utilisée par la phrase de nuit de Pilotage ; vu seulement en comparant au pixel avec HEAD.
**Règle :** `grep -n "\.nom[{ .:]"` avant de nommer une classe (préfixe de contexte : `xp-`, `w4`) ; avant de supprimer une règle CSS, `grep` son nom sur tout le fichier (gabarit compris), pas seulement dans la section remplacée ; comparer Accueil / Pilotage / Journal à HEAD avec `ImageChops` (rendus de HEAD via `subprocess git show`, jamais via un pipe PowerShell qui abîme l'UTF-8).

## 2026-10-30 — Données absentes : le dire plutôt que combler
**Erreur :** évitée — le brief demandait bain, rituels, endormissement et cycles ; aucune de ces données n'existe (le journal note début et fin de sommeil, pas le temps d'endormissement ni les cycles).
**Règle :** une question sans donnée devient une carte « Pas encore noté » / « Non mesurable ici » qui dit pourquoi ; un total de lait sur 24 h n'est annoncé que les jours sans tétée, sinon « biberons seulement ».

## 2026-10-31 — Popup plein format dans le canevas
**Erreur :** `.sheet` en `height:calc(100% - 28px)` débordait de 26 px (padding hors hauteur, `content-box`), et le fond `.scrim-bg` (un `<button>` absolu sans hauteur) ne captait rien au-dessus de la feuille ; en plus `button:active{transform:scale(.97)}` annulait le clic sur les 10 px du haut (le pointeur sort du bouton réduit). Vu seulement en testant avec la vraie souris.
**Règle :** pour une popup : `box-sizing:border-box`, fond avec `height:100%` et `:active{transform:none}` (classe propre `xm-bg`, ne pas toucher aux autres feuilles) ; tester fermeture par la croix, le fond (`page.mouse.click`, pas `locator.click`) et le bouton.

<!-- Format :
## [YYYY-MM-DD] — [contexte]
**Erreur :** ce qui s'est passé
**Règle :** ce qu'il faut faire à la place
-->

## 2026-10-31 — Couche calcul de l'app réelle
**Erreur :** évitée — la maquette affichait des « repères d'âge » (14 à 17 h de sommeil à 9 semaines, éveil 1 h à 1 h 30, repas toutes les 2 à 3 h) valables seulement pour un bébé de 9 semaines et sans source ; les porter tels quels dans l'app réelle les aurait affichés à tout âge.
**Règle :** une recommandation sans source validée ne passe pas du mockup à l'app ; elle reste derrière un interrupteur (`AGE_REFS`) jusqu'à sourcing. Les habitudes, elles, ne sortent que de données notées (3 journées complètes minimum), testées sur des journaux à bonne réponse connue.

## 2026-10-31 — Formulaire de la maquette appelé avec des champs non remplis
**Erreur :** `saveBaby(undefined…)` plantait (`trim` sur `undefined`) : l'état de saisie de la maquette n'existe qu'après la première frappe. Trouvé seulement par le parcours navigateur, pas par les tests unitaires.
**Règle :** toute fonction appelée depuis la logique portée accepte `undefined` ; garder le parcours `scripts/e2e/app.cjs` dans la boucle de vérification, console propre comprise.

## 2026-10-31 — Valeur par défaut d'une maquette reprise telle quelle
**Erreur :** la feuille Dodo proposait « Lancer le chrono depuis [maintenant − 1 h] » (pensé pour saisir un dodo après coup) ; en usage réel Victor a lu ça comme un décalage horaire de l'app. Le fuseau était correct (testé Paris et UTC).
**Règle :** une valeur par défaut qui décale l'heure doit être « maintenant » ; avant de conclure à un bug de fuseau, tester le fuseau (`timezoneId` Playwright) puis lire le défaut du formulaire.

## 2026-10-31 — Déploiement : trois pièges de configuration
**Erreur :** URL Supabase copiée avec `/rest/v1/` (erreur PostgREST PGRST125 à la connexion, message générique côté app) ; utilisateur créé sans « Auto Confirm » ; avertissement Vercel sur `NEXT_PUBLIC_*` en type Secret.
**Règle :** les `NEXT_PUBLIC_*` sont lisibles dans le bundle déployé : diagnostiquer en lisant le bundle et en appelant l'endpoint `auth/v1/token` avec un faux mot de passe, sans demander le code. Le README doit dire « URL sans chemin » et « type Config ».
