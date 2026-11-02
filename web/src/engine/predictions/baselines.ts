// Références simples, à battre avant tout modèle. Elles ne sont pas des modèles candidats à l'affichage.
import { threshold } from '../config';
import type { EngineEvent, EngineInput } from '../types';

export interface Window {
  from: number;
  to: number;
}
export type Forecaster = (input: Pick<EngineInput, 'birthAt' | 'events'>, now: number) => Window | null;

const MIN = 60_000;
const DAY = 86_400_000;

/** Durées d'éveil récentes, du plus ancien au plus récent ; les longs trous sont écartés : un trou de saisie n'est pas un éveil. */
function recentAwake(events: EngineEvent[], now: number): number[] {
  const since = now - threshold('baselineDays') * DAY;
  const sl = events.filter((e) => e.kind === 'sleep' && e.end !== undefined && e.start >= since).sort((a, b) => a.start - b.start);
  const out: number[] = [];
  sl.forEach((e, i) => {
    const prev = sl[i - 1];
    if (!prev) return;
    const gap = e.start - (prev.end ?? e.start);
    if (gap > 0 && gap <= threshold('baselineMaxAwake') * MIN) out.push(gap);
  });
  return out;
}

const lastWake = (events: EngineEvent[]): number | null => {
  const ends = events.filter((e) => e.kind === 'sleep').map((e) => e.end);
  if (ends.some((x) => x === undefined)) return null; // il dort : pas de prochain dodo à prévoir
  return ends.length ? Math.max(...(ends as number[])) : null;
};

const q = (v: number[], p: number): number => v[Math.min(v.length - 1, Math.floor(p * v.length))] ?? 0;

/** Dernier réveil + quartiles des éveils de ses 7 derniers jours. */
export const awakeQuartiles: Forecaster = ({ events }, now) => {
  const w = lastWake(events);
  const gaps = recentAwake(events, now).sort((a, b) => a - b);
  if (w === null || gaps.length < threshold('baselineMinGaps')) return null;
  return { from: w + q(gaps, 0.25), to: w + q(gaps, 0.75) };
};

/** Dernier réveil + dernier éveil observé, à plus ou moins la demi-largeur minimale. */
export const lastInterval: Forecaster = ({ events }, now) => {
  const w = lastWake(events);
  const last = recentAwake(events, now).pop();
  if (w === null || last === undefined) return null;
  const half = threshold('windowMinHalf') * MIN;
  return { from: w + last - half, to: w + last + half };
};
