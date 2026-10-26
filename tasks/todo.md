# Todo — Margherite

> Mis à jour à chaque session. Cocher les tâches terminées.

## Objectif de la prochaine session
Obtenir la validation de la v3 (canevas « Margherite v3 — Comprendre »), trancher les arbitrages ci-dessous, puis écrire le plan de développement. Aucun code avant validation explicite de Victor.

## Objectif v1 (livré)
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

## v2 — Refonte « suivi bébé 0–6 mois » (2026-10-26)
Maquettes : https://claude.ai/artifact/L6RfjxDDSUJS4SsAbouARb (design system, prototype interactif, écrans, états).
- [x] **Audit** de l'existant et du module tire-lait
- [x] **Design system + maquettes** (Artifact Design), audit impeccable + polish
- [x] **v2 maquettes « pilotage »** (retour de Victor : simplicité, pas de défilement infini, vrai centre de pilotage) — 4 onglets, Pilotage en 3 vues (Maintenant / Rythme / Tendances)
- [x] **Rythme refait en horaire lisible** (heure habituelle, fourchette en mots, jauge de fiabilité, détail au tap) — densité retirée
- [x] **Page « Version retenue »** sur le canevas (design system à jour, prototype, écrans, saisie, états) ; l'exploration reste sur la page « Exploration »
- [x] **v3 « Comprendre »** dans un Artifact Design séparé (https://claude.ai/artifact/4weGi7dvU2YFfjdyyKYGMx) ; la v2 reste intacte (https://claude.ai/artifact/L6RfjxDDSUJS4SsAbouARb). 4 espaces Accueil / Pilotage / Comprendre / Journal, bain et rituel, repère sous chaque chiffre, lait au biberon / jour
- [ ] **Validation de la v3 par Victor** — aucune ligne de code avant
- [ ] **Arbitrages à trancher :**
  - A1 · Synchro entre les deux parents (espace familial, minuteurs communs) : demande un serveur et des comptes (Supabase recommandé), ou v3 sans synchro
  - A2 · Stack : rester en HTML/JS vanilla (recommandé, le module tire-lait reste intact) ou passer à un framework
  - A3 · Bouton « Plus » à la place du raccourci Tire-lait (tire-lait à 2 gestes depuis la barre, 1 geste depuis la carte de l'Accueil)
  - A4 · Sources des repères marquées « à valider avec la pédiatre » : éveil (1 h 15–2 h), lait (~150 mL/kg/j), changes (≥ 6 couches mouillées/j)
  - A5 · Profil du bébé : prénom, date de naissance, pesées (le repère lait en dépend ; 6,4 kg est une valeur de démo)
  - A6 · Périmètre soins : change, bain, rituel ; température, médicaments, etc. plus tard
- [ ] Plan de développement détaillé (après validation)

## Hors périmètre v1 (YAGNI)
Comptes, sync cloud, graphiques, rappels/notifications, notes par tirage, unités oz, multi-utilisateurs, thème sombre manuel.

## Backlog
- Relier Netlify à GitHub (déploiement auto au push) : demande de ne publier qu'un sous-dossier- Indicateur « dernière sauvegarde » (le vrai risque produit = perte de données si le téléphone est changé / cache vidé)
- Surligner la ligne en cours de modification dans l'historique
- Sync multi-appareils (Supabase) si un second appareil est demandé
