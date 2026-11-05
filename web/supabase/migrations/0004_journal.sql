-- Canaille 0004 : journal complet des modifications, en ajout seul, sans purge.
-- But : pouvoir retrouver exactement l'état du journal du bébé tel qu'il était connu à n'importe quel instant passé,
-- pour que l'intelligence n'apprenne et ne soit évaluée qu'avec ce qui était vraiment su à ce moment-là.
--
-- Ce que la migration fait :
--   1. ajoute `journal` : une ligne par création, arrêt de chrono, réouverture, correction ou suppression d'un événement,
--      d'un tirage ou de la fiche du bébé (photo exclue), avec la ligne d'avant et la ligne d'après, l'heure du serveur,
--      le compte, le téléphone (quand il est connu) et la voie d'écriture (app, service, SQL) ;
--   2. fixe `created_at` (heure de première saisie) par le serveur pour toute écriture venue de l'app, et devine `source`
--      (timer, live, later, import) quand l'app ne la donne pas ;
--   3. reprend les révisions déjà gardées par 0002 et pose, pour chaque ligne existante, un point de départ (« baseline »).
-- Ce qu'elle ne fait pas : elle ne supprime rien. `event_revisions` (0002) continue de tourner à côté.
-- L'app n'a rien à changer pour fonctionner.
--
-- Protection du journal, et ses limites : les rôles de l'API (anon, authenticated, service_role) n'ont aucun droit d'écriture sur `journal`,
-- une garde refuse toute insertion qui ne vient pas du propriétaire de la table, et UPDATE / DELETE / TRUNCATE sont refusés pour tous.
-- Le PROPRIÉTAIRE de la base (rôle postgres, tableau de bord, SQL Editor) peut toujours contourner : supprimer ou désactiver un trigger,
-- insérer directement, remplacer une fonction, supprimer la table. Rien ne l'en empêche ; seule une copie hors de la base (sauvegarde) le détecte.
-- Un trigger désactivé est détecté par journal_write (refus sans verrou) mais pas s'il est désactivé sur les trois tables à la fois.
--
-- À exécuter une fois : Supabase > SQL Editor > coller ce fichier > Run. Faire d'abord une sauvegarde JSON (Profil).
-- Relançable sans danger : rien n'est dupliqué.

begin;
set local timezone = 'UTC';                  -- les instants écrits dans le journal ont le même texte quelle que soit la session
select pg_advisory_xact_lock(918273, 1);     -- même verrou que les écritures de l'app : la reprise ne s'intercale pas dans une écriture

-- `source` ne doit avoir aucun défaut SQL : il pourrait se faire passer pour une valeur fournie. On s'arrête plutôt que de le supprimer en silence.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('events', 'pumps')
             and column_name = 'source' and column_default is not null) then
    raise exception 'journal : events.source ou pumps.source a une valeur par défaut : à examiner avant de continuer';
  end if;
end;
$$;

-- ---------------------------------------------------------------- 1. source de la saisie : « import » en plus
alter table public.events add column if not exists source text;
alter table public.events drop constraint if exists events_source_check;
alter table public.events add constraint events_source_check check (source is null or source in ('timer', 'live', 'later', 'import'));
alter table public.pumps add column if not exists source text;
alter table public.pumps drop constraint if exists pumps_source_check;
alter table public.pumps add constraint pumps_source_check check (source is null or source in ('live', 'later', 'import'));

-- ---------------------------------------------------------------- 1b. provenance : qui a fixé created_at
-- 'derived_pre0004' = ligne déjà là à la migration : created_at plausible (diagnostic du 2026-11-05 sur 109 événements : aucun
--   created_at égal à started_at, aucun > 10 min avant le début, aucun doublon) mais jamais prouvé fixé par le serveur.
--   Elle est conservée et utilisable avec une fiabilité prudente, jamais exclue d'office. Sa `source` reste null : rien n'est inventé.
-- 'server' = écrite après la migration par l'app : created_at fixé par le trigger (heure réelle d'enregistrement, pas début de transaction).
-- 'supplied' = écrite en SQL ou par un autre chemin que l'app : created_at fourni par l'écrivain, rien ne prouve qu'il vient du serveur.
-- Les lignes existantes prennent 'derived_pre0004' par la valeur par défaut au moment de l'ajout (aucune réécriture, aucun trigger),
-- puis le défaut passe à 'server'. Le trigger fixe toujours la valeur à l'insertion : le défaut ne sert qu'à cet ajout de colonne.
-- Relançable : ces deux ordres ne changent plus rien.
alter table public.events add column if not exists provenance text not null default 'derived_pre0004';
alter table public.events alter column provenance set default 'server';
alter table public.events drop constraint if exists events_provenance_check;
alter table public.events add constraint events_provenance_check check (provenance in ('server', 'derived_pre0004', 'supplied'));
alter table public.pumps add column if not exists provenance text not null default 'derived_pre0004';
alter table public.pumps alter column provenance set default 'server';
alter table public.pumps drop constraint if exists pumps_provenance_check;
alter table public.pumps add constraint pumps_provenance_check check (provenance in ('server', 'derived_pre0004', 'supplied'));

