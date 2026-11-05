# INTELLIGENCE.md — Référence centrale de l'intelligence Margherite

> **Document de référence du chantier d'intelligence.** Rédigé le 2026-10-28, section 10 ajoutée le 2026-10-31, **entièrement actualisé le 2026-11-02 après relecture du code**.
> Plan d'action détaillé, chantier par chantier : [`tasks/plan-intelligence.md`](tasks/plan-intelligence.md).
> L'application s'appelle désormais **Canaille** pour les familles (renommée le 2026-11-01) ; « Margherite » reste le nom du projet, du dépôt et de ce moteur.

**Règle du chantier : aucune modification de l'UI/UX.** Pas de nouvel écran, pas de chatbot, pas de changement visuel. Le moteur produit des résultats structurés ; leur présentation sera décidée plus tard.

Chaque élément porte un statut, vérifié dans le code du commit `d9d57fb` (celui que renvoie `https://canaille.vercel.app/version` le 2026-11-02, donc code local = code en ligne) :

- **[Prod]** : dans le code et exécuté en production.
- **[Code]** : dans le code, mais masqué ou non exécuté en production.
- **[Partiel]** : développé en partie, ou fonctionne avec une limite connue.
- **[Doc]** : uniquement documenté, aucun code.
- **[À faire]** : travail à réaliser.
- **[Données]** : impossible à conclure sans davantage de données.
- **[Validation]** : exige une validation scientifique, professionnelle ou juridique.
- **[Hypothèse]** : supposition raisonnable, à confirmer par un test, une mesure ou une décision.

Un élément peut porter plusieurs statuts (ex. **[Doc] [Validation]**).

---

## 1. Vision

Construire une intelligence **hybride et propriétaire**, qui apprend progressivement les habitudes de **chaque bébé** (sommeil, siestes, repas, biberons) pour :

1. **Décrire** : sa journée type, sa nuit type, ce qui évolue.
2. **Anticiper** : prochaine sieste et prochain repas probables, sous forme de **fenêtre** et jamais d'heure exacte ni de compte à rebours.
3. **Expliquer** : chaque estimation s'accompagne de ses faits (« d'après ses 6 dernières journées… ») et d'un niveau de fiabilité.
4. **Comprendre** (ajout du 2026-11-02) : détecter les évolutions, distinguer une habitude stable, une tendance récente, une variation ponctuelle et une rupture, identifier des associations entre événements, s'appuyer sur une base scientifique documentée, s'améliorer avec des données longitudinales consenties.

« Hybride » veut dire qu'un **moteur de règles déterministe et explicable** reste la base. Les modèles statistiques s'y ajoutent, et les modèles pré-entraînés ne servent qu'en complément, chacun seulement là où il bat les méthodes simples sur des mesures objectives.

**Ce que « backend » veut dire ici.** Une couche de calcul séparée de l'interface : fonctions pures en TypeScript dans `web/src/engine/`, sans écran, sans LLM, sans chatbot. Elle tourne **dans le navigateur** (comme les calculs actuels) et en Node pour les tests et les backtests. Aucun serveur de calcul n'est prévu : la confidentialité et la simplicité y gagnent, et rien ne le justifie à ce jour.

Principes produit à respecter **[Prod]**, validés par Victor et appliqués dans l'app :

- **Rassurer sans surinterpréter** : une association n'est pas une cause, jamais d'enseignement inventé, jamais de conseil de retarder un repas.
- **Estimations en fourchette**, avec la fiabilité affichée (points de fiabilité, « Encore fragile », « Nous apprenons encore à connaître son rythme »).
- **Une donnée manquante n'est jamais un zéro**, et une absence de note n'est pas une absence de sommeil.
- **Margherite ne pose pas de diagnostic médical.**
- **Rien de complexe sans gain mesuré** (2026-11-02) : une méthode n'entre que si elle bat la précédente sur le protocole de la section 7.

---

## 2. Ce qui existe réellement (audit du code, 2026-11-02)

### 2.1 Socle

