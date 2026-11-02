// Liens journée puis nuit, extraits à l'identique de `lkR` et `lkEval`.
// Défaut connu : plusieurs comparaisons, aucune correction ; à remplacer en phase D, pas à réutiliser ailleurs.
import { threshold } from '../config';
import type { Calendar, FullNight } from '../sleep/calendar';
import { DAY_MIN, type Timeline } from '../sleep/timeline';
import { mean, med, r5 } from '../stats';

export interface LinkRow {
  /** jour de la nuit : sert à retirer la tendance, ignoré par l'ancien test */
  d?: number;
  end: number;
  many: boolean;
  bed: number;
  wk: number;
  lg: number;
  ln: number;
  awk: number;
  awb: number;
  ml: number;
  nap: number;
  late?: boolean;
}

export type OutcomeKey = 'bed' | 'lg' | 'wk';
export const OUTCOMES: Record<OutcomeKey, { min: number }> = { bed: { min: threshold('linkMinGap') }, lg: { min: threshold('linkMinGap') }, wk: { min: 1 } };

export function linkRows(tl: Timeline, cal: Calendar): LinkRow[] {
  const rows: LinkRow[] = [];
  for (let d = tl.today - threshold('linkHistoryDays') + 1; d <= tl.today; d++) {
    const n = cal.nightOf(d), y = cal.dayOf(d - 1);
    if (n.st !== 'ok' || y.wake === null || !y.naps.length || y.gap) continue;
    const f = n as FullNight, ln = y.naps[y.naps.length - 1]!, aw: number[] = [];
    let t0 = y.wake;
    y.naps.forEach((z) => {
      aw.push(z.a - t0);
      t0 = z.b;
    });
    rows.push({ d, end: ln.b % DAY_MIN, many: y.naps.length >= threshold('linkManyNaps'), bed: f.bed - (d - 1) * DAY_MIN, wk: f.wakings, lg: f.longest, ln: ln.b - ln.a, awk: mean(aw) as number, awb: f.bed - ln.b, ml: y.ml, nap: y.naps.length });
  }
  return rows;
}

export type FactorKey = 'late' | 'many' | 'ln' | 'awk' | 'awb' | 'ml';
export type Factors = Record<FactorKey, (x: LinkRow) => boolean>;

/** Prépare les facteurs et marque les soirs tardifs. Les coupures viennent des données elles-mêmes (médianes). */
export function linkFactors(rows: LinkRow[]): Factors {
  const lkT = rows.length ? Math.round(med(rows.map((x) => x.end)) / 15) * 15 : 0;
  rows.forEach((x) => {
    x.late = x.end > lkT;
  });
  const withMl = rows.filter((x) => x.ml > 0);
  const v = { ln: rows.length ? r5(med(rows.map((x) => x.ln))) : 0, awk: rows.length ? r5(med(rows.map((x) => x.awk))) : 0, awb: rows.length ? r5(med(rows.map((x) => x.awb))) : 0, ml: withMl.length ? Math.round(med(withMl.map((x) => x.ml)) / 10) * 10 : 0 };
  return { late: (x) => !!x.late, many: (x) => x.many, ln: (x) => x.ln > v.ln, awk: (x) => x.awk > v.awk, awb: (x) => x.awb > v.awb, ml: (x) => x.ml > v.ml };
}

export interface LinkBest {
  factor: FactorKey;
  outcome: OutcomeKey;
  sc: number;
  k: number;
  nA: number;
  nB: number;
  ma: number;
  mb: number;
  solid: boolean;
}

export function evaluateLinks(fx: Factors, factors: FactorKey[], outcomes: OutcomeKey[], rows: LinkRow[]): { best: LinkBest | null; enough: boolean; n: number } {
  let best: LinkBest | null = null, enough = false;
  for (const fk of factors) {
    const f = fx[fk];
    const A = rows.filter(f), B = rows.filter((x) => !f(x));
    if (A.length < threshold('linkGroupMin') || B.length < threshold('linkGroupMin')) continue;
    enough = true;
    for (const ok of outcomes) {
      const ma = med(A.map((x) => x[ok])), mb = med(B.map((x) => x[ok])), df = ma - mb, min = OUTCOMES[ok].min;
      if (Math.abs(df) < min) continue;
      const k = A.filter((x) => (df > 0 ? x[ok] > mb : x[ok] < mb)).length;
      if (k < threshold('linkSameWay') * A.length) continue;
      const sc = Math.abs(df) / min;
      if (!best || sc > best.sc) best = { factor: fk, outcome: ok, sc, k, nA: A.length, nB: B.length, ma, mb, solid: A.length >= threshold('linkSolidGroup') };
    }
  }
  return { best, enough, n: rows.length };
}
