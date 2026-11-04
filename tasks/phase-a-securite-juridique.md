# Phase A : contrôles de sécurité et questions juridiques

> 2026-11-02. Local, non poussé. Contrôles en lecture seule avec la clé publique, aucune donnée modifiée. Ce document n'est pas un avis juridique.

## A3. Contrôles de sécurité

| Point | Résultat | Statut |
|---|---|---|
| Lecture sans connexion de `baby`, `events`, `pumps`, `kv` | Liste vide : RLS active | Vérifié, OK |
| Création de compte | `disable_signup: true` | Vérifié, OK. **À ne jamais réactiver** : la règle RLS ouvre tout à tout utilisateur connecté |
| Connexion anonyme | Désactivée | Vérifié, OK |
| Clé de service dans le dépôt | Absente | Vérifié, OK |
| HTTPS (HSTS) | Présent | Vérifié, OK |
| En-têtes CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | Absents | Écart mineur, à traiter avant une ouverture |
| RLS par foyer | `using (true)` | Acceptable pour une famille, **bloquant avant une ouverture** |
| Photo du bébé | Texte en clair dans `baby.photo`, protégée par la RLS | Écart à revoir avant une ouverture |
| Code famille | Une seule barrière, adresse lisible dans le site | Dépend de sa longueur, à vérifier |

**À vérifier par Victor dans le tableau de bord Supabase :**
- [ ] Région du projet : dans l'UE ?
- [x] Sauvegardes de la base : **aucune**, plan Free (vérifié par Victor le 2026-11-02). Les exports locaux sont la seule copie.
- [ ] Limite de tentatives de connexion active.
- [ ] Mises en pause du projet gratuit en cas d'inactivité : comprises ?
- [ ] Code famille long : 12 caractères ou plus, non devinable.

## A4. Questions pour un juriste

À poser avant toute ouverture à une autre famille, pas avant.

1. Un journal de sommeil et d'alimentation d'un nourrisson est-il une donnée de santé (RGPD, art. 9) ? Et les notes de santé, d'humeur et de selles ?
2. Si oui, un hébergeur certifié HDS est-il obligatoire ? Supabase et Vercel conviennent-ils, et où sont les données ?
3. Quelle base légale : consentement du parent, contrat ? Qui consent pour le second parent ?
4. Une AIPD est-elle obligatoire ?
5. Qui est responsable de traitement ? Quels contrats et transferts hors UE avec les sous-traitants ?
6. Quelles informations donner, et comment gérer accès, export, effacement et durées de conservation, y compris le journal des corrections de 90 jours ?
7. Quelles conditions pour utiliser des données de familles à l'apprentissage ? Une anonymisation est-elle réaliste sur des données aussi individuelles ?
8. Des fenêtres de prévision et des repères d'âge font-ils de l'app un dispositif médical (règlement UE 2017/745) ? Quelles formulations éviter ?
9. Quelle responsabilité en cas de mauvaise lecture d'une prévision ou d'un repère ?
10. Les données déjà publiées dans l'historique du dépôt public créent-elles une obligation pour les données propres de la famille ou celles d'un tiers ?
