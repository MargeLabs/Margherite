// Mode d'alimentation déduit des repas notés, sans saisie. Une tétée n'a jamais de volume : dès qu'il y en a une, aucun total de lait sur 24 h.
import { threshold } from '../config';
import type { EngineEvent } from '../types';

export type FeedingMode = 'breast' | 'bottle' | 'mixed' | 'unknown';

const DAY = 86_400_000;

export function feedingMode(events: EngineEvent[], now: number): { mode: FeedingMode; breast: number; bottle: number } {
  const since = now - threshold('feedingModeDays') * DAY;
  const feeds = events.filter((e) => e.start >= since && e.start <= now);
  const breast = feeds.filter((e) => e.kind === 'breast').length, bottle = feeds.filter((e) => e.kind === 'bottle').length, n = breast + bottle;
  if (n < threshold('feedingModeMinFeeds')) return { mode: 'unknown', breast, bottle };
  const share = threshold('feedingModeExclusive');
  return { mode: breast / n >= share ? 'breast' : bottle / n >= share ? 'bottle' : 'mixed', breast, bottle };
}

/** Lait au biberon sur une journée. Le total n'existe que sans aucune tétée ; un jour sans repas noté n'est pas un jour à zéro. */
export function bottleMilk(dayEvents: EngineEvent[]): { bottleMl: number | null; total24hMl: number | null } {
  const bottles = dayEvents.filter((e) => e.kind === 'bottle'), breast = dayEvents.some((e) => e.kind === 'breast');
  if (!bottles.length || bottles.some((e) => e.ml === undefined)) return { bottleMl: null, total24hMl: null };
  const ml = bottles.reduce((t, e) => t + (e.ml as number), 0);
  return { bottleMl: ml, total24hMl: breast ? null : ml };
}
