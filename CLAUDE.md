# CLAUDE.md — Margherite

> 📖 À lire intégralement au démarrage de chaque nouvelle session Claude Code.

---

## Projet
Webapp mobile minimaliste de suivi de tire-lait : saisie par tirage (sein gauche / sein droit, en mL), total par tirage, total par jour, moyennes. Installable sur l'écran d'accueil du téléphone (PWA). Une seule utilisatrice, un seul appareil.

## Stack
- HTML / CSS / JS vanilla — **aucun build, aucun framework, aucune dépendance**
- Données en `localStorage` (pas de backend, pas de compte)
- PWA : `manifest.webmanifest` + `sw.js` (offline) + icônes PNG
- Logique de calcul isolée dans `stats.js` (fonctions pures), testée avec `node --test` (zéro lib de test)

> Écart assumé avec la stack par défaut (Next.js/Supabase) : surdimensionnée pour un carnet de saisie mono-utilisatrice.

## Lancement
```
npx serve .
```
Tests : `node --test`

## Deploy
Site statique, aucun build. Cible : Vercel (`vercel --prod` depuis le dossier). Alternatives équivalentes : Netlify drag & drop, Cloudflare Pages, GitHub Pages. HTTPS obligatoire (PWA + service worker) — fourni par tous.

## Fichiers importants
- `index.html` — UI (un seul écran) + logique d'interface
- `stats.js` — calculs purs : total tirage, total/jour, moyenne/tirage, moyenne/jour, moyenne G vs D
- `stats.test.mjs` — test des calculs
- `sw.js` — cache offline en stale-while-revalidate : la nouvelle version arrive au chargement suivant. Changer `CACHE` seulement si un fichier est renommé/supprimé ou si l'API de `stats.js` change
- `manifest.webmanifest` — nom, icônes, `display: standalone`
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — marguerite sur fond vert (générées par script, pas de source SVG)
- `cow.svg` — bannière en haut de l'app : vache dans une prairie, dessinée en SVG (7 Ko, offline, `alt=""` car décorative). Palette alignée sur l'app ; assombrie en mode sombre via `filter` CSS

## Modèle de données
Clé `localStorage` : `margherite.v1` → tableau de tirages
```
{ id: string, at: ISO-8601 local, left: number (mL), right: number (mL) }
```
Total d'un tirage = `left + right`. Jamais stocké, toujours recalculé.
`at` = `YYYY-MM-DDTHH:mm` en heure locale (valeur brute d'un `datetime-local`), le jour = `at.slice(0, 10)`.
Si `margherite.v1` est illisible au chargement, son contenu est copié dans `margherite.v1.corrupt` avant d'être écrasé.

## Skills à utiliser
- `tdd` — pour `stats.js` (logique non triviale)
- `webapp-testing` — vérification en viewport mobile (375×812)
- `impeccable` (audit puis polish) — avant livraison, règle globale frontend

---

## 🧠 Mémoire projet

> Contexte accumulé session après session. Mettre à jour à chaque fin de session.
> Format : [DATE] — [info clé apprise ou décision prise]

- [2026-10-23] — Projet créé. Décisions : PWA statique vanilla, localStorage only, pas de sync multi-appareils, hébergement statique (Vercel par défaut).
- [2026-10-23] — Moyenne/jour = calculée sur les jours ayant au moins un tirage (pas sur les jours calendaires vides). Moyenne/tirage affichée en plus.
- [2026-10-23] — v1 construite et vérifiée (6 tests unitaires + 37 checks E2E Playwright mobile, `/impeccable audit` + polish passés). Non déployée : Victor héberge lui-même.
- [2026-10-23] — Sauvegarde/restauration : feuille de partage sur écran tactile, téléchargement sinon. Import = fusion par `id`, jamais de remplacement.

---

## ⚙️ Guidelines de codage (Karpathy)

> Règles comportementales pour réduire les erreurs typiques des LLMs. Toujours appliquer.

### 1. Think Before Coding
**Ne pas supposer. Ne pas cacher la confusion. Exposer les compromis.**

Avant d'implémenter :
- Énoncer les hypothèses explicitement. Si incertain, demander.
- Si plusieurs interprétations existent, les présenter — ne pas choisir silencieusement.
- Si une approche plus simple existe, la proposer. Pousser en arrière si justifié.
- Si quelque chose est flou, s'arrêter. Nommer ce qui est confus. Demander.

### 2. Simplicity First
**Minimum de code qui résout le problème. Rien de spéculatif.**

- Pas de features au-delà de ce qui a été demandé.
- Pas d'abstractions pour du code à usage unique.
- Pas de "flexibilité" ou "configurabilité" non demandée.
- Pas de gestion d'erreurs pour des scénarios impossibles.
- Si 200 lignes peuvent s'écrire en 50, réécrire.

Se demander : "Un senior engineer dirait-il que c'est trop compliqué ?" Si oui, simplifier.

### 3. Surgical Changes
**Toucher uniquement ce qui est nécessaire. Nettoyer uniquement son propre désordre.**

Lors de modifications de code existant :
- Ne pas "améliorer" le code adjacent, les commentaires ou le formatage.
- Ne pas refactoriser ce qui n'est pas cassé.
- Correspondre au style existant, même si on ferait différemment.
- Si du code mort non lié est détecté, le signaler — ne pas le supprimer.

Quand les modifications créent des orphelins :
- Supprimer les imports/variables/fonctions que SES PROPRES modifications ont rendus inutilisés.
- Ne pas supprimer le code mort préexistant sauf demande explicite.

Test : Chaque ligne modifiée doit tracer directement vers la demande de l'utilisateur.

### 4. Goal-Driven Execution
**Définir les critères de succès. Boucler jusqu'à vérification.**

Transformer les tâches en objectifs vérifiables :
- "Ajouter une validation" → "Écrire des tests pour les inputs invalides, puis les faire passer"
- "Corriger le bug" → "Écrire un test qui le reproduit, puis le faire passer"
- "Refactoriser X" → "S'assurer que les tests passent avant et après"

Pour les tâches multi-étapes, énoncer un plan bref :
```
1. [Étape] → vérifier : [check]
2. [Étape] → vérifier : [check]
3. [Étape] → vérifier : [check]
```

---

## 🔚 Fin de session

> À exécuter systématiquement avant de fermer Claude Code, sans attendre que l'utilisateur le demande.

1. Mettre à jour la section `🧠 Mémoire projet` ci-dessus avec les décisions et apprentissages de la session
2. Mettre à jour `tasks/todo.md` — cocher les tâches terminées, ajouter les tâches restantes
3. Ajouter les erreurs rencontrées dans `tasks/lessons.md` au format `[DATE] — contexte / Erreur / Règle`
4. Compléter `memory/context.md` si une décision d'architecture ou une intégration nouvelle a été faite
