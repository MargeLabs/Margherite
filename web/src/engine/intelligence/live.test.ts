// Apprentissage réel : les fenêtres réellement affichées, comparées à ce qui s'est passé, et la règle de stabilité des modèles.
import { describe, expect, it } from 'vitest';
import { outcomesOf, summarize, type LoggedForecast } from '../evaluation/forecastLog';
import type { EngineEvent } from '../types';
import { stabilize, type HistoryEntry } from './history';
import { runIntelligence } from './run';
import { liveCheck, type Choice } from './targets';

const MIN = 60_000;
const at = (d: number, h: number, m = 0) => new Date(2026, 8, 1 + d, h, m).getTime();
const sleep = (id: string, a: number, b?: number): EngineEvent => ({ id, kind: 'sleep', start: a, ...(b !== undefined ? { end: b } : {}) });
const shown = (wake: number, from: number, to: number, extra: Partial<LoggedForecast> = {}): LoggedForecast => ({ wake, from, to, shownAt: wake + MIN, model: 'survival', engine: 't', ...extra });

describe('résultat de chaque fenêtre affichée', () => {
  const wake = at(3, 10), ev = [sleep('a', at(3, 9), wake)];

  it('dans la fenêtre, avant, après : avec l’écart en minutes', () => {
    const log = [shown(wake, at(3, 11, 30), at(3, 12, 30))];
    const o = (start: number) => outcomesOf(log, [...ev, sleep('b', start, start + 60 * MIN)])[0]!;
    expect(o(at(3, 12))).toMatchObject({ status: 'inside', errorMin: 0, actual: at(3, 12) });
    expect(o(at(3, 11, 10))).toMatchObject({ status: 'early', errorMin: -20 });
    expect(o(at(3, 13, 5))).toMatchObject({ status: 'late', errorMin: 35 });
  });

  it('sans dodo noté après le réveil : en attente, jamais un raté', () => {
    const o = outcomesOf([shown(wake, at(3, 11), at(3, 12))], ev);
    expect(o[0]!.status).toBe('pending');
    expect(summarize(o)).toMatchObject({ n: 0, pending: 1, coverage: null });
  });

  it('dodo suivant noté plus de 5 h après : trou de saisie, pas un échec', () => {
    const o = outcomesOf([shown(wake, at(3, 11), at(3, 12))], [...ev, sleep('b', at(3, 16), at(3, 17))]);
    expect(o[0]!.status).toBe('unobserved');
    expect(summarize(o).n).toBe(0);
  });

  it('fenêtre affichée après l’endormissement (saisie tardive) : pas une prévision, exclue', () => {
    const log = [shown(wake, at(3, 11), at(3, 12), { shownAt: at(3, 11, 45) })];
    expect(outcomesOf(log, [...ev, sleep('b', at(3, 11, 30), at(3, 12, 30))])[0]!.status).toBe('not_prospective');
  });

  it('doublons : une seule entrée par réveil, la dernière fait foi', () => {
    const log = [shown(wake, at(3, 9), at(3, 9, 30)), shown(wake, at(3, 11, 30), at(3, 12, 30))];
    const o = outcomesOf(log, [...ev, sleep('b', at(3, 12), at(3, 13))]);
    expect(o).toHaveLength(1);
    expect(o[0]!.status).toBe('inside');
  });

  it('correction : l’heure du dodo est corrigée, le résultat suit ; supprimé, il redevient en attente', () => {
    const log = [shown(wake, at(3, 11, 30), at(3, 12, 30))];
    expect(outcomesOf(log, [...ev, sleep('b', at(3, 12), at(3, 13))])[0]!.status).toBe('inside');
    expect(outcomesOf(log, [...ev, sleep('b', at(3, 13), at(3, 14))])[0]!.status).toBe('late');
    expect(outcomesOf(log, ev)[0]!.status).toBe('pending');
  });

  it('les cibles ne se mélangent pas : un coucher noté n’est pas un prochain dodo', () => {
    const o = outcomesOf([shown(wake, at(3, 11), at(3, 12), { target: 'bedtime' })], [...ev, sleep('b', at(3, 11, 30), at(3, 12))]);
    expect(o).toEqual([]);
  });

  it('résumé : couverture sur les seuls vrais résultats', () => {
    const w2 = at(3, 14), log = [shown(wake, at(3, 11, 30), at(3, 12, 30)), shown(w2, at(3, 15), at(3, 15, 30)), shown(at(3, 18), at(3, 19), at(3, 19, 30))];
    const s = summarize(outcomesOf(log, [...ev, sleep('b', at(3, 12), w2), sleep('c', at(3, 16), at(3, 17, 30))]));
    expect(s).toMatchObject({ n: 2, inside: 1, late: 1, pending: 1, coverage: 0.5, medianMissMin: 30 });
  });
});

/** Bébé très régulier : l'éveil dure 2 h, siestes d'1 h. */
function regular(days: number): EngineEvent[] {
  const out: EngineEvent[] = [];
  let n = 0;
  for (let d = 0; d < days; d++) {
    out.push(sleep(`n${n++}`, at(d - 1, 20), at(d, 7)));
    for (const h of [9, 12, 15]) out.push(sleep(`s${n++}`, at(d, h), at(d, h + 1)));
  }
  return out.map((e) => ({ ...e, enteredAt: e.start, endKnownAt: e.end }));
}

