// Comparaison de deux périodes, extraite à l'identique de `stat`. Seuils `eq` fixés à la main, à évaluer.
import { threshold } from '../config';
import { win, type Calendar, type Day, type FullNight } from '../sleep/calendar';
import { DAY_MIN, type Timeline } from '../sleep/timeline';
import { mean, med } from '../stats';

type Src = 'n' | 'd24' | 'dc' | 'df';
interface Metric {
  src: Src;
  eq: number;
  useMedian?: boolean;
  night?: (x: FullNight) => number;
  day?: (x: Day) => number;
}

export const METRICS = {
  bloc: { src: 'n', eq: 15, night: (x) => x.longest },
  total: { src: 'd24', eq: 20, day: (x) => x.sleep24 },
  reveils: { src: 'n', eq: 0.4, night: (x) => x.wakings },
  siestes: { src: 'dc', eq: 0.4, day: (x) => x.naps.length },
  coucher: { src: 'n', eq: 15, useMedian: true, night: (x) => x.bed - (x.d - 1) * DAY_MIN },
  reveil: { src: 'n', eq: 15, useMedian: true, night: (x) => x.wake - x.d * DAY_MIN },
  repas: { src: 'df', eq: 0.6, day: (x) => x.feeds.length },
  lait: { src: 'df', eq: 40, day: (x) => x.ml },
  sein: { src: 'df', eq: 8, day: (x) => (x.feeds.length ? (100 * x.sein) / x.feeds.length : 0) },
} as const satisfies Record<string, Metric>;
export type MetricKey = keyof typeof METRICS;

export interface PeriodStat {
  key: MetricKey;
  vc: number | null;
  vp: number | null;
  n: number;
  ok: boolean;
  okP: boolean;
  dir: -1 | 0 | 1;
}

export function periodStat(tl: Timeline, cal: Calendar, key: MetricKey, p: number): PeriodStat {
  const m: Metric = METRICS[key];
  const pick = (a: number, b: number): number[] => {
    if (b < a) return [];
    if (m.src === 'n') return win(Math.max(1, a + 1), b + 1).map(cal.nightOf).filter((x): x is FullNight => x.st === 'ok').map(m.night as (x: FullNight) => number);
    const ds = win(a, b).map(cal.dayOf).filter((x) => (m.src === 'd24' ? x.full24 : m.src === 'dc' ? x.complete : x.fed));
    return ds.map(m.day as (x: Day) => number);
  };
  const last = tl.today - 1;
  const cur = pick(tl.today - p, last), prev = pick(tl.today - 2 * p, last - p);
  const min = threshold('statMinPoints'), okC = cur.length >= min, okP = prev.length >= min;
  const agg = (v: number[]) => (m.useMedian ? med(v) : (mean(v) as number));
  const vc = okC ? agg(cur) : null, vp = okP ? agg(prev) : null;
  const df = vc !== null && vp !== null ? vc - vp : 0;
  return { key, vc, vp, n: cur.length, ok: okC, okP, dir: vc !== null && vp !== null && Math.abs(df) >= m.eq ? (df > 0 ? 1 : -1) : 0 };
}
