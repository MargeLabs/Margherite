# Procédure — exécuter la migration 0004 sur Supabase

Préparée le 2026-11-05. **Rien n'a été exécuté sur Supabase.** Tous les fichiers ci-dessous sont testés sur PostgreSQL (PGlite et Postgres 17 réel pour la concurrence), jamais sur ta base.

## 1. La sauvegarde actuelle suffit-elle ?
Fichier : `data/canaille-sauvegarde-2026-11-05.json` (export du 2026-11-05 14:28 UTC, version 2) — 109 événements, 101 tirages, fiche bébé avec photo, réglages (`kv`). Ids tous uniques, un dodo en cours.
- **Pour les données : oui.** Toutes les colonnes y sont (dont `created_at`, `updated_at`, `source`), la photo aussi. Répétition faite : migration, perte totale, restauration → mêmes lignes (test `journal.rehearsal.test.ts`).
- **Pas assez pour le jour J** : elle date d'avant tes saisies d'aujourd'hui. **Il faut un export frais juste avant la migration** (étape 2).
- **Non couvert par l'export** : le compte famille (utilisateur Supabase Auth, à recréer à la main), le schéma (scripts 0001 à 0003), et `event_revisions` (historique de corrections de 0002, 90 jours ; il est repris dans le journal par la migration).
- **L'app n'a pas de bouton « restaurer »** : la restauration passe par le SQL généré par `scripts/restore-sql.mjs` (étape retour arrière), collé dans le SQL Editor.
- **Une seule copie** : le plan Supabase Free ne sauvegarde rien. Copie l'export hors du PC (clé USB, cloud perso) avant de continuer.

