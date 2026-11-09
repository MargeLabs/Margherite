// Cas imposés pour la recommandation de sieste. Journaux synthétiques : ils vérifient l'individualisation et la prudence, jamais une performance sur de vrais bébés.
import { describe, expect, it } from 'vitest';
import { rng } from '../evaluation/synthetic';
import type { EngineEvent } from '../types';
import { recommendNap } from './recommendation';

const at = (d: number, minutes: number) => new Date(2026, 8, 1 + d, 0, minutes).getTime();
const minOfDay = (t: number, d: number) => (t - at(d, 0)) / 60_000;
const uni = (u: () => number, a: number) => (u() * 2 - 1) * a;

interface Baby {
  wake: number;
  wakeSd: number;
  /** éveil avant la 1re sieste */
  awake1: number;
  dur1: (u: () => number) => number;
  /** éveil avant la 2e sieste, selon la durée de la 1re */
  gap2: (d1: number, u: () => number) => number;
}
const base: Baby = { wake: 465, wakeSd: 20, awake1: 80, dur1: (u) => 60 + uni(u, 8), gap2: (_d1, u) => 100 + uni(u, 8) };

type Tweak = (d: number, x: { wake: number; naps: Array<[number, number]> }) => void;
function days(n: number, b: Baby, o: { seed?: number; tweak?: Tweak } = {}): EngineEvent[] {
  const u = rng(o.seed ?? 5), out: EngineEvent[] = [];
  let k = 0, prevBed = 1200;
  const sl = (a: number, e: number, sd: number, ed: number) => out.push({ id: `s${k++}`, kind: 'sleep', start: at(sd, a), end: at(ed, e), enteredAt: at(sd, a), endKnownAt: at(ed, e) });
  for (let d = 0; d < n; d++) {
    const wake = Math.round(b.wake + uni(u, b.wakeSd)), n1 = wake + Math.round(b.awake1 + uni(u, 6)), d1 = Math.round(b.dur1(u)), n2 = n1 + d1 + Math.round(b.gap2(d1, u)), n3 = n2 + 85 + 110 + Math.round(uni(u, 8));
    const x = { wake, naps: [[n1, n1 + d1], [n2, n2 + 85], [n3, n3 + 50]] as Array<[number, number]> };
    o.tweak?.(d, x);
    sl(prevBed, x.wake, d - 1, d);
    x.naps.forEach(([a, e]) => sl(a, e, d, d));
    prevBed = 1200;
    [0, 3, 6, 9, 12].forEach((h) => out.push({ id: `f${k++}`, kind: 'bottle', start: at(d, x.wake + h * 60 + 5), ml: 120, enteredAt: at(d, x.wake + h * 60 + 7) }));
  }
  return out;
}

/** La situation après `n` jours : réveil du matin à `wake` (min), puis éventuellement une 1re sieste déjà faite. */
function reco(b: Baby, wake: number, o: { n?: number; first?: [number, number]; seed?: number; tweak?: Tweak } = {}) {
  const n = o.n ?? 14, events: EngineEvent[] = [...days(n, b, { seed: o.seed, tweak: o.tweak }), { id: 'night', kind: 'sleep', start: at(n - 1, 1200), end: at(n, wake), enteredAt: at(n - 1, 1200), endKnownAt: at(n, wake) }];
  let now = at(n, wake + 1);
  if (o.first) {
    events.push({ id: 'n1', kind: 'sleep', start: at(n, o.first[0]), end: at(n, o.first[1]), enteredAt: at(n, o.first[0]), endKnownAt: at(n, o.first[1]) });
    now = at(n, o.first[1] + 1);
  }
  return { out: recommendNap({ birthAt: null, events }, now), n };
}
const mid = (r: ReturnType<typeof reco>) => minOfDay(r.out.recommendation!.center, r.n);

describe('recommandation : réveil plus tôt que d’habitude', () => {
  it('réveil à 6 h 30 au lieu de 7 h 30–8 h : la sieste est conseillée plus tôt, d’après ses éveils observés', () => {
    const r = reco(base, 390);
    expect(r.out.reason).toBe('ok');
    // ses éveils avant la 1re sieste : ~80 min ; l’horaire habituel (~9 h) ferait attendre plus de 2 h 30
    expect(Math.abs(mid(r) - (390 + 80))).toBeLessThanOrEqual(25);
    expect(mid(r)).toBeLessThan(8 * 60 + 15);
  });

  it('réveil à 7 h alors qu’il se réveille d’habitude à 8 h 30 : suit l’éveil, pas l’horloge', () => {
    const late: Baby = { ...base, wake: 510, wakeSd: 15 };
    const r = reco(late, 420);
    expect(r.out.reason).toBe('ok');
    expect(Math.abs(mid(r) - (420 + 80))).toBeLessThanOrEqual(25);
  });

  it('réveil habituel : la recommandation ne bouge pas inutilement', () => {
    const r = reco(base, 465), early = reco(base, 390);
    expect(Math.abs(mid(r) - (465 + 80))).toBeLessThanOrEqual(15);
    expect(mid(early)).toBeLessThan(mid(r) - 45);
  });

  it('individualisée : deux bébés, même réveil précoce, éveils différents, recommandations différentes', () => {
    const quick = reco({ ...base, awake1: 55 }, 390), slow = reco({ ...base, awake1: 110 }, 390);
    expect(mid(slow) - mid(quick)).toBeGreaterThanOrEqual(35);
  });
});

