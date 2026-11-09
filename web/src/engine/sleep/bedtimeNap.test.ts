import { describe, expect, it } from 'vitest';
import { habitsModel } from '../index';
import { CURRENT_RULES } from '../rules';
import type { EngineEvent } from '../types';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const sleep = (id: string, a: number, b: number): EngineEvent => ({ id, kind: 'sleep', start: a, end: b });
const feed = (id: string, a: number): EngineEvent => ({ id, kind: 'bottle', start: a, ml: 90 });

// 6 nuits d'habitude : coucher 21 h, réveil 7 h ; le 12 au soir, un premier bloc court (x min) à 20 h 25, 27 min d'éveil, puis la vraie nuit
const base = (): EngineEvent[] => {
  const ev: EngineEvent[] = [];
  for (let d = 5; d <= 10; d++) { ev.push(sleep('n' + d, at(d, 21), at(d + 1, 7))); ev.push(feed('f' + d, at(d + 1, 7, 10))); }
  return ev;
};
const bed = (short: number) => {
  const a = at(11, 20, 25), b = a + short * 60_000;
  const events = [...base(), sleep('s', a, b), sleep('c', b + 27 * 60_000, at(12, 7)), feed('f12', at(12, 7, 10))];
  const m = habitsModel({ babyId: 'x', birthAt: null, events }, at(12, 12), CURRENT_RULES);
  const n = m.calendar.nightOf(m.timeline.today);
  return n.st === 'absent' ? null : (n.bed as number) % 1440;
};

describe('coucher : un très court dodo près de l’heure habituelle', () => {
  it('25 min à 20 h 25 est une sieste : la nuit commence après', () => expect(bed(25)).toBe(21 * 60 + 17));
  it('56 min proche du coucher habituel reste le coucher', () => expect(bed(56)).toBe(20 * 60 + 25));
});
