// Historique des modèles : à chaque jour et pour chaque cible, quel modèle a servi, pourquoi, ce qu'il valait au rejeu et en vrai.
// C'est aussi la mémoire de la règle de stabilité : un nouveau modèle ne remplace celui qui sert qu'après avoir gagné plusieurs jours de suite.
// Local à l'appareil, jamais bloquant.
import { threshold } from '../config';
import type { KeyValueStore, LiveSummary } from '../evaluation/forecastLog';
import type { Basis, Choice, LiveCheck, TargetId } from './targets';
import type { IntelligenceReport } from './run';

/**
 * first_choice : rien d'enregistré avant sur cet appareil. unmeasured_default : rien de mesuré, modèle par défaut.
 * kept : même modèle que la veille. switch_pending : un autre modèle gagne, pas encore assez de jours.
 * switch_confirmed : il a gagné assez de jours de suite. demoted_replay / demoted_live : retour immédiat à la référence,
 * parce que le modèle fait pire au rejeu ou sur les fenêtres réellement affichées.
 */
export type SwitchReason = 'first_choice' | 'unmeasured_default' | 'kept' | 'switch_pending' | 'switch_confirmed' | 'demoted_replay' | 'demoted_live';

export interface Stable {
  chosen: string;
  reason: SwitchReason;
  /** modèle qui gagne au rejeu sans être encore confirmé */
  candidate: string | null;
  /** modèle qui servait le dernier jour enregistré */
  previous: string | null;
}

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
  /** rejeu historique du modèle servi */
  answered: number;
  coverage: number | null;
  interval: number | null;
  referenceInterval: number | null;
  reason?: SwitchReason;
  candidate?: string | null;
  previous?: string | null;
  /** fenêtres réellement affichées (toutes, quel que soit le modèle) : jamais confondues avec le rejeu */
  live?: LiveSummary | null;
  liveCheck?: LiveCheck | null;
}

export const HISTORY_KEY = 'canaille.modelhistory.v1';
export const HISTORY_CAP = 400;

/**
 * Règle de stabilité. Vers la référence (le calcul habituel), on va tout de suite : c'est le sens prudent.
 * Vers un autre modèle, il faut qu'il soit le meilleur au rejeu `switchConfirmDays` jours de suite ; en attendant, le modèle actuel reste
 * s'il bat encore la référence, sinon c'est la référence.
 */
export function stabilize(c: Choice, live: LiveCheck | null, history: HistoryEntry[], day: number): Stable {
  const past = history.filter((h) => h.target === c.target && h.day < day).sort((a, b) => a.day - b.day);
  const prev = past[past.length - 1]?.chosen ?? null;
  const out = (chosen: string, reason: SwitchReason, candidate: string | null = null): Stable => ({ chosen, reason, candidate, previous: prev });
  if (live?.worse) return out(c.reference, 'demoted_live');
  if (c.basis === 'unmeasured') return out(c.chosen, prev === null ? 'first_choice' : prev === c.chosen ? 'kept' : 'unmeasured_default');
  if (c.basis === 'measured_worse') return out(c.reference, prev === null ? 'first_choice' : prev === c.reference ? 'kept' : 'demoted_replay');
  if (prev === c.chosen) return out(prev, 'kept');
  const need = threshold('switchConfirmDays') - 1, recent = past.slice(-need);
  const confirmed = recent.length === need && recent.every((h, i) => h.candidate === c.chosen && h.day === day - (need - i));
  if (confirmed) return out(c.chosen, 'switch_confirmed');
  const keep = prev !== null && (prev === c.reference || c.better.includes(prev)) ? prev : c.reference;
  return out(keep, 'switch_pending', c.chosen);
}

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
      const e: HistoryEntry = {
        day, at: r.generatedAt, engine: r.engineVersion, target: c.target, chosen: c.chosen, reference: c.reference, basis: c.basis, decisions: c.decisions,
        answered: me?.answered ?? 0, coverage: me?.coverage ?? null, interval: me?.intervalScoreMin ?? null, referenceInterval: ref?.intervalScoreMin ?? null,
        reason: c.reason, candidate: c.candidate, previous: c.previous, live: c.live, liveCheck: c.liveCheck,
      };
      const i = log.findIndex((x) => x.day === day && x.target === c.target);
      if (i >= 0) log[i] = e;
      else log.push(e);
    }
    store.setItem(HISTORY_KEY, JSON.stringify(log.sort((a, b) => a.day - b.day).slice(-HISTORY_CAP)));
  } catch {
    /* stockage plein ou refusé */
  }
}