## 2. Prérequis à valider avant de commencer
1. `web/.env.local` contient `FAMILY_CODE` (l'export en a besoin).
2. **Si l'export du jour existe déjà, le copier ailleurs d'abord** : `npm run export` écrit `data/canaille-sauvegarde-AAAA-MM-JJ.json` et **écrase** celui du même jour (la tâche de 10 h aussi).
3. Les deux téléphones : app fermée (balayée, pas seulement en arrière-plan), personne ne saisit pendant ~5 min.
4. Aucun chrono en cours de préférence (un dodo ouvert est conservé, mais autant simplifier).
5. Compte Supabase : accès au SQL Editor du projet `kflzeijdslwtqhzdvdbi`.
6. Rien d'autre n'est nécessaire côté code : l'app actuelle fonctionne sans changement avec 0004 (testé).

## 3. Ordre exact des opérations
1. **Export frais** (dans `web/`) : `npm run export`. Noter les deux nombres affichés : `N événements, M tirages`. Copier le fichier hors du PC.
2. Supabase › SQL Editor › nouvelle requête : `select current_user, session_user;` → attendu `postgres`.
3. Nouvelle requête : coller **tout** `web/supabase/migrations/0004_journal.sql` › Run. La migration est une seule transaction : si une erreur apparaît, rien n'a changé.
   - Erreur `deadlock detected` (40P01) ou `lock timeout` : une écriture de l'app est passée en même temps. Rien n'est modifié ; vérifier que les téléphones sont fermés et relancer.
   - Erreur « `source` a une valeur par défaut » : s'arrêter, me l'envoyer.
4. Nouvelle requête : coller `web/supabase/0004_checks.sql`, **remplacer `(109, 101, 1)` par `(N, M, 1)`** relevés à l'étape 1, Run.
   - Attendu : 20 lignes, colonne `ok` = `true` partout. **Un seul `false` : ne pas rouvrir l'app**, passer au retour arrière (§5) ou m'envoyer le résultat.
5. Rouvrir l'app sur un téléphone, ajouter un biberon puis le corriger, le supprimer. Relancer `0004_checks.sql` avec les nombres ajustés si tu veux (attendu : toujours 20 `true`).
6. Contrôle de ce que le journal a enregistré (lecture seule) :
   `select op, via, count(*) from public.journal group by 1, 2 order by 1, 2;` → `baseline` = événements + tirages + 1 (via `migration`), puis `insert`, `update`, `delete` via `app`.
7. **Lecture par Canaille Intelligence** (hors ligne, dans `web/`) :
   `npm run export` puis `npx vitest run src/data/journal.postmigration.test.ts`. Attendu : 4 tests verts (export version 2, chaîne sans rupture, le journal redonne exactement les événements et tirages, moteur en mode `journal` sur les 4 cibles). Ce test s'ignore tant qu'aucun export ne contient de journal.
8. Garder l'export d'avant migration (étape 1) intact.

L'app lit maintenant le journal (`JournalSource`, `withJournal`) : à la première lecture après la migration, le moteur passe seul en mode « journal » (un téléphone resté ouvert qui avait trouvé la table absente la retente au bout de 10 min au plus). Il repasse en dégradé tout seul si la table disparaît (retour arrière niveau 2), si une écriture n'est pas tracée (niveau 1) ou le temps qu'une écriture soit rechargée. Aucun écran ne change.

## 4. Écarts connus (à savoir, pas à corriger)
- Les lignes existantes sont classées `derived_pre0004` : conservées, jamais exclues, `source` laissée à `null` (rien d'inventé).
- Une restauration faite après 0004 par le SQL Editor marque les lignes `supplied` et **déduit** `source` (`live`/`later`/`timer`) car le serveur la devine quand elle est nulle ; `created_at` est conservé tel que sauvegardé.
- Le propriétaire de la base peut contourner le journal (documenté dans `0004_journal.sql`) : seule une sauvegarde hors base le détecte.
- Tout compte connecté lit tout le journal : correct tant que l'app est mono-foyer.

## 5. Retour arrière
Choisir selon le symptôme. Dans tous les cas : ne rien supprimer à la main, et garder l'export de l'étape 1.

| Symptôme | Action |
|---|---|
| L'app refuse d'écrire (erreur de lock, lenteur) mais les données sont bonnes | **Niveau 1 — pause** : coller `web/supabase/rollback/0004_pause.sql`. Les déclencheurs du journal sont désactivés, rien n'est supprimé. L'app écrit comme avant ; le moteur voit la chaîne rompue et retombe en mode dégradé. Pour reprendre : relancer `0004_journal.sql`. |
| Un contrôle `false`, ou on veut revenir à l'état d'avant | **Niveau 2 — retrait** : coller `web/supabase/rollback/0004_remove.sql` (supprime déclencheurs, fonctions et la table `journal`, **pas** les données ; les colonnes `provenance` et `source` élargie restent, inertes). Faire d'abord un `npm run export` si possible (il contient le journal). Pour reposer 0004 ensuite : relancer `0004_journal.sql`. |
| Des lignes manquent ou sont fausses dans `events`, `pumps`, `baby` ou `kv` (cas très improbable : 0004 ne réécrit aucune donnée) | **Restauration** : `node scripts/restore-sql.mjs ../data/<export d'avant>.json` (dans `web/`) écrit un fichier `.restauration.sql` à côté ; le coller dans le SQL Editor. Il n'écrase aucune ligne existante (`on conflict do nothing`) et affiche les nombres après coup. Si une ligne existante est fausse, la corriger à la main ou la supprimer puis relancer. |
| Compte famille disparu | Authentication › Users › recréer l'utilisateur (même e-mail, mot de passe = code famille, confirmé), puis restauration des données si besoin. |

## 6. Ce qui est vérifié par des tests (`web/src/data/`)
- `journal.procedure.test.ts` : les 20 contrôles passent après migration puis après usage de l'app, et détectent une modification hors journal ; pause ; retrait (données et `event_revisions` intactes, l'app marche, 0004 se repose) ; restauration d'une base vide à l'identique et relançable.
- `journal.rehearsal.test.ts` : répétition sur la vraie sauvegarde (105 événements) : baseline par ligne, relance sans doublon, perte totale puis restauration.
- `journal.sql.test.ts`, `journal.asof.test.ts`, `journalExport.test.ts`, `intelligenceSource.test.ts` et `web/pgtest` (11 scénarios Postgres 17 réel) : déjà verts au bilan précédent.
- `journal.postmigration.test.ts` : validé sur un export simulé (journal produit par la vraie sauvegarde + 0004), s'ignore sans export réel.
