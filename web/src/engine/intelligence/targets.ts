// Les prévisions et leurs modèles, au même format : une fenêtre à 80 % autour d'un instant ou d'une durée, une référence à battre,
// et le rejeu sur le passé du bébé qui décide quel modèle sert. Aucun modèle ne passe devant la référence sans gain mesuré.
import { threshold } from '../config';
import { visibleAt, score, type Prediction, type Score } from '../evaluation/backtest';
import { arbiter } from '../evaluation/selection';
import { feedTimes, nextFeedWindow } from '../feeding/nextFeed';
import { habitsModel } from '../index';
import { awakeQuartiles, type Forecaster, type Window } from '../predictions/baselines';
import { survivalAgeModel, survivalModel, weightedAwake, weightedQuantile } from '../predictions/models';
import { med } from '../stats';
import { buildTimeline, DAY_MIN, isNapStart, type Timeline } from '../sleep/timeline';
import type { EngineEvent } from '../types';
import { learnProfile } from './learn';

const MIN = 60_000, DAY = 86_400_000;

export type TargetId = 'nap_start' | 'nap_duration' | 'bedtime' | 'feed';
export interface Dec {
  /** instant où la prévision se fait */
  at: number;
  /** ce qui s'est passé : un instant, ou une durée en millisecondes */
  actual: number;
  /** instant où le résultat est connu */
  known: number;
}

const ms = (tl: Timeline, t: number): number => new Date(tl.origin.getFullYear(), tl.origin.getMonth(), tl.origin.getDate(), 0, t).getTime();
const half = (): number => threshold('windowMinHalf') * MIN;
/** Une fenêtre n'est jamais plus étroite que ±15 min : ce serait une précision qu'aucune donnée de journal ne justifie. */
export const around = (from: number, to: number): Window => {
  const mid = (from + to) / 2, h = Math.max((to - from) / 2, half());
  return { from: mid - h, to: mid + h };
};
const q10_90 = (v: Array<{ v: number; w: number }>): [number, number] => [weightedQuantile(v, 0.1), weightedQuantile(v, 0.9)];

// ---------- prochain dodo ----------
const habitNap: Forecaster = ({ birthAt, events }, now) => {
  const w = habitsModel({ babyId: 'x', birthAt, events }, now).nextSleep.window;
  return w ? { from: w.from, to: w.to } : null;
};
const dayHours = (d: Dec): boolean => {
  const h = new Date(d.at).getHours();
  return h >= 6 && h < 21;
};
function napStartDecisions(events: EngineEvent[]): Dec[] {
  const sl = events.filter((e) => e.kind === 'sleep' && e.end !== undefined).sort((a, b) => a.start - b.start), out: Dec[] = [];
  sl.forEach((e, i) => {
    const next = sl[i + 1], at = Math.max(e.end ?? 0, e.endKnownAt ?? 0);
    if (next && next.start > at) out.push({ at, actual: next.start, known: next.start });
  });
  return out.filter(dayHours);
}

// ---------- coucher du soir : prévu à 15 h ----------
const bedContext = (input: { birthAt: number | null; events: EngineEvent[] }, now: number) => {
  const p = learnProfile(input, now);
  return { p, t0: p.tl.t0, clock: p.tl.now - p.tl.t0 };
};
const habitBed: Forecaster = (input, now) => {
  const { p, t0 } = bedContext(input, now);
  if (!p.typ.ok) return null;
  const h = threshold('windowMinHalf');
  return { from: ms(p.tl, t0 + Math.min(p.typ.bdR[0], p.typ.bed - h)), to: ms(p.tl, t0 + Math.max(p.typ.bdR[1], p.typ.bed + h)) };
};
const clockBed: Forecaster = (input, now) => {
  const { p, t0 } = bedContext(input, now);
  if (p.beds.length < threshold('bedMinNights')) return null;
  const [a, b] = q10_90(p.beds.map((x) => ({ v: x.rel, w: p.weight(x.day, 'bedtime') })));
  return around(ms(p.tl, t0 + a), ms(p.tl, t0 + b));
};
/**
 * Le coucher suit le dernier réveil : dernier réveil d'aujourd'hui + sa « dernière fenêtre d'éveil » apprise sur ses soirées passées.
 * Ne répond que quand ce réveil est probablement le dernier (autant de siestes que d'habitude) : avant, le coucher reste celui du calcul habituel.
 */