-- ---------------------------------------------------------------- 2. le journal
-- Ordre : `seq` est l'ordre des écritures ET l'ordre de leurs commits, parce que toute écriture sur events, pumps ou baby prend d'abord
-- le verrou (918273, 1) et le garde jusqu'à son commit (voir journal_lock). `changed_at` (= now(), début de transaction) n'ordonne rien.
-- `recorded_at` : heure du serveur au moment de l'entrée, strictement croissante avec `seq` ; sert seulement à situer un watermark dans le temps.
create or replace function public.journal_next_recorded_at() returns timestamptz
language plpgsql volatile set search_path = public, pg_temp as $$   -- VOLATILE obligatoire : elle doit voir les entrées validées à l'instant
declare last_at timestamptz;
begin
  select recorded_at into last_at from public.journal order by seq desc limit 1;
  return greatest(clock_timestamp(), coalesce(last_at + interval '1 microsecond', '-infinity'::timestamptz));
end;
$$;

create table if not exists public.journal (
  seq bigint generated always as identity primary key,           -- ordre exact des écritures
  tbl text not null check (tbl in ('events', 'pumps', 'baby')),
  row_id text not null,                                          -- id de la ligne concernée
  op text not null check (op in ('insert', 'stop', 'reopen', 'update', 'delete', 'baseline', 'legacy_update', 'legacy_delete')),
  old_row jsonb,                                                 -- la ligne avant (null pour une création)
  new_row jsonb,                                                 -- la ligne après (null pour une suppression)
  changed_fields text[] not null default '{}',                   -- colonnes réellement changées (updated_at exclu)
  source text,                                                   -- timer, live, later, import (celle de la ligne)
  changed_at timestamptz not null default now(),                 -- début de transaction ; égale au updated_at de la ligne écrite ; n'ordonne rien
  recorded_at timestamptz not null default public.journal_next_recorded_at(), -- heure serveur croissante avec seq (voir plus haut)
  actor uuid,                                                    -- compte connecté (le foyer) ; null pour SQL Editor
  via text not null check (via in ('app', 'service', 'sql', 'migration')),
  device text,                                                   -- téléphone, s'il s'annonce (en-tête X-Client-Info)
  txid bigint not null default txid_current(),                   -- écritures d'une même transaction
  legacy_revision_id bigint unique                               -- reprise d'une ligne de event_revisions (0002)
);
create index if not exists journal_row_idx on public.journal (tbl, row_id, seq);
create index if not exists journal_changed_idx on public.journal (changed_at);
create index if not exists journal_recorded_idx on public.journal (recorded_at);

-- verrou de sérialisation : pris au début de chaque instruction d'écriture, avant tout verrou de ligne, relâché au commit.
-- Il attend 5 s au plus : une transaction restée ouverte fait échouer l'écriture (55P03) au lieu de bloquer l'app.
create or replace function public.journal_lock() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare prev text := current_setting('lock_timeout');
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'journal : isolation % non supportée (read committed requis)', current_setting('transaction_isolation');
  end if;
  perform set_config('lock_timeout', '5s', true);
  perform pg_advisory_xact_lock(918273, 1);
  perform set_config('lock_timeout', prev, true);
  return null;
end;
$$;

