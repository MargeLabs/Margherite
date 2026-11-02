// Journaux synthétiques à réponse connue. Ils vérifient la mécanique du code et ne prouvent jamais la justesse d'un modèle :
// ils ne contiennent que ce qu'on y a mis. Tout rapport qui les utilise le dit.
import type { EngineEvent } from '../types';

export interface SyntheticOptions {
  seed: number;
  /** premier jour, minuit local */
  from: Date;
  days: number;
  wakeMin: number;
  bedMin: number;
  naps: number;
  awakeMin: number;
  napMin: number;
  /** écart type du bruit sur les durées, en minutes */
  noiseMin: number;
  nightWakings: number;
  feedEveryMin: number;
  /** part de tétées parmi les repas */
  breastShare: number;
  /** probabilité qu'une journée entière ne soit pas notée */
  missingDayRate: number;
  /** probabilité qu'un événement soit saisi tard */
  lateEntryRate: number;
  /** à partir de ce jour, le bébé fait une sieste de moins (rupture connue) */
  breakDay?: number;
}

/** Générateur déterministe (mulberry32). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60_000;

export function syntheticLog(o: SyntheticOptions): EngineEvent[] {
  const r = rng(o.seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const noisy = (m: number) => Math.round(m + gauss() * o.noiseMin);
  let n = 0;
  const out: EngineEvent[] = [];
  const add = (e: Omit<EngineEvent, 'id' | 'enteredAt' | 'endKnownAt'>) => {
    const delay = (r() < o.lateEntryRate ? 180 : 2) * MIN;
    const known = (e.end ?? e.start) + delay;
    out.push({ ...e, id: `s${o.seed}-${n++}`, enteredAt: e.kind === 'sleep' ? e.start + 2 * MIN : known, ...(e.end !== undefined ? { endKnownAt: known } : {}) });
  };
  const feed = (t: number) => {
    if (r() < o.breastShare) add({ kind: 'breast', start: t, side: r() < 0.5 ? 'G' : 'D', durationMin: null });
    else add({ kind: 'bottle', start: t, ml: 90 + Math.floor(r() * 7) * 10 });
  };

  for (let d = 0; d < o.days; d++) {
    const missing = r() < o.missingDayRate;
    const midnight = new Date(o.from.getFullYear(), o.from.getMonth(), o.from.getDate() + d).getTime();
    const naps = o.breakDay !== undefined && d >= o.breakDay ? o.naps - 1 : o.naps;
    const wake = midnight + noisy(o.wakeMin) * MIN;
    const bed = midnight + noisy(o.bedMin) * MIN;
    let t = wake;
    const sleeps: Array<[number, number]> = [];
    for (let k = 0; k < naps; k++) {
      const a = t + Math.max(20, noisy(o.awakeMin)) * MIN;
      const b = a + Math.max(15, noisy(o.napMin)) * MIN;
      if (b > bed - 30 * MIN) break;
      sleeps.push([a, b]);
      t = b;
    }
    // la nuit : blocs jusqu'au réveil du lendemain, séparés d'éveils courts
    const nextWake = midnight + 1440 * MIN + noisy(o.wakeMin) * MIN;
    const part = (nextWake - bed) / (o.nightWakings + 1);
    let a = bed;
    for (let k = 0; k <= o.nightWakings; k++) {
      const b = k === o.nightWakings ? nextWake : a + Math.round(part - 12 * MIN);
      sleeps.push([a, b]);
      a = b + 25 * MIN;
    }
    if (missing) continue;
    sleeps.forEach(([x, y]) => add({ kind: 'sleep', start: x, end: y }));
    for (let f = wake + 10 * MIN; f < bed; f += Math.max(45, noisy(o.feedEveryMin)) * MIN) {
      if (!sleeps.some(([x, y]) => x <= f && y > f)) feed(f);
    }
    add({ kind: 'diaper', start: wake + 15 * MIN });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Les journaux de référence : un cas par situation que le moteur doit tenir. */
export const SCENARIOS: Record<string, Omit<SyntheticOptions, 'from' | 'days'>> = {
  regulier: { seed: 1, wakeMin: 420, bedMin: 1200, naps: 3, awakeMin: 110, napMin: 75, noiseMin: 8, nightWakings: 1, feedEveryMin: 180, breastShare: 0, missingDayRate: 0, lateEntryRate: 0 },
  irregulier: { seed: 2, wakeMin: 450, bedMin: 1230, naps: 3, awakeMin: 120, napMin: 60, noiseMin: 35, nightWakings: 2, feedEveryMin: 170, breastShare: 0.2, missingDayRate: 0, lateEntryRate: 0.1 },
  troue: { seed: 3, wakeMin: 420, bedMin: 1200, naps: 3, awakeMin: 110, napMin: 70, noiseMin: 15, nightWakings: 1, feedEveryMin: 180, breastShare: 0, missingDayRate: 0.25, lateEntryRate: 0.2 },
  leveTot: { seed: 4, wakeMin: 320, bedMin: 1170, naps: 3, awakeMin: 100, napMin: 70, noiseMin: 5, nightWakings: 1, feedEveryMin: 180, breastShare: 0, missingDayRate: 0, lateEntryRate: 0 },
  nouveauNe: { seed: 5, wakeMin: 480, bedMin: 1260, naps: 5, awakeMin: 55, napMin: 85, noiseMin: 20, nightWakings: 3, feedEveryMin: 140, breastShare: 0.8, missingDayRate: 0, lateEntryRate: 0.1 },
  allaitement: { seed: 6, wakeMin: 420, bedMin: 1200, naps: 3, awakeMin: 110, napMin: 70, noiseMin: 15, nightWakings: 2, feedEveryMin: 150, breastShare: 1, missingDayRate: 0, lateEntryRate: 0 },
  rupture: { seed: 7, wakeMin: 420, bedMin: 1200, naps: 4, awakeMin: 90, napMin: 60, noiseMin: 10, nightWakings: 1, feedEveryMin: 180, breastShare: 0, missingDayRate: 0, lateEntryRate: 0, breakDay: 14 },
};
