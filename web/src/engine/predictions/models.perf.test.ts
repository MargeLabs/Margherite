// Vitesse des calculs de prévision. Ces mesures tournent à part (`npm run test:perf`, config `vitest.perf.config.ts`) : une durée n'a de sens que mesurée
// seule sur la machine. Dans la suite complète, une dizaine de fichiers de tests tournent en parallèle ; le premier appel (compilation à chaud du moteur JS)
// et l'ordonnanceur faisaient varier la même mesure de 60 à plus de 600 ms (le test échouait sans que le code ait changé).
// Méthode : un appel d'échauffement écarté, puis la MÉDIANE de cinq appels, pour ne pas dépendre d'un seul coup de ramasse-miettes.
// Le seuil ne change pas : 100 ms sur cette machine, donc de l'ordre de la demi-seconde sur un téléphone d'entrée de gamme, et le moteur est mémorisé 5 minutes.
import { describe, expect, it } from 'vitest';
import { analyze } from '../analyze';
import { SCENARIOS, syntheticLog } from '../evaluation/synthetic';
import { bayesHabitSurvival } from './bayesHabitSurvival';
import { survivalModel } from './models';
import { recommendNap } from './recommendation';

const NOW = new Date(2026, 8, 27, 11, 0).getTime();
const log = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);
const input = { birthAt: null, events: log };

function medianMs(run: () => unknown, n = 5): number {
  run(); // échauffement
  const t = Array.from({ length: n }, () => {
    const t0 = performance.now();
    run();
    return performance.now() - t0;
  }).sort((a, b) => a - b);
  return t[Math.floor(n / 2)]!;
}

describe('vitesse (< 100 ms ici, médiane de 5 appels après échauffement)', () => {
  it('survie', () => {
    expect(medianMs(() => survivalModel(input, NOW))).toBeLessThan(100);
  });
  it('survie bayésienne à habitudes', () => {
    expect(medianMs(() => bayesHabitSurvival(input, NOW))).toBeLessThan(100);
  });
  it('recommandation de sieste', () => {
    expect(medianMs(() => recommendNap(input, NOW))).toBeLessThan(100);
  });
});

describe('analyse complète', () => {
  it('6 mois d’historique tiennent en moins de 3 s ici', () => {
    const from = new Date(2026, 2, 1), at = new Date(2026, 8, 28, 14, 20).getTime();
    const long = syntheticLog({ ...SCENARIOS.irregulier!, from, days: 210 }).filter((e) => (e.end ?? e.start) <= at);
    // seul, un appel froid a mesuré de 0,9 à 3,6 s d'une exécution à l'autre : même méthode que ci-dessus, échauffement puis médiane de 3 appels
    const ms = medianMs(() => analyze({ babyId: 'a', birthAt: from.getTime(), events: long }, at), 3);
    console.log('analyze 6 mois, médiane (ms)', Math.round(ms), long.length);
    expect(ms).toBeLessThan(3000);
  }, 60_000);
});
