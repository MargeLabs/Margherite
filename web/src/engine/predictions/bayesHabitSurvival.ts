// Prochain dodo : survie à temps discret bayésienne, avec les habitudes du bébé comme variables explicatives (pas comme horaires imposés).
//
// Risque par pas de 15 min, régression logistique estimée au MAP (a priori gaussien) par Newton ; l'incertitude des coefficients vient de l'approximation
// de Laplace (covariance = inverse du hessien) et la prévision est le mélange de survies tirées de cette loi a posteriori. La fenêtre est lue sur la
// distribution prédictive (quantiles 10 % et 90 %), jamais sur un point.
// Habitudes : la sieste à venir n'est pas affectée à un créneau. Chaque créneau habituel encore libre reçoit un poids (ordre d'arrivée × proximité de l'heure),
// et les variables sont les écarts moyens pondérés : « éveil écoulé moins l'éveil habituel de ce créneau », « heure moins l'heure habituelle du créneau ».
// Hiérarchie : l'éveil habituel de chaque créneau est rétréci vers l'éveil moyen de tous les créneaux (poids selon le nombre d'observations),
// donc un créneau vu deux fois ne dicte rien. Les observations atypiques sont sous-pondérées, les jours récents comptent plus.
// Le journal n'est lu que jusqu'à `now` : habitudes, rétrécissement et coefficients sont recalculés à chaque appel.
import { threshold } from '../config';
import { rng } from '../evaluation/synthetic';
import type { Day } from '../sleep/calendar';
import { habitsModel } from '../index';
import { DAY_MIN, sleepIn } from '../sleep/timeline';
import { med } from '../stats';
import type { Forecaster, Window } from './baselines';
import { napSlot } from './sleepWindows';

export const BAYES_MODEL = 'survival_bayesian_habit';

export type BayesReason = 'ok' | 'asleep' | 'outside_day' | 'insufficient_data' | 'not_trainable' | 'invalid_prediction' | 'window_too_wide' | 'window_passed';
export interface BayesOutcome {
  reason: BayesReason;
  window: Window | null;
}

const clip = (x: number, m: number): number => Math.max(-m, Math.min(m, x));
const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
const HORIZON = 40;

interface Slot {
  k: number;
  a: number;
  sd: number;
  du: number;
  /** éveil habituel avant ce créneau, rétréci vers la moyenne de tous les créneaux */
  aw: number;
  /** part des jours où le créneau existe */
  rel: number;
}

interface Ctx {
  slots: Slot[];
  taken: Set<number>;
  nDone: number;
  napsRef: number;
  wakeDev: number;
  napDev: number;
  first: number;
  lastBlock: number;
}

const NAMES = ['bias', 'awake', 'awake2', 'sin24', 'cos24', 'sin12', 'cos12', 'habitAwake', 'habitClock', 'habitRegular', 'napDev', 'wakeDev', 'napsDone', 'sleep24', 'firstOfDay', 'lastBlock'] as const;

/** Variables d'un pas. Les trois variables « habitude » sont des moyennes pondérées sur les créneaux encore libres. */
function features(c: Ctx, awake: number, clock: number, s24: number): number[] {
  const open = c.slots.filter((s) => !c.taken.has(s.k));
  let fw = 0, fd = 0, fr = 0;
  if (open.length) {
    const rho = threshold('bayesSlotDecay');
    const w = open.map((s, r) => rho ** r * (Math.exp(-0.5 * ((clock - s.a) / s.sd) ** 2) + 0.02)), tot = w.reduce((x, y) => x + y, 0);
    open.forEach((s, r) => {
      const p = (w[r] ?? 0) / tot;
      fw += p * clip((awake - s.aw) / 60, 3);
      fd += p * clip((clock - s.a) / 60, 3);
      fr += p * (s.rel - 0.8);
    });
  }
  const a = awake / 120, h = (clock / DAY_MIN) * 2 * Math.PI;
  return [1, a, a * a, Math.sin(h), Math.cos(h), Math.sin(2 * h), Math.cos(2 * h), fw, fd, fr, c.napDev, c.wakeDev, c.nDone / c.napsRef - 0.5, s24 / 720 - 1, c.first, c.lastBlock / 60];
}

// ---------- algèbre minimale (16 coefficients) ----------
function cholesky(A: number[][]): number[][] | null {
  const n = A.length, L = A.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (!(s > 1e-12)) return null;
        L[i]![j] = Math.sqrt(s);
      } else L[i]![j] = s / L[j]![j]!;
    }
  }
  return L;
}
function cholSolve(L: number[][], b: number[]): number[] {
  const n = L.length, y = new Array<number>(n).fill(0), x = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i]!;
    for (let k = 0; k < i; k++) s -= L[i]![k]! * y[k]!;
    y[i] = s / L[i]![i]!;
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let k = i + 1; k < n; k++) s -= L[k]![i]! * x[k]!;
    x[i] = s / L[i]![i]!;
  }
  return x;
}

interface Row {
  x: number[];
  y: 0 | 1;
  w: number;
}

