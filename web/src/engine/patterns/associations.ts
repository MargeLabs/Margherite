// Associations journée puis nuit, en remplacement de `lkEval`. Un lien n'est jamais une cause.
// Répétition : permutation par blocs de jours voisins. Confondants : tendance (donc âge) et nombre de siestes retirés.
// Comparaisons multiples : toute la famille testée passe par Benjamini-Hochberg. Taille : minimum de nuits et écart pratique exigés.
import { threshold } from '../config';
import { rng } from '../evaluation/synthetic';
import type { FactorKey, LinkRow, OutcomeKey } from './links';

export const FACTOR_VALUE: Record<FactorKey, (x: LinkRow) => number> = { late: (x) => x.end, many: (x) => x.nap, ln: (x) => x.ln, awk: (x) => x.awk, awb: (x) => x.awb, ml: (x) => x.ml };

export interface Association {
  factor: FactorKey;
  outcome: OutcomeKey;
  n: number;
  rho: number;
  p: number;
  /** valeur corrigée pour toutes les comparaisons de la famille */
  q: number;
  /** écart de l'issue, en unités de l'issue, entre les nuits hautes et basses du facteur */
  effect: number;
  retained: boolean;
}

/** Résidus d'une régression linéaire : la part de `y` que les covariables n'expliquent pas. */
export function residualize(y: number[], covariates: number[][]): number[] {
  const X = y.map((_, i) => [1, ...covariates.map((c) => c[i] ?? 0)]);
  const k = X[0]?.length ?? 1;
  const A = Array.from({ length: k }, (_, r) => Array.from({ length: k + 1 }, (_, c) => (c < k ? X.reduce((s, row) => s + (row[r] ?? 0) * (row[c] ?? 0), 0) : X.reduce((s, row, i) => s + (row[r] ?? 0) * (y[i] ?? 0), 0))));
  for (let i = 0; i < k; i++) {
    let p = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(A[j]![i]!) > Math.abs(A[p]![i]!)) p = j;
    [A[i], A[p]] = [A[p]!, A[i]!];
    if (Math.abs(A[i]![i]!) < 1e-9) continue; // covariable constante : elle n'explique rien
    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      const f = A[j]![i]! / A[i]![i]!;
      for (let c = i; c <= k; c++) A[j]![c]! -= f * A[i]![c]!;
    }
  }
  const b = A.map((row, i) => (Math.abs(row[i]!) < 1e-9 ? 0 : row[k]! / row[i]!));
  return y.map((v, i) => v - X[i]!.reduce((s, x, c) => s + x * (b[c] ?? 0), 0));
}

function ranks(v: number[]): number[] {
  const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(v.length).fill(0);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
    for (let k = i; k <= j; k++) r[idx[k]![1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}

const pearson = (a: number[], b: number[]): number => {
  const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  a.forEach((x, i) => {
    ab += (x - ma) * ((b[i] ?? 0) - mb);
    aa += (x - ma) ** 2;
    bb += ((b[i] ?? 0) - mb) ** 2;
  });
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
};

/** Mélange par blocs : garde la ressemblance entre jours voisins, que le mélange ligne à ligne détruirait. */
function blockShuffle(v: number[], size: number, r: () => number): number[] {
  const blocks: number[][] = [];
  for (let i = 0; i < v.length; i += size) blocks.push(v.slice(i, i + size));
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
  }
  return blocks.flat();
}

export function benjaminiHochberg(ps: number[]): number[] {
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const q = new Array<number>(ps.length).fill(1);
  let min = 1;
  for (let i = order.length - 1; i >= 0; i--) {
    min = Math.min(min, (order[i]![0] * ps.length) / (i + 1));
    q[order[i]![1]] = min;
  }
  return q;
}

export interface Variable {
  key: string;
  values: Array<number | null>;
  /** écart pratique minimal, pour une issue */
  minEffect?: number;
}

export interface TestedLink {
  factor: string;
  outcome: string;
  n: number;
  rho: number;
  p: number;
  q: number;
  effect: number;
  retained: boolean;
}

/** Mélange des groupes entiers par blocs : deux mesures d'un même jour restent ensemble. */
function groupShuffle(index: number[][], size: number, r: () => number): number[] {
  const blocks: number[][][] = [];
  for (let i = 0; i < index.length; i += size) blocks.push(index.slice(i, i + size));
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j]!, blocks[i]!];
  }
  return blocks.flat(2);
}

