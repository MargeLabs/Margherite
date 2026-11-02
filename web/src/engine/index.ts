// Point d'entrée du moteur. Même journal + même `now` = même résultat, sur téléphone, en test ou sur un serveur.
import { compareToHabit, sleepWindows } from './predictions/sleepWindows';
import { periodStat, type MetricKey } from './habits/periods';
import { typicalDay, usualNight } from './habits/typical';
import { evaluateLinks, linkFactors, linkRows, type FactorKey, type OutcomeKey } from './patterns/links';
import { createCalendar } from './sleep/calendar';
import { ageInDays } from './age';
import { coverage } from './habits/coverage';
import { associations } from './patterns/associations';
import { dayTypes } from './patterns/dayTypes';
import { daySequences, frequentMotifs, transitions } from './patterns/sequences';
import { awakeToNapLinks, dayToNightLinks, type DayTags } from './patterns/transversal';
import { evolutions } from './habits/evolution';
import { forecastNextSleep } from './predictions/forecast';
import { CURRENT_RULES, type Rules } from './rules';
import { buildTimeline } from './sleep/timeline';
import type { EngineInput } from './types';
import { ENGINE_VERSION } from './version';

export function habitsModel(input: EngineInput, now: number, rules: Rules = CURRENT_RULES, historyDays?: number) {
  const tl = buildTimeline(input.events, now, historyDays);
  const cal = createCalendar(tl, rules);
  const typ = typicalDay(tl, cal);
  const rows = linkRows(tl, cal);
  const fx = linkFactors(rows);
  const model = {
    babyId: input.babyId,
    engineVersion: ENGINE_VERSION,
    ageDays: ageInDays(input.birthAt, now),
    timeline: tl,
    calendar: cal,
    typical: typ,
    usual: (d: number) => usualNight(tl, cal, d),
    windows: sleepWindows(tl, cal, typ),
    compare: (a: number, b: number | null, id: string | null) => compareToHabit(tl, cal, typ, a, b, id, rules),
    period: (k: MetricKey, p: number) => periodStat(tl, cal, k, p),
    linkRows: rows,
    links: (f: FactorKey[], o: OutcomeKey[], r = rows) => evaluateLinks(fx, f, o, r),
    associations: (f: FactorKey[], o: OutcomeKey[]) => associations(rows, f, o),
    coverage: (days: number) => coverage(tl, cal, days),
    dayToNight: (tags?: DayTags) => dayToNightLinks(tl, cal, tags),
    awakeToNap: () => awakeToNapLinks(tl, cal),
    dayTypes: () => dayTypes(tl, cal),
    motifs: () => {
      const days = daySequences(tl, cal);
      return { motifs: frequentMotifs(days), transitions: transitions(days), days: days.length };
    },
    evolutions: () => evolutions(tl, cal),
  };
  return { ...model, nextSleep: forecastNextSleep(model) };
}
