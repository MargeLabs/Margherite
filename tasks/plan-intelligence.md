# Plan consolidé : backend d'intelligence Margherite

> Version 2 du 2026-11-02, intègre les arbitrages de Victor. **En attente du feu vert : aucun développement, `web/` et l'interface restent intacts.**
> État des lieux et définitions : [`INTELLIGENCE.md`](../INTELLIGENCE.md).

**But :** une intelligence propriétaire qui apprend le fonctionnement de chaque bébé, comprend ses évolutions et anticipe ses prochains événements avec une fiabilité mesurable.

---

## 0. Alerte : le dépôt GitHub est public

> **Décision de Victor (2026-11-02) : le dépôt reste public**, sans Vercel payant. Les échantillons réels ne sont plus sur `main` (commit `1782fb6`) mais restent dans son historique. `INTELLIGENCE.md`, ce plan et le moteur restent **en local** sur la branche `chore/secure-repo`, jamais poussée. Les données de l'app (Supabase) ne sont pas concernées et n'ont pas été touchées.

`gh api` le confirme le 2026-11-02 : `MargeLabs/Margherite` est **public** (organisation, 0 fork, 0 étoile). `CLAUDE.md` le disait privé, et la première version de ce plan aussi : c'était faux, je ne l'avais pas vérifié.

| Exposé publiquement | Où |
|---|---|
| 64 tirages réels, datés | `web/src/data/__fixtures__/margherite-2026-10-31.csv`, commit `ced785d` |
| Journal réel de 6 jours du bébé | `maquettes/v3/Prototype.dc.html` (`LOG`) ; à confirmer pour les autres copies |
| Détail de ses rythmes, décisions produit, stratégie | `CLAUDE.md`, `memory/context.md`, `tasks/` |
| Prénoms des parents | `web/README.md`, `web/.env.example` |
| Identifiant du projet Supabase, du site Netlify | `CLAUDE.md` |
| Adresse e-mail de l'auteur | métadonnées des commits |
| Tout le code | dépôt |

**Non exposé (vérifié) :** `data/rythme_extrait.csv` (jamais commité), `.env.local`, clé de service Supabase, code famille. Aucun fichier d'environnement réel dans l'historique. La clé publique et l'URL Supabase sont de toute façon lisibles dans le site.

**Conséquence sur la stratégie :** tant que le dépôt est public, écrire le moteur revient à le publier. Le passage en privé précède donc tout commit de ce chantier, y compris `INTELLIGENCE.md` et ce plan, qui restent locaux d'ici là.

**Seconde conséquence, à connaître :** un moteur calculé sur l'appareil est livré dans le code du site, donc lisible même minifié par quiconque y accède. Les données restent privées, pas l'algorithme. Acceptable pendant le développement et pour une famille ; à reconsidérer avant une ouverture (décision O4).

---

## 1. Les décisions D1 à D8

| # | Sujet | État | Ce que j'attends de toi |
|---|---|---|---|
| **D1** | Sécurisation | **À faire par toi, en premier** | **Passer le dépôt en privé** (GitHub › Settings › Danger Zone). Rien n'est supprimé, c'est réversible. **Avant : vérifier le plan Vercel** (O1). Le reste, procédure A2 |
| **D2** | Règle d'activation | **Fixée** : section 3 | Rien |
| **D3** | Migration additive de la base | **Recommandée** | Dire oui au principe ; le SQL te sera présenté avant exécution, avec une sauvegarde préalable |
| **D4** | Mode d'alimentation | **Recommandé** : déduit des repas notés, avec « indéterminé » possible, sans saisie | Objecter seulement si tu préfères le déclarer (cela demanderait une UI) |
| **D5** | Export de l'ancienne app | **Tranché** : non bloquant | Si tu l'obtiens, le déposer dans `data/`, jamais ailleurs |
| **D6** | Versionnement | **Recommandé** : une branche par phase, commits après passage en privé | Rien de plus que D1 |
| **D7** | Relecteur | **Proposition ci-dessous** | Identifier les personnes quand la phase K en aura besoin (K5), pas maintenant |
| **D8** | Ouverture à d'autres familles | **Tranché** : pas de date, 4 conditions, liste en H2 | Rien |

**Profil proposé pour D7 (détail en annexe B) :**

