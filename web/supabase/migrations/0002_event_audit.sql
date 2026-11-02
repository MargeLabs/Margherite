-- Traçabilité des corrections, pour que le moteur n'apprenne pas sur une erreur. Additif : rien n'est supprimé, l'app n'a rien à changer.
-- À exécuter une fois : Supabase > SQL Editor > coller ce fichier > Run. Rejouable. Faire un export JSON (Profil) avant.

-- ---------------------------------------------------------------- origine de la saisie : chrono, en direct, après coup (vide tant que l'app ne l'écrit pas)
alter table public.events add column if not exists source text check (source is null or source in ('timer', 'live', 'later'));

-- ---------------------------------------------------------------- anciennes valeurs d'un événement modifié ou supprimé, gardées 90 jours
create table if not exists public.event_revisions (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  action text not null check (action in ('update', 'delete')),
  old_row jsonb not null,
  changed_at timestamptz not null default now()
);
create index if not exists event_revisions_event_idx on public.event_revisions (event_id);
create index if not exists event_revisions_changed_idx on public.event_revisions (changed_at);

create or replace function public.keep_event_revision() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- fin d'un chrono : le fonctionnement normal, pas une correction
  if tg_op = 'UPDATE' and old.ended_at is null and new.ended_at is not null and old.started_at = new.started_at and old.payload = new.payload then
    return new;
  end if;
  insert into public.event_revisions (event_id, action, old_row) values (old.id, lower(tg_op), to_jsonb(old));
  delete from public.event_revisions where changed_at < now() - interval '90 days';
  return coalesce(new, old);
end;
$$;

drop trigger if exists events_revision on public.events;
create trigger events_revision after update or delete on public.events for each row execute function public.keep_event_revision();

-- lecture et écriture réservées au trigger ; pas de temps réel sur cette table
alter table public.event_revisions enable row level security;
