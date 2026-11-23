// Marqueurs posés par le parent : « coucher du soir » (début du dodo) et « réveil du matin » (fin du dodo).
// Un marqueur remplace la détection ; sans marqueur, rien ne change (les goldens le prouvent).
import { describe, expect, it } from 'vitest';
import { habitsModel } from '../index';
import { CURRENT_RULES } from '../rules';
import type { EngineEvent, NightMark } from '../types';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
const sleep = (id: string, a: number, b: number, mark?: NightMark): EngineEvent => ({ id, kind: 'sleep', start: a, end: b, ...(mark ? { mark } : {}) });
const feed = (id: string, a: number): EngineEvent => ({ id, kind: 'bottle', start: a, ml: 100 });

// la nuit du 8 au 9 septembre ; `now` = le 9 à 12 h, donc le jour 9 = today
const nightOf = (events: EngineEvent[], now = at(9, 12)) => {
  const m = habitsModel({ babyId: 'x', birthAt: null, events }, now, CURRENT_RULES);
  return m.calendar.nightOf(m.timeline.today);
};
// un événement en amont, pour que la nuit soit « observée » (le journal ne commence pas juste avant le coucher)
const lead = [feed('f0', at(8, 8)), sleep('n0', at(8, 13), at(8, 14, 30))];

describe('coucher déclaré', () => {
  // 20 h 10 → 20 h 50 (40 min), 20 min d'éveil, puis 21 h 10 → 2 h : sans marqueur, le bloc de 40 min (< 60 min) est écarté
  const first = (mark?: 'bed') => sleep('a', at(8, 20, 10), at(8, 20, 50), mark);
  const rest = [sleep('b', at(8, 21, 10), at(9, 2)), sleep('c', at(9, 2, 30), at(9, 6, 40))];

  it('sans marqueur, le premier bloc court est écarté (comportement d’avant)', () => {
    const n = nightOf([...lead, first(), ...rest]);
    expect(n.st).toBe('ok');
    expect((n.bed as number) % 1440).toBe(21 * 60 + 10);
  });
  it('avec marqueur, le coucher est le début du dodo marqué, même court', () => {
    const n = nightOf([...lead, first('bed'), ...rest]);
    expect(n.st).toBe('ok');
    expect((n.bed as number) % 1440).toBe(20 * 60 + 10);
    expect(n.sl).toHaveLength(3);
  });
  it('un coucher déclaré n’est jamais « non observé », même juste après le début du journal', () => {
    const n = nightOf([sleep('a', at(8, 20, 10), at(8, 20, 50), 'bed'), ...rest]);
    expect(n.st).toBe('ok');
    expect(n.startUnobserved).toBeUndefined();
  });
  it('un marqueur posé sur une sieste de l’après-midi (avant 15 h) est ignoré', () => {
    const n = nightOf([lead[0]!, sleep('n0', at(8, 13), at(8, 14, 30), 'bed'), first(), ...rest]);
    expect((n.bed as number) % 1440).toBe(21 * 60 + 10);
  });
  it('deux marqueurs le même soir : le dernier gagne', () => {
    const n = nightOf([...lead, first('bed'), sleep('b', at(8, 21, 10), at(9, 2), 'bed'), rest[1]!]);
    expect((n.bed as number) % 1440).toBe(21 * 60 + 10);
  });
});

describe('réveil déclaré', () => {
  // nuit 21 h → 6 h 10, puis un dodo de 6 h 40 à 7 h 10 (30 min d'éveil, donc rattaché à la nuit sans marqueur)
  const night = [sleep('a', at(8, 21), at(9, 2))];
  const tail = sleep('t', at(9, 6, 40), at(9, 7, 10));

  it('sans marqueur, le dodo de 6 h 40 prolonge la nuit', () => {
    const n = nightOf([...lead, night[0]!, sleep('b', at(9, 2, 30), at(9, 6, 10)), tail]);
    expect((n.wake as number) % 1440).toBe(7 * 60 + 10);
  });
  it('avec marqueur, la nuit finit à la fin du dodo marqué et le suivant est une sieste', () => {
    const n = nightOf([...lead, night[0]!, sleep('b', at(9, 2, 30), at(9, 6, 10), 'wake'), tail]);
    expect(n.st).toBe('ok');
    expect((n.wake as number) % 1440).toBe(6 * 60 + 10);
    expect(n.sl).toHaveLength(2);
  });
  it('un réveil déclaré avant 5 h 30 rend la nuit complète (elle serait partielle sinon)', () => {
    const early = [...lead, sleep('a', at(8, 21), at(9, 4, 50))];
    expect(nightOf(early).st).toBe('partiel');
    expect(nightOf([...lead, sleep('a', at(8, 21), at(9, 4, 50), 'wake')]).st).toBe('ok');
  });
  it('un réveil déclaré le matin d’une nuit sans coucher détectable ne crée pas de nuit', () => {
    const n = nightOf([...lead, sleep('w', at(9, 5), at(9, 6, 30), 'wake')]);
    expect(n.st).toBe('absent');
  });
  it('un réveil déclaré après midi est ignoré', () => {
    const n = nightOf([...lead, night[0]!, sleep('b', at(9, 2, 30), at(9, 6, 10)), sleep('x', at(9, 13), at(9, 14), 'wake')], at(9, 18));
    expect((n.wake as number) % 1440).toBe(6 * 60 + 10);
  });
});

describe('coucher et réveil sur le même dodo (nuit d’un seul bloc)', () => {
  it('une nuit d’un bloc marquée « both » : coucher à son début, réveil à sa fin, suite = sieste', () => {
    const ev = [...lead, sleep('a', at(8, 20, 30), at(9, 4, 40), 'both'), sleep('d', at(9, 5, 10), at(9, 5, 40))];
    const n = nightOf(ev);
    expect(n.st).toBe('ok');
    expect((n.bed as number) % 1440).toBe(20 * 60 + 30);
    expect((n.wake as number) % 1440).toBe(4 * 60 + 40);
    expect(n.sl).toHaveLength(1);
  });
});

describe('coucher et réveil déclarés ensemble', () => {
  it('la nuit va du dodo marqué coucher au dodo marqué réveil, quels que soient les éveils entre les deux', () => {
    const ev = [...lead, sleep('a', at(8, 20), at(8, 22), 'bed'), sleep('b', at(8, 23, 30), at(9, 1)), sleep('c', at(9, 3), at(9, 6, 20), 'wake'), sleep('d', at(9, 7), at(9, 7, 30))];
    const n = nightOf(ev);
    expect(n.st).toBe('ok');
    expect((n.bed as number) % 1440).toBe(20 * 60);
    expect((n.wake as number) % 1440).toBe(6 * 60 + 20);
    expect(n.sl).toHaveLength(3);
    expect(n.wakings).toBe(2);
  });
});
