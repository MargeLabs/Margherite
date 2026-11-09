import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../types';
import type { KeyValueStore } from './forecastLog';
import { readShadow, recordShadow, SHADOW_CAP, shadowOutcomes, type ShadowEntry } from './shadowLog';

const MIN = 60_000;
const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
};
const t = (m: number) => new Date(2026, 8, 10, 0, m).getTime();
const entry = (wake: number, windows: ShadowEntry['windows'], shownAt = wake + MIN): ShadowEntry => ({ wake, shownAt, engine: 't', served: 'habit', windows });
const sleep = (id: string, a: number, b?: number): EngineEvent => ({ id, kind: 'sleep', start: t(a), ...(b !== undefined ? { end: t(b) } : {}) });

describe('journal de mesure en direct de chaque modèle', () => {
  it('garde la première fenêtre calculée après le réveil : une prévision prospective ne se réécrit pas', () => {
    const s = mem();
    recordShadow(s, entry(t(400), { a: [t(480), t(540)] }));
    recordShadow(s, entry(t(400), { a: [t(470), t(500)] }, t(450)));
    recordShadow(s, entry(t(700), { a: null }));
    expect(readShadow(s)).toMatchObject([{ wake: t(400), windows: { a: [t(480), t(540)] } }, { wake: t(700), windows: { a: null } }]);
  });

  it('borne la taille et ne casse jamais sur un stockage illisible', () => {
    const s = mem();
    for (let i = 0; i < SHADOW_CAP + 5; i++) recordShadow(s, entry(i * MIN, {}));
    expect(readShadow(s)).toHaveLength(SHADOW_CAP);
    s.setItem('canaille.shadowlog.v1', '{pas du json');
    expect(readShadow(s)).toEqual([]);
    expect(() => recordShadow({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } }, entry(1, {}))).not.toThrow();
  });

  it('résultat de chaque modèle : dedans, trop tôt, trop tard, en attente, jamais compté s’il n’a pas répondu', () => {
    const entries = [entry(t(400), { good: [t(450), t(500)], early: [t(480), t(540)], late: [t(420), t(440)], none: null })];
    const out = shadowOutcomes(entries, [sleep('n', 300, 400), sleep('next', 470, 530)]);
    expect(out.good![0]).toMatchObject({ status: 'inside', errorMin: 0 });
    expect(out.early![0]).toMatchObject({ status: 'early', errorMin: -10 });
    expect(out.late![0]).toMatchObject({ status: 'late', errorMin: 30 });
    expect(out.none).toBeUndefined();
    expect(shadowOutcomes(entries, [sleep('n', 300, 400)]).good![0]!.status).toBe('pending');
  });

  it('une fenêtre calculée après le dodo n’était plus une prévision', () => {
    const out = shadowOutcomes([entry(t(400), { a: [t(450), t(500)] }, t(600))], [sleep('n', 300, 400), sleep('next', 470, 530)]);
    expect(out.a![0]!.status).toBe('not_prospective');
  });
});
