// Canaille Intelligence : le seul point d'entrée. Observe (journal) → apprend (profil) → comprend (analyze) → anticipe (prévisions) →
// explique (faits et limites, jamais de phrase ni de conseil) → s'améliore (le modèle qui sert est celui qui a gagné sur le passé du bébé).
// Pur : même journal + même `now` = même résultat. Aucun LLM, aucun réseau, aucun stockage.
import { ageBand } from '../evaluation/diagnostics';
import { analyze, type EngineReport } from '../analyze';
import { visibleAt } from '../evaluation/backtest';
import { threshold } from '../config';
import type { Evolution } from '../habits/evolution';
import type { AbstentionReason, EngineEvent, EngineInput } from '../types';
import { ENGINE_VERSION } from '../version';
import { feedTimes } from '../feeding/nextFeed';
import { lastWakeAt } from '../predictions/models';
import { learnProfile, wallToMs } from './learn';
import { around, evaluateTarget, TARGETS, type Basis, type Choice, type TargetId } from './targets';

export type Mode = 'journal' | 'degraded';
export type View = (events: EngineEvent[], at: number) => EngineEvent[];

export interface Capability {
  feature: string;
  /** vrai : impossible sans la migration 0004 */
  needsJournal: boolean;
  degraded: string;
}

/** Ce qui exige vraiment le journal 0004, et ce que le moteur fait sans lui. */
export const CAPABILITIES: Capability[] = [
  { feature: 'predictions_and_understanding', needsJournal: false, degraded: 'complet : le journal n’entre pas dans le calcul' },
  { feature: 'continuous_evaluation_on_own_history', needsJournal: false, degraded: 'journal tel qu’il est aujourd’hui, reconstruit par date de saisie (enteredAt, endKnownAt) : approximatif' },
  { feature: 'exact_replay_by_watermark', needsJournal: true, degraded: 'impossible : une correction ou une suppression d’hier est déjà dans le passé rejoué' },
  { feature: 'corrections_and_deletions_seen_by_models', needsJournal: true, degraded: 'ignorées : une saisie supprimée disparaît de l’évaluation' },
  { feature: 'entry_source_timer_live_later', needsJournal: true, degraded: 'déduite du délai de saisie (≤ 10 min = suivi en direct)' },
  { feature: 'provenance_weighting', needsJournal: true, degraded: 'toutes les lignes pèsent pareil' },
  { feature: 'prospective_log_with_watermark', needsJournal: true, degraded: 'prévisions notées sans watermark : relecture de leur contexte exact impossible' },
];

export interface Confidence {
  level: 'measured' | 'unmeasured';
  basis: Basis;
  /** réponses du modèle servi sur ses dernières décisions */
  n: number;
  coverage: number | null;
  /** codes, jamais de phrase */
  why: string[];
}

export interface IntelPrediction {
  target: TargetId;
  model: string;
  /** shown : l'écran affiche ce résultat ; shadow : calculé et noté, sans emplacement à l'écran */
  status: 'shown' | 'shadow' | 'abstained';
  unit: 'instant' | 'duration';
  /** ce à quoi la prévision se rattache : dernier réveil (dodo et coucher), début du dodo en cours, dernier repas ; null s'il n'y en a pas (sert à la noter) */
  anchor: number | null;
  window: { from: number; to: number } | null;
  confidence: Confidence;
  abstained?: { reason: AbstentionReason };
  limits: string[];
}

export interface IntelligenceReport {
  engineVersion: string;
  generatedAt: number;
  mode: Mode;
  capabilities: Capability[];
  context: { ageDays: number | null; ageBand: string; note: 'context_not_target' };
  profile: { completeDays: number; nights: number; breaks: string[] };
  /** séries qui ne sont ni stables ni trop courtes : tendances, écarts isolés, ruptures */
  changes: Evolution[];
  predictions: IntelPrediction[];
  evaluation: Choice[];
  understanding: EngineReport | null;
}

export interface Options {
  mode?: Mode;
  /** journal reconstruit exactement (migration 0004) ; sinon reconstruction par date de saisie */
  view?: View;
  /** inclut l'analyse complète (habitudes, évolutions, associations) : coûteuse, hors du rendu de l'écran */
  understand?: boolean;
  /** restreint le calcul à ces cibles */
  targets?: TargetId[];
}

