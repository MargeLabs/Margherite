// Jours locaux : frontières de minuit dans un fuseau nommé, changements d'heure, découpe d'un sommeil. Tous les tests donnent le fuseau :
// aucun ne dépend du fuseau de la machine qui les exécute.
import { describe, expect, it } from 'vitest';
import { dayLengthMin, dayOf, nextDay, offsetMin, splitByDay, startOfDay } from './localDays';

const Z = (s: string): number => Date.parse(s);
const PARIS = 'Europe/Paris';

describe('jour civil local', () => {
  it('le jour dépend du fuseau, pas de l’instant UTC', () => {
    const t = Z('2026-11-09T23:30:00Z'); // 00:30 le 10 à Paris, 18:30 le 9 à New York, 23:30 le 9 en UTC
    expect([dayOf(t, PARIS), dayOf(t, 'America/New_York'), dayOf(t, 'UTC')]).toEqual(['2026-11-10', '2026-11-09', '2026-11-09']);
  });

  it('minuit est inclus dans le jour qu’il ouvre, une milliseconde avant dans la veille', () => {
    const midnight = startOfDay('2026-11-10', PARIS);
    expect(midnight).toBe(Z('2026-11-09T23:00:00Z'));
    expect(dayOf(midnight, PARIS)).toBe('2026-11-10');
    expect(dayOf(midnight - 1, PARIS)).toBe('2026-11-09');
  });

  it('nextDay passe les fins de mois et d’année', () => {
    expect([nextDay('2026-02-28'), nextDay('2026-12-31'), nextDay('2028-02-28')]).toEqual(['2026-03-01', '2027-01-01', '2028-02-29']);
  });

  it('décalage : +60 en hiver et +120 en été à Paris', () => {
    expect([offsetMin(Z('2026-01-15T12:00:00Z'), PARIS), offsetMin(Z('2026-07-15T12:00:00Z'), PARIS)]).toEqual([60, 120]);
  });
});

describe('durée d’un jour : le changement d’heure', () => {
  it('Paris : 23 h au passage à l’heure d’été, 25 h à l’heure d’hiver, 24 h sinon', () => {
    expect([dayLengthMin('2026-03-29', PARIS), dayLengthMin('2026-10-25', PARIS), dayLengthMin('2026-11-10', PARIS)]).toEqual([1380, 1500, 1440]);
  });

  it('New York, dates différentes de l’Europe', () => {
    expect([dayLengthMin('2026-03-08', 'America/New_York'), dayLengthMin('2026-11-01', 'America/New_York'), dayLengthMin('2026-03-29', 'America/New_York')]).toEqual([1380, 1500, 1440]);
  });

  it('UTC : jamais de changement', () => {
    expect(['2026-03-29', '2026-10-25'].map((d) => dayLengthMin(d, 'UTC'))).toEqual([1440, 1440]);
  });

  it('les minuits des deux côtés du changement sont les bons instants', () => {
    expect(startOfDay('2026-03-29', PARIS)).toBe(Z('2026-03-28T23:00:00Z')); // +1
    expect(startOfDay('2026-03-30', PARIS)).toBe(Z('2026-03-29T22:00:00Z')); // +2
    expect(startOfDay('2026-10-25', PARIS)).toBe(Z('2026-10-24T22:00:00Z')); // +2
    expect(startOfDay('2026-10-26', PARIS)).toBe(Z('2026-10-25T23:00:00Z')); // +1
  });
});

describe('découpe par jour (passage de minuit)', () => {
  const total = (parts: ReturnType<typeof splitByDay>): number => parts.reduce((t, p) => t + p.minutes, 0);

  it('une nuit de 20 h 30 à 6 h 30 donne deux parts, une par jour, qui font exactement la durée', () => {
    const a = Z('2026-11-09T19:30:00Z'), b = Z('2026-11-10T05:30:00Z');
    const parts = splitByDay(a, b, PARIS);
    expect(parts.map((p) => [p.day, p.minutes])).toEqual([['2026-11-09', 210], ['2026-11-10', 390]]);
    expect(total(parts)).toBe((b - a) / 60_000);
    expect(parts[0]!.to).toBe(parts[1]!.from);
  });

  it('la nuit du passage à l’heure d’hiver dure une heure de plus : rien n’est perdu', () => {
    const a = Z('2026-10-24T20:00:00Z'), b = Z('2026-10-25T07:00:00Z'); // 22:00 → 08:00 heure locale
    const parts = splitByDay(a, b, PARIS);
    expect(parts.map((p) => [p.day, p.minutes])).toEqual([['2026-10-24', 120], ['2026-10-25', 540]]);
    expect(total(parts)).toBe(660);
  });

  it('la nuit du passage à l’heure d’été dure une heure de moins', () => {
    const a = Z('2026-03-28T21:00:00Z'), b = Z('2026-03-29T06:00:00Z'); // 22:00 → 08:00 heure locale
    expect(total(splitByDay(a, b, PARIS))).toBe(540);
  });

  it('un sommeil qui finit pile à minuit n’ouvre pas de part vide le lendemain', () => {
    const parts = splitByDay(Z('2026-11-09T21:00:00Z'), startOfDay('2026-11-10', PARIS), PARIS);
    expect(parts.map((p) => [p.day, p.minutes])).toEqual([['2026-11-09', 120]]);
  });

  it('un sommeil qui commence pile à minuit reste dans le jour qui s’ouvre', () => {
    const m = startOfDay('2026-11-10', PARIS);
    expect(splitByDay(m, m + 3 * 3_600_000, PARIS).map((p) => [p.day, p.minutes])).toEqual([['2026-11-10', 180]]);
  });

  it('plusieurs minuits : une part par jour traversé', () => {
    const parts = splitByDay(Z('2026-11-09T10:00:00Z'), Z('2026-11-11T22:30:00Z'), PARIS);
    expect(parts.map((p) => [p.day, p.minutes])).toEqual([['2026-11-09', 780], ['2026-11-10', 1440], ['2026-11-11', 1410]]);
    expect(total(parts)).toBe(3630);
  });

  it('le même sommeil, deux fuseaux : la coupure change, la durée non', () => {
    const a = Z('2026-11-09T21:30:00Z'), b = Z('2026-11-10T00:30:00Z'); // 22 h 30 → 1 h 30 à Paris, 16 h 30 → 19 h 30 à New York
    const paris = splitByDay(a, b, PARIS), ny = splitByDay(a, b, 'America/New_York');
    expect(paris.length).toBe(2);
    expect(ny.length).toBe(1);
    expect(total(paris)).toBe(total(ny));
  });

  it('un intervalle vide ou inversé ne crée ni durée négative ni part inventée', () => {
    const t = Z('2026-11-10T10:00:00Z');
    expect(splitByDay(t, t, PARIS)).toEqual([{ day: '2026-11-10', from: t, to: t, minutes: 0 }]);
    expect(splitByDay(t, t - 3_600_000, PARIS)[0]!.minutes).toBe(0);
  });
});
