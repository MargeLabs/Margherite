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
