// Le pont entre la logique de l'écran et le moteur : l'écran garde ses objets et ses textes, le moteur décide des nuits, des journées et des liens.
import { associations } from './patterns/associations';
import { threshold } from './config';
import type { FactorKey, LinkRow, OutcomeKey } from './patterns/links';
import { survivalModel } from './predictions/models';
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

let lastSleepKey = '';
let lastSleep: { a: number; b: number } | null = null;

/** Prochain dodo selon le modèle de survie, en test. Jour seulement ; mémorisé 5 minutes : l'ajustement est trop coûteux pour chaque rendu. */
function viewNextSleep(v: { origin: Date; now: number; events: ViewItem[] }): { a: number; b: number } | null {
  const inDay = v.now % DAY_MIN;
  if (inDay < threshold('forecastDayStart') || inDay >= threshold('forecastDayEnd')) return null;
  const last = v.events[v.events.length - 1];
  const key = [v.events.length, last?.id, last?.a, last?.b, Math.floor(v.now / 5)].join('|');
  if (key === lastSleepKey) return lastSleep;
  const { origin } = v;
  const ms = (t: number) => new Date(origin.getFullYear(), origin.getMonth(), origin.getDate(), 0, t).getTime();
  const events = v.events.map((e): EngineEvent => ({ id: e.id, kind: KIND[e.k] ?? 'diaper', start: ms(e.a), ...(e.b !== undefined ? { end: ms(e.b) } : {}) }));
  const w = survivalModel({ birthAt: null, events }, ms(v.now));
  lastSleepKey = key;
  const a = w ? v.now + Math.round((w.from - ms(v.now)) / 60_000) : 0, b = w ? v.now + Math.round((w.to - ms(v.now)) / 60_000) : 0;
  // jamais une fenêtre plus étroite que celle du calcul habituel : au-delà des éveils déjà vus, le modèle est trop sûr de lui
  lastSleep = w ? { a, b: Math.max(b, a + 2 * threshold('windowMinHalf')) } : null;
  return lastSleep;
}

export const viewEngine = { calendar: viewCalendar, links: viewLinks, nextSleep: viewNextSleep };
export type ViewEngine = typeof viewEngine;