const afterWakeBed: Forecaster = (input, now) => {
  const { p, t0 } = bedContext(input, now);
  const need = threshold('bedMinNights');
  if (p.tl.running !== null || p.beds.length < need) return null;
  const ends = p.tl.sleeps.filter((z) => z.b >= p.tl.today * DAY_MIN && z.b <= p.tl.now).map((z) => z.b - p.tl.today * DAY_MIN);
  if (!ends.length || p.cal.dayOf(p.tl.today).naps.length < med(p.beds.map((x) => x.naps))) return null;
  const [a, b] = q10_90(p.beds.map((x) => ({ v: x.rel - x.lastWake, w: p.weight(x.day, 'bedtime') })));
  const last = Math.max(...ends);
  return around(ms(p.tl, t0 + last + a), ms(p.tl, t0 + last + b));
};
/** Une décision par soirée : à l'instant où l'application a su qu'il se réveillait pour la dernière fois avant la nuit. */
function bedDecisions(events: EngineEvent[]): Dec[] {
  if (!events.length) return [];
  const last = Math.max(...events.map((e) => e.end ?? e.start)), p = learnProfile({ birthAt: null, events }, last);
  return p.beds.flatMap((x): Dec[] => {
    const wake = ms(p.tl, x.day * DAY_MIN + x.lastWake), actual = ms(p.tl, x.day * DAY_MIN + x.rel);
    const e = events.find((y) => y.kind === 'sleep' && y.end !== undefined && Math.abs(y.end - wake) < MIN);
    const at = Math.max(wake, e?.endKnownAt ?? wake);
    return actual > at ? [{ at, actual, known: actual }] : [];
  });
}
/** Le coucher qui a suivi un réveil donné : celui de la même soirée. */
function resolveBed(anchor: number, events: EngineEvent[]): Dec | null {
  const d = bedDecisions(events).find((x) => x.actual > anchor && x.actual - anchor < 16 * 3_600_000);
  return d ? { at: anchor, actual: d.actual, known: d.known } : null;
}

// ---------- durée de la sieste qui commence ----------
const napContext = (input: { birthAt: number | null; events: EngineEvent[] }, now: number) => {
  const p = learnProfile(input, now);
  return { p, k: p.cal.dayOf(p.tl.today).naps.length, clock: p.tl.now - p.tl.t0 };
};
const habitDuration: Forecaster = (input, now) => {
  const { p, k } = napContext(input, now), z = p.typ.ok ? p.typ.naps.find((x) => x.k === k) : undefined;
  if (!z) return null;
  const h = threshold('habitSameDuration') * MIN;
  return { from: z.du * MIN - h, to: z.du * MIN + h };
};
const weightedDuration: Forecaster = (input, now) => {
  const { p, k } = napContext(input, now), need = threshold('napDurMinCases');
  const same = p.naps.filter((x) => x.k === k), use = same.length >= need ? same : p.naps;
  if (use.length < need) return null;
  const [a, b] = q10_90(use.map((x) => ({ v: x.dur * MIN, w: p.weight(x.day, 'napMinutes') })));
  return around(a, b);
};
const bandDuration: Forecaster = (input, now) => {
  const { p, clock } = napContext(input, now), band = p.naps.filter((x) => Math.abs(x.start - clock) <= threshold('napDurBandMin'));
  if (band.length < threshold('napDurMinCases')) return null;
  const [a, b] = q10_90(band.map((x) => ({ v: x.dur * MIN, w: p.weight(x.day, 'napMinutes') })));
  return around(a, b);
};
function napDurationDecisions(events: EngineEvent[]): Dec[] {
  if (!events.length) return [];
  const byId = new Map(events.map((e) => [e.id, e])), last = Math.max(...events.map((e) => e.end ?? e.start));
  const first = Math.min(...events.map((e) => e.start)), tl = buildTimeline(events, last, Math.min(120, Math.max(27, Math.ceil((last - first) / DAY) + 1)));
  return tl.sleeps.filter((z) => isNapStart(z.a)).flatMap((z): Dec[] => {
    const e = byId.get(z.parts[0] ?? '');
    // seulement les dodos suivis en direct : la durée n'a pu être prévue que si le chrono a démarré avec le dodo
    if (!e || (e.enteredAt ?? e.start) > e.start + threshold('liveEntryMax') * MIN) return [];
    return [{ at: Math.max(e.start, e.enteredAt ?? e.start), actual: (z.b - z.a) * MIN, known: e.start + (z.b - z.a) * MIN }];
  });
}

// ---------- prochain repas : une description, jamais une heure à tenir ----------
const lastGapFeed: Forecaster = ({ events }, now) => {
  const t = feedTimes(events).filter((x) => x >= now - threshold('baselineDays') * DAY), last = t[t.length - 1];
  const gaps = t.slice(1).map((x, i) => x - (t[i] ?? 0)).filter((g) => g <= threshold('mealGapMax') * MIN);
  if (last === undefined || gaps.length < threshold('baselineMinGaps')) return null;
  const m = med(gaps);
  return { from: last + m - half(), to: last + m + half() };
};
/** Un repas = son premier geste ; la prévision se fait au moment où il a été saisi (pas avant : l'application ne le connaissait pas). */
function feedDecisions(events: EngineEvent[]): Dec[] {
  const f = events.filter((e) => e.kind === 'bottle' || e.kind === 'breast').sort((x, y) => x.start - y.start);
  const meals = f.filter((e, i) => i === 0 || e.start - (f[i - 1]?.start ?? 0) > threshold('feedClusterMin') * MIN);
  return meals.slice(1).flatMap((x, i): Dec[] => {
    const prev = meals[i]!;
    return x.start - prev.start <= threshold('mealGapMax') * MIN ? [{ at: Math.max(prev.start, prev.enteredAt ?? prev.start), actual: x.start, known: x.start }] : [];
  });
}