/** Teste chaque facteur contre chaque issue ; toute la famille passe par la correction. Les valeurs nulles sortent du test concerné. */
export function testAssociations(o: { groups: number[]; factors: Variable[]; outcomes: Variable[]; covariates: number[][]; skipCovariate?: Record<string, number>; skipPairs?: string[]; seed?: number }): { items: TestedLink[]; enough: boolean } {
  const r = rng(o.seed ?? 1), draws = threshold('assocPermutations'), size = threshold('assocBlockDays');
  const out: Array<Omit<TestedLink, 'q' | 'retained'> & { min: number }> = [];
  let enough = false;
  for (const f of o.factors) {
    for (const y of o.outcomes) {
      if (o.skipPairs?.includes(`${f.key}|${y.key}`)) continue;
      const keep = o.groups.map((_, i) => i).filter((i) => f.values[i] !== null && f.values[i] !== undefined && y.values[i] !== null && y.values[i] !== undefined);
      const groups = [...new Set(keep.map((i) => o.groups[i]))];
      if (groups.length < threshold('assocMinNights')) continue;
      const fv = keep.map((i) => f.values[i] as number);
      if (new Set(fv).size < 2) continue;
      enough = true;
      const skip = o.skipCovariate?.[f.key] ?? -1;
      const cov = o.covariates.filter((_, c) => c !== skip).map((c) => keep.map((i) => c[i] ?? 0));
      const fx = residualize(fv, cov), oy = residualize(keep.map((i) => y.values[i] as number), cov);
      const rf = ranks(fx), ro = ranks(oy), rho = pearson(rf, ro);
      const index = groups.map((g) => keep.map((i, p) => (o.groups[i] === g ? p : -1)).filter((p) => p >= 0));
      let extreme = 0;
      for (let k = 0; k < draws; k++) {
        const perm = groupShuffle(index, size, r);
        if (Math.abs(pearson(rf, perm.map((p) => ro[p] ?? 0))) >= Math.abs(rho)) extreme++;
      }
      const cut = fx.slice().sort((a, b) => a - b)[Math.floor(fx.length / 2)] ?? 0;
      const hi = oy.filter((_, i) => (fx[i] ?? 0) > cut), lo = oy.filter((_, i) => (fx[i] ?? 0) <= cut);
      const avg = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
      out.push({ factor: f.key, outcome: y.key, n: fx.length, rho, p: (extreme + 1) / (draws + 1), effect: avg(hi) - avg(lo), min: y.minEffect ?? 0 });
    }
  }
  const qs = benjaminiHochberg(out.map((x) => x.p));
  return { enough, items: out.map(({ min, ...x }, i) => ({ ...x, q: qs[i] ?? 1, retained: (qs[i] ?? 1) <= threshold('assocFdr') && Math.abs(x.effect) >= min })) };
}

export function associations(rows: LinkRow[], factors: FactorKey[], outcomes: OutcomeKey[], seed = 1): { items: Association[]; enough: boolean } {
  const n = rows.length;
  if (n < threshold('assocMinNights')) return { items: [], enough: false };
  const days = rows.map((x, i) => x.d ?? i), r = rng(seed), draws = threshold('assocPermutations'), size = threshold('assocBlockDays');
  const naps = rows.map((x) => x.nap);
  const out: Array<Omit<Association, 'q' | 'retained'>> = [];
  for (const f of factors) {
    for (const o of outcomes) {
      const cov = f === 'many' ? [days] : [days, naps];
      const fx = residualize(rows.map(FACTOR_VALUE[f]), cov), oy = residualize(rows.map((x) => x[o]), cov);
      const rf = ranks(fx), ro = ranks(oy), rho = pearson(rf, ro);
      let extreme = 0;
      for (let i = 0; i < draws; i++) if (Math.abs(pearson(rf, blockShuffle(ro, size, r))) >= Math.abs(rho)) extreme++;
      const cut = fx.slice().sort((a, b) => a - b)[Math.floor(n / 2)] ?? 0;
      const hi = oy.filter((_, i) => (fx[i] ?? 0) > cut), lo = oy.filter((_, i) => (fx[i] ?? 0) <= cut);
      const avg = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0);
      out.push({ factor: f, outcome: o, n, rho, p: (extreme + 1) / (draws + 1), effect: avg(hi) - avg(lo) });
    }
  }
  const qs = benjaminiHochberg(out.map((x) => x.p));
  const items = out.map((x, i) => {
    const q = qs[i] ?? 1, min = x.outcome === 'wk' ? 1 : threshold('linkMinGap');
    return { ...x, q, retained: q <= threshold('assocFdr') && Math.abs(x.effect) >= min };
  });
  return { items, enough: true };
}
