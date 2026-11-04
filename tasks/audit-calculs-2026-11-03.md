# Audit des valeurs calculées — 2026-11-03

Méthode : l'app est rendue hors écran sur l'export réel du 3 nov. (`data/canaille-sauvegarde-2026-11-03.json`, 67 événements, 86 tirages), puis chaque valeur est recalculée à la main depuis les données brutes. Seul l'écart entre les deux est un défaut.

## Vérifié, exact
Tire-lait (total, nombre, moyenne par tirage, moyenne par jour, écart avec la semaine d'avant) · tuiles Accueil (sommeil du jour, repas, mL, « éveillé depuis », « dernier il y a ») · Résumé du jour (nuit n / durée, siestes n / durée, mL, biberons / tétées, « mange toutes les », éveil total, entre deux dodos, après un repas) sur 4 jours · moyenne repas / jour (9,3) et mL (750) · éveil moyen 1 h 30 (16 éveils) · repas par nuit (3) · cycle de la nuit dernière (2 h 05) · âge (6 semaines 3 jours) · réveil habituel (6:55) · fréquence de repas hebdo (2 h 35).

## Défauts
- **F1 — le sommeil est gonflé par les fusions.** Un dodo fusionné compte le trou entre ses parties comme du sommeil : 74 min d'éveil sur 4 jours (1er nov. : +51 min, 31 oct. : +19). Moyenne hebdo affichée 15 h, réelle 14 h 36 ; « éveil par 24 h » affiché 9 h, réel ≈ 9 h 25.
- **F2 — des fusions traversent un repas.** 4 trous sur 7 contiennent un repas : 31 oct. 02:45 et 04:40 (biberons), 1er nov. 05:59 (tétée), 1er nov. 15:45 (biberon). Un repas prouve un réveil. Effets : « son plus long : 6 h 15 » (réel 2 h 30), cycle de 3 h 15 au comparatif (réel ≈ 2 h 10), cycles par nuit 3,3, sieste du 1er nov. 3 h 02 pour 2 h 28 réelles.
- **F3 — la nuit du 30 au 31 est comptée complète.** Le journal commence à 00:01 : son coucher n'est pas observé. Elle entre dans le comparatif, dans la fourchette « réveils d'habitude 0 à 3 » et dans les médianes de nuit.
- **F4 — « Coucher » collé à n'importe quel dodo de nuit.** `habitOf` appelle « Coucher » tout dodo hors réveil → coucher de sa journée, donc le 05:06 de ce matin s'affiche « Coucher · plus tard que d'habitude (20:55 – 21:25) » dans Derniers enregistrements et dans la popup d'ajout.

## Incohérences et réserves
- « Mange toutes les » a trois définitions : moyenne du jour (écarts < 6 h), moyenne groupée de la semaine, médiane du comparatif (écarts < 5 h) : 2 h 35 contre 2 h 30 pour les mêmes jours.
- Prochain dodo « 10:25 – 16:30 en ce moment » : fourchette min–max de 3 jours, 6 h de large, donc sans valeur.
- Moyennes hebdo sur 3 jours seulement, sans mention « fragile » dans la phrase du graphe.

## Corrections (2026-11-03, non commitées)
Modèle : un bloc fusionné a une **étendue** (continuité : cycles, plus long sommeil, réveils) et des **minutes dormies** (étendue moins les éveils comblés). Tous les totaux de sommeil (jour, nuit, semaine, graphes, tuiles) comptent les minutes dormies ; l'éveil du jour est le reste (24 h − sommeil), il garde donc les trous comblés.
- F1 corrigé : moyenne hebdo 15 h → 14 h 35, éveil par 24 h 9 h → 9 h 25, 1er nov. 16 h 20 → 15 h 25, aujourd'hui 6 h 50 → 6 h 45.
- F2 : **règle conservée** (décision de Victor : un dodo de nuit repris dans les 15 min = calmé et rendormi, pas un réveil ; sieste ≤ 30 min = une sieste). Le 6 h 15 reste « son plus long » (étendue).
- F3 corrigé : un coucher à moins de 2 h du premier événement du journal rend la nuit partielle (réveil connu, coucher inconnu), hors habitudes ; le réveil habituel l'utilise encore. Cycle comparatif 3 h 15 → 2 h 10, cycles par nuit 3,3 → 4.
- F4 corrigé : « Coucher » seulement pour le premier dodo de la nuit ; les reprises disent « Sommeil de nuit » sans comparaison à l'heure du coucher.