- **Relecteur principal :** pédiatre en exercice, de préférence avec une pratique du sommeil du nourrisson. Valide sommeil, siestes, développement, sécurité.
- **Relecteur alimentation :** le même pédiatre, ou une consultante en lactation certifiée IBCLC pour l'allaitement et une diététicienne pédiatrique pour les volumes.
- **Relecteur méthode, facultatif en V1 :** épidémiologiste ou biostatisticien, utile pour juger les populations et les limites.

Sa relecture engage le contenu ; une convention écrite doit préciser le périmètre, la version relue et l'absence d'avis médical individuel. **Aucune référence n'est considérée validée avant cette étape.**

---

## 2. Décisions réellement ouvertes

| # | Question | Pourquoi | Ma recommandation | Bloque |
|---|---|---|---|---|
| **O1** | **Confirmé le 2026-11-02 : Vercel refuse** (« Cannot deploy from a private GitHub organization repository on the Hobby plan »). La version en ligne continue de tourner, mais plus aucun déploiement n'est possible | | Transférer le dépôt vers le compte personnel `CamargAqua`, ou passer Vercel en Pro | tout déploiement |
| **O2** | Réécrire l'historique git ? | Le passage en privé ne couvre pas ce qui a déjà été copié ou mis en cache. Une réécriture change tous les identifiants de commits, c'est irréversible sans sauvegarde | Oui **après** sauvegarde et inventaire validé, sur les seuls fichiers de données (procédure A2). Avec 0 fork, le gain est modéré ; indispensable si le dépôt redevient public un jour | A2 |
| **O3** | Combien de temps garder une correction ou une suppression ? | Utile à l'apprentissage, contraire au droit à l'effacement si c'est sans limite | Conserver les anciennes valeurs 90 jours, purge automatique, jamais de texte libre | B4 |
| **O4** | Protéger l'algorithme lors de l'ouverture ? | Voir section 0 | Ne rien faire maintenant. Le moteur reste déplaçable côté serveur sans réécriture | H2, pas avant |
| **O5** | Budget de relecture et de conseil juridique | Conditionne K et H2 | Le chiffrer au moment de K5 | K5, H2 |

---

## 3. Règles qui s'appliquent à toutes les phases

1. **Aucune modification UI/UX.** Une correction de calcul peut changer un chiffre ou faire disparaître une observation : elle passe par un avant / après présenté à Victor.
2. **Règle d'activation, absolue.** Aucun modèle n'entre en production sans gain mesurable sur des données non utilisées pour son apprentissage ni pour son réglage :
   - **Rejeu chronologique** : on ne prédit qu'avec le passé.
   - **Période finale gelée** : les 20 derniers % de l'historique, au moins 2 semaines, fixées avant tout réglage et ouvertes une seule fois par génération de modèles.
   - **Gain** : erreur médiane ≥ 10 % plus faible que la meilleure référence, sur données réelles, avec un intervalle à 90 % (bootstrap par blocs de jours) qui exclut zéro.
   - **Calibration** : couverture à ± 5 points de la cible, fenêtre au plus 25 % plus large que la référence.
   - **Sur plusieurs bébés dès que possible** : un gain sur un seul bébé autorise l'activation pour lui, avec repli ; il ne prouve rien en général.
3. **Sécurité d'exécution par bébé.** En production, chaque bébé utilise le modèle retenu seulement s'il bat la référence sur son propre passé récent ; sinon repli sur le calcul simple. Le moteur ne s'impose jamais à un bébé pour lequel il marche mal.
4. **Synthétique = mécanique.** Les données synthétiques prouvent que le code fonctionne, jamais qu'un modèle est performant. Tout rapport les sépare et les étiquette.
5. **Rien ne se perd.** Prévisions et habitudes actuelles conservées, repli permanent sur le calcul existant.
6. **Abstention légitime.** Aucun résultat sans fiabilité ; « je ne sais pas » est un résultat.
7. **Repas.** Toujours descriptif et probabiliste, jamais une consigne, jamais de retard ni de restriction. Contrôle automatique.
8. **Pas d'infrastructure spéculative**, mais pas d'hypothèse bloquante non plus (phase C2).

### Niveaux de preuve

Chaque livrable porte l'un de ces niveaux. **Aucune confusion n'est admise entre eux.**

