// Couche 1 contre la vraie base : la migration 0004 rejouée sur PGlite avec les rôles de Supabase, puis la vraie sauvegarde (ignorée si absente :
// le dossier data/ n'est pas suivi par git). On vérifie que le contrat du journal parental (engine/journal) lit ce que la base écrit vraiment :
// saisies en direct, depuis une heure passée, après coup, corrections, arrêts, réouvertures, suppressions, écritures SQL.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { RawEventRow } from '@/engine/adapters';
import { observe } from '@/engine/journal/observation';
import { asOf, head } from './asof';
import { app, fresh, ID, journal as readJournal } from './journalTestkit';

vi.setConfig({ testTimeout: 30_000 });

const TZ = 'Europe/Paris';
type Db = Awaited<ReturnType<typeof fresh>>;

/** La table `events` comme l'API la rend : instants en texte. */
async function table(db: Db): Promise<RawEventRow[]> {
  const rows = (await db.query<Record<string, unknown>>('select * from events order by started_at')).rows;
  const t = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : (v as string | null));
  return rows.map((r) => ({ id: r.id, kind: r.kind, started_at: t(r.started_at), ended_at: t(r.ended_at), payload: r.payload, created_at: t(r.created_at), updated_at: t(r.updated_at), source: r.source, provenance: r.provenance }) as RawEventRow);
}
const ago = (min: number): string => `now() - interval '${min} minutes'`;

