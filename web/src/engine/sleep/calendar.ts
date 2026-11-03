// Découpage en nuits et en journées, extrait à l'identique de `nightOf` et `dayOf`. Les défauts connus sont conservés jusqu'à la phase D.
import { threshold } from '../config';
import { LEGACY_RULES, type Rules } from '../rules';
import { med } from '../stats';
import { DAY_MIN, sleepIn, type Timeline, type WallEvent, type WallSleep } from './timeline';

export interface Night {
  d: number;
  st: 'ok' | 'partiel' | 'absent';
  nf: number;
  bed?: number;
  wake?: number;
  sl?: WallSleep[];
  bl?: number[];
  total?: number;
  longest?: number;
  wakings?: number;
  /** vrai si le journal commence juste avant ce coucher : le réveil est connu, pas le coucher */
  startUnobserved?: boolean;
}
export type FullNight = Required<Night>;

export interface Day {
  d: number;
  wake: number | null;
  bed: number | null;
  gap: boolean;
  fed: boolean;
  complete: boolean;
  naps: WallSleep[];
  napsTotal: number;
  sleep24: number;
  full24: boolean;
  feeds: WallEvent[];
  ml: number;
  sein: number;
  dayFeeds: WallEvent[];
}

export interface Calendar {
  nightOf(d: number): Night;
  dayOf(d: number): Day;
}

export const win = (a: number, b: number): number[] => {
  const r: number[] = [];
  for (let d = Math.max(0, a); d <= b; d++) r.push(d);
  return r;
};

