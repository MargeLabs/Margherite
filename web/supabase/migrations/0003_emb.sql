-- Broderies de la page Comprendre, partagées entre les deux téléphones.
-- La table `kv` n'accepte que des clés connues : on ajoute `emb` (une liste JSON de broderies, réécrite en entier ; en cas d'écriture
-- simultanée, la dernière gagne). Sans cette migration l'app continue de marcher : les broderies restent alors sur chaque appareil.
-- À exécuter une fois dans Supabase › SQL Editor. Relançable sans danger.
alter table public.kv drop constraint if exists kv_key_check;
alter table public.kv add constraint kv_key_check check (key in ('trk', 'trl', 'notes', 'well', 'tipsX', 'emb'));
