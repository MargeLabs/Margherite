// Migration 0004 : journal complet des modifications, rejoué sur un vrai Postgres (PGlite) avec les rôles de Supabase simulés.
// But : prouver que le journal suffit pour retrouver exactement l'état connu à n'importe quel instant passé.
import { readFileSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const MIG = (f: string) => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
const UID = '11111111-1111-4111-8111-111111111111';
const PHONE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHONE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Ce que Supabase fournit et que les migrations supposent : rôles, schéma auth, publication temps réel, droits par défaut. */
const SUPABASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function base(withAudit = true): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE);
  await db.exec(MIG('0001_init.sql'));
  if (withAudit) await db.exec(MIG('0002_event_audit.sql'));
  await db.exec(MIG('0003_emb.sql'));
  return db;
}
async function fresh(): Promise<PGlite> {
  const db = await base();
  await db.exec(MIG('0004_journal.sql'));
  return db;
}

type Who = { role: 'authenticated' | 'anon' | 'service_role'; device?: string };
const APP_A: Who = { role: 'authenticated', device: PHONE_A };
/** Une requête comme l'app la ferait via l'API : jeton du foyer, en-tête X-Client-Info de supabase-js. */
async function as<T = Record<string, unknown>>(db: PGlite, who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx: Transaction) => {
    const claims = who.role === 'anon' ? { role: 'anon' } : { sub: UID, role: who.role };
    const headers = { 'x-client-info': `supabase-js-web/2.45.0${who.device ? ` canaille-device/${who.device}` : ''}` };
    await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)`, [JSON.stringify(claims), JSON.stringify(headers)]);
    await tx.exec(`set local role ${who.role}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
const app = <T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = [], device = PHONE_A) => as<T>(db, { role: 'authenticated', device }, sql, params);

interface J { seq: number; tbl: string; row_id: string; op: string; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null; changed_fields: string[]; source: string | null; changed_at: Date; actor: string | null; via: string; device: string | null }
const journal = async (db: PGlite): Promise<J[]> => (await db.query<J>('select * from journal order by seq')).rows;
const last = async (db: PGlite): Promise<J> => (await journal(db)).at(-1)!;
const clock = async (db: PGlite): Promise<string> => (await db.query<{ t: string }>('select clock_timestamp()::text as t')).rows[0]!.t;
/** l'état réel de la table à cet instant, au même format JSON que le journal */
const state = async (db: PGlite, tbl = 'events'): Promise<unknown[]> => (await db.query<{ s: unknown[] }>(`select coalesce(jsonb_agg(to_jsonb(x) - 'photo' order by x.id), '[]') as s from ${tbl} x`)).rows[0]!.s;

/**
 * Rejeu minimal, pour les tests seulement (l'étape 2 construira `journal.asOf`) : tout ce qui a été écrit jusqu'à t, dans l'ordre.
 * Si ce rejeu retrouve l'état exact à chaque instant, le journal contient l'information nécessaire.
 */
