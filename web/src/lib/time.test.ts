import { describe, expect, it } from 'vitest';
import { calendarDays, fromMinutes, localDay, originOf, toMinutes, TODAY_INDEX } from './time';
import { ageOf, bornText } from './age';

const d = (y: number, m: number, day: number, h = 0, mi = 0) => new Date(y, m - 1, day, h, mi);

describe('repère de temps', () => {
  it("l'origine est minuit, 27 jours avant aujourd'hui", () => {
    const now = d(2026, 10, 27, 14, 20);
    expect(originOf(now)).toEqual(d(2026, 9, 30));
    expect(toMinutes(now, originOf(now))).toBe(TODAY_INDEX * 1440 + 14 * 60 + 20);
  });

  it("aller-retour minutes ↔ date, y compris autour du changement d'heure d'automne", () => {
    const origin = originOf(d(2026, 10, 27));
    for (const x of [d(2026, 10, 24, 1, 37), d(2026, 10, 25, 2, 30), d(2026, 10, 25, 3, 5), d(2026, 10, 27, 23, 59), d(2026, 10, 1, 0, 0)]) {
      expect(fromMinutes(toMinutes(x, origin), origin)).toEqual(x);
    }
  });

  it('un jour fait toujours 1440 minutes en heure murale', () => {
    const origin = originOf(d(2026, 10, 27));
    expect(toMinutes(d(2026, 10, 26, 7, 0), origin) - toMinutes(d(2026, 10, 25, 7, 0), origin)).toBe(1440);
  });

  it('les minutes peuvent être négatives avant la fenêtre', () => {
    const origin = originOf(d(2026, 10, 27));
    expect(toMinutes(d(2026, 9, 29, 23, 0), origin)).toBe(-60);
    expect(fromMinutes(-60, origin)).toEqual(d(2026, 9, 29, 23, 0));
  });

  it('calendarDays ignore l’heure', () => {
    expect(calendarDays(d(2026, 8, 25, 8, 42), d(2026, 10, 27, 0, 5))).toBe(63);
    expect(localDay(d(2026, 3, 5, 23, 59))).toBe('2026-03-05');
  });
});

describe('âge du bébé', () => {
  const birth = d(2026, 8, 25, 8, 42);
  it('9 semaines et 0 jour', () => {
    expect(ageOf(birth, d(2026, 10, 27, 14, 20))).toEqual({ days: 63, text: '9 semaines', short: '9 semaines' });
  });
  it('9 semaines et 2 jours', () => {
    expect(ageOf(birth, d(2026, 10, 29)).text).toBe('9 semaines et 2 jours');
  });
  it('les premiers jours', () => {
    expect(ageOf(birth, birth).text).toBe('Né aujourd’hui');
    expect(ageOf(birth, d(2026, 8, 26)).text).toBe('1 jour');
    expect(ageOf(birth, d(2026, 9, 7)).text).toBe('13 jours');
  });
  it('en mois après 16 semaines', () => {
    expect(ageOf(birth, d(2026, 12, 29)).short).toBe('4 mois');
  });
  it('la naissance en toutes lettres', () => {
    expect(bornText(birth, d(2026, 10, 27))).toBe('Né le mardi 25 août à 8:42');
    expect(bornText(birth, d(2027, 3, 1))).toBe('Né le mardi 25 août 2026 à 8:42');
  });
});

