// Types de journées : des groupes lisibles, décrits par leurs moyennes. Jamais une bonne et une mauvaise journée.
import { threshold } from '../config';
import { win, type Calendar } from '../sleep/calendar';
import type { Timeline } from '../sleep/timeline';
import { mean } from '../stats';

export interface DayType {
  days: number[];
  naps: number;
  napMinutes: number;
  feeds: number;
}

/** k-moyennes à deux groupes, départ déterministe. Rend null si les groupes ne se distinguent pas nettement. */
export function dayTypes(tl: Timeline, cal: Calendar): DayType[] | null {
  const days = win(0, tl.today - 1).map(cal.dayOf).filter((x) => x.complete);
  if (days.length < threshold('dayTypesMinDays')) return null;
  const raw = days.map((x) => [x.naps.length, x.napsTotal, x.feeds.length]);
  const m = [0, 1, 2].map((j) => mean(raw.map((r) => r[j] ?? 0)) as number);
  const sd = [0, 1, 2].map((j) => Math.sqrt((mean(raw.map((r) => ((r[j] ?? 0) - (m[j] ?? 0)) ** 2)) as number)) || 1);
  const z = raw.map((r) => r.map((v, j) => (v - (m[j] ?? 0)) / (sd[j] ?? 1)));
  const dist = (a: number[], b: number[]) => a.reduce((s, v, j) => s + (v - (b[j] ?? 0)) ** 2, 0);
  const order = z.map((_, i) => i).sort((a, b) => (z[a]?.[1] ?? 0) - (z[b]?.[1] ?? 0));
  let c = [z[order[0] ?? 0] ?? [], z[order[order.length - 1] ?? 0] ?? []], label = z.map(() => 0);
  for (let it = 0; it < 20; it++) {
    label = z.map((p) => (dist(p, c[0] ?? []) <= dist(p, c[1] ?? []) ? 0 : 1));
    c = [0, 1].map((k) => [0, 1, 2].map((j) => mean(z.filter((_, i) => label[i] === k).map((p) => p[j] ?? 0)) ?? 0));
  }
  const sizes = [0, 1].map((k) => label.filter((l) => l === k).length);
  if (Math.min(...sizes) < threshold('dayTypesMinGroup') || dist(c[0] ?? [], c[1] ?? []) < threshold('dayTypesMinDistance')) return null;
  return [0, 1].map((k) => {
    const g = days.filter((_, i) => label[i] === k);
    return { days: g.map((x) => x.d), naps: mean(g.map((x) => x.naps.length)) as number, napMinutes: mean(g.map((x) => x.napsTotal)) as number, feeds: mean(g.map((x) => x.feeds.length)) as number };
  });
}
