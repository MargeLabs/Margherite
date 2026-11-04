# Marguerite V6 — Audit et recommandations techniques

> 2026-11-03. Document local (branche `chore/secure-repo`, jamais poussée). Aucune ligne de production modifiée.
> Proposition visuelle : Artifact « MARGUERITE V6 — Nouvelle expérience » (données fictives).
> Légende des statuts : **[Vérifié]** exécuté ou lu dans le code aujourd'hui · **[Lu]** lu dans le code, non exécuté · **[Doc]** n'existe que dans un document.

---

## 0. En une page

1. **Le moteur est sain mais n'a rien appris.** 221 tests verts [Vérifié], mais 67 événements réels sur 3,5 jours (30 oct. → 3 nov.) [Vérifié sur l'export]. Aucun modèle n'a pu être mesuré sur un vrai bébé. Toute promesse d'« intelligence » de la V6 dépend d'abord de semaines de données, puis de plusieurs bébés.
2. **Le vrai chantier V6 n'est pas un modèle, c'est le profil.** Remplacer les calculs dispersés de l'écran par un **portrait comportemental** unique, calculé par le moteur, avec pour chaque trait sa preuve, son statut et son historique. Tous les écrans de Comprendre lisent ce portrait.
3. **Une fondation bloque la V6** : l'interface est générée par patchs de chaînes sur la maquette V5 ; la V6 doit passer en composants qui lisent le portrait. (Hors ligne et multi-foyers : constatés, **reportés par décision de Victor le 2026-11-03**.)
4. **La communauté est un autre produit.** Son coût n'est pas l'hébergement mais la modération humaine et les obligations légales (DSA, RGPD, enfants). À lancer après Comprendre V6, avec une audience réelle, en commençant petit.

---

## 1. Audit de l'existant

### 1.1 Ce qui fonctionne réellement

| Élément | Statut | Preuve |
|---|---|---|
| Suite de tests `web/` | [Vérifié] | `npx vitest run` : 9 fichiers, 221 tests verts, 18 s |
| Saisie dodo / biberon / tétée / change, chrono partagé (un seul dodo en cours) | [Lu] | index unique `events_one_running_sleep` (`0001_init.sql`) |
| Temps réel entre deux téléphones | [Lu] | `supabaseRepo.ts:67`, `postgres_changes` |
| Nuits et journées calculées par le moteur (`createCalendar`, `CURRENT_RULES`) | [Lu] en production | `engine/bridge.ts` |
| Liens journée → nuit filtrés par `associations` (permutation par blocs, correction multiple) | [Lu] en production | `bridge.ts`, `patterns/associations.ts` ; faux liens 44 % → 1,3 % en simulation |
| Prochain dodo par modèle de survie | [Lu] en production **« en test »**, non validé | exception décidée par Victor le 2026-11-02 ; 6 décisions réelles, couverture 83 % — trop peu pour conclure |
| Journal des corrections (`event_revisions`) | [Lu], migration exécutée | `0002_event_audit.sql` ; création d'une ligne lors d'une vraie correction non confirmée |
| Sauvegarde | [Lu] | export JSON quotidien sur le PC de Victor ; **seule copie** (Supabase Free sans sauvegarde), non chiffrée |

### 1.2 Partiellement implémenté

- **Extraction du moteur** : `SL`, `nightOf`, `dayOf`, `typ`, `usual`, `wins`, `habitOf`, `stat`, `lkEval` extraits à parité ; restent dans le code généré : `awDay`, habitude d'éveil, `rFw`, `rNp`, toutes les analyses d'Explorer.
- **Âge** : calculé et transmis au moteur, **aucun seuil ni modèle n'en dépend**.
- **Phrases** : produites dans `app.logic.generated.js`, au masculin (« il »). Le moteur rend encore trop peu de codes neutres.
- **Analyse transversale** (`transversal.ts`, `dayTypes`, `sequences`, `evolution`) : codée et testée, non branchée, sans résultat réel (il faut ≥ 14 nuits complètes).
- **Base de connaissances d'âge** : schéma et validateur, `getReference` rend `null` ; aucune source relue.

### 1.3 Expérimental (code présent, jamais utilisé par l'app)

Quantiles pondérés, Kalman niveau local, bayésien Normale-Gamma inverse, calibration conforme, CUSUM, BOCPD, fenêtre de repas descriptive (`feeding/nextFeed.ts`), arbitre par bébé. Verdict `not_enough_data` **par construction** : la règle `decide` interdit toute activation sur données synthétiques ou R0. C'est la bonne règle ; elle doit rester.

