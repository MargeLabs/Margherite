# Todo — Margherite

> Mis à jour à chaque session. Cocher les tâches terminées.

## Objectif de la prochaine session
Faire valider la v3.19 par Victor (canevas https://claude.ai/artifact/4weGi7dvU2YFfjdyyKYGMx, version 32), récupérer l'export réel de l'app actuelle, trancher les arbitrages A1–A6, puis écrire le plan de développement. **Aucun code d'app avant validation explicite de Victor.**
Reprise : lire `memory/context.md` (section « Reprendre les maquettes ») ; copie locale des sources dans `maquettes/v3/`.

## Base de connaissances sur les rythmes des bébés (2026-10-31) — chantier futur, rien d'implémenté
Architecture, besoins en données et étapes documentés dans `INTELLIGENCE.md` section 10. **Ne pas commencer sans accord de Victor.**
- [x] Documenter l'architecture cible, la structure d'une entrée, les niveaux de confiance, les règles d'usage et les garde-fous
- [ ] 1. Identifier et qualifier les sources (HAS, Santé publique France, OMS, sociétés savantes, publications) : aucune n'est encore vérifiée
- [ ] 2. Figer tranches d'âge et indicateurs (dictionnaire, lié à l'étape 1 du plan principal)
- [ ] 3–4. Collecter, structurer et documenter (source, date, confiance)
- [ ] 5. Créer la base + `getReference` (TDD) ; 6. connecter au moteur indicateur par indicateur ; 7. évaluer sur cas réels avec relecture d'un professionnel
- [ ] Trancher : qui valide les repères (pédiatre, cf. A4), format de stockage, cadence de relecture, alimentation déclarée ou déduite

