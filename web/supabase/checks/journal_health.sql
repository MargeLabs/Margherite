-- Contrôle de santé du journal (migration 0004). LECTURE SEULE : ne modifie rien.
-- À coller dans Supabase > SQL Editor > Run, par exemple après toute intervention manuelle sur la base.
-- Une seule table de résultats : chaque ligne doit finir par « ok » (ou « info »). Toute autre valeur est à examiner.

with expected(tbl, trg) as (values
  ('events', 'events_lock'), ('events', 'events_no_truncate'), ('events', 'events_entry'), ('events', 'events_journal'),
  ('pumps',  'pumps_lock'),  ('pumps',  'pumps_no_truncate'),  ('pumps',  'pumps_entry'),  ('pumps',  'pumps_journal'),
  ('baby',   'baby_lock'),   ('baby',   'baby_no_truncate'),   ('baby',   'baby_journal'),
  ('journal', 'journal_no_change'), ('journal', 'journal_no_truncate'), ('journal', 'journal_guard')
)
-- 1. chaque déclencheur existe et est activé (tgenabled = 'O') : sinon des écritures échapperaient au journal
select '1 déclencheur' as controle, e.tbl || '.' || e.trg as detail,
       case when t.tgname is null then 'ABSENT' when t.tgenabled = 'O' then 'ok' else 'DÉSACTIVÉ (' || t.tgenabled::text || ')' end as statut
from expected e
left join pg_trigger t on t.tgname = e.trg and t.tgrelid = to_regclass('public.' || e.tbl) and not t.tgisinternal

union all
-- 2. personne, parmi les rôles de l'API, ne peut écrire dans le journal
select '2 droits d''écriture', r, case when has_table_privilege(r, 'public.journal', 'INSERT,UPDATE,DELETE,TRUNCATE') then 'ANORMAL : peut écrire' else 'ok' end
from unnest(array['anon', 'authenticated', 'service_role']) as r

union all
-- 3. la sécurité par ligne est active sur le journal
select '3 RLS journal', 'public.journal', case when c.relrowsecurity then 'ok' else 'DÉSACTIVÉE' end
from pg_class c where c.oid = 'public.journal'::regclass

union all
-- 4. colonnes de saisie présentes
select '4 colonne', 'events.' || col, case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = col) then 'ok' else 'ABSENTE' end
from unnest(array['source', 'provenance', 'created_at']) as col

union all
-- 5. aucun événement ni tirage sans trace au journal (un événement écrit sans entrée = écriture non tracée)
select '5 sans trace', 'events', case when n = 0 then 'ok' else n || ' ligne(s) sans entrée de journal' end
from (select count(*) as n from public.events e where not exists (select 1 from public.journal j where j.tbl = 'events' and j.row_id = e.id::text)) s
union all
select '5 sans trace', 'pumps', case when n = 0 then 'ok' else n || ' ligne(s) sans entrée de journal' end
from (select count(*) as n from public.pumps p where not exists (select 1 from public.journal j where j.tbl = 'pumps' and j.row_id = p.id::text)) s

union all
-- 6. l'heure de la dernière écriture d'un événement et celle de la dernière entrée de journal doivent être voisines
select '6 dernière écriture', 'événements : ' || coalesce(max(e.updated_at)::text, 'aucun') || ' · journal : ' || coalesce((select max(recorded_at)::text from public.journal), 'aucune'), 'info'
from public.events e

order by 1, 2;
