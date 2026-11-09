// Journal 0004 : reconstruction exacte par watermark, mode par date, états « indisponible », verrou, garde et provenance.
import { describe, expect, it, vi } from 'vitest';
import { asOf, chainBreak, head, horizon, stateAtWatermark, watermarkForDate } from './asof';
import { app, as, base, fresh, ID, ago, journal, MIG, PHONE_B, state } from './journalTestkit';

// chaque test démarre sa propre base Postgres en WASM : seule, ~2 s ; sur une machine chargée par les autres fichiers de tests, plus du double.
// Ce n'est pas une assertion de vitesse : le délai de 5 s par défaut ne sert ici qu'à détecter un blocage, il passe à 30 s.
vi.setConfig({ testTimeout: 30_000 });

const exact = (r: ReturnType<typeof stateAtWatermark>) => {
  if (r.kind !== 'exact') throw new Error(`attendu exact, reçu ${r.kind}${'reason' in r ? ` (${r.reason})` : ''}`);
  return r.state;
};
const wm = async (db: Awaited<ReturnType<typeof fresh>>) => Number((await db.query<{ w: string }>('select coalesce(max(seq), 0) as w from journal')).rows[0]!.w);

describe('asOf : exact par watermark', () => {
  it('chaque watermark redonne exactement les tables telles qu’elles étaient, même après corrections et suppressions ultérieures', async () => {
    const db = await fresh();
    await app(db, `insert into baby (id, first_name, birth_at) values (1, 'Léo', '2026-09-19T03:22:00+02')`);
    const steps: Array<() => Promise<unknown>> = [
      () => app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', ${ago(40)})`, [ID(1)]),
      () => app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(1)}, '{"ml":90}')`, [ID(2)]),
      () => app(db, `update events set ended_at = now() where id = $1`, [ID(1)], PHONE_B),
      () => app(db, `update events set payload = '{"ml":110}' where id = $1`, [ID(2)]),
      () => app(db, `insert into pumps (id, at, left_ml, right_ml) values ($1, now(), 60, 50)`, [ID(3)]),
      () => app(db, `delete from events where id = $1`, [ID(2)]),
      () => app(db, `update baby set first_name = 'Bébé' where id = 1`),
    ];
    const marks = [{ w: await wm(db), s: await state(db) }];
    for (const s of steps) {
      await s();
      marks.push({ w: await wm(db), s: await state(db) });
    }
    const j = await journal(db);
    for (const m of marks) expect(exact(stateAtWatermark(j, m.w))).toEqual(m.s); // pas de valeur future, pas de ligne supprimée trop tôt
    expect(exact(stateAtWatermark(j, head(j)))).toEqual(await state(db));
    expect(chainBreak(j)).toBeNull();
  });

  it('les écritures d’une même transaction (un lot de tirages) ont des seq contigus et le même txid', async () => {
    const db = await fresh();
    await app(db, `insert into pumps (id, at, left_ml, right_ml) select ('00000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, now(), 10, 10 from generate_series(1, 5) g`);
    const j = await journal(db);
    expect(j).toHaveLength(5);
    expect(j.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(j.map((r) => r.txid)).size).toBe(1);
    expect(new Set(j.map((r) => r.changed_at)).size).toBe(1); // même changed_at : seul seq ordonne
  });
});

