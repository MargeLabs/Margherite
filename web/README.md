# Margherite — l'application (Next.js + Supabase + Vercel)

Le suivi de bébé de Victor et Luana : repas, sommeil, changes, tire-lait, et les habitudes qui s'en déduisent.
Utilisée à deux téléphones en même temps (le chrono lancé sur l'un s'arrête sur l'autre), installée sur l'écran d'accueil de l'iPhone.

L'application reprend **telle quelle** la maquette V5 (`../maquettes/v5/project/Prototype.dc.html`) : `npm run gen:view` en extrait le CSS, le gabarit et la logique de calcul, et y applique les correctifs de `scripts/patches.mjs` (vraies données, profil, import). Toute la liste des écarts avec la maquette est en tête de ce fichier.

## Mise en ligne, pas à pas (à faire une fois)

### 1. Supabase (la base)
1. <https://supabase.com> › New project (région Europe). Garder le mot de passe de la base quelque part, on ne s'en sert pas ici.
2. **SQL Editor** › New query › coller le contenu de `supabase/migrations/0001_init.sql` › Run. Le fichier est relançable sans risque (base déjà créée avant l'ajout de la photo : le relancer ajoute la colonne manquante).
3. **Authentication › Sign In / Providers › Email** : désactiver *Confirm email*. **Authentication › Sign In / Providers** (réglages généraux) : désactiver *Allow new users to sign up* (personne d'autre ne doit pouvoir créer de compte).
4. **Authentication › Users › Add user › Create new user** : une adresse e-mail (la vôtre, elle sert d'identifiant technique) et comme mot de passe **le code famille** (au moins 12 caractères : il protège les données de votre bébé). Cocher *Auto Confirm User*.
5. **Project Settings › API** : noter *Project URL* et la clé *anon public*.

### 2. Vercel (le site)
1. <https://vercel.com> › Add New › Project › importer le dépôt GitHub `MargeLabs/Margherite`.
2. **Root Directory : `web`** (important : le dépôt contient aussi l'ancienne app et les maquettes).
3. Variables d'environnement (Production) :
   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | le *Project URL* |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé *anon public* |
   | `NEXT_PUBLIC_FAMILY_EMAIL` | l'adresse e-mail de l'étape 1.4 |

   Ne **pas** définir `NEXT_PUBLIC_DATA` (c'est le mode de développement).
4. Deploy. Chaque `git push` sur `main` redéploie.

### 3. Sur l'iPhone
Safari › ouvrir l'adresse Vercel › Partager › **Sur l'écran d'accueil**. Ouvrir ensuite Margherite depuis son icône : elle s'ouvre en plein écran. Au premier lancement : le **code famille**, puis le prénom, la date et l'heure de naissance. Faire pareil sur le second téléphone (le bébé est déjà là).

### 4. Reprendre l'ancien carnet de tire-lait
Accueil › carte *Journal tire-lait* › **Importer l'ancien carnet** : choisir la sauvegarde JSON ou l'export CSV de l'ancienne app. Importer deux fois le même fichier ne double rien.

## Recette à deux téléphones (la seule étape que le développement ne peut pas faire seul)
- [ ] Téléphone A : Dodo › *Lancer le chrono*. Téléphone B (déjà ouvert) : « Il dort » apparaît en quelques secondes.
- [ ] B : « + » › *Arrêter* › *Enregistrer ce réveil*. A : le dodo est terminé et apparaît au Journal.
- [ ] A et B lancent le chrono presque en même temps : un seul gagne, l'autre voit le dodo en cours (pas de doublon).
- [ ] Un biberon noté sur A apparaît sur B ; supprimé sur B, il disparaît de A.
- [ ] Fermer et rouvrir l'app, le lendemain : tout est encore là.
- [ ] Mauvais code famille : message « Ce n'est pas le bon », rien d'autre.
- [ ] Profil › *Télécharger toutes les données* : un fichier JSON est proposé.

## Ce qu'il faut savoir (limites assumées)
- **Il faut du réseau.** Pas de mode hors ligne : si une écriture échoue, l'écran le dit (« Ce n'est pas enregistré… tu peux réessayer ») et rien n'est perdu côté saisie.
- **Réglages partagés : le dernier qui écrit gagne** (suivis perso, notes, humeur du bébé). Les cases « maman » de l'humeur ne quittent jamais le téléphone.
- **Le code est partagé** : l'app ne sait pas qui a noté quoi.
- **Supabase gratuit met le projet en pause après ~7 jours sans aucune activité, et ne fait pas de sauvegarde automatique.** Utilisée tous les jours, aucun risque de pause ; faire de temps en temps *Profil › Télécharger toutes les données*.
- **Repères d'âge masqués** (« 14 à 17 h de sommeil à 9 semaines »…) : ce sont des exemples de la maquette, sans source. L'interrupteur `AGE_REFS` est dans `scripts/patches.mjs` ; ne le passer à `true` qu'avec des sources validées (voir `../INTELLIGENCE.md`, section 10). L'app n'affiche donc que ce qui est calculé sur vos notes.
- Passage à l'heure d'été / d'hiver : un dodo à cheval sur le changement est décalé d'une heure ce jour-là.

## Développement
```
cd web
npm install
NEXT_PUBLIC_DATA=local npm run dev      # PowerShell : $env:NEXT_PUBLIC_DATA='local'; npm run dev
```
Mode local = données dans le navigateur, sans Supabase. Réglages d'URL (mode local seulement) : `/?demo=1` charge les 28 jours d'exemple de la maquette, `&now=2026-10-27T14:20` fige l'heure, `&screen=comprendre&cview=hc` ouvre un écran. `/mockup` affiche la maquette brute.

| Commande | Rôle |
|---|---|
| `npm test` | tests : calculs (habitudes, journée et nuit types, À retenir), import tire-lait (avec un vrai export), chrono partagé, réglages, profil |
| `npm run gen:view` | régénère la vue depuis la maquette (à relancer quand la maquette change) |
| `node scripts/e2e/app.cjs` | parcours complet dans un navigateur : premier lancement, deux téléphones, import, profil (serveur local lancé avant) |
| `APP_MODE=app node scripts/fidelity/fidelity.cjs` puis `python scripts/fidelity/fidcmp.py` | compare 19 écrans de l'app à la maquette, pixel par pixel (voir l'en-tête du script) |

Les calculs (habitudes, journée type, nuit type, liens, « À retenir ») vivent dans la logique de la maquette ; `src/legacy/calc.test.ts` la fait tourner sur des journaux dont la bonne réponse est connue, et sur des journaux vides, partiels ou troués : une note manquante n'est jamais comptée comme une absence de sommeil, et rien n'est affiché comme habituel sans assez de journées notées en entier.