async function replay(db: PGlite, t: string, tbl = 'events'): Promise<unknown[]> {
  const rows = (await db.query<J>('select * from journal where tbl = $1 and changed_at <= $2::timestamptz order by seq', [tbl, t])).rows;
  const m = new Map<string, unknown>();
  for (const r of rows) {
    if (r.op === 'delete' || r.op === 'legacy_delete') m.delete(r.row_id);
    else if (r.new_row) m.set(r.row_id, r.new_row);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((e) => e[1]);
}

const ago = (min: number) => `now() - interval '${min} minutes'`;
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('journal 0004 : chaque écriture est tracée', () => {
  it('création puis arrêt d’un chrono : deux entrées, « insert » puis « stop », avec avant et après', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(1)}, null)`, [ID(1)]);
    const a = await last(db);
    expect(a).toMatchObject({ tbl: 'events', row_id: ID(1), op: 'insert', old_row: null, source: 'timer', via: 'app', actor: UID, device: PHONE_A });
    expect(a.new_row).toMatchObject({ id: ID(1), kind: 'sleep', ended_at: null, source: 'timer' });
    await app(db, `update events set ended_at = now(), payload = payload where id = $1`, [ID(1)], PHONE_B);
    const b = await last(db);
    expect(b).toMatchObject({ op: 'stop', changed_fields: ['ended_at'], device: PHONE_B });
    expect(b.old_row!.ended_at).toBeNull();
    expect(b.new_row!.ended_at).not.toBeNull();
    // l'instant de l'arrêt est celui de la base, et c'est aussi le updated_at de la ligne
    const row = (await db.query<{ updated_at: Date }>('select updated_at from events where id = $1', [ID(1)])).rows[0]!;
    expect(b.changed_at.getTime()).toBe(row.updated_at.getTime());
  });

  it('saisie directe d’un repas (maintenant) : « live » ; saisie d’un sommeil fini ou d’un repas passé : « later »', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(2)}, '{"ml":90}')`, [ID(1)]);
    expect((await last(db)).source).toBe('live');
    await app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(95)}, ${ago(3)})`, [ID(2)]);
    expect((await last(db)).source).toBe('later');
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(180)}, '{"ml":120}')`, [ID(3)]);
    const r = await last(db);
    expect(r).toMatchObject({ op: 'insert', source: 'later' });
    // heure réelle (occurredAt) ≠ heure de saisie (enteredAt = created_at, fixée par la base)
    const e = (await db.query<{ lag: number }>(`select extract(epoch from created_at - started_at) / 60 as lag from events where id = $1`, [ID(3)])).rows[0]!;
    expect(Number(e.lag)).toBeGreaterThan(179);
  });

  it('created_at est toujours fixé par la base : ni l’app ni une correction ne peuvent le changer', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, created_at) values ($1, 'bib', now(), '2020-01-01')`, [ID(1)]);
    const c0 = (await db.query<{ y: number }>('select extract(year from created_at) as y from events')).rows[0]!.y;
    expect(Number(c0)).toBeGreaterThan(2020);
    await app(db, `update events set created_at = '2020-01-01', source = 'import' where id = $1`, [ID(1)]);
    const r = (await db.query<{ y: number; source: string }>('select extract(year from created_at) as y, source from events')).rows[0]!;
    expect(Number(r.y)).toBeGreaterThan(2020);
    expect(r.source).toBe('live');
    expect((await journal(db)).length).toBe(1); // rien n'a vraiment changé : pas d'entrée
  });

  it('correction de l’heure d’un repas, puis de la quantité : deux « update » avec les champs touchés', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(30)}, '{"ml":90}')`, [ID(1)]);
    await app(db, `update events set started_at = started_at - interval '20 minutes', payload = payload where id = $1`, [ID(1)]);
    const h = await last(db);
    expect(h).toMatchObject({ op: 'update', changed_fields: ['started_at'] });
    expect(Date.parse(h.old_row!.started_at as string) - Date.parse(h.new_row!.started_at as string)).toBe(20 * 60_000);
    await app(db, `update events set payload = '{"ml":100}' where id = $1`, [ID(1)]);
    const q = await last(db);
    expect(q).toMatchObject({ op: 'update', changed_fields: ['payload'], old_row: expect.objectContaining({ payload: { ml: 90 } }), new_row: expect.objectContaining({ payload: { ml: 100 } }) });
  });

  it('réouverture d’un dodo fini : « reopen »', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(60)}, ${ago(5)})`, [ID(1)]);
    await app(db, `update events set ended_at = null where id = $1`, [ID(1)]);
    expect((await last(db)).op).toBe('reopen');
  });

  it('suppression : l’ancienne ligne est gardée', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(10)}, '{"ml":60}')`, [ID(1)]);
    await app(db, `delete from events where id = $1`, [ID(1)]);
    const d = await last(db);
    expect(d).toMatchObject({ op: 'delete', new_row: null, old_row: expect.objectContaining({ id: ID(1), payload: { ml: 60 } }) });
  });

  it('import : tirages venus de l’ancienne app (legacy_id) et événement marqué « import »', async () => {
    const db = await fresh();
    await app(db, `insert into pumps (id, legacy_id, at, left_ml, right_ml) values ($1, 'csv|x', now() - interval '3 days', 90, 30)`, [ID(1)]);
    expect(await last(db)).toMatchObject({ tbl: 'pumps', op: 'insert', source: 'import' });
    await app(db, `insert into pumps (id, legacy_id, at, left_ml, right_ml) values ($1, null, now(), 60, 60)`, [ID(2)]);
    expect((await last(db)).source).toBe('live');
    await app(db, `insert into events (id, kind, started_at, source) values ($1, 'bib', now() - interval '2 days', 'import')`, [ID(3)]);
    expect((await last(db)).source).toBe('import');
  });

  it('fiche du bébé : modification tracée, sans la photo', async () => {
    const db = await fresh();
    await app(db, `insert into baby (id, first_name, birth_at, photo) values (1, 'Léo', '2026-09-19T03:22:00+02', 'data:image/jpeg;base64,AAAA')`);
    await app(db, `update baby set first_name = 'Marcello' where id = 1`);
    const b = await last(db);
    expect(b).toMatchObject({ tbl: 'baby', row_id: '1', op: 'update', changed_fields: ['first_name'] });
    expect(b.new_row).not.toHaveProperty('photo');
    await app(db, `update baby set photo = 'data:image/jpeg;base64,BBBB' where id = 1`);
    expect((await last(db)).seq).toBe(b.seq); // la photo seule n'entre pas dans l'historique
  });

  it('une mise à jour sans vrai changement n’écrit rien', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":90}')`, [ID(1)]);
    await app(db, `update events set payload = '{"ml":90}' where id = $1`, [ID(1)]);
    expect((await journal(db)).length).toBe(1);
  });
});

