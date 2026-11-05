// Apprentissage individuel : un seul passage sur le journal produit le profil que tous les modèles partagent.
// Le profil est recalculé à chaque changement du journal (aucun état caché) : même journal + même `now` = même profil.
// L'âge est un contexte transmis, jamais un seuil ni un objectif.
import { threshold } from '../config';
import { ageInDays } from '../age';
import { evolutions, type Evolution } from '../habits/evolution';
import { typicalDay, type TypicalDay } from '../habits/typical';
import { CURRENT_RULES, type Rules } from '../rules';
import { createCalendar, win, type Calendar } from '../sleep/calendar';
import { buildTimeline, DAY_MIN, type Timeline } from '../sleep/timeline';
import type { EngineEvent } from '../types';

const DAY = 86_400_000;

/** Minutes murales du profil → instant réel. */
export const wallToMs = (tl: Timeline, t: number): number => new Date(tl.origin.getFullYear(), tl.origin.getMonth(), tl.origin.getDate(), 0, t).getTime();

export interface NapSample {
  day: number;
  /** rang dans la journée, de 0 */
  k: number;
  /** début, minutes depuis minuit */
  start: number;
  /** étendue du bloc, minutes */
  dur: number;
}

export interface BedSample {
  /** jour de la soirée */
  day: number;
  /** coucher, minutes depuis minuit de ce jour (peut dépasser 1440) */
  rel: number;
  /** dernier réveil avant ce coucher (fin du dernier sommeil de la journée), minutes depuis minuit de ce jour */
  lastWake: number;
  /** siestes de la journée */
  naps: number;
}

export interface Profile {
  now: number;
  ageDays: number | null;
  tl: Timeline;
  cal: Calendar;
  typ: TypicalDay;
  naps: NapSample[];
  beds: BedSample[];
  evolutions: Evolution[];
  /** séries où une rupture est détectée : les anciens jours y comptent moins */
  breaks: string[];
  /** poids d'un jour : décroît avec l'ancienneté ; la demi-vie raccourcit si l'une des séries données a rompu */
  weight(day: number, ...series: string[]): number;
  completeDays: number;
}

export function learnProfile(input: { birthAt: number | null; events: EngineEvent[] }, now: number, rules: Rules = CURRENT_RULES): Profile {
  const first = input.events.reduce((a, e) => Math.min(a, e.start), now);
  const history = Math.min(120, Math.max(27, Math.ceil((now - first) / DAY) + 1));
  const tl = buildTimeline(input.events, now, history), cal = createCalendar(tl, rules), typ = typicalDay(tl, cal);
  const naps: NapSample[] = [];
  win(0, tl.today).forEach((d) => cal.dayOf(d).naps.forEach((z, k) => naps.push({ day: d, k, start: z.a - d * DAY_MIN, dur: z.b - z.a })));
  const beds: BedSample[] = [];
  win(1, tl.today).forEach((d) => {
    const n = cal.nightOf(d);
    if (n.bed === undefined || n.st === 'absent' || n.startUnobserved) return;
    const e = d - 1, ends = tl.sleeps.filter((z) => z.b >= e * DAY_MIN && z.b < n.bed!).map((z) => z.b);
    if (ends.length) beds.push({ day: e, rel: n.bed - e * DAY_MIN, lastWake: Math.max(...ends) - e * DAY_MIN, naps: cal.dayOf(e).naps.length });
  });
  const evo = evolutions(tl, cal), breaks = evo.filter((x) => x.status === 'break').map((x) => x.key);
  const weight = (day: number, ...series: string[]) => 0.5 ** ((tl.today - day) / threshold(series.some((s) => breaks.includes(s)) ? 'learnHalfLifeBreak' : 'learnHalfLife'));
  return { now, ageDays: ageInDays(input.birthAt, now), tl, cal, typ, naps, beds, evolutions: evo, breaks, weight, completeDays: typ.n };
}
