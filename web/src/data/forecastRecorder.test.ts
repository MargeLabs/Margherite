import { describe, expect, it } from 'vitest';
import { withForecastLog } from './forecastRecorder';
import { readLog, type KeyValueStore } from '@/engine/evaluation/forecastLog';
import type { ViewEngine } from '@/engine/bridge';

const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
};
const origin = new Date(2026, 8, 10);
const day = (m: number) => new Date(2026, 8, 10, 0, m).getTime();
const fake = (r: { a: number; b: number } | null): ViewEngine => ({ calendar: (() => null) as never, links: (() => null) as never, nextSleep: () => (r ? { ...r, model: 'survival', measured: false } : null), bedtime: () => null, intelligence: () => ({ predictions: [], evaluation: [], generatedAt: 0, engineVersion: 't' }) as never });
const ev = (b?: number) => ({ id: 'a', k: 'sleep', a: 600, ...(b !== undefined ? { b } : {}) });

describe('journal des fenêtres affichées', () => {
  it('note la fenêtre montrée, rattachée au dernier réveil', () => {
    const s = mem();
    const out = withForecastLog(fake({ a: 800, b: 860 }), s).nextSleep({ origin, now: 780, events: [ev(700)] });
    expect(out).toMatchObject({ a: 800, b: 860 });
    expect(readLog(s)).toMatchObject([{ wake: day(700), from: day(800), to: day(860) }]);
  });
  it('rien à noter quand il dort, sans réveil connu ou sans prévision', () => {
    const s = mem();
    withForecastLog(fake({ a: 800, b: 860 }), s).nextSleep({ origin, now: 780, events: [ev()] });
    withForecastLog(fake({ a: 800, b: 860 }), s).nextSleep({ origin, now: 780, events: [] });
    withForecastLog(fake(null), s).nextSleep({ origin, now: 780, events: [ev(700)] });
    expect(readLog(s)).toEqual([]);
  });
  it('sans stockage : le moteur est rendu tel quel', () => {
    const e = fake(null);
    expect(withForecastLog(e, null)).toBe(e);
  });
});
