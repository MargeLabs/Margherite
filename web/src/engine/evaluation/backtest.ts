// Rejeu chronologique : à chaque réveil, on ne donne au modèle que ce qui était déjà saisi, puis on compare au dodo qui a suivi.
import { rng } from './synthetic';
import type { Forecaster, Window } from '../predictions/baselines';
import type { EngineEvent, EngineInput } from '../types';

const MIN = 60_000;

/** Le journal tel qu'on le connaissait à l'instant `t` : un sommeil dont la fin n'était pas encore saisie est encore en cours. */
export function visibleAt(events: EngineEvent[], t: number): EngineEvent[] {
  const out: EngineEvent[] = [];
  for (const e of events) {
    if (e.start > t || (e.enteredAt ?? e.start) > t) continue;
    if (e.end !== undefined && (e.end > t || (e.endKnownAt ?? e.end) > t)) {
      const { end: _end, endKnownAt: _known, ...open } = e;
      out.push(open);
    } else out.push(e);
  }
  return out;
}

export interface Decision {
  /** instant de la prévision */
  at: number;
  /** début réel du dodo suivant */
  actual: number;
}

/** Une décision par réveil, dès que la fin du sommeil est connue ; écartée si le dodo suivant a déjà commencé à ce moment-là. */
export function decisions(events: EngineEvent[]): Decision[] {
  const sl = events.filter((e) => e.kind === 'sleep' && e.end !== undefined).sort((a, b) => a.start - b.start);
  const out: Decision[] = [];
  sl.forEach((e, i) => {
    const next = sl[i + 1];
    if (!next) return;
    const at = Math.max(e.end ?? 0, e.endKnownAt ?? 0);
    if (next.start > at) out.push({ at, actual: next.start });
  });
  return out;
}

export interface Prediction extends Decision {
  window: Window | null;
}

export function replay(input: Pick<EngineInput, 'birthAt' | 'events'>, model: Forecaster, keep: (d: Decision) => boolean = () => true): Prediction[] {
  return decisions(input.events).filter(keep).map((d) => ({ ...d, window: model({ birthAt: input.birthAt, events: visibleAt(input.events, d.at) }, d.at) }));
}

export interface Score {
  decisions: number;
  answered: number;
  abstentionRate: number;
  coverage: number | null;
  medianErrorMin: number | null;
  meanErrorMin: number | null;
  medianWidthMin: number | null;
  /** score d'intervalle à 80 % (Winkler) : plus bas = mieux ; pénalise largeur et ratés */
  intervalScoreMin: number | null;
}

const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b), k = Math.floor(s.length / 2);
  return s.length % 2 ? (s[k] ?? 0) : ((s[k - 1] ?? 0) + (s[k] ?? 0)) / 2;
};
const mean = (v: number[]): number | null => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const errorMin = (p: Prediction & { window: Window }): number => Math.abs(p.actual - (p.window.from + p.window.to) / 2) / MIN;

export function score(preds: Prediction[]): Score {
  const ok = preds.filter((p): p is Prediction & { window: Window } => p.window !== null);
  const interval = ok.map((p) => {
    const { from, to } = p.window, w = (to - from) / MIN, alpha = 0.2;
    const miss = p.actual < from ? from - p.actual : p.actual > to ? p.actual - to : 0;
    return w + ((2 / alpha) * miss) / MIN;
  });
  return {
    decisions: preds.length,
    answered: ok.length,
    abstentionRate: preds.length ? 1 - ok.length / preds.length : 0,
    coverage: ok.length ? ok.filter((p) => p.actual >= p.window.from && p.actual <= p.window.to).length / ok.length : null,
    medianErrorMin: median(ok.map(errorMin)),
    meanErrorMin: mean(ok.map(errorMin)),
    medianWidthMin: median(ok.map((p) => (p.window.to - p.window.from) / MIN)),
    intervalScoreMin: mean(interval),
  };
}

/**
 * Gain de A sur B, en erreur médiane, sur les seuls instants où les deux répondent. L'intervalle à 90 % vient d'un bootstrap par jours :
 * les prévisions d'une même journée se ressemblent, les tirer une par une donnerait une fausse précision.
 */
export function pairedGain(a: Prediction[], b: Prediction[], seed = 1, draws = 2000): { n: number; days: number; gain: number; low: number; high: number } | null {
  const byAt = new Map(b.map((p) => [p.at, p]));
  const pairs: Array<{ day: number; ea: number; eb: number }> = [];
  for (const p of a) {
    const o = byAt.get(p.at);
    if (p.window && o?.window) pairs.push({ day: Math.floor(p.at / 86_400_000), ea: errorMin(p as Prediction & { window: Window }), eb: errorMin(o as Prediction & { window: Window }) });
  }
  if (!pairs.length) return null;
  const gainOf = (x: typeof pairs): number => {
    const mb = median(x.map((p) => p.eb)) ?? 0;
    return mb ? 1 - (median(x.map((p) => p.ea)) ?? 0) / mb : 0;
  };
  const days = [...new Set(pairs.map((p) => p.day))];
  const r = rng(seed), all: number[] = [];
  for (let i = 0; i < draws; i++) {
    const s: typeof pairs = [];
    for (let k = 0; k < days.length; k++) {
      const d = days[Math.floor(r() * days.length)];
      s.push(...pairs.filter((p) => p.day === d));
    }
    all.push(gainOf(s));
  }
  all.sort((x, y) => x - y);
  return { n: pairs.length, days: days.length, gain: gainOf(pairs), low: all[Math.floor(0.05 * draws)] ?? 0, high: all[Math.floor(0.95 * draws)] ?? 0 };
}
