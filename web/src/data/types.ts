// Contrat entre la base de données et la logique de vue portée de la maquette V5.
// La logique manipule des « événements » en minutes depuis l'origine (voir lib/time.ts) ; la base stocke des horodatages.

export type EventKind = 'bib' | 'sein' | 'sleep' | 'chg';
export type Side = 'G' | 'D';

/** Un événement tel que la logique de la maquette le lit : `a` = début, `b` = fin (dodo), en minutes depuis l'origine. */
export interface ViewEvent {
  id: string;
  k: EventKind;
  a: number;
  b?: number;
  ml?: number;
  lait?: string;
  side?: Side;
  dur?: number | null;
  v?: string;
}

/** Ligne de la table `events`. */
export interface EventRow {
  id: string;
  kind: EventKind;
  started_at: string;
  ended_at: string | null;
  payload: EventPayload;
}

export interface EventPayload {
  ml?: number;
  lait?: string;
  side?: Side;
  dur?: number | null;
  v?: string;
}

/** Ce qu'on envoie pour créer un événement (l'id est donné par la base). */
export interface NewEvent {
  kind: EventKind;
  startedAt: Date;
  endedAt: Date | null;
  payload: EventPayload;
}

export interface BabyProfile {
  firstName: string;
  birthAt: Date;
}

/** Ligne de la table `baby`. */
export interface BabyRow {
  id: 1;
  first_name: string;
  birth_at: string;
}

/** Un tirage de tire-lait côté vue (minutes depuis l'origine, comme la maquette) : `a` = heure, `g` / `d` = mL gauche / droite. */
export interface ViewPump {
  id: string;
  a: number;
  g: number;
  d: number;
}

export interface PumpRow {
  id: string;
  legacy_id: string | null;
  at: string;
  left_ml: number;
  right_ml: number;
}
