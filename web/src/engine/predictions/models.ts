// Modèles candidats pour le prochain dodo. Aucun n'est activé : chacun doit d'abord battre le calcul actuel sur des données jamais vues.
// Tous visent une fenêtre à 80 %. Les paramètres sont appris sur le bébé, jamais importés d'adultes ni d'une table non sourcée.
import { threshold } from '../config';
import { CURRENT_RULES } from '../rules';
import { createCalendar } from '../sleep/calendar';
import { buildTimeline, TODAY_INDEX } from '../sleep/timeline';
import type { EngineEvent, EngineInput } from '../types';
import type { Forecaster, Window } from './baselines';

const MIN = 60_000, DAY = 86_400_000;
const Z80 = 1.2816;

export interface AwakeSample {
  /** réveil */
  at: number;
  min: number;
}

export interface AwakeSpan {
  from: number;
  to: number;
  /** durée du sommeil qui précède, en minutes */
  sleepBeforeMin: number;
}

/**
 * Ses vrais éveils de jour. Les siestes rapprochées comptent pour une seule, un réveil à l'intérieur d'une nuit n'est pas un éveil,
 * et un long trou de saisie non plus : sinon quelques réveils de 5 minutes faussent toutes les fenêtres.
 */
export function dayAwakeSpans(events: EngineEvent[], now: number, days: number): AwakeSpan[] {
  const first = events.reduce((t, e) => Math.min(t, e.start), now);
  const tl = buildTimeline(events, now, Math.max(TODAY_INDEX, Math.ceil((now - first) / DAY) + 1));
  const cal = createCalendar(tl, CURRENT_RULES), inNight = new Set<string>();
  for (let d = 1; d <= tl.today; d++) (cal.nightOf(d).sl ?? []).slice(1).forEach((z) => inNight.add(z.id));
  const ms = (t: number) => new Date(tl.origin.getFullYear(), tl.origin.getMonth(), tl.origin.getDate(), 0, t).getTime();
  const out: AwakeSpan[] = [];
  tl.sleeps.forEach((e, i) => {
    const prev = tl.sleeps[i - 1];
    if (!prev || inNight.has(e.id)) return;
    const gap = e.a - prev.b;
    if (gap > 0 && gap <= threshold('baselineMaxAwake') && ms(e.a) >= now - days * DAY) out.push({ from: ms(prev.b), to: ms(e.a), sleepBeforeMin: prev.b - prev.a });
  });
  return out;
}

export function awakeSamples(events: EngineEvent[], now: number, days: number): AwakeSample[] {
  return dayAwakeSpans(events, now, days).map((s) => ({ at: s.from, min: (s.to - s.from) / MIN }));
}

/** Une fenêtre trop large n'informe plus : le modèle s'abstient. */
const capped = (f: Forecaster): Forecaster => (input, now) => {
  const w = f(input, now);
  return w && w.to - w.from <= threshold('forecastMaxWidth') * MIN ? w : null;
};

export function lastWakeAt(events: EngineEvent[]): number | null {
  const sl = events.filter((e) => e.kind === 'sleep');
  if (!sl.length || sl.some((e) => e.end === undefined)) return null;
  return Math.max(...sl.map((e) => e.end as number));
}

export function weightedQuantile(values: Array<{ v: number; w: number }>, p: number): number {
  const s = values.slice().sort((a, b) => a.v - b.v), total = s.reduce((t, x) => t + x.w, 0);
  let acc = 0;
  for (const x of s) {
    acc += x.w;
    if (acc >= p * total) return x.v;
  }
  return s[s.length - 1]?.v ?? 0;
}

/** E1 : quantiles de ses éveils, le récent pesant plus. */
export const weightedAwake = (halfLifeDays: number): Forecaster => capped(({ events }, now) => {
  const w = lastWakeAt(events), s = awakeSamples(events, now, threshold('modelHistoryDays'));
  if (w === null || s.length < threshold('modelMinGaps')) return null;
  const v = s.map((x) => ({ v: x.min, w: 0.5 ** ((now - x.at) / (halfLifeDays * DAY)) }));
  return { from: w + weightedQuantile(v, 0.1) * MIN, to: w + weightedQuantile(v, 0.9) * MIN };
});

/** E6 : Normale-Gamma inverse sur le logarithme des éveils, a priori plat. Peu de données = fenêtre large, naturellement. */
export const bayesAwake: Forecaster = capped(({ events }, now) => {
  const w = lastWakeAt(events), s = awakeSamples(events, now, threshold('modelHistoryDays')).map((x) => Math.log(x.min));
  if (w === null || s.length < threshold('modelMinGaps')) return null;
  const n = s.length, m = s.reduce((a, b) => a + b, 0) / n, ss = s.reduce((a, b) => a + (b - m) ** 2, 0);
  const df = n - 1, v = (ss / df) * (1 + 1 / n);
  const q = Z80 * (1 + 1.2 / df) * Math.sqrt(v); // quantile de Student approché
  return { from: w + Math.exp(m - q) * MIN, to: w + Math.exp(m + q) * MIN };
});

