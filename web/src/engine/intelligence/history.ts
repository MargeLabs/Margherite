// Historique des modèles : à chaque jour et pour chaque cible, quel modèle a servi, pourquoi, et ce qu'il valait sur le passé du bébé.
// C'est la trace qui permet de vérifier plus tard qu'un modèle n'a été promu que sur une mesure. Local à l'appareil, jamais bloquant.
import type { KeyValueStore } from '../evaluation/forecastLog';
import type { Basis, TargetId } from './targets';
import type { IntelligenceReport } from './run';

export interface HistoryEntry {
  /** jour (jours depuis 1970) : une entrée par cible et par jour, la dernière évaluation du jour fait foi */
  day: number;
  at: number;
  engine: string;
  target: TargetId;
  chosen: string;
  reference: string;
  basis: Basis;
  decisions: number;
  answered: number;
  coverage: number | null;
  interval: number | null;
  referenceInterval: number | null;
}

export const HISTORY_KEY = 'canaille.modelhistory.v1';
export const HISTORY_CAP = 400;

export function readHistory(store: KeyValueStore): HistoryEntry[] {
  try {
    const raw = store.getItem(HISTORY_KEY), v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as HistoryEntry[]).filter((x) => typeof x?.day === 'number' && typeof x.target === 'string') : [];
  } catch {
    return [];
  }
}

export function recordHistory(store: KeyValueStore, r: IntelligenceReport): void {
  try {
    const day = Math.floor(r.generatedAt / 86_400_000), log = readHistory(store);
    for (const c of r.evaluation) {
      const pick = (m: string) => c.evaluations.find((e) => e.model === m), me = pick(c.chosen), ref = pick(c.reference);
      const e: HistoryEntry = { day, at: r.generatedAt, engine: r.engineVersion, target: c.target, chosen: c.chosen, reference: c.reference, basis: c.basis, decisions: c.decisions, answered: me?.answered ?? 0, coverage: me?.coverage ?? null, interval: me?.intervalScoreMin ?? null, referenceInterval: ref?.intervalScoreMin ?? null };
      const i = log.findIndex((x) => x.day === day && x.target === c.target);
      if (i >= 0) log[i] = e;
      else log.push(e);
    }
    store.setItem(HISTORY_KEY, JSON.stringify(log.sort((a, b) => a.day - b.day).slice(-HISTORY_CAP)));
  } catch {
    /* stockage plein ou refusé */
  }
}
