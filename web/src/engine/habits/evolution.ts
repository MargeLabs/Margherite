// Comment ses habitudes évoluent : une série par indicateur, sur les seuls jours ou nuits notés en entier, classée stable, tendance, ponctuel, rupture ou insuffisant.
import { classifySeries } from '../rhythm/change';
import { win, type Calendar, type FullNight } from '../sleep/calendar';
import { DAY_MIN, type Timeline } from '../sleep/timeline';
import type { FindingStatus } from '../types';

export interface Evolution {
  key: string;
  status: FindingStatus;
  points: number;
  last: number | null;
}

export function evolutions(tl: Timeline, cal: Calendar): Evolution[] {
  const days = win(0, tl.today - 1).map(cal.dayOf).filter((x) => x.complete);
  const nights = win(1, tl.today).map(cal.nightOf).filter((x): x is FullNight => x.st === 'ok');
  const series: Record<string, number[]> = {
    naps: days.map((x) => x.naps.length),
    napMinutes: days.map((x) => x.napsTotal),
    feeds: days.map((x) => x.feeds.length),
    bedtime: nights.map((x) => x.bed - (x.d - 1) * DAY_MIN),
    wakeTime: nights.map((x) => x.wake - x.d * DAY_MIN),
    longestSleep: nights.map((x) => x.longest),
    nightWakings: nights.map((x) => x.wakings),
  };
  return Object.entries(series).map(([key, v]) => ({ key, status: classifySeries(v), points: v.length, last: v[v.length - 1] ?? null }));
}
