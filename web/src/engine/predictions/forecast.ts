// Prochain dodo, en résultat structuré : une fenêtre et ses limites, ou une abstention motivée. Un fait, jamais une consigne.
import { threshold } from '../config';
import type { TypicalDay } from '../habits/typical';
import type { Timeline } from '../sleep/timeline';
import type { AbstentionReason, Finding } from '../types';
import { ENGINE_VERSION } from '../version';
import type { SleepWindow } from './sleepWindows';

interface Model {
  babyId: string;
  timeline: Timeline;
  typical: TypicalDay;
  windows: SleepWindow[];
}

const finding = (m: Model, extra: Partial<Finding>, n: number): Finding => ({
  id: 'next_sleep', babyId: m.babyId, kind: 'forecast', status: 'insufficient',
  reliability: { n, basis: 'complete_days_last_7', measured: false },
  facts: [], limits: ['clock_based', 'coverage_not_measured'], engineVersion: ENGINE_VERSION, ...extra,
});

export function forecastNextSleep(m: Model): Finding {
  const tl = m.timeline, n = m.typical.n;
  const no = (reason: AbstentionReason) => finding(m, { abstained: { reason } }, n);
  if (tl.running !== null) return no('asleep');
  if (!m.typical.ok) return no('too_few_days');
  const last = tl.events[tl.events.length - 1], stale = threshold('gapMinutes');
  if (!last || tl.now - Math.max(last.a, last.b ?? 0) > stale) return no('data_gap');
  const w = m.windows[0];
  if (!w) return no('no_window');
  if (w.b - w.a > threshold('forecastMaxWidth')) return no('window_too_wide');
  const toMs = (t: number) => new Date(tl.origin.getFullYear(), tl.origin.getMonth(), tl.origin.getDate(), 0, t).getTime();
  return finding(m, { status: 'stable', window: { from: toMs(w.a), to: toMs(w.b), coverage: null }, facts: [{ code: w.bed ? 'usual_bedtime' : w.few ? 'usual_nap_some_days' : 'usual_nap', params: { days: n } }] }, n);
}
