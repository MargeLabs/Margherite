# Phase K : dossier de relecture des repères

> 2026-11-02. **Rien n'est validé.** Toutes les entrées sont en brouillon, `getReference` n'en rend aucune. Base : `web/src/engine/knowledge/data/base.json`. Processus : plan, annexe B.

## État des lectures

Aucun texte intégral n'a pu être lu ici : l'index ne donne que des résumés, PMC a refusé l'accès, le PDF de la HAS a expiré, l'adresse de l'article irlandais était fausse. **Les valeurs viennent de résumés ou d'extraits.**

| Source | Lu | À obtenir |
|---|---|---|
| NSF 2015 | résumé | texte complet : bornes d'âge |
| AASM 2016 | résumé d'une annonce du CDC | texte d'origine, gratuit sur PMC (PMC5078711) |
| Galland 2012 | résumé | texte complet : bornes de la catégorie nourrisson |
| Price 2014 | résumé | valeurs par âge, centiles |
| Paavonen 2026 | résumé | origine des données, conflits d'intérêts, plages |
| OMS allaitement | extrait | page à relire |
| HAS Allaitement | extrait | PDF, date, étude d'origine du chiffre de 8 tétées |
| O Sullivan 2023 (Irlande, 4 à 16 semaines) | titre | candidate prioritaire : seule source de centiles fins avant 4 mois |
| Iglowstein 2003 (Suisse) | résumé | candidate : percentiles par âge, sans valeur lue |
| Dias 2018 | résumé | candidate : revue sur les 12 premiers mois |

## Entrées en brouillon

Toutes pour le sommeil total sur 24 h.

| Entrée | Âge | Plage | Nature | Point à vérifier |
|---|---|---|---|---|
| NSF, nouveau-nés | 0 à 3 mois, de mémoire | 14 à 17 h | recommandation | bornes d'âge |
| NSF, nourrissons | 4 à 11 mois, de mémoire | 12 à 15 h | recommandation | bornes d'âge |
| AASM | 4 à 12 mois | 12 à 16 h | recommandation | texte d'origine |
| Galland | nourrisson | 9,7 à 15,9 h | statistique | catégorie très large |
| Price | 4 à 6 mois | 9,7 à 18,3 h | statistique | **plage calculée par nous** : à refuser si la source donne ses centiles |

**Vide de couverture :** rien entre 93 et 121 jours pour la NSF telle que saisie, à confirmer. **Divergence :** les recommandations et les moyennes observées ne se recoupent pas pour le nouveau-né : aucune valeur cible n'est défendable.

## Indisponibles, volontairement

Fenêtres d'éveil, nombre de siestes, repas sur 24 h, volume au biberon sur 24 h, cycles. Motifs dans `unavailable`. Le volume dépend du poids, absent de l'app : il restera probablement indisponible.

## Questions au relecteur

1. Ces plages sont-elles acceptables pour une famille française, et sous quelle formulation ?
2. Une recommandation américaine peut-elle être présentée en France, et comment ?
3. Faut-il présenter une plage statistique aussi large, ou s'abstenir ?
4. Quelles sources françaises manquent ?
5. Les gabarits de `web/src/engine/safety/templates.ts` sont-ils acceptables ?
6. Les messages d'orientation de l'app (fièvre avant 3 mois, etc.) sont-ils justes ?
