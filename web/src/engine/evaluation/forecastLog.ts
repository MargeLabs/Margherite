// Journal local des fenêtres de dodo réellement affichées. Il donne, avec le temps, la seule mesure qui compte :
// la fenêtre montrée à la famille contenait-elle le dodo qui a suivi ? Rien ne quitte l'appareil, aucune donnée du journal n'est modifiée.
// Niveau de preuve : R1 à partir de ~30 décisions sur plusieurs jours ; avant, c'est une anecdote.
import type { EngineEvent } from '../types';
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
}

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

/** Une entrée par réveil : si la fenêtre change pour ce réveil (le journal a changé), la dernière affichée remplace l'ancienne. */
export function recordForecast(store: KeyValueStore, e: LoggedForecast): void {
  try {
    const log = readLog(store).filter((x) => x.wake !== e.wake);
    log.push(e);
    log.sort((a, b) => a.wake - b.wake);
    store.setItem(LOG_KEY, JSON.stringify(log.slice(-LOG_CAP)));
  } catch {
    /* stockage plein ou refusé : le journal de mesure n'est jamais bloquant */
  }
}

/** Le dodo qui a réellement suivi chaque réveil. Sans dodo encore : en attente, jamais un raté. */
export function resolveLog(log: LoggedForecast[], events: EngineEvent[]): { predictions: Prediction[]; pending: number } {
  const starts = events.filter((e) => e.kind === 'sleep').map((e) => e.start).sort((a, b) => a - b);
  const predictions: Prediction[] = [];
  let pending = 0;
  for (const f of log) {
    const next = starts.find((s) => s > f.wake);
    if (next === undefined) pending++;
    else predictions.push({ at: f.wake, actual: next, window: { from: f.from, to: f.to } });
  }
  return { predictions, pending };
}

export function liveScore(store: KeyValueStore, events: EngineEvent[]): { score: Score; pending: number; days: number } {
  const { predictions, pending } = resolveLog(readLog(store), events);
  return { score: score(predictions), pending, days: new Set(predictions.map((p) => Math.floor(p.at / 86_400_000))).size };
}