describe('recommandation : sieste précédente', () => {
  const linked: Baby = { ...base, wakeSd: 5, dur1: (u) => 62 + uni(u, 32), gap2: (d1, u) => 100 + (d1 - 62) + uni(u, 6) };
  const free: Baby = { ...base, wakeSd: 5, dur1: (u) => 62 + uni(u, 32), gap2: (_d1, u) => 100 + uni(u, 6) };

  it('sieste très courte puis sieste longue, quand la durée influe sur l’éveil suivant : l’indication s’adapte', () => {
    const short = reco(linked, 465, { n: 21, first: [545, 575] }), long = reco(linked, 465, { n: 21, first: [545, 640] });
    expect(mid(long) - mid(short)).toBeGreaterThanOrEqual(25);
  });

  it('sieste longue quand la durée n’influe pas sur l’éveil suivant : pas d’avance automatique', () => {
    const short = reco(free, 465, { n: 21, first: [545, 575] }), long = reco(free, 465, { n: 21, first: [545, 640] });
    // l’écart de fin de sieste (65 min) reste dans la recommandation, mais l’éveil lui-même ne change pas
    expect(Math.abs(mid(long) - 65 - mid(short))).toBeLessThanOrEqual(20);
  });
});

describe('recommandation : données rares et journée atypique', () => {
  it('historique insuffisant : prudente et honnête sur sa confiance', () => {
    const r = reco(base, 390, { n: 2 });
    expect(r.out.reason).toBe('ok');
    const x = r.out.recommendation!;
    expect(x.confidence).toBe('low');
    expect(x.basis.spans).toBeLessThan(10);
    // fenêtre souple : jamais plus étroite que la demi-largeur minimale élargie, pour ne pas fabriquer une précision
    expect(x.window.to - x.window.from).toBeGreaterThanOrEqual(45 * 60_000);
  });

  it('presque rien observé : pas de recommandation inventée', () => {
    const r = reco(base, 390, { n: 0 });
    expect(r.out.recommendation).toBeNull();
    expect(r.out.reason).toBe('no_history');
  });

  it('une journée atypique isolée ne bouleverse pas le profil', () => {
    const odd = reco(base, 390, { tweak: (d, x) => { if (d === 7) { x.wake += 70; x.naps = x.naps.map(([a, e]) => [a + 150, e + 150] as [number, number]); } } });
    expect(Math.abs(mid(odd) - mid(reco(base, 390)))).toBeLessThanOrEqual(15);
  });

  it('le rythme change durablement : les éveils récents prennent le dessus, sans effacer le fond', () => {
    const drift: Baby = base;
    const shorter = reco(drift, 390, { tweak: (d, x) => { if (d >= 7) x.naps = x.naps.map(([a, e]) => [a - 25, e - 25] as [number, number]); } });
    const same = reco(drift, 390);
    expect(mid(shorter)).toBeLessThan(mid(same) - 10);
    expect(shorter.out.recommendation!.basis.trend).toBe('earlier');
  });

  it('il dort, ou nuit : aucune recommandation', () => {
    const events = [...days(14, base), { id: 'run', kind: 'sleep' as const, start: at(14, 500), enteredAt: at(14, 500) }];
    expect(recommendNap({ birthAt: null, events }, at(14, 520)).reason).toBe('asleep');
    const night = [...days(14, base), { id: 'nw', kind: 'sleep' as const, start: at(13, 1200), end: at(14, 200), enteredAt: at(13, 1200), endKnownAt: at(14, 200) }];
    expect(recommendNap({ birthAt: null, events: night }, at(14, 201)).reason).toBe('outside_day');
  });

  it('déterministe, fenêtre ordonnée et à partir du réveil', () => {
    const a = reco(base, 390), b = reco(base, 390), w = a.out.recommendation!.window;
    expect(a.out).toEqual(b.out);
    expect(w.to).toBeGreaterThan(w.from);
    expect(w.from).toBeGreaterThanOrEqual(at(14, 390));
  });
});
