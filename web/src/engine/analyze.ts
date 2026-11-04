// Le contrat de résultats : tout ce que le moteur sait, structuré, explicable, sans interface. Rien ne l'appelle depuis un écran.
// Le moteur n'émet que des observations, des hypothèses, des prévisions et des références : jamais de recommandation.
import { describeNextFeed } from './feeding/nextFeed';
import { feedingMode } from './feeding/mode';
import { METRICS, type MetricKey } from './habits/periods';
import { habitsModel } from './index';
import { getReference } from './knowledge/getReference';
import type { DayTags } from './patterns/transversal';
import { assessQuality, type QualityReport } from './quality';
import { CURRENT_RULES } from './rules';
import { DAY_MIN } from './sleep/timeline';
import type { EngineInput, Finding, FindingKind, FindingStatus } from './types';
import { ENGINE_VERSION } from './version';

export const CONTRACT_VERSION = 1;

/** Le sommeil total sur 24 h est le seul indicateur qui a une plage publiée ; hors des âges couverts, rien. */
function ageReferences(babyId: string, ageDays: number | null): { findings: Finding[]; version: string | null } {
  const r = getReference('sleep_total_24h', ageDays);
  if (!r) return { findings: [], version: null };
  return {
    version: r.baseVersion,
    findings: [{
      id: 'ref_sleep_total_24h', babyId, kind: 'reference', status: 'stable', reliability: { n: 0, basis: 'published_statistics', measured: false },
      facts: [{ code: 'age_reference', params: { low: r.range.low, high: r.range.high, unit: r.unit, confidence: r.confidence } }],
      limits: ['group_statistic_not_a_target', ...r.limits, 'owner_waiver_no_professional_review'], sources: r.sources.map((s) => s.id), engineVersion: ENGINE_VERSION,
    }],
  };
}

export interface EngineReport {
  contractVersion: number;
  engineVersion: string;
  knowledgeVersion: string | null;
  babyId: string;
  generatedAt: number;
  ageDays: number | null;
  feedingMode: ReturnType<typeof feedingMode>['mode'];
  dataQuality: QualityReport;
  habits: Finding[];
  forecasts: Finding[];
  evolutions: Finding[];
  associations: Finding[];
  comparisons: Finding[];
  /** vide tant qu'aucune référence n'a passé la relecture professionnelle */
  references: Finding[];
}

const clock = (m: number): string => `${Math.floor((m % DAY_MIN) / 60)}:${String(Math.round(m % DAY_MIN) % 60).padStart(2, '0')}`;
const round5 = (m: number) => Math.round(m / 5) * 5;

export function analyze(input: EngineInput, now: number, tags: DayTags = {}): EngineReport {
  const first = input.events.reduce((a, e) => Math.min(a, e.start), now);
  const history = Math.max(27, Math.ceil((now - first) / 86_400_000) + 1); // tout l'historique, pas la fenêtre de l'écran
  const m = habitsModel(input, now, CURRENT_RULES, history);
  const base = { babyId: input.babyId, engineVersion: ENGINE_VERSION };
  const make = (id: string, kind: FindingKind, status: FindingStatus, n: number, basis: string, facts: Finding['facts'], limits: string[]): Finding => ({ ...base, id, kind, status, reliability: { n, basis, measured: false }, facts, limits });

  const habits: Finding[] = [];
  const typ = m.typical;
  if (typ.ok) {
    habits.push(make('usual_wake', 'observation', 'stable', typ.n, 'complete_days_last_7', [{ code: 'usual_wake', params: { time: clock(round5(typ.wake)), days: typ.n } }], ['median_not_a_target']));
    habits.push(make('usual_bedtime', 'observation', 'stable', typ.n, 'complete_days_last_7', [{ code: 'usual_bedtime', params: { time: clock(round5(typ.bed)), days: typ.n } }], ['median_not_a_target']));
    typ.naps.forEach((z) => habits.push(make(`usual_nap_${z.k}`, 'observation', 'stable', z.n, 'complete_days_last_7', [{ code: 'usual_nap_rank', params: { rank: z.k + 1, time: clock(round5(z.a)), duration: round5(z.du) } }], ['median_not_a_target', 'aligned_by_rank'])));
  } else habits.push({ ...make('usual_day', 'observation', 'insufficient', typ.n, 'complete_days_last_7', [], []), abstained: { reason: 'too_few_days' } });
  const un = m.usual(m.timeline.today);
  if (un.ok) habits.push(make('usual_night', 'observation', 'stable', un.n, 'complete_nights_last_7', [{ code: 'usual_night', params: { bed: clock(round5(un.bed)), wake: clock(round5(un.wake)), wakings: un.wk, nights: un.n } }], ['median_not_a_target', 'periods_not_biological_cycles']));
  else habits.push({ ...make('usual_night', 'observation', 'insufficient', un.n, 'complete_nights_last_7', [], []), abstained: { reason: 'too_few_days' } });

  const evolutions = m.evolutions().map((e) => make(`evolution_${e.key}`, 'observation', e.status, e.points, 'complete_days_all_history', [{ code: 'evolution', params: { indicator: e.key, status: e.status, points: e.points } }], ['descriptive_only']));

  const links = m.dayToNight(tags);
  const associations = links.items.filter((x) => x.retained).map((x) => make(`link_${x.factor}_${x.outcome}`, 'hypothesis', 'trend', x.n, 'complete_nights_all_history', [{ code: 'association', params: { factor: x.factor, outcome: x.outcome, n: x.n, effect: Math.round(x.effect), q: Number(x.q.toFixed(3)) } }], ['association_not_cause', 'unobserved_confounders']));
  if (!links.enough) associations.push({ ...make('links', 'hypothesis', 'insufficient', links.nights, 'complete_nights_all_history', [], []), abstained: { reason: 'too_few_days' } });

  const comparisons = (Object.keys(METRICS) as MetricKey[]).map((k) => {
    const s = m.period(k, 7);
    return s.ok && s.okP
      ? make(`period_${k}`, 'observation', s.dir === 0 ? 'stable' : 'trend', s.n, 'last_7_vs_previous_7', [{ code: 'period_change', params: { indicator: k, current: Math.round(s.vc ?? 0), previous: Math.round(s.vp ?? 0), days: 7 } }], ['descriptive_only'])
      : { ...make(`period_${k}`, 'observation', 'insufficient', s.n, 'last_7_vs_previous_7', [], []), abstained: { reason: 'too_few_days' as const } };
  });

  const refs = ageReferences(input.babyId, m.ageDays);
  return {
    contractVersion: CONTRACT_VERSION, engineVersion: ENGINE_VERSION, knowledgeVersion: refs.version, babyId: input.babyId, generatedAt: now, ageDays: m.ageDays,
    feedingMode: feedingMode(input.events, now).mode, dataQuality: assessQuality(input.events, now),
    habits, forecasts: [m.nextSleep, describeNextFeed(input.babyId, input, now)], evolutions, associations, comparisons, references: refs.findings,
  };
}