### 1.4 Absent

Prévision de repas en production · HSMM · détection de rupture visible · rituels, bain, mode d'alimentation déclaré · plusieurs foyers · hors ligne · notifications.

### 1.5 À corriger (par gravité)

Points 1 et 2 : **reportés** (décision de Victor, 2026-11-03), gardés ici pour mémoire.

1. **Écriture hors ligne perdue** [Lu] : `household.tsx:248-262` revient à l'état de la base si l'appel échoue. Une saisie à 3 h du matin sans réseau disparaît. Le cas d'usage principal (nuit, une main) y est exposé.
2. **RLS `using (true)`** [Lu] : tout utilisateur authentifié lit et écrit tout. Acceptable pour un foyer unique avec un seul compte ; **bloquant** pour un deuxième foyer, et a fortiori pour une communauté qui créerait des comptes.
3. **`kv` en « dernier qui écrit gagne »** sur des documents JSON entiers (`notes`, `well`, `trk`, `trl`) : deux téléphones qui modifient en même temps perdent une saisie.
4. **Fenêtre de 30 jours** (`WINDOW_DAYS = 30`, `household.tsx:18`) : incompatible avec un portrait qui évolue sur des mois.
5. **Sauvegarde unique, locale, non chiffrée**, dépendante d'un PC allumé.
6. **Dépôt public avec données réelles dans l'historique** : à purger ou à archiver avant toute ouverture à d'autres familles.
7. **Chaîne maquette → `gen:view` → `patches.mjs`** : chaque changement d'écran passe par un remplacement de chaîne qui doit matcher exactement. Elle a permis d'aller vite ; elle ne supportera pas une refonte V6.

### 1.6 À conserver

Le moteur `web/src/engine/` (types, registre de seuils, calendrier, associations, banc de backtest, journaux synthétiques, contrôle de vocabulaire), la discipline de preuve (R0 → R2, règle 7.3), les règles produit apprises (fiabilité affichée, association ≠ cause, aucune injonction de repas, une frise = une information).

### 1.7 À remplacer en V6

L'interface générée (remplacée par des composants React qui lisent le portrait), `renderVals` (vidé au profit du moteur), le code famille unique (remplacé par foyers + invitations), le stockage `kv` en documents entiers.

---

## 2. Architecture cible du moteur

```
journal (events, pumps, kv)          ← données observées, jamais modifiées par le moteur
   │
   ▼
1. Normalisation      timeline, fusion de siestes, découpage des nuits, qualité de chaque jour
   │                  (déjà : sleep/calendar.ts, quality/)
   ▼
2. Mesures            une série par indicateur, avec poids et marqueur « observé / incomplet »
   │                  (endormissement, éveils par rang, siestes, plus long sommeil, repas, volumes…)
   ▼
3. Détecteurs         chacun produit des TRAITS candidats + leur preuve
   │                  habitudes · profil d'occupation · évolution · ruptures · associations
   ▼
4. Portrait           sélection, fusion, statut, historique (confirmé depuis…, nuancé le…)
   │
   ├──► Prévisions     arbitre par bébé : modèle retenu SEULEMENT s'il bat la référence (règle 7.3)
   ├──► À retenir      3 éléments choisis par un score de nouveauté × solidité × pertinence horaire
   └──► Textes         gabarits neutres (pas de « il » codé en dur), contrôle de vocabulaire
```

