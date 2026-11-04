# Intelligence V2 — architecture cible (Phase 1), 2026-11-04

Principe : on étend l'existant, on ne le remplace pas. Rien ici ne modifie l'interface.

## Flux
journal (événements) → `adapters` → `sleep/timeline` + `calendar` (nuits, journées, complétude) → habitudes / prévisions / associations / ruptures → `analyze()` (contrat structuré, versionné, avec abstention) → [pont `bridge.ts` pour l'écran existant] → UX existante.
Mesure : fenêtre affichée → `data/forecastRecorder` (hors moteur) → journal local → `evaluation/forecastLog` → score réel (couverture, erreur) → règle d'activation `decide` / `arbiter`.

## Modules
| Statut | Module | Rôle / décision |
|---|---|---|
| Conservé | `sleep/*`, `habits/*`, `patterns/associations`, `rhythm/change`, `quality`, `rules` | Socle validé par les tests de parité et de référence figée. |
| Conservé | `predictions/baselines`, `models` (pondéré, Kalman, bayésien) | Baselines et candidats. Aucun n'est activé. |
| En production, à prouver | `predictions/models.survivalModel` | Activé par décision de Victor. À confirmer ou retirer sur la mesure réelle (journal local, ≥ 30 décisions sur ≥ 14 jours). |
| Modifié | `evaluation/*` | Ajouts de diagnostics (Brier, log loss, calibration, strates âge / historique, journaux troués, ruptures). Rapports anciens conservés. |
| Modifié | `analyze()` | Rend aussi les références d'âge publiées (sommeil total, 3 / 6 / 8 mois). |
| Ajouté | `evaluation/forecastLog` + `data/forecastRecorder` | Journal local des fenêtres affichées, comparées au dodo réel. Hors du moteur (règle : le moteur ne touche pas au stockage). |
| Ajouté | `knowledge/*` (base 0.3.0) | Références versionnées avec source, population, méthode, limites, nature, confiance. |
| Candidat, non activé | `survivalAgeModel` | Âge en semaines dans la survie. Aucun gain démontré. |
| Non construit | semi-markovien, hiérarchique multi-bébés | Exigent des données de plusieurs bébés, qui n'existent pas. |
| Non construit | explications par modèle de langage | Aucun écran n'affiche `analyze()`. |

## Rôle de l'âge
A priori de contexte, jamais une règle : aujourd'hui seulement comme plage publiée de sommeil total (hors des âges couverts : rien). Il ne change aucune prévision. Il entrera dans la survie seulement si (1) une référence sourcée couvre l'âge et (2) le banc réel montre un gain sur des données non utilisées pour l'apprentissage.

## Preuve : niveaux et conditions
R0 (< 30 décisions, anecdote) → R1 (journal local, un bébé) → R2 (plusieurs bébés, consentement) . Le synthétique (T) ne valide jamais. Seuils de mise en production : à fixer après les premières mesures R1 (gain médian ≥ 10 %, borne basse de l'intervalle au-dessus de 0, couverture à 80 % ± 5 points : valeurs déjà inscrites dans `config.ts`, statut « demande »).

## Gouvernance
- Pas de collecte collective : consentement, anonymisation et hébergement non établis. Le journal local ne quitte pas l'appareil.
- Dérogation de Victor sur la relecture professionnelle des 3 références d'âge : tracée dans la base et dans chaque résultat.
- Pas de recommandation, pas de diagnostic, pas de volume de lait conseillé : contrôlé par `safety/vocabulary`.
- Personnalisation désactivable : non faite (pas d'écran prévu).

## Non exposé dans l'UX actuelle
Prévision de repas, mode d'alimentation, qualité des données, types de journées, motifs, références d'âge, score réel des prévisions.
