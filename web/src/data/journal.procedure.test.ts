// Procédure de migration 0004 : contrôles après migration, retours arrière (pause, retrait) et SQL de restauration.
// Les fichiers testés sont exactement ceux que Victor colle dans le SQL Editor.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { app, base, fresh, ID, ago, journal, MIG, state } from './journalTestkit';

const SQL = (f: string): string => readFileSync(new URL(`../../supabase/${f}`, import.meta.url), 'utf8');
const SCRIPT = fileURLToPath(new URL('../../scripts/restore-sql.mjs', import.meta.url));

/** Avant 0004, comme la production : chrono arrêté, correction, suppression (révisions 0002), tirage, fiche bébé. */
async function seed(db: PGlite): Promise<void> {
  await app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(300)}, ${ago(240)})`, [ID(1)]);
  await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(120)}, '{"ml":90}')`, [ID(2)]);
  await app(db, `update events set payload = '{"ml":100}' where id = $1`, [ID(2)]);
  await app(db, `insert into events (id, kind, started_at) values ($1, 'chg', ${ago(100)})`, [ID(3)]);
  await app(db, `delete from events where id = $1`, [ID(3)]);
  await app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', ${ago(30)})`, [ID(5)]);
  await app(db, `insert into pumps (id, at, left_ml, right_ml) values ($1, ${ago(60)}, 80, 70)`, [ID(4)]);
  await app(db, `insert into baby (id, first_name, birth_at) values (1, 'Marcello', '2026-09-19T03:22:00+02')`);
}

const n = async (db: PGlite, t: string): Promise<number> => (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]!.n;
async function checks(db: PGlite) {
  const sql = SQL('0004_checks.sql').replace('(109, 101, 1)', `(${await n(db, 'events')}, ${await n(db, 'pumps')}, ${await n(db, 'baby')})`);
  return (await db.query<{ n: number; controle: string; attendu: string; obtenu: string; ok: boolean }>(sql)).rows;
}
const failing = (rows: Awaited<ReturnType<typeof checks>>) => rows.filter((r) => !r.ok).map((r) => `${r.n} ${r.controle} (attendu ${r.attendu}, obtenu ${r.obtenu})`);

describe('procédure 0004 : contrôles après migration', () => {
  it('tous les contrôles passent juste après la migration, puis après un usage normal de l’app', async () => {
    const db = await base();
    await seed(db);
    await db.exec(MIG('0004_journal.sql'));
    const r = await checks(db);
    expect(r).toHaveLength(20);
    expect(failing(r)).toEqual([]);
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":60}')`, [ID(6)]);
    await app(db, `update events set ended_at = now() where id = $1`, [ID(5)]);
    await app(db, `delete from events where id = $1`, [ID(1)]);
    await app(db, `update baby set first_name = 'Marcello B' where id = 1`);
    expect(failing(await checks(db))).toEqual([]);
  }, 60_000);

  it('les contrôles détectent une donnée modifiée hors journal et un journal incomplet', async () => {
    const db = await base();
    await seed(db);
    await db.exec(MIG('0004_journal.sql'));
    expect(failing(await checks(db))).toEqual([]);
    // modification faite en contournant les déclencheurs (propriétaire) : le journal ne la connaît pas
    await db.exec('alter table events disable trigger events_journal; alter table events disable trigger events_lock; alter table events disable trigger events_entry');
    await db.exec(`update events set payload = '{"ml":999}' where id = '${ID(2)}'`);
    const r = failing(await checks(db));
    expect(r.some((x) => x.startsWith('9 '))).toBe(true);
    expect(r.some((x) => x.startsWith('16 '))).toBe(true);
  }, 60_000);
});

