-- Margherite : un seul foyer, un seul utilisateur Supabase (le « code famille » est son mot de passe).
-- À exécuter une fois : Supabase > SQL Editor > coller ce fichier > Run.

-- ---------------------------------------------------------------- le bébé (une seule ligne)
create table if not exists public.baby (
  id int primary key default 1 check (id = 1),
  first_name text not null check (length(trim(first_name)) > 0),
  birth_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- événements : sein, biberon, dodo, change
-- ended_at est null tant que le dodo (le chrono) est en cours : c'est ce qui permet de l'arrêter depuis un autre téléphone.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bib', 'sein', 'sleep', 'chg')),
  started_at timestamptz not null,
  ended_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (kind = 'sleep' or ended_at is null)
);
create index if not exists events_started_idx on public.events (started_at desc);
-- un seul chrono de dodo à la fois, partagé entre les deux téléphones
create unique index if not exists events_one_running_sleep on public.events ((true)) where kind = 'sleep' and ended_at is null;

-- ---------------------------------------------------------------- tire-lait
-- legacy_id : identifiant de l'ancienne app (ou dérivé du CSV) ; sert à ne pas importer deux fois le même tirage.
create table if not exists public.pumps (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  at timestamptz not null,
  left_ml int not null check (left_ml >= 0),
  right_ml int not null check (right_ml >= 0),
  created_at timestamptz not null default now()
);
create index if not exists pumps_at_idx on public.pumps (at desc);

-- ---------------------------------------------------------------- suivis perso de l'Accueil
create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('fait', 'compteur', 'qte')),
  unit text not null default '',
  icon text not null default '#i-heart',
  created_at timestamptz not null default now()
);
create table if not exists public.tracker_logs (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.trackers (id) on delete cascade,
  at timestamptz not null,
  value numeric not null default 1
);
create index if not exists tracker_logs_at_idx on public.tracker_logs (tracker_id, at desc);

-- ---------------------------------------------------------------- notes « À retenir » et humeur / digestion / santé du bébé
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now()
);
create table if not exists public.day_notes (
  day date primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- date de dernière modification
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists baby_touch on public.baby;
create trigger baby_touch before update on public.baby for each row execute function public.touch_updated_at();
drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
drop trigger if exists day_notes_touch on public.day_notes;
create trigger day_notes_touch before update on public.day_notes for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- sécurité : seul l'utilisateur connecté (le foyer) lit et écrit
alter table public.baby enable row level security;
alter table public.events enable row level security;
alter table public.pumps enable row level security;
alter table public.trackers enable row level security;
alter table public.tracker_logs enable row level security;
alter table public.notes enable row level security;
alter table public.day_notes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['baby', 'events', 'pumps', 'trackers', 'tracker_logs', 'notes', 'day_notes'] loop
    execute format('drop policy if exists "foyer" on public.%I', t);
    execute format('create policy "foyer" on public.%I for all to authenticated using (true) with check (true)', t);
    execute format('alter table public.%I replica identity full', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- temps réel : le chrono lancé sur un téléphone apparaît sur l'autre
do $$
declare t text;
begin
  foreach t in array array['baby', 'events', 'pumps', 'trackers', 'tracker_logs', 'notes', 'day_notes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;
