import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../types';
import { TARGETS } from '../intelligence/targets';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, 1 + d, h, m).getTime();
const hm = (t: number) => new Date(t).toTimeString().slice(0, 5);

/** Réveil à 7 h, siestes à 8 h 15 (éveil 1 h 15), 11 h (éveil 1 h 45) et 14 h 30, coucher à 20 h. Tout saisi en direct. */
function days(n: number): EngineEvent[] {
  const out: EngineEvent[] = [];
  let k = 0;
  const sleep = (a: number, b: number) => out.push({ id: `s${k++}`, kind: 'sleep', start: a, end: b, enteredAt: a, endKnownAt: b });
  for (let d = 0; d < n; d++) {
    sleep(at(d, 8, 15), at(d, 9, 15));
    sleep(at(d, 11), at(d, 12, 30));
    sleep(at(d, 14, 30), at(d, 15, 30));
    sleep(at(d, 20), at(d + 1, 7));
    [7, 10, 13, 16, 19].forEach((h) => out.push({ id: `f${k++}`, kind: 'bottle', start: at(d, h, 5), ml: 120, enteredAt: at(d, h, 7) }));
  }
  return out;
}

const habit = TARGETS.nap_start.models.habit!;
const habitWake = TARGETS.nap_start.models.habit_wake!;

describe('habit_wake : créneau habituel calé sur le réveil', () => {
  const past = days(10);

  it('réveil à 6 h au lieu de 7 h : la fenêtre suit le réveil, pas l’horloge', () => {
    // la nuit du jour 9 finit à 6 h au lieu de 7 h
    const events = past.map((e) => (e.kind === 'sleep' && e.end === at(10, 7) ? { ...e, end: at(10, 6), endKnownAt: at(10, 6) } : e));
    const now = at(10, 6, 1);
    const h = habit({ birthAt: null, events }, now), w = habitWake({ birthAt: null, events }, now);
    expect(h && hm(h.from)).toBe('08:00');
    // 6 h + 1 h 15 d’éveil habituel = 7 h 15
    expect(w).not.toBeNull();
    expect(w!.from).toBeLessThanOrEqual(at(10, 7, 15));
    expect(w!.to).toBeGreaterThanOrEqual(at(10, 7, 15));
    expect(w!.from).toBeLessThan(h!.from);
  });

  it('après la 1re sieste, il ne saute pas au créneau suivant s’il est bien plus tard que l’éveil habituel', () => {
    const events = [...past, { id: 'n1', kind: 'sleep' as const, start: at(10, 8, 15), end: at(10, 8, 45), enteredAt: at(10, 8, 15), endKnownAt: at(10, 8, 45) }];
    const now = at(10, 8, 46);
    const w = habitWake({ birthAt: null, events: events.filter((e) => e.start <= now) }, now);
    // créneau suivant : 11 h, éveil habituel 1 h 45 → 10 h 30
    expect(w).not.toBeNull();
    expect(w!.from).toBeLessThanOrEqual(at(10, 10, 30));
    expect(w!.to).toBeGreaterThanOrEqual(at(10, 10, 30));
  });

  it('s’abstient quand il dort, sans journée type, ou quand la fenêtre est passée', () => {
    const asleep = [...past, { id: 'run', kind: 'sleep' as const, start: at(10, 8, 15), enteredAt: at(10, 8, 15) }];
    expect(habitWake({ birthAt: null, events: asleep }, at(10, 8, 30))).toBeNull();
    expect(habitWake({ birthAt: null, events: days(1) }, at(1, 9, 30))).toBeNull();
    expect(habitWake({ birthAt: null, events: past }, at(10, 13))).toBeNull();
  });
});