describe('asOf : par date (approximatif) et états indisponibles', () => {
  it('par date : le watermark est le dernier seq enregistré avant la date, et le résultat est étiqueté approximatif', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":60}')`, [ID(1)]);
    await new Promise((r) => setTimeout(r, 30));
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":70}')`, [ID(2)]);
    const j = await journal(db);
    expect(watermarkForDate(j, new Date(Date.parse(j[0]!.recorded_at) + 1))).toBe(1);
    const r = asOf(j, { date: new Date(Date.parse(j[1]!.recorded_at) + 1) });
    expect(r).toMatchObject({ kind: 'by_date', watermark: 2 });
    expect((r as { note: string }).note).toMatch(/approximatif/);
    expect(asOf(j, { watermark: 2 }).kind).toBe('exact'); // le même point par watermark, lui, est exact
  });

  it('indisponible, jamais deviné : journal vide, avant le point de départ, au-delà de la tête, avant toute entrée', async () => {
    const db = await base();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    expect(stateAtWatermark(undefined, 1)).toMatchObject({ kind: 'unavailable', reason: 'no_journal' }); // table absente (sauvegarde sans 0004)
    expect(stateAtWatermark([], 0)).toMatchObject({ kind: 'exact' }); // table présente, rien d'écrit : l'état à 0 est vide, et exact
    await db.exec(MIG('0004_journal.sql')); // baseline = seq 1
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(2)]);
    const j = await journal(db);
    expect(horizon(j)).toBe(1);
    expect(stateAtWatermark(j, 0)).toMatchObject({ kind: 'unavailable', reason: 'before_baseline' });
    expect(stateAtWatermark(j, 99)).toMatchObject({ kind: 'unavailable', reason: 'beyond_head' });
    expect(asOf(j, { date: new Date('2000-01-01') })).toMatchObject({ kind: 'unavailable' });
  });

  it('une écriture non tracée rompt la chaîne : indisponible plutôt qu’un état faux', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":60}')`, [ID(1)]);
    await db.exec(`alter table events disable trigger events_journal`); // le propriétaire contourne : modification sans entrée
    await app(db, `update events set payload = '{"ml":65}' where id = $1`, [ID(1)]);
    await db.exec(`alter table events enable trigger events_journal`);
    await app(db, `update events set payload = '{"ml":70}' where id = $1`, [ID(1)]);
    const j = await journal(db);
    expect(chainBreak(j)).toMatchObject({ seq: 2 });
    expect(stateAtWatermark(j, 1).kind).toBe('exact'); // avant la rupture, tout va bien
    expect(stateAtWatermark(j, 2)).toMatchObject({ kind: 'unavailable', reason: 'chain_broken' });
  });
});

describe('journal 0004 : ordre, verrou, garde, droits', () => {
  it('recorded_at croît strictement avec seq, même si une entrée porte une date future', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    await db.exec(`insert into journal (tbl, row_id, op, via, recorded_at) values ('events', 'x', 'insert', 'migration', now() + interval '1 hour')`); // horloge qui aurait avancé
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(2)]);
    const ok = await db.query<{ ok: boolean }>(`select bool_and(recorded_at > prev) as ok from (select recorded_at, lag(recorded_at) over (order by seq) as prev from journal) x where prev is not null`);
    expect(ok.rows[0]!.ok).toBe(true); // strictement croissante, même après l'entrée datée d'une heure plus tard
    expect((await journal(db))).toHaveLength(3);
  });

  it('sans le verrou de sérialisation, aucune écriture n’est acceptée', async () => {
    const db = await fresh();
    await db.exec(`alter table events disable trigger events_lock`);
    await expect(app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)])).rejects.toThrow(/verrou de sérialisation absent/);
    expect((await db.query('select 1 from events')).rows).toHaveLength(0); // l'écriture elle-même est annulée
  });

  it('le verrou est tenu jusqu’au commit, une seule isolation est acceptée, et lock_timeout est restauré', async () => {
    const db = await fresh();
    await db.transaction(async (tx) => {
      await tx.exec(`insert into events (id, kind, started_at) values ('${ID(1)}', 'bib', now())`);
      const held = (await tx.query(`select 1 from pg_locks where locktype = 'advisory' and classid = 918273 and objid = 1 and pid = pg_backend_pid() and granted`)).rows;
      expect(held).toHaveLength(1);
      expect((await tx.query<{ v: string }>(`select current_setting('lock_timeout') as v`)).rows[0]!.v).toBe('0');
    });
    await expect(db.transaction(async (tx) => {
      await tx.exec('set transaction isolation level repeatable read');
      await tx.exec(`insert into events (id, kind, started_at) values ('${ID(2)}', 'bib', now())`);
    })).rejects.toThrow(/read committed requis/);
  });

  it('service_role : aucune écriture directe dans le journal, même avec un droit rendu ; ses écritures normales sont tracées « service »', async () => {
    const db = await fresh();
    const svc = { role: 'service_role' as const };
    // recorded_at fourni : sans lui, le défaut (fonction interne non exécutable par ce rôle) refuserait avant même la garde
    const direct = `insert into journal (tbl, row_id, op, via, recorded_at) values ('events', 'x', 'insert', 'service', now())`;
    await expect(as(db, svc, direct)).rejects.toThrow(/permission denied/);
    await expect(as(db, svc, `update journal set op = 'delete'`)).rejects.toThrow();
    await expect(as(db, svc, `select nextval(pg_get_serial_sequence('journal', 'seq'))`)).rejects.toThrow(/permission denied/);
    await expect(as(db, svc, 'select * from public.journal_context()')).rejects.toThrow(/permission denied/);
    await db.exec('grant insert on journal to service_role'); // un futur « grant all » : la garde doit tenir
    await expect(as(db, svc, direct)).rejects.toThrow(/écriture directe interdite/);
    await db.exec('revoke insert on journal from service_role');

    await as(db, svc, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    expect((await journal(db)).at(-1)).toMatchObject({ op: 'insert', via: 'service', actor: expect.any(String) });
    expect((await as(db, svc, 'select count(*)::int as n from journal'))[0]).toEqual({ n: 1 }); // lecture seule
  });

  it('authenticated : écriture directe refusée ; les écritures normales passent par les déclencheurs et sont tracées « app »', async () => {
    const db = await fresh();
    const direct = `insert into journal (tbl, row_id, op, via, recorded_at) values ('events', 'x', 'insert', 'app', now())`;
    await expect(app(db, direct)).rejects.toThrow(/permission denied/);
    await db.exec('grant insert on journal to authenticated');
    await expect(app(db, direct)).rejects.toThrow(/écriture directe interdite/);
    await db.exec('revoke insert on journal from authenticated');
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    expect((await journal(db)).at(-1)).toMatchObject({ via: 'app' });
  });

  it('TRUNCATE sur les tables sources est refusé (il ne laisserait aucune trace)', async () => {
    const db = await fresh();
    for (const t of ['events', 'pumps', 'baby']) await expect(db.exec(`truncate ${t}`)).rejects.toThrow(/ajout seul/);
  });
});

