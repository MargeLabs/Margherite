-- Photo du bébé (affichée sur la carte de l'Accueil). À exécuter une fois : Supabase > SQL Editor > coller > Run.
-- La photo est une petite image carrée en JPEG (~40 Ko) stockée sous forme de texte (data URL) dans la ligne du bébé.
alter table public.baby add column if not exists photo text;
