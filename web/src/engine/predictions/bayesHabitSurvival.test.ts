// Scénarios de logique du modèle de survie bayésien à habitudes. Les journaux sont synthétiques : ils vérifient le comportement
// attendu (adaptation au réveil, prudence face à un jour atypique…), jamais la performance sur de vrais bébés (voir le backtest).
import { describe, expect, it } from 'vitest';
import { rng } from '../evaluation/synthetic';
import type { EngineEvent } from '../types';
import { bayesHabitDetailed, bayesHabitSurvival } from './bayesHabitSurvival';
import { habitsModel } from '../index';

const at = (d: number, minutes: number) => new Date(2026, 8, 1 + d, 0, minutes).getTime();
const minOfDay = (t: number, d: number) => (t - at(d, 0)) / 60_000;
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

interface Baby {
  /** minute du réveil du matin du jour d */
  wake(d: number, u: () => number): number;
  /** début de la 1re sieste, en minutes depuis minuit */
  nap1(d: number, wake: number, u: () => number): number;
  nap1Dur(d: number, u: () => number): number;
  /** éveil entre la fin de la 1re sieste et la 2e */
  gap2(d: number, dur1: number, u: () => number): number;
  bed(d: number): number;
}

const uni = (u: () => number, a: number) => (u() * 2 - 1) * a;

/** Réveil 7 h 15 ± 50 min ; 1re sieste 70 min après le réveil ; 2e sieste ~100 min après la fin de la 1re ; 3e ~110 min après la 2e. */
const wakeDriven: Baby = {
  wake: (_d, u) => 435 + uni(u, 50),
  nap1: (_d, wake, u) => wake + 70 + uni(u, 8),
  nap1Dur: (_d, u) => 60 + uni(u, 10),
  gap2: (_d, _dur, u) => 100 + uni(u, 8),
  bed: () => 1200,
};
/** Horaire fixe : quel que soit le réveil, 1re sieste à 8 h 30. */
const fixed: Baby = { ...wakeDriven, wake: (_d, u) => 435 + uni(u, 50), nap1: (_d, _w, u) => 510 + uni(u, 8) };

