// Contrat d'entrée et de sortie du moteur. Aucune dépendance à l'interface, à la base ni au temps courant :
// les heures sont des millisecondes UTC, `now` est toujours passé en paramètre.

export type EngineEventKind = 'sleep' | 'bottle' | 'breast' | 'diaper';

export interface EngineEvent {
  id: string;
  kind: EngineEventKind;
  start: number;
  /** fin d'un sommeil ; absente tant que le chrono tourne */
  end?: number;
  ml?: number;
  milk?: string;
  side?: 'G' | 'D';
  durationMin?: number | null;
  /** moment où l'événement est entré dans le journal ; absent si inconnu */
  enteredAt?: number;
  /** moment où la fin du sommeil a été connue (dernière modification de la ligne) */
  endKnownAt?: number;
}

export interface EngineInput {
  babyId: string;
  /** naissance ; null si inconnue : l'âge n'est alors jamais deviné */
  birthAt: number | null;
  events: EngineEvent[];
}

/** Niveau de preuve d'un chiffre : ils ne se confondent jamais. */
export type EvidenceLevel = 'R0' | 'T' | 'R1' | 'R2' | 'P' | 'E';

export type AbstentionReason = 'too_few_days' | 'recent_break' | 'no_reference' | 'age_unknown' | 'window_too_wide' | 'data_gap' | 'asleep' | 'no_window' | 'no_reliable_forecast';

export type FindingKind = 'observation' | 'hypothesis' | 'forecast' | 'reference';
export type FindingStatus = 'stable' | 'trend' | 'one_off' | 'break' | 'insufficient';

/** Socle commun des résultats. Des faits et des codes, jamais de phrase toute faite ni de genre supposé. */
export interface Finding {
  id: string;
  babyId: string;
  kind: FindingKind;
  status: FindingStatus;
  window?: { from: number; to: number; coverage: number | null };
  reliability: { n: number; basis: string; measured: boolean };
  facts: Array<{ code: string; params: Record<string, number | string> }>;
  limits: string[];
  sources?: string[];
  abstained?: { reason: AbstentionReason };
  engineVersion: string;
}