/** Séries d'évolution qui, si elles rompent, rendent le passé moins représentatif de chaque cible. */
const SERIES: Record<TargetId, string[]> = { nap_start: ['naps', 'napMinutes'], bedtime: ['bedtime'], nap_duration: ['napMinutes'], feed: ['feeds'] };
/** Seules ces cibles ont un emplacement à l'écran aujourd'hui. */
const DISPLAYED: Record<TargetId, boolean> = { nap_start: true, bedtime: true, nap_duration: false, feed: false };

const memo = new Map<string, Choice>();
const fingerprint = (input: Pick<EngineInput, 'birthAt' | 'events'>, now: number, mode: Mode): string => {
  const e = input.events;
  return [mode, input.birthAt, e.length, Math.max(0, ...e.map((x) => x.start)), e.reduce((s, x) => s + ((x.end ?? 0) % 1e7), 0), Math.floor(now / 86_400_000)].join('|');
};

function choose(id: TargetId, input: Pick<EngineInput, 'birthAt' | 'events'>, now: number, mode: Mode, view?: View): Choice {
  const key = `${id}|${fingerprint(input, now, mode)}`, known = memo.get(key);
  if (known) return known;
  const c = evaluateTarget(id, input, now, view ?? visibleAt);
  if (memo.size > 32) memo.clear();
  memo.set(key, c);
  return c;
}

export function runIntelligence(input: EngineInput, now: number, opts: Options = {}): IntelligenceReport {
  const mode = opts.mode ?? 'degraded', prof = learnProfile(input, now);
  const ids = opts.targets ?? (Object.keys(TARGETS) as TargetId[]);
  const evaluation = ids.map((id) => choose(id, input, now, mode, opts.view));
  const predictions = evaluation.map((c): IntelPrediction => {
    const def = TARGETS[c.target], ev = c.evaluations.find((e) => e.model === c.chosen);
    const limits = ['coverage_not_measured_live', ...(SERIES[c.target].some((s) => prof.breaks.includes(s)) ? ['recent_break'] : []), ...(mode === 'degraded' ? ['evaluation_approximate'] : ['evaluation_journal_by_date'])];
    const confidence: Confidence = { level: c.basis === 'measured_better' ? 'measured' : 'unmeasured', basis: c.basis, n: ev?.answered ?? 0, coverage: ev?.coverage ?? null, why: [c.basis === 'unmeasured' ? 'not_measured_yet' : c.basis, ...(prof.completeDays < 3 ? ['few_days'] : [])] };
    const anchor = c.target === 'nap_start' ? lastWakeAt(input.events) : c.target === 'bedtime' ? lastWakeAt(input.events) : c.target === 'nap_duration' ? (prof.tl.running !== null ? wallToMs(prof.tl, prof.tl.running) : null) : (feedTimes(input.events).pop() ?? null);
    const base = { target: c.target, anchor, unit: c.target === 'nap_duration' ? 'duration' as const : 'instant' as const, confidence, limits };
    const ask = (name: string) => def.models[name]?.({ birthAt: input.birthAt, events: input.events }, now) ?? null;
    let model = c.chosen, w = ask(model);
    if (!w && model !== c.reference) {
      model = c.reference;
      w = ask(model);
    }
    const abstain = (reason: AbstentionReason): IntelPrediction => ({ ...base, model, status: 'abstained', window: null, abstained: { reason } });
    if (!w) return abstain(c.target === 'nap_start' && prof.tl.running !== null ? 'asleep' : prof.completeDays < 3 ? 'too_few_days' : 'no_window');
    if (def.maxWidthMin !== null && (w.to - w.from) / 60_000 > def.maxWidthMin) return abstain('window_too_wide');
    return { ...base, model, status: DISPLAYED[c.target] ? 'shown' : 'shadow', window: around(w.from, w.to) };
  });
  return {
    engineVersion: ENGINE_VERSION, generatedAt: now, mode, capabilities: CAPABILITIES,
    context: { ageDays: prof.ageDays, ageBand: ageBand(prof.ageDays), note: 'context_not_target' },
    profile: { completeDays: prof.completeDays, nights: prof.beds.length, breaks: prof.breaks },
    changes: prof.evolutions.filter((e) => e.status !== 'stable' && e.status !== 'insufficient'),
    predictions, evaluation,
    understanding: opts.understand ? analyze(input, now) : null,
  };
}

/** Le seuil de jours en dessous duquel rien n'est annoncé comme régulier : réexporté pour que les écrans n'inventent pas le leur. */
export const minDaysForHabit = (): number => threshold('habitDays');
