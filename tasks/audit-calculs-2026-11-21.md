# Audit des temps de sommeil et d'éveil — 2026-11-21

Méthode : export réel du 21 nov. (418 événements), app rendue hors écran à 16 h 30 le 21 nov. (7 jours, du 15 au 21 nov.), chaque valeur recalculée depuis les événements bruts par un code indépendant (scripts jetés après usage). Règles : plus aucune fusion de dodos.

## Vérifié, exact (écart ≤ 5 min, 0 écart sur 63 valeurs)
Résumé du jour, 7 jours : sommeil total, nuit (nombre et durée), siestes (nombre et durée), éveil total, « entre deux dodos », « après un repas », « mange toutes les ». Semaine (jours complets −1, −2, −3, −5, −6) : éveil par 24 h 9 h, entre deux dodos 1 h 05, après un repas 45 min, tous identiques au recalcul. Accueil : « éveillé depuis 38 min » (réveil de 15 h 52). Aucun dodo en cours ignoré. Le jour du 17 nov. est exclu de la semaine (non complet), d'où 9 h et non 9 h 15.

## Limites de définition (pas des erreurs de calcul)
- **L1 — sans fusion, « entre deux dodos » mélange vrais temps d'éveil et micro-éveils.** Sur 7 jours : 51 éveils, 11 de 30 min ou moins (7 de 15 min ou moins). Moyenne 1 h 06, médiane 1 h 12, moyenne sans les ≤ 30 min 1 h 21. L'affichage « 1 h 05 » est donc ≈ 15 min sous le temps d'éveil typique entre deux vraies siestes. Même effet dans les modèles de prévision : 21 éveils sur 104 sont ≤ 30 min dans `dayAwakeSpans`.
- **L2 — Résumé : frontière sieste / nuit fixe à 19 h 30**, alors que le coucher du moteur est adapté (20 h 36 à 22 h 11 cette semaine). Cas : le 17 nov., 19:33 → 20:12 est rangé « Nuit » dans le Résumé alors que le moteur place le coucher à 22:00. Le sommeil total et l'éveil ne changent pas, seule la répartition nuit / siestes (et leur nombre).
- **L3 — « Éveil par 24 h » = 24 h − sommeil noté** : un trou de saisie compte comme éveil. Garde-fou : la semaine ne retient que les jours complets ; le Résumé d'un jour isolé n'en a pas.
