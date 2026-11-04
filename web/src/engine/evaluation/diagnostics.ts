// Diagnostics ajoutés au banc : calibration, strates d'âge et d'historique, journaux troués, détection de rupture.
// Ils s'ajoutent aux métriques de `backtest.ts` sans les remplacer : les anciens rapports restent comparables.
import { ageInDays } from '../age';
import { classifySeries } from '../rhythm/change';
import type { EngineEvent } from '../types';
import { rng, syntheticLog, SCENARIOS } from './synthetic';
import { score, type Prediction, type Score } from './backtest';

const DAY = 86_400_000;

/**
 * Une fenêtre à 80 % dit : « 8 fois sur 10 le dodo commence dedans ». On note cette probabilité annoncée contre ce qui s'est passé.
 * Brier : (0,8 − dedans)². Log loss : −ln de la probabilité donnée à ce qui s'est passé. Un modèle calibré minimise les deux.
 */
export function windowProbabilityScores(preds: Prediction[], nominal = 0.8): { n: number; brier: number; logLoss: number } | null {
  const ok = preds.filter((p) => p.window);
  if (!ok.length) return null;
  let b = 0, l = 0;
  for (const p of ok) {
    const hit = p.window && p.actual >= p.window.from && p.actual <= p.window.to ? 1 : 0;
    b += (nominal - hit) ** 2;
    l += -Math.log(hit ? nominal : 1 - nominal);
  }
  return { n: ok.length, brier: b / ok.length, logLoss: l / ok.length };
}

export interface CalibrationBin {
  /** largeur médiane de la fenêtre du groupe, en minutes */
  widthMin: number;
  n: number;
  coverage: number;
}

/** Courbe de calibration par largeur : les fenêtres étroites tiennent-elles autant que les larges ? Groupes de tailles égales. */
export function calibrationByWidth(preds: Prediction[], bins = 3): CalibrationBin[] {
  const ok = preds.filter((p): p is Prediction & { window: { from: number; to: number } } => p.window !== null).sort((a, b) => a.window.to - a.window.from - (b.window.to - b.window.from));
  if (ok.length < bins * 2) return [];
  const out: CalibrationBin[] = [];
  for (let i = 0; i < bins; i++) {
    const g = ok.slice(Math.floor((i * ok.length) / bins), Math.floor(((i + 1) * ok.length) / bins));
    const w = g.map((p) => (p.window.to - p.window.from) / 60_000);
    out.push({ widthMin: Math.round(w[Math.floor(w.length / 2)] ?? 0), n: g.length, coverage: g.filter((p) => p.actual >= p.window.from && p.actual <= p.window.to).length / g.length });
  }
  return out;
}

/** Jours de journal déjà vus à l'instant de la décision (sans regarder après). */
export function historyDaysAt(events: EngineEvent[], at: number): number {
  const first = events.reduce((m, e) => (e.start <= at ? Math.min(m, e.start) : m), at);
  return Math.floor((at - first) / DAY);
}

export const historyBand = (days: number): string => (days < 4 ? '0–3 j' : days < 8 ? '4–7 j' : days < 15 ? '8–14 j' : '15 j et +');
/** Tranches d'âge descriptives pour lire le banc ; ce ne sont pas des normes. */
export const ageBand = (ageDays: number | null): string => (ageDays === null ? 'âge inconnu' : ageDays < 30 ? '< 1 mois' : ageDays < 90 ? '1–3 mois' : ageDays < 180 ? '3–6 mois' : '6 mois et +');

export function stratify(preds: Prediction[], label: (p: Prediction) => string): Array<{ label: string; score: Score }> {
  const groups = new Map<string, Prediction[]>();
  for (const p of preds) groups.set(label(p), [...(groups.get(label(p)) ?? []), p]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([l, g]) => ({ label: l, score: score(g) }));
}

export const byHistory = (events: EngineEvent[]) => (p: Prediction): string => historyBand(historyDaysAt(events, p.at));
export const byAge = (birthAt: number | null) => (p: Prediction): string => ageBand(ageInDays(birthAt, p.at));

/** Journal troué à dessein : retire une part des événements (graine fixe). Un manque reste un manque, jamais un zéro. */
export function dropEvents(events: EngineEvent[], share: number, seed = 1): EngineEvent[] {
  const r = rng(seed);
  return events.filter(() => r() >= share);
}

// ---------- détection de rupture ----------

export interface DetectionStudy {
  /** séries avec une vraie rupture */
  withBreak: number;
  /** séries stables */
  stable: number;
  /** ruptures annoncées à juste titre, après le vrai jour */
  detected: number;
  /** annonces de rupture avant le vrai jour, ou sur une série stable */
  falseAlarms: number;
  recall: number | null;
  precision: number | null;
  /** jours entre la vraie rupture et son annonce, médiane */
  medianDelayDays: number | null;
}

/** Nombre de siestes par jour, du jour 0 au dernier jour complet : la série sur laquelle on cherche une rupture. */
export function napCounts(events: EngineEvent[], from: Date, days: number): number[] {
  const t0 = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Array.from({ length: days }, (_, d) => events.filter((e) => e.kind === 'sleep' && e.start >= t0 + d * DAY + 7 * 3_600_000 && e.start < t0 + d * DAY + 19 * 3_600_000).length);
}

/** Premier jour où la série, lue jusqu'à ce jour, est déclarée en rupture. */
export function firstBreakDay(series: number[]): number | null {
  for (let d = 1; d <= series.length; d++) if (classifySeries(series.slice(0, d)) === 'break') return d - 1;
  return null;
}

/** 20 graines avec rupture au jour 14, 20 sans : précision, rappel, délai. Synthétique : mécanique seulement, jamais une preuve. */
export function detectionStudy(seeds = 20, days = 28, breakDay = 14): DetectionStudy {
  const from = new Date(2026, 8, 1), base = SCENARIOS.rupture!;
  const { breakDay: _unused, ...calmBase } = base;
  let detected = 0, falseAlarms = 0;
  const delays: number[] = [];
  for (let s = 0; s < seeds; s++) {
    const withB = napCounts(syntheticLog({ ...base, seed: 100 + s, from, days, breakDay }), from, days);
    const d = firstBreakDay(withB);
    if (d === null) { /* raté */ } else if (d >= breakDay) { detected++; delays.push(d - breakDay); } else falseAlarms++;
    const calm = napCounts(syntheticLog({ ...calmBase, seed: 500 + s, from, days }), from, days);
    if (firstBreakDay(calm) !== null) falseAlarms++;
  }
  const sorted = delays.sort((a, b) => a - b);
  return {
    withBreak: seeds, stable: seeds, detected, falseAlarms,
    recall: seeds ? detected / seeds : null,
    precision: detected + falseAlarms ? detected / (detected + falseAlarms) : null,
    medianDelayDays: sorted.length ? (sorted[Math.floor(sorted.length / 2)] ?? null) : null,
  };
}
