# Intelligence V2 — état des lieux (Phase 0), 2026-11-04

Statut : audit du code et vérification partielle des sources. **Aucun code modifié.** 234 tests verts (`npm test`, relancé aujourd'hui). Backtest non relancé : dernier rapport `data/rapports/backtest-dernier.md` (moteur 0.6.3).

## 1. Écart entre le brief et le dépôt
Le brief suppose un moteur à auditer puis à construire. Les phases B à K existent déjà (voir CLAUDE.md). Chemins du brief inexistants : `predictions/survival.ts` (la survie est dans `predictions/models.ts`), `predictions/nextFeed.ts` (c'est `feeding/nextFeed.ts`). Le backtest, la règle d'activation, la base de références et le contrat `analyze()` sont déjà là.

## 2. Moteur : ce qui est vrai dans le code
| Sujet | Constat vérifié |
|---|---|
| Âge | `ageInDays` est calculé et mis dans `habitsModel` / `analyze`. **Aucun calcul ne l'utilise.** `viewNextSleep` appelle même `survivalModel({ birthAt: null … })`. 45 des 103 seuils sont marqués `ageDependent: true` dans `config.ts`, tous fixes. |
| Statut des seuils | 85 « jugement », 11 « cas-reel », 7 « demande », **0 « mesure », 0 « source »**. Aucun seuil n'est justifié par un résultat ou une publication. |
| Fenêtre de dodo en production | `wins` (`sleepWindows.ts`) = créneaux habituels par rang de sieste, **indifférent au dernier réveil** (limite écrite dans le fichier). Le modèle de survie est lui branché en production (`bridge.ts`, jour seulement) par décision de Victor, avec une largeur plancher de 2 × 15 min. |
| Survie | Régression logistique à temps discret (pas 15 min), variables : durée d'éveil (+ carré), heure du jour (2 harmoniques), sommeil des 24 h, durée de la dernière sieste. Ridge fixe, 150 itérations, apprise sur 14 jours (≥ 8 éveils). Pas d'âge, pas de repas. |
| Validation de la survie | Réel : **6 décisions sur 3 jours** (couverture 83 %, largeur 86 min). Verdict de la règle : `not_enough_data`. La règle « aucun modèle sans gain mesuré » n'est donc pas satisfaite ; le modèle tourne sur décision explicite. |
| Calibration | La calibration conforme existe dans le backtest. **Elle n'est pas appliquée en production** : la couverture réelle de la fenêtre affichée n'est pas mesurée (`coverage_not_measured`). |
| Repas | `nextFeedWindow` (quantiles pondérés des écarts) existe dans `analyze()`. **Aucun écran ne l'affiche.** Sommeil et repas ne sont reliés dans aucun modèle de prédiction (seulement dans des habitudes d'éveil et des liens). |
| Associations | Permutations par blocs + FDR 0,1, tautologies écartées, étiquetées « hypothèse / association_not_cause ». Seuil `assocMinNights` = 14. Point solide. |
| Changements | `classifySeries` (stable / tendance / ponctuel / rupture / insuffisant), CUSUM et BOCPD présents. Seul `classifySeries` est branché à l'écran (Comprendre). |
| Complétude | `coverage()` ne compte que le sommeil (jours et nuits complets). Pas de complétude propre à l'alimentation dans ce module ; `quality/index.ts` détecte doublons, durées suspectes, saisies tardives, sans score par domaine. À auditer en Phase 2. |
| Jour / nuit | Quatre bornes contradictoires, notées dans `config.ts` : 19 h (défaut de nuit), 18 h 30 (repas puis sieste), 19 h 30 (sieste), 21 h (Résumé). Connu, non corrigé. |
| Données manquantes | Politique écrite (« un manque n'est jamais un zéro »), appliquée à la complétude des jours. Exception à examiner : `nightFeedCutoff` (nuit absente = repas comptés jusqu'à 8 h). Non vérifié ligne à ligne. |
| Réinjection | Aucune prévision n'est réinjectée comme observation (vérifié dans `models.ts`, `backtest.ts`). |

## 3. Backtest : ce qu'il fait et ne fait pas
Fait : rejeu chronologique avec `visibleAt` (un événement n'existe qu'à partir de `enteredAt`, une fin qu'à partir de `endKnownAt`), donc pas de fuite temporelle de saisie ; gel de 20 % final (≥ 14 jours) ; gain apparié avec bootstrap par jours ; couverture, erreur médiane, largeur, score d'intervalle de Winkler ; 8 scénarios synthétiques (niveau T, jamais une preuve) ; 1 bébé réel (R0).
Ne fait pas : Brier / log loss / courbes de calibration (la survie produit un hasard, jamais évalué comme probabilité) ; précision / rappel / délai des détections de rupture ; découpage par âge ; découpage par quantité d'historique ; robustesse à des journaux troués (seulement le scénario « troué ») ; séparation par bébé (un seul bébé réel). **Conclusion : aucune conclusion de performance n'est possible aujourd'hui sur données réelles.**

## 4. Flux moteur → écran
- `household.tsx` injecte `viewEngine` (`bridge.ts`) dans la logique de l'écran (`app.logic.generated.js` : `calendar` l.247, `links` l.471, `nextSleep` l.707) : nuits, journées, liens, prochain dodo.
- Comprendre (natif) appelle `habitsModel` directement (`comprendre/model.ts`).
- **Non exposé à l'écran** : `analyze()` entier, prévision de repas, mode d'alimentation, qualité des données, types de journées, motifs, références (`getReference` rend `null`).

## 5. Sources scientifiques vérifiées aujourd'hui (consultées en ligne)
| Source | Faits vérifiés | Accès aux données | Confiance / pertinence |
|---|---|---|---|
| Paavonen & de Bie, *Sleep Medicine* 149:109276 (2027), DOI 10.1016/j.sleep.2026.109276, PMID 42874417, CC BY | 175 593 nourrissons, 10,7 M de jours, application **Napper**, 3–18 mois, journal parental en temps réel. Sommeil total 14,8 h (3 mois) → 12,5 h (18 mois) ; siestes 3,9 → 1,0/jour ; régularité du coucher stable d'un âge à l'autre (r de Spearman 0,73–0,77). Limites écrites : rapporté par les parents, biais d'usagers (Allemagne 34 %, Europe), pas de données d'alimentation, **pas de données fiables sur les réveils de nuit**, utilisateurs payants exposés à un horaire recommandé. **Lien d'intérêt : de Bie est employée de Napper AB.** | Déclaration de disponibilité des données : non trouvée dans le texte. **À vérifier auprès des auteurs.** Utilisable aujourd'hui : statistiques publiées seulement. | Moyenne. **Commence à 3 mois** : ne pas extrapoler aux nouveau-nés. |
| Webb, Phillips, Roberts, *PLOS Comput Biol* 20(10):e1012541 (2024), DOI 10.1371/journal.pcbi.1012541 | Modèle physiologique (homéostat + horloge). **4 nourrissons seulement**, 2 jours à 548 jours, 3 journaux + 1 actigraphie. Pression de sommeil qui monte et redescend plus vite, rythme circadien plus faible tôt. Limites : alimentation et interventions parentales absentes, identifiabilité des paramètres. | Code MATLAB et séries des 4 bébés sur GitHub `brain-modelling-group/infant-sleep-trajectory`. | Bonne pour la structure du modèle, **inutilisable comme norme ou pour entraîner**. |
| Liu & Benjamin-Neelon, *Sleep* 46(11):zsad160 (2023), DOI 10.1093/sleep/zsad160, PMID 37279933 | 477 nourrissons (étude Nurture, États-Unis), 3/6/9/12 mois, journal vs accéléromètre sur 4 jours. L'accéléromètre donne ≈ 2 h de sommeil diurne en moins, ≈ 1 sieste en moins, plus de 3 fois plus d'éveils nocturnes (20 min plus courts). Pas de polysomnographie. | Non vérifié. | Bonne. **Preuve que journal parental et actigraphie ne se mélangent pas.** |
| Paavonen et al., *Sleep Medicine* 69 (2020), DOI 10.1016/j.sleep.2020.01.009, PMID 32087408 | Deux cohortes de naissance finlandaises : CHILD-SLEEP (1 427 à 3 mois, 950 à 24 mois) et FinnBrain (2 002 à 6 mois, 1 693 à 12 mois). Questionnaires parentaux (BISQ). Valeurs de référence 3–24 mois ; variabilité forte, qui diminue vers 2 ans. Vérifié (résumé). | Non vérifié. | Bonne pour le contexte ; questionnaires, pas journaux. Commence à 3 mois. |
| Dias, Figueiredo, Rocha, Field, *J Sleep Res* 27(5):e12654 (2018), DOI 10.1111/jsr.12654, PMID 29356197 | Revue systématique PRISMA, 74 articles, 0–12 mois. Sommeil sur 24 h et sommeil diurne en baisse ; réveils nocturnes en baisse et plus longue période de nuit en hausse surtout avant 6 mois. **Forte discordance entre études sur les valeurs, meilleur accord sur les changements.** Vérifié (résumé). **Corrige mon erreur : ce n'est pas « Galland 2018 ».** | Statistiques publiées. | Bonne : à utiliser pour les *changements*, pas pour des valeurs normatives. |
| Galland et al., *Sleep Med Rev* (2012), PMID 21784676, revue systématique 0–12 ans | Titre vérifié ; contenu non lu. L'id `galland-2012` de la base est donc plausible. | Statistiques publiées. | À lire avant usage. |
| Borbély, *J Sleep Res* 31 (2022), PMID 35502706 : « The two-process model of sleep regulation: Beginnings and outlook » | Cadre : processus homéostatique S + processus circadien C. Pas une étude sur le nourrisson. L'adaptation à l'enfant vient de Webb 2024 (4 bébés) et d'un article de synthèse (PMC2980811, enfants plus âgés : pression de sommeil qui monte plus vite quand on est jeune, non quantifié ici). | n/a | Justifie la structure S + C de la survie ; ne fournit aucune valeur. |
| Alimentation et sommeil : Jafar 2021 (PMID 34582549), Manková 2023 (PMID 37572515), van Lee 2024 (PMC11874161), Frontiers/PMC13257929 | **Extraits seulement, aucun lu en entier.** Les extraits convergent sur un point : les nourrissons allaités se réveillent plus souvent la nuit, sans différence nette de sommeil total (Manková) ou avec un total plus long (Jafar) ; le type de lait infantile joue (van Lee). Résultats **discordants** selon les études. | Statistiques publiées. | Faible pour l'instant. **Aucun usage opérationnel**, et jamais de conseil sur les volumes. |
| Frontiers in Neuroscience 2025, revue exploratoire, 35 études, 0–6 mois | Journal et actigraphie agrégés. **Un auteur est affilié à Happiest Baby** (conflit d'intérêts possible). Détails non lus. | Statistiques publiées. | Faible tant que non lue. |

Base actuelle (`knowledge/data/base.json`) : 7 sources, 5 références, **toutes en brouillon**, sources lues en « résumé » ; `getReference` rend donc toujours `null`. **Aucune référence n'est utilisée par un calcul.** Aucune ne doit être annoncée comme intégrée.

**Non encore recherché** (annoncé dans le brief, pas fait) : modèle à deux processus de Borbély et adaptations infantiles ; alimentation et sommeil (allaitement, volumes) ; autres grandes cohortes (ALSPAC, Generation R, cohortes italiennes, etc.) ; revues sur la durée d'éveil.

## 6. Écarts avec l'ambition V2, par ordre d'impact
1. **Preuve** : un seul bébé, 3 jours. Aucun modèle ne peut être validé. Les données collectives consenties sont la seule voie vers une preuve, et elles n'existent pas.
2. **Âge** : jamais utilisé. Une référence d'âge sourcée (même large) donnerait un a priori à la survie et aux seuils, mais exige K5–K7 (textes lus, relecture professionnelle).
3. **Sommeil ↔ repas** : prévision de repas calculée mais non affichée ; pas de modèle commun.
4. **Évaluation** : ajouter Brier / log loss et courbes de calibration de la survie, précision / rappel des ruptures, découpages par âge et par historique, journaux troués simulés. Compatible avec les anciens rapports (colonnes ajoutées, rien retiré).
5. **Production** : le modèle de survie affiché n'a aucune couverture mesurée ; instrumenter (journaliser la fenêtre affichée et le dodo réel, sur l'appareil) pour obtenir la couverture réelle.
6. **Cohérence** : unifier les quatre bornes jour/nuit, auditer `nightFeedCutoff`, séparer la complétude sommeil / alimentation.
7. **Interface** : toute sortie sans point d'affichage existant reste « non exposée ». Rien n'est à changer à l'écran pour ces points.

## 7. Plan proposé (après validation)
- **Lot 1, sans risque pour la production** : métriques d'évaluation manquantes dans le backtest + tests ; complétude par domaine dans `coverage` ; journalisation locale des prévisions affichées.
- **Lot 2** : fiches de sources vérifiées dans la base (statut brouillon, lecture complète) ; recherche des sources non encore vues.
- **Lot 3** : unification des bornes jour/nuit, derrière `rules.ts` (LEGACY / CURRENT) avec parité testée.
- **Lot 4 (conditionné aux données)** : a priori d'âge dans la survie, uniquement si une référence passe la relecture et si le backtest réel montre un gain.
- **Ne pas faire maintenant** : collecte collective (consentement, gouvernance, hébergement non établis), modèle de langage (aucun besoin tant que `analyze()` n'a pas d'écran).

## 8. Lot 1 fait (moteur 0.7.0, 243 tests verts)
- `evaluation/diagnostics.ts` : Brier et log loss de la probabilité annoncée (80 %), calibration par largeur, strates d'historique et d'âge, journaux troués à dessein, étude de détection de rupture (rappel, précision, délai). Test unitaire à réponses calculées à la main.
- `quality/index.ts` : `domainCoverage` (jours notés par domaine sommeil / alimentation ; un jour sans note n'est pas un zéro). Pas encore branché à `analyze()`.
- `run.backtest.ts` : sections ajoutées sous chaque tableau existant ; les anciens tableaux sont inchangés. Ancien rapport conservé : `data/rapports/backtest-0.6.3.md`.
- Pas fait : journalisation des fenêtres affichées en production (touche la couche de données ; à décider).
- Âge : `survivalAgeModel` (survie + log de l'âge en semaines), candidate seulement, identique à la production sans date de naissance. Résultats synthétiques mélangés (Brier 0,182 contre 0,187 sur nouveauNé, plus mauvais ailleurs) et les journaux synthétiques ne contiennent aucun effet d'âge : **non démontré, non activé**. Sur le bébé réel : 1 jour de test, aucune conclusion.

## 9. Recherche complétée (2026-11-04)
Vérifié en ligne : Dias 2018 (74 articles), Paavonen 2020 (deux cohortes, questionnaires), Borbély 2022 (cadre). Lu seulement en résumé ou extrait : alimentation et sommeil (quatre études). **Aucune cohorte trouvée qui couvre 0–3 mois avec des journaux événementiels et des données individuelles accessibles.** Conséquence : un a priori d'âge sourcé n'est possible qu'à partir de 3 mois, en statistiques publiées, et avec une discordance entre études que la base doit porter (plage plutôt que valeur).
Reste à faire : lire en entier Dias 2018 et Paavonen 2020 (tables par âge), écrire aux auteurs de Paavonen & de Bie pour l'accès aux données, chercher les sources 0–3 mois (actigraphie, cohortes de naissance).
