// Journal local des fenêtres de dodo réellement affichées. Il donne, avec le temps, la seule mesure qui compte :
// la fenêtre montrée à la famille contenait-elle le dodo qui a suivi ? Rien ne quitte l'appareil, aucune donnée du journal n'est modifiée.
// Niveau de preuve : R1 à partir de ~30 décisions sur plusieurs jours ; avant, c'est une anecdote.
import type { EngineEvent } from '../types';
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

/** Ce qui s'est réellement passé après chaque prévision. Sans résultat encore : en attente, jamais un raté. */
export function resolveLog(log: LoggedForecast[], events: EngineEvent[], target: TargetId = 'nap_start'): { predictions: Prediction[]; pending: number } {
  const mine = log.filter((f) => targetOf(f) === target), predictions: Prediction[] = [];
  let pending = 0;
  if (target === 'nap_start') {
    const starts = events.filter((e) => e.kind === 'sleep').map((e) => e.start).sort((a, b) => a - b);
    for (const f of mine) {
      const next = starts.find((s) => s > f.wake);
      if (next === undefined) pending++;
      else predictions.push({ at: f.wake, actual: next, window: { from: f.from, to: f.to } });
    }
    return { predictions, pending };
  }
  const def = TARGETS[target], decs = def.decisions(events);
  for (const f of mine) {
    const d = def.resolve ? def.resolve(f.wake, events) : decs.find((x) => x.at >= f.wake - 60_000 && x.at - f.wake < ANCHOR_TOLERANCE);
    if (!d) pending++;
    else predictions.push({ at: f.wake, actual: d.actual, window: { from: f.from, to: f.to } });
  }
  return { predictions, pending };
}

export function liveScore(store: KeyValueStore, events: EngineEvent[], target: TargetId = 'nap_start'): { score: Score; pending: number; days: number } {
  const { predictions, pending } = resolveLog(readLog(store), events, target);
  return { score: score(predictions), pending, days: new Set(predictions.map((p) => Math.floor(p.at / 86_400_000))).size };
}