/** Filtre de Kalman à niveau local. Rend le niveau courant et sa variance ; le rapport des bruits vient de la série elle-même. */
export function localLevel(series: number[]): { level: number; variance: number; noise: number } | null {
  if (series.length < 4) return null;
  const diffs = series.slice(1).map((x, i) => x - (series[i] ?? 0));
  const c0 = diffs.reduce((a, b) => a + b * b, 0) / diffs.length;
  const c1 = diffs.slice(1).reduce((a, b, i) => a + b * (diffs[i] ?? 0), 0) / Math.max(1, diffs.length - 1);
  const r = Math.max(-c1, 1e-6), q = Math.max(c0 - 2 * r, 1e-6);
  let level = series[0] ?? 0, p = r;
  for (const y of series.slice(1)) {
    p += q;
    const k = p / (p + r);
    level += k * (y - level);
    p *= 1 - k;
  }
  return { level, variance: p + q, noise: r };
}

/** E3 : Kalman sur le logarithme des éveils. */
export const kalmanAwake: Forecaster = capped(({ events }, now) => {
  const w = lastWakeAt(events), s = awakeSamples(events, now, threshold('modelHistoryDays')).map((x) => Math.log(x.min));
  if (w === null || s.length < threshold('modelMinGaps')) return null;
  const f = localLevel(s);
  if (!f) return null;
  const q = Z80 * Math.sqrt(f.variance + f.noise);
  return { from: w + Math.exp(f.level - q) * MIN, to: w + Math.exp(f.level + q) * MIN };
});

// ---------- E2 : survie à temps discret, structure inspirée du modèle à deux processus ----------
// « S » = temps éveillé, « C » = heure de la journée. Aucune sortie n'est une pression de sommeil mesurée.

const featureNames = ['bias', 'awake', 'awake2', 'sinDay', 'cosDay', 'sinHalf', 'cosHalf', 'sleep24', 'lastNap'] as const;

function features(awakeMin: number, t: number, sleep24Min: number, lastNapMin: number): number[] {
  const d = new Date(t), h = (d.getHours() + d.getMinutes() / 60) / 24;
  const a = awakeMin / 120;
  return [1, a, a * a, Math.sin(2 * Math.PI * h), Math.cos(2 * Math.PI * h), Math.sin(4 * Math.PI * h), Math.cos(4 * Math.PI * h), sleep24Min / 720 - 1, lastNapMin / 60];
}

const logistic = (b: number[], x: number[]): number => 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)));

const sleepInLast24 = (sl: EngineEvent[], t: number): number => sl.reduce((s, e) => s + Math.max(0, Math.min(e.end ?? t, t) - Math.max(e.start, t - DAY)), 0) / MIN;

export function fitHazard(events: EngineEvent[], now: number): number[] | null {
  const step = threshold('survivalStepMin') * MIN;
  const sl = events.filter((e) => e.kind === 'sleep' && e.end !== undefined);
  const spans = dayAwakeSpans(events, now, threshold('modelHistoryDays'));
  if (spans.length < threshold('modelMinGaps')) return null;
  const X: number[][] = [], Y: number[] = [];
  spans.forEach((s) => {
    for (let t = s.from; t < s.to; t += step) {
      X.push(features((t - s.from) / MIN, t, sleepInLast24(sl, t), s.sleepBeforeMin));
      Y.push(t + step >= s.to ? 1 : 0);
    }
  });
  const pos = Y.filter(Boolean).length;
  if (pos < threshold('modelMinGaps')) return null;
  const k = featureNames.length, base = pos / Y.length, b = new Array<number>(k).fill(0);
  b[0] = Math.log(base / (1 - base)); // point de départ : le taux moyen
  const lambda = threshold('survivalRidge'), lr = 0.3;
  for (let it = 0; it < threshold('survivalIterations'); it++) {
    const g = new Array<number>(k).fill(0);
    X.forEach((x, n) => {
      const e = (Y[n] ?? 0) - logistic(b, x);
      x.forEach((v, j) => {
        g[j] = (g[j] ?? 0) + e * v;
      });
    });
    for (let j = 0; j < k; j++) b[j] = (b[j] ?? 0) + (lr / X.length) * ((g[j] ?? 0) - (j ? lambda * (b[j] ?? 0) : 0));
  }
  return b;
}

export const survivalModel: Forecaster = capped(({ events }: Pick<EngineInput, 'birthAt' | 'events'>, now) => {
  const w = lastWakeAt(events);
  const b = w === null ? null : fitHazard(events, w);
  if (w === null || !b) return null;
  const sl = events.filter((e) => e.kind === 'sleep' && e.end !== undefined);
  const lastNap = sl.reduce((a, e) => ((e.end as number) > (a.end as number) ? e : a));
  const nap = ((lastNap.end as number) - lastNap.start) / MIN, s24 = sleepInLast24(sl, w);
  const step = threshold('survivalStepMin');
  let alive = 1, t = w, from: number | null = null, to: number | null = null;
  // depuis le réveil, pas depuis `now` : la fenêtre ne bouge que si le journal change, et elle peut se tromper
  for (let i = 0; i < 40 && to === null; i++) {
    alive *= 1 - logistic(b, features((t - w) / MIN, t, s24, nap));
    t += step * MIN;
    if (from === null && 1 - alive >= 0.1) from = t - step * MIN;
    if (1 - alive >= 0.9) to = t;
  }
  if (from === null || to === null) return null;
  // le modèle lisse mal le tout début de l'éveil : pas d'ouverture avant ses 10 % d'éveils les plus courts, même cible que la fenêtre
  const shortest = weightedQuantile(dayAwakeSpans(events, w, threshold('modelHistoryDays')).map((s) => ({ v: s.to - s.from, w: 1 })), 0.1);
  if (now > to) return null;
  return { from: Math.max(from, Math.min(w + shortest, to - step * MIN)), to } satisfies Window;
});
