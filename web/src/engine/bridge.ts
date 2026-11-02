// Le pont entre la logique de l'écran et le moteur : l'écran garde ses objets et ses textes, le moteur décide des nuits, des journées et des liens.
import { associations } from './patterns/associations';
import type { FactorKey, LinkRow, OutcomeKey } from './patterns/links';
import { hasDstShift } from './quality';
import { CURRENT_RULES } from './rules';
import { createCalendar, type Calendar } from './sleep/calendar';
import { TODAY_INDEX, type Timeline, type WallEvent, type WallSleep } from './sleep/timeline';

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

export const viewEngine = { calendar: viewCalendar, links: viewLinks };
export type ViewEngine = typeof viewEngine;
