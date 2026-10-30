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
- [2026-10-28] — V4 version 29 : listes étape par étape épurées (éveil / sommeil en texte simple sur le fil, repas = icône biberon, durées sans « ≈ ») ; nuit dernière avec les mêmes repères horaires que la nuit habituelle (début de chaque dodo + réveil, heure sautée si trop proche).
- [2026-10-28] — V4 version 31 : pointillés jaunes retirés (« intègre mieux ») ; créneaux habituels en fantôme hachuré sous les dodos de la nuit dernière. **Fiabilité = option C choisie par Victor, dans les listes « étape par étape »** (pas sur les frises horizontales, essai retiré) : 3 points lilas à droite de chaque étape (réveil, siestes, coucher ; nuit : coucher, réveils, réveil du matin). Niveau = présent ≥ 80 % des jours/nuits (+2, ≥ 50 % +1) + heure stable à ≤ 20 min (+1), plafonné à 2 sous 5 jours/nuits notés en entier ; une ligne « Les points à droite : plus il y en a, plus ce moment revient à la même heure. » Sous les repères : « D'après N journées/nuits notées en entier sur les 7 dernières. »
- [2026-10-28] — V4 version 35 : sous la carte de nuit, phrase courte + écarts en pastilles lilas (« Couché 30 min plus tard », « Plus long sommeil : 25 min de plus », réveils hors fourchette) + ligne « La veille : … » (dernière sieste ou nombre de siestes hors de ses 7 jours d'avant, sans conclure) + « Une nuit seule ne fait pas une tendance. » ; tuile « Réveils de nuit » avec « cycle ≈ X » ; « Détail du sommeil » en 3 lignes intitulé/valeur/détail. **Liens journée → nuit** (À retenir, carte « Un lien qui se dessine », prioritaire sur la nuit dernière) : nuits des 3 dernières semaines, facteurs = dernière sieste après son heure médiane (arrondie au ¼ h) ou ≥ 4 siestes ; issues = endormissement, plus long sommeil, réveils ; affichée seulement si ≥ 5 nuits par groupe, écart ≥ 30 min (ou 1 réveil) et même sens ≥ 7 fois sur 10 ; jamais de cause ni de conseil. Données d'exemple modifiées pour la montrer : jours à 4 siestes → coucher + 35 min.
- [2026-10-28] — V4 version 36 : « La nuit dernière en détail » = liste (libellé, valeur en gras, écart en pastille lilas ou « comme d'habitude » en gris) + une ligne « D'habitude : … » ; écarts calculés sur les valeurs arrondies affichées ; « Plus long bloc » → « Plus long sommeil ». Petite lune dans chaque créneau de sommeil des frises horizontales (journée type, nuit habituelle, nuit dernière) pour comprendre « il dort » sans légende. Backlog : synthèse exportable par mois pour le pédiatre.
- [2026-10-28] — V4 version 37 : fiche « Détail du dodo » = une réponse (« il a dormi combien, et c'est habituel ? ») : rang (2e sieste, son plus long sommeil de la nuit…), écart à l'habitude en pastille ou « comme d'habitude », heure hors fourchette, éveil avant la sieste ; repas avant / après retirés (suggéraient une cause). « La veille » en pastilles beurre, comparée aux médianes des 7 jours d'avant : dernière sieste (plus tard, plus longue), total des siestes, éveil avant le coucher, ou « une journée comme d'habitude » ; « À rapprocher, sans conclure ». But de Sa nuit type selon Victor : comprendre si un coucher plus tardif / une nuit différente coïncide avec une sieste plus tardive ou plus longue la veille.
- [2026-10-28] — V4 version 39 : **Journal › Calendrier** (inspiré du suivi quotidien de Flo) : bascule Jour / Calendrier, mois en grille avec un point par catégorie notée (humeur = beurre, digestion = menthe, santé = ciel, maman = rose), carte du jour avec pastilles et boutons « + Pour Léo » / « + Pour moi ». Feuilles à pastilles enregistrées au toucher. Bébé = **humeur, digestion, selles, santé uniquement, aucun rendez-vous** (demande de Victor). Maman = humeur, nuit, allaitement, corps, moral, pour moi ; « Ces notes sont pour toi : elles ne sont pas partagées ». Messages d'orientation (fièvre avant 3 mois → médecin ou 15 ; refus de boire / vomissements ; idées noires → 3114 ; tristesse qui dure > 2 semaines ; sein rouge ou fièvre ; saignements abondants) : jamais de diagnostic, **seuils à faire valider par un professionnel**. Props `jview` (jour / cal), feuilles `wbb` / `wbm`. Données de bien-être d'exemple inventées (`W0`).
- [2026-10-28] — V4 version 40 : **Pilotage › Semaine** = bascule Dodo / Repas au-dessus du graphe (prop `wsel`, défaut dodo). Repas : même colonnes de jours, un point pêche par repas (biberon ou sein), colonne « D'hab. » en anneaux = heures de repas qui reviennent (`typ.meals`), titre « À quelles heures a-t-il mangé ? ». Axe gradué toutes les 3 h, de 0 h à 24 h (Dodo et Repas). **L'habitude se prolonge à travers les 7 jours, en beurre (`--but` = calculé), jamais de la couleur des données** (Victor : « pas les mêmes couleurs ») : Repas = pointillé par heure habituelle (au-dessus = plus tôt, en dessous = plus tard, option A) ; Dodo = bandes claires derrière les capsules (variante A de Dodo). Colonne « D'hab. » aussi en beurre. Refusés : bouton « Habituel », ligne de tendance reliant les jours, couloir ± 20 min, gabarit pointillé par jour.
- [2026-10-28] — V4 version 46 : **Comprendre › Sa journée type** : les deux demi-frises (minuit–midi, midi–minuit) remplacées par une seule bande de 24 h au style de l'Accueil (`.mf-tr`, dodos en capsules hachurées = calculé, repas en points pêche dessous, axe 0 h → 24 h). Victor jugeait les deux bandes redondantes avec les repères et la liste « étape par étape » ; question ouverte : déplier cette liste par défaut ?
- [2026-10-28] — V4 version 47 : **Comprendre › Sa nuit type** simplifiée (« trop d'info ») : la carte garde 2 bandes alignées (nuit habituelle hachurée au-dessus, nuit dernière pleine dessous), repas = petits points pêche sous chaque bande (comme l'Accueil), axe unique en bas. Retirés : badges « calculé / noté », « calculée sur N nuits » (déjà dans « D'après N nuits »), heures sous les capsules (restent dans « étape par étape »), lunes, fantôme hachuré sous la nuit dernière. Règle de Victor confirmée : une frise ne porte qu'une information (quand), les heures exactes vivent dans les listes.
- [2026-10-28] — V4 version 48 : « Sa nuit type » = **une seule frise** (demande de Victor) : la nuit dernière en capsules pleines, la nuit habituelle en manchon pointillé beurre derrière (même code couleur que l'habitude du graphe semaine), repas de la nuit dernière en points dessous, un axe ; mention « en pointillé : sa nuit habituelle » (seule légende). Points de repas habituels de la nuit supprimés (calcul retiré).
- [2026-10-28] — V4 version 49 : « Sa nuit type », la superposition (v48) « ne se voyait pas bien » → **une frise, deux lignes l'une sous l'autre** : « Habituelle » en haut (capsules hachurées beurre), « Nuit dernière » dessous (capsules lilas pleines), mêmes heures alignées, repas en points, un axe ; étiquettes à gauche (plus de légende en phrase). Règle : ne pas superposer deux séries sur une même frise, les empiler.
- [2026-10-28] — V4 version 50 : « Sa nuit type » — les deux frises (superposées v48, empilées v49) jugées « affreuses » → **une seule bande, une seule ligne** : la nuit dernière en capsules lilas, et seuls les écarts sont dessinés : un hachuré beurre là où il dormait d'habitude et pas cette nuit (créneaux habituels moins dodos de la nuit, `nty.miss`) ; repas en points, un axe, une phrase « Hachuré : il dormait d'habitude ». Le surplus de sommeil n'est pas marqué (visible par les capsules). Axe : `white-space:nowrap` (« 8 h » se coupait).
- [2026-10-28] — V4 version 51 : **« Sa nuit type » = frise de la nuit habituelle seule, même style que « Sa journée type »** (bande `.mf-tr`, dodos hachurés = calculé, repas qui reviennent en points, axe 20 h → 8 h, badge « calculé »). Victor : « pas de comparaison » dans la frise (la comparaison nuit dernière / habitude existait déjà dans la phrase, les pastilles d'écart, « La veille », « La nuit dernière en détail », À retenir et Pilotage › Semaine). Ces blocs texte sous la frise sont conservés ; à confirmer s'il veut les retirer aussi. Historique des essais refusés : deux frises superposées, deux lignes empilées, bande de différences.
- [2026-10-29] — V4 version 53 : frises bornées par le sommeil. **Sa journée type** = de minuit au coucher du soir (axe 0 h, 6 h, 12 h, puis l’heure du coucher ; « 18 h » masqué s’il touche la borne) ; **Sa nuit type** = du coucher au réveil du matin (axe : coucher, heures paires, réveil). Axes positionnés (`axOf`, classe `fr-ax`) au lieu de `mini-ax` en espace égal ; repas hors fenêtre non dessinés.
- [2026-10-29] — **V5 « moins de clics »** dans un canevas séparé : https://claude.ai/artifact/K5HeWPHpnmZ2Lp6LzMZpRZ (copie locale `maquettes/v5/project/`, V4 copiée en `Reference.dc.html`, V4 et son canevas intacts). Accueil identique au pixel près. **Pilotage** = un seul défilement : flèches de jour → cadran → légende avec valeurs du jour (Dodo, Repas, Éveillé, Probable ; remplace les grandes tuiles) → la suite probable → la nuit qui précède le jour affiché (venue de Comprendre, `ni = pDay`) → ses 7 derniers jours (sommeil en capsules + repas en points dans la même colonne, habitude en bande beurre ; toucher un jour = ce jour sur le cadran). Supprimés : Jour/Semaine, flèches de semaine, Dodo/Repas, comparatif à 6 cartes. **Comprendre** = bascule « À retenir | Horaires et chiffres » (demandée par Victor en cours de route, au lieu d’une page unique) ; Horaires et chiffres = Sa journée puis Sa nuit (repères + frise, étapes repliées) → Ce qui change (tendances semaine/semaine en phrases, stables et non comparables sur une ligne) → graphe avec question et période sous le graphe → tous ses chiffres replié. Aucune donnée ni calcul nouveau. Écart assumé avec « aucun écran qui défile à l’infini » (2026-10-26) : le brief V5 demande le défilement, à valider.
- [2026-10-29] — V5 version 6 : Victor a fait **revenir Pilotage › Jour / Semaine exactement comme la V4** (graphe avec bascule Dodo / Repas, désormais centrée ; moyennes ; 6 cartes « Par rapport à la semaine d’avant »). Jour = cadran → légende (Dodo et Repas seulement : « Éveillé » et « Probable » retirés à sa demande) → suite probable → nuit du jour affiché. Le graphe combiné sommeil + repas de la V5 est abandonné. Le comparatif existe donc à la fois dans Pilotage › Semaine (cartes) et dans Comprendre › Ce qui change (phrases, toujours sur la semaine en cours) : doublon tranché en version 7 : **le comparatif reste seulement dans Pilotage › Semaine** ; dans Comprendre, « Ce qui change » devient « Ses chiffres » (graphe d’évolution avec question et période, tous ses chiffres replié), sans les phrases de tendance. Version 8 : les 6 cartes « Par rapport à la semaine d’avant » sont un **carrousel horizontal** (156 px, 2 cartes + l’amorce de la 3e, arrêt carte par carte, déborde jusqu’aux bords de l’écran) ; pastille « stable » renommée `chp eq` (elle héritait de `.st`, hauteur 56 px, depuis la V4). Version 9 : cartes du carrousel redessinées comme les tuiles « Dodo / Repas · moyenne » : fond lilas (sommeil) ou pêche (repas), icône lune / biberon + titre, grand chiffre puis « avant … » dessous, pastille blanche en bas avec flèche dessinée (montée, baisse, trait = stable) ; les deux barres avant / maintenant sont retirées. Version 11 : « trop de cartes » → les tuiles « Dodo / Repas · moyenne » de la vue Semaine deviennent **une phrase sous le graphe**, qui suit la bascule (« **12 h 30** de sommeil par 24 h en moyenne, son plus long : 4 h » / « **8,3 repas** par jour en moyenne, dont 830 mL au biberon »), chiffre en gras lilas ou pêche. Étiquettes de jours sur deux lignes (corrige le passage à la ligne de « mar. 27 », venu de `.cal{display:grid}` du Journal).
- [2026-10-30] — V5 version 13 : **Pilotage › Semaine** — toucher un créneau du graphe (Dodo ou Repas) ouvre une fiche fixe au-dessus du graphe (créneau le plus proche, tolérance 90 min ; sieste / nuit / repas, heure, durée ou quantité, « Voir la journée » ; retoucher = désélectionner ; emplacement réservé pour ne pas décaler le graphe, placé au-dessus car la barre flottante masquait le dessous). **Légende du jour** : la quantité en grand (« 440 mL », puis « 3 biberons · 2 tétées » dessous ; sans biberon : nombre de repas), valeurs colorées lilas / pêche. **Fiche « Nuit du … »** : deux blocs « Cette nuit » et « La veille », une ligne par écart (intitulé à gauche, écart en pastille à droite), plus de pastilles en vrac.
- [2026-10-30] — V5 version 14 : Victor n'a pas compris le bloc « La veille » (ni de quel jour il parlait, ni « par rapport à quoi »). **Fiche de nuit simplifiée** : les deux blocs « Cette nuit » / « La veille » sont supprimés ; il reste la phrase (« Un peu différente de ses nuits habituelles ») et « Cette nuit en détail », **repliée par défaut** (Victor : dépliée essayée puis refusée), avec une ligne en plus en tête : « Dernière sieste finie » (heure vraie + écart à la médiane des 7 jours d'avant, « non noté » si la journée n'a pas de sieste ou < 3 jours de référence). **Version 16** : chaque ligne du détail affiche aussi sa valeur habituelle, discrète, à côté de la valeur (« 18:55 d’habitude 16:45 » + pastille d’écart) ; la ligne « D’habitude : coucher … » du bas est supprimée (doublon) ; la phrase d’aide « Touche un dodo… » de Pilotage › Semaine est retirée : la fiche du créneau n’existe que quand un créneau est choisi (le graphe descend alors d’une fiche). **Version 18** : détail de nuit : à droite une colonne alignée où la **pastille d’écart est suivie, juste dessous, de la valeur habituelle (« 16:45 »), le mot « habitude » une seule fois dans l’en-tête « Écart · habitude »** (essais refusés : habitude à côté de la valeur, colonne « Habitude » séparée avec en-tête, pastilles calées à droite) ; **Accueil › tuile Repas** : la quantité en grand (« 440 mL »), « 5 repas » dessous (sans mL : le nombre de repas en grand, « aujourd’hui »). L’inversion « 5 / 440 mL au biberon » visait l’Accueil, pas Pilotage (malentendu, annulé : la légende de Pilotage reste « 440 mL » + « 3 biberons · 2 tétées »). Chaîne lue dans l'ordre du temps : dernière sieste → coucher → plus long sommeil → sommeil noté → réveils → réveil. Règle : une carte de comparaison dit toujours « par rapport à quoi » et de quel jour elle parle ; jamais de « La veille » seul. Piste non faite : ligne « Ça s'est déjà vu : quand la dernière sieste finit tard, il se couche plus tard (n nuits sur m) » si le seuil du lien de Comprendre est atteint.
- [2026-10-30] — V5 version 23 : **Pilotage › Jour : carte « Résumé » en carrousel** (demande de Victor) : titre « Résumé », une carte par jour sur 7 jours (du plus ancien à aujourd’hui, aujourd’hui à droite), chaque carte = « Aujourd’hui · mardi 27 octobre » / « Hier · … » / « Samedi · 25 octobre » + lignes Dodo et Repas du jour. **Le carrousel est synchronisé avec le jour du cadran** (`pday`) : faire défiler change le jour (le cadran et la nuit suivent, sans remonter la page : `_noTop`), les flèches de jour font défiler le carrousel (`legBind` / `legSync`, écouteur `scroll` posé par la ref). Les anciennes variables `pT1` / `pT2` sont remplacées par `legSlides`. Piste : doublon possible avec la date des flèches de jour au-dessus du cadran.
- [2026-10-30] — V5 version 24 : **Pilotage › Semaine, que l’essentiel** (Victor : « trop de texte ») : sous le graphe il ne reste que la phrase de moyenne (« 12 h 30 de sommeil par 24 h en moyenne, son plus long : 4 h. » / « 8,3 repas par jour en moyenne, dont 830 mL au biberon. », Dodo comme Repas) ; supprimés : la ligne d’aide (« jour noté en partie, laissé hachuré… Touche un jour pour l’ouvrir ») et la note sous les cartes de comparaison (« Un cycle = une période de sommeil… »). Seul « Rien de noté cette semaine… » reste, quand la semaine est vide. Les jours notés en partie ne sont donc plus expliqués à l’écran (hachurés seulement).
- [2026-10-30] — V5 version 28 : carrousel « Résumé » (Pilotage › Jour) — **glisser à la main** : Victor ne pouvait pas le faire à la souris (le défilement natif ne marche qu’au doigt) ; ajout du glisser à la souris (`pointerdown/move/up`, seuil de 40 px = jour voisin) et d’**une pastille par jour à droite du titre** (la pastille du jour est allongée, cliquable) pour montrer qu’on peut passer d’un jour à l’autre. Semaine : l’en-tête de comparaison n’affiche plus que « Du 21 au 27 octobre ».
- [2026-10-30] — V5 version 29 : **le cadran aussi se glisse pour changer de jour** (demande de Victor : « montre au niveau de l’horloge aussi et rends le carrousel du coup ») : glisser l’horloge vers la droite = jour précédent, vers la gauche = jour suivant (seuil 70 px, l’horloge suit le doigt, sort, puis la suivante entre ; rebond aux deux bouts ; un simple toucher sur l’anneau fonctionne toujours) ; **pastilles de jours aussi sous le cadran** (en plus de celles du Résumé). Une seule horloge animée, pas 7 horloges côte à côte. Piste : retirer les pastilles du Résumé si les deux rangées font doublon.
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
