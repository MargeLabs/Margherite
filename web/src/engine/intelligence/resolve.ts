// Hiérarchie de secours : on essaie les modèles dans l'ordre, le premier qui rend une fenêtre valide et cohérente sert.
// Un modèle qui ne répond pas, lève une erreur ou rend une distribution invalide ne bloque jamais les suivants,
// et la raison de chaque échec est gardée (jamais une prévision inventée quand personne ne peut répondre).
import type { Window } from '../predictions/baselines';

const MIN = 60_000;

/** Pourquoi un modèle n'a pas servi. Les codes du modèle lui-même (données insuffisantes, non entraînable…) passent tels quels. */
export type AttemptOutcome = 'used' | 'no_answer' | 'error' | 'invalid_window' | 'window_too_wide' | 'incoherent' | (string & {});
export interface Attempt {
  model: string;
  outcome: AttemptOutcome;
}

export interface ResolveOptions {
  /** instant de la prévision : une fenêtre entièrement passée est invalide */
  now: number;
  /** largeur maximale en minutes ; null : pas de limite */
  maxWidthMin: number | null;
  /** code d'un modèle qui n'a pas répondu (ex. `insufficient_data`) ; sinon `no_answer` */
  explain?: (model: string) => string | null;
  /** contrôle de cohérence d'un modèle avec la situation réelle (ex. un créneau habituel qui ferait trop attendre) */
  coherent?: (model: string, w: Window) => boolean;
}

export interface Resolved {
  model: string | null;
  window: Window | null;
  attempts: Attempt[];
}

const valid = (w: Window, now: number): boolean => Number.isFinite(w.from) && Number.isFinite(w.to) && w.to > w.from && w.to >= now;

export function resolveForecast(order: string[], ask: (model: string) => Window | null, o: ResolveOptions): Resolved {
  const attempts: Attempt[] = [], seen = new Set<string>();
  for (const model of order) {
    if (seen.has(model)) continue;
    seen.add(model);
    let w: Window | null;
    try {
      w = ask(model);
    } catch {
      attempts.push({ model, outcome: 'error' });
      continue;
    }
    if (!w) {
      attempts.push({ model, outcome: o.explain?.(model) ?? 'no_answer' });
      continue;
    }
    if (!valid(w, o.now)) {
      attempts.push({ model, outcome: 'invalid_window' });
      continue;
    }
    if (o.maxWidthMin !== null && (w.to - w.from) / MIN > o.maxWidthMin) {
      attempts.push({ model, outcome: 'window_too_wide' });
      continue;
    }
    if (o.coherent && !o.coherent(model, w)) {
      attempts.push({ model, outcome: 'incoherent' });
      continue;
    }
    attempts.push({ model, outcome: 'used' });
    return { model, window: w, attempts };
  }
  return { model: null, window: null, attempts };
}