export interface TargetDef {
  id: TargetId;
  decisions(events: EngineEvent[]): Dec[];
  models: Record<string, Forecaster>;
  reference: string;
  /** modèle servi tant que rien n'est mesuré : la référence, sauf décision explicite de Victor (survie en test, 2026-11-02) */
  unmeasured: string;
  /** une fenêtre plus large que ça n'informe plus (instants seulement) */
  maxWidthMin: number | null;
  /** retrouve le résultat qui suit une prévision notée, quand ce n'est pas la décision la plus proche */
  resolve?(anchor: number, events: EngineEvent[]): Dec | null;
}

export const TARGETS: Record<TargetId, TargetDef> = {
  nap_start: { id: 'nap_start', decisions: napStartDecisions, reference: 'habit', unmeasured: 'survival', maxWidthMin: threshold('forecastMaxWidth'), models: { habit: habitNap, survival: survivalModel, survival_age: survivalAgeModel, weighted7: weightedAwake(7), quartiles: awakeQuartiles } },
  bedtime: { id: 'bedtime', decisions: bedDecisions, resolve: resolveBed, reference: 'habit', unmeasured: 'habit', maxWidthMin: threshold('forecastMaxWidth'), models: { habit: habitBed, clock: clockBed, after_wake: afterWakeBed } },
  nap_duration: { id: 'nap_duration', decisions: napDurationDecisions, reference: 'habit', unmeasured: 'habit', maxWidthMin: null, models: { habit: habitDuration, weighted: weightedDuration, band: bandDuration } },
  feed: { id: 'feed', decisions: feedDecisions, reference: 'last_gap', unmeasured: 'last_gap', maxWidthMin: null, models: { last_gap: lastGapFeed, weighted: nextFeedWindow } },
};

export interface Evaluation {
  model: string;
  decisions: number;
  answered: number;
  coverage: number | null;
  medianErrorMin: number | null;
  medianWidthMin: number | null;
  intervalScoreMin: number | null;
}
export type Basis = 'measured_better' | 'measured_worse' | 'unmeasured';
export interface Choice {
  target: TargetId;
  chosen: string;
  reference: string;
  basis: Basis;
  evaluations: Evaluation[];
  decisions: number;
  at: number;
}

const evaluation = (model: string, s: Score): Evaluation => ({ model, decisions: s.decisions, answered: s.answered, coverage: s.coverage, medianErrorMin: s.medianErrorMin, medianWidthMin: s.medianWidthMin, intervalScoreMin: s.intervalScoreMin });

/** Rejoue chaque modèle sur les dernières décisions du bébé, avec le seul journal connu à l'époque, puis choisit. `view` remplace la reconstruction par saisies (mode dégradé) par un journal exact. */
export function evaluateTarget(id: TargetId, input: { birthAt: number | null; events: EngineEvent[] }, now: number, view: (events: EngineEvent[], at: number) => EngineEvent[] = visibleAt): Choice {
  const def = TARGETS[id];
  const decs = def.decisions(input.events).filter((d) => d.known <= now).slice(-threshold('evalMaxDecisions'));
  const runs = Object.entries(def.models).map(([name, model]): [string, Prediction[]] => [name, decs.map((d) => ({ at: d.at, actual: d.actual, window: model({ birthAt: input.birthAt, events: view(input.events, d.at) }, d.at) }))]);
  const ref = runs.find(([n]) => n === def.reference)?.[1] ?? [], min = threshold('conformalMinCases');
  // même fenêtre récente que l'arbitre ; le gain doit en plus atteindre le minimum exigé (10 %), pas seulement être positif
  const since = now - threshold('modelHistoryDays') * DAY, recent = (p: Prediction[]) => score(p.filter((x) => x.at >= since && x.actual <= now)).intervalScoreMin ?? Infinity;
  const need = recent(ref) * (1 - threshold('gainMin'));
  const better = runs.filter(([n, p]) => n !== def.reference && arbiter(p, ref, now) === 'model' && recent(p) <= need).map(([n, p]) => ({ n, s: recent(p) })).sort((a, b) => a.s - b.s);
  const measured = score(ref).answered >= min && runs.some(([n, p]) => n !== def.reference && score(p).answered >= min);
  const basis: Basis = better.length ? 'measured_better' : measured ? 'measured_worse' : 'unmeasured';
  const chosen = basis === 'measured_better' ? better[0]!.n : basis === 'measured_worse' ? def.reference : def.unmeasured;
  return { target: id, chosen, reference: def.reference, basis, evaluations: runs.map(([n, p]) => evaluation(n, score(p))), decisions: decs.length, at: now };
}
