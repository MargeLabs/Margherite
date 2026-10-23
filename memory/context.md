# Mémoire — Margherite

> Fichier de contexte long terme. Complément au CLAUDE.md pour les infos volumineuses.
> Référencer depuis CLAUDE.md si nécessaire.

## Décisions d'architecture
- **2026-10-23 — PWA statique vanilla, sans build.** Un seul écran, une seule utilisatrice : pas de framework. Pas de Next.js/Supabase (stack par défaut de Victor écartée volontairement).
- **2026-10-23 — Stockage `localStorage` uniquement.** Pas de compte, pas de backend, données privées sur l'appareil. Contrepartie : pas de sync, risque de perte si cache vidé → export CSV/JSON prévu en v1.
- **2026-10-23 — Calculs dans `stats.js` (fonctions pures)** pour être testables avec `node --test` sans framework ni DOM.
- **2026-10-23 — Définition des moyennes :** moyenne/jour = total ÷ nombre de jours ayant ≥ 1 tirage ; moyenne/tirage = total ÷ nombre de tirages ; moyenne G et D calculées séparément.
- **2026-10-23 — Hébergement :** statique, Vercel par défaut (alternatives : Netlify, Cloudflare Pages, GitHub Pages). Victor héberge, l'utilisatrice finale n'a rien à configurer.

## Intégrations externes
Aucune. (Pas d'API, pas de clé, pas de secret.)

## Historique des sessions
- **2026-10-23** — Création du projet via `/new-project`. Structure + plan v1 écrits dans `tasks/todo.md`.
- **2026-10-23** — Plan validé, v1 construite : `stats.js` (TDD), `index.html`, PWA, icônes. Vérifiée en E2E mobile (375 px et 320 px, clair/sombre, hors-ligne, export/import). Audit impeccable 17/20 → polish (données corrompues sauvegardées, stats masquées au premier lancement, placeholder contrasté, scroll respectant `prefers-reduced-motion`). Commit initial dans un repo git dédié. Déploiement laissé à Victor.
