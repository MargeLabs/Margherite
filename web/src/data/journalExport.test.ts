import { describe, expect, it } from 'vitest';
import { backupJson } from './exportData';
import { EMPTY_SNAPSHOT } from './repo';
import { readJournal } from './supabaseRepo';
import type { JournalRow } from './types';

const row = (seq: number): JournalRow => ({ seq, tbl: 'events', row_id: 'x', op: 'insert', old_row: null, new_row: { id: 'x' }, changed_fields: [], source: 'live', changed_at: '2026-11-05T10:00:00+00:00', recorded_at: '2026-11-05T10:00:00+00:00', actor: null, via: 'app', device: null, txid: 1, legacy_revision_id: null });

describe('sauvegarde : journal des modifications', () => {
  it('lit le journal page par page, dans l’ordre', async () => {
    const all = Array.from({ length: 1500 }, (_, i) => row(i + 1));
    const r = await readJournal(async (a, b) => ({ data: all.slice(a, b + 1), error: null }));
    expect(r.journal?.map((x) => x.seq)).toEqual(all.map((x) => x.seq));
    expect(r.journalNote).toBeUndefined();
  });

  it('sans la migration 0004, la sauvegarde continue et dit pourquoi', async () => {
    const r = await readJournal(async () => ({ data: null, error: { message: 'Could not find the table public.journal', code: 'PGRST205', details: '', hint: '', name: 'PostgrestError' } as never }));
    expect(r.journal).toBeUndefined();
    expect(r.journalNote).toMatch(/journal absent/);
  });

  it('le fichier passe en version 2 et garde les champs de la version 1', () => {
    const j = JSON.parse(backupJson({ ...EMPTY_SNAPSHOT, journal: [row(1)] }, new Date('2026-11-05T10:00:00Z')));
    expect(j).toMatchObject({ app: 'canaille', version: 2, events: [], pumps: [], kv: {}, journal: [{ seq: 1 }] });
  });
});