describe('journal 0004 : reconstruction exacte avant et après chaque modification', () => {
  it('rejouer le journal jusqu’à t redonne exactement la table telle qu’elle était à t, même après des corrections ultérieures', async () => {
    const db = await fresh();
    const steps: Array<() => Promise<unknown>> = [
      () => app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(40)}, null)`, [ID(1)]), // chrono
      () => app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(1)}, '{"ml":90}')`, [ID(2)]), // repas en direct
      () => app(db, `update events set ended_at = now() where id = $1`, [ID(1)], PHONE_B), // arrêt sur l'autre téléphone
      () => app(db, `insert into events (id, kind, started_at, ended_at) values ($1, 'sleep', ${ago(300)}, ${ago(240)})`, [ID(3)]), // saisie après coup
      () => app(db, `update events set started_at = started_at - interval '15 minutes' where id = $1`, [ID(2)]), // heure du repas corrigée
      () => app(db, `update events set payload = '{"ml":110}' where id = $1`, [ID(2)]), // quantité corrigée
      () => app(db, `update events set payload = '{"ml":100}' where id = $1`, [ID(2)]), // corrigée encore
      () => app(db, `update events set started_at = started_at + interval '5 minutes', ended_at = ended_at + interval '5 minutes' where id = $1`, [ID(3)]),
      () => app(db, `delete from events where id = $1`, [ID(3)]), // supprimé
      () => app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(500)}, '{"ml":80}')`, [ID(4)]),
    ];
    const marks: Array<{ t: string; s: unknown[] }> = [{ t: await clock(db), s: await state(db) }];
    for (const step of steps) {
      await step();
      marks.push({ t: await clock(db), s: await state(db) });
    }
    // à la fin, avec tout le journal sous la main, chaque instant passé se reconstruit sans les valeurs futures
    for (const m of marks) expect(await replay(db, m.t)).toEqual(m.s);
    // l'état d'un événement corrigé, à mi-chemin : 90 mL avant correction, 110 puis 100 après
    const ml = async (t: string) => ((await replay(db, t)).find((x) => (x as { id: string }).id === ID(2)) as { payload: { ml: number } }).payload.ml;
    expect([await ml(marks[2]!.t), await ml(marks[6]!.t), await ml(marks[7]!.t)]).toEqual([90, 110, 100]);
    // le dodo du chrono est « en cours » avant l'arrêt, fini après
    const end1 = async (t: string) => ((await replay(db, t)).find((x) => (x as { id: string }).id === ID(1)) as { ended_at: string | null }).ended_at;
    expect(await end1(marks[2]!.t)).toBeNull();
    expect(await end1(marks[3]!.t)).not.toBeNull();
  });

  it('plusieurs modifications d’un même événement : une entrée par modification, ordre garanti par seq', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":60}')`, [ID(1)]);
    for (const ml of [70, 80, 90]) await app(db, `update events set payload = $2::jsonb where id = $1`, [ID(1), JSON.stringify({ ml })]);
    const e = (await journal(db)).filter((x) => x.row_id === ID(1));
    expect(e.map((x) => x.op)).toEqual(['insert', 'update', 'update', 'update']);
    expect(e.slice(1).map((x) => (x.old_row!.payload as { ml: number }).ml)).toEqual([60, 70, 80]);
    expect(e.slice(1).map((x) => (x.new_row!.payload as { ml: number }).ml)).toEqual([70, 80, 90]);
    for (let i = 1; i < e.length; i++) expect(e[i]!.changed_at.getTime()).toBeGreaterThanOrEqual(e[i - 1]!.changed_at.getTime());
  });

  it('tirages : même reconstruction', async () => {
    const db = await fresh();
    const marks: Array<{ t: string; s: unknown[] }> = [];
    await app(db, `insert into pumps (id, at, left_ml, right_ml) values ($1, now(), 60, 50)`, [ID(1)]);
    marks.push({ t: await clock(db), s: await state(db, 'pumps') });
    await app(db, `insert into pumps (id, at, left_ml, right_ml) values ($1, now(), 30, 30)`, [ID(2)]);
    marks.push({ t: await clock(db), s: await state(db, 'pumps') });
    await app(db, `delete from pumps where id = $1`, [ID(1)]);
    marks.push({ t: await clock(db), s: await state(db, 'pumps') });
    for (const m of marks) expect(await replay(db, m.t, 'pumps')).toEqual(m.s);
  });
});