/** MAP par Newton (a priori N(0, 1/λ) sur chaque coefficient hors biais) ; renvoie aussi la covariance a posteriori (Laplace). */
function fit(rows: Row[], lam: number[]): { b: number[]; cov: number[][] } | null {
  const n = lam.length, tw = rows.reduce((s, r) => s + r.w, 0), pos = rows.reduce((s, r) => s + r.w * r.y, 0) / tw;
  if (!(pos > 0 && pos < 1)) return null;
  let b = new Array<number>(n).fill(0);
  b[0] = Math.log(pos / (1 - pos));
  const hessian = (): { H: number[][]; g: number[] } => {
    const H = lam.map((l, i) => lam.map((_, j) => (i === j ? l : 0))), g = b.map((v, i) => -lam[i]! * v);
    for (const r of rows) {
      const p = sigmoid(r.x.reduce((s, v, i) => s + v * b[i]!, 0)), wv = r.w * p * (1 - p);
      for (let i = 0; i < n; i++) {
        g[i] = g[i]! + r.w * (r.y - p) * r.x[i]!;
        for (let j = 0; j <= i; j++) H[i]![j] = H[i]![j]! + wv * r.x[i]! * r.x[j]!;
      }
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) H[i]![j] = H[j]![i]!;
    return { H, g };
  };
  for (let it = 0; it < 30; it++) {
    const { H, g } = hessian(), L = cholesky(H);
    if (!L) return null;
    const d = cholSolve(L, g).map((v) => clip(v, 3));
    b = b.map((v, i) => v + d[i]!);
    if (Math.max(...d.map(Math.abs)) < 1e-5) break;
  }
  const L = cholesky(hessian().H);
  if (!L || b.some((v) => !Number.isFinite(v))) return null;
  const cov = lam.map((_, j) => cholSolve(L, lam.map((__, i) => (i === j ? 1 : 0))));
  return { b, cov };
}

const normal = (r: () => number): number => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

