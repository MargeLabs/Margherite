# Tests de concurrence du journal (PostgreSQL réel)

Exécutés le 2026-11-05 sur PostgreSQL 17.11 (`embedded-postgres` 17.11.0-beta.19, Windows x64). Ce dossier est séparé de `web/package.json` : ni `npm test` ni le build Vercel n'installent ces dépendances (`node_modules` est ignoré par git).

```
cd web/pgtest
npm install
npm test
```

À lancer dans une session Windows normale (PostgreSQL refuse de démarrer avec des droits administrateur). Une base temporaire est créée dans le dossier temporaire puis supprimée ; rien ne touche Supabase.

| Test | Ce qu'il établit |
|---|---|
| S1 témoin | Sans verrou, un lecteur voit `seq 2` sans `seq 1` : le test sait échouer. |
| S2 | Avec verrou, B attend A (visible dans `pg_stat_activity`), le lecteur ne voit jamais `seq 2` sans `seq 1`. |
| S3a | Transactions de plusieurs écritures : entrées contiguës, B bloquée dès sa première instruction. |
| S3b | Verrou de ligne sur une autre table : interblocage détecté (40P01), une seule transaction abandonnée. |
| S4 | Stress (6 écrivains, 3 lecteurs, annulations comprises) : zéro violation de la propriété de préfixe, `recorded_at` strictement croissant ; le témoin (10 écrivains) doit en montrer au moins une. |
| S5 | Deux requêtes sur un instantané exporté (`pg_export_snapshot`) : tables et journal d'accord. |
| S6 | Écrivain tué (`pg_terminate_backend`) : verrou libéré, aucune entrée fantôme. |
| S7 | Hypothèse A1 : celui qui obtient le verrou juste après A voit déjà la ligne validée par A. `PGTEST_ITERATIONS=100000` pour la validation finale. L'absence d'échec est un indice ; la preuve reste la lecture de `CommitTransaction` (xact.c). |
| S8 | Isolation autre que READ COMMITTED : écriture refusée. |
| S9 | `lock_timeout` : B échoue en 55P03 vers 5 s ; la valeur de la session est restaurée. |
| S10 | Point de sauvegarde annulé puis nouvelle écriture : une seule entrée. |

Non couverts : crash et redémarrage du serveur, réplicas en lecture.
