// Journaux synthétiques partagés par les tests de bout en bout du prochain dodo (jamais utilisés en production).
import { rng } from '../evaluation/synthetic';
import type { EngineEvent } from '../types';

export const MIN = 60_000;
export const at = (d: number, minutes: number): number => new Date(2026, 8, 1 + d, 0, minutes).getTime();

/** 14 jours : réveil ~7 h 15 ± 40 min, siestes 1 h 10 après le réveil, puis ~1 h 40 après chaque sieste. Tout saisi en direct. */
export function babyDays(days = 14): EngineEvent[] {
  const u = rng(3), out: EngineEvent[] = [];
  let k = 0, prevBed = 1200;
  const sl = (a: number, e: number, sd: number, ed: number) => out.push({ id: `s${k++}`, kind: 'sleep', start: at(sd, a), end: at(ed, e), enteredAt: at(sd, a), endKnownAt: at(ed, e) });
  for (let d = 0; d < days; d++) {
    const wake = 435 + Math.round((u() * 2 - 1) * 40), n1 = wake + 70, n2 = n1 + 60 + 100, n3 = n2 + 85 + 110;
    sl(prevBed, wake, d - 1, d); sl(n1, n1 + 60, d, d); sl(n2, n2 + 85, d, d); sl(n3, n3 + 50, d, d);
    prevBed = 1200;
    [0, 3, 6, 9, 12].forEach((h) => out.push({ id: `f${k++}`, kind: 'bottle', start: at(d, wake + h * 60 + 5), ml: 120, enteredAt: at(d, wake + h * 60 + 7) }));
  }
  return out;
}

/** L'historique, puis la nuit qui finit au réveil `wake` (minutes) du jour `day`. */
export const withNight = (wake: number, day = 14, days = 14): EngineEvent[] => [...babyDays(days), { id: 'night', kind: 'sleep', start: at(day - 1, 1200), end: at(day, wake), enteredAt: at(day - 1, 1200), endKnownAt: at(day, wake) }];

/** Le format d'entrée de l'écran (`viewEngine`) : minutes depuis le minuit de `origin`. */
export function screenView(events: EngineEvent[], origin: Date, now: number) {
  const minutes = (t: number) => Math.round((t - origin.getTime()) / MIN);
  return { origin, now: minutes(now), birthAt: null, events: events.map((e) => ({ id: e.id, k: e.kind === 'bottle' ? 'bib' : 'sleep', a: minutes(e.start), ...(e.end !== undefined ? { b: minutes(e.end) } : {}), ...(e.ml ? { ml: e.ml } : {}) })) };
}