| Élément | Statut | Où |
|---|---|---|
| App tire-lait v1 : PWA, `localStorage`, hébergée sur Netlify | [Prod] | `index.html`, `sw.js`, `stats.js` |
| App réelle Canaille : Next.js 14, Supabase, Vercel, temps réel entre deux téléphones | [Prod] | `web/` |
| Base : `baby`, `events`, `pumps`, `kv` | [Prod] | `web/supabase/migrations/0001_init.sql` |
| Date et heure de naissance, prénom, photo | [Prod] | `baby.birth_at`, `web/src/data/household.tsx` |
| Export complet JSON (tout l'historique, `created_at` et `updated_at` compris) | [Prod] | `exportAll`, `exportData.ts` : c'est la source naturelle des backtests |
| 77 tests verts (`npm test`, relancés le 2026-11-02), dont 49 de calcul sur des journaux à réponse connue | [Prod] | `web/src/legacy/calc.test.ts` |
| Module `web/src/engine/` (types, registre de seuils, qualité, références, backtest, journaux synthétiques) | [Code] local, branche `chore/secure-repo`, non branché | phase B, bilan en 7.6 |
| Migration `0002_event_audit.sql` (origine de la saisie, journal des corrections 90 jours) | Exécutée (colonne `source` présente dans l'export) ; révisions illisibles par le compte famille (RLS sans règle), purge à 90 jours, arrêts de chrono non tracés | `web/supabase/migrations/` |
| Migration `0004_journal.sql` (journal complet en ajout seul : création, arrêt, correction, suppression, import ; avant/après, heure serveur, téléphone) | [Code] testée sur PGlite (20 tests), **non exécutée** ; reprend 0002 et pose un point de départ par ligne | `web/supabase/migrations/`, `web/src/data/journal.sql.test.ts` |

### 2.2 Moteur de règles

Tout le calcul vit dans une seule fonction, `renderVals()` de `web/src/legacy/app.logic.generated.js` (≈ 1 950 lignes). Ce fichier est **généré** à partir de la maquette V5 et des correctifs de `web/scripts/patches.mjs`. Calcul, phrases et affichage y sont mêlés, et tout est recalculé à chaque rendu.

| Capacité | Statut | Fonctionnement réel | Limite relevée |
|---|---|---|---|
| Fusion des siestes proches | [Prod] | ≤ 30 min d'écart, de jour seulement (`NAP_GAP`, `SL`) | jour fixé à 7 h – 19 h 30 |
| Découpage des nuits | [Prod] | `nightOf` : chaîne de blocs (éveils ≤ 50 min), ≥ 90 min au total, 1er bloc ≥ 60 min, fenêtre adaptée (coucher − 2 h → réveil + 30 min, médianes des 7 nuits d'avant, 3 nuits minimum) | une nuit finie avant 5 h 30 est toujours « partielle », même si le bébé se lève vraiment à 5 h 20 ; un éveil > 50 min coupe la nuit ; seuils sans âge |
| Journée complète ou non | [Prod] | `dayOf` : réveil, coucher, aucun trou > 5 h après 6 h | l'absence de saisie est bien traitée, mais le seuil n'est pas évalué |
| Journée type | [Prod] | `typ` : médianes sur les jours complets des 7 derniers jours, 3 minimum ; un rang de sieste exige 2 jours | jours non pondérés ; siestes alignées par **rang**, une sieste en plus décale toutes les suivantes |
| Nuit habituelle | [Prod] | `usual`, `nty` : 7 nuits d'avant, 4 nuits « ok » minimum | |
| Fiabilité par étape | [Prod] | `lvOf` : présence ≥ 80 % / 50 %, heure stable à ≤ 20 min, plafond sous 5 jours | heuristique jamais confrontée à la réalité : **ce n'est pas une probabilité** |
| Prévision du prochain dodo | [Prod] | `wins`, `nx`, popup après biberon : la fourchette de début habituelle de la sieste de même rang, ± 15 min au minimum, plus le coucher | voir 2.3 |
| Comparaison d'un dodo à ses habitudes | [Prod] | `habitOf` | dépend de l'alignement par rang |
| Prévision du prochain repas | **Absente** | existait dans les maquettes V3, **n'existe plus dans le code** | seuls existent les repas qui reviennent (`typ.meals`) et l'écart médian |
| Habitude d'éveil de la semaine | [Prod] | feuille « Son temps d'éveil », 3 schémas (tout de suite, au milieu, avant le dodo) | |
| Observations « À retenir » | [Prod] | repas → sieste, sieste → repas, nuit dernière, tendance ; statuts Constaté / habitude / fragile | seuils non évalués |
| Liens journée → nuit | [Prod] | `lkEval` : ≥ 5 nuits par groupe, écart net, même sens 7 fois sur 10 | voir 2.3 |
| Comparaisons de périodes | [Prod] | `stat` (`MET`) | seuils `eq` fixés à la main |
| « Cycle » de nuit | [Prod] | sommeil noté / nombre de périodes | **mesure des périodes, pas un cycle biologique** |
| Repères d'âge | [Code] masqué | `AGE_REFS = false` : trois exemples sans source | ne pas réactiver sans la base de la section 10 |
| Base de connaissances, `getReference` | [Doc] | section 10 | |
| Modèle S + C, bayésien, Kalman, ruptures, séquences | [Doc] | | aucune ligne de code |

### 2.3 Écarts importants révélés par l'audit

1. **L'âge n'entre dans aucun calcul.** `birth_at` est disponible et affiché, mais aucun seuil, aucune prévision et aucune habitude n'en dépend.
2. **La prévision de dodo ne regarde pas l'heure.** Elle rend la plage habituelle du jour : elle ignore l'heure du dernier réveil, le temps d'éveil, le sommeil cumulé et l'âge. Après une sieste tardive, la fenêtre suivante ne bouge pas. C'est la cible d'amélioration la plus nette.
3. **La couverture des fenêtres est inconnue.** Personne n'a jamais mesuré combien de fois le dodo tombe dedans.
4. **Une fenêtre glissante étroite.** L'app ne charge que 30 jours (`WINDOW_DAYS`), l'analyse porte sur 28 au plus. Un apprentissage longitudinal exige tout l'historique.
5. **Des tests multiples sans correction.** `lkEval` essaie plusieurs facteurs et plusieurs issues et garde le meilleur. Pour un groupe de 5 nuits, le critère « même sens 7 fois sur 10 » revient à 4 sur 5, soit 19 % de chances par pur hasard (loi binomiale, p = 0,5), avant le filtre d'écart minimal. **Un faux lien peut s'afficher.** La mention « observé, pas une explication » réduit le risque sans le supprimer.
6. **Des seuils dispersés et parfois contradictoires.** 240 lignes contiennent des comparaisons chiffrées. La sieste commence à 7 h et finit à 19 h 30 dans `isNapAt`, mais les observations utilisent 7 h – 18 h 30, et le Résumé 7 h – 21 h. Inventaire en 7.5.
7. **Aucune trace des corrections.** Une modification écrase, une suppression est définitive (`deleteEvent`). L'origine de la saisie (chrono ou après coup) n'est pas stockée. `created_at` existe en base et permet une estimation partielle du délai de saisie.
8. **Une base mono-foyer.** `baby.id = 1`, un seul utilisateur par projet Supabase, et une règle RLS qui ouvre tout à tout utilisateur connecté. **Plusieurs familles = migration de schéma et de sécurité.** C'est le préalable de tout apprentissage entre bébés.
9. **Peu de données réelles.** Environ 3 jours en base au 2026-11-02 (2 journées complètes), plus 6 jours d'extraction par pixels (± 15 min). Un seul bébé.
10. **Phrases et calculs mêlés.** La logique produit des phrases toutes faites, au masculin (« il »). Le profil ne contient pas de genre : le moteur doit rendre des faits et des codes, pas du texte.
11. **Heure d'été.** Le repère en heure murale, accepté, décale d'une heure un dodo qui enjambe le changement. Inoffensif pour l'affichage, à traiter pour l'apprentissage.
12. **Confidentialité : le dépôt GitHub est public** (vérifié le 2026-11-02, contrairement à ce qu'indiquait `CLAUDE.md`). Y figurent des **tirages réels** (`web/src/data/__fixtures__/margherite-2026-10-31.csv`), un journal réel de 6 jours (`maquettes/v3`), le détail du projet et les prénoms des parents. `data/` n'est couvert par aucun `.gitignore`. Inventaire et procédure : plan, section 0 et phase A.
13. **Aucun fichier d'audit dans le dépôt.** L'audit cité dans le cahier des charges du 2026-11-02 n'y figure pas ; ses quatre constats (règles en production, Supabase, date de naissance, 77 tests) ont été revérifiés et sont exacts.

### 2.4 Données disponibles pour le moteur

| Donnée | Statut | Remarque |
|---|---|---|
| Début et fin de chaque sommeil | [Prod] | `events` kind `sleep` ; `ended_at` null = chrono en cours |
| Biberon : heure, mL, lait maternel ou infantile | [Prod] | `lait` facultatif : souvent vide, jamais supposé |
| Tétée : heure, côté, durée facultative | [Prod] | **jamais de volume** |
| Changes, type | [Prod] | kind `chg`, champ `v` |
| Tirages G / D | [Prod] | table `pumps`, non reliée aux biberons |
| Humeur, digestion, selles, santé du bébé | [Prod] | `kv.well`, par jour, peu structuré |
| Notes et suivis personnels | [Prod] | `kv.notes`, `kv.trk`, `kv.trl` : texte libre ou définitions propres à chaque famille |
| Notes de la maman | [Prod] sur l'appareil | **jamais envoyées, le moteur n'y touche pas** |
| Mode d'alimentation, poids, prématurité, âge corrigé | Absents | |
| Bain, rituels | Absents | « Pas encore noté » |

---

## 3. Modèles Hugging Face à étudier

> **Statut 2026-11-02 : [Doc] [Données].** Aucun essai n'a eu lieu. Chronos-2 et TimesFM restent **optionnels et tardifs** : ils exigent Python côté expérimentation, et une série de quelques semaines d'un seul bébé ne permet pas de démontrer un gain. Ils ne seront évalués qu'hors de l'app, après la phase de mesure, et n'y entreront que sur preuve (phase H1 du plan). Décision de Victor : anticipés, pas développés prématurément. La mention ci-dessous de l'« architecture actuelle (PWA, `localStorage`, aucun backend) » date d'avant Supabase : la conclusion reste vraie, car le calcul reste local et sans Python.

**Point de vigilance général [Hypothèse]** : ces modèles prévoient des **séries temporelles régulières** (une valeur par pas de temps). Les données de Margherite sont des **événements irréguliers** (un biberon à 9:40, une sieste de 10:55 à 12:30). Leur usage suppose une transformation, par exemple :

- état « dort / éveillé » par tranche de 15 min ;
- une valeur par jour (sommeil sur 24 h, nombre de repas) ;
- une série d'intervalles (écart entre deux repas, durée d'éveil avant chaque sieste).

Rien ne garantit qu'ils feront mieux qu'une médiane glissante sur ces séries courtes et bruitées. **Leurs performances devront être mesurées** (étape 4).

### 3.1 Amazon Chronos-2 — candidat prioritaire

- **Source** : https://huggingface.co/amazon/chronos-2 · code : https://github.com/amazon-science/chronos-forecasting · rapport technique : arXiv 2510.15821.
- **Licence déclarée** : Apache-2.0 (métadonnées Hugging Face, lues le 2026-10-28).
- **Caractéristiques (fiche du modèle)** :
  - encodeur d'environ 120 M de paramètres (≈ 480 Mo en F32) ;
  - prévisions par quantiles (fourchettes natives, ce qui colle au principe « estimations en fourchette ») ;
  - univarié, multivarié et **covariables** (passées et futures connues) ;
  - contexte maximal 8 192 pas, horizon maximal 1 024 ;
  - inférence possible sur CPU ou GPU ;
  - paquet Python `chronos-forecasting` (PyTorch).
- **Intérêt pour Margherite [Hypothèse]** : les covariables permettent de donner l'âge, le jour de la semaine ou le type de journée ; l'apprentissage croisé entre séries apparentées sert aussi.
- **Contraintes techniques** :
  - Python / PyTorch côté serveur, donc **incompatible avec l'architecture actuelle** (PWA hors ligne, `localStorage`, aucun backend) ;
  - inférence dans le navigateur non prévue (taille, environnement) ; un portage ONNX ou une version quantifiée serait à évaluer ;
  - coût d'hébergement d'une inférence CPU à estimer.

### 3.2 Google TimesFM 2.5 — alternative à comparer

- **Source** : https://huggingface.co/google/timesfm-2.5-200m-pytorch · code : https://github.com/google-research/timesfm · article : arXiv 2310.10688 (ICML 2024).
- **Licence déclarée** : Apache-2.0 (métadonnées Hugging Face, lues le 2026-10-28).
- **Caractéristiques (fiche du modèle)** :
  - modèle décodeur d'environ 231 M de paramètres (≈ 925 Mo en F32) ;
  - prévision ponctuelle et quantiles (10e à 90e centile) ;
  - contexte et horizon configurables (l'exemple de la fiche utilise un contexte de 1 024 et un horizon de 256) ;
  - **« pas un produit Google officiellement pris en charge »** (mention de la fiche) ;
  - installation depuis le dépôt GitHub (paquet PyPI annoncé « bientôt » sur la fiche).
- **À vérifier [Hypothèse]** : prise en charge des covariables pour la version 2.5 et contexte maximal réel (non précisés sur la fiche).
- **Contraintes techniques** : les mêmes que Chronos-2, avec un modèle deux fois plus lourd.

### 3.3 Licences et usage commercial : vérifications avant toute utilisation [À faire]

Apache-2.0 autorise en principe l'usage commercial, la modification et la redistribution. **Avant d'intégrer quoi que ce soit, il faut vérifier :**

1. la licence **du code** (dépôts GitHub) en plus de celle des poids, et la présence d'un fichier `NOTICE` à reproduire ;
2. les licences **des données d'entraînement** (GiftEvalPretrain, Chronos Datasets, Wikimedia Pageviews, Google Trends, données synthétiques), et si elles imposent une contrainte sur l'usage des poids ;
3. les licences de toutes les dépendances (PyTorch, `chronos-forecasting`, `timesfm`, etc.) ;
4. l'interdiction d'utiliser les marques (Amazon, Google) pour présenter Margherite ;
5. les conditions de l'hébergeur ou du service d'inférence retenu, si on en utilise un ;
6. faire relire la conclusion par un juriste avant toute mise en production commerciale.

---

## 4. Architecture cible [À faire]

Module TypeScript `web/src/engine/`, sans dépendance nouvelle, découpé **seulement quand un fichier le justifie** :

```
Événements bruts (Supabase, export JSON ou journal synthétique)
        │
   quality/        normalisation, complétude, âge, anomalies, heure d'été
        │
   ┌────┴──────┬───────────┬───────────┐
 sleep/     feeding/    rhythm/     knowledge/   (lecture seule, données séparées)
   └────┬──────┴───────────┘           │
   habits/  patterns/  personalization/  predictions/
        │                              │
   résultats structurés et versionnés (contrat, section 11) ◄┘
        │
 interface (plus tard, hors chantier)   evaluation/ : rejoue tout sur le passé
```

| Brique | Rôle | Statut |
|---|---|---|
| **Base de données** | Supabase, conservée. Évolutions de schéma limitées et additives : traçabilité des corrections, origine de la saisie. | [Prod] pour l'existant, [À faire] pour les ajouts |
| **Serveur de calcul** | Aucun. Seulement si un modèle retenu l'exigeait, ce qui n'est pas attendu. | Non prévu |
| **Moteur de règles fiables** | Découpage, journée type, nuit habituelle, fenêtres, habitudes, liens. À extraire en fonctions pures testées. | [Prod] dans `renderVals`, [À faire] en module |
| **Profil individuel** | **Recalculé à partir des événements**, pas stocké : rejouable, testable, sans état à migrer. Un cache n'arrive que si la mesure le demande. | [À faire] |
| **Base de connaissances** | Repères par âge, sourcés et versionnés, en lecture seule ; contextualise sans jamais fixer d'objectif. Section 10. | [Doc] |
| **Modèle de rythme** | Version réduite du modèle à deux processus, ajustée par bébé. Section 6.2. | [Doc] |
| **Modèles pré-entraînés** | Chronos-2 ou TimesFM 2.5, seulement s'ils battent les règles pour ce type de prévision. | [Doc] [Données] |
| **Arbitre** | Choisit la méthode, décide de **s'abstenir**. | [À faire] |
| **Explications** | Faits et codes produits par le moteur ; gabarits validés par le contrôle de vocabulaire. Jamais le texte libre d'un modèle. Sans genre supposé. | Phrases [Prod] dans `renderVals`, [À faire] en module |

Choix tranchés le 2026-11-02 (arbitrages A1 et A5 de `tasks/todo.md` réglés de fait par l'app réelle) :

- **Calcul sur l'appareil**, en TypeScript, sans dépendance Python ni serveur.
- **Explications** : toujours issues des règles et des statistiques. Un modèle de prévision n'en produit pas.
- **Migration sans rupture** : l'ancien calcul reste en place tant que le nouveau n'a pas prouvé qu'il donne les mêmes résultats ou mieux (méthode du « double calcul », plan phases B1 et C1). Basculer un calcul ne doit rien changer à l'écran, ce que vérifient la fidélité et les tests de non-régression.
- **Local sans enfermement** (arbitrage de Victor) : moteur pur, déterministe et sérialisable, qui rend le même résultat sur les deux téléphones ou sur un serveur, avec `babyId` dans chaque entrée. Plusieurs milliers de familles, calculs serveur et apprentissage collectif restent possibles sans réécriture ; **aucune infrastructure n'est construite pour eux maintenant**.
- **Limite assumée** : calculé sur l'appareil, l'algorithme est livré dans le code du site. Les données restent privées, pas l'algorithme : à reconsidérer avant toute ouverture (plan, O4).

---

## 5. Données nécessaires

L'existant est en 2.4. Il manque :

| Donnée | Statut | Remarque |
|---|---|---|
| **Historique complet accessible au moteur** | [À faire] | fenêtre de 30 jours aujourd'hui, 15 événements par jour pendant 6 mois ≈ 2 700 lignes : rejouable |
| **Corrections** (événement modifié ou supprimé, date) | [À faire] | savoir ce qui a été corrigé, pour ne pas apprendre sur une erreur ; suppression logique ou journal séparé |
| **Origine de la saisie** (chrono, en direct, après coup) | [À faire] | pondère la précision des heures ; d'ici là, estimée par `created_at − started_at` |
| **Marqueurs de complétude** | [Prod] recalculés (`complete`, `partiel`, `absent`) | à exposer explicitement ; un manque n'est jamais un zéro |
| Mode d'alimentation | [À faire] | **déduit des repas notés** par défaut (proposition) : pas de saisie, donc pas d'UI |
| Prématurité, âge corrigé | [Hypothèse] | exigerait une saisie, donc une UI : hors de ce chantier, le moteur prévoit le paramètre et l'âge civil s'applique par défaut, en le disant |
| Poids | Absent | nécessaire à tout repère de volume sérieux (section 10.7) |
| Fuseau de saisie | [À faire] | `timestamptz` existe ; le fuseau d'origine n'est pas gardé |
| Consentement à l'apprentissage | [À faire] | section 8 ; exigerait une UI, donc plus tard |
| **Davantage de jours et de bébés** | [Données] | voir 7.4 |

Format d'événement cible **[Hypothèse]** : `{ id, babyId, kind, start, end?, ml?, milk?, side?, durationMin?, source, createdAt, updatedAt, deletedAt? }`.

---

## 6. Moteurs à construire

Détail de réalisation, tests, dépendances et critères : [`tasks/plan-intelligence.md`](tasks/plan-intelligence.md).

### 6.1 Principe de progression

Chaque moteur suit le même chemin : **définir** l'indicateur, **mesurer** la méthode actuelle, **proposer** mieux, **comparer** sur le passé, **activer** seulement si le gain est prouvé. Toute étape peut conclure « on garde le plus simple » : c'est un résultat valable.

Quatre niveaux d'affirmation, jamais confondus : **observation** (fait noté), **hypothèse** (association, tendance), **prévision** (fenêtre avec probabilité), **référence** (source externe). Le moteur **n'émet aucune recommandation**. Une recommandation médicale officielle peut figurer dans la base, étiquetée comme telle, et reste distincte de toute statistique.

### 6.2 Rythme et sommeil : modèle à deux processus [Doc] [Validation]

**Ce qui a été vérifié le 2026-11-02 (résumés lus, textes intégraux non lus) :**

- Le modèle à deux processus décrit l'interaction d'un processus homéostatique S et d'un processus circadien C (Borbély et al., *J Sleep Res*, 2022, doi:10.1111/jsr.13598).
- Chez le nourrisson, les évolutions observées s'accordent avec **une pression qui monte et se dissipe plus vite, et un rythme circadien plus faible en début de vie** (Webb, Phillips, Roberts, *PLoS Comput Biol*, 2024, doi:10.1371/journal.pcbi.1012541). Transposer des paramètres adultes serait donc faux.
- Une prépublication de 2026 infère des paramètres de population pour la petite enfance (doi:10.64898/2026.02.12.705640) : à lire en entier, non évaluée par les pairs à notre connaissance. Elle relève d'un modèle physiologique plus lourd, pas d'une valeur à recopier.

**Décision proposée.** Ne pas embarquer un modèle physiologique. Construire un **modèle réduit, ajusté sur chaque bébé** : un modèle de survie à temps discret, qui estime pour chaque pas de 5 ou 15 minutes la probabilité que le sommeil commence, selon le temps éveillé (équivalent de S) et l'heure de la journée (équivalent de C, en harmoniques), plus sommeil cumulé sur 24 h, durée de la dernière sieste et âge en jours. Il est léger, codable sans dépendance, explicable, et rend directement une fenêtre. Ses paramètres sont **appris sur le bébé** et jamais importés d'adultes. **Le nom « S + C » désigne une structure d'inspiration, pas une mesure physiologique** : aucune sortie ne sera présentée comme une pression de sommeil mesurée.

### 6.3 Apprentissage individuel [Doc] [Données]

**Arbitrage de Victor :** pas de hiérarchique complet ni de modèle lourd au départ, mais pas non plus une simple amélioration des moyennes : modèles probabilistes, survie, Kalman et états latents, changements de régime, séquences et bayésien adapté sont étudiés et comparés à des références simples (plan, section 5). L'âge devient une variable importante, jamais une norme rigide : connaissances de la tranche d'âge (une fois validées) et observations du bébé sont combinées, ces dernières pesant de plus en plus. **Limite :** sur un seul bébé, l'âge et le temps qui passe sont la même variable.

**Limite centrale :** un modèle bayésien hiérarchique apprend d'une population de bébés. Nous en avons un. Le plan procède donc en trois temps :

1. **Tout de suite, un bébé** : estimateurs pondérés dans le temps (récent > ancien), médianes robustes, filtre de Kalman local sur les grandeurs lentes (coucher, durée d'éveil médiane, sommeil sur 24 h), rétrécissement vers ses propres moyennes longues.
2. **Avec une littérature suffisante** : a priori faibles, sourcés, sur les grandeurs que la base de connaissances documente. Sinon a priori non informatif.
3. **Avec plusieurs familles consentantes** : vrai modèle hiérarchique. **[Données] [Validation]**, dépend de la migration multi-foyers et du cadre de la section 8.

Le moteur classe chaque grandeur en : **habitude stable, tendance récente, variation ponctuelle, rupture, données insuffisantes**. Ruptures : détection bayésienne en ligne (Adams & MacKay 2007, arXiv:0710.3742), robuste aux valeurs isolées (arXiv:2112.12899). Une rupture exige plusieurs jours concordants : quelques observations ne deviennent jamais une règle.

### 6.4 Analyse transversale [Doc]

Relations à étudier : éveil → sieste suivante, dernière sieste → coucher, évolution des réveils, répartition des prises, séquences récurrentes, types de journées, évolution sur plusieurs semaines, et lien avec lait maternel ou infantile, biberons, tirages, couches, selles et observations des parents.

Méthodes, de la plus simple à la plus riche : corrélations de rang (Spearman) ; **test de permutation par blocs** (les observations d'un même bébé se répètent et se ressemblent) et contrôle du taux de fausses découvertes (Benjamini-Hochberg), en remplacement du seuil actuel de `lkEval` ; facteurs confondants traités par retrait de la tendance et de l'âge, et par stratification ; taille d'échantillon fixée par puissance ; analyse de décalage temporel ; extraction de séquences fréquentes (type PrefixSpan) ; modèles mixtes **seulement avec plusieurs bébés**.

Règles absolues : corrélation ≠ causalité ; une absence de saisie n'est pas une absence d'événement ; une tétée n'est pas un volume ; aucune recommandation de limiter ou de retarder une prise alimentaire ; les jours sans mesure sortent de l'analyse.

### 6.5 Prévisions probabilistes [Partiel] pour le dodo, [À faire] pour le repas

Les prévisions et habitudes actuelles sont **conservées** : d'abord extraites à l'identique, puis servant de référence à battre. Cibles : début de la prochaine sieste, coucher, durée du sommeil en cours, prochain repas (nouveau).

Méthodes à comparer : médiane glissante par rang, temps d'éveil médian, modèle de survie de 6.2, combinaison simple. Les intervalles sont ajustés par **calibration conforme** sur le passé du bébé : on élargit jusqu'à couvrir réellement le taux annoncé, sans hypothèse de loi. Fenêtres uniquement, jamais d'heure artificiellement précise.

Pour le repas : la prévision reste une **description** (« il a souvent mangé autour de… »), pas une consigne. La faim du bébé prime ; rien ne doit pouvoir se lire comme une heure de repas à respecter.

### 6.6 Habitudes [Partiel]

Toutes les habitudes de 2.2 sont conservées. S'y ajoutent : remplacement de l'alignement par rang par un regroupement sur l'heure et l'éveil, variabilité et stabilité, cycle de nuit renommé **période de sommeil** dans le contrat, adaptation des seuils à l'âge. Chaque indicateur a une fiche au dictionnaire : définition, méthode, minimum de données, évaluation, fiabilité, abstention. Dictionnaire de départ : plan, annexe A.

### 6.7 Modes d'alimentation [À faire]

Le mode (sein exclusif, biberon exclusif, mixte) est **déduit** par fenêtre glissante, avec « indéterminé » possible, et peut changer. Il décide ce qui a un sens : aucun total de lait sur 24 h dès qu'une tétée existe, durée de tétée jamais convertie en mL, lait maternel ou infantile seulement quand il est renseigné.

**L'ancienne numérotation (étapes 1 à 6) ci-dessous est conservée pour mémoire : ses objectifs sont repris par le plan.**

### Étape 1 — Définir les données et les indicateurs fiables [À faire]

- **Objectif** : figer le modèle de données et la liste des indicateurs que Margherite affichera, chacun avec sa définition, sa condition minimale et son seuil de fiabilité.
- **Livrables** :
  - schéma de données (événements, profil, corrections, marqueurs de complétude) ;
  - dictionnaire des indicateurs (journée type, nuit habituelle, éveil avant sieste, écart entre repas, plus long sommeil, cycle de nuit…), avec leur formule et le nombre minimal de jours ou de nuits ;
  - règles de complétude (qu'est-ce qu'une journée ou une nuit notée en entier).
- **Critères de validation** :
  - chaque indicateur affiché dans les maquettes V4 a une définition écrite et non ambiguë ;
  - chaque indicateur a une règle d'abstention ;
  - Victor valide le dictionnaire.

### Étape 2 — Construire le moteur de calcul et de détection des habitudes [À faire]

- **Objectif** : sortir la logique des maquettes vers un module de fonctions pures, testé, sans dépendance (dans le même esprit que `stats.js`).
- **Livrables** :
  - module de calcul (découpage, journée type, nuit habituelle, fenêtres probables, fiabilité, liens journée → nuit) ;
  - tests unitaires (`node --test`) écrits en TDD, y compris sur des cas incomplets ;
  - un jeu de données de test anonymisé ou synthétique, versionné.
- **Critères de validation** :
  - les sorties sur les données d'exemple sont identiques à celles des maquettes V4 ;
  - tous les tests passent ;
  - aucun indicateur n'est calculé quand sa condition minimale n'est pas remplie.

### Étape 3 — Protocole de test et référence de comparaison [À faire]

- **Objectif** : savoir mesurer objectivement si une méthode prédit mieux qu'une autre, **avant** d'essayer un modèle.
- **Livrables** :
  - tâches de prévision précises : début de la prochaine sieste, heure du prochain repas, durée du prochain sommeil de nuit, sommeil sur 24 h ;
  - références simples (*baselines*) : même heure que la médiane des 7 derniers jours, dernier intervalle observé, moyenne glissante, moteur de règles de l'étape 2 ;
  - évaluation chronologique par bébé (*backtest* glissant : on ne prédit qu'avec le passé) ;
  - jeux de test : données réelles consenties (au départ, celles de Victor) + données synthétiques avec trous de saisie injectés.
- **Critères de validation** :
  - le protocole est écrit et reproductible ;
  - les références ont des scores chiffrés ;
  - Victor valide les métriques (section 7).

### Étape 4 — Expérimenter Chronos-2 et TimesFM 2.5 [À faire]

- **Objectif** : mesurer, hors produit, si ces modèles apportent un gain réel sur les tâches de l'étape 3.
- **Livrables** :
  - environnement d'expérimentation isolé (hors du dépôt de l'app, ou dans un dossier `experiments/` séparé, à décider) ;
  - transformation des événements en séries régulières (section 3) ;
  - rapport comparatif : modèles en zéro-shot, avec et sans covariables (âge, jour de la semaine), face aux références ;
  - mesure du temps d'inférence et de la mémoire, sur CPU ;
  - conclusion sur les licences (section 3.3).
- **Critères de validation** :
  - un modèle n'est retenu que s'il bat **la meilleure référence simple** de façon nette et stable (seuil à fixer à l'étape 3, par exemple au moins 10 % d'erreur en moins) ;
  - sa fourchette doit être **bien calibrée** (une fourchette annoncée à 80 % contient la réalité environ 8 fois sur 10) ;
  - le coût d'hébergement doit être acceptable ;
  - sinon, on garde le moteur de règles seul. **C'est un résultat valable.**

### Étape 5 — Adapter ou spécialiser le modèle retenu, si les résultats le justifient [À faire]

- **Objectif** : améliorer le modèle retenu sur les rythmes 0–6 mois (ajustement fin, adaptateur léger, ou simple calibration des fourchettes).
- **Livrables** :
  - protocole d'adaptation ;
  - données d'entraînement **consenties** (section 8) ;
  - comparaison avant / après sur le protocole de l'étape 3.
- **Critères de validation** :
  - un gain mesuré sur des bébés **absents** de l'entraînement ;
  - aucune dégradation sur les données incomplètes ;
  - le cadre de confidentialité est respecté et validé.
- **Condition d'entrée** : n'ouvrir cette étape que si l'étape 4 montre un potentiel et si assez de données consenties existent.

### Étape 6 — Intégrer les prédictions validées et organiser leur amélioration continue [À faire]

- **Objectif** : afficher dans l'app les seules prédictions validées, avec explication et fiabilité, puis suivre leur qualité dans le temps.
- **Livrables** :
  - arbitre règles / modèle avec abstention ;
  - affichage : fenêtres, explications à gabarits, points de fiabilité (déjà maquettés) ;
  - suivi de la qualité (erreur réelle constatée a posteriori, taux d'abstention) ;
  - procédure de mise à jour et de retour en arrière d'un modèle.
- **Critères de validation** :
  - sur une période test, l'erreur observée en usage réel reste dans la fourchette mesurée à l'étape 4 ;
  - l'app reste utilisable hors ligne (repli sur les règles) ;
  - aucune prédiction n'est affichée sans explication ni niveau de fiabilité.

---

## 7. Mesure, tests et fiabilité [À faire]

État : 77 tests de non-régression et de cas connus **[Prod]**. Aucune mesure de justesse sur la réalité, aucun backtest.

### 7.1 Protocole de backtest glissant

Pour chaque instant de décision du passé : couper le journal à cet instant, ne garder que ce qui était **déjà saisi** (`created_at`), prédire, comparer à ce qui s'est passé, avancer. Répéter sur toutes les fenêtres. Aucune information du futur ne doit fuiter, ni par les données, ni par les seuils. Sorties reproductibles : même journal + même version = mêmes chiffres.

- **Erreurs de prédiction** :
  - erreur absolue moyenne et médiane, en minutes, par tâche ;
  - taux de couverture des fourchettes (calibration) et largeur moyenne des fourchettes (une fourchette trop large ne sert à rien) ;
  - résultats par tranche d'âge (0–1, 1–2, 2–4, 4–6 mois) et par bébé, pas seulement en moyenne.
- **Comparaison aux méthodes simples** : chaque modèle est toujours présenté face aux références de l'étape 3. Une IA qui ne bat pas une médiane glissante n'est pas intégrée.
- **Données incomplètes** : tests avec trous injectés (nuit non notée, après-midi oubliée, saisie après coup décalée de ± 15 min). Le système doit dégrader ses fourchettes ou s'abstenir, jamais inventer.
- **Abstention** : seuils explicites (nombre minimal de jours ou de nuits complets, fourchette trop large, désaccord fort entre règle et modèle). Message produit déjà prévu : « Nous apprenons encore à connaître son rythme. »
- **Changements de rythme** : détection d'une rupture (poussée de croissance, passage de 4 à 3 siestes). Après une rupture, on donne plus de poids aux jours récents et on baisse la fiabilité affichée.
- **Non-régression** : tests automatiques du moteur de règles, plus un jeu de référence de prédictions à comparer à chaque mise à jour d'un modèle.

### 7.2 Mesures ajoutées le 2026-11-02

Calibration probabiliste (score d'intervalle, diagramme de fiabilité), performance selon la quantité de données, performance après une rupture, taux d'abstention, comparaison systématique à des références simples : médiane glissante, dernier intervalle, ancien calcul.

### 7.3 Règle de retenue

**Règle absolue (Victor, 2026-11-02) : aucun modèle ne passe en production sans démontrer une amélioration mesurable sur des données non utilisées pour son apprentissage.** Concrètement (plan, section 3) : rejeu chronologique, période finale gelée, au moins 10 % d'erreur médiane en moins que la meilleure référence avec un intervalle à 90 % qui exclut zéro, couverture à ± 5 points de la cible, fenêtre au plus 25 % plus large. En production, chaque bébé garde un repli sur le calcul simple si le modèle ne bat pas la référence sur son propre passé récent.

### 7.4 Ce que les données permettent, et quand

| Question | Il faut au minimum | Disponible au 2026-11-02 |
|---|---|---|
| Vérifier que le code fonctionne | journaux synthétiques | oui |
| Mesurer les fenêtres actuelles | ≈ 3 à 4 semaines d'un bébé, bien notées (estimation, à confirmer) | non, ≈ 3 jours |
| Comparer des modèles sur un bébé | ≈ 6 à 8 semaines (estimation) | non |
| Performance **par tranche d'âge** | plusieurs bébés par tranche | **non, et un seul bébé ne suffira jamais** |
| Généraliser | plusieurs familles consentantes | non |

Niveaux de preuve utilisés partout (plan, section 3) : **R0** réel actuel, **T** synthétique, **R1** semaines, **R2** mois, **P** plusieurs bébés, **E** validation externe. Ils ne se confondent jamais : les données synthétiques ne servent jamais à prétendre qu'un modèle est performant.

Conséquences à accepter : les jours d'un même bébé ne sont pas indépendants, donc un grand nombre d'événements ne vaut pas un grand échantillon. Les résultats sur un bébé se lisent comme **une étude de cas**, jamais comme une performance générale. Les journaux synthétiques vérifient la mécanique ; **ils ne prouvent jamais la justesse**, car ils ne contiennent que ce qu'on y a mis. Ils ne sont jamais présentés comme des données réelles.

### 7.5 Inventaire des seuils à centraliser (principaux, liste complète en phase B3)

| Seuil | Valeur | Justification actuelle |
|---|---|---|
| Journée « de jour » | 7 h – 19 h 30 (`isNapAt`) ; 7 h – 18 h 30 (observations) ; 7 h – 21 h (Résumé) | aucune, contradictoires |
| Fenêtre de nuit par défaut, bornes | 19 h – 9 h ; coucher 17 h – 21 h ; réveil 6 h 30 – 9 h | ajustées sur un cas réel |
| Nuit | éveil ≤ 50 min, total ≥ 90 min, 1er bloc ≥ 60 min, fin ≥ 5 h 30 | cas réels de Victor |
| Fusion de siestes | ≤ 30 min | demande de Victor |
| Trou de saisie | > 5 h après 6 h | aucune |
| Journée type, nuit habituelle | 3 jours, 4 nuits, sur 7 | jugement |
| Fiabilité | 80 %, 50 %, 20 min | jugement |
| Liens | 5 nuits par groupe, 30 min, 7 sur 10 | jugement, voir 2.3 |
| Enchaînements | repas ≤ 10 min après le réveil, ≤ 30 min avant le dodo, dodo ≤ 4 h après le repas | jugement |
| Solidité d'une observation | 8 cas, 5 jours, écart ≤ 45 min | jugement |

**Aucun de ces seuils ne dépend de l'âge.** Le chantier les rend explicites, documentés et évalués. Ils ne changent que sur mesure. Registre complet : `web/src/engine/config.ts`.

### 7.11 Bascule en production (2026-11-02, demande de Victor)

**[Prod]** `web/src/engine/bridge.ts` : nuits et journées passent par `createCalendar` avec `CURRENT_RULES`, `habitOf` situe les siestes entre le réveil et le coucher du jour, `lkEval` ne garde que les liens retenus par `associations` (14 nuits minimum, tautologie `awb|bed` écartée). Effets visibles possibles : un lever tôt prouvé compte comme nuit complète, le jour du changement d'heure sort des habitudes, moins de liens. L'écran garde ses textes et son gabarit.

**Exception décidée par Victor le 2026-11-02 :** le modèle de survie alimente le prochain dodo, avec la mention « en test », de 6 h à 21 h, dès 8 éveils de jour. Il n'a pas passé la règle 7.3 : `npm run backtest` le compare toujours à la plage habituelle, et il sera retiré s'il fait moins bien. Largeur minimale 30 min, sans calibration. Les créneaux suivants restent la plage habituelle.

**Pas en production** : Kalman, bayésien, pondéré, calibration et fenêtre de repas, faute de preuve (7.3). Le moteur est publié sur `main`, donc public. `INTELLIGENCE.md`, le plan et `tasks/` restent sur la branche locale.

### 7.10 Analyse transversale (phase F, 2026-11-02)

**[Code] non branché, sans résultat réel [Données] :** journée puis nuit (`dayToNight`, 11 facteurs et plus, 4 issues), éveil puis sieste (`awakeToNap`, permutation par jours entiers), types de journées (`dayTypes`, deux groupes nets ou rien), motifs et transitions (`sequences.ts`), évolution par indicateur (`evolution.ts`).

Règles appliquées : tout passe par `testAssociations` (14 nuits minimum, permutation par blocs, tendance et nombre de siestes retirés, correction sur toute la famille). Un volume n'existe que les jours sans tétée. Un jour sans couche notée est exclu, jamais compté zéro. Humeur, digestion, selles seulement : **ni cases santé ni notes de la maman**, pour éviter toute conclusion médicale. Faux liens sur le coucher, toute la famille de tests, 40 journaux sans lien voulu : 5 %.

**Tautologies écartées** : « éveil avant le coucher » et « dernier repas avant le coucher » ne sont pas testés contre le coucher, ils le contiennent. **L'ancien `lkEval` teste `awb` contre le coucher dans Explorer** : ce lien est automatique, à retirer à la bascule.

**Limites** : confondants non notés invisibles ; lait maternel ou infantile et tirages non analysés, faute de données fiables ; rituels et bain absents du journal.

### 7.9 Banc de modèles (phase E, 2026-11-02)

**Codés et testés, aucun activé [Code] [Données] :** quantiles pondérés (`weightedAwake`), Kalman à niveau local, bayésien Normale-Gamma inverse à a priori plat, survie à temps discret S + C réduite, calibration conforme, détection de rupture (CUSUM, BOCPD, `classifySeries`), fenêtre de repas descriptive (`nextFeed.ts`), règle d'activation `decide` et arbitre par bébé `arbiter` (`evaluation/selection.ts`). Registre : `MODEL_REGISTRY`.

**Verdict au 2026-11-02 :** `not_enough_data` sur le réel, `mechanics_only` sur le synthétique, **par construction** : `decide` ne peut jamais retenir un modèle au niveau T ou R0. Période gelée exigée : 20 % de l'historique, 14 jours au moins.

**Lecture du banc synthétique, mécanique seulement :** la survie calibrée approche la cible de 80 % sur tous les scénarios ; elle fait mieux que le calcul actuel sur le nouveau-né, moins bien sur les bébés réguliers, dont le journal synthétique a été construit à heures fixes. Rien de cela ne prédit un vrai bébé.

**Limites :** l'âge n'est pas une variable du modèle de survie (sur un bébé, il se confond avec le temps, l'historique glissant le couvre) ; aucune abstention sur fenêtre large dans les candidats ; le semi-markovien n'est pas codé, faute de données pour ses paramètres ; le modèle de survie n'est pas passé par le contrôle d'un spécialiste du sommeil **[Validation]**.

### 7.8 Fiabilisation (phase D, 2026-11-02)

Corrections dans `web/src/engine/`, **non branchées** (`rules.ts` : `LEGACY_RULES` reproduit la production, `CURRENT_RULES` est le moteur corrigé).

- **Lever tôt** : une nuit finie entre 4 h et 5 h 30 est complète si ≥ 4 h de sommeil sont notées et qu'un événement noté dans les 3 h prouve le lever. Sinon elle reste partielle.
- **Faux liens, niveau T, 150 simulations de 21 nuits, 15 comparaisons, sans lien réel** : l'ancien test en trouve un dans 44 % des journaux, 75 % avec une dérive commune ; le nouveau, `associations.ts`, dans 1,3 % des cas. Sur un vrai lien injecté, retrouvé 95 % du temps. Ces simulations reflètent nos hypothèses ; aucun bébé réel n'a encore assez de nuits. **Limite** : un confondant non noté reste invisible, un lien reste une association.
- **Âge [Partiel]** : calculé et transmis, testé à 2, 8, 16 et 26 semaines. **Aucun seuil ne dépend encore de l'âge** : ce serait inventer une table non sourcée. La suite attend la base K et des mesures.
- **Manques** : `coverage`, jours de changement d'heure exclus, journée trouée exclue.
- **Abstention** : `nextSleep` rend une fenêtre ou une raison (`too_few_days`, `asleep`, `data_gap`, `no_window`, `window_too_wide`). Fiabilité déclarée `measured: false` tant qu'elle n'est pas mesurée.
- **Non résolues** : les bornes 18 h 30 et 21 h vivent dans du code non extrait ; le découpage des siestes fusionnées garde 7 h – 19 h 30.

### 7.7 Extraction à parité (phase C, 2026-11-02)

`SL`, `nightOf`, `dayOf`, `typ`, `usual`, `wins`, `habitOf`, `stat`, `lkR`, `lkEval` existent dans `web/src/engine/` **[Code]**, non branchés : la production calcule toujours avec `renderVals`. Parité prouvée par `web/src/legacy/parity.test.ts`, qui lit les valeurs internes de la production via une sonde sur une copie en mémoire : 7 journaux synthétiques à 5 instants, chrono en cours, lien présent, et le journal réel heure par heure. Le test détecte des pannes volontaires. **Non extraits** : `awDay`, habitude d'éveil, observations `rFw` et `rNp`, analyses d'Explorer. Mode d'alimentation déduit : `feeding/mode.ts` **[Code]**.

### 7.6 Premier backtest (phase B, 2026-11-02)

Commande : `npm run backtest` (rapport local dans `data/rapports/`, jamais versionné).

- **Réel, niveau R0** (51 événements, 3 jours, 15 décisions) : le calcul actuel s'abstient 100 % du temps, faute de 3 journées complètes dans la période. Sa justesse réelle reste **inconnue**. Saisie : médiane 6 min, 90e centile 716 min, 24 % des événements saisis plus d'une heure après. 0 anomalie.
- **Synthétique, niveau T** : le banc fonctionne. **Ces chiffres ne disent rien de la performance** : ces bébés ont des horaires réguliers par construction, ce qui avantage le calcul actuel.
- **Défaut confirmé** : un bébé levé vers 5 h 20 chaque matin n'obtient jamais de journée type ni de prévision (abstention 100 %), à cause du seuil « nuit finie après 5 h 30 ». À traiter en phase D.

---

## 8. Confidentialité [Partiel] [Validation]

> **Mise à jour 2026-11-02.** Le backend existe désormais (Supabase) pour une seule famille, celle de Victor. La validation juridique demandée ci-dessous « avant tout backend » **n'a pas eu lieu** : c'est acceptable tant que seule cette famille l'utilise, mais c'est **bloquant avant d'ouvrir l'app à d'autres familles**. La région d'hébergement Supabase n'est pas vérifiable depuis le code. Le moteur calcule sur l'appareil et n'envoie rien : il n'ajoute aucun flux de données. **Le dépôt GitHub public expose des données réelles** (2.3, point 12) : c'est la priorité de la phase A. Aucune suppression sans identification précise et procédure de sécurisation. **Conditions d'ouverture à d'autres familles, sans date : confidentialité et sécurité traitées, architecture multi-familles prête, données de chaque foyer strictement isolées, obligations juridiques vérifiées.**

- **Minimisation** : ne collecter que ce qui sert un indicateur affiché. Le prénom est facultatif ; la date de naissance suffit, sans lieu ni identité des parents.
- **Données sensibles [Hypothèse à vérifier]** : des données de sommeil et d'alimentation d'un nourrisson peuvent relever des **données de santé** (RGPD, article 9). Si c'est le cas en France, l'hébergement peut exiger un **hébergeur certifié HDS**. À faire valider par un juriste **avant** tout backend.
- **Par défaut, sur l'appareil** : l'arbitrage A1 a été tranché pour Supabase. Tout envoi vers un serveur doit rester chiffré en transit et au repos, et hébergé dans l'UE (**à vérifier** sur le projet Supabase).
- **Backtests** : exécutés en local sur un export, jamais envoyés à un service tiers, jamais commités ; dates décalées et prénom retiré pour tout jeu partagé. Le fuseau et la date de naissance sont réduits à l'âge en jours.
- **Droits des familles** : export complet (déjà amorcé avec la sauvegarde JSON du tire-lait), suppression définitive, information claire.
- **Apprentissage global** (à partir des données de plusieurs familles) :
  - **désactivé par défaut**, avec un consentement explicite, séparé et révocable (opt-in) ;
  - données pseudonymisées, et agrégation ou anonymisation avant entraînement ;
  - aucune donnée de famille envoyée à un tiers (y compris un service d'inférence externe) sans contrat ni analyse d'impact (AIPD) ;
  - possibilité de retirer ses données des prochains entraînements.
- **Données de développement** : `data/rythme_extrait.csv` (données réelles d'un bébé) reste hors de git ; tout jeu de test versionné est synthétique ou anonymisé.

---

## 9. Points ouverts à trancher avec Victor

1. ~~**A1 — Synchronisation / backend**~~ : tranché, Supabase en production. Le calcul reste sur l'appareil.
2. ~~**A5 — Profil bébé**~~ : date et heure de naissance en production. Poids et prématurité restent absents.
3. **Où conduire les expériences** Python éventuelles : dépôt séparé ou dossier `experiments/`. Aucune dépendance Python n'entre dans l'app.
4. **Données réelles** : l'export JSON de l'app (Profil › sauvegarde) remplace l'ancien besoin. L'export de l'ancienne app de suivi (historique plus long) reste à obtenir si Victor l'a : ce serait le gain le plus rapide pour le chantier de mesure.
5. ~~**Seuil de gain minimal**~~ : fixé en 7.3.
6. **Base de connaissances (section 10)** : relecteur à désigner plus tard, profil et processus proposés (plan, D7 et annexe B). Aucune référence n'est validée avant cette étape.
7. **Mode d'alimentation** : recommandé, déduit des repas saisis (6.7).
8. ~~**Extraction du calcul**~~ : validée, progressive, parité vérifiée, chaque bascule accordée.
9. **Traçabilité des corrections** : migration additive à autoriser et durée de conservation (plan, D3 et O3).
10. ~~**Ouverture à d'autres familles**~~ : aucune date, quatre conditions (section 8).
11. **Dépôt public** : passage en privé, impact Vercel, réécriture éventuelle de l'historique (plan, D1, O1, O2).

Décisions et questions ouvertes à jour : plan, sections 1 et 2.

---

## 10. Base de connaissances sur les rythmes des bébés [Doc] [Validation]

> Ajoutée le 2026-10-31 à la demande de Victor. **Toujours aucune donnée collectée ni aucun code au 2026-11-02.** Seul existe l'interrupteur `AGE_REFS = false`, qui masque trois exemples non sourcés.
> Les pistes de 10.7 viennent de ma connaissance générale. Le 2026-11-02, l'existence de certaines publications a été vérifiée sur leurs résumés (10.7 bis) ; **aucune valeur n'est validée et aucune n'entre dans la base à ce stade**.
> Compléments du 2026-11-02 : `getReference(indicator, ageInDays)` rend `null` sans référence fiable ; aucune référence non validée n'est exposée aux familles ; la première version se limite aux indicateurs documentés (sommeil sur 24 h, nombre de repas et volume au biberon sur 24 h si une source fiable existe, nombre de siestes si une source solide existe) ; la base couvre aussi le développement, les transitions et la sécurité (recommandations officielles et limites). Pour chaque valeur : source primaire ou institutionnelle, population, âges, méthode de mesure, date, limites, droits d'usage, validité des chiffres.
> Les arbitrages A1 et A5 cités plus bas sont levés (section 9) : la date de naissance est disponible.

### 10.1 Objectif et périmètre

Disposer d'une **référence organisée par âge** (naissance à 6 mois dans un premier temps) pour que l'intelligence :

- **contextualise** les observations propres au bébé (« à cet âge, les siestes durent le plus souvent entre… ») ;
- **rassure** sans transformer un repère en norme ;
- alimente les rubriques **« À retenir »** et **« Comprendre »**, en remplaçant les repères d'âge actuellement *inventés pour les maquettes* (V5 v40 : « Calculé · repère d'âge », « Repère d'âge ») et l'arbitrage A4.

Hors périmètre : au-delà de 6 mois, diagnostic, courbes de croissance (poids, taille : dépend de A5), introduction des solides.

### 10.2 Place dans l'architecture

```
Profil bébé (âge exact, alimentation)  ─┐
Observations du bébé (moteur de règles) ─┼→ Comparateur ──→ Générateur d'explications
Base de connaissances (lecture seule)  ─┘     (position vs repère,      (deux blocs distincts :
   ↑ mises à jour par fichiers de données      abstention possible)       « chez lui » / « repère général »)
   sans toucher au moteur
```

Principes :

1. **La base est de la donnée, pas du code.** Fichiers versionnés (JSON/CSV) lus par le moteur à travers **une seule fonction d'accès**. Mettre à jour un repère = modifier un fichier, pas le moteur.
2. **Contrat d'accès [Hypothèse]** : `getReference(indicateur, ageEnJours, { alimentation, âgeCorrigé? })` → `{ plage, nature, confiance, sources, versionBase }` ou `null`. **`null` = abstention** : le moteur n'invente jamais de repère.
3. **Traçabilité** : chaque explication affichée mémorise la `versionBase` utilisée, pour savoir plus tard ce qui a été dit et sur quelle source.
4. **Séparation stricte** entre le **profil individuel** (ce que fait *ce* bébé, section 4) et la **base de référence** (ce que montrent les études sur *des* bébés). Les deux ne se mélangent jamais dans un calcul ni dans une phrase.

### 10.3 Contenu à documenter par tranche d'âge

| Famille | Indicateurs | Remarque |
|---|---|---|
| **Sommeil** | durée totale sur 24 h ; part du jour et part de la nuit | plages de variation, pas de valeur cible |
| **Cycles de sommeil** | durée indicative d'un cycle ; particularités selon l'âge | Margherite ne mesure pas les cycles (leçon 2026-10-30) : repère de **contexte** seulement, jamais comparé à une mesure |
| **Siestes** | nombre habituel, durée, répartition dans la journée | |
| **Éveil** | fenêtres d'éveil selon le moment de la journée | source faible à ce jour (cf. `tasks/todo.md`) |
| **Repas** | fréquence sur 24 h, intervalles habituels, repas de nuit | selon le mode d'alimentation |
| **Alimentation** | quantités par repas et sur 24 h | **uniquement pour le biberon**, jamais de volume au sein (règle déjà appliquée) |
| **Évolution** | changements habituels de semaine en semaine (consolidation de la nuit, passage à moins de siestes, poussées de croissance) | décrits comme des tendances, pas des étapes à franchir |

### 10.4 Structure de la base [Hypothèse]

**Entrée de repère** (une ligne = une valeur sourcée) :

```
{ id, indicateur, unité,
  ageDe, ageA,                 // en jours depuis la naissance (ou âge corrigé), bornes incluses
  alimentation,                // tous | sein | biberon | mixte
  contexte?,                   // ex. nuit / jour, rang de la sieste
  plage: { bas, haut, type },  // type : p10-p90 | min-max | interquartile | recommandation
  valeurCentrale?,             // facultative, JAMAIS affichée comme cible
  nature,                      // reference_statistique | recommandation_medicale
  confiance,                   // A | B | C | D (ci-dessous)
  sourceIds[],                 // renvoie au registre de sources
  population,                  // pays, effectif, méthode (rapport parental, actimétrie, journal…)
  statut,                      // brouillon | relu | publié | obsolète
  relu: { par, le }, valideDepuis }
```

**Registre de sources** : `{ id, titre, éditeur, type (institution | société savante | publication), année, url, consultéLe, licence, langue, remarqueSurLaPopulation }`.

**Âge exact et plages qui se chevauchent.** Les sources publient des tranches (« 0–3 mois ») qui se recoupent ou ne coïncident pas. Proposition :

- stocker les tranches **telles que la source les donne**, sans les redécouper ;
- pour un âge donné, retenir **toutes** les entrées qui le contiennent ; la plage affichée est leur **enveloppe** (la plus large), la confiance affichée est la **plus basse** ;
- aucun effet de seuil le jour du changement de tranche (le repère « glisse » : il ne saute pas) ;
- l'interpolation entre points d'ancrage reste une option ultérieure, seulement si l'enveloppe se révèle trop grossière.

**Niveaux de confiance** (à définir à l'étape 2, proposition de départ) :

| Niveau | Contenu | Affichage à l'utilisateur |
|---|---|---|
| **A** | recommandation d'une institution ou consensus d'experts | « Recommandation » + source |
| **B** | revue systématique, méta-analyse ou grande cohorte | « Repère » + source |
| **C** | étude observationnelle limitée, autre pays, échantillon restreint | « Repère indicatif » + source, fourchette élargie |
| **D** | avis d'expert ou pratique courante non solidement sourcée | **jamais affiché** (peut guider la recherche seulement) |

**Nature de la valeur** : une **recommandation médicale** (ce qu'une autorité conseille de faire, ex. sommeil sécurisé) n'est **pas** un **repère statistique** (ce qui s'observe en moyenne). Les deux ont des libellés, des couleurs et des règles d'usage distincts. Les seuils d'alerte (fièvre, refus de boire…) restent dans les messages d'orientation du Journal, **validés par un professionnel**, et n'entrent **pas** dans cette base.

**Versionnage** : numéro de version de la base (semver), journal des changements (quelle entrée, pourquoi, source), version de schéma vérifiée par le moteur au chargement. Un changement de **schéma** demande le moteur ; un changement de **valeur** ne le demande pas.

### 10.5 Utilisation par l'intelligence

Ordre de lecture à respecter, toujours :

1. **Ce que fait le bébé** (ses habitudes apprises, sa tendance) passe **en premier**. Le repère général ne sert qu'à situer, jamais à juger.
2. Comparer la valeur observée à la plage de son âge : *dans la plage* / *proche d'une limite* / *hors plage* / *pas de repère* (abstention).
3. **Un écart n'est pas un diagnostic** : « hors plage » donne un libellé neutre (« Plus court que ce qu'on observe le plus souvent à cet âge »), jamais « anormal », « retard » ni « en dessous ».
4. **Évolution individuelle** : la tendance du bébé (« ses nuits s'allongent ») est comparée à l'évolution habituelle de l'âge, pas à une valeur fixe.
5. **Deux blocs distincts** dans chaque explication : « Chez [prénom] » (observé, avec n et période) et « Repère général à cet âge » (source, nature, confiance, tout en sobre, replié par défaut).
6. **Abstention** si : pas de repère de confiance ≥ C pour cet âge et ce mode d'alimentation ; données du bébé trop peu nombreuses ; âge inconnu (A5).
7. **Mode d'alimentation** : l'entrée adéquate est choisie selon le profil (sein, biberon, mixte) ; sans information, entrée « tous » ou abstention. **Prématuré [Hypothèse]** : utiliser l'âge corrigé seulement si la donnée est saisie.

Où cela s'affiche : *À retenir* (observation + repère d'âge sourcé), *Comprendre › Explorer son rythme* (bloc « repère général » replié sous chaque analyse), pastille de fiabilité inchangée.

### 10.6 Fiabilité et précautions (règles non négociables)

- **Une moyenne n'est jamais un objectif.** On affiche une plage, jamais « il devrait dormir X h ». Aucun score, aucune note, aucun classement.
- **Toujours dire la variation individuelle** : « Chaque bébé a son rythme ; ces repères décrivent ce qui s'observe le plus souvent. »
- **Aucun diagnostic ni conseil médical.** Rappel non médical conservé (déjà dans les maquettes). Aucun conseil de retarder ou d'avancer un repas ou une sieste.
- **Recommandation médicale ≠ repère statistique** : étiquettes et vocabulaire séparés.
- **Vocabulaire interdit** (à vérifier par test automatique des gabarits) : « norme », « normal / anormal », « objectif », « retard », « en avance », « insuffisant », « devrait ».
- **Sources institutionnelles et scientifiques d'abord** (HAS, Santé publique France, OMS, sociétés savantes, publications évaluées par les pairs). Pas de blog, pas de forum, pas de marque commerciale.
- **Population de la source** toujours consignée (pays, méthode) : beaucoup d'études reposent sur des déclarations de parents occidentaux ; transposition à la France à signaler quand elle n'est pas prouvée.
- **Relecture par un professionnel de santé** avant toute publication d'un repère affiché à des familles (étend A4).
- **Droit d'usage des sources** : citer et référencer, ne pas recopier des tableaux ou des textes protégés sans vérifier la licence.

### 10.7 Pistes de sources à identifier et vérifier [À faire — non vérifiées]

À qualifier à l'étape 1 (existence, version en vigueur, accessibilité, licence, population). Aucune valeur chiffrée n'est reprise ici.

| Piste | Pour quoi | À vérifier |
|---|---|---|
| **HAS** (recommandations sur l'allaitement, l'alimentation du nourrisson, la prévention de la mort inopinée du nourrisson) | recommandations médicales (sommeil sécurisé, alimentation) | version et date en vigueur |
| **Santé publique France** (études sur l'alimentation du nourrisson en France, ex. étude Épifane) | fréquence des repas, modes d'alimentation | contenu précis, âges couverts |
| **OMS** (alimentation du nourrisson et du jeune enfant ; standards de croissance) | recommandations d'allaitement, croissance | périmètre utile à Margherite |
| **Société française de pédiatrie** et carnet de santé | repères destinés aux familles françaises | disponibilité publique |
| **American Academy of Pediatrics / AASM** (consensus sur les durées de sommeil recommandées, à partir de 4 mois) | recommandation sur le sommeil total | **ne couvre pas la naissance à 4 mois** |
| **Méta-analyses et grandes cohortes sur le sommeil de l'enfant** (ex. normes de durée de sommeil de l'enfance, études de percentiles de durée de sommeil dans la petite enfance) | plages statistiques de sommeil | identifier les publications exactes, leur méthode et leur pays |
| **Études de questionnaires de sommeil du nourrisson** (comparaisons entre pays) | variations culturelles, nombre de réveils | fiabilité d'un rapport parental |
| **ANSES / ESPGHAN** | apports et quantités de lait | pertinence et âge couvert |

Pistes **sans source solide connue** à ce jour (à chercher, sinon l'indiquer) : fenêtres d'éveil par âge, cycles de sommeil du nouveau-né mesurés en conditions réelles, durée du plus long sommeil. **Si aucune source de confiance ≥ C n'existe, le repère n'est pas affiché**.

### 10.7 bis Vérification du 2026-11-02 (résumés seulement)

Existence, titre et revue confirmés dans un index de publications. Les textes intégraux, licences et tableaux restent à lire à l'étape 1. Les chiffres cités viennent des résumés et servent à juger la faisabilité : **ce ne sont pas des repères validés**.

| Publication | Intérêt | Point d'attention |
|---|---|---|
| Hirshkowitz et al., National Sleep Foundation, *Sleep Health* 2015 (doi:10.1016/j.sleh.2014.12.010, 10.1016/j.sleh.2015.10.004) | recommandations par groupe d'âge (nouveau-nés, nourrissons) | avis d'experts, pas une distribution observée |
| Paruthi et al., AASM, 2016 (doi:10.5664/jcsm.6288, 10.1542/peds.2016-1601) | consensus sur le sommeil de l'enfant | d'après 10.7, ne couvre pas la naissance à 4 mois |
| Galland et al., *Sleep Med Rev* 2012 (doi:10.1016/j.smrv.2011.06.001) | revue, valeurs de référence | une plage large ; catégorie « nourrisson » unique |
| Iglowstein et al., *Pediatrics* 2003 (doi:10.1542/peds.111.2.302) | percentiles par âge, sommeil total, nuit et jour | cohorte suisse ; tendance générationnelle |
| O Sullivan et al., *Arch Dis Child* 2023 (doi:10.1136/archdischild-2022-324016) | centiles de 4 à 16 semaines, dont le plus long sommeil | cohorte irlandaise, issue d'un essai ; lacune possible de 10.7 comblée sur « plus long sommeil » |
| Price et al., *Arch Dis Child* 2014 (doi:10.1136/archdischild-2013-304150) | cohorte australienne longitudinale | pas de détail avant 4 mois dans le résumé |
| Paavonen, de Bie et al., *Sleep Med* 2026 (doi:10.1016/j.sleep.2026.109276) | maturation de 3 à 18 mois sur données d'événements à grande échelle, proche de notre format | à lire ; origine des données à qualifier |
| Article « Development of infant and toddler sleep patterns », *J Sleep Res* 2016 (doi:10.1111/jsr.12414) | données d'application mobile, 841 enfants | sponsorisé commercialement, échantillon auto-sélectionné |
| Sievers et al., 2002 (doi:10.1159/000066498), Dewey et al., 1986 (doi:10.1093/ajcn/43.3.367) | fréquence et volumes de repas | petits effectifs, anciens : confiance C au mieux |
| *Eur J Pediatr* 2024 (doi:10.1007/s00431-024-05726-w) | apports selon le profil de croissance | **les besoins en volume dépendent du poids** : sans poids, un repère de volume par âge seul risque d'être trompeur, donc `null` probable |

Constats : les sources divergent déjà sur le sommeil du nouveau-né, ce qui confirme l'enveloppe de 10.4 et l'interdiction d'une valeur cible. **Aucune source solide n'a été trouvée sur les fenêtres d'éveil par âge** (une recherche, à élargir) : le repère reste indisponible. Les recommandations françaises (HAS, Santé publique France) restent à vérifier.

### 10.7 ter État de la base (phase K, 2026-11-02)

**[Code] et données en brouillon, non validés.** `web/src/engine/knowledge/` : `getReference(indicator, ageInDays)`, validateur, 7 sources, 5 entrées sur le seul sommeil total, toutes `brouillon`. `getReference` rend `null` pour tout : seule une entrée `publie`, avec relecture et sans point à vérifier, peut sortir. Valeurs lues sur des résumés, aucun texte intégral. Dossier : `tasks/phase-k-dossier-relecture.md`. Étapes K5 à K7 en attente du relecteur **[Validation]**.

### 10.8 Besoins en données du côté de l'app

| Donnée | Statut | Pourquoi |
|---|---|---|
| Date de naissance (âge en jours) | [Prod] | clé de lecture de la base |
| Mode d'alimentation (sein / biberon / mixte) | [À faire], déduit (6.7) | choisit l'entrée et décide si des quantités ont un sens |
| Prématurité, âge corrigé | [Hypothèse] | âge de lecture ; donnée sensible, seulement si saisie volontairement |
| Journal du bébé (sommeil, repas) | [Prod] | observation à comparer |
| Poids et taille | Absent (A5) | hors périmètre de cette première base |

### 10.9 Étapes de réalisation

Aucune ne démarre sans l'accord de Victor. Les étapes 1 à 4 ne touchent pas au code de l'app.

| # | Étape | Livrables | Critère de validation |
|---|---|---|---|
| **1** | Identifier et sélectionner les sources fiables | liste candidate qualifiée (10.7 complétée), grille d'évaluation, sources retenues et écartées avec le motif | chaque source a éditeur, année, licence, population, accessibilité vérifiés |
| **2** | Définir les tranches d'âge et les indicateurs | dictionnaire d'indicateurs rattaché à l'étape 1 du plan principal (section 6) ; découpage d'âge ; niveaux de confiance figés ; règles d'enveloppe et d'abstention | Victor valide le dictionnaire ; chaque indicateur a une définition non ambiguë |
| **3** | Collecter et structurer les données | extraction sourcée, une entrée par valeur, avec population et méthode | aucune valeur sans source ; double lecture des chiffres reportés |
| **4** | Documenter sources, dates et fiabilité | registre de sources complet, niveau de confiance par entrée, journal des changements | une entrée sans source ou à confiance D est refusée |
| **5** | Créer la base de référence | fichiers versionnés + schéma + validateur automatique + fonction d'accès `getReference` testée (TDD) | tests : chevauchements, âge hors plage, `null` si pas de repère, version de schéma incompatible |
| **6** | Connecter progressivement au moteur d'intelligence | d'abord un seul indicateur (ex. durée de sommeil totale), puis un à un ; blocs « repère général » dans À retenir / Comprendre | le moteur est inchangé quand on modifie une valeur ; tests de non-régression ; test automatique du vocabulaire interdit |
| **7** | Évaluer sur des cas réels et représentatifs | jeu de cas : bébé allaité, nourri au biberon, mixte, prématuré, journal incomplet, rythme atypique mais sain, rupture de rythme | relecture par un professionnel ; aucune phrase ne qualifie un écart d'anormal ; chaque repère affiché a sa source ; abstention correcte quand il n'y a pas de repère |

**Dépendances** : A5 (date de naissance) pour l'étape 6 ; A4 (validation par la pédiatre) pour l'étape 7 ; pas besoin d'A1 (synchronisation) : la base est en lecture seule et peut être embarquée dans la PWA.

### 10.10 Risques identifiés

1. **Faux sentiment de norme** : afficher une plage trop étroite ou une valeur centrale incite à comparer. Parade : plages larges, pas de valeur centrale à l'écran, texte sur la variation.
2. **Sources hétérogènes** (méthodes, pays, âges) : parade : population consignée, enveloppe, confiance minimale.
3. **Obsolescence** : parade : date de relecture par entrée, cadence de revue (à fixer, par ex. annuelle), statut `obsolète`.
4. **Couverture insuffisante** de certains repères (éveil, cycles) : parade : abstention plutôt qu'invention.
5. **Charge anxiogène** : parade : repère replié par défaut, vocabulaire neutre, jamais en alerte.

---

## 11. Contrat de résultats pour l'application future [À faire]

**[Code] non branché, 2026-11-02 :** `web/src/engine/analyze.ts` (`analyze`, contrat version 1), gabarits neutres `safety/templates.ts`, contrôle `safety/vocabulary.ts`. Rend tout l'historique, pas seulement les 30 jours de l'écran ; 6 mois synthétiques en ≈ 0,9 s sur ordinateur, téléphone non mesuré, donc à ne pas appeler à chaque rendu. `references` reste vide. Les gabarits attendent une relecture humaine. Relevé des textes actuels : 17 passages sur 538, tous bénins sauf à relire l'orientation médicale déjà connue ; rapport local `data/rapports/vocabulaire.md`.

Le moteur expose une fonction pure, sans lien avec l'interface. Rien ne l'appelle depuis un écran pendant ce chantier.

```
analyze(input, { now, ageDays?, modelVersion? }) → EngineReport

EngineReport {
  engineVersion, knowledgeVersion?, generatedAt, dataQuality,
  habits[], forecasts[], evolutions[], associations[], comparisons[], references[]
}

Finding (socle commun) {
  id, kind: 'observation' | 'hypothesis' | 'forecast' | 'reference',
  status: 'stable' | 'trend' | 'one_off' | 'break' | 'insufficient',
  value?, window?: { from, to, coverage },
  reliability: { level, n, period, basis },
  facts: { code, params }[],     // pas de phrase toute faite, pas de genre
  limits: string[],
  sources?: string[],
  abstained?: { reason }
}
```

Exemple de raison d'abstention : `too_few_days`, `recent_break`, `no_reference`, `age_unknown`, `window_too_wide`. **L'abstention est un résultat de premier rang, pas une erreur.** Les gabarits de texte futurs reçoivent des codes et sont contrôlés par la section 12. « Comprendre » pourra s'en servir plus tard, ce n'est pas une consigne d'aujourd'hui.

---

## 12. Règles de fiabilité et de sécurité [À faire pour le contrôle automatique]

Canaille accompagne les parents, ce n'est pas un dispositif médical. **Point juridique à valider :** rester hors du champ du dispositif médical suppose de ne pas revendiquer de finalité médicale ; à confirmer par un juriste avant l'ouverture à d'autres familles **[Validation]**.

Règles absolues : aucun diagnostic, aucune prescription, aucun traitement, aucune injonction d'horaire, aucune recommandation de retarder un repas, aucun conseil dangereux sur le sommeil, aucune comparaison culpabilisante, aucune conclusion médicale à partir d'une donnée isolée.

Le moteur peut s'abstenir. Il distingue observations, hypothèses, prévisions et références (6.1).

**Contrôle automatique du vocabulaire [À faire].** Test sur tout gabarit produit par le moteur. Il étend la liste de 10.6 (« norme », « normal / anormal », « objectif », « retard », « en avance », « insuffisant », « devrait ») aux formes à l'impératif et d'injonction (« il faut », « doit », « évitez », « attendez », « limitez », « retardez »), au vocabulaire médical (« diagnostic », « traitement », « trouble », « pathologie ») et aux tournures causales (« à cause de », « parce que », « provoque », « entraîne »). Le test échoue sur tout mot interdit. Les textes actuels de l'app sont hors de son périmètre (pas de modification de l'UI) ; un relevé des occurrences sera fait à part.

Références et statistiques restent distinctes des recommandations médicales (10.4). Les messages d'orientation du Journal (fièvre, etc.) restent à faire valider par un professionnel et n'entrent pas dans le moteur.

---