describe('contrôle sur les fenêtres réellement affichées', () => {
  const events = regular(14), input = { birthAt: null, events };

  it('un modèle qui s’est trompé en vrai, plus que la référence au même moment, est écarté', () => {
    // fenêtres affichées décalées de 2 h : toutes à côté
    const log: LoggedForecast[] = [];
    for (let d = 2; d < 14; d++) for (const h of [10, 13]) log.push(shown(at(d, h), at(d, h + 3), at(d, h + 3, 30), { model: 'weighted7' }));
    const c = liveCheck('nap_start', input, outcomesOf(log, events), 'weighted7')!;
    expect(c.n).toBeGreaterThanOrEqual(10);
    expect(c.worse).toBe(true);
  });

  it('trop peu de résultats réels : aucun jugement', () => {
    const log = [shown(at(5, 10), at(5, 13), at(5, 13, 30), { model: 'weighted7' })];
    expect(liveCheck('nap_start', input, outcomesOf(log, events), 'weighted7')!.worse).toBe(false);
  });

  it('dans le rapport, le réel et le rejeu restent séparés', () => {
    const log = [shown(at(13, 10), at(13, 11, 30), at(13, 12, 30), { model: 'survival' })];
    const r = runIntelligence({ babyId: 'x', ...input }, at(13, 16), { targets: ['nap_start'], live: log, history: [] });
    const p = r.predictions[0]!, c = r.evaluation[0]!;
    expect(c.live).toMatchObject({ n: 1, inside: 1 });
    expect(p.confidence.live?.n).toBe(1);
    expect(p.confidence.why).toContain('live_not_enough');
    expect(p.limits).toContain('coverage_not_measured_live');
    expect(c.evaluations.length).toBeGreaterThan(1); // le rejeu, à part
  });
});

describe('stabilité : pas de changement de modèle sur un seul jour', () => {
  const choice = (o: Partial<Choice>): Choice => ({ target: 'bedtime', chosen: 'after_wake', reference: 'habit', basis: 'measured_better', better: ['after_wake'], evaluations: [], decisions: 20, at: 0, ...o });
  const h = (day: number, o: Partial<HistoryEntry>): HistoryEntry => ({ day, at: 0, engine: 't', target: 'bedtime', chosen: 'habit', reference: 'habit', basis: 'measured_better', decisions: 20, answered: 10, coverage: 0.8, interval: 50, referenceInterval: 60, ...o });

  it('jour 1 : le nouveau modèle gagne mais attend ; jour 2 de suite : il est adopté', () => {
    const d1 = stabilize(choice({}), null, [h(9, { chosen: 'habit' })], 10);
    expect(d1).toMatchObject({ chosen: 'habit', reason: 'switch_pending', candidate: 'after_wake', previous: 'habit' });
    const d2 = stabilize(choice({}), null, [h(9, { chosen: 'habit' }), h(10, { chosen: 'habit', candidate: 'after_wake' })], 11);
    expect(d2).toMatchObject({ chosen: 'after_wake', reason: 'switch_confirmed' });
  });

  it('un jour manquant ou un autre gagnant entre-temps : la confirmation repart de zéro', () => {
    expect(stabilize(choice({}), null, [h(8, { candidate: 'after_wake' })], 10).reason).toBe('switch_pending');
    expect(stabilize(choice({}), null, [h(10, { candidate: 'clock' })], 11).reason).toBe('switch_pending');
  });

  it('un seul mauvais jour ne fait pas tomber le modèle adopté s’il bat encore la référence', () => {
    const r = stabilize(choice({ chosen: 'clock', better: ['clock', 'after_wake'] }), null, [h(10, { chosen: 'after_wake' })], 11);
    expect(r).toMatchObject({ chosen: 'after_wake', reason: 'switch_pending', candidate: 'clock' });
  });

  it('vers la référence, tout de suite : rejeu moins bon, ou fenêtres réelles moins bonnes', () => {
    expect(stabilize(choice({ basis: 'measured_worse', chosen: 'habit', better: [] }), null, [h(10, { chosen: 'after_wake' })], 11)).toMatchObject({ chosen: 'habit', reason: 'demoted_replay' });
    const live = { model: 'after_wake', n: 12, liveScore: 90, referenceScore: 60, worse: true };
    expect(stabilize(choice({}), live, [h(10, { chosen: 'after_wake' })], 11)).toMatchObject({ chosen: 'habit', reason: 'demoted_live' });
  });

  it('rien de mesuré : le modèle par défaut, la raison est notée', () => {
    expect(stabilize(choice({ basis: 'unmeasured', chosen: 'habit', better: [] }), null, [], 3).reason).toBe('first_choice');
    expect(stabilize(choice({ basis: 'unmeasured', chosen: 'habit', better: [] }), null, [h(2, { chosen: 'habit' })], 3).reason).toBe('kept');
  });

});
