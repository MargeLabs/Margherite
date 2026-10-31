import type { BabyRow, EventRow, PumpRow } from './types';

/** Les clés partagées entre les deux téléphones (table `kv`). Chaque valeur est un petit document JSON réécrit en entier. */
export const KV_KEYS = ['trk', 'trl', 'notes', 'well', 'tipsX'] as const;
export type KvKey = (typeof KV_KEYS)[number];
export type KvDocs = Partial<Record<KvKey, unknown>>;

/** Tout ce que l'app sait de la base à un instant donné (fenêtre récente seulement : voir `Repo.load`). */
export interface Snapshot {
  baby: BabyRow | null;
  events: EventRow[];
  pumps: PumpRow[];
  kv: KvDocs;
}

export const EMPTY_SNAPSHOT: Snapshot = { baby: null, events: [], pumps: [], kv: {} };

/** Un dodo est déjà en cours : un autre téléphone l'a lancé. */
export class RunningConflictError extends Error {
  constructor() {
    super('Un dodo est déjà en cours.');
    this.name = 'RunningConflictError';
  }
}

/**
 * Accès aux données. Deux implémentations : Supabase (production) et le stockage du navigateur (démo, tests, développement).
 * Les identifiants sont créés par l'appelant, pour que l'écran puisse afficher l'ajout avant la réponse du serveur.
 */
export interface Repo {
  /** Les `days` derniers jours d'événements et de tirages, plus le bébé et les réglages partagés. */
  load(days: number): Promise<Snapshot>;
  /** Appelé quand un autre appareil a écrit quelque chose. Retourne la fonction qui arrête l'écoute. */
  subscribe(onRemoteChange: () => void): () => void;
  saveBaby(baby: BabyRow): Promise<void>;
  insertEvent(row: EventRow): Promise<void>;
  patchEvent(id: string, patch: Partial<Pick<EventRow, 'started_at' | 'ended_at' | 'payload'>>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  insertPump(row: PumpRow): Promise<void>;
  deletePump(id: string): Promise<void>;
  /** Ajoute les tirages dont le `legacy_id` n'existe pas encore ; retourne combien ont été ajoutés. */
  importPumps(rows: PumpRow[]): Promise<number>;
  setKv(key: KvKey, value: unknown): Promise<void>;
  /** Tout l'historique, pour la sauvegarde JSON. */
  exportAll(): Promise<Snapshot>;
}
