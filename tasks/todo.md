# Todo — Margherite

> Mis à jour à chaque session. Cocher les tâches terminées.

## Objectif de session
Livrer v1 : saisie G/D en mL, totaux par tirage et par jour, moyennes, installable sur téléphone, hébergée.

## Plan v1

- [x] **1. Calculs (TDD)** — `stats.js` + `stats.test.mjs` → `node --test` : 6/6
- [x] **2. UI un seul écran** — `index.html` (saisie G/D/date, total en direct, bloc Aujourd'hui, moyennes, historique par jour avec modifier/supprimer)
- [x] **3. Persistance + sauvegarde** — `localStorage` `margherite.v1`, export CSV, sauvegarde/restauration JSON (fusion par id), garde-fou données corrompues
- [x] **4. PWA** — `manifest.webmanifest`, `sw.js` (stale-while-revalidate), icônes PNG 192/512/180 ; vérifié hors-ligne
- [x] **5. Qualité frontend** — `/impeccable audit` (17/20, détecteur à 0) puis polish appliqué
- [x] **6. Vérification mobile** — Playwright 375×812 + 320 px, clair/sombre, 37/37 checks
- [x] **7. Commit** — repo git dédié dans `Margherite/`
- [x] **8. Déploiement** — https://margherite.netlify.app (Netlify) + code sur github.com/MargeLabs/Margherite ; vérifié en ligne (10/10 : HTTPS, installable, hors-ligne)
- [ ] **9. Test sur un vrai téléphone** — ouvrir https://margherite.netlify.app, « Ajouter à l'écran d'accueil », saisir un tirage, couper le réseau, rouvrir (testé seulement sur navigateur émulé)

## Hors périmètre v1 (YAGNI)
Comptes, sync cloud, graphiques, rappels/notifications, notes par tirage, unités oz, multi-utilisateurs, thème sombre manuel.

## Backlog
- Relier Netlify à GitHub (déploiement auto au push) : demande de ne publier qu'un sous-dossier- Indicateur « dernière sauvegarde » (le vrai risque produit = perte de données si le téléphone est changé / cache vidé)
- Surligner la ligne en cours de modification dans l'historique
- Sync multi-appareils (Supabase) si un second appareil est demandé
