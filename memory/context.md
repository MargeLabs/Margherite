# Mémoire — Margherite

> Fichier de contexte long terme. Complément au CLAUDE.md pour les infos volumineuses.
> Référencer depuis CLAUDE.md si nécessaire.

## Décisions d'architecture
- **2026-10-23 — PWA statique vanilla, sans build.** Un seul écran, une seule utilisatrice : pas de framework. Pas de Next.js/Supabase (stack par défaut de Victor écartée volontairement).
- **2026-10-23 — Stockage `localStorage` uniquement.** Pas de compte, pas de backend, données privées sur l'appareil. Contrepartie : pas de sync, risque de perte si cache vidé → export CSV/JSON prévu en v1.
- **2026-10-23 — Calculs dans `stats.js` (fonctions pures)** pour être testables avec `node --test` sans framework ni DOM.
- **2026-10-23 — Définition des moyennes :** moyenne/jour = total ÷ nombre de jours ayant ≥ 1 tirage ; moyenne/tirage = total ÷ nombre de tirages ; moyenne G et D calculées séparément.
- **2026-10-23 — Hébergement :** statique, Vercel par défaut (alternatives : Netlify, Cloudflare Pages, GitHub Pages). Victor héberge, l'utilisatrice finale n'a rien à configurer.

- **2026-10-23 — Bannière : image fournie par Victor (`banner.webp`), qui a remplacé le SVG dessiné à la main.** Elle est affichée en entier (4:3, non rognée) : la rogner coupait les cornes ou les trayons. Ordre de l'écran : bannière, aujourd'hui, saisie, **historique, puis moyennes** (demande de Victor).
- **2026-10-23 — Historique : première tentative de bannière en SVG dessiné à la main, pas en image générée.** Higgsfield (MCP) a refusé : le plan gratuit ne permet pas la génération d'images (« Requires basic plan or higher »), aucun crédit dépensé. Un SVG pèse quelques Ko, marche offline et reprend la palette. Si Victor passe à un plan payant, on peut regénérer une image (0,5 crédit en `gpt_image_2_5`, medium, 16:9) — prévoir de la ré-encoder en WebP avant de l'intégrer.