export function createCalendar(tl: Timeline, rules: Rules = LEGACY_RULES): Calendar {
  const { sleeps: SL, feeds: FD, events, today } = tl;
  const NI: Record<number, Night> = {}, NI0: Record<number, Night> = {}, DI: Record<number, Day> = {};

  const nightIn = (d: number, lo: number, hi: number, C: Record<number, Night>, hab?: number): Night => {
    if (C[d]) return C[d];
    const ch: WallSleep[][] = [];
    for (const x of SL) {
      if (x.a < lo || x.a >= hi) continue;
      const c = ch[ch.length - 1];
      if (c && x.a - c[c.length - 1]!.b <= threshold('nightChainGap')) c.push(x);
      else ch.push([x]);
    }
    const lead = (c: WallSleep[]): WallSleep[] => {
      let i = 0;
      while (i < c.length - 1 && c[i]!.b - c[i]!.a < threshold('nightFirstBlock') && !(hab !== undefined && Math.abs(c[i]!.a - ((d - 1) * DAY_MIN + hab)) <= threshold('nightFirstHabTol'))) i++;
      return c.slice(i);
    };
    const latest = d * DAY_MIN + threshold('nightStartLatest');
    const sl = ch.map(lead).find((c) => c[0]!.a <= latest && c.reduce((t, x) => t + x.b - x.a, 0) >= threshold('nightMinTotal')) ?? ch[0] ?? [];
    let r: Night;
    if (!sl.length || sl[0]!.a > latest) r = { d, st: 'absent', nf: FD.filter((f) => f.a >= lo && f.a < d * DAY_MIN + threshold('nightFeedCutoff')).length };
    else {
      const bl = sl.map((x) => x.b - x.a), fw = sl[sl.length - 1]!.b;
      const total = sl.reduce((t, x) => t + sleepIn(x), 0), roseEarly = rules.earlyWakeNight && fw >= d * DAY_MIN + threshold('nightEarlyAfter') && total >= threshold('nightEarlyMinTotal') && events.some((e) => e.a > fw && e.a <= fw + threshold('nightEarlyEvidence'));
      const complete = fw >= d * DAY_MIN + threshold('nightCompleteAfter') || roseEarly;
      // le journal commence juste avant ce coucher : on ne sait pas quand il s'est couché, la nuit ne compte pas dans les habitudes
      const unobserved = rules.observedStart && complete && events.length > 0 && events[0]!.a > sl[0]!.a - threshold('nightObservedLead');
      r = { d, st: complete && !unobserved ? 'ok' : 'partiel', bed: sl[0]!.a, wake: fw, sl, bl, total, longest: Math.max(...bl), wakings: sl.length - 1, nf: FD.filter((f) => f.a > sl[0]!.a && f.a < fw).length, ...(unobserved ? { startUnobserved: true } : {}) };
    }
    C[d] = r;
    return r;
  };

  const defaultWin = (d: number): [number, number] => [(d - 1) * DAY_MIN + threshold('nightDefaultStart'), d * DAY_MIN + threshold('nightDefaultEnd')];

  const nightWin = (d: number): [number, number, number?] => {
    const ref: FullNight[] = [];
    for (let k = Math.max(1, d - threshold('habitWindowDays')); k < d; k++) {
      const [lo, hi] = defaultWin(k), n = nightIn(k, lo, hi, NI0);
      // une nuit dont le coucher n'est pas observé garde un réveil connu : elle sert au réveil habituel, pas au coucher habituel
      if (n.st === 'ok' || n.startUnobserved) ref.push(n as FullNight);
    }
    const seen = ref.filter((n) => !n.startUnobserved);
    const B = med(seen.map((n) => n.bed - (n.d - 1) * DAY_MIN));
    // trop peu de nuits pour adapter la fenêtre, assez pour un coucher habituel : la fenêtre reste celle par défaut
    if (ref.length < threshold('nightWinMinNights') || !seen.length) return seen.length >= threshold('nightHabMinNights') ? [...defaultWin(d), B] : defaultWin(d);
    const W = med(ref.map((n) => n.wake - n.d * DAY_MIN));
    return [(d - 1) * DAY_MIN + Math.min(threshold('nightBedLatest'), Math.max(threshold('nightBedEarliest'), B - threshold('nightBedLead'))), d * DAY_MIN + Math.min(threshold('nightWakeLatest'), Math.max(threshold('nightWakeEarliest'), W + threshold('nightWakeLag'))), B];
  };

  const nightOf = (d: number): Night => {
    if (NI[d]) return NI[d];
    const [lo, hi, hab] = nightWin(d);
    return nightIn(d, lo, hi, NI, hab);
  };

  const dayOf = (d: number): Day => {
    if (DI[d]) return DI[d];
    const n0 = nightOf(d), n1 = nightOf(d + 1), D = d * DAY_MIN;
    const wake = n0.st === 'ok' || n0.startUnobserved ? (n0.wake as number) : null;
    const bed = n1.st !== 'absent' ? (n1.bed as number) : null;
    const evd = events.filter((e) => e.a >= D && e.a < D + DAY_MIN);
    let gap = false;
    for (let i = 1; i < evd.length; i++) if (evd[i]!.a - evd[i - 1]!.a > threshold('gapMinutes') && evd[i - 1]!.a > D + threshold('gapAfter')) gap = true;
    const fed = d < today && evd.length > 0 && !gap;
    const complete = fed && wake !== null && bed !== null && !(rules.excludeDstDays && tl.dst(d));
    const naps = wake !== null ? SL.filter((x) => x.a > wake + threshold('napAfterWake') && x.a < (bed !== null ? bed : D + threshold('nightDefaultStart'))) : [];
    const feeds = FD.filter((f) => f.a >= D && f.a < D + DAY_MIN);
    const r: Day = {
      d, wake, bed, gap, fed, complete, naps,
      napsTotal: naps.reduce((t, x) => t + sleepIn(x), 0),
      sleep24: SL.reduce((t, x) => t + sleepIn(x, D, D + DAY_MIN), 0),
      full24: complete && n1.st !== 'absent',
      feeds, ml: feeds.reduce((t, f) => t + (f.ml ?? 0), 0), sein: feeds.filter((f) => f.kind === 'breast').length,
      dayFeeds: wake !== null && bed !== null ? FD.filter((f) => f.a >= wake && f.a < bed) : [],
    };
    DI[d] = r;
    return r;
  };

  return { nightOf, dayOf };
}