describe('couche 1 sur la vraie migration 0004', () => {
  it('chaque façon de saisir laisse la trace attendue : direct, depuis une heure passée, après coup, SQL', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'sleep', ${ago(20)}, '{}')`, [ID(1)]); // chrono « depuis 20 min »
    await app(db, `update events set ended_at = now() where id = $1`, [ID(1)]); // arrêt en direct
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(3)}, '{"ml":90}')`, [ID(2)]); // biberon quelques minutes avant la saisie
    await app(db, `insert into events (id, kind, started_at, ended_at, payload) values ($1, 'sleep', ${ago(300)}, ${ago(240)}, '{}')`, [ID(3)]); // sieste de mémoire
    await db.query(`insert into events (id, kind, started_at, payload) values ($1, 'chg', ${ago(60)}, '{"v":"pipi"}')`, [ID(4)]); // écrit en SQL : l'heure d'enregistrement n'est pas une mesure
    const now = Date.now();
    const r = observe({ rows: await table(db), journal: await readJournal(db), now, tz: TZ });
    const by = (n: number) => r.observations.find((o) => o.id === ID(n))!;

    expect(by(1).entry).toMatchObject({ source: 'timer', provenance: 'server', trust: 'high', startTiming: 'delayed', endTiming: 'live' });
    expect(by(1).history).toMatchObject({ entries: 2, stops: 1, timeCorrections: 0 });
    expect(by(2).entry).toMatchObject({ source: 'live', startTiming: 'live' });
    expect(by(3).entry).toMatchObject({ source: 'later', startTiming: 'recalled', endTiming: 'recalled' });
    expect(by(4).entry).toMatchObject({ provenance: 'supplied', trust: 'low', startTiming: 'unknown' });
    expect(r.integrity).toEqual({ untraced: [], diverged: [] });
    expect(r.observations.every((o) => o.usable && o.flags.length === 0)).toBe(true);
    expect(r.journal).toBe('present');
  });

  it('corrections, réouverture, suppression : l’historique les compte, la table reste la seule valeur courante', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, ended_at, payload) values ($1, 'sleep', ${ago(200)}, ${ago(150)}, '{}')`, [ID(1)]);
    const original = (await table(db))[0]!;
    await app(db, `update events set started_at = ${ago(230)} where id = $1`, [ID(1)]); // correction rétroactive du début
    await app(db, `update events set ended_at = ${ago(140)} where id = $1`, [ID(1)]); // correction de la fin
    await app(db, `update events set ended_at = null where id = $1`, [ID(1)]); // réouverture
    await app(db, `update events set ended_at = now() where id = $1`, [ID(1)]); // nouvel arrêt
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(30)}, '{"ml":60}')`, [ID(2)]);
    await app(db, `update events set payload = '{"ml":80}' where id = $1`, [ID(2)]);
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'chg', ${ago(10)}, '{}')`, [ID(3)]);
    await app(db, `delete from events where id = $1`, [ID(3)]);

    const r = observe({ rows: await table(db), journal: await readJournal(db), now: Date.now(), tz: TZ });
    const o = r.observations.find((x) => x.id === ID(1))!;
    expect(o.history).toMatchObject({ timeCorrections: 2, stops: 1, reopens: 1, originalStart: Date.parse(original.started_at), originalEnd: Date.parse(original.ended_at!), deletedAt: null });
    expect(o.start).not.toBe(Date.parse(original.started_at)); // la valeur courante est la correction, jamais l'original
    expect(r.observations.find((x) => x.id === ID(2))!.history).toMatchObject({ valueCorrections: 1, entries: 2 });
    expect(r.observations.map((x) => x.id)).not.toContain(ID(3));
    expect(r.removed.map((x) => x.id)).toEqual([ID(3)]);
    expect(r.integrity).toEqual({ untraced: [], diverged: [] });
  });

  it('une écriture hors de l’app, après la migration, sans trace : la table et le journal divergent, et le contrat le dit', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, ended_at, payload) values ($1, 'sleep', ${ago(100)}, ${ago(50)}, '{}')`, [ID(1)]);
    // le propriétaire coupe les déclencheurs et modifie : ce que la base ne peut pas empêcher (voir l'en-tête de 0004)
    await db.exec(`alter table events disable trigger events_journal`);
    await db.exec(`update events set ended_at = started_at + interval '10 minutes'`);
    const r = observe({ rows: await table(db), journal: await readJournal(db), now: Date.now(), tz: TZ });
    expect(r.integrity.diverged).toEqual([ID(1)]);
  });

  it('le passé reconstruit par le journal est une entrée valide du contrat : même cohérence à chaque watermark', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'sleep', ${ago(90)}, '{}')`, [ID(1)]);
    await app(db, `update events set ended_at = now() where id = $1`, [ID(1)]);
    await app(db, `update events set started_at = ${ago(120)} where id = $1`, [ID(1)]);
    await app(db, `delete from events where id = $1`, [ID(1)]);
    const j = await readJournal(db);
    const seen: Array<[number, number, number]> = [];
    for (let w = 1; w <= head(j); w++) {
      const past = asOf(j, { watermark: w });
      expect(past.kind).toBe('exact');
      if (past.kind !== 'exact') continue;
      const prefix = j.filter((x) => x.seq <= w);
      const r = observe({ rows: past.state.events as unknown as RawEventRow[], journal: prefix, now: Date.now(), tz: TZ });
      expect(r.integrity).toEqual({ untraced: [], diverged: [] });
      seen.push([w, r.observations.length, r.open.length]);
    }
    expect(seen).toEqual([[1, 1, 1], [2, 1, 0], [3, 1, 0], [4, 0, 0]]); // en cours → terminé → corrigé → supprimé
  });
});

const DIR = new URL('../../../data/', import.meta.url);
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^canaille-sauvegarde-.*\.json$/.test(f)).sort() : [];
const withJournal = [...files].reverse().map((f) => JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as { exportedAt: string; events: RawEventRow[]; journal?: never[] }).find((b) => (b.journal?.length ?? 0) > 0);

describe.skipIf(!withJournal)('couche 1 sur la vraie sauvegarde', () => {
  it('toute ligne devient une observation lisible ; la table et le journal sont d’accord', () => {
    const b = withJournal!;
    const r = observe({ rows: b.events, journal: b.journal, now: Date.parse(b.exportedAt), tz: TZ });
    const flags: Record<string, number> = {};
    for (const o of r.observations) for (const f of o.flags) flags[f.code] = (flags[f.code] ?? 0) + 1;
    console.log('réel :', r.observations.length, 'observations,', r.days.length, 'jours,', r.silences.length, 'silences,', r.removed.length, 'supprimés, drapeaux', JSON.stringify(flags), 'intégrité', JSON.stringify({ u: r.integrity.untraced.length, d: r.integrity.diverged.length }));
    expect(r.observations).toHaveLength(b.events.length);
    expect(r.observations.every((o) => o.basis === 'observed' && o.usable)).toBe(true);
    expect(r.integrity).toEqual({ untraced: [], diverged: [] });
  });
});
