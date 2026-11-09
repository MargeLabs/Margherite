// Journal des fenêtres que CHAQUE modèle du prochain dodo aurait proposées à chaque réveil, affichées ou non.
// C'est la mesure en direct de tous les candidats (y compris ceux qui ne servent pas encore) : sans elle, un modèle n'est jugé que par un rejeu.
// Local à l'appareil comme le journal des fenêtres affichées, jamais bloquant ; il part dans la sauvegarde du Profil pour la remodélisation.
import type { EngineEvent } from '../types';
import { outcomesOf, type KeyValueStore, type LoggedForecast, type Outcome } from './forecastLog';

export const SHADOW_KEY = 'canaille.shadowlog.v1';
/** ~9 modèles × 6 réveils par jour = ~55 modèles-fenêtres par jour : 400 réveils ≈ deux mois, quelques centaines de Ko */
export const SHADOW_CAP = 400;

export interface ShadowEntry {
  /** réveil qui précède le dodo prévu */
  wake: number;
  /** premier calcul après ce réveil : la fenêtre n'est jamais remplacée (une prévision prospective ne se réécrit pas) */
  shownAt: number;
  engine: string;
  /** modèle ou logique dont la fenêtre était réellement présentée à ce moment-là (`recommendation` pour une recommandation) ; null : aucune */
  served: string | null;
  /** nombre de siestes déjà faites aujourd'hui : le rang de la prochaine */
  rank?: number | null;
  /** ce que l'écran présentait : une prévision, une recommandation, ou rien */
  display?: 'forecast' | 'recommendation' | null;
  /** la fenêtre finalement présentée [de, à] */
  shown?: [number, number] | null;
  /** la prévision disponible (modèle de la hiérarchie), même si une recommandation l'a remplacée à l'écran */
  forecast?: { model: string; window: [number, number] } | null;
  /** la recommandation calculée et ce sur quoi elle repose */
  recommendation?: { window: [number, number]; confidence: string; spans: number; nEff: number; days: number; trend: string | null } | null;
  /** fenêtre de chaque modèle [de, à] en ms ; null = il n'a pas répondu */
  windows: Record<string, [number, number] | null>;
}

export function readShadow(store: KeyValueStore): ShadowEntry[] {
  try {
    const raw = store.getItem(SHADOW_KEY), v: unknown = raw ? JSON.parse(raw) : [];
    return readShadowRaw(v);
  } catch {
    return [];
  }
}

/** Les entrées valides d'un tableau venu d'une sauvegarde (jamais de supposition sur son contenu). */
export function readShadowRaw(v: unknown): ShadowEntry[] {
  return Array.isArray(v) ? (v as ShadowEntry[]).filter((x) => typeof x?.wake === 'number' && typeof x.shownAt === 'number' && x.windows && typeof x.windows === 'object') : [];
}

export function recordShadow(store: KeyValueStore, e: ShadowEntry): void {
  try {
    const log = readShadow(store);
    if (log.some((x) => x.wake === e.wake)) return;
    log.push(e);
    log.sort((a, b) => a.wake - b.wake);
    store.setItem(SHADOW_KEY, JSON.stringify(log.slice(-SHADOW_CAP)));
  } catch {
    /* stockage plein ou refusé : jamais bloquant */
  }
}

/** Résultat de chaque modèle à chaque réveil, par le même calcul que les fenêtres affichées (dedans / trop tôt / trop tard / en attente). */
export function shadowOutcomes(entries: ShadowEntry[], events: EngineEvent[]): Record<string, Outcome[]> {
  const byModel: Record<string, LoggedForecast[]> = {};
  for (const e of entries) {
    for (const [model, w] of Object.entries(e.windows)) {
      if (!w) continue;
      (byModel[model] ??= []).push({ wake: e.wake, from: w[0], to: w[1], shownAt: e.shownAt, model, engine: e.engine, target: 'nap_start' });
    }
  }
  return Object.fromEntries(Object.entries(byModel).map(([m, log]) => [m, outcomesOf(log, events, 'nap_start')]));
}