describe('journal 0004 : provenance et source (déductions, pas certitudes)', () => {
  const one = async (db: Awaited<ReturnType<typeof fresh>>, id: string) =>
    (await db.query<{ source: string; provenance: string; created_at: Date; started_at: Date }>('select source, provenance, created_at, started_at from events where id = $1', [id])).rows[0]!;

  it('un dodo fini saisi d’un coup est « later », même s’il vient de finir', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(5)}, ${ago(1)})`, [ID(1)]);
    expect((await one(db, ID(1))).source).toBe('later');
    await app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', ${ago(5)})`, [ID(2)]);
    expect((await one(db, ID(2))).source).toBe('timer'); // chrono lancé
  });

  it('fenêtre « live » : 2 min dans le futur à 10 min dans le passé', async () => {
    const db = await fresh();
    const at = async (n: number, sql: string) => {
      await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', ${sql})`, [ID(n)]);
      return (await one(db, ID(n))).source;
    };
    expect(await at(1, `now() + interval '60 seconds'`)).toBe('live');
    expect(await at(2, `now() - interval '9 minutes'`)).toBe('live');
    expect(await at(3, `now() - interval '11 minutes'`)).toBe('later');
    expect(await at(4, `now() + interval '5 minutes'`)).toBe('later'); // dans le futur : pas « en direct »
  });

  it('created_at = heure réelle d’enregistrement (pas le début de transaction) ; en SQL il reste fourni et la ligne est « supplied »', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    const r = await one(db, ID(1));
    expect(r.provenance).toBe('server');
    const tx = (await db.query<{ d: number }>(`select extract(epoch from created_at - updated_at)::float8 as d from events where id = $1`, [ID(1)])).rows[0]!.d;
    expect(tx).toBeGreaterThanOrEqual(0); // clock_timestamp ≥ now() de la même transaction
    await db.exec(`insert into events (id, kind, started_at, created_at) values ('${ID(2)}', 'bib', now(), '2025-01-01')`);
    const s = await one(db, ID(2));
    expect(s.provenance).toBe('supplied');
    expect(s.created_at.getUTCFullYear()).toBe(2025);
  });

  it('la migration refuse de continuer si `source` a un défaut SQL (il se ferait passer pour une valeur fournie)', async () => {
    const db = await base();
    await db.exec(`alter table events alter column source set default 'live'`);
    await expect(db.exec(MIG('0004_journal.sql'))).rejects.toThrow(/valeur par défaut/);
  });
});
