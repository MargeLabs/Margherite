// Règle d'activation : aucun modèle sans gain mesuré sur des données jamais vues. Le synthétique ne peut jamais valider.
import { threshold } from '../config';
import type { EvidenceLevel } from '../types';
import { pairedGain, score, type Prediction } from './backtest';

const DAY = 86_400_000;

/** Calibration conforme, sur le seul passé déjà connu à chaque instant : on élargit (ou resserre) jusqu'à couvrir la cible. */
export function conformal(preds: Prediction[], target = 0.8): Prediction[] {
  const history = threshold('conformalHistory'), min = threshold('conformalMinCases');
  return preds.map((p, i) => {
    if (!p.window) return p;
    const scores = preds.slice(0, i).filter((q) => q.window && q.actual <= p.at).slice(-history).map((q) => Math.max((q.window?.from ?? 0) - q.actual, q.actual - (q.window?.to ?? 0))).sort((a, b) => a - b);
    if (scores.length < min) return { ...p, window: null };
    const k = Math.min(scores.length - 1, Math.ceil((scores.length + 1) * target) - 1), s = scores[k] ?? 0;
    return { ...p, window: { from: p.window.from - s, to: p.window.to + s } };
  });
}

export type Verdict = 'retained' | 'rejected' | 'not_enough_data' | 'mechanics_only';

export interface ModelDecision {
  verdict: Verdict;
  why: string;
  holdoutDays: number;
  gain: number | null;
  low: number | null;
  coverage: number | null;
}

export function holdout(preds: Prediction[]): Prediction[] {
  const first = preds[0]?.at, last = preds[preds.length - 1]?.at;
  if (first === undefined || last === undefined) return [];
  const span = last - first, cut = last - Math.max(span * threshold('holdoutShare'), threshold('holdoutMinDays') * DAY);
  return cut > first ? preds.filter((p) => p.at >= cut) : [];
}

export function decide(candidate: Prediction[], reference: Prediction[], level: EvidenceLevel, target = 0.8): ModelDecision {
  const a = holdout(candidate), b = holdout(reference);
  const days = new Set(a.map((p) => Math.floor(p.at / DAY))).size;
  const g = pairedGain(a, b);
  const s = score(a), r = score(b);
  const out = { holdoutDays: days, gain: g?.gain ?? null, low: g?.low ?? null, coverage: s.coverage };
  if (level === 'T') return { ...out, verdict: 'mechanics_only', why: 'données synthétiques : aucune activation possible' };
  if (level === 'R0' || days < threshold('holdoutMinDays') || !g) return { ...out, verdict: 'not_enough_data', why: 'période de test trop courte' };
  if (g.gain < threshold('gainMin') || g.low <= 0) return { ...out, verdict: 'rejected', why: 'gain insuffisant ou incertain' };
  if (s.coverage === null || Math.abs(s.coverage - target) > threshold('coverageTolerance')) return { ...out, verdict: 'rejected', why: 'fenêtre mal calibrée' };
  if ((s.medianWidthMin ?? 0) > (r.medianWidthMin ?? 0) * threshold('widthMaxRatio')) return { ...out, verdict: 'rejected', why: 'fenêtre trop large' };
  return { ...out, verdict: 'retained', why: 'gain mesuré sur données jamais vues' };
}

/** Arbitre par bébé : le modèle retenu ne sert que s'il bat la référence sur son passé récent ; sinon, repli sur le calcul simple. */
export function arbiter(candidate: Prediction[], reference: Prediction[], now: number): 'model' | 'fallback' {
  const since = now - threshold('modelHistoryDays') * DAY;
  const recent = (p: Prediction[]) => p.filter((x) => x.at >= since && x.actual <= now);
  const a = score(recent(candidate)), r = score(recent(reference));
  if (a.answered < threshold('conformalMinCases') || r.answered < threshold('conformalMinCases')) return 'fallback';
  return (a.intervalScoreMin ?? Infinity) < (r.intervalScoreMin ?? 0) ? 'model' : 'fallback';
}

export const MODEL_REGISTRY = [
  { id: 'current-wins', status: 'production', note: 'plage habituelle, référence à battre' },
  { id: 'weighted-awake', status: 'candidate', note: 'quantiles pondérés des éveils' },
  { id: 'kalman-awake', status: 'candidate', note: 'Kalman à niveau local' },
  { id: 'bayes-awake', status: 'candidate', note: 'Normale-Gamma inverse, a priori plat' },
  { id: 'survival', status: 'candidate', note: 'survie à temps discret, structure S + C réduite' },
  { id: 'hsmm', status: 'not_built', note: 'semi-markovien : trop de paramètres sans données, à ouvrir au niveau R2 si les autres plafonnent' },
] as const;

