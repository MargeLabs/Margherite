// Fenêtres de dodo à venir, extraites à l'identique de `wins`, et comparaison d'un dodo à ses habitudes (`habitOf`).
// Limite connue : la plage habituelle du jour, indifférente au dernier réveil.
import { threshold } from '../config';
import type { TypicalDay } from '../habits/typical';
import type { Calendar } from '../sleep/calendar';
import { DAY_MIN, isNapStart, type Timeline } from '../sleep/timeline';
import { LEGACY_RULES, type Rules } from '../rules';
import { r5 } from '../stats';

export interface SleepWindow {
  a: number;
  b: number;
  bed: boolean;
  /** sieste qui ne revient pas tous les jours */
  few: boolean;
}

export function sleepWindows(tl: Timeline, cal: Calendar, typ: TypicalDay): SleepWindow[] {
  if (!typ.ok) return [];
  const half = threshold('windowMinHalf'), done = cal.dayOf(tl.today).naps.length;
  const cands = typ.naps.filter((z) => z.k >= done).map((z) => ({ lo: Math.min(z.lo, z.a - half), hi: Math.max(z.hi, z.a + half), few: z.n < typ.n, bed: false }));
  cands.push({ lo: Math.min(typ.bdR[0], typ.bed - half), hi: Math.max(typ.bdR[1], typ.bed + half), few: false, bed: true });
  return cands.filter((z) => tl.t0 + z.hi >= tl.now).map((z) => ({ a: tl.t0 + r5(z.lo), b: tl.t0 + r5(z.hi), bed: z.bed, few: z.few }));
}

export type HabitKind = 'nodata' | 'extra' | 'ok' | 'diff' | 'night';
export interface HabitComparison {
  kind: HabitKind;
  nap: boolean;
  rank: number | null;
  rows: Array<{ field: 'hour' | 'duration' | 'awake'; ok: boolean }>;
}

export function compareToHabit(tl: Timeline, cal: Calendar, typ: TypicalDay, a: number, b: number | null, evId: string | null, rules: Rules = LEGACY_RULES): HabitComparison {
  const m = a % DAY_MIN, d0 = Math.floor(a / DAY_MIN), day = cal.dayOf(d0);
  const nap = rules.relativeDay && day.wake !== null && day.bed !== null ? a > day.wake && a < day.bed : isNapStart(a);
  // un dodo de nuit qui reprend après un réveil n'est pas le coucher : on ne le juge pas sur l'heure du coucher
  if (!nap) {
    const first = cal.nightOf(m >= threshold('napDayEnd') ? d0 + 1 : d0).sl?.[0];
    if (first && first.id !== evId && first.a < a) return { kind: 'night', nap, rank: null, rows: [] };
  }
  if (!typ.ok) return { kind: 'nodata', nap, rank: null, rows: [] };
  if (nap) {
    const before = tl.sleeps.filter((z) => z.id !== evId && Math.floor(z.a / DAY_MIN) === d0 && z.a < a && isNapStart(z.a));
    const k = before.length, tz = typ.naps.find((z) => z.k === k);
    if (!tz) return { kind: 'extra', nap, rank: k, rows: [] };
    const tol = threshold('habitHourTolerance'), same = threshold('habitSameDuration');
    const rows: HabitComparison['rows'] = [{ field: 'hour', ok: m >= tz.lo - tol && m <= tz.hi + tol }];
    if (b) rows.push({ field: 'duration', ok: Math.abs(b - a - r5(tz.du)) < same });
    const w0 = before.length ? before[before.length - 1]!.b : cal.dayOf(d0).wake;
    if (w0 !== null && w0 !== undefined && tz.aw) rows.push({ field: 'awake', ok: Math.abs(a - w0 - r5(tz.aw)) < same });
    return { kind: rows.every((x) => x.ok) ? 'ok' : 'diff', nap, rank: k, rows };
  }
  const rel = m >= threshold('napDayEnd') ? m : DAY_MIN + m, tol = threshold('habitBedTolerance');
  const ok = rel >= typ.bdR[0] - tol && rel <= typ.bdR[1] + tol;
  return { kind: ok ? 'ok' : 'diff', nap, rank: null, rows: [{ field: 'hour', ok }] };
}
