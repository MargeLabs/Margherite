-- Retour arrière, NIVEAU 2 : retirer entièrement le journal 0004 (déclencheurs, fonctions, table `journal`).
-- DESTRUCTIF POUR LE JOURNAL SEULEMENT : la table `journal` est supprimée. Faire d'abord un export (npm run export) : il contient
-- le journal dans le fichier JSON (version 2). Les événements, tirages, fiche bébé, réglages et event_revisions (0002) ne sont jamais touchés.
-- Les colonnes ajoutées (`source` élargie, `provenance`) restent : inertes, sans danger, et elles gardent l'information déjà acquise.
-- L'app fonctionne comme avant 0004 (elle n'a jamais lu le journal).
-- Pour reposer 0004 plus tard : relancer 0004_journal.sql (il repart d'un nouveau point de départ).
begin;
select pg_advisory_xact_lock(918273, 1);
drop trigger if exists events_lock on public.events;
drop trigger if exists events_entry on public.events;
drop trigger if exists events_journal on public.events;
drop trigger if exists events_no_truncate on public.events;
drop trigger if exists pumps_lock on public.pumps;
drop trigger if exists pumps_entry on public.pumps;
drop trigger if exists pumps_journal on public.pumps;
drop trigger if exists pumps_no_truncate on public.pumps;
drop trigger if exists baby_lock on public.baby;
drop trigger if exists baby_journal on public.baby;
drop trigger if exists baby_no_truncate on public.baby;
-- les déclencheurs de la table journal (ajout seul, garde) partent avec elle ; on les retire d'abord pour pouvoir la supprimer
drop trigger if exists journal_no_change on public.journal;
drop trigger if exists journal_no_truncate on public.journal;
drop trigger if exists journal_guard on public.journal;
drop table if exists public.journal;
drop function if exists public.journal_next_recorded_at();
drop function if exists public.journal_lock();
drop function if exists public.journal_context();
drop function if exists public.events_entry();
drop function if exists public.pumps_entry();
drop function if exists public.journal_write();
drop function if exists public.journal_append_only();
drop function if exists public.journal_guard();
commit;
