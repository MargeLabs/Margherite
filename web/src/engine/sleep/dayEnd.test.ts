import { describe, expect, it } from 'vitest';
import { habitsModel } from '../index';
import { CURRENT_RULES, LEGACY_RULES } from '../rules';
import { isNapStart } from './timeline';
import type { EngineEvent } from '../types';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const sleep = (id: string, a: number, b: number): EngineEvent => ({ id, kind: 'sleep', start: a, end: b });

// Un dodo à 19 h 10 (1 h 20), un éveil de 20 min, puis la nuit : le coucher est-il 19 h 10 ou 19 h 50 ?
const log = [
  sleep('n', at(7, 12), at(7, 13)),
  sleep('e', at(8, 19, 10), at(8, 20, 30)),
  sleep('c', at(8, 20, 50), at(9, 6, 30)),
  { id: 'f', kind: 'bottle', start: at(9, 7), ml: 100 } as EngineEvent,
];
const now = at(10, 12);

describe('fin du jour : contradiction documentée', () => {
  it('19 h 10 est une sieste pour l’étiquette horaire', () => {
    const m = habitsModel({ babyId: 'x', birthAt: null, events: log }, now, LEGACY_RULES);
    const t = m.timeline;
    expect(isNapStart(t.sleeps.find((s) => s.id === 'e')!.a)).toBe(true);
  });
  it('limite connue : le moteur en fait le coucher (chaîne de nuit), l’étiquette horaire dit « sieste »', () => {
    // décision de Victor (2026-11-02) : un bloc qui ouvre une nuit à 19 h 10 est le coucher. L'étiquette horaire (19 h 30) ne le sait pas.
    for (const rules of [LEGACY_RULES, CURRENT_RULES]) {
      const m = habitsModel({ babyId: 'x', birthAt: null, events: log }, now, rules);
      const n = m.calendar.nightOf(m.timeline.today - 1);
      expect(n.st === 'absent' ? null : (n.bed as number) % 1440).toBe(19 * 60 + 10);
    }
  });
});

describe('la logique de l’écran lit la même fin de jour', () => {
  it('NAP_END = napDayEnd', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { threshold } = await import('../config');
    const src = readFileSync(join(__dirname, '..', '..', 'legacy', 'app.logic.generated.js'), 'utf8');
    expect(Number(/const NAP_END = (\d+);/.exec(src)?.[1])).toBe(threshold('napDayEnd'));
    expect(src.match(/\b1170\b/g)?.length).toBe(1);
  });
});

describe('coucher : pas de repli sur un bloc court (option B, 2026-11-05)', () => {
  // 19 h 47 pendant 30 min, un éveil, puis un dodo qui vient de commencer (< 90 min) : pas encore de coucher confirmé
  const ev = [sleep('a', at(8, 19, 47), at(8, 20, 17)), sleep('b', at(8, 21, 30), at(8, 22, 0))];
  it('aucun coucher tant que la chaîne n’a pas 90 min ; le bloc de 30 min n’est pas le coucher', () => {
    const m = habitsModel({ babyId: 'x', birthAt: null, events: ev }, at(8, 22, 0), CURRENT_RULES);
    const n = m.calendar.nightOf(m.timeline.today + 1);
    expect(n.st).toBe('absent');
  });
  it('une fois 90 min atteintes, le coucher est le dodo de 21 h 30, pas celui de 19 h 47', () => {
    const e2 = [ev[0]!, sleep('b', at(8, 21, 30), at(8, 23, 15))];
    const m = habitsModel({ babyId: 'x', birthAt: null, events: e2 }, at(8, 23, 15), CURRENT_RULES);
    const n = m.calendar.nightOf(m.timeline.today + 1);
    expect(n.st === 'absent' ? null : (n.bed as number) % 1440).toBe(21 * 60 + 30);
  });
});

describe('seuils de nuit adaptés à son rythme (blocs courts), sans données = seuils par défaut', () => {
  const m60 = (d: number, h: number, min = 0) => at(d, h, min);
  // 6 nuits de blocs d'1 h (20 min d'éveil entre deux), puis une nuit de 45 + 30 min (75 min en tout)
  const nights: EngineEvent[] = [];
  for (let d = 1; d <= 6; d++) for (let k = 0; k < 8; k++) nights.push(sleep(`n${d}-${k}`, m60(d, 20) + k * 80 * 60000, m60(d, 21) + k * 80 * 60000));
  const test = [sleep('t1', m60(7, 20), m60(7, 20, 45)), sleep('t2', m60(7, 21, 5), m60(7, 21, 35))];
  const bed = (events: EngineEvent[], rules = CURRENT_RULES) => {
    const m = habitsModel({ babyId: 'x', birthAt: null, events }, m60(7, 22), rules);
    const n = m.calendar.nightOf(m.timeline.today + 1);
    return n.st === 'absent' ? null : (n.bed as number) % 1440;
  };
  it('avec ses nuits d’avant : la nuit de 75 min est reconnue, coucher 20 h', () => {
    expect(bed([...nights, ...test])).toBe(20 * 60);
  });
  it('sans nuit d’avant : seuils par défaut, pas de coucher (45 min < 60 et 75 min < 90)', () => {
    expect(bed(test)).toBeNull();
  });
});
