# Bilan — fondations Canaille V2 (2026-11-05)

Local uniquement. Aucun commit nouveau, aucun push, aucun déploiement, 0004 non exécutée sur Supabase, aucune donnée de production touchée.
`dbb5b32` et `2c21b86` conservés.

## Étape 1 — apprentissage des prévisions (fait par la session « Canaille Intelligence », vérifié ici)
- Résultat de chaque fenêtre affichée recalculé sur le journal actuel (`outcomesOf`) : `inside / early / late / pending / unobserved / not_prospective`. Jamais un « raté » sans résultat ; une fenêtre affichée après coup ne compte pas.
- Doublons : même cible + même ancre = la dernière entrée fait foi. Corrections / suppressions : le résultat change, jamais l'entrée.
- Stabilité : un autre modèle ne remplace celui qui sert qu'après `switchConfirmDays` (2) jours de suite ; retour à la référence immédiat (rejeu pire ou fenêtres réellement affichées pires, `liveCheck`).
- Trou que j'ai signalé et qui est corrigé : la plage de référence affichée n'était pas journalisée.
- Vérifié : 346 tests verts, `tsc` propre.

## Étape 2 — audit du branchement V2
| Élément | État |
|---|---|
| Prochain dodo (Accueil, Rythme, popup biberon) | **Branché** : `engine.nextSleep` ; remplace la plage legacy `wins` seulement si le modèle servi ≠ référence. Sinon c'est le calcul legacy qui s'affiche (et il est maintenant journalisé). |
| Coucher du soir (Accueil, Rythme) | **Branché**, même règle (`engine.bedtime`). Aucun modèle n'a gagné : la référence s'affiche. |
| Nuits, journées, liens (`calendar`, `links`) | **Branchés** via `bridge.ts` (moteur de règles, associations testées). |
| Journal de mesure / historique des modèles | **Branchés** (`forecastRecorder`, localStorage de l'appareil). |
| Durée de sieste, prochain repas | **Calculés et notés, aucun emplacement à l'écran** (décision de Victor). |
| Comprendre | **Partiel** : `comprendre/model.ts` appelle `habitsModel()` (habitudes) et son `nextSleep` **directement**, hors `runIntelligence` — utilisé seulement pour la pose « approche » de Filou. Laissé tel quel, à trancher. |
| Statistiques | **Absent** : aucun écran « Statistiques » dans `web/`. |
| Lecture du journal SQL côté app | **Absent** : `intelligenceFor` existe et est testé mais l'app n'a pas de lecture de la table `journal` (n'existe pas en production tant que 0004 n'est pas exécutée) → l'app tourne en mode dégradé (reconstruction par date de saisie). |
| Hors interface | Les 3 fonds de rejeu (survie, âge) restent « en test » ; aucun seuil d'âge dans la production. |

## Étape 3 — SQL 0004
Audit de `supabase/migrations/0004_journal.sql` + tests, tous verts :
- PGlite (`journal.sql.test.ts`, `journal.asof.test.ts`, `journalExport.test.ts`, `intelligenceSource.test.ts`) : inserts, stop, reopen, update, delete, import, baby sans photo, reconstruction exacte avant/après, droits (anon, authenticated, service_role), TRUNCATE, ajout seul.
- PostgreSQL 17.11 réel (`web/pgtest`, 11 scénarios) : sérialisation par verrou, isolation, `lock_timeout`, interblocage détecté. 11/11.
- **Nouveau** : `src/data/journal.rehearsal.test.ts` — répétition sur la **vraie sauvegarde** (ignorée si absente, jamais Supabase) : 105 événements / 100 tirages / 1 fiche → un baseline par ligne, existant classé `derived_pre0004`, rien réécrit, relance sans doublon, le journal redonne exactement les tables ; catastrophe (suppression totale) puis restauration par l'app : passé exact avant la perte, état final complet, lignes restaurées tracées `server` ; le moteur lit le journal (mêmes événements que la sauvegarde, mode `journal`).
Réserves relevées dans la lecture (aucune bloquante) :
1. La migration prend le verrou 918273 puis des verrous de table ; une écriture de l'app prend l'inverse → interblocage possible (détecté par Postgres, une des deux transactions est annulée). **À lancer quand personne n'écrit** (famille, un seul foyer).
2. Le propriétaire de la base peut contourner (déjà documenté dans l'en-tête) ; seule une sauvegarde hors base le détecte.
3. Politique de lecture : tout `authenticated` lit tout le journal — correct tant que l'app est mono-foyer (un seul compte).

### Procédure sûre de migration (à faire par Victor, sur accord)
1. Fermer l'app sur les deux téléphones.
2. `npm run export` dans `web/` : sauvegarde JSON datée dans `data/` ; vérifier le nombre de lignes (événements, tirages) et la copier hors du PC.
3. Supabase › SQL Editor : `select current_user, session_user;` (attendu : postgres).
4. Coller `0004_journal.sql`, Run. En cas d'erreur la transaction entière est annulée : rien n'a changé.
5. Contrôles : `select op, count(*) from journal group by op;` → `baseline` = lignes de `events` + `pumps` + 1 ; `select provenance, count(*) from events group by 1;` → tout `derived_pre0004` ; l'app (ajouter un biberon, le corriger) crée une entrée `insert` puis `update`, via `app`.
6. Relancer `npm run export` : le fichier passe en version 2 avec `journal`.
7. Retour arrière : 0004 n'altère ni ne supprime aucune donnée ; en cas de problème, restaurer la sauvegarde de l'étape 2 est inutile sauf si une table a été modifiée par erreur ; le journal est conservé (ajout seul).

## Étape 4 — validation globale
- `tsc --noEmit` : propre. `vitest run` : **346/346** (23 fichiers).
- `npm run backtest` (rejeu sur les données réelles) : 3/3, rapport `data/rapports/intelligence-dernier.md`.
- Build `NEXT_PUBLIC_DATA=local` + `scripts/e2e/app.cjs` : **tout vert**, console propre (mode local, jamais la base réelle).

### Rejeu sur les données réelles (R0 : ≈ 4 jours, rien de définitif)
- Dodo : 30 décisions ; habitude 7 réponses / couverture 43 % ; survie 24 réponses / 67 % ; **« unmeasured »** (pas assez pour trancher), survie en test comme décidé.
- Coucher : 5 décisions, 1 réponse → rien de mesurable.
- Durée de sieste : 16 décisions, aucun gain net.
- Repas : `weighted` bat la référence (couverture 80 % contre 37 %, score 160 contre 216) → seul modèle « mesuré meilleur », **sans emplacement à l'écran**.

### Limites et risques restants
- Pas assez de données réelles pour valider un modèle (≈ 4 jours) ; aucune conclusion de performance.
- Durée sur iPhone du rejeu (≈ 0,7 s PC) non mesurée ; fluidité non testée au doigt.
- `engine.test.ts` « 6 mois en moins de 3 s » : a échoué une fois (3 125 ms) sous charge CPU en suite complète ; vert ensuite. Test de temps sensible à la charge.
- Travail non commité : 9 fichiers modifiés + 2 nouveaux tests (`live.test.ts`, `journal.rehearsal.test.ts`). Deux sessions ont écrit dans le même arbre : coordonnées par messages, pas de conflit constaté.
- 0004 non exécutée : l'app reste en mode dégradé tant qu'elle n'est pas passée et que la lecture du journal n'est pas branchée.
- Concurrence prouvée sur un Postgres réel (hypothèse de préfixe A1) mais pas par lecture de `CommitTransaction`.