| Niveau | Ce qu'il permet d'affirmer | Disponible |
|---|---|---|
| **R0** Réel actuel (≈ 3 jours, 1 bébé) | Le code tourne sur de vraies données ; cas particuliers, qualité de saisie. **Aucune performance** | Oui |
| **T** Synthétique | Exactitude du code, absence de fuite du futur, robustesse aux trous, retour à l'a priori. **Aucune performance** | Oui |
| **R1** Semaines (≈ 3 à 4, 1 bébé) | Couverture réelle des fenêtres actuelles, étude de cas | Non, plus tôt avec D5 |
| **R2** Mois (≈ 6 à 8 semaines et plus, 1 bébé) | Comparaison de modèles sur ce bébé, ruptures réelles, évolution. Étude de cas, pas une généralisation | Non |
| **P** Plusieurs bébés | Performance par âge, généralisation, effet de l'âge, modèle hiérarchique, a priori appris | Non, exige H2 |
| **E** Validation externe | Justesse scientifique, relecture, conformité | Non |

Ces durées sont des estimations, recalculées en B5 selon la variabilité observée.

---

## 4. Plan détaillé

Pour chaque sous-phase : **Travaux → Livrable → Validation → Risques → Prérequis → Niveau.**

### Phase A : Assainissement et sécurisation

**A1. Inventaire précis**
- **Travaux :** liste exhaustive, fichier et commit, de toute donnée réelle ou identifiante dans le dépôt et son historique, images comprises. Lecture seule.
- **Livrable :** tableau d'inventaire classé par sensibilité, complétant la section 0.
- **Validation :** chaque élément est classé garder / déplacer / remplacer, et toi tu l'approuves.
- **Risques :** oubli dans une maquette. Parade : recherche par dates et motifs sur tout l'historique.
- **Prérequis :** aucun. **Niveau :** R0.

