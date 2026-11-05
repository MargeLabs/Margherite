// Répétition de la migration 0004 sur la VRAIE sauvegarde (jamais sur Supabase) : passage, relance, catastrophe puis restauration,
// et compatibilité du journal avec le moteur. Ignoré si aucune sauvegarde locale n'existe (dossier data/ non suivi par git).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventFromRaw, type RawEventRow } from '@/engine/adapters';
import { asOf, head } from './asof';
import { eventsAtWatermark, intelligenceFor } from './intelligenceSource';
import { app, base, journal, MIG, state } from './journalTestkit';

const DIR = new URL('../../../data/', import.meta.url);
const file = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^canaille-sauvegarde-.*\.json$/.test(f)).sort().pop() : undefined;
const backup = file ? (JSON.parse(readFileSync(new URL(file, DIR), 'utf8')) as { baby: Record<string, unknown>; events: Record<string, unknown>[]; pumps: Record<string, unknown>[] }) : null;

const count = async (db: Awaited<ReturnType<typeof base>>, sql: string): Promise<number> => (await db.query<{ n: number }>(sql)).rows[0]!.n;
const strip = (rows: unknown[]) => (rows as { id: string }[]).map((r) => r.id).sort();

describe.skipIf(!backup)('répétition de 0004 sur la vraie sauvegarde', () => {
  async function pre() {
    const db = await base();
    // état de production avant 0004 : lignes déjà là, avec leurs dates d'origine (insertion en propriétaire, comme le ferait une restauration SQL)
    await db.query('insert into baby select * from jsonb_populate_recordset(null::baby, $1)', [JSON.stringify([backup!.baby])]);
    await db.query('insert into events select * from jsonb_populate_recordset(null::events, $1)', [JSON.stringify(backup!.events)]);
    await db.query('insert into pumps select * from jsonb_populate_recordset(null::pumps, $1)', [JSON.stringify(backup!.pumps)]);
    return db;
  }

  it('la migration pose un point de départ par ligne, classe l’existant derived_pre0004, et la relancer ne change rien', async () => {
    const db = await pre();
    await db.exec(MIG('0004_journal.sql'));
    const j = await journal(db);
    const bl = (t: string) => j.filter((x) => x.op === 'baseline' && x.tbl === t).length;
    expect([bl('events'), bl('pumps'), bl('baby')]).toEqual([backup!.events.length, backup!.pumps.length, 1]);
    expect(await count(db, `select count(*)::int as n from events where provenance <> 'derived_pre0004'`)).toBe(0);
    expect(await count(db, `select count(*)::int as n from pumps where provenance <> 'derived_pre0004'`)).toBe(0);
    // rien n'a été réécrit : les données de la sauvegarde sont intactes
    expect(strip((await state(db)).events)).toEqual(strip(backup!.events));
    // le journal seul redonne exactement les tables
    const r = asOf(j, { watermark: head(j) });
    expect(r.kind).toBe('exact');
    if (r.kind === 'exact') expect(r.state).toEqual(await state(db));
    await db.exec(MIG('0004_journal.sql'));
    expect((await journal(db)).length).toBe(j.length);
  }, 120_000);

  it('catastrophe puis restauration : le passé reste lisible, l’état final est complet, les lignes restaurées sont tracées', async () => {
    const db = await pre();
    await db.exec(MIG('0004_journal.sql'));
    const before = head(await journal(db));
    await app(db, 'delete from events');
    const afterLoss = await journal(db);
    expect(afterLoss.filter((x) => x.op === 'delete').length).toBe(backup!.events.length);
    expect(await count(db, 'select count(*)::int as n from events')).toBe(0);
    // restauration par la voie de l'app (insertion authentifiée)
    await app(db, 'insert into events select * from jsonb_populate_recordset(null::events, $1)', [JSON.stringify(backup!.events)]);
    const j = await journal(db);
    expect(j.filter((x) => x.op === 'insert' && x.via === 'app').length).toBe(backup!.events.length);
    expect(strip((await state(db)).events)).toEqual(strip(backup!.events));
    // l'état de la tête redonne la table ; l'état d'avant la catastrophe reste exact
    const tip = asOf(j, { watermark: head(j) });
    expect(tip.kind).toBe('exact');
    if (tip.kind === 'exact') expect(tip.state).toEqual(await state(db));
    const old = asOf(j, { watermark: before });
    expect(old.kind).toBe('exact');
    if (old.kind === 'exact') expect(strip(old.state.events)).toEqual(strip(backup!.events));
    // une restauration ne ment pas sur l'heure de saisie : created_at est celui de la restauration, provenance « server »
    expect(await count(db, `select count(*)::int as n from events where provenance <> 'server'`)).toBe(0);
  }, 120_000);

  it('compatibilité moteur : le journal redonne les mêmes événements que la sauvegarde, et le moteur passe en mode journal', async () => {
    const db = await pre();
    await db.exec(MIG('0004_journal.sql'));
    const j = await journal(db);
    const fromJournal = eventsAtWatermark(j, head(j))!;
    const fromBackup = backup!.events.map((x) => eventFromRaw(x as unknown as RawEventRow));
    const key = (e: { id: string; start: number; end?: number }) => `${e.id}|${e.start}|${e.end ?? ''}`;
    expect(fromJournal.map(key).sort()).toEqual(fromBackup.map(key).sort());
    const now = Math.max(...fromBackup.map((e) => e.end ?? e.start)) + 60 * 60_000;
    const rep = intelligenceFor({ babyId: 'baby', birthAt: Date.parse(String(backup!.baby.birth_at)), events: fromJournal }, now, j, { targets: ['bedtime'] });
    expect(rep.mode).toBe('journal');
    expect(rep.predictions.map((p) => p.target)).toEqual(['bedtime']);
  }, 120_000);
});