describe('journal 0004 : sécurité', () => {
  it('le foyer lit le journal, mais ne peut ni y écrire, ni le modifier, ni le vider', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    expect((await app(db, 'select count(*)::int as n from journal'))[0]).toEqual({ n: 1 });
    await expect(app(db, `insert into journal (tbl, row_id, op, via) values ('events', 'x', 'insert', 'app')`)).rejects.toThrow();
    await expect(app(db, `update journal set op = 'delete'`)).rejects.toThrow();
    await expect(app(db, `delete from journal`)).rejects.toThrow();
    await expect(app(db, `truncate journal`)).rejects.toThrow();
    expect((await journal(db)).length).toBe(1);
  });

  it('même le propriétaire de la base ne peut pas modifier ou effacer une entrée (ajout seul)', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    await expect(db.exec(`update journal set op = 'delete'`)).rejects.toThrow(/ajout seul/);
    await expect(db.exec(`delete from journal`)).rejects.toThrow(/ajout seul/);
    await expect(db.exec(`truncate journal`)).rejects.toThrow(/ajout seul/);
  });

  it('sans connexion (clé publique seule), rien n’est lisible', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    await expect(as(db, { role: 'anon' }, 'select * from journal')).rejects.toThrow();
  });

  it('les fonctions internes ne sont pas appelables depuis l’API', async () => {
    const db = await fresh();
    await expect(app(db, 'select * from public.journal_context()')).rejects.toThrow();
  });

  it('une écriture faite à la main (SQL Editor) est tracée comme telle', async () => {
    const db = await fresh();
    await db.exec(`insert into events (id, kind, started_at) values ('${ID(1)}', 'bib', now())`);
    expect(await last(db)).toMatchObject({ via: 'sql', actor: null, device: null });
  });
});

