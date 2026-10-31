import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { newPumpsOnly } from './pumpImport';
import { KV_KEYS, RunningConflictError, type KvDocs, type KvKey, type Repo, type Snapshot } from './repo';
import type { BabyRow, EventRow, PumpRow } from './types';

const PAGE = 1000;
const UNIQUE_VIOLATION = '23505';

function check(error: PostgrestError | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

/** Lit toute une table page par page (Supabase renvoie au plus 1000 lignes par requête). */
async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    check(error);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export class SupabaseRepo implements Repo {
  private sinceFilter(days: number | null): string | null {
    return days === null ? null : new Date(Date.now() - days * 86_400_000).toISOString();
  }

  private async fetch(days: number | null): Promise<Snapshot> {
    const sb = supabase();
    const since = this.sinceFilter(days);
    const [baby, events, pumps, kvRows] = await Promise.all([
      sb.from('baby').select('*').maybeSingle(),
      pages<EventRow>((a, b) => {
        const q = sb.from('events').select('*').order('started_at').range(a, b);
        return since ? q.gte('started_at', since) : q;
      }),
      pages<PumpRow>((a, b) => {
        const q = sb.from('pumps').select('*').order('at').range(a, b);
        return since ? q.gte('at', since) : q;
      }),
      sb.from('kv').select('key,value'),
    ]);
    check(baby.error);
    check(kvRows.error);
    const kv: KvDocs = {};
    for (const r of (kvRows.data ?? []) as Array<{ key: string; value: unknown }>) {
      if ((KV_KEYS as readonly string[]).includes(r.key)) kv[r.key as KvKey] = r.value;
    }
    return { baby: (baby.data as BabyRow | null) ?? null, events, pumps, kv };
  }

  load(days: number): Promise<Snapshot> {
    return this.fetch(days);
  }

  exportAll(): Promise<Snapshot> {
    return this.fetch(null);
  }

  subscribe(onRemoteChange: () => void): () => void {
    const sb = supabase();
    const channel = sb
      .channel('foyer')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => onRemoteChange())
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }

  async saveBaby(baby: BabyRow): Promise<void> {
    check((await supabase().from('baby').upsert(baby)).error);
  }

  async insertEvent(row: EventRow): Promise<void> {
    const { error } = await supabase().from('events').insert(row);
    if (error?.code === UNIQUE_VIOLATION && row.kind === 'sleep' && row.ended_at === null) throw new RunningConflictError();
    check(error);
  }

  async patchEvent(id: string, patch: Partial<Pick<EventRow, 'started_at' | 'ended_at' | 'payload'>>): Promise<void> {
    const { error } = await supabase().from('events').update(patch).eq('id', id);
    if (error?.code === UNIQUE_VIOLATION) throw new RunningConflictError();
    check(error);
  }

  async deleteEvent(id: string): Promise<void> {
    check((await supabase().from('events').delete().eq('id', id)).error);
  }

  async insertPump(row: PumpRow): Promise<void> {
    check((await supabase().from('pumps').insert(row)).error);
  }

  async deletePump(id: string): Promise<void> {
    check((await supabase().from('pumps').delete().eq('id', id)).error);
  }

  async importPumps(rows: PumpRow[]): Promise<number> {
    const sb = supabase();
    const existing = await pages<PumpRow>((a, b) => sb.from('pumps').select('*').range(a, b));
    const fresh = newPumpsOnly(existing, rows);
    for (let i = 0; i < fresh.length; i += 200) check((await sb.from('pumps').insert(fresh.slice(i, i + 200))).error);
    return fresh.length;
  }

  async setKv(key: KvKey, value: unknown): Promise<void> {
    check((await supabase().from('kv').upsert({ key, value })).error);
  }
}
