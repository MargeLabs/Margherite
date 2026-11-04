import { threshold } from '../config';
import type { EngineEvent } from '../types';

export type IssueCode = 'duplicate' | 'overlap' | 'sleep_too_long' | 'open_too_long' | 'bottle_too_large' | 'in_future' | 'end_before_start';
export interface QualityIssue {
  code: IssueCode;
  ids: string[];
}

export interface DayQuality {
  /** jour local, AAAA-MM-JJ */
  day: string;
  events: number;
  hasSleep: boolean;
  hasFeed: boolean;
  /** plus long intervalle sans aucun événement dans la journée ; null s'il y a moins de deux événements */
  longestGapMin: number | null;
  /** changement d'heure ce jour-là : une durée en heure murale y est fausse d'une heure */
  dstShift: boolean;
}

export interface QualityReport {
  issues: QualityIssue[];
  /** seulement les jours notés : un jour sans note n'est jamais un jour à zéro */
  days: DayQuality[];
  /** délai de saisie ; null si la date de saisie n'est pas connue */
  entryDelay: { n: number; medianMin: number; p90Min: number; lateShare: number } | null;
}

const MIN = 60_000;
const dayKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function hasDstShift(t: number): boolean {
  const d = new Date(t);
  const at = (h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTimezoneOffset();
  return at(0) !== at(23);
}

const quantile = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

export function assessQuality(events: EngineEvent[], now: number): QualityReport {
  const issues: QualityIssue[] = [];
  const sorted = events.slice().sort((a, b) => a.start - b.start);

  sorted.forEach((e, i) => {
    if (e.start > now) issues.push({ code: 'in_future', ids: [e.id] });
    if (e.end !== undefined && e.end < e.start) issues.push({ code: 'end_before_start', ids: [e.id] });
    if (e.kind === 'sleep' && e.end !== undefined && e.end - e.start > threshold('qualitySleepMaxMin') * MIN) issues.push({ code: 'sleep_too_long', ids: [e.id] });
    if (e.kind === 'sleep' && e.end === undefined && now - e.start > threshold('qualityOpenSleepMaxMin') * MIN) issues.push({ code: 'open_too_long', ids: [e.id] });
    if (e.kind === 'bottle' && (e.ml ?? 0) > threshold('qualityBottleMaxMl')) issues.push({ code: 'bottle_too_large', ids: [e.id] });
    for (let j = i + 1; j < sorted.length; j++) {
      const o = sorted[j];
      if (!o || o.start - e.start >= threshold('qualityDuplicateMin') * MIN) break;
      if (o.kind === e.kind) issues.push({ code: 'duplicate', ids: [e.id, o.id] });
    }
  });

  const sleeps = sorted.filter((e) => e.kind === 'sleep');
  sleeps.forEach((e, i) => {
    const next = sleeps[i + 1];
    if (next && (e.end ?? now) > next.start) issues.push({ code: 'overlap', ids: [e.id, next.id] });
  });

  const byDay = new Map<string, EngineEvent[]>();
  sorted.forEach((e) => {
    const k = dayKey(e.start);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  });
  const days = [...byDay.entries()].map(([day, list]): DayQuality => {
    let longest: number | null = null;
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      if (prev && cur) longest = Math.max(longest ?? 0, Math.round((cur.start - (prev.end ?? prev.start)) / MIN));
    }
    return { day, events: list.length, hasSleep: list.some((e) => e.kind === 'sleep'), hasFeed: list.some((e) => e.kind === 'bottle' || e.kind === 'breast'), longestGapMin: longest, dstShift: hasDstShift(list[0]?.start ?? 0) };
  });

  const delays = sorted.filter((e) => e.enteredAt !== undefined).map((e) => ((e.enteredAt ?? 0) - e.start) / MIN).sort((a, b) => a - b);
  const entryDelay = delays.length
    ? { n: delays.length, medianMin: Math.round(quantile(delays, 0.5)), p90Min: Math.round(quantile(delays, 0.9)), lateShare: delays.filter((d) => d > threshold('qualityLateEntryMin')).length / delays.length }
    : null;

  return { issues, days, entryDelay };
}

export interface DomainCoverage {
  days: number;
  sleepDays: number;
  feedDays: number;
  bothDays: number;
  /** jours sans aucun événement : non notés, jamais comptés comme « rien mangé, rien dormi » */
  unnotedDays: number;
}

/** Jours notés par domaine sur les `lastDays` jours qui précèdent le jour de `now` (aujourd'hui exclu, il n'est pas fini). */
export function domainCoverage(events: EngineEvent[], now: number, lastDays: number): DomainCoverage {
  const today = new Date(now), sleep = new Set<string>(), feed = new Set<string>(), any = new Set<string>();
  for (const e of events) {
    const k = dayKey(e.start);
    any.add(k);
    if (e.kind === 'sleep') sleep.add(k);
    if (e.kind === 'bottle' || e.kind === 'breast') feed.add(k);
  }
  const keys = Array.from({ length: lastDays }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - lastDays + i).getTime()));
  return { days: lastDays, sleepDays: keys.filter((k) => sleep.has(k)).length, feedDays: keys.filter((k) => feed.has(k)).length, bothDays: keys.filter((k) => sleep.has(k) && feed.has(k)).length, unnotedDays: keys.filter((k) => !any.has(k)).length };
}