**A2. Procédure de sécurisation (rien n'est supprimé sans accord élément par élément)**
- **Travaux :** dans l'ordre : (1) D1, dépôt privé ; (2) sauvegarde chiffrée du dépôt complet (`git bundle`) et export JSON de la base, hors du dépôt, restauration testée ; (3) `data/` ignoré ; (4) fichier réel remplacé par un synthétique de même forme, test d'import vert ; journal réel des maquettes remplacé ; (5) mention `privé` corrigée dans `CLAUDE.md` ; (6) si O2 accepté : réécriture ciblée, vérification, puis invalidation des anciennes copies chez GitHub.
- **Livrable :** journal des opérations, sauvegarde vérifiée.
- **Validation :** une recherche sur tout l'historique ne retrouve plus les données ciblées ; 77 tests verts ; la production est inchangée.
- **Risques :** déploiement cassé (O1), perte en cas de réécriture : d'où sauvegarde, puis restauration testée avant.
- **Prérequis :** D1, O1, O2. **Niveau :** R0.
- **Note :** l'étape 4 touche un fichier de test sous `web/` : elle attend ton feu vert.

**A3. Vérifications de sécurité de l'app actuelle**
- **Travaux :** région Supabase, longueur du code famille face à une adresse publique, limitation des tentatives, règles RLS, sauvegardes de la base, photo du bébé en clair en base. Rapport seulement.
- **Livrable :** liste d'écarts classés.
- **Validation :** chaque point a un statut vérifié.
- **Risques :** l'accès au tableau de bord est le tien : je te fournirai la liste à cocher.
- **Prérequis :** ton accès Supabase. **Niveau :** R0.

**A4. Cadrage juridique préliminaire**
- **Travaux :** liste des questions pour un juriste (données de santé, art. 9 RGPD, HDS, AIPD, dispositif médical, enfants), registre de traitement. Aucune conclusion de ma part.
- **Livrable :** note de questions.
- **Validation :** prête à être remise à un juriste.
- **Risques :** faux sentiment de conformité. **Prérequis :** aucun. **Niveau :** E.

**Porte GA :** dépôt privé, sauvegarde testée, inventaire traité.

### Phase B : Mesurer l'existant

**B1. Photographie du moteur actuel**
- **Travaux :** inventaire de toutes les sorties de `renderVals` et de leurs lecteurs ; sorties figées sur 6 à 10 journaux synthétiques (régulier, irrégulier, troué, nuit courte, nouveau-né) ; registre des défauts. Aucune correction.
- **Livrable :** tests de caractérisation, registre.
- **Validation :** chaque calcul est couvert ; aucun fichier `legacy` modifié.
- **Risques :** figer un bug : il est consigné, pas maquillé. **Prérequis :** GA. **Niveau :** T.

**B2. Socle `web/src/engine/`**
- **Travaux :** types, version, entrée indépendante de la vue, `now` et `ageDays` passés en paramètres. Dossiers créés quand ils reçoivent un fichier.
- **Livrable :** module vide de logique métier, test interdisant `react`, `@supabase`, `legacy`.
- **Validation :** `tsc` strict sans `any`, build inchangé.
- **Risques :** surarchitecture. **Prérequis :** B1. **Niveau :** T.

**B3. Seuils centralisés**
- **Travaux :** inventaire complet, `config.ts` (valeur, unité, justification, statut jugement / mesuré / sourcé, dépend de l'âge). Contradictions notées, résolues en D1.
- **Livrable :** registre de seuils.
- **Validation :** tous présents ; aucun seuil métier hors `config.ts`.
- **Risques :** fausse rigueur : « jugement » reste écrit. **Prérequis :** B1, B2. **Niveau :** T.

**B4. Qualité et traçabilité**
- **Travaux :** doublons, chevauchements, durées impossibles, dodos non fermés, trous, score par jour et par nuit, précision estimée par `created_at`, heure d'été, fuseau ; migration additive `0002` : `source`, journal des révisions par trigger ; accès du moteur à tout l'historique.
- **Livrable :** module `quality/`, migration testée.
- **Validation :** absence de saisie jamais comptée en zéro ; migration rejouée hors production.
- **Risques :** migration sur la vraie base. **Prérequis :** B2, D3, O3. **Niveau :** T + R0.

**B5. Banc de backtest**
- **Travaux :** générateur synthétique, rejeu avec coupure à ce qui était déjà saisi, références (médiane, dernier intervalle, **calcul actuel `wins`**), métriques (erreur moyenne et médiane, couverture, largeur, score d'intervalle, calibration), rapports par âge, quantité de données, mode de saisie, après rupture ; estimation chiffrée de la durée d'observation requise.
- **Livrable :** commande locale, premier rapport.
- **Validation :** test de non-fuite du futur ; deux exécutions identiques.
- **Risques :** conclure sur du synthétique (règle 4). **Prérequis :** B2, B4 pour la qualité. **Niveau :** T, puis R1.

**Porte G1 :** le calcul actuel a son score mesuré, même provisoire, et l'écran n'a pas changé.

### Phase C : Extraction et architecture

**C1. Extraction à parité**
- **Travaux :** `SL`, `nightOf`, `dayOf`, `typ`, `usual`, `wins`, `habitOf`, `stat`, `lkEval`, dans cet ordre ; double calcul sur tous les journaux ; bascule groupe par groupe via `patches.mjs`.
- **Livrable :** modules `sleep/`, `habits/`, `predictions/`, repli intact.
- **Validation :** **parité 100 %** ou écart expliqué ; tests, e2e, fidélité identiques.
- **Risques :** dépendances cachées dans les fermetures de `renderVals`. **Prérequis :** B1 à B3. **Niveau :** T.

**C2. Anticipations d'architecture, sans infrastructure**
- **Travaux :** `babyId` dans chaque entrée et résultat, aucun état global ; moteur sérialisable et déterministe : même événements + même `now` = même résultat, sur les deux téléphones ou sur un serveur ; aucun appel réseau dans le moteur ; lecture des données derrière une interface déjà existante (`Repo`) ; versions de modèle dans chaque résultat.
- **Livrable :** tests de déterminisme, note d'architecture.
- **Validation :** le moteur tourne à l'identique en Node et en navigateur.
- **Risques :** dériver vers de l'infrastructure : **pas** de `household_id`, de file de calcul ni de service à ce stade. **Prérequis :** B2. **Niveau :** T.

**C3. Modes d'alimentation**
- **Travaux :** déduction par fenêtre, quantités valides ou `null`, lait facultatif, tirages non supposés bus.
- **Livrable :** `feeding/`.
- **Validation :** aucun total sur 24 h dès qu'une tétée existe ; une tétée n'apporte jamais de mL.
- **Risques :** tétées non notées → « indéterminé ». **Prérequis :** B2, D4. **Niveau :** T + R0.

**Porte G2 :** parité prouvée, chaque bascule accordée.

### Phase D : Fiabilisation

**D1. Définitions temporelles et seuils**
- **Travaux :** une seule définition de jour et de nuit, remplacer les bornes fixes par des bornes relatives au bébé, cas « nuit finie avant 5 h 30 », coupure à 50 min, jour de changement d'heure.
- **Livrable :** définitions écrites, avant / après par écran concerné.
- **Validation :** mieux ou égal au backtest ; écarts présentés.
- **Risques :** un chiffre affiché change : accord à chaque fois. **Prérequis :** G2. **Niveau :** T, R0.

**D2. L'âge, variable centrale mais pas norme**
- **Travaux :** `ageDays` obligatoire ; évolution suivie en continu ; seuils relatifs au bébé ; connaissance de tranche d'âge combinée à ses observations **seulement** via des références validées (GK). D'ici là, a priori volontairement peu informatifs et sans chiffre importé. L'observation du bébé pèse de plus en plus à mesure qu'elle s'accumule.
- **Livrable :** paramètre d'âge dans tous les modèles, journaux à 2, 8, 16, 26 semaines.
- **Validation :** comportement correct à chaque âge synthétique.
- **Risques :** **sur un seul bébé, l'âge et le temps qui passe sont la même variable** : on suit une tendance, l'effet propre de l'âge exige le niveau P. **Prérequis :** G2. **Niveau :** T, puis R2, puis P.

**D3. Données manquantes**
- **Travaux :** règles par indicateur (exclure, élargir, s'abstenir), distinction rupture / arrêt de saisie, test avec trous injectés.
- **Livrable :** politique écrite et testée.
- **Validation :** jamais d'invention ; la fenêtre s'élargit ou le moteur s'abstient.
- **Risques :** abstention trop fréquente : taux suivi. **Prérequis :** B4. **Niveau :** T.

**D4. Correction de `lkEval`**
- **Travaux :** d'abord **mesurer** son taux de faux liens sur journaux sans lien ; puis remplacer : facteurs et issues déclarés à l'avance ; effet avec intervalle ; **permutation par blocs** pour respecter la répétition des observations ; contrôle du taux de fausses découvertes sur toutes les comparaisons, y compris celles d'Explorer ; **facteurs confondants** : tendance et âge retirés, stratification (jour de semaine, nombre de siestes, qualité des données) ; taille minimale fixée par puissance.
- **Livrable :** moteur d'association, rapport avant / après.
- **Validation :** taux de faux liens ≤ 10 % sur synthétique sans lien ; lien injecté retrouvé ; aucun jour non mesuré ; aucun gabarit causal.
- **Risques :** peu de nuits, donc peu de liens affichés : c'est le prix de l'honnêteté. Un confondant non noté reste invisible : un lien reste une association. **Prérequis :** B5, C1. **Niveau :** T ; les liens réels à partir de R2.

**D5. Incertitude et abstention**
- **Travaux :** raisons codées ; fiabilité = couverture mesurée si elle existe, sinon « non mesurée ». `lvOf` reste tant qu'il n'y a pas mieux.
- **Livrable :** politique par résultat.
- **Validation :** **G3**.
- **Prérequis :** B5. **Niveau :** T, puis R1.

**Porte G3 :** définitions uniques, âge intégré, faux liens maîtrisés, abstention en place.

### Phase E : Modélisation

Chaque approche passe par le banc de la section 5. Le code peut être prêt avant les données ; **aucune conclusion ni activation avant R2.**

| Sous-phase | Sujet | Travaux | Livrable |
|---|---|---|---|
| **E1** | Références renforcées | quantiles pondérés dans le temps, temps d'éveil conditionnel | référence à battre |
| **E2** | Survie | temps d'éveil, heure, sommeil cumulé, âge | prochain dodo, durée restante |
| **E3** | États latents | Kalman sur grandeurs lentes, modèle semi-markovien à états | profil évolutif |
| **E4** | Ruptures | CUSUM contre BOCPD robuste | statuts stable, tendance, ponctuel, rupture, insuffisant |
| **E5** | Repas | renouvellement et survie, par moment de la journée et mode d'alimentation, regroupement des tétées rapprochées | fenêtre descriptive |
| **E6** | Bayésien adapté | a priori conjugués par bébé (Gamma, Normale-Gamma inverse) dès peu de données | a posteriori et abstention naturelle |
| **E7** | Calibration et arbitre | calibration conforme adaptative, choix par bébé | fenêtres finales avec repli |
| **E8** | Registre | version, rapport, décision, retour arrière | journal des modèles |

- **Validation :** règle 2, par cible. **G4** par modèle, pas en bloc.
- **Risques :** surapprentissage sur peu de jours (gel de la période finale, modèles parcimonieux) ; surinterprétation physiologique ; coût de calcul sur téléphone (< 100 ms par mise à jour) ; repas lu comme consigne (règle 7).
- **Prérequis :** G2, B5, D3 ; R2 pour conclure.
- **Niveaux :** T immédiatement, R2 pour décider, P pour généraliser.

### Phase F : Analyse transversale

| Sous-phase | Sujet | Livrable |
|---|---|---|
| **F1** | Éveil, sieste suivante, dernière sieste, coucher, réveils | relations validées par D4 |
| **F2** | Prises alimentaires : répartition, volumes au biberon, lait maternel ou infantile, tirages, évolution | relations, jamais de volume pour une tétée |
| **F3** | Couches, selles, rituels et observations notés | relations seulement si la donnée est structurée et assez fréquente |
| **F4** | Types de journées | groupes interprétables, évolution sur semaines |
| **F5** | Séquences | encodage de la journée, motifs comparés à un hasard simulé, Markov d'ordre faible |
| **F6** | Évolution longue | habitudes qui changent, sur plusieurs semaines |

- **Validation :** **G5** : chaque résultat passe D4 ; F5 doit apporter plus que F1 à F4, sinon abandon.
- **Risques :** faible puissance, données parentales libres peu exploitables, notes de la maman **jamais** utilisées.
- **Prérequis :** D4, C3 ; R2 pour tout résultat réel. Modèles mixtes : P.

### Phase G : Contrat de résultats

- **G.1 `analyze()`** : habitudes, prévisions, évolutions, associations, comparaisons, fiabilité, faits, références, limites. Codes et paramètres, pas de texte, pas de genre.
- **G.2 Sécurité** : test de vocabulaire, natures imposées par les types, phrase piégée refusée, relevé informatif des textes actuels.
- **G.3 Documentation** : statuts d'INTELLIGENCE alignés sur le code à chaque phase.
- **Livrable :** contrat versionné, gabarits contrôlés, sans aucun branchement.
- **Validation :** **G6** : résultat déterministe et sérialisable, performant sur 6 mois d'historique, vocabulaire vert.
- **Risques :** figer trop tôt → contrat versionné ; la liste de mots ne voit pas tout → relecture humaine.
- **Prérequis :** squelette dès B2, version complète après les moteurs activés. **Niveau :** T.

### Phase K : Base scientifique (en parallèle)

Base **restreinte et fiable** : quatre indicateurs en V1 au plus. Moins, si les sources ne tiennent pas.

| Sous-phase | Travaux | Livrable | Validation |
|---|---|---|---|
| **K1** | Lecture intégrale, sources françaises, licences | fiches de sources | éditeur, année, population, âges, méthode, limites, droits, retenue ou écartée avec motif |
| **K2** | Indicateurs, tranches, niveaux de confiance | dictionnaire | définitions non ambiguës |
| **K3** | Extraction, double lecture | entrées au statut `brouillon` | aucune valeur sans source |
| **K4** | Format, schéma, validateur, `getReference(indicator, ageInDays)` | module en lecture seule | `null` sans référence ; seul le statut `publié` est rendu |
| **K5** | Relecture (annexe B) | statut `relu`, journal | **GK**, signée par version |
| **K6** | Branchement au moteur, un indicateur à la fois | résultats avec références | moteur inchangé quand une valeur change |
| **K7** | Cas représentatifs | jeu de cas | relecture, abstention correcte |

- **Risques :** sources divergentes, moyenne lue comme norme, volume sans poids (donc `null` probable), droits de reproduction.
- **Prérequis :** aucun jusqu'à K4 ; D7 pour K5 ; G6 pour K6. `AGE_REFS` reste à `false`, un affichage sera une décision séparée. **Niveau :** E.

### Phase H : Plus tard, anticipé mais non développé

**H1. Modèles lourds.** Expérience hors app (Chronos-2, TimesFM), seulement si E plafonne. Mêmes règles. Licences à vérifier. Pronostic faible sur ces volumes.

**H2. Ouverture à plusieurs familles.** Aucune date. Quatre conditions, toutes requises :
1. **Confidentialité et sécurité traitées** : audit, secrets, sauvegardes, effacement.
2. **Architecture multi-familles prête** : foyers, comptes par parent, rôles, synchronisation.
3. **Isolation stricte** : RLS par foyer, tests automatiques de non-fuite entre foyers.
4. **Obligations juridiques vérifiées** : juriste, RGPD, HDS, AIPD, statut hors dispositif médical.

**H3. Apprentissage collectif.** Consentement explicite et révocable, données anonymisées ou agrégées, bayésien hiérarchique et modèles mixtes, calculs serveur si nécessaires. Mesuré sur des bébés absents de l'apprentissage. Prérequis : H2.

---

## 5. Banc de comparaison des modèles

| Famille | Candidats | Cibles | Utile à partir de | Pronostic |
|---|---|---|---|---|
| **Références** | calcul actuel, médiane glissante, dernier intervalle | toutes | R1 | à battre |
| **Pondérée** | quantiles à oubli exponentiel, conditionnés au temps d'éveil | dodo, repas | R1 | gain probable, coût minime |
| **Survie** | temps discret avec S + C réduit | prochain dodo, durée | R2 | **le plus prometteur** : utilise temps d'éveil et heure, ce qui manque aujourd'hui |
| **Renouvellement** | intervalle Gamma modulé par l'heure | repas | R2 | adapté au biberon, plus fragile pour l'allaitement à la demande |
| **États latents** | Kalman local | grandeurs lentes | R1-R2 | utile et léger |
| **États latents** | semi-markovien caché | enchaînements | R2+ | à prouver, plus de paramètres |
| **Ruptures** | CUSUM, BOCPD robuste | habitudes | R2 | utile, peu de vraies ruptures à observer sur un bébé |
| **Séquences** | motifs fréquents, Markov | enchaînements | R2+ | descriptif surtout |
| **Bayésien adapté** | a priori conjugués par bébé | toutes | T, R1 | bon sur peu de données |
| **Bayésien hiérarchique** | partage entre bébés | toutes | **P** | potentiellement le plus fort, impossible aujourd'hui |
| **Modèles lourds** | Chronos-2, TimesFM | séries | R2+, P | faible |

Pronostics = hypothèses, pas des résultats. On retient seulement ce qui passe la règle 2.

---

## 6. Dépendances

```
A1 → A2 → (GA) → B1 → B2 → B3
                      B2 → B4 → B5 → (G1)
                      B1,B3 → C1 → (G2) ; B2 → C2, C3
G2 → D1, D2 ; B4 → D3 ; B5,C1 → D4 ; B5 → D5 → (G3)
G3,B5 → E1 → E2,E3,E4,E5,E6 → E7 → E8 → (G4, par modèle, exige R2)
D4,C3 → F1…F4 → F5, F6 → (G5, exige R2)
B2 (squelette) ; moteurs activés → G.1 → G.2 → (G6)
K1 → K2 → K3 → K4 → K5 (D7) → (GK) ; G6,GK → K6 → K7
H : hors séquence, décisions propres
```

- **En parallèle :** A3, A4 et K1 à K3 dès maintenant ; B3 et B4 ; C2 et C3 avec C1 ; D1, D2, D3 ; E2 à E6 entre elles si fichiers distincts.
- **Doivent attendre :** tout développement attend ton feu vert ; B attend GA, sinon le moteur se construit en public ; E7 attend E2 à E6 ; toute activation attend R2 ; K6 attend G6 et GK.

---

## 7. Développable maintenant ou non

| Catégorie | Contenu |
|---|---|
| **Immédiat, sans données nouvelles** (après feu vert) | A, B1 à B4, B5 (banc), C, D1, D3, D4 (méthode), D5, code des modèles E et F testé en T, G, K1 à K4 |
| **Validable sur R0** | Bon fonctionnement sur vraies données, qualité de saisie, cas limites réels. Rien sur la performance |
| **Testable seulement en synthétique** | Exactitude, non-fuite, robustesse, faux liens par construction |
| **Plusieurs semaines (R1)** | Couverture réelle de `wins`, première calibration des fenêtres, gains simples en étude de cas |
| **Plusieurs mois (R2)** | Sélection et activation des modèles, ruptures, liens réels, évolution avec l'âge pour ce bébé |
| **Plusieurs bébés (P)** | Performance par âge, généralisation, effet propre de l'âge, modèles mixtes, hiérarchique, modèle pré-entraîné |
| **Validation externe (E)** | Relecture des références, statut juridique, HDS, sens physiologique du modèle |

L'export de l'ancienne app, s'il arrive, ferait gagner R1 voire R2 : ses données seraient contrôlées en B4 (qualité, précision horaire), sans rien bloquer d'ici là.

---

## 8. Traçabilité

| Demande | Où |
|---|---|
| Sécuriser sans rien supprimer d'inidentifié | section 0, A1, A2 |
| Mesurer avant d'améliorer | B5, G1 |
| Extraction progressive, parité | C1 |
| Âge, seuils, définitions, manquants, faux liens | D1 à D5 |
| Plusieurs approches, retenues sur preuve | section 5, E, règle 2 |
| Modèles probabilistes, survie, Kalman, états latents, régimes, séquences, bayésien | E2 à E7, F5 |
| Données hors apprentissage | règle 2 |
| Réel, synthétique, semaines, plusieurs bébés | niveaux de preuve, section 7 |
| Âge + connaissances + observations ; récent ; ponctuel ou durable | D2, E1, E3, E4 |
| `lkEval` : taille, comparaisons multiples, confondants, répétition | D4 |
| Repas descriptifs et probabilistes | E5, règle 7, G.2 |
| Local, sans enfermement, milliers de familles, deux parents | C2, H2, H3 |
| Base restreinte, métadonnées, relecture | K, annexe B |
| Profil de relecteur, processus | D7, annexe B |
| Conditions d'ouverture | H2 |
| Contrat structuré, sans UI ni chatbot | G.1 |
| Vocabulaire interdit, pas d'avis médical | G.2, INTELLIGENCE 12 |
| Habitudes conservées, fiche par indicateur | C1, annexe A |
| Chronos-2, TimesFM | H1 |

---

## Annexe A : dictionnaire d'indicateurs (départ, complété en C1)

| Indicateur | Définition | Minimum actuel | Évaluation | Abstention |
|---|---|---|---|---|
| Réveil habituel | médiane du dernier réveil de nuit | 3 jours complets | erreur sur le jour suivant | moins de 3 jours |
| Coucher habituel | médiane du début de nuit | 3 jours | idem | idem |
| Nombre de siestes | médiane, min, max | 3 jours | stabilité | idem |
| Sieste de rang k | médiane de début et de durée, plage | 2 jours présents | couverture | rang absent |
| Nuit habituelle | blocs médians | 4 nuits | erreur sur la nuit suivante | moins de 4 |
| Durée d'éveil | du réveil au dodo suivant, nuit exclue | ≥ 2 éveils, fragile sous 3 jours | erreur sur l'éveil suivant | < 2 |
| Période de nuit (« cycle » actuel) | sommeil noté / nombre de périodes | 4 nuits | stabilité | jamais appelée cycle biologique |
| Plus long sommeil | bloc le plus long | 3 nuits | stabilité | nuit partielle |
| Sommeil sur 24 h | somme notée, jour complet | 3 jours | stabilité | jour incomplet |
| Intervalle entre repas | médiane, ≤ 6 h | 3 jours | erreur sur le suivant | trou de saisie |
| Repas qui reviennent | groupes < 40 min présents 1 jour sur 2 | 3 jours | couverture | aucun groupe |
| Lait au biberon | somme des mL | 3 jours | stabilité | jamais un total si tétée |
| Stabilité | dispersion robuste | à fixer | | insuffisant |

Ces minimums sont ceux du code actuel : à évaluer, pas à considérer comme justes.

## Annexe B : processus de relecture des références

1. **Préparation :** chaque entrée est présentée avec sa source, sa population, ses âges, sa méthode, ses limites, le texte d'usage prévu et l'extrait d'origine.
2. **Relecture indépendante** par domaine (annexe de la décision D7). Trois verdicts par entrée : accepté, accepté avec réserve écrite, refusé. Le relecteur juge aussi l'usage prévu, pas seulement le chiffre.
3. **Traçabilité :** nom, qualité, date, version de la base, liens d'intérêt déclarés.
4. **Publication :** seules les entrées acceptées passent au statut `publié`. Une entrée refusée ne revient pas sans source nouvelle.
5. **Maintenance :** revue annuelle et à chaque nouvelle recommandation officielle ; une valeur modifiée repasse en relecture.
6. **Limite :** la relecture valide une information générale, elle n'est ni un avis médical individuel ni une certification de l'application.
