// Le pont entre la logique de l'écran et le moteur : l'écran garde ses objets et ses textes, le moteur décide des nuits, des journées et des liens.
import { associations } from './patterns/associations';
import { threshold } from './config';
import type { FactorKey, LinkRow, OutcomeKey } from './patterns/links';
import { survivalModel } from './predictions/models';
import { runIntelligence, type IntelligenceReport, type Options } from './intelligence/run';
import type { TargetId } from './intelligence/targets';
import { hasDstShift } from './quality';
import { CURRENT_RULES } from './rules';
import { createCalendar, type Calendar } from './sleep/calendar';
import { DAY_MIN, TODAY_INDEX, type Timeline, type WallEvent, type WallSleep } from './sleep/timeline';
import type { EngineEvent } from './types';

const KIND: Record<string, WallEvent['kind']> = { bib: 'bottle', sein: 'breast', sleep: 'sleep', chg: 'diaper' };

interface ViewItem {
  id: string;
  k: string;
  a: number;
  b?: number;
  ml?: number;
}

/** Un facteur qui contient l'heure du coucher serait lié au coucher par construction. */
const TAUTOLOGIES = new Set(['awb|bed']);

function viewCalendar(v: { origin: Date; now: number; events: ViewItem[]; sleeps: ViewItem[]; feeds: ViewItem[]; running: number | null }): Calendar {
  const wall = <T extends ViewItem>(list: T[]) => list.map((e) => Object.assign(e, { kind: KIND[e.k] ?? 'diaper' }));
  const { origin } = v;
  const tl: Timeline = {
    today: TODAY_INDEX, origin, now: v.now, t0: TODAY_INDEX * 1440, running: v.running,
    dst: (d) => hasDstShift(new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() + d, 12).getTime()),
    events: wall(v.events), sleeps: wall(v.sleeps) as unknown as WallSleep[], feeds: wall(v.feeds),
  };
  return createCalendar(tl, CURRENT_RULES);
}

const memo = new Map<string, Set<string> | null>();

/** Les liens qui passent le test : couples « facteur|issue », ou null s'il y a trop peu de nuits pour tester. Mémorisé : le rendu repasse souvent. */
function viewLinks(rows: LinkRow[], factors: FactorKey[], outcomes: OutcomeKey[]): Set<string> | null {
  const key = JSON.stringify([rows, factors, outcomes]);
  const known = memo.get(key);
  if (known !== undefined) return known;
  const r = associations(rows, factors, outcomes);
  const kept = r.enough ? new Set(r.items.filter((x) => x.retained).map((x) => `${x.factor}|${x.outcome}`).filter((p) => !TAUTOLOGIES.has(p))) : null;
  if (memo.size > 16) memo.clear();
  memo.set(key, kept);
  return kept;
}

interface IntelView {
  origin: Date;
  now: number;
  events: ViewItem[];
  /** naissance ; absente ou null : l'âge reste inconnu */
  birthAt?: number | null;
}

let lastIntelKey = '';
let lastIntel: IntelligenceReport | null = null;

/** Canaille Intelligence pour l'écran : un seul moteur, mémorisé 5 minutes (le rejeu des modèles sur le passé est trop coûteux pour chaque rendu). */
function viewIntelligence(v: IntelView, opts: Options = {}): IntelligenceReport {
  const last = v.events[v.events.length - 1];
  const key = [v.events.length, last?.id, last?.a, last?.b, v.birthAt ?? '', opts.mode ?? '', opts.stamp ?? '', opts.live?.length ?? '', opts.live?.[opts.live.length - 1]?.wake ?? '', opts.history?.length ?? '', Math.floor(v.now / 5)].join('|');
  if (key === lastIntelKey && lastIntel) return lastIntel;
  const { origin } = v;
  const ms = (t: number) => new Date(origin.getFullYear(), origin.getMonth(), origin.getDate(), 0, t).getTime();
  const events = v.events.map((e): EngineEvent => ({ id: e.id, kind: KIND[e.k] ?? 'diaper', start: ms(e.a), ...(e.b !== undefined ? { end: ms(e.b) } : {}), ...(e.ml !== undefined ? { ml: e.ml } : {}) }));
  lastIntel = runIntelligence({ babyId: 'baby', birthAt: v.birthAt ?? null, events }, ms(v.now), { targets: ['nap_start', 'bedtime', 'nap_duration', 'feed'], ...opts });
  lastIntelKey = key;
  return lastIntel;
}

/** Une fenêtre en minutes de l'écran, seulement si le modèle servi n'est pas la référence que l'écran calcule déjà. `measured` : il a gagné sur le passé du bébé. */
function windowFor(r: IntelligenceReport, target: TargetId, now: number, origin: Date): { a: number; b: number; model: string; measured: boolean } | null {
  const p = r.predictions.find((x) => x.target === target), c = r.evaluation.find((x) => x.target === target);
  if (!p || p.status !== 'shown' || !p.window || !c || p.model === c.reference) return null;
  const ms = (t: number) => new Date(origin.getFullYear(), origin.getMonth(), origin.getDate(), 0, t).getTime();
  const a = now + Math.round((p.window.from - ms(now)) / 60_000), b = now + Math.round((p.window.to - ms(now)) / 60_000);
  // jamais une fenêtre plus étroite que celle du calcul habituel : au-delà des éveils déjà vus, un modèle est trop sûr de lui
  return { a, b: Math.max(b, a + 2 * threshold('windowMinHalf')), model: p.model, measured: p.confidence.level === 'measured' };
}

/** Prochain dodo. Jour seulement ; null quand il dort, sans prévision, ou quand la référence de l'écran reste le meilleur choix. */
function viewNextSleep(v: IntelView, opts?: Options) {
  const inDay = v.now % DAY_MIN;
  if (inDay < threshold('forecastDayStart') || inDay >= threshold('forecastDayEnd')) return null;
  return windowFor(viewIntelligence(v, opts), 'nap_start', v.now, v.origin);
}

/** Coucher du soir : remplace la plage habituelle seulement si un modèle l'a battue sur ses couchers passés (jamais sur une impression). */
function viewBedtime(v: IntelView, opts?: Options) {
  return windowFor(viewIntelligence(v, opts), 'bedtime', v.now, v.origin);
}

export const viewEngine = { calendar: viewCalendar, links: viewLinks, nextSleep: viewNextSleep, bedtime: viewBedtime, intelligence: viewIntelligence };
export type ViewEngine = typeof viewEngine;
