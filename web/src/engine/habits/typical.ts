// Journée type et nuit habituelle, extraites à l'identique de `typ` et `usual`. Des nombres, pas de texte.
import { threshold } from '../config';
import { win, type Calendar, type Day, type FullNight } from '../sleep/calendar';
import { DAY_MIN, type Timeline } from '../sleep/timeline';
import { lohi, med, r5 } from '../stats';

export interface TypicalNap {
  k: number;
  a: number;
  du: number;
  n: number;
  lo: number;
  hi: number;
  aw: number;
}

export type TypicalDay =
  | { ok: false; n: number }
  | { ok: true; n: number; days: Day[]; naps: TypicalNap[]; wake: number; bed: number; wkR: [number, number]; bdR: [number, number]; bandSegs: Array<{ a: number; b: number }>; meals: number[]; napCounts: number[]; feedsPerDay: number; feedGap: number | null; daySleep: number };

export function typicalDay(tl: Timeline, cal: Calendar): TypicalDay {
  const { today, sleeps: SL, feeds: FD } = tl;
  const days = win(today - threshold('habitWindowDays'), today - 1).map(cal.dayOf).filter((x) => x.complete);
  if (days.length < threshold('habitDays')) return { ok: false, n: days.length };
  const wk = days.map((x) => (x.wake as number) - x.d * DAY_MIN), bd = days.map((x) => (x.bed as number) - x.d * DAY_MIN);
  const nc = days.map((x) => x.naps.length);
  const naps: TypicalNap[] = [];
  for (let k = 0; k < Math.max(...nc); k++) {
    const ks = days.filter((x) => x.naps.length > k).map((x) => x.naps[k]!);
    if (ks.length < threshold('habitRankDays')) continue;
    const st = ks.map((z) => z.a % DAY_MIN);
    const aws = days.filter((x) => x.naps.length > k).map((x) => x.naps[k]!.a - (k ? x.naps[k - 1]!.b : (x.wake as number)));
    naps.push({ k, a: med(st), du: med(ks.map((z) => z.b - z.a)), n: ks.length, lo: lohi(st)[0], hi: lohi(st)[1], aw: med(aws) });
  }
  const slots: boolean[] = [];
  for (let q = 0; q < 96; q++) {
    let c = 0;
    days.forEach((x) => {
      const t = x.d * DAY_MIN + q * 15 + 7;
      if (SL.some((z) => z.a <= t && z.b > t)) c++;
    });
    slots.push(c / days.length >= threshold('dayBandShare'));
  }
  const bandSegs: Array<{ a: number; b: number }> = [];
  for (let q = 0; q < 96; q++) {
    if (slots[q] && (q === 0 || !slots[q - 1] || q === 48)) {
      let e = q;
      while (e < 96 && slots[e] && !(e > q && e === 48)) e++;
      bandSegs.push({ a: q * 15, b: e * 15 });
    }
  }
  // repas qui reviennent : heures regroupées, gardées si au moins un jour sur deux
  const F: Array<{ t: number; d: number }> = [];
  days.forEach((x) => FD.forEach((f) => {
    if (f.a >= x.d * DAY_MIN && f.a < x.d * DAY_MIN + DAY_MIN) F.push({ t: f.a - x.d * DAY_MIN, d: x.d });
  }));
  F.sort((p1, p2) => p1.t - p2.t);
  const meals: number[] = [];
  let G: typeof F = [];
  const flush = () => {
    if (G.length && new Set(G.map((g) => g.d)).size * 2 >= days.length) meals.push(r5(med(G.map((g) => g.t))));
    G = [];
  };
  F.forEach((f) => {
    if (G.length && f.t - G[G.length - 1]!.t > threshold('mealGroupGap')) flush();
    G.push(f);
  });
  flush();
  const gaps: number[] = [];
  days.forEach((x) => x.dayFeeds.forEach((f, i) => {
    if (i) gaps.push(f.a - x.dayFeeds[i - 1]!.a);
  }));
  return { ok: true, n: days.length, days, naps, wake: med(wk), bed: med(bd), wkR: lohi(wk), bdR: lohi(bd), bandSegs, meals, napCounts: nc, feedsPerDay: Math.round(med(days.map((x) => x.feeds.length))), feedGap: gaps.length ? med(gaps) : null, daySleep: med(days.map((x) => x.napsTotal)) };
}

export type UsualNight =
  | { ok: false; n: number }
  | { ok: true; n: number; bed: number; wake: number; wk: number; wkMin: number; wkMax: number; longest: number; total: number; blocks: Array<[number, number]>; fbR: [number, number]; b0: number; bedR: [number, number]; wakeR: [number, number]; mealWake: number };

export function usualNight(tl: Timeline, cal: Calendar, d: number): UsualNight {
  const ns = win(Math.max(1, d - threshold('habitWindowDays')), d - 1).map(cal.nightOf).filter((x): x is FullNight => x.st === 'ok');
  if (ns.length < threshold('usualNights')) return { ok: false, n: ns.length };
  const bedAt = (x: FullNight) => x.bed - (x.d - 1) * DAY_MIN, wakeAt = (x: FullNight) => x.wake - x.d * DAY_MIN;
  const bed = med(ns.map(bedAt)), wake = med(ns.map(wakeAt));
  const wk = Math.round(med(ns.map((x) => x.wakings)));
  const b0 = med(ns.map((x) => x.bl[0]!));
  const oth: number[] = [], gp: number[] = [];
  ns.forEach((x) => {
    x.bl.slice(1).forEach((v) => oth.push(v));
    x.sl.forEach((z, i) => {
      if (i) gp.push(z.a - x.sl[i - 1]!.b);
    });
  });
  const bo = (oth.length ? med(oth) : 0) || 120, g = (gp.length ? med(gp) : 0) || 25;
  const blocks: Array<[number, number]> = [];
  let t = bed;
  for (let i = 0; i <= wk; i++) {
    const e = t + (i === 0 ? b0 : bo);
    if (i === wk || e > DAY_MIN + wake - 40) {
      blocks.push([t, Math.max(DAY_MIN + wake, t + 30)]);
      break;
    }
    blocks.push([t, e]);
    t = e + g;
  }
  let wf = 0, wn = 0;
  ns.forEach((x) => x.sl.forEach((z, i) => {
    if (!i) return;
    wn++;
    if (tl.feeds.some((f) => f.a >= x.sl[i - 1]!.b - 10 && f.a <= z.a + 10)) wf++;
  }));
  return { ok: true, n: ns.length, bed, wake, wk, wkMin: Math.min(...ns.map((x) => x.wakings)), wkMax: Math.max(...ns.map((x) => x.wakings)), longest: med(ns.map((x) => x.longest)), total: med(ns.map((x) => x.total)), blocks, fbR: lohi(ns.map((x) => x.bl[0]!)), b0, bedR: lohi(ns.map(bedAt)), wakeR: lohi(ns.map(wakeAt)), mealWake: wn ? wf / wn : 0 };
}