function days(n: number, b: Baby, seed = 7, tweak: (d: number, ev: { wake: number; bed: number; naps: Array<[number, number]> }) => void = () => {}): EngineEvent[] {
  const u = rng(seed), out: EngineEvent[] = [];
  let k = 0, prevBed = 1200;
  const sleep = (a: number, e: number, startDay: number, endDay: number) => out.push({ id: `s${k++}`, kind: 'sleep', start: at(startDay, a), end: at(endDay, e), enteredAt: at(startDay, a), endKnownAt: at(endDay, e) });
  for (let d = 0; d < n; d++) {
    const wake = Math.round(b.wake(d, u)), n1 = Math.round(b.nap1(d, wake, u)), d1 = Math.round(b.nap1Dur(d, u)), n2 = n1 + d1 + Math.round(b.gap2(d, d1, u)), d2 = 85;
    const n3 = n2 + d2 + 110 + Math.round(uni(u, 8)), d3 = 50, bed = b.bed(d);
    const ev = { wake, bed, naps: [[n1, n1 + d1], [n2, n2 + d2], [n3, n3 + d3]] as Array<[number, number]> };
    tweak(d, ev);
    sleep(prevBed, ev.wake, d - 1, d);
    ev.naps.forEach(([a, e]) => sleep(a, e, d, d));
    prevBed = ev.bed;
    [0, 3, 6, 9, 12].forEach((h) => out.push({ id: `f${k++}`, kind: 'bottle', start: at(d, ev.wake + h * 60 + 5), ml: 120, enteredAt: at(d, ev.wake + h * 60 + 7) }));
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Journal connu à l'instant du réveil `wake` (minutes) du jour `d` : l'historique, la nuit qui vient de finir (coucher `bed`) et d'éventuelles siestes du jour. */
const upTo = (past: EngineEvent[], d: number, wake: number, extra: Array<[number, number]> = [], bed = 1200): { events: EngineEvent[]; now: number } => {
  const events = [...past, { id: 'night', kind: 'sleep' as const, start: at(d - 1, bed), end: at(d, wake), enteredAt: at(d - 1, bed), endKnownAt: at(d, wake) }];
  extra.forEach(([a, e], i) => events.push({ id: `x${i}`, kind: 'sleep', start: at(d, a), end: at(d, e), enteredAt: at(d, a), endKnownAt: at(d, e) }));
  return { events, now: at(d, Math.max(wake, ...extra.map(([, e]) => e)) + 1) };
};

const N = 14;
const center = (w: { from: number; to: number }) => (w.from + w.to) / 2;

function predict(b: Baby, wake: number, o: { seed?: number; n?: number; tweak?: Parameters<typeof days>[3]; extra?: Array<[number, number]>; bed?: number } = {}) {
  const n = o.n ?? N, past = days(n, b, o.seed ?? 7, o.tweak), { events, now } = upTo(past, n, wake, o.extra, o.bed);
  return { out: bayesHabitDetailed({ birthAt: null, events }, now), events, now };
}

describe('survival_bayesian_habit : s’adapte au réveil réel', () => {
  it('scénario 1 — réveil à 6 h 30 : la sieste est attendue près de 7 h 40, pas à l’heure habituelle de 8 h 25', () => {
    const { out, events, now } = predict(wakeDriven, 390);
    expect(out.reason).toBe('ok');
    const w = out.window!, c = minOfDay(center(w), N);
    // le défaut corrigé : le créneau habituel seul attendrait 8 h
    const hm0 = habitsModel({ babyId: 'x', birthAt: null, events }, now), firstWindow = hm0.windows[0]!;
    expect(firstWindow.a - hm0.timeline.t0).toBeGreaterThanOrEqual(8 * 60);
    expect(minOfDay(w.from, N)).toBeLessThan(8 * 60);
    expect(Math.abs(c - (390 + 70))).toBeLessThanOrEqual(25);
  });

  it('scénario 2 — réveil tardif à 8 h : pas de sieste collée au réveil, elle suit l’éveil habituel', () => {
    const { out } = predict(wakeDriven, 480), w = out.window!;
    expect(out.reason).toBe('ok');
    expect(minOfDay(w.from, N)).toBeGreaterThanOrEqual(480 + 30);
    expect(Math.abs(minOfDay(center(w), N) - (480 + 70))).toBeLessThanOrEqual(30);
  });

  it('scénario 3 — réveil habituel à 7 h 15 : garde le rythme observé', () => {
    const { out } = predict(wakeDriven, 435);
    expect(out.reason).toBe('ok');
    expect(Math.abs(minOfDay(center(out.window!), N) - (435 + 70))).toBeLessThanOrEqual(25);
  });

  it('bébé à horaire fixe : un réveil précoce ne force pas la sieste plus tôt', () => {
    const { out } = predict(fixed, 390);
    expect(out.reason).toBe('ok');
    expect(Math.abs(minOfDay(center(out.window!), N) - 510)).toBeLessThanOrEqual(40);
  });
});

describe('survival_bayesian_habit : durée des siestes et sommeil', () => {
  const dur: Baby = { ...wakeDriven, nap1Dur: (_d, u) => 62 + uni(u, 32), gap2: (_d, d1, u) => 100 + (d1 - 62) + uni(u, 6) };
  it('scénarios 4 et 5 — sieste courte puis sieste longue : la suivante est plus tôt, puis plus tard, sans règle fixe', () => {
    const short = predict(dur, 435, { extra: [[505, 535]], n: 21 }), long = predict(dur, 435, { extra: [[505, 600]], n: 21 });
    expect(short.out.reason).toBe('ok');
    expect(long.out.reason).toBe('ok');
    const gap = minOfDay(center(long.out.window!), 21) - minOfDay(center(short.out.window!), 21);
    expect(gap).toBeGreaterThanOrEqual(20);
    // le vrai écart est de 65 min : le modèle ne l’exagère pas
    expect(gap).toBeLessThanOrEqual(90);
  });

  it('scénario 6 — nuit courte sans effet dans ce bébé : le modèle n’impose pas une heure', () => {
    const calm: Baby = { ...wakeDriven, wake: (_d, u) => 435 + uni(u, 5), nap1: (_d, _w, u) => 505 + uni(u, 8) };
    const normal = predict(calm, 435), short = predict(calm, 435, { bed: 1350 });
    expect(normal.out.reason).toBe('ok');
    expect(short.out.reason).toBe('ok');
    expect(Math.abs(minOfDay(center(short.out.window!), N) - minOfDay(center(normal.out.window!), N))).toBeLessThanOrEqual(20);
  });
});

describe('survival_bayesian_habit : changement de rythme et jour atypique', () => {
  it('scénario 7 — l’horaire fixe glisse de 8 h 30 vers 7 h 45 sur cinq jours : la prévision suit, sans sauter', () => {
    const drift: Baby = { ...fixed, wake: (d, u) => (d < 9 ? 435 : 435 - (d - 8) * 9) + uni(u, 6), nap1: (d, _w, u) => (d < 9 ? 510 : 510 - (d - 8) * 9) + uni(u, 6) };
    const { out } = predict(drift, 390), c = minOfDay(center(out.window!), N);
    expect(out.reason).toBe('ok');
    expect(c).toBeLessThanOrEqual(8 * 60 + 5);
    expect(c).toBeGreaterThanOrEqual(7 * 60 + 30);
  });

  it('scénario 8 — un jour isolé très décalé ne bouge pas brutalement le profil', () => {
    const base = predict(wakeDriven, 390), odd = predict(wakeDriven, 390, { tweak: (d, ev) => { if (d === 7) { ev.wake += 60; ev.naps = ev.naps.map(([a, e]) => [a + 120, e + 120] as [number, number]); } } });
    expect(odd.out.reason).toBe('ok');
    expect(Math.abs(minOfDay(center(odd.out.window!), N) - minOfDay(center(base.out.window!), N))).toBeLessThanOrEqual(15);
  });
});

describe('survival_bayesian_habit : données et robustesse', () => {
  it('scénario 9 — trop peu d’historique : raison explicite, aucune fenêtre inventée', () => {
    for (const n of [1, 2, 3]) {
      const { out } = predict(wakeDriven, 435, { n });
      expect(out.window).toBeNull();
      expect(['insufficient_data', 'not_trainable']).toContain(out.reason);
    }
  });

  it('dort : pas de prévision ; nuit : hors du périmètre de jour', () => {
    const past = days(N, wakeDriven), running = [...past, { id: 'run', kind: 'sleep' as const, start: at(N, 500), enteredAt: at(N, 500) }];
    expect(bayesHabitDetailed({ birthAt: null, events: running }, at(N, 520)).reason).toBe('asleep');
    const night = upTo(past, N, 200);
    expect(bayesHabitDetailed({ birthAt: null, events: night.events }, night.now).reason).toBe('outside_day');
  });

  it('fenêtre cohérente et déterministe : bornes finies, ordonnées, ni dans le passé du réveil, ni plus large que le maximum', () => {
    const a = predict(wakeDriven, 420), b = predict(wakeDriven, 420);
    expect(a.out).toEqual(b.out);
    const w = a.out.window!;
    expect(Number.isFinite(w.from) && Number.isFinite(w.to) && w.to > w.from).toBe(true);
    expect(w.from).toBeGreaterThanOrEqual(at(N, 420));
    expect(w.to - w.from).toBeLessThanOrEqual(180 * 60_000);
  });

  it('une fenêtre passée n’est plus servie', () => {
    const { events } = predict(wakeDriven, 420);
    expect(bayesHabitDetailed({ birthAt: null, events }, at(N, 900)).reason).toBe('window_passed');
  });

  it('le Forecaster rend la même fenêtre que la version détaillée', () => {
    const { out, events, now } = predict(wakeDriven, 420);
    expect(bayesHabitSurvival({ birthAt: null, events }, now)).toEqual(out.window);
  });

  it('autour du changement d’heure (dernier dimanche d’octobre) : fenêtre valide, pas de NaN', () => {
    const base = (d: number) => new Date(2026, 9, 14 + d, 0, 0).getTime();
    const b: EngineEvent[] = [];
    let k = 0;
    for (let d = 0; d < 14; d++) {
      const s = (a: number, e: number) => b.push({ id: `d${k++}`, kind: 'sleep', start: base(d) + a * 60_000, end: base(d) + e * 60_000, enteredAt: base(d) + a * 60_000, endKnownAt: base(d) + e * 60_000 });
      s(-240, 435);
      s(505, 565); s(665, 750); s(860, 910);
      [435, 615, 795, 975].forEach((m) => b.push({ id: `b${k++}`, kind: 'bottle', start: base(d) + m * 60_000, ml: 120, enteredAt: base(d) + m * 60_000 + 60_000 }));
    }
    const wake = base(14) + 400 * 60_000;
    const events = [...b, { id: 'n', kind: 'sleep' as const, start: base(13) + 1200 * 60_000, end: wake, enteredAt: base(13) + 1200 * 60_000, endKnownAt: wake }];
    const out = bayesHabitDetailed({ birthAt: null, events }, wake + 60_000);
    expect(out.reason).toBe('ok');
    expect(out.window!.to).toBeGreaterThan(out.window!.from);
  });
});