## V5 — Popups après un ajout (2026-10-31, demande de Victor)
Réutilise `typ` (siestes habituelles par rang : plage de début, durée, éveil avant), `wins` (créneaux de dodo à venir de l'Accueil), `rFw` (repas → sieste de « À retenir »), `doSave` / `addEv`, `.scrim`, `.lr`, `.tn/.tq`, `.btn`. Remplace le toast de ces trois ajouts par un petit popup centré (avec « Annuler cet ajout »).
- Dodo enregistré (feuille ou chrono arrêté) : « dans ses habitudes ? » = heure de début, durée, éveil avant, comparés à la sieste du même rang ; nuit = heure de coucher. Chrono lancé : l'heure de début seulement. Jamais « normal / anormal » ; peu de données → on le dit.
- Biberon enregistré : prochain dodo probable = première fourchette de `wins` (intervalle, pas de compte à rebours) + « d'après ses repas » si l'habitude repas → sieste est solide ; endormi → « s'estimera à son réveil ».
Critique : (1) le popup ne doit pas se cumuler avec le toast → un seul des deux ; (2) un biberon noté avec retard ne doit pas donner une fourchette déjà passée → on filtre ; (3) tétée : non demandée, laissée telle quelle (toast).
- [x] Popup dodo / chrono ; popup biberon ; testés avec le vrai moteur (dans l'habitude, hors habitude, peu de données, endormi, annuler) ; Accueil / Pilotage / Journal identiques au pixel à la version précédente
- [x] Pilotage › Semaine › Repas : « 830 mL » en avant comme « 8,3 repas » (demande de Victor)
- Retiré après essai : ligne « d'après ses repas » (15:40 contredisait la fourchette de 14:05 – 14:35) → une seule estimation par popup
- [ ] Tétée : pas de popup (non demandé) ; à confirmer

## V5 — « Aller plus loin » en popups (2026-10-31, brief de Victor)
Réutilise `.scrim` / `.sheet` / `.grab` / `.x`, `.rt.lead` (synthèse), `.hb-li` (puces), `.xt` (tableau), les items `xi` (graphes, frise, tuiles de comparaison). Les 4 cartes de la page deviennent compactes (titre + courte description) ; un clic ouvre la popup (état `xo`).
Critique avant exécution : (1) aucune référence d'âge sourcée n'existe (INTELLIGENCE.md §10 = chantier futur) → on ne réutilise que les 3 repères d'exemple de l'Accueil, présentés comme « repère général, pas un objectif », omis quand il n'y en a pas ; (2) pas de nouveau calcul inventé : seuls ajouts = répartition nuit / siestes, sommeil total par semaine, horaires des siestes, repas par jour par semaine ; (3) la popup doit rester lisible : synthèse en 3 puces max, sections courtes, graphiques seulement s'ils portent une donnée.
- [x] Cartes compactes + popup (en bref → sections → repère d'âge → fermer : croix, fond, bouton Fermer)
- [x] Contenu : sommeil (durée, répartition nuit / siestes, évolution, nuits, cycles), siestes (nombre, durée, horaires, éveils, lien), alimentation (fréquence, horaires, quantités, évolution, lien), habitudes (liens, bain / rituels)
- [x] Rendu réel 390×844 (4 popups, états peu / vide / sombre), console propre, Accueil / Pilotage / Journal identiques au pixel
- [ ] Validation de Victor ; repères d'âge = 3 exemples de l'Accueil, à sourcer (INTELLIGENCE.md §10) ; `/impeccable audit` non lancé

## V5 — Comprendre « Explorer son rythme » (2026-10-30, brief de Victor)
Même canevas V5, Accueil / Pilotage / Journal intacts. Réutilise `typ` / `nty` (niveau 1), `.hcard`, `.sm4`, `.mf-tr`, `.ch*`, `.lr`, les tags `tn/tc/tq`, le moteur de liens `lkR` (« À retenir »).
Critique avant exécution (3 objections) : (1) bain et rituels n'existent pas dans les données → afficher « pas encore noté », ne rien inventer ; (2) le journal ne mesure ni les cycles ni l'endormissement → le dire ; (3) les quantités de lait ne couvrent que les biberons → ne jamais annoncer un total sur 24 h quand des tétées existent.
- [x] Onglet « Horaires et chiffres » → « Explorer son rythme » ; À retenir jusqu'à 3 observations solides (liens « Son rythme en détail » / « Son sommeil » ouvrent le bon bloc et l'amènent à l'écran)
- [x] Niveau 1 : Sa journée (inchangée), Sa nuit = coucher · réveils (+ repas de nuit) · plus long sommeil · réveil du matin
- [x] Niveau 2 : 4 blocs repliés (un seul ouvert) — sommeil et cycles, siestes et éveil, alimentation, habitudes et liens ; chaque analyse = question, phrase, graphique si utile, statut (Constaté / Une tendance se dessine / À confirmer / Rien de net / Pas assez de données / Non mesurable ici / Pas encore noté) + base de données
- [x] Retirer « Ses chiffres » (chips, périodes 7/14/28, liste complète) et le CSS orphelin
- [x] Rendu réel 390×844 (normal / peu / vide / sombre), console propre ; Accueil, Pilotage jour + semaine, Journal liste + calendrier identiques au pixel à HEAD
- [x] Publié : canevas V5, version 46
- [x] Retours : section « Ce qui change » (4 repères, mini-barres par semaine, touche = détail) ; liens en deux tuiles + pastille d'écart, nuits les plus continues en tableau, analyses sans résultat grisées en fin de bloc ; cartes Sa journée / Sa nuit : en-tête + 4 tuiles visibles, frise et détail pliés sous un bouton
- [ ] Validation de Victor ; `/impeccable audit` + polish (non lancé) ; bain et rituels : aucune donnée → à ajouter si Victor veut ces saisies (suivis perso de l'Accueil non analysés)
- [ ] Pilotage › Semaine garde « Cycles par nuit » / « Durée d'un cycle » : à renommer « périodes » pour rester cohérent avec Comprendre (hors périmètre de ce brief)

## V5 — Moins de clics, plus de défilement (2026-10-29)
Nouveau canevas séparé (V4 intacte). Copie locale `maquettes/v5/project/`. Accueil, Journal, feuilles et tire-lait : inchangés.
Organisations étudiées : A) une page par espace, sections empilées (retenue) ; B) garder les onglets mais chaque vue défilante ; C) sommaire de liens-ancres collant. A supprime le plus de clics sans nouveau composant.
Canevas : https://claude.ai/artifact/K5HeWPHpnmZ2Lp6LzMZpRZ (version 3).
- [x] Pilotage = un seul défilement : jour (flèches) → cadran + légende avec valeurs → la suite probable → la nuit qui précède ce jour (déplacée de Comprendre) → ses 7 derniers jours (sommeil + repas dans le même graphe, touche un jour = cadran de ce jour). Retirés : Jour/Semaine, flèches de semaine, Dodo/Repas, grandes tuiles (doublon Accueil), comparatif semaine (→ Comprendre)
- [x] Comprendre = bascule « À retenir | Horaires et chiffres » (choix de Victor en cours de route) ; Horaires et chiffres = Ses horaires (journée puis nuit, repères + frise, étapes repliées) → Ce qui change (tendances en phrases, graphe + période plus bas) → tous ses chiffres replié
- [x] Rendu réel 390×844 + console ; Accueil identique au pixel près à la V4 (animations coupées)
- [x] Publier le canevas V5 (Main copié, Prototype V5, Référence V4) ; commit
- [x] Retours de Victor : légende sans Éveillé / Probable ; Pilotage › Jour / Semaine remis comme la V4, Dodo / Repas centré (version 6)
- [x] Doublon comparatif : gardé dans Pilotage › Semaine ; Comprendre › Ce qui change → « Ses chiffres » (graphe + liste repliée) (version 7)
- [ ] Validation de Victor ; `/impeccable audit` + polish sur Pilotage et Comprendre V5 (non lancé)
- [ ] Planche « Écrans » V5 (Pilotage et Comprendre en pleine hauteur) si Victor veut comparer sans cliquer

## V4 « Jardin de joie » — Comprendre rassurant (2026-10-28)
Canevas https://claude.ai/artifact/PUPP3En3PsK4s8W2dKChWi (même artefact, pas de nouvelle version ; V3 et code de prod intacts).
- [x] Comprendre = 3 entrées (onglets) : À retenir · Ses horaires (Journée / Nuit) · Ses chiffres
- [x] À retenir : 2 observations max, calculées (repas → éveil avant sieste, sieste → repas, dernière nuit vs habituelle, tendance), statut « constaté / se dessine / encore fragile », période + n ; « Nous apprenons encore… » si peu de données ; rappel non médical
- [x] Sa journée type : frise V4 conservée + repas types (pastilles pêche) + phrase de synthèse + éveils dans les étapes
- [x] Sa nuit type : phrase de synthèse, 2 frises alignées, 3 indicateurs, détails repliés
- [x] Ses chiffres : 1 graphique + interprétation + 2 indicateurs, liste complète repliée, questions neutres (plus de « réveils » jugés)
- [x] Planche « Écrans » : 4 écrans Comprendre ; vérif. moteur réel (console + débordements) ; publié en version 12 du canevas
- [ ] Validation de Victor sur les 4 écrans Comprendre
- [ ] `/impeccable audit` + polish sur Comprendre (non lancé cette session)
- [ ] Bain / rituel : absents des données d’exemple V4, donc aucune observation « après un rituel » (à ajouter si Victor veut ces saisies)

## Objectif v1 (livré)
Livrer v1 : saisie G/D en mL, totaux par tirage et par jour, moyennes, installable sur téléphone, hébergée.

## Plan v1

- [x] **1. Calculs (TDD)** — `stats.js` + `stats.test.mjs` → `node --test` : 6/6
- [x] **2. UI un seul écran** — `index.html` (saisie G/D/date, total en direct, bloc Aujourd'hui, moyennes, historique par jour avec modifier/supprimer)
- [x] **3. Persistance + sauvegarde** — `localStorage` `margherite.v1`, export CSV, sauvegarde/restauration JSON (fusion par id), garde-fou données corrompues
- [x] **4. PWA** — `manifest.webmanifest`, `sw.js` (stale-while-revalidate), icônes PNG 192/512/180 ; vérifié hors-ligne
- [x] **5. Qualité frontend** — `/impeccable audit` (17/20, détecteur à 0) puis polish appliqué
- [x] **6. Vérification mobile** — Playwright 375×812 + 320 px, clair/sombre, 37/37 checks
- [x] **7. Commit** — repo git dédié dans `Margherite/`
- [x] **8. Déploiement** — https://margherite.netlify.app (Netlify) + code sur github.com/MargeLabs/Margherite ; vérifié en ligne (10/10 : HTTPS, installable, hors-ligne)
- [ ] **9. Test sur un vrai téléphone** — ouvrir https://margherite.netlify.app, « Ajouter à l'écran d'accueil », saisir un tirage, couper le réseau, rouvrir (testé seulement sur navigateur émulé)

## v2 — Refonte « suivi bébé 0–6 mois » (2026-10-26)
Maquettes : https://claude.ai/artifact/L6RfjxDDSUJS4SsAbouARb (design system, prototype interactif, écrans, états).
- [x] **Audit** de l'existant et du module tire-lait
- [x] **Design system + maquettes** (Artifact Design), audit impeccable + polish
- [x] **v2 maquettes « pilotage »** (retour de Victor : simplicité, pas de défilement infini, vrai centre de pilotage) — 4 onglets, Pilotage en 3 vues (Maintenant / Rythme / Tendances)
- [x] **Rythme refait en horaire lisible** (heure habituelle, fourchette en mots, jauge de fiabilité, détail au tap) — densité retirée
- [x] **Page « Version retenue »** sur le canevas (design system à jour, prototype, écrans, saisie, états) ; l'exploration reste sur la page « Exploration »
- [x] **v3 « Comprendre »** dans un Artifact Design séparé (https://claude.ai/artifact/4weGi7dvU2YFfjdyyKYGMx) ; la v2 reste intacte (https://claude.ai/artifact/L6RfjxDDSUJS4SsAbouARb). 4 espaces Accueil / Pilotage / Comprendre / Journal, bain et rituel, repère sous chaque chiffre, lait au biberon / jour
- [x] **v3.1 (retours de Victor, 2026-10-26)** — même canevas v3 : Pilotage (cadran sur 5 jours, nuit réelle + réveils fréquents, « pourquoi » en 3 lignes, 2ᵉ tuile au choix), Comprendre (Ses horaires en premier, fiche données d'abord, Ses chiffres en couleur avec tendance et repère, lait en mL/j)
- [x] **v3.2 → v3.9 (2026-10-26)** — cadran tactile, Probable en beurre, Ses chiffres en liste, puis **données réelles** lues sur une capture « Rythme » de l'app actuelle (`data/rythme_extrait.csv`, 6 jours, ±15 min) : repas (écart ≈ 2 h, 2–3 repas de nuit), sommeil trop peu noté pour des moyennes, plus de lait mL/j ni de changes. Sauvegarde de la version avant données réelles : voir l'historique des versions du canevas (version 16)
- [x] **v3.10 → v3.19 (2026-10-26, suite)** :
  - Accueil : 2 cartes sieste / repas probables (heure de début, barre écoulé + fenêtre, lignes « Éveillé depuis / Dernier repas / Prochain repas »), tuiles « dernière sieste » à gauche
  - Pilotage (brief de Victor) : horloge conservée (heures toutes les 3 h, heure actuelle en pastille, touchez un moment pour le lire, « Probable » en beurre) + « La suite probable » + « Ce qu'on a remarqué sur ton bébé » (2 découvertes **calculées** dans la maquette depuis le journal embarqué `LOG`)
  - Comprendre › Ses horaires : « Journée type » + « Sa nuit » (comparaison des 7 nuits en barres, 2 tuiles-métriques, dernière nuit par défaut, timeline toujours affichée) ; À retenir : 4 cartes ; Ses chiffres : liste colorée avec repères quand ils existent
  - Données : capture « Rythme » de l'app actuelle (`data/rythme_extrait.csv`, ±15 min) ; lait mL/j et changes « non noté »
- [ ] **Validation de la v3.19 par Victor** — aucune ligne de code avant
- [ ] **Harmoniser tutoiement / vouvoiement** : Pilotage (découvertes, brief) en « tu », le reste de l'app en « vous »
- [ ] **Le brief de Victor prévoyait** : sélection des découvertes « fin de journée → coucher » (non fait : coucher trop variable dans les données) ; âge du bébé comme facteur de calcul (non branché : profil bébé = A5)
- [ ] Décider si `data/rythme_extrait.csv` (données de bébé) doit rester hors dépôt (actuellement non suivi par git)
- [ ] Vérifier la maquette sur un vrai téléphone (scroll de Pilotage et de Comprendre › Sa nuit)
- [ ] Obtenir l'export réel de l'app actuelle (quantités, couches, sommeil complet, 28 jours) pour remplacer l'extraction par pixels
- [ ] Repère « plus long sommeil » : source faible (analyses de données de sommeil), aucun repère affiché pour l'instant ; repère « éveil moyen 1 h 15–2 h » et « sommeil 12–16 h » à valider avec la pédiatre
- [ ] **Arbitrages à trancher :**
  - A1 · Synchro entre les deux parents (espace familial, minuteurs communs) : demande un serveur et des comptes (Supabase recommandé), ou v3 sans synchro
  - A2 · Stack : rester en HTML/JS vanilla (recommandé, le module tire-lait reste intact) ou passer à un framework
  - A3 · Bouton « Plus » à la place du raccourci Tire-lait (tire-lait à 2 gestes depuis la barre, 1 geste depuis la carte de l'Accueil)
  - A4 · Sources des repères marquées « à valider avec la pédiatre » : éveil (1 h 15–2 h), lait (~150 mL/kg/j), changes (≥ 6 couches mouillées/j)
  - A5 · Profil du bébé : prénom, date de naissance, pesées (le repère lait en dépend ; 6,4 kg est une valeur de démo)
  - A6 · Périmètre soins : change, bain, rituel ; température, médicaments, etc. plus tard
- [ ] Plan de développement détaillé (après validation)

## Hors périmètre v1 (YAGNI)
Comptes, sync cloud, graphiques, rappels/notifications, notes par tirage, unités oz, multi-utilisateurs, thème sombre manuel.

## Backlog
- Faire valider par un professionnel de santé les messages d’orientation du calendrier bien-être (fièvre avant 3 mois, refus de boire, idées noires → 3114, tristesse > 2 semaines, mastite, saignements) avant toute mise en ligne
- Synthèse exportable par période (1er mois, 2e mois…) à montrer au pédiatre ou à un proche : sommeil, repas, changes, habitudes et fiabilité des données (demande de Victor, 2026-10-28)
- Relier Netlify à GitHub (déploiement auto au push) : demande de ne publier qu'un sous-dossier- Indicateur « dernière sauvegarde » (le vrai risque produit = perte de données si le téléphone est changé / cache vidé)
- Surligner la ligne en cours de modification dans l'historique
- Sync multi-appareils (Supabase) si un second appareil est demandé
