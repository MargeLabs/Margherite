// Journal local des fenêtres de dodo réellement affichées. Il donne, avec le temps, la seule mesure qui compte :
// la fenêtre montrée à la famille contenait-elle le dodo qui a suivi ? Rien ne quitte l'appareil, aucune donnée du journal n'est modifiée.
// Niveau de preuve : R1 à partir de ~30 décisions sur plusieurs jours ; avant, c'est une anecdote.
import type { EngineEvent } from '../types';
import { threshold } from '../config';
import { TARGETS, type TargetId } from '../intelligence/targets';
import { score, type Prediction, type Score } from './backtest';

export interface LoggedForecast {
  /** réveil qui précède le dodo prévu : l'identifiant de la prévision */
  wake: number;
  from: number;
  to: number;
  /** dernier moment où cette fenêtre a été affichée */
  shownAt: number;
  model: string;
  engine: string;
  /** ce qui était prévu ; absent = prochain dodo (entrées d'avant l'intelligence individuelle) */
  target?: TargetId;
  /** dernier numéro du journal 0004 connu au moment de l'affichage ; null ou absent : journal non disponible */
  watermark?: number | null;
}

const targetOf = (f: LoggedForecast): TargetId => f.target ?? 'nap_start';

export const LOG_KEY = 'canaille.forecastlog.v1';
export const LOG_CAP = 300;

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function readLog(store: KeyValueStore): LoggedForecast[] {
  try {
    const raw = store.getItem(LOG_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as LoggedForecast[]).filter((x) => typeof x?.wake === 'number' && typeof x.from === 'number' && typeof x.to === 'number') : [];
  } catch {
    return [];
  }
}

/** Une entrée par (cible, ancre) : la dernière fenêtre affichée remplace l'ancienne, sauf `keepFirst` (la première fait foi : coucher, durée, repas). */
export function recordForecast(store: KeyValueStore, e: LoggedForecast, opts: { keepFirst?: boolean } = {}): void {
  try {
    const log = readLog(store), same = (x: LoggedForecast) => x.wake === e.wake && targetOf(x) === targetOf(e);
    if (opts.keepFirst && log.some(same)) return;
    const next = log.filter((x) => !same(x));
    next.push(e);
    next.sort((a, b) => a.wake - b.wake);
    store.setItem(LOG_KEY, JSON.stringify(next.slice(-LOG_CAP)));
  } catch {
    /* stockage plein ou refusé : le journal de mesure n'est jamais bloquant */
  }
}

const ANCHOR_TOLERANCE = 30 * 60_000;
const MIN = 60_000;

/**
 * inside / early / late : un vrai résultat. Les trois autres ne sont jamais comptés comme des ratés :
 * pending = pas encore de résultat ; unobserved = le journal ne permet pas de savoir (trou de saisie) ;
 * not_prospective = la fenêtre a été affichée après le résultat (saisie tardive ou correction), ce n'était plus une prévision.
 */
export type OutcomeStatus = 'inside' | 'early' | 'late' | 'pending' | 'unobserved' | 'not_prospective';
export interface Outcome {
  target: TargetId;
  model: string;
  wake: number;
  shownAt: number;
  from: number;
  to: number;
  status: OutcomeStatus;
  /** instant réel (ou durée réelle pour la durée de sieste) ; null sans résultat */
  actual: number | null;
  /** écart à la fenêtre, en minutes : négatif = avant, positif = après, 0 = dedans ; null sans résultat */
  errorMin: number | null;
}

/** Résultat de chaque prévision affichée, recalculé sur le journal tel qu'il est maintenant : une correction ou une suppression change le résultat, jamais l'entrée. */
export function outcomesOf(log: LoggedForecast[], events: EngineEvent[], target: TargetId = 'nap_start'): Outcome[] {
  // doublons (même cible, même ancre) : la dernière entrée fait foi, comme à l'enregistrement
  const mine = [...new Map(log.filter((f) => targetOf(f) === target).map((f) => [f.wake, f])).values()].sort((a, b) => a.wake - b.wake);
  const starts = events.filter((e) => e.kind === 'sleep').map((e) => e.start).sort((a, b) => a - b);
  const def = TARGETS[target], decs = target === 'nap_start' ? [] : def.decisions(events);
  return mine.map((f): Outcome => {
    const base = { target, model: f.model, wake: f.wake, shownAt: f.shownAt, from: f.from, to: f.to };
    let actual: number | null = null, known = 0;
    if (target === 'nap_start') {
      const next = starts.find((s) => s > f.wake);
      if (next !== undefined && next - f.wake > threshold('baselineMaxAwake') * MIN) return { ...base, status: 'unobserved', actual: null, errorMin: null };
      if (next !== undefined) actual = known = next;
    } else {
      const d = def.resolve ? def.resolve(f.wake, events) : decs.find((x) => x.at >= f.wake - MIN && x.at - f.wake < ANCHOR_TOLERANCE);
      if (d) {
        actual = d.actual;
        known = target === 'nap_duration' ? f.wake + d.actual : d.actual;
      }
    }
    if (actual === null) return { ...base, status: 'pending', actual: null, errorMin: null };
    if (f.shownAt > known) return { ...base, status: 'not_prospective', actual, errorMin: null };
    const errorMin = actual < f.from ? -Math.round((f.from - actual) / MIN) : actual > f.to ? Math.round((actual - f.to) / MIN) : 0;
    return { ...base, status: errorMin < 0 ? 'early' : errorMin > 0 ? 'late' : 'inside', actual, errorMin };
  });
}

const RESOLVED = new Set<OutcomeStatus>(['inside', 'early', 'late']);

/** Ce qui s'est réellement passé après chaque prévision. Sans résultat encore : en attente, jamais un raté. */
export function resolveLog(log: LoggedForecast[], events: EngineEvent[], target: TargetId = 'nap_start'): { predictions: Prediction[]; pending: number } {
  const o = outcomesOf(log, events, target);
  return {
    predictions: o.filter((x) => RESOLVED.has(x.status)).map((x) => ({ at: x.wake, actual: x.actual as number, window: { from: x.from, to: x.to } })),
    pending: o.filter((x) => x.status === 'pending').length,
  };
}

export interface LiveSummary {
  /** prévisions affichées avec un vrai résultat */
  n: number;
  inside: number;
  early: number;
  late: number;
  pending: number;
  unobserved: number;
  notProspective: number;
  /** part dans la fenêtre ; null sans résultat */
  coverage: number | null;
  medianMissMin: number | null;
  days: number;
}

export function summarize(o: Outcome[]): LiveSummary {
  const r = o.filter((x) => RESOLVED.has(x.status)), c = (s: OutcomeStatus) => o.filter((x) => x.status === s).length;
  const miss = r.map((x) => Math.abs(x.errorMin ?? 0)).sort((a, b) => a - b);
  return {
    n: r.length, inside: c('inside'), early: c('early'), late: c('late'), pending: c('pending'), unobserved: c('unobserved'), notProspective: c('not_prospective'),
    coverage: r.length ? c('inside') / r.length : null, medianMissMin: miss.length ? miss[Math.floor(miss.length / 2)]! : null,
    days: new Set(r.map((x) => Math.floor(x.wake / 86_400_000))).size,
  };
}

export function liveScore(store: KeyValueStore, events: EngineEvent[], target: TargetId = 'nap_start'): { score: Score; pending: number; days: number } {
  const { predictions, pending } = resolveLog(readLog(store), events, target);
  return { score: score(predictions), pending, days: new Set(predictions.map((p) => Math.floor(p.at / 86_400_000))).size };
}
