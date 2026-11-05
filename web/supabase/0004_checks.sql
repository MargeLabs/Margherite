-- Contrôles APRÈS la migration 0004. Lecture seule : aucune écriture, aucune modification.
-- À coller dans le SQL Editor APRÈS avoir exécuté 0004, app fermée sur les deux téléphones.
-- Avant de lancer : remplacer 109 / 101 / 1 par les nombres relevés dans la sauvegarde faite juste avant la migration
-- (le script d'export les affiche : « N événements, M tirages »).
-- Résultat : une ligne par contrôle ; la colonne `ok` doit être true partout. Un seul faux = ne pas rouvrir l'app, voir le retour arrière.
with attendu(events, pumps, baby) as (values (109, 101, 1)),
last_entry as (
  select distinct on (tbl, row_id) tbl, row_id, op, new_row
  from public.journal where op not like 'legacy\_%' order by tbl, row_id, seq desc
),
wanted(trg) as (values
  ('events_lock'), ('events_entry'), ('events_journal'), ('events_no_truncate'),
  ('pumps_lock'), ('pumps_entry'), ('pumps_journal'), ('pumps_no_truncate'),
  ('baby_lock'), ('baby_journal'), ('baby_no_truncate'),
  ('journal_no_change'), ('journal_no_truncate'), ('journal_guard')),
checks as (
  select 1 as n, 'événements : même nombre qu''avant la migration' as controle,
         (select events from attendu)::text as attendu, (select count(*) from public.events)::text as obtenu
  union all select 2, 'tirages : même nombre qu''avant', (select pumps from attendu)::text, (select count(*) from public.pumps)::text
  union all select 3, 'fiche bébé : présente', (select baby from attendu)::text, (select count(*) from public.baby)::text
  union all select 4, 'journal : un point de départ par événement', (select count(*) from public.events)::text,
         (select count(*) from public.journal where tbl = 'events' and op = 'baseline')::text
  union all select 5, 'journal : un point de départ par tirage', (select count(*) from public.pumps)::text,
         (select count(*) from public.journal where tbl = 'pumps' and op = 'baseline')::text
  union all select 6, 'journal : un point de départ pour la fiche bébé', (select count(*) from public.baby)::text,
         (select count(*) from public.journal where tbl = 'baby' and op = 'baseline')::text
  union all select 7, 'journal : révisions de 0002 antérieures à la migration toutes reprises (aucune perdue)', '0',
         (select count(*) from public.event_revisions r where r.changed_at <= coalesce((select min(recorded_at) from public.journal where op = 'baseline'), '-infinity')
            and not exists (select 1 from public.journal j where j.legacy_revision_id = r.id))::text
  union all select 8, 'journal : ordre — aucune entrée dont recorded_at n''augmente pas avec seq', '0',
         (select count(*) from (select recorded_at, lag(recorded_at) over (order by seq) as prev from public.journal) x where prev is not null and recorded_at <= prev)::text
  union all select 9, 'cohérence : événements dont la dernière entrée du journal diffère de la table', '0',
         (select count(*) from public.events e join last_entry l on l.tbl = 'events' and l.row_id = e.id::text
          where l.new_row is null or jsonb_populate_record(null::public.events, l.new_row) is distinct from e)::text
  union all select 10, 'cohérence : événements absents du journal', '0',
         (select count(*) from public.events e where not exists (select 1 from last_entry l where l.tbl = 'events' and l.row_id = e.id::text))::text
  union all select 11, 'cohérence : événements du journal (non supprimés) absents de la table', '0',
         (select count(*) from last_entry l where l.tbl = 'events' and l.op <> 'delete' and not exists (select 1 from public.events e where e.id::text = l.row_id))::text
  union all select 12, 'cohérence : tirages dont la dernière entrée diffère de la table, ou absents du journal', '0',
         (select count(*) from public.pumps p left join last_entry l on l.tbl = 'pumps' and l.row_id = p.id::text
          where l.row_id is null or l.new_row is null or jsonb_populate_record(null::public.pumps, l.new_row) is distinct from p)::text
  union all select 13, 'cohérence : fiche bébé identique (hors photo)', '0',
         (select count(*) from public.baby b left join last_entry l on l.tbl = 'baby' and l.row_id = b.id::text
          where l.new_row is null or (l.new_row ->> 'first_name') is distinct from b.first_name
             or (l.new_row ->> 'birth_at')::timestamptz is distinct from b.birth_at)::text
  union all select 14, 'données : événements sans created_at ou sans provenance valide', '0',
         (select count(*) from public.events where created_at is null or provenance not in ('server', 'derived_pre0004', 'supplied'))::text
  union all select 15, 'données : dodos en cours (chrono ouvert), au plus 1', '<= 1',
         (select count(*) from public.events where kind = 'sleep' and ended_at is null)::text
  union all select 16, 'déclencheurs : les 14 sont présents et actifs', '14',
         (select count(*) from pg_trigger t join wanted w on w.trg = t.tgname where not t.tgisinternal and t.tgenabled = 'O')::text
  union all select 17, 'sécurité : journal protégé par RLS', 'true',
         (select relrowsecurity from pg_class where oid = 'public.journal'::regclass)::text
  union all select 18, 'sécurité : ni anon ni authenticated ne peuvent écrire dans le journal', '0',
         ((select count(*) from unnest(array['anon', 'authenticated', 'service_role']) r
           cross join unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p where has_table_privilege(r, 'public.journal', p)))::text
  union all select 19, 'sécurité : anon ne peut pas lire le journal', 'false', has_table_privilege('anon', 'public.journal', 'SELECT')::text
  union all select 20, 'sécurité : authenticated lit le journal', 'true', has_table_privilege('authenticated', 'public.journal', 'SELECT')::text
)
select n, controle, attendu, obtenu,
       case when n = 15 then obtenu::int <= 1 else attendu = obtenu end as ok
from checks order by n;
