-- Margherite : un seul foyer, un seul utilisateur Supabase (le « code famille » est son mot de passe).
-- À exécuter une fois : Supabase > SQL Editor > coller ce fichier > Run.

-- ---------------------------------------------------------------- le bébé (une seule ligne)
create table if not exists public.baby (
  id int primary key default 1 check (id = 1),
  first_name text not null check (length(trim(first_name)) > 0),
  birth_at timestamptz not null,
  photo text, -- petite photo carrée en JPEG (~40 Ko) sous forme de texte (data URL)
  updated_at timestamptz not null default now()
);
-- pour une base créée avant l'ajout de la photo : relancer ce fichier ajoute la colonne
alter table public.baby add column if not exists photo text;

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

-- ---------------------------------------------------------------- réglages partagés (une ligne par clé)
-- trk : suivis perso de l'Accueil · trl : leurs relevés · notes : « À retenir » · well : humeur, digestion, selles, santé du bébé · tipsX : repères masqués
-- Chaque clé est un petit document JSON réécrit en entier : si les deux téléphones modifient la même clé au même instant, le dernier gagne.
create table if not exists public.kv (
  key text primary key check (key in ('trk', 'trl', 'notes', 'well', 'tipsX')),
  value jsonb not null,
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
drop trigger if exists kv_touch on public.kv;
create trigger kv_touch before update on public.kv for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- sécurité : seul l'utilisateur connecté (le foyer) lit et écrit
alter table public.baby enable row level security;
alter table public.events enable row level security;
alter table public.pumps enable row level security;
alter table public.kv enable row level security;

do $$
declare t text;
begin
  foreach t in array array['baby', 'events', 'pumps', 'kv'] loop
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
  foreach t in array array['baby', 'events', 'pumps', 'kv'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end;
$$;

