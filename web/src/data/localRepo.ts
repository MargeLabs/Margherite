// Dépôt dans le stockage du navigateur : pour développer, tester (deux onglets = deux téléphones) et faire la démo sans Supabase.
// Même contrat que SupabaseRepo, y compris « un seul dodo en cours ».
import { newPumpsOnly } from './pumpImport';
import { EMPTY_SNAPSHOT, RunningConflictError, type KvKey, type Repo, type Snapshot } from './repo';
import type { BabyRow, EventRow, PumpRow } from './types';

export const LOCAL_KEY = 'margherite.local.v1';
const CHANNEL = 'margherite-local';

export class LocalRepo implements Repo {
  private channel: BroadcastChannel | null;

  constructor(private readonly storage: Storage = localStorage, notify = true) {
    this.channel = notify && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  }

  private read(): Snapshot {
    try {
      const raw = this.storage.getItem(LOCAL_KEY);
      return raw ? { ...EMPTY_SNAPSHOT, ...(JSON.parse(raw) as Partial<Snapshot>) } : { ...EMPTY_SNAPSHOT };
    } catch {
      return { ...EMPTY_SNAPSHOT };
    }
  }

  private write(s: Snapshot): void {
    this.storage.setItem(LOCAL_KEY, JSON.stringify(s));
    this.channel?.postMessage('change');
  }

  async load(_days?: number): Promise<Snapshot> {
    return this.read();
  }

  async exportAll(): Promise<Snapshot> {
    return this.read();
  }

  subscribe(onRemoteChange: () => void): () => void {
    const ch = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
    if (ch) ch.onmessage = () => onRemoteChange();
    return () => ch?.close();
  }

  async saveBaby(baby: BabyRow): Promise<void> {
    this.write({ ...this.read(), baby });
  }

  async insertEvent(row: EventRow): Promise<void> {
    const s = this.read();
    if (row.kind === 'sleep' && row.ended_at === null && s.events.some((e) => e.kind === 'sleep' && e.ended_at === null)) throw new RunningConflictError();
    this.write({ ...s, events: [...s.events, row] });
  }

  async patchEvent(id: string, patch: Partial<Pick<EventRow, 'started_at' | 'ended_at' | 'payload'>>): Promise<void> {
    const s = this.read();
    const cur = s.events.find((e) => e.id === id);
    if (!cur) throw new Error('Événement introuvable.');
    const next: EventRow = { ...cur, ...patch };
    if (next.kind === 'sleep' && next.ended_at === null && s.events.some((e) => e.id !== id && e.kind === 'sleep' && e.ended_at === null)) throw new RunningConflictError();
    this.write({ ...s, events: s.events.map((e) => (e.id === id ? next : e)) });
  }

  async deleteEvent(id: string): Promise<void> {
    const s = this.read();
    this.write({ ...s, events: s.events.filter((e) => e.id !== id) });
  }

  async insertPump(row: PumpRow): Promise<void> {
    const s = this.read();
    this.write({ ...s, pumps: [...s.pumps, row] });
  }

  async deletePump(id: string): Promise<void> {
    const s = this.read();
    this.write({ ...s, pumps: s.pumps.filter((p) => p.id !== id) });
  }

  async importPumps(rows: PumpRow[]): Promise<number> {
    const s = this.read();
    const fresh = newPumpsOnly(s.pumps, rows);
    if (fresh.length) this.write({ ...s, pumps: [...s.pumps, ...fresh] });
    return fresh.length;
  }

  async setKv(key: KvKey, value: unknown): Promise<void> {
    const s = this.read();
    this.write({ ...s, kv: { ...s.kv, [key]: value } });
  }
}

