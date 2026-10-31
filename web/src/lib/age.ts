import { calendarDays } from './time';

export interface Age {
  days: number;
  /** « 9 semaines », « 9 semaines et 2 jours », « 5 jours », « 4 mois »… */
  text: string;
  /** Âge court pour un titre : « 9 semaines ». */
  short: string;
}

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 && !word.endsWith('s') ? 's' : ''}`;

/** Âge du bébé. Les 14 premiers jours en jours, puis en semaines (jusqu'à 16), puis en mois ; le nombre total de jours n'est pas affiché. */
export function ageOf(birth: Date, now: Date): Age {
  const days = Math.max(0, calendarDays(birth, now));
  if (days < 14) {
    const t = days === 0 ? 'Né aujourd’hui' : plural(days, 'jour');
    return { days, text: t, short: t };
  }
  const weeks = Math.floor(days / 7);
  if (weeks < 17) {
    const rest = days % 7;
    const base = plural(weeks, 'semaine');
    return { days, text: `${base}${rest ? ` et ${plural(rest, 'jour')}` : ''}`, short: base };
  }
  const months = Math.floor(days / 30.4375);
  const t = plural(months, 'mois');
  return { days, text: t, short: t };
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « Né le mardi 25 août à 8:42 » (l'année s'ajoute au-delà de 5 mois). */
export function bornText(birth: Date, now: Date): string {
  const withYear = calendarDays(birth, now) > 150;
  const wd = WEEKDAYS[birth.getDay()] ?? '';
  const mo = MONTHS[birth.getMonth()] ?? '';
  return `Né le ${wd} ${birth.getDate()} ${mo}${withYear ? ` ${birth.getFullYear()}` : ''} à ${birth.getHours()}:${String(birth.getMinutes()).padStart(2, '0')}`;
}


