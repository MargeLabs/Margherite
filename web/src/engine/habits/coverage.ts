// Ce qui est noté sur une période. Politique : un manque n'est jamais un zéro ; une nuit ou une journée incomplète sort du calcul, elle ne le fausse pas.
import { win, type Calendar } from '../sleep/calendar';
import type { Timeline } from '../sleep/timeline';

export interface Coverage {
  days: number;
  completeDays: number;
  completeNights: number;
  partialNights: number;
  absentNights: number;
}

export function coverage(tl: Timeline, cal: Calendar, lastDays: number): Coverage {
  const range = win(tl.today - lastDays, tl.today - 1);
  const nights = range.map((d) => cal.nightOf(d + 1).st);
  return { days: range.length, completeDays: range.filter((d) => cal.dayOf(d).complete).length, completeNights: nights.filter((s) => s === 'ok').length, partialNights: nights.filter((s) => s === 'partiel').length, absentNights: nights.filter((s) => s === 'absent').length };
}