-- qui écrit : le jeton et les en-têtes que PostgREST (l'API de Supabase) met à disposition ; rien n'est inventé s'ils manquent
create or replace function public.journal_context(out actor uuid, out via text, out device text)
language plpgsql stable set search_path = public, pg_temp as $$
declare claims jsonb; headers jsonb;
begin
  begin claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb; exception when others then claims := null; end;
  begin headers := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then headers := null; end;
  begin actor := nullif(claims ->> 'sub', '')::uuid; exception when others then actor := null; end;
  via := case claims ->> 'role' when 'authenticated' then 'app' when 'service_role' then 'service' else 'sql' end;
  device := substring(headers ->> 'x-client-info' from 'canaille-device/([0-9a-fA-F-]{8,64})');
end;
$$;

-- ---------------------------------------------------------------- 3. avant l'écriture : heure de saisie et source fixées par le serveur
-- Ce sont des DÉDUCTIONS du serveur, pas des certitudes : l'heure de l'événement vient du téléphone.
-- « live » = l'heure déclarée est entre 2 min dans le futur (décalage d'horloge) et 10 min dans le passé ; « later » = saisi après coup ;
-- « timer » = chrono lancé (y compris « depuis HH:MM » : son début est alors déclaré, pas mesuré).
-- Un dodo fini saisi d'un coup est « later » même s'il vient de finir : son début, lui, est reconstitué de mémoire.
-- created_at = heure réelle d'enregistrement côté serveur (clock_timestamp, sous le verrou), pas le début de transaction.
create or replace function public.events_entry() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if (public.journal_context()).via in ('app', 'service') then new.created_at := clock_timestamp(); new.provenance := 'server';  -- l'app ne choisit jamais son heure de saisie
    else new.provenance := 'supplied'; end if;
    if new.source is null then
      new.source := case
        when new.kind = 'sleep' and new.ended_at is null then 'timer'
        when new.kind = 'sleep' then 'later'
        when extract(epoch from now() - new.started_at) between -120 and 600 then 'live'
        else 'later' end;
    end if;
  else
    new.created_at := old.created_at;  -- une correction ne change ni l'heure de saisie ni la source d'origine
    new.source := old.source;
    new.provenance := old.provenance;
  end if;
  return new;
end;
$$;

create or replace function public.pumps_entry() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if (public.journal_context()).via in ('app', 'service') then new.created_at := clock_timestamp(); new.provenance := 'server';
    else new.provenance := 'supplied'; end if;
    if new.source is null then
      new.source := case
        when new.legacy_id is not null then 'import'  -- tirages repris de l'ancienne app ou d'un fichier
        when extract(epoch from now() - new.at) between -120 and 600 then 'live'
        else 'later' end;
    end if;
  else
    new.created_at := old.created_at;
    new.source := old.source;
    new.provenance := old.provenance;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- 4. après l'écriture : une entrée de journal
create or replace function public.journal_write() returns trigger
language plpgsql security definer set search_path = public, pg_temp set timezone = 'UTC' as $$
declare o jsonb; n jsonb; f text[] := '{}'; kind text; ctx record;
begin
  -- sans le verrou de sérialisation (trigger désactivé, etc.), on n'écrit pas : l'ordre des entrées ne serait plus garanti
  if not exists (select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()
                 and classid = 918273 and objid = 1 and objsubid = 2 and granted) then
    raise exception 'journal : verrou de sérialisation absent';
  end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old) - 'photo'; end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new) - 'photo'; end if;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(e.key order by e.key), '{}') into f from jsonb_each(n) e where e.key <> 'updated_at' and (o -> e.key) is distinct from e.value;
    if cardinality(f) = 0 then return null; end if;  -- rien n'a vraiment changé (ou seulement la photo)
    kind := case
      when tg_table_name = 'events' and f = array['ended_at'] and o ->> 'ended_at' is null then 'stop'
      when tg_table_name = 'events' and f = array['ended_at'] and n ->> 'ended_at' is null then 'reopen'
      else 'update' end;
  else
    kind := lower(tg_op);
  end if;
  select * into ctx from public.journal_context();
  insert into public.journal (tbl, row_id, op, old_row, new_row, changed_fields, source, actor, via, device)
  values (tg_table_name, coalesce(n, o) ->> 'id', kind, o, n, f, coalesce(n, o) ->> 'source', ctx.actor, ctx.via, ctx.device);
  return null;
end;
$$;

-- ---------------------------------------------------------------- 5. ajout seul : aucune entrée ne se modifie ni ne s'efface, quel que soit le compte
create or replace function public.journal_append_only() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'journal : ajout seul, % interdit', lower(tg_op);
end;
$$;

drop trigger if exists journal_no_change on public.journal;
create trigger journal_no_change before update or delete on public.journal for each row execute function public.journal_append_only();
drop trigger if exists journal_no_truncate on public.journal;
create trigger journal_no_truncate before truncate on public.journal for each statement execute function public.journal_append_only();

-- garde : seul le propriétaire de la table (donc les fonctions DEFINER ci-dessus) peut insérer ; les autres rôles échouent déjà faute de droit,
-- et si un droit leur était rendu un jour, la garde refuse quand même. Le propriétaire, lui, peut tout contourner (voir README).
create or replace function public.journal_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user <> (select pg_get_userbyid(relowner) from pg_class where oid = 'public.journal'::regclass) then
    raise exception 'journal : écriture directe interdite';
  end if;
  return new;
end;
$$;
drop trigger if exists journal_guard on public.journal;
create trigger journal_guard before insert on public.journal for each row execute function public.journal_guard();

