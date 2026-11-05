-- Retour arrière, NIVEAU 1 : mettre le journal 0004 en pause. Rien n'est supprimé, le journal reste lisible.
-- À utiliser si l'app se comporte mal après 0004 (écriture refusée, lenteur) et qu'il faut la rouvrir tout de suite.
-- Effet : les écritures de l'app ne sont plus tracées. Le moteur le détecte (chaîne rompue) et retombe en mode dégradé, sans faux résultat.
-- Les événements, tirages, fiche bébé et réglages ne sont pas touchés. event_revisions (0002) continue de tourner.
-- Pour remettre en marche : relancer 0004_journal.sql (relançable, il recrée les déclencheurs) ; les écritures faites pendant la pause
-- n'auront pas d'entrée détaillée : un point de départ est reposé seulement pour les lignes sans aucune entrée.
begin;
select pg_advisory_xact_lock(918273, 1);
alter table public.events disable trigger events_lock;
alter table public.events disable trigger events_entry;
alter table public.events disable trigger events_journal;
alter table public.pumps disable trigger pumps_lock;
alter table public.pumps disable trigger pumps_entry;
alter table public.pumps disable trigger pumps_journal;
alter table public.baby disable trigger baby_lock;
alter table public.baby disable trigger baby_journal;
commit;
