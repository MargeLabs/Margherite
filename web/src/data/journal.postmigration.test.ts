// Contrôle APRÈS la vraie migration : s'applique à la sauvegarde la plus récente qui contient un `journal` (export version 2 pris après 0004).
// Ignoré tant qu'aucune n'existe. Lecture seule, hors ligne : lance `npm run export` après la migration, puis `npx vitest run src/data/journal.postmigration.test.ts`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventFromRaw, type RawEventRow } from '@/engine/adapters';
import { asOf, chainBreak, head, horizon } from './asof';
import { intelligenceFor } from './intelligenceSource';
import type { JournalRow } from './types';

const DIR = new URL('../../../data/', import.meta.url);
type Backup = { version: number; baby: Record<string, unknown>; events: Record<string, unknown>[]; pumps: Record<string, unknown>[]; journal?: JournalRow[] };
const all = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^canaille-sauvegarde-.*\.json$/.test(f)).sort() : [];
const withJournal = all.map((f) => ({ f, b: JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Backup })).filter((x) => Array.isArray(x.b.journal) && x.b.journal.length > 0).pop();
const before = all.map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as Backup).filter((b) => !b.journal).pop();

describe.skipIf(!withJournal)('après la migration 0004, sur l’export réel', () => {
  const b = withJournal?.b as Backup, j = (b?.journal ?? []) as JournalRow[]; // lecture tolérante : le corps est évalué même quand le groupe est ignoré
  it('export version 2, chaîne du journal sans rupture, point de départ par ligne', () => {
    expect(b.version).toBe(2);
    expect(chainBreak(j)).toBeNull();
    expect(head(j)).toBeGreaterThanOrEqual(horizon(j));
    const bl = (t: string) => j.filter((x) => x.op === 'baseline' && x.tbl === t).length;
    // chaque ligne présente à la migration a un point de départ ; les lignes ajoutées depuis ont une entrée « insert »
    const known = (t: 'events' | 'pumps') => new Set(j.filter((x) => x.tbl === t).map((x) => x.row_id));
    expect(b.events.every((e) => known('events').has(String(e.id)))).toBe(true);
    expect(b.pumps.every((p) => known('pumps').has(String(p.id)))).toBe(true);
    expect(bl('baby')).toBe(1);
  });
  it('le journal à sa tête redonne exactement les événements et tirages de la sauvegarde', () => {
    const r = asOf(j, { watermark: head(j) });
    expect(r.kind).toBe('exact');
    if (r.kind !== 'exact') return;
    const ids = (rows: unknown[]) => (rows as { id: string }[]).map((x) => x.id).sort();
    expect(ids(r.state.events)).toEqual(ids(b.events));
    expect(ids(r.state.pumps)).toEqual(ids(b.pumps));
  });
  it('aucune donnée perdue par rapport à la dernière sauvegarde d’avant la migration', () => {
    if (!before) return;
    const ids = new Set(b.events.map((e) => String(e.id)));
    const deletedSince = new Set(j.filter((x) => x.tbl === 'events' && x.op === 'delete').map((x) => x.row_id));
    expect(before.events.filter((e) => !ids.has(String(e.id)) && !deletedSince.has(String(e.id)))).toEqual([]);
    expect(b.pumps.length).toBeGreaterThanOrEqual(before.pumps.length);
  });
  it('Canaille Intelligence lit le journal : mode « journal », toutes les cibles répondent', () => {
    const events = b.events.map((e) => eventFromRaw(e as unknown as RawEventRow));
    const now = Math.max(...events.map((e) => e.end ?? e.start)) + 30 * 60_000;
    const rep = intelligenceFor({ babyId: 'baby', birthAt: Date.parse(String(b.baby.birth_at)), events }, now, j);
    expect(rep.mode).toBe('journal');
    expect(rep.predictions.map((p) => p.target).sort()).toEqual(['bedtime', 'feed', 'nap_duration', 'nap_start']);
  }, 120_000);
});
