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
**En ligne : https://margherite.netlify.app** (Netlify, compte de Victor, site id `75c3de0a-cbc0-4f52-a4d7-fce3ff60bc6c`, déploiement manuel).
Code : https://github.com/MargeLabs/Margherite (privé, branche `main`). Le site Netlify n'est **pas** relié à GitHub : un `git push` ne redéploie rien.

Redéployer (aucun build) :
1. Copier dans un dossier temporaire **uniquement** les fichiers publics : `index.html stats.js sw.js manifest.webmanifest _headers banner.webp icon-192.png icon-512.png apple-touch-icon.png` (jamais `CLAUDE.md`, `tasks/`, `memory/`, `stats.test.mjs`, `.git`).
2. Appeler l'outil MCP Netlify `deploy-site` avec le site id ci-dessus : il renvoie une commande `npx -y @netlify/mcp@latest --site-id … --proxy-path …` (jeton à usage unique, à relancer à chaque déploiement).
3. L'exécuter depuis ce dossier temporaire, puis vérifier https://margherite.netlify.app (service worker : recharger deux fois pour voir la nouvelle version).
`index.html` contient `noindex` : l'app est publique mais non référencée.
Sinon plus simple à terme : relier le site à GitHub dans le tableau de bord Netlify (nécessite de ne publier qu'un sous-dossier, sinon `CLAUDE.md` et `tasks/` seraient en ligne).

## Fichiers importants
- `index.html` — UI (un seul écran) + logique d'interface
- `stats.js` — calculs purs : total tirage, total/jour, moyenne/tirage, moyenne/jour, moyenne G vs D
- `stats.test.mjs` — test des calculs
- `sw.js` — cache offline en stale-while-revalidate : la nouvelle version arrive au chargement suivant. Changer `CACHE` seulement si un fichier est renommé/supprimé ou si l'API de `stats.js` change
- `manifest.webmanifest` — nom, icônes, `display: standalone`
- `_headers` — Netlify : sert le manifest en `application/manifest+json` (sinon `octet-stream`)
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — marguerite sur fond vert (générées par script, pas de source SVG)
- `banner.webp` — bannière en haut de l'app : image fournie par Victor (femme-vache et bébé dans une prairie), réduite à 960×720 / ~99 Ko (source 1448×1086, 312 Ko). `alt=""` car décorative ; assombrie en mode sombre via `filter` CSS. Pour la remplacer : ré-encoder en WebP ≤ 100 Ko, garder le ratio 4:3 ou ajuster `width`/`height` de l'`<img>`

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
- [2026-10-23] — Déployée sur https://margherite.netlify.app (Netlify, manuel) ; code poussé sur le dépôt privé MargeLabs/Margherite. Vérifiée en ligne : 10/10 (HTTPS, installable PWA, hors-ligne, persistance).
- [2026-10-23] — Sauvegarde/restauration : feuille de partage sur écran tactile, téléchargement sinon. Import = fusion par `id`, jamais de remplacement.
- [2026-10-26] — Évolution vers une app de suivi bébé 0–6 mois : **phase maquettes uniquement, aucun code modifié**. Le module tire-lait (données `margherite.v1`, logique `stats.js`) est conservé tel quel dans toutes les maquettes.
- [2026-10-26] — Maquettes v2 (« pilotage ») : https://claude.ai/artifact/L6RfjxDDSUJS4SsAbouARb — pages « Exploration » et « Version retenue ». **Référence à ne plus modifier.**
- [2026-10-26] — Maquettes v3 (« Comprendre ») dans un canevas séparé : https://claude.ai/artifact/4weGi7dvU2YFfjdyyKYGMx — 4 espaces Accueil / Pilotage / Comprendre / Journal ; tire-lait ouvert depuis l'Accueil et le bouton « Plus » ; bain et rituel du coucher ; repère d'âge sous chaque chiffre ; lait au biberon / jour. **En attente de la validation de Victor** avant tout plan de développement.
- [2026-10-26] — v3.1 publiée dans le même canevas v3 (retours de Victor) : cadran 24 h sur aujourd'hui + 4 jours précédents, nuit réelle (début de nuit d'hier hachuré, réveils fréquents 3 h–5 h 30), « pourquoi cette estimation » en 3 lignes (réveil + écart habituel = fenêtre), Comprendre ouvre sur Ses horaires, fiche d'enseignement données d'abord, Ses chiffres en tuiles colorées (tendance, position dans le repère, lait en mL/j ≈ 960 mL/j de repère). Données de démo rendues cohérentes (sommeil ≈ 12 h 15/24 h). En attente de validation.
- [2026-10-26] — v3.9 : maquette alimentée par des **données réelles** extraites d'une capture « Rythme » de l'app actuelle de Victor (`data/rythme_extrait.csv`, non commité) : ~11,5 repas/j, un repas toutes les ≈ 2 h en journée (1 h 50 → 2 h 25 en 6 jours), 2–3 repas de nuit, sommeil noté de façon incomplète (donc pas de moyenne). Plus de lait mL/j, changes ni période 28 jours (données absentes). Cadran : heures rondes toutes les 3 h, touchez un moment pour le lire, « Probable » en beurre.
- [2026-10-26] — v3.10 : Victor a refusé une maquette « toute repas ». Retour des étiquettes d'origine (Ses horaires : réveil, siestes, coucher ; Ses chiffres : sommeil/24 h, plus long sommeil, éveil moyen, lait, changes ; À retenir : repas → sieste, siestes les plus longues) recalculées sur la capture. Accueil : prochaine sieste probable ET prochain repas probable. Sommeil/24 h = 3 jours complets seulement (13 h 10) ; lait et changes « non noté ». Règle : ne pas supprimer une famille de contenu faute de données parfaites, l'afficher avec son niveau de fiabilité.
- [2026-10-26] — v3.15 : Pilotage ne répète plus l'Accueil. Accueil = 2 cartes (sieste / repas probables, heure de début, barre écoulé + fenêtre, lignes « Éveillé depuis / Dernier repas / Prochain repas »). Pilotage = cadran tactile + « Le reste de la journée » (sieste, repas, coucher), chaque ligne dépliable avec son calcul ; tuiles « éveillé depuis / prochain repas » supprimées (conservées pour les jours passés).
- [2026-10-26] — v3.16 (brief Pilotage de Victor) : horloge conservée ; « La suite probable » = une carte (sentence + fenêtre + « d'après… », planning à la demande) ; « Ce qu'on a remarqué sur ton bébé » = 2 découvertes **calculées dans la maquette** à partir du journal réel embarqué (`LOG` dans `Prototype.dc.html`, 6 jours) : éveil avant sieste d'après-midi (35 min–1 h 15, médiane 1 h, 9 siestes), repas → sommeil dans l'heure et quart (23/36), siestes d'après-midi, repas de nuit, espacement des repas ; sélection selon la situation (jour, sieste en cours, nuit) ; « Encore fragile » quand n < 8 ; tutoiement dans ces blocs (le reste de l'app est en « vous », à harmoniser). Siestes courtes → éveil suivant : n = 3, donc non affichée.
- [2026-10-26] — v3.17 : Comprendre › Ses horaires a deux sous-vues, « Journée type » (inchangée) et « Sa nuit » : v3.18 = une nuit type **étape par étape** (coucher 21 h → dernier repas du soir 23 h → repas de nuit 1 h 45, 3 h 30, 5 h 15 → premier repas du matin, écarts « X plus tard ») + 2 tuiles (repas de nuit 2 à 3, plus long sommeil 2 h 15). La frise « une ligne par nuit » a été refusée : illisible. Règle : une visualisation doit se comprendre sans légende. Prop `hview` (jour / nuit), tout calculé depuis `LOG`.
- [2026-10-26] — v3.19 : « Sa nuit » = comparer les 7 nuits de la semaine (barres, nuit = jour du matin où elle se termine) avec 2 tuiles-métriques cliquables (Repas de nuit / Plus long sommeil) ; la dernière nuit (dim.→lun.) est sélectionnée par défaut et met à jour les 2 tuiles ; la timeline reste toujours affichée (celle de la nuit choisie avec « habituel vers… », ou « Nuit type »). Moteur `NIGHTS` partagé (À retenir, Pilotage, Sa nuit). Dernière nuit : sommeil non noté, seulement 2 repas.
- [2026-10-26] — **État fin de session** : maquette v3.19 (version 32 du canevas) en attente de validation ; copie locale `maquettes/v3/` ; `data/rythme_extrait.csv` (non suivi par git) ; notes détaillées dans `memory/context.md` (« Reprendre les maquettes »). Préférences de Victor apprises : comprendre « direct » (pas de légende), pas de contenu supprimé faute de données parfaites (afficher la fiabilité), couleur, aucun planning permanent sous l'horloge, tutoiement dans Pilotage.
- [2026-10-27] — Direction « Jardin de joie » (canevas https://claude.ai/artifact/PUPP3En3PsK4s8W2dKChWi, version 10) : copie locale versionnée dans `maquettes/v4-jardin/project/` (source de vérité = l'artefact). Retours de Victor appliqués : marguerite animée derrière l'horloge retirée ; texte des tuiles Dodo/Repas à la ligne ; tout l'anneau de l'horloge est touchable (créneau le plus proche) ; phrase de synthèse « Cette semaine : … » retirée ; comparaison semaine = 6 cartes (cycles/nuit, durée d'un cycle, éveil moyen, repas/nuit, mange toutes les, par biberon), éveil et repas de nuit en neutre (jamais de « mieux » sur un repas).
- [2026-10-28] — V4 « Jardin de joie » (même canevas, version 12) : Comprendre refait en 3 entrées (onglets À retenir · Ses horaires [Journée / Nuit] · Ses chiffres). À retenir = 2 observations max calculées (repas → éveil avant la sieste, sieste → repas, dernière nuit vs habituelle, tendance) avec statut « Constaté » (sauge) / « Une habitude qui se dessine » (beurre) / « Encore fragile » (neutre) + période et n ; « Nous apprenons encore à connaître son rythme » si rien de solide ; rappel non médical. Journée type : frise V4 conservée + pastilles des repas qui reviennent + étapes avec éveils. Nuit type : phrase, 2 frises, 3 tuiles, détails repliés. Ses chiffres : 1 graphique + phrase + 2 tuiles (repas, siestes), liste complète repliée, plus de « réveils » jugés. Données = exemples V4 existants (Victor : « invente des données pour le moment »).
- [2026-10-28] — V4 version 14 : « Sa nuit type » aligné sur « Sa journée type » (demande de Victor) : la nuit habituelle d'abord (phrase, frise calculée sur les 7 nuits avant la nuit dernière, étape par étape dépliée : coucher, « dort ≈ », réveils de nuit avec ou sans repas, réveil du matin), puis « Et la nuit dernière ? » (flèches, phrase, frises habituelle/nuit alignées, 3 tuiles, détails repliés). Légende sous la frise de la journée retirée (« pas de légende »).
- [2026-10-28] — V4 version 23 : journée et nuit types ouvrent sur 4 repères « Le plus souvent » en petites tuiles blanches (journée : réveil, siestes, repas/24 h, coucher ; nuit : coucher, réveils de nuit, repas de nuit, réveil du matin) ; version à grands chiffres colorés essayée puis annulée. « Étape par étape » : durée en pastille, une ligne courte, éveils (journée) et sommeils (nuit) en pastilles sur un fil pointillé, pastille « un repas ». Nuit habituelle : biberons et heures/durées de dodo sur la frise. Heures sous la frise de la journée essayées puis retirées (Victor n'aime pas). Tuile « Il mange environ toutes les 2 h 40 ».
- [2026-10-28] — V4 version 25 : « Sa nuit type » simplifiée : 4 repères, une seule carte avec la nuit habituelle (biberons, heures et durées de dodo) au-dessus de la nuit dernière, une phrase de comparaison, puis deux dépliants fermés (« Sa nuit, étape par étape », « La nuit dernière en détail » avec les 5 lignes). Retirés : flèches pour remonter aux nuits passées, titre « Et la nuit dernière ? », 3 tuiles. « Sa journée, étape par étape » aussi plié par défaut.
- [2026-10-28] — V4 version 26 : Journal au même style que les listes étape par étape : quantité / durée en pastille à côté du titre (mL et min en pêche, sommeil en lilas), une ligne courte dessous (côté, type de change, heures du sommeil), éveil calculé en pastille « éveillé 1 h 30 » sur le fil pointillé.
- [2026-10-28] — V4 version 29 : listes étape par étape épurées (éveil / sommeil en texte simple sur le fil, repas = icône biberon, durées sans « ≈ ») ; nuit dernière avec les mêmes repères horaires que la nuit habituelle (début de chaque dodo + réveil, heure sautée si trop proche) ; pointillés jaunes « calculé » qui descendent de chaque heure habituelle jusqu'à la nuit dernière (`nty.gl`, `.cmp-g`, `top` calé à 100 px sous les heures).
- [2026-10-26] — Principes produit validés par Victor : simplicité, aucun écran qui défile à l'infini, valeurs écrites en mots plutôt qu'en symboles, estimations en intervalle (pas de compte à rebours), jamais d'enseignement inventé, association ≠ cause, aucun conseil de retarder un repas.

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
