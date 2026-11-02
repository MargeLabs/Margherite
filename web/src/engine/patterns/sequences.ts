// Enchaînements récurrents de la journée : motifs plus fréquents que le hasard, à ordre mélangé. Une habitude constatée, pas une consigne.
import { threshold } from '../config';
import { rng } from '../evaluation/synthetic';
import { win, type Calendar } from '../sleep/calendar';
import { DAY_MIN, type Timeline } from '../sleep/timeline';

export type Token = 'W' | 'S' | 'F';

/** Une journée en jetons : W réveil, S sieste, F repas. Les repas qui se suivent ne comptent qu'une fois. */
export function encodeDay(tl: Timeline, wake: number, bed: number, naps: Array<{ a: number }>): Token[] {
  const items: Array<[number, Token]> = [[wake, 'W'], ...naps.map((n): [number, Token] => [n.a, 'S']), ...tl.feeds.filter((f) => f.a >= wake && f.a < bed).map((f): [number, Token] => [f.a, 'F'])];
  items.sort((x, y) => x[0] - y[0]);
  return items.map((x) => x[1]).filter((t, i, a) => !(t === 'F' && a[i - 1] === 'F'));
}

const count = (days: Token[][], n: number): Map<string, number> => {
  const c = new Map<string, number>();
  days.forEach((s) => {
    const seen = new Set<string>();
    for (let i = 0; i + n <= s.length; i++) seen.add(s.slice(i, i + n).join(''));
    seen.forEach((k) => c.set(k, (c.get(k) ?? 0) + 1));
  });
  return c;
};

export interface Motif {
  motif: string;
  /** part des jours où il apparaît */
  support: number;
  /** même part sur les journées mélangées */
  expected: number;
  days: number;
}

export function frequentMotifs(days: Token[][], seed = 1): Motif[] {
  if (days.length < threshold('motifMinDays')) return [];
  const r = rng(seed), draws = threshold('motifShuffles'), n = threshold('motifLength');
  const shuffle = (s: Token[]) => {
    const a = s.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j] as Token, a[i] as Token];
    }
    return a;
  };
  const real = count(days, n), sum = new Map<string, number>();
  for (let i = 0; i < draws; i++) count(days.map(shuffle), n).forEach((v, k) => sum.set(k, (sum.get(k) ?? 0) + v));
  const out: Motif[] = [];
  real.forEach((v, k) => {
    const support = v / days.length, expected = (sum.get(k) ?? 0) / draws / days.length;
    if (support >= threshold('motifMinSupport') && support - expected >= threshold('motifMinLift')) out.push({ motif: k, support, expected, days: v });
  });
  return out.sort((a, b) => b.support - b.expected - (a.support - a.expected));
}

/** Probabilité de passer d'un jeton au suivant : décrit, ne prédit pas seule. */
export function transitions(days: Token[][]): Record<string, Record<string, number>> {
  const c: Record<string, Record<string, number>> = {};
  days.forEach((s) => s.slice(1).forEach((t, i) => {
    const from = s[i] as Token;
    (c[from] ??= {})[t] = (c[from]?.[t] ?? 0) + 1;
  }));
  return Object.fromEntries(Object.entries(c).map(([k, v]) => {
    const total = Object.values(v).reduce((a, b) => a + b, 0);
    return [k, Object.fromEntries(Object.entries(v).map(([t, n]) => [t, n / total]))];
  }));
}

export function daySequences(tl: Timeline, cal: Calendar): Token[][] {
  return win(0, tl.today - 1).map(cal.dayOf).filter((x) => x.complete).map((x) => encodeDay(tl, x.wake as number, x.bed ?? x.d * DAY_MIN + DAY_MIN, x.naps));
}
