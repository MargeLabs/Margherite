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
  /** photo carrée en JPEG, sous forme de data URL (voir lib/photo.ts) ; absente tant que 0001_init.sql n'a pas été relancé depuis l'ajout de la photo */
  photo?: string | null;
}

/** Un tirage de tire-lait côté vue (minutes depuis l'origine, comme la maquette) : `a` = heure, `g` / `d` = mL gauche / droite. */
export interface ViewPump {
  id: string;
  a: number;
  g: number;
  d: number;
}

/**
 * Ligne de la table `journal` (migration 0004) : une écriture, avec la ligne d'avant et celle d'après.
 * `changed_at` est l'heure du serveur ; rejouer les lignes dans l'ordre de `seq` jusqu'à t redonne l'état connu à t.
 */
export interface JournalRow {
  seq: number;
  tbl: 'events' | 'pumps' | 'baby';
  row_id: string;
  op: 'insert' | 'stop' | 'reopen' | 'update' | 'delete' | 'baseline' | 'legacy_update' | 'legacy_delete';
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  changed_fields: string[];
  source: 'timer' | 'live' | 'later' | 'import' | null;
  changed_at: string;
  actor: string | null;
  via: 'app' | 'service' | 'sql' | 'migration';
  device: string | null;
  txid: number;
  legacy_revision_id: number | null;
}

export interface PumpRow {
  id: string;
  legacy_id: string | null;
  at: string;
  left_ml: number;
  right_ml: number;
}