-- sérialisation des écritures et refus du TRUNCATE (non tracé) sur les trois tables
drop trigger if exists events_lock on public.events;
create trigger events_lock before insert or update or delete on public.events for each statement execute function public.journal_lock();
drop trigger if exists pumps_lock on public.pumps;
create trigger pumps_lock before insert or update or delete on public.pumps for each statement execute function public.journal_lock();
drop trigger if exists baby_lock on public.baby;
create trigger baby_lock before insert or update or delete on public.baby for each statement execute function public.journal_lock();
drop trigger if exists events_no_truncate on public.events;
create trigger events_no_truncate before truncate on public.events for each statement execute function public.journal_append_only();
drop trigger if exists pumps_no_truncate on public.pumps;
create trigger pumps_no_truncate before truncate on public.pumps for each statement execute function public.journal_append_only();
drop trigger if exists baby_no_truncate on public.baby;
create trigger baby_no_truncate before truncate on public.baby for each statement execute function public.journal_append_only();

drop trigger if exists events_entry on public.events;
create trigger events_entry before insert or update on public.events for each row execute function public.events_entry();
drop trigger if exists pumps_entry on public.pumps;
create trigger pumps_entry before insert or update on public.pumps for each row execute function public.pumps_entry();

drop trigger if exists events_journal on public.events;
create trigger events_journal after insert or update or delete on public.events for each row execute function public.journal_write();
drop trigger if exists pumps_journal on public.pumps;
create trigger pumps_journal after insert or update or delete on public.pumps for each row execute function public.journal_write();
drop trigger if exists baby_journal on public.baby;
create trigger baby_journal after insert or update or delete on public.baby for each row execute function public.journal_write();

-- ---------------------------------------------------------------- 6. accès : le foyer lit, personne n'écrit à la main
alter table public.journal enable row level security;
drop policy if exists "foyer lit" on public.journal;
create policy "foyer lit" on public.journal for select to authenticated using (true);
revoke all on public.journal from public, anon, authenticated, service_role;
grant select on public.journal to authenticated, service_role;
do $$ begin execute format('revoke all on sequence %s from public, anon, authenticated, service_role', pg_get_serial_sequence('public.journal', 'seq')); end $$;
revoke all on function public.journal_context() from public, anon, authenticated, service_role;
revoke all on function public.events_entry() from public, anon, authenticated, service_role;
revoke all on function public.pumps_entry() from public, anon, authenticated, service_role;
revoke all on function public.journal_write() from public, anon, authenticated, service_role;
revoke all on function public.journal_append_only() from public, anon, authenticated, service_role;
revoke all on function public.journal_lock() from public, anon, authenticated, service_role;
revoke all on function public.journal_guard() from public, anon, authenticated, service_role;
revoke all on function public.journal_next_recorded_at() from public, anon, authenticated, service_role;
-- pas de temps réel sur le journal : il n'est lu que par la sauvegarde

-- ---------------------------------------------------------------- 7. reprise de l'existant (une seule fois par ligne)
-- 7a. les corrections et suppressions déjà gardées par 0002 (90 jours au plus), avec leur ancienne ligne et leur heure
do $$
begin
  if to_regclass('public.event_revisions') is not null then
    insert into public.journal (tbl, row_id, op, old_row, new_row, source, changed_at, via, legacy_revision_id)
    select 'events', r.event_id::text, 'legacy_' || r.action, r.old_row, null, r.old_row ->> 'source', r.changed_at, 'migration', r.id
    from public.event_revisions r
    where not exists (select 1 from public.journal j where j.legacy_revision_id = r.id)
    order by r.id;
  end if;
end;
$$;

-- 7b. point de départ : l'état de chaque ligne au moment de la migration. Avant ce point, l'historique est incomplet.
insert into public.journal (tbl, row_id, op, new_row, source, via)
select 'events', e.id::text, 'baseline', to_jsonb(e), e.source, 'migration' from public.events e
where not exists (select 1 from public.journal j where j.tbl = 'events' and j.row_id = e.id::text and j.op not like 'legacy_%')
order by e.started_at;
insert into public.journal (tbl, row_id, op, new_row, source, via)
select 'pumps', p.id::text, 'baseline', to_jsonb(p), p.source, 'migration' from public.pumps p
where not exists (select 1 from public.journal j where j.tbl = 'pumps' and j.row_id = p.id::text)
order by p.at;
insert into public.journal (tbl, row_id, op, new_row, via)
select 'baby', b.id::text, 'baseline', to_jsonb(b) - 'photo', 'migration' from public.baby b
where not exists (select 1 from public.journal j where j.tbl = 'baby' and j.row_id = b.id::text);

commit;