describe('journal 0004 : passage depuis l’ancien système', () => {
  it('reprend les révisions de 0002 et pose un point de départ pour chaque ligne existante ; relancer la migration ne duplique rien', async () => {
    const db = await base();
    // activité avant la migration : chrono arrêté (non tracé par 0002), correction et suppression (tracées)
    await app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', ${ago(90)})`, [ID(1)]);
    await app(db, `update events set ended_at = now() where id = $1`, [ID(1)]);
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', ${ago(30)}, '{"ml":90}')`, [ID(2)]);
    await app(db, `update events set payload = '{"ml":100}' where id = $1`, [ID(2)]);
    await app(db, `insert into events (id, kind, started_at) values ($1, 'chg', ${ago(10)})`, [ID(3)]);
    await app(db, `delete from events where id = $1`, [ID(3)]);
    await app(db, `insert into pumps (id, at, left_ml, right_ml) values ($1, now(), 10, 10)`, [ID(4)]);
    await app(db, `insert into baby (id, first_name, birth_at) values (1, 'Marcello', '2026-09-19T03:22:00+02')`);
    const revisions = (await db.query<{ n: number }>('select count(*)::int as n from event_revisions')).rows[0]!.n;
    expect(revisions).toBe(2);

    await db.exec(MIG('0004_journal.sql'));
    const j1 = await journal(db);
    expect(j1.filter((x) => x.op.startsWith('legacy_')).map((x) => [x.op, x.row_id])).toEqual([['legacy_update', ID(2)], ['legacy_delete', ID(3)]]);
    expect(j1.find((x) => x.op === 'legacy_update')!.old_row).toMatchObject({ payload: { ml: 90 } });
    expect(j1.filter((x) => x.op === 'baseline').map((x) => `${x.tbl}:${x.row_id}`).sort()).toEqual(['baby:1', `events:${ID(1)}`, `events:${ID(2)}`, `pumps:${ID(4)}`]);
    expect(j1.every((x) => x.via === 'migration')).toBe(true);
    // la reconstruction « à la date de la migration » redonne l'état réel
    expect(await replay(db, await clock(db))).toEqual(await state(db));

    await db.exec(MIG('0004_journal.sql'));
    expect((await journal(db)).length).toBe(j1.length);
    // l'ancien système continue de fonctionner à côté
    await app(db, `update events set payload = '{"ml":95}' where id = $1`, [ID(2)]);
    expect((await db.query<{ n: number }>('select count(*)::int as n from event_revisions')).rows[0]!.n).toBe(3);
    expect(await last(db)).toMatchObject({ op: 'update', via: 'app', row_id: ID(2) });
  });

  it('classe les lignes d’avant derived_pre0004 (conservées, source non inventée) et les nouvelles server, sans que l’app puisse en décider', async () => {
    const db = await base();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', ${ago(30)})`, [ID(1)]);
    await app(db, `insert into pumps (id, at, left_ml, right_ml) values ($1, now(), 10, 10)`, [ID(2)]);
    await db.exec(MIG('0004_journal.sql'));
    const prov = async (t: string, id: string) => (await db.query<{ provenance: string; source: string | null }>(`select provenance, source from ${t} where id = $1`, [id])).rows[0]!;
    expect(await prov('events', ID(1))).toEqual({ provenance: 'derived_pre0004', source: null });
    expect(await prov('pumps', ID(2))).toEqual({ provenance: 'derived_pre0004', source: null });
    // la classification n'a écrit aucune entrée de journal en plus du point de départ
    expect((await journal(db)).map((x) => x.op)).toEqual(['baseline', 'baseline']);

    await app(db, `insert into events (id, kind, started_at, provenance) values ($1, 'bib', now(), 'derived_pre0004')`, [ID(3)]);
    expect((await prov('events', ID(3))).provenance).toBe('server');
    await app(db, `update events set provenance = 'derived_pre0004', payload = '{"ml":50}' where id = $1`, [ID(3)]);
    expect((await prov('events', ID(3))).provenance).toBe('server');
    await app(db, `update events set provenance = 'server', payload = '{"ml":50}' where id = $1`, [ID(1)]);
    expect((await prov('events', ID(1))).provenance).toBe('derived_pre0004');

    await db.exec(MIG('0004_journal.sql'));  // relancer ne reclasse rien
    expect((await prov('events', ID(3))).provenance).toBe('server');
    expect((await prov('events', ID(1))).provenance).toBe('derived_pre0004');
  });

  it('s’installe aussi sur une base qui n’a jamais reçu 0002', async () => {
    const db = await base(false);
    await app(db, `insert into events (id, kind, started_at) values ($1, 'bib', now())`, [ID(1)]);
    await db.exec(MIG('0004_journal.sql'));
    expect((await journal(db)).map((x) => x.op)).toEqual(['baseline']);
  });

  it('le chrono unique et le temps réel continuent de fonctionner', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', now())`, [ID(1)]);
    await expect(app(db, `insert into events (id, kind, started_at) values ($1, 'sleep', now())`, [ID(2)])).rejects.toThrow();
    const pub = (await db.query<{ t: string }>(`select tablename as t from pg_publication_tables where pubname = 'supabase_realtime' order by 1`)).rows.map((r) => r.t);
    expect(pub).not.toContain('journal');
    expect(pub).toContain('events');
  });
});
