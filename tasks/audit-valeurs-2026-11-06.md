# Audit des valeurs affichées — 2026-11-06

Méthode : export réel du 5 nov. (`post0004-premier-export`, 4 jours complets du 1er au 4 nov.), app rendue hors écran à 18 h le 5 nov., chaque valeur recalculée depuis les événements bruts par un code indépendant. Scripts jetés après usage (non commités).

## Vérifié, exact
- **Résumé du jour (6 jours)** : sommeil total (écart ≤ 2 min, arrondi 5 min), mL, biberons, tétées : identiques au brut.
- **Semaine** : 15 h / 24 h = moyenne des 4 jours complets (14 h 50, 15 h 45, 14 h, 15 h 25) ; « son plus long 3 h 26 » = le bloc du 3 nov. 01:09 → 04:35 ; éveil / 24 h = 24 h − sommeil.
- **Habitudes** : repas / 24 h 9 (brut 10, 8, 8, 10), écart médian entre repas 2 h 45 (brut 2 h 45, 18 écarts).
- **Comprendre = habitudes de l'écran** : réveil 7:15, coucher 21:00, siestes ≈ 1 h 05, éveil 1 h 20 entre deux dodos, repas 2 h 45 : mêmes valeurs des deux côtés (les deux lisent le même calendrier, `CURRENT_RULES`).
- **Intelligence** : `bridge.ts` ne l'utilise que pour `nextSleep` et `bedtime` (fenêtres de « Prochain dodo » et de coucher). Résumés, semaine, habitudes et Comprendre n'en dépendent pas.

## Écarts
- **E1 — « nuit type » de Comprendre partiellement reconstruite** (`usual()` dans `engine/habits/typical.ts`) : le premier bloc = médiane des premiers blocs, les suivants = médiane des autres blocs répétée, trou = médiane des trous. D'où quatre « dort ≈ 2 h 05 » identiques et des réveils à 23:00, 1:30, 3:55, 6:25 qui ne sont pas des heures observées. Le nombre de réveils (4) est médian, lui, réel.
- **E2 — siestes habituelles par rang** (`typ.naps`, ligne `for k`) : « Sa 4e sieste commence souvent vers 17 h 10 (2 jours sur 4) », créneaux 5 : même fragilité que le défaut corrigé le 6 nov. pour la comparaison ; les « jours sur » le signalent (fragile) mais le texte dit « souvent ».
- **E3 — nombre de siestes** : tuile Comprendre « 5 siestes » (médiane 4, 5, 5, 4 = 4,5 arrondi à 5) contre « 4 à 5 » sur l'écran ; le coucher : tuile 21 h (4 jours) contre frise de nuit 20 h 55 (5 nuits, dont le 31 oct.).

## Non rejoué
Journal tire-lait (vérifié exact le 3 nov., pas rejoué), cartes de comparaison semaine / semaine d'avant, liens et tendances (fenêtre de 3 semaines non atteinte : `ch` vide).
