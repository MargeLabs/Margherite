// Le journal en « heure murale » : des minutes depuis l'origine de la fenêtre, jours de 1440 minutes. Même repère que le calcul de production.
import { threshold } from '../config';
import { hasDstShift } from '../quality';
import type { EngineEvent, EngineEventKind } from '../types';

export const DAY_MIN = 1440;
/** Aujourd'hui = jour 27 de la fenêtre glissante de production. */
export const TODAY_INDEX = 27;

export interface WallEvent {
  id: string;
  kind: EngineEventKind;
  a: number;
  b?: number;
  ml?: number;
}
export interface WallSleep extends WallEvent {
  b: number;
  /** identifiants fusionnés dans cette sieste */
  parts: string[];
  /** éveils comblés par la fusion (de la fin d'une partie au début de la suivante) : étendue du bloc, mais pas du sommeil */
  gaps: Array<[number, number]>;
}

/** Minutes réellement dormies dans [lo, hi] : l'étendue du bloc moins les éveils comblés par la fusion. */
export const sleepIn = (z: { a: number; b: number; gaps?: Array<[number, number]> }, lo = -Infinity, hi = Infinity): number => {
  const span = (a: number, b: number) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  return span(z.a, z.b) - (z.gaps ?? []).reduce((t, [a, b]) => t + span(a, b), 0);
};

export interface Timeline {
  today: number;
  origin: Date;
  /** vrai si ce jour de la fenêtre a un changement d'heure */
  dst(d: number): boolean;
  /** minutes depuis l'origine, à l'instant du calcul */
  now: number;
  t0: number;
  events: WallEvent[];
  sleeps: WallSleep[];
  feeds: WallEvent[];
  /** début du dodo en cours, sinon null */
  running: number | null;
}

const calendarDays = (from: Date, to: Date): number => Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000);

export function wallMinutes(ts: number, origin: Date): number {
  const d = new Date(ts);
  return calendarDays(origin, d) * DAY_MIN + d.getHours() * 60 + d.getMinutes();
}

export const isNapStart = (a: number): boolean => a % DAY_MIN >= threshold('napDayStart') && a % DAY_MIN < threshold('napDayEnd');

export function buildTimeline(input: EngineEvent[], nowMs: number, today = TODAY_INDEX): Timeline {
  const nowD = new Date(nowMs);
  const origin = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() - today);
  const t0 = today * DAY_MIN, now = t0 + nowD.getHours() * 60 + nowD.getMinutes();
  const toWall = (e: EngineEvent): WallEvent => ({ id: e.id, kind: e.kind, a: wallMinutes(e.start, origin), ...(e.end !== undefined ? { b: wallMinutes(e.end, origin) } : {}), ...(e.ml !== undefined ? { ml: e.ml } : {}) });
  const open = input.find((e) => e.kind === 'sleep' && e.end === undefined);
  const events = input.filter((e) => !(e.kind === 'sleep' && e.end === undefined)).map(toWall).filter((e) => e.a >= 0 && e.a <= now).sort((x, y) => x.a - y.a);
  // siestes de jour rapprochées = une seule sieste ; la nuit : seulement un éveil de nightMergeGap min au plus après un vrai bloc (≥ nightFirstBlock), au-delà c'est un réveil ; un repas pendant l'éveil de nuit en fait toujours un réveil (Victor, 2026-11-05)
  const mealIn = (a: number, b: number) => events.some((f) => (f.kind === 'bottle' || f.kind === 'breast') && f.a >= a && f.a <= b);
  const sleeps = events.filter((e): e is WallEvent & { b: number } => e.kind === 'sleep').reduce<WallSleep[]>((o, e) => {
    const p = o[o.length - 1];
    if (p && (isNapStart(p.a) && isNapStart(e.a) && Math.floor(p.a / DAY_MIN) === Math.floor(e.a / DAY_MIN) ? e.a - p.b <= threshold('napMergeGap') : !isNapStart(p.a) && e.a - p.b <= threshold('nightMergeGap') && p.b - p.a >= threshold('nightFirstBlock') && !mealIn(p.b, e.a))) o[o.length - 1] = { ...p, b: Math.max(p.b, e.b), parts: [...p.parts, e.id], gaps: e.a > p.b ? [...p.gaps, [p.b, e.a]] : p.gaps };
    else o.push({ ...e, parts: [e.id], gaps: [] });
    return o;
  }, []);
  const dst = (d: number) => hasDstShift(new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() + d, 12).getTime());
  return { today, origin, dst, now, t0, events, sleeps, feeds: events.filter((e) => e.kind === 'bottle' || e.kind === 'breast'), running: open ? wallMinutes(open.start, origin) : null };
}