- **2026-10-23 — Hébergement : Netlify (pas Vercel).** Ni la CLI Vercel ni la CLI Netlify n'étaient installées ; le connecteur MCP Netlify de Victor était actif. Site `margherite` (id `75c3de0a-cbc0-4f52-a4d7-fce3ff60bc6c`), déploiement manuel depuis une copie des seuls fichiers publics. Choix du nom `margherite` validé par Victor. `.vercelignore` reste dans le repo mais ne sert plus.
- **2026-10-23 — Code sur GitHub : `MargeLabs/Margherite`, privé.** URL fournie par Victor ; poussé avec le compte `gh` actif (`CamargAqua`, admin de l'organisation MargeLabs). Pas de lien Netlify↔GitHub.

- **2026-10-26 — Évolution « suivi bébé 0–6 mois » : maquettes avant code.** Victor a demandé de ne rien coder avant validation. Toute la conception vit dans des canevas Artifact Design (voir Intégrations). Décisions de design retenues pour la v3 :
  - navigation à 4 espaces : Accueil, Pilotage, Comprendre, Journal ; espace familial via les pastilles M/P de l'en-tête ;
  - tire-lait : module existant inchangé, ouvert depuis une carte de l'Accueil et le bouton « Plus » (plus d'onglet dédié) ;
  - Pilotage = l'horloge 24 h (horaires écrits en HTML par-dessus le SVG), éveillé/endormi depuis, sommeil du jour, « pourquoi cette estimation » ; fenêtres en intervalle ;
  - Comprendre = « À retenir » (4 enseignements max, fiabilité incertaine / observée / récurrente, détail : observé, hypothèse, usage, observations), « Ses horaires » (heure habituelle + fourchette en mots + jauge), « Ses chiffres » (6 indicateurs dont lait au biberon / jour, repère d'âge sous chaque chiffre ou « pas de repère établi ») ;
  - saisie : Sein, Biberon, Dodo, Change, Plus (bain en 1 tap, rituel « même qu'hier » en 1 tap) ;
  - stack envisagée : rester vanilla ; graphiques en HTML/CSS sans librairie (pas de React, donc pas de Recharts).
- **2026-10-26 — Nouvelles données à prévoir (si la v3 est validée) :** événements repas / sommeil / change / bain / rituel avec auteur (M/P), profil bébé (prénom, naissance, pesées). Le format `margherite.v1` du tire-lait ne doit pas changer.

- **2026-10-26 — Données de la maquette = vraies données de Victor.** Source : capture « Rythme » de l'app de suivi actuelle (7 jours, repas biberon/tétée + sommeil + couches). Extraite par pixels dans `data/rythme_extrait.csv` (129 lignes, ±15 min, axe : haut de colonne = 00:00). Embarquée dans `Prototype.dc.html` sous `const LOG` (par jour : `sl` = blocs de sommeil, `fd` = repas, `T` = tétée). Limites : pas de quantités (donc pas de mL/j), pas de couches fiables, sommeil noté par endroits (samedi, dimanche soir, nuit dim→lun). Remplacer par l'export réel dès que Victor le fournit.
- **2026-10-26 — Les « découvertes » sont calculées, pas écrites.** Le moteur de `Prototype.dc.html` calcule depuis `LOG` : éveil avant sieste d'après-midi (35 min–1 h 15, médiane 1 h, 9 siestes), repas → sommeil dans l'heure et quart (23/36), durée des siestes, `NIGHTS` (7 nuits : repas de nuit 2–3, un toutes les 1 h 55, plus long sommeil ≈ 2 h 15), espacement des repas. Une découverte < 8 observations = « Encore fragile » ; sans données = phrase honnête ; « sieste courte → éveil suivant » non affichée (n = 3). Ne jamais présenter une association comme une cause ; jamais de conseil de retarder un repas.
- **2026-10-26 — Structure des écrans v3.19 :**
  - Accueil : cartes Sieste probable / Repas probable (heure de début + barre), Dernière sieste (gauche) / Dernier repas (droite), tire-lait, 3 derniers événements, boutons Sein / Biberon / Dodo / Change / Plus.
  - Pilotage : jours (auj. + 4) → horloge (touchable, pastille « heure actuelle ») → La suite probable (+ « Voir la suite de la journée ») → Ce qu'on a remarqué (2 cartes) → lien Comprendre. Jours passés : tuiles sommeil noté / repas + « ce jour-là ».
  - Comprendre : Ses horaires (Journée type | Sa nuit), À retenir (4 cartes, détail « données d'abord »), Ses chiffres (liste colorée, variante tuiles via prop `cstyle`).
  - Props de test du Prototype : `screen`, `lview` (horaires/retenir/chiffres), `hview` (jour/nuit), `jour` (0–4), `tiles`, `cstyle`, `sheet`, `ins`, `kpi`, `scene` (night), `etat`, `dark`.
- **2026-10-26 — Tutoiement** dans les blocs Pilotage (suite du brief de Victor), « vous » ailleurs : à harmoniser.

## Reprendre les maquettes (prochaine session)
1. Sources : copie locale `maquettes/v3/*.dc.html` (instantané du 2026-10-26, version 32 du canevas) ; la référence reste l'artefact (`Artifact` action `read`, `path: "project/Prototype.dc.html"`). Relire l'artefact avant de republier (Victor peut l'avoir modifié dans la page).
2. Rendu local : copier les `.dc.html` + `artifact-type/dc-runtime.js` (renommé `support.js`) dans un dossier de travail, `python -m http.server 8765` dedans, Playwright `browser_run_code_unsafe` avec `page.screenshot({clip:{x,y,width:390,height:844}})` ; pages de test avec plusieurs `<dc-import name="Prototype" screen="…">`.
3. Publier : `Artifact` avec `url`, `root` = dossier contenant `project/`, `file_path` = chemin long Windows (`C:\Users\Victor MICHEL\…`) du fichier modifié. Ne jamais publier `support.js` ni les `test*.dc.html`.
4. Éditer le Prototype avec des scripts Python (`Write` puis exécution) plutôt que de gros heredocs ; patchs par `splice` entre deux marqueurs, puis vérifier la console `dc-runtime`.

## Intégrations externes
- **Netlify** (MCP du compte de Victor) : site `margherite`, aucun secret dans le repo. La commande de déploiement contient un jeton à usage unique : ne jamais la commiter.
- **GitHub** : dépôt privé `MargeLabs/Margherite`.
- **Higgsfield** (MCP) : plan gratuit, génération d'image refusée ; non utilisé.
- **Artifact Design (claude.ai)** — maquettes, privées :
  - v2 « pilotage » (référence figée) : https://claude.ai/artifact/L6RfjxDDSUJS4SsAbouARb
  - v3 « Comprendre » (en cours de validation) : https://claude.ai/artifact/4weGi7dvU2YFfjdyyKYGMx — planches : Synthèse (`Main`), `Prototype` (cliquable, tout l'état de l'app dans un seul fichier), `Reference` (copie de la v2), `Parcours`, `Saisie`, `Etats`, `AvantApres`.
  - Les sources ne sont **que** dans les artefacts (le scratchpad de session disparaît) : les récupérer avec l'outil `Artifact`, action `read`, `path: "project/<fichier>"`.
  - Vérifier avant toute publication avec le vrai moteur : copier `artifact-type/dc-runtime.js` (lu dans l'artefact) en `support.js` à côté des `.dc.html`, servir le dossier en `http://localhost` et regarder chaque écran à 390×844 (mesurer `main.fixed` : `scrollHeight - clientHeight` doit valoir 0, sans zoom CSS).

## Historique des sessions
- **2026-10-23** — Création du projet via `/new-project`. Structure + plan v1 écrits dans `tasks/todo.md`.
- **2026-10-23** — Plan validé, v1 construite : `stats.js` (TDD), `index.html`, PWA, icônes. Vérifiée en E2E mobile (375 px et 320 px, clair/sombre, hors-ligne, export/import). Audit impeccable 17/20 → polish (données corrompues sauvegardées, stats masquées au premier lancement, placeholder contrasté, scroll respectant `prefers-reduced-motion`). Commit initial dans un repo git dédié. Déploiement laissé à Victor.
- **2026-10-23 (suite)** — Bannière remplacée par la photo de Victor (`banner.webp`), historique placé avant les moyennes, `noindex` ajouté. Déployée sur https://margherite.netlify.app et poussée sur GitHub à la demande de Victor ; 10/10 checks en ligne. Reste : test sur un vrai téléphone.
- **2026-10-26** — Phase maquettes de l'évolution « suivi bébé » (aucun code). v1 du design system et prototype mobile, puis v2 « pilotage » (4 onglets, cadran 24 h, Rythme lisible, page « Version retenue »), puis v3 « Comprendre » dans un canevas séparé. Défauts trouvés en rendu réel et corrigés : horaires SVG invisibles, styles Tendances effacés, débordements. Reste : validation de Victor et arbitrages A1–A6 (`tasks/todo.md`).
- **2026-10-26 (suite, longue session)** — v3.1 → v3.19 dans le même canevas, retours de Victor itératifs : cadran (nuit réelle, 5 jours, tactile, heures, pastille), Probable en beurre, Ses chiffres en liste, **données réelles** extraites d'une capture (`data/`), retour du sommeil après une maquette « toute repas », Accueil en 2 colonnes, Pilotage refondu (suite probable + découvertes calculées), Sa nuit (comparaison + timeline). Reste : validation de Victor, export réel, arbitrages A1–A6, plan de développement.
