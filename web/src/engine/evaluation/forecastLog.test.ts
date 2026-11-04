import { describe, expect, it } from 'vitest';
import { liveScore, LOG_CAP, readLog, recordForecast, resolveLog, type KeyValueStore, type LoggedForecast } from './forecastLog';
import type { EngineEvent } from '../types';

const MIN = 60_000;
const mem = (): KeyValueStore & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};
const f = (wake: number, from: number, to: number): LoggedForecast => ({ wake, from, to, shownAt: wake, model: 'survival', engine: 't' });
const sleep = (id: string, a: number, b: number): EngineEvent => ({ id, kind: 'sleep', start: a, end: b });

describe('journal des fenêtres affichées', () => {
  it('une entrée par réveil : la dernière fenêtre affichée remplace la précédente', () => {
    const s = mem();
    recordForecast(s, f(1000, 10, 20));
    recordForecast(s, f(1000, 12, 25));
    recordForecast(s, f(2000, 5, 9));
    expect(readLog(s).map((x) => [x.wake, x.from, x.to])).toEqual([[1000, 12, 25], [2000, 5, 9]]);
  });

  it('borné, et un stockage cassé ou refusé ne bloque jamais', () => {
    const s = mem();
    for (let i = 0; i < LOG_CAP + 20; i++) recordForecast(s, f(i, 0, 1));
    expect(readLog(s)).toHaveLength(LOG_CAP);
    expect(readLog(s)[0]!.wake).toBe(20);
    expect(readLog({ getItem: () => '{pas du json', setItem: () => {} })).toEqual([]);
    expect(() => recordForecast({ getItem: () => null, setItem: () => { throw new Error('plein'); } }, f(1, 0, 1))).not.toThrow();
  });

  it('résolution : dodo suivant le réveil, en attente tant qu’il n’a pas commencé', () => {
    const ev = [sleep('a', 0, 10 * MIN), sleep('b', 100 * MIN, 160 * MIN)];
    const r = resolveLog([f(10 * MIN, 90 * MIN, 120 * MIN), f(160 * MIN, 200 * MIN, 230 * MIN)], ev);
    expect(r.pending).toBe(1);
    expect(r.predictions).toEqual([{ at: 10 * MIN, actual: 100 * MIN, window: { from: 90 * MIN, to: 120 * MIN } }]);
  });

  it('score réel : couverture et erreur sur ce qui a été affiché', () => {
    const s = mem();
    recordForecast(s, f(10 * MIN, 90 * MIN, 120 * MIN)); // dodo à 100 : dedans, erreur 5 min
    recordForecast(s, f(200 * MIN, 250 * MIN, 270 * MIN)); // dodo à 400 : dehors
    const ev = [sleep('a', 0, 10 * MIN), sleep('b', 100 * MIN, 190 * MIN), sleep('c', 400 * MIN, 450 * MIN)];
    const r = liveScore(s, ev);
    expect(r.score.answered).toBe(2);
    expect(r.score.coverage).toBe(0.5);
    expect(r.score.medianErrorMin).toBeCloseTo((5 + 140) / 2, 5);
  });
});