export function bayesHabitDetailed({ birthAt, events }: Parameters<Forecaster>[0], now: number): BayesOutcome {
  const no = (reason: BayesReason): BayesOutcome => ({ reason, window: null });
  if (!events.some((e) => e.kind === 'sleep')) return no('insufficient_data');
  if (events.some((e) => e.kind === 'sleep' && e.end === undefined)) return no('asleep');
  const { typical: typ, timeline: tl, calendar: cal } = habitsModel({ babyId: 'x', birthAt, events }, now);
  if (tl.running !== null) return no('asleep');
  const last = tl.sleeps[tl.sleeps.length - 1];
  if (!last) return no('insufficient_data');
  const wake = last.b, wakeClock = (wake % DAY_MIN) / 60;
  if (wakeClock < 5 || wakeClock >= 21) return no('outside_day');
  if (!typ.ok) return no('insufficient_data');

  // ---- éveils observés de jour, avec leur contexte ----
  const maxAwake = threshold('baselineMaxAwake'), half = threshold('learnHalfLife');
  interface Span { day: Day; i: number; from: number; to: number; slot: number | null }
  const spans: Span[] = [];
  for (let d = tl.today - threshold('modelHistoryDays'); d <= tl.today; d++) {
    const day = cal.dayOf(d);
    if (day.wake === null) continue;
    day.naps.forEach((n, i) => {
      const from = i ? day.naps[i - 1]!.b : (day.wake as number), awake = n.a - from;
      if (awake > 0 && awake <= maxAwake && n.a < wake) spans.push({ day, i, from, to: n.a, slot: napSlot(typ, n.a % DAY_MIN)?.k ?? null });
    });
  }
  if (spans.length < threshold('bayesMinSpans')) return no('insufficient_data');

  // ---- rétrécissement hiérarchique de l'éveil habituel de chaque créneau ----
  const all = spans.map((s) => s.to - s.from), mu = all.reduce((a, b) => a + b, 0) / all.length;
  const bySlot = new Map<number, number[]>();
  spans.forEach((s) => s.slot !== null && bySlot.set(s.slot, [...(bySlot.get(s.slot) ?? []), s.to - s.from]));
  let ss = 0, df = 0;
  bySlot.forEach((v) => {
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    ss += v.reduce((a, b) => a + (b - m) ** 2, 0);
    df += v.length - 1;
  });
  const sw2 = Math.max(df > 0 ? ss / df : 30 ** 2, 15 ** 2), means = [...bySlot.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
  const gm = means.reduce((a, b) => a + b, 0) / Math.max(1, means.length);
  const tau2 = Math.max(means.length > 1 ? means.reduce((a, b) => a + (b - gm) ** 2, 0) / (means.length - 1) - sw2 / Math.max(1, spans.length / means.length) : 25 ** 2, 10 ** 2);
  const slots: Slot[] = typ.naps.map((z) => {
    const v = bySlot.get(z.k) ?? [], m = v.length ? v.reduce((a, b) => a + b, 0) / v.length : z.aw, B = v.length ? sw2 / v.length / (sw2 / v.length + tau2) : 1;
    return { k: z.k, a: z.a, sd: Math.max((z.hi - z.lo) / 2, 20), du: z.du, aw: B * mu + (1 - B) * m, rel: Math.min(1, z.n / typ.n) };
  });
  // observations atypiques : loin de la médiane de leur créneau (MAD), elles pèsent peu
  const robust = (s: Span): number => {
    const v = s.slot !== null ? bySlot.get(s.slot) : undefined;
    if (!v || v.length < 4) return 1;
    const m = med(v), mad = Math.max(1.4826 * (med(v.map((x) => Math.abs(x - m))) as number), 15);
    return Math.abs(s.to - s.from - (m as number)) > 3.5 * mad ? 0.3 : 1;
  };

  const napsRef = Math.max(1, med(typ.napCounts) as number), usualDu = med(typ.naps.map((z) => z.du)) as number;
  const duOf = (n: { a: number; b: number }): number => napSlot(typ, n.a % DAY_MIN)?.du ?? usualDu;
  const s24At = (t: number): number => tl.sleeps.reduce((s, x) => (x.b > t - DAY_MIN && x.a < t ? s + sleepIn(x, t - DAY_MIN, t) : s), 0);
  const ctxAt = (day: Day, i: number): Ctx => {
    const prev = i ? day.naps[i - 1]! : null, before = day.naps.slice(0, i);
    return {
      slots, taken: new Set(before.map((n) => napSlot(typ, n.a % DAY_MIN)?.k).filter((k): k is number => k !== undefined)),
      nDone: i, napsRef, first: i ? 0 : 1,
      wakeDev: day.wake === null ? 0 : clip(((day.wake % DAY_MIN) - typ.wake) / 60, 3),
      napDev: prev ? clip((prev.b - prev.a - duOf(prev)) / 60, 2) : 0,
      lastBlock: prev ? Math.min(prev.b - prev.a, 180) : 0,
    };
  };

  const step = threshold('survivalStepMin'), rows: Row[] = [];
  spans.forEach((s) => {
    const c = ctxAt(s.day, s.i), n = Math.floor((s.to - s.from) / step), w = 0.5 ** ((tl.today - s.day.d) / half) * robust(s);
    for (let j = 0; j <= n; j++) {
      const t = s.from + j * step;
      rows.push({ x: features(c, j * step, t % DAY_MIN, s24At(t)), y: j === n ? 1 : 0, w });
    }
  });
  if (rows.filter((r) => r.y === 1).length < threshold('modelMinGaps')) return no('not_trainable');
  const lam = NAMES.map((_, i) => (i === 0 ? 0.01 : threshold('bayesPriorPrecision')));
  const post = fit(rows, lam);
  if (!post) return no('not_trainable');

  // ---- prévision : mélange de survies tirées de la loi a posteriori ----
  const today = cal.dayOf(tl.today), c = ctxAt(today, today.naps.length);
  const X = Array.from({ length: HORIZON }, (_, j) => features(c, j * step, (wake + j * step) % DAY_MIN, s24At(wake + j * step)));
  const Lc = cholesky(post.cov);
  if (!Lc) return no('not_trainable');
  const r = rng(20261109), draws = Math.max(1, threshold('bayesDraws')), pmf = new Array<number>(HORIZON).fill(0);
  for (let s = 0; s < draws; s++) {
    const z = post.b.map(() => normal(r)), b = s === 0 ? post.b : post.b.map((v, i) => v + Lc[i]!.reduce((a, l, k) => a + l * z[k]!, 0));
    let alive = 1;
    for (let j = 0; j < HORIZON; j++) {
      const h = sigmoid(X[j]!.reduce((a, v, i) => a + v * b[i]!, 0));
      pmf[j] = pmf[j]! + (alive * h) / draws;
      alive *= 1 - h;
    }
  }
  if (pmf.some((p) => !Number.isFinite(p))) return no('invalid_prediction');
  const quantile = (p: number): number | null => {
    let cum = 0;
    for (let j = 0; j < HORIZON; j++) {
      const next = cum + pmf[j]!;
      if (next >= p) return j + (pmf[j]! > 0 ? (p - cum) / pmf[j]! : 0);
      cum = next;
    }
    return null;
  };
  const q10 = quantile(0.1), q90 = quantile(0.9);
  if (q10 === null || q90 === null || !(q90 > q10)) return no('invalid_prediction');
  const toMs = (t: number): number => new Date(tl.origin.getFullYear(), tl.origin.getMonth(), tl.origin.getDate(), 0, t).getTime();
  const win = { from: toMs(wake + q10 * step), to: toMs(wake + q90 * step) };
  if (win.to - win.from > threshold('forecastMaxWidth') * 60_000) return no('window_too_wide');
  // depuis le réveil, pas depuis `now` : la fenêtre ne bouge que si le journal change ; passée, elle ne sert plus
  if (now > win.to) return no('window_passed');
  return { reason: 'ok', window: win };
}

export const bayesHabitSurvival: Forecaster = (input, now) => bayesHabitDetailed(input, now).window;