describe('procédure 0004 : retour arrière', () => {
  it('niveau 1, pause : l’app écrit sans être tracée, rien n’est perdu, le journal reste', async () => {
    const db = await base();
    await seed(db);
    await db.exec(MIG('0004_journal.sql'));
    const before = (await journal(db)).length, rows = await state(db);
    await db.exec(SQL('rollback/0004_pause.sql'));
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(7)]);
    await app(db, `update events set payload = '{"ml":55}' where id = $1`, [ID(7)]);
    await app(db, `delete from events where id = $1`, [ID(7)]);
    await app(db, `update baby set first_name = 'Marcello' where id = 1`);
    expect((await journal(db)).length).toBe(before);
    expect(await state(db)).toMatchObject({ events: rows.events });
    // la remise en marche : relancer 0004 recrée les déclencheurs, et l'app est de nouveau tracée
    await db.exec(MIG('0004_journal.sql'));
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(8)]);
    expect((await journal(db)).at(-1)).toMatchObject({ op: 'insert', row_id: ID(8), via: 'app' });
  }, 60_000);

  it('niveau 2, retrait : les données et event_revisions sont intactes, l’app marche comme avant 0004, et 0004 se repose', async () => {
    const db = await base();
    await seed(db);
    await db.exec(MIG('0004_journal.sql'));
    const rows = await state(db), rev = await n(db, 'event_revisions');
    await db.exec(SQL('rollback/0004_remove.sql'));
    expect((await db.query(`select to_regclass('public.journal') as t`)).rows[0]).toEqual({ t: null });
    expect((await db.query(`select count(*)::int as n from pg_trigger where not tgisinternal and tgname ~ '^(events|pumps|baby)_(lock|entry|journal|no_truncate)$'`)).rows[0]).toEqual({ n: 0 });
    expect(await state(db)).toEqual(rows);
    expect(await n(db, 'event_revisions')).toBe(rev);
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(9)]);
    await app(db, `update events set payload = '{"ml":70}' where id = $1`, [ID(9)]);
    expect(await n(db, 'event_revisions')).toBe(rev + 1);
    // le chrono unique continue de fonctionner (index de 0001)
    await expect(app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', now())`, [ID(10)])).rejects.toThrow();
    await db.exec(MIG('0004_journal.sql'));
    expect(failing(await checks(db))).toEqual([]);
  }, 60_000);
});

describe('procédure 0004 : SQL de restauration', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canaille-restore-'));
  async function backupOf(db: PGlite): Promise<string> {
    const q = async (t: string) => (await db.query<{ s: unknown }>(`select coalesce(jsonb_agg(to_jsonb(x)), '[]') as s from ${t} x`)).rows[0]!.s;
    const file = join(dir, 'sauvegarde.json');
    writeFileSync(file, JSON.stringify({ app: 'canaille', version: 2, exportedAt: new Date().toISOString(), baby: (await q('baby') as unknown[])[0], events: await q('events'), pumps: await q('pumps'), kv: { trk: [{ id: 'x', name: 'Bain' }] } }));
    return file;
  }

  it('reconstruit une base vide à l’identique, et le relancer ne remplace ni ne duplique rien', async () => {
    const src = await base();
    await seed(src);
    const file = await backupOf(src), out = join(dir, 'restauration.sql');
    execFileSync(process.execPath, [SCRIPT, file, out], { stdio: 'pipe' });
    for (const make of [base, fresh]) {
      const db = await make();
      await db.exec(readFileSync(out, 'utf8'));
      expect([await n(db, 'events'), await n(db, 'pumps'), await n(db, 'baby'), await n(db, 'kv')]).toEqual([await n(src, 'events'), await n(src, 'pumps'), 1, 1]);
      // avec 0004 posée, la restauration SQL est honnêtement marquée « supplied » (created_at fourni) et sa source nulle est déduite par le serveur : on compare sans ces deux colonnes
      const drop = (rows: unknown[]) => rows.map((r) => { const { provenance: _p, source: _s, ...rest } = r as Record<string, unknown>; return rest; });
      expect(drop((await state(db)).events)).toEqual(drop((await state(src)).events));
      expect(drop((await state(db)).pumps)).toEqual(drop((await state(src)).pumps));
      await db.exec(readFileSync(out, 'utf8'));
      expect(await n(db, 'events')).toBe(await n(src, 'events'));
    }
  }, 60_000);

  it('refuse un fichier qui n’est pas une sauvegarde Canaille', () => {
    const bad = join(dir, 'autre.json');
    writeFileSync(bad, '{"x":1}');
    expect(() => execFileSync(process.execPath, [SCRIPT, bad], { stdio: 'pipe' })).toThrow();
  });
});
