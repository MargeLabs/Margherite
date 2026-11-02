// Autour de quand il a souvent mangé : une description probabiliste de ses journées, jamais une heure de repas.
// Ce résultat ne doit jamais servir à retarder, espacer ou limiter un repas : sa faim passe avant.
import { threshold } from '../config';
import { weightedQuantile } from '../predictions/models';
import type { Forecaster } from '../predictions/baselines';
import type { EngineEvent, Finding } from '../types';
import { ENGINE_VERSION } from '../version';

const MIN = 60_000, DAY = 86_400_000;
const isFeed = (e: EngineEvent) => e.kind === 'bottle' || e.kind === 'breast';
const part = (t: number) => Math.floor(new Date(t).getHours() / 6);

/** Repas séparés, en regroupant les tétées rapprochées : ces écarts-là ne disent rien de son rythme. */
export function feedTimes(events: EngineEvent[]): number[] {
  const t = events.filter(isFeed).map((e) => e.start).sort((a, b) => a - b);
  return t.filter((x, i) => i === 0 || x - (t[i - 1] ?? 0) > threshold('feedClusterMin') * MIN);
}

export const nextFeedWindow: Forecaster = ({ events }, now) => {
  const times = feedTimes(events).filter((t) => t >= now - threshold('modelHistoryDays') * DAY), last = times[times.length - 1];
  if (last === undefined) return null;
  const gaps = times.slice(1).map((t, i) => ({ at: times[i] ?? 0, min: (t - (times[i] ?? 0)) / MIN })).filter((g) => g.min <= threshold('mealGapMax'));
  const same = gaps.filter((g) => part(g.at) === part(last));
  const use = same.length >= threshold('modelMinGaps') ? same : gaps;
  if (use.length < threshold('modelMinGaps')) return null;
  const v = use.map((g) => ({ v: g.min, w: 0.5 ** ((now - g.at) / (7 * DAY)) }));
  return { from: last + weightedQuantile(v, 0.1) * MIN, to: last + weightedQuantile(v, 0.9) * MIN };
};

export function describeNextFeed(babyId: string, input: { birthAt: number | null; events: EngineEvent[] }, now: number): Finding {
  const w = nextFeedWindow(input, now);
  const base = { id: 'feed_rhythm', babyId, kind: 'forecast' as const, reliability: { n: feedTimes(input.events).length, basis: 'recent_feeds', measured: false }, limits: ['descriptive_only', 'not_a_schedule', 'coverage_not_measured'], engineVersion: ENGINE_VERSION };
  if (!w) return { ...base, status: 'insufficient', facts: [], abstained: { reason: 'too_few_days' } };
  return { ...base, status: 'stable', window: { ...w, coverage: null }, facts: [{ code: 'often_fed_around', params: {} }] };
}