Règles : le moteur rend des **faits codés** (`{trait: 'bedtime', value, interval, n, status}`), jamais de phrases ; tout s'exécute **sur l'appareil** (6 mois d'historique < 3 s, test existant) ; aucune API d'IA payante.

### 2.1 Structure du portrait comportemental

```ts
interface Trait {
  id: string;                 // 'sleep.onset.nap2', 'feed.interval.day', 'night.longest'…
  domain: 'sleep' | 'wake' | 'nap' | 'night' | 'feed' | 'rhythm';
  value: number | [number, number];   // minutes ou fourchette (p25–p75)
  unit: 'min_of_day' | 'min' | 'ml' | 'count' | 'ratio';
  status: 'confirmed' | 'emerging' | 'to_confirm' | 'not_enough' | 'not_measurable';
  evidence: { n: number; days: number; period: [string, string]; agreement?: number };
  trend?: { dir: 'up' | 'down' | 'flat'; perWeek: number; since: string };
  firstSeen: string; lastChanged: string;   // historique : « confirmé depuis 9 jours »
  basis: 'observed' | 'estimated';
}
interface Portrait { babyId: string; ageDays: number; computedAt: string; knownDays: number; traits: Trait[] }
```

Statuts (reprennent les niveaux affichés depuis la V4) : `confirmed` = ≥ 10 jours observés, stable sur 2 périodes ; `emerging` = 5–9 jours ou une seule période ; `to_confirm` = signal faible ; `not_enough` affiché comme tel. **Un trait sans preuve n'est jamais affiché comme fait.**

Historique : un instantané quotidien du portrait (quelques Ko) stocké dans `portrait_snapshots` permet « habitude confirmée depuis le 12 », « nuancée cette semaine ». Il est recalculable depuis le journal ; c'est un cache, pas une source.

### 2.2 Modèles recommandés (et ceux à écarter)

| Besoin | Recommandé | Pourquoi | Statut |
|---|---|---|---|
| Habitudes (heures, durées) | **Quantiles pondérés à décroissance exponentielle** (demi-vie 5–10 j, à régler par backtest) | robuste, explicable, tolère les jours incomplets par poids | codé (`weightedAwake`), à généraliser |
| Journée type | **Profil d'occupation** : part des jours où il dort à chaque créneau de 10 min, pondérée | corrige le défaut connu « siestes alignées par rang » (une sieste en plus décale toutes les suivantes) ; se lit sans légende | **à coder**, priorité haute |
| Créneaux de sieste | pics de densité (noyau) des heures d'endormissement, pas des rangs | même raison | à coder |
| Prochain endormissement | **survie discrète S + C** + **calibration conforme**, sinon fourchette d'éveil habituelle | seule méthode qui utilise le dernier réveil ; la calibration rend la fourchette honnête | codé, en test ; à valider |
| Ce qui a changé | **BOCPD** (ou CUSUM) par indicateur, signalé seulement si confirmé 3 jours | évite de crier au changement sur un jour atypique | codé, non branché |
| Tendance | pente de Theil-Sen sur médianes hebdomadaires | robuste aux valeurs extrêmes | simple à ajouter |
| Associations | permutation par blocs + correction multiple (existant) | seuls 1,3 % de faux liens en simulation | en production |
| Durée probable d'une sieste | quantiles conditionnels au créneau (matin / après-midi / fin de journée) | utile et simple | à coder |
| Prochain repas | **descriptif seulement** : « ses repas reviennent souvent après 2 h 30 à 3 h » | ne doit jamais devenir une consigne d'attente | codé (`nextFeed`), non branché |
| Kalman | **écarter pour l'instant** : sur nos séries il équivaut à une moyenne mobile, sans gain mesuré | | codé, à garder dans le banc |
| Bayésien hiérarchique (a priori par âge) | **plus tard** : utile quand plusieurs bébés existent ; c'est la seule façon propre d'utiliser l'âge | | prématuré |
| HSMM | **plus tard** : séduisant (états veille/sommeil avec durées, données manquantes), mais paramètres impossibles à estimer avec 1 bébé et 3 jours ; coût d'explication élevé | | prématuré |
| Chronos-2 / TimesFM | **écarter** : séries d'événements irréguliers, très courtes, gros modèles hors navigateur, envoi de données | | à ne pas faire |

### 2.3 L'âge

- **Ce qui est justifié dès maintenant** : régler la vitesse d'oubli selon l'âge (un nouveau-né change vite → demi-vie courte), et augmenter la sensibilité aux ruptures pendant les premières semaines. Hypothèse **à valider par backtest**, pas une vérité.
- **Ce qui ne l'est pas** : comparer le bébé à une norme non sourcée. Les repères d'âge restent masqués tant que la base K n'est pas relue par un professionnel.
- **Ce qui viendra avec plusieurs bébés** : a priori hiérarchique par tranche d'âge (« les bébés de 6–8 semaines de Marguerite »), qui aide les premiers jours d'un nouveau bébé puis s'efface devant ses propres données.

### 2.4 Validation

- **Backtest à origine glissante** (existe : `npm run backtest`) ; période gelée = 20 % de l'historique, ≥ 14 jours.
- Mesures par prévision : couverture de la fourchette à 80 % (cible 75–85 %), largeur médiane, erreur absolue du centre, **taux de disponibilité** et raisons d'abstention.
- Découpage **par tranche d'âge et par bébé** dès qu'il y a plusieurs bébés.
- **Porte de régression en CI** : le banc échoue si la couverture sort de la cible ou si la largeur augmente de plus de 15 % sans gain.
- **Mesurer la confiance affichée** : la phrase « 16 fois sur 20, il s'est endormi dans la fourchette » n'est affichée que si elle est calculée sur ses propres dernières prévisions (le rejeu est déjà possible).
- Données nécessaires : un bébé, ≥ 21 jours notés en entier pour un premier verdict ; plusieurs dizaines de bébés pour l'âge. **Recommandation** : télémétrie d'évaluation facultative qui n'envoie que des **mesures** (couverture, largeur, âge en semaines), jamais le journal.

### 2.5 À retenir : sélection

Score = solidité (statut) × nouveauté (pas montré dans les 3 derniers jours, ou changé) × pertinence (heure du jour : une observation de nuit le matin, une de sieste en journée) × diversité (au plus un élément par domaine). Toujours au plus 3 ; parfois 1 ; « Rien de nouveau, ses habitudes tiennent » est une réponse valable.

---

## 3. Évolutions de la base (app)

| Changement | Pourquoi | Priorité |
|---|---|---|
| `households`, `household_members`, `babies(household_id)`, RLS par appartenance, comptes et invitations | plusieurs familles ; préalable de la communauté | **reporté** (Victor, 2026-11-03) |
| File d'écriture hors ligne (IndexedDB) + UUID client + `upsert` idempotent | aucune saisie perdue | **reporté** (Victor, 2026-11-03) |
| `kv` éclaté en lignes (`notes`, `wellbeing(day, category, value)`) | fin du « dernier qui écrit gagne » sur des documents entiers | intéressant |
| Charger tout l'historique (ou agrégats) au lieu de 30 jours | portrait évolutif | indispensable |
| `portrait_snapshots(baby_id, day, json)` | historique des traits | intéressant |
| `rituals` / suivis typés (bain, sortie, rituel du coucher) | permettre les associations « rituel → nuit » | intéressant |
| Mode d'alimentation déclaré par période | volumes et intervalles interprétés correctement | intéressant |
| Sauvegarde : Supabase Pro (PITR / sauvegardes quotidiennes) + export chiffré | ne plus dépendre d'un PC | indispensable avant d'autres familles |

Conflits : les événements sont rarement modifiés à deux ; garder « dernier qui écrit gagne » **par ligne**, avec `event_revisions` pour retrouver une version écrasée. Pas de CRDT : disproportionné.

---

## 4. Architecture de la communauté

### 4.1 Principes

- **Étanchéité** : schéma `community` séparé ; aucune clé étrangère vers `events` ; aucune donnée du journal lue automatiquement. Le seul pont est un geste explicite (« rejoindre le cercle des bébés nés en septembre » : seul le mois est partagé, après accord).
- **Identité publique distincte** : `public_profiles(id, user_id, pseudonym, avatar_seed)` ; pas de prénom ni de photo du bébé ; **aucune image à l'ouverture** (protège les enfants, divise la charge de modération).
- **Anonymat** : `author_id` stocké, jamais exposé ; les lectures passent par une vue `security definer` qui l'efface pour les posts anonymes. La modération le voit (indispensable pour sanctionner).

### 4.2 Tables

`circles(id, kind: age|theme, name, birth_month?)` · `circle_members` · `posts(id, kind: anecdote|question, body ≤ 280 car. pour une anecdote, theme, circle_id?, anonymous, status: visible|pending|hidden|removed, created_at)` · `comments(id, post_id, parent_id, body, status)` (une seule profondeur de réponse) · `reactions(post_id, user_id, type)` unique par (post, user, type) · `saves` · `blocks(user_id, blocked_id)` · `reports(target, reason, reporter)` · `moderation_actions(target, action, reason, moderator, at)` (motivation exigée par le DSA) · `notifications`.

### 4.3 Modération

1. **Avant publication** (sur l'appareil puis Edge Function) : listes de mots (insultes, données personnelles : téléphone, adresse), **mots de détresse** → carte d'aide (3114, 15, professionnel) proposée **avant** publication, sans bloquer, et file prioritaire ; **santé** (fièvre, convulsions, déshydratation…) → bandeau d'orientation vers un professionnel, réponse marquée « vécu de parent ».
2. **Après** : signalement en 2 touches ; masquage automatique à 3 signalements en attendant revue ; blocage et masquage d'un utilisateur.
3. **Humains** : file de modération quotidienne. C'est le vrai coût : compter 1 h/jour pour quelques milliers de membres actifs, puis des modérateurs bénévoles formés ou un prestataire.
4. Classifieur de toxicité open source (modèle multilingue type XLM-R affiné) dans une Edge Function : **seulement** quand le volume dépasse la revue humaine ; jamais seul juge.
5. Limites : nouveau compte = 3 posts / jour, pas de lien externe, délai de 24 h avant de commenter ; comptes 18 ans et plus.

### 4.4 Obligations

DSA (hébergeur : notification et action, motivation des décisions, point de contact), RGPD (base légale, minimisation, droit à l'effacement, AIPD conseillée : données de santé possibles dans les textes), conditions d'utilisation et règles de communauté publiques. **À relire par un juriste avant ouverture.**

### 4.5 Coûts (ordre de grandeur, à vérifier au moment du choix)

| Poste | Lancement (< 1 000 membres) | Croissance |
|---|---|---|
| Supabase | plan Pro (≈ 25 $/mois) | + calcul et stockage à l'usage |
| Vercel | Pro requis pour un usage commercial (≈ 20 $/mois/membre d'équipe) | idem |
| Notifications web | gratuit (Web Push ; iPhone : app installée, iOS 16.4+) | idem |
| Modération | **temps humain**, poste dominant | prestataire ou bénévoles |
| Juridique | relecture CGU / règles / AIPD, ponctuel | |

---

## 5. Risques

| Risque | Effet | Parade |
|---|---|---|
| Promettre une intelligence que les données ne portent pas | perte de confiance | statuts visibles, abstention, « ce que Marguerite sait déjà » |
| Faux liens / corrélations hasardeuses | conseils implicites erronés | `associations` + seuils, phrase « observé ensemble, pas une cause » |
| Une prévision lue comme une consigne | culpabilité, repas retardés | formulation « s'endort souvent vers », jamais de compte à rebours, aucune prévision de repas prescriptive |
| Communauté vide au lancement | effet « salle vide » | lancer avec une audience existante ; questions du jour éditoriales ; **jamais de faux posts** |
| Communauté anxiogène / comparaisons | fuite des parents fragiles | pas de chiffres du bébé dans les posts, pas de compteur public de « likes », cercles par âge sans classement |
| Détresse réelle banalisée par l'humour | danger | carte d'aide avant publication, revue prioritaire |
| Saisie perdue sans réseau, base mono-foyer | connus, acceptés pour l'instant | reportés (Victor, 2026-11-03) |

---

## 6. Feuille de route

**Indispensable — fondations**
1. ~~Hors ligne~~ et ~~multi-foyers~~ : reportés (Victor, 2026-11-03). Rappel : la communauté exige des comptes individuels, donc le multi-foyers redeviendra un préalable le jour où elle sera lancée.
2. Sauvegarde serveur + export chiffré ; purge ou archivage du dépôt public.
3. Historique complet chargé (ou agrégats).

**Indispensable — Comprendre V6**
5. `Portrait` dans le moteur : traits, statuts, preuves, instantanés ; tests sur journaux à réponse connue.
6. Profil d'occupation et créneaux par densité (remplace l'alignement par rang).
7. Nouvelle interface Comprendre en composants React (fin des patchs pour ces écrans), lisant uniquement le portrait.
8. Confiance mesurée des prévisions (« n fois sur m ») et porte de régression en CI.

**Intéressant — ensuite**
9. Ruptures visibles (« ce qui a changé »), durée probable de sieste, tendances Theil-Sen.
10. Suivis typés (rituels, bain) pour élargir les associations.
11. Télémétrie d'évaluation facultative (mesures seulement).

**Communauté — après Comprendre V6 et une audience réelle**
12. Phase 1 : anecdotes + réactions + cercles par mois de naissance ; texte seul ; modération manuelle.
13. Phase 2 : Entraide (questions, réponses, recherche), signalements avancés, notifications.
14. Phase 3 : rendez-vous (« les veilleurs », café du jeudi), modérateurs bénévoles.

**Prématuré**
HSMM, a priori hiérarchiques par âge (avant plusieurs bébés), modèles de fondation (Chronos, TimesFM), images dans la communauté, messagerie privée, IA générative pour rédiger des réponses.

---

## 7. Points à trancher par Victor

1. ~~Nom~~ : **Canaille** (décision de Victor, 2026-11-03).
2. ~~Ordre hors ligne / multi-foyers~~ : reporté par Victor le 2026-11-03.
3. **Interface** : sortir de la chaîne maquette → patchs pour la V6 (recommandé), ou continuer à patcher ?
4. **Communauté** : date de lancement liée à une audience (combien de familles ?) et à un budget de modération.
5. **Données** : accepter une télémétrie d'évaluation facultative (mesures seulement) pour valider les modèles sur plusieurs bébés ?
