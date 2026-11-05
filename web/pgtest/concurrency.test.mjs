// Concurrence du journal sur un vrai PostgreSQL (embedded-postgres 17.11). ÉCRIT SANS AVOIR PU ÊTRE EXÉCUTÉ : voir README.md.
// Propriété vérifiée : tout instantané voit un PRÉFIXE de `seq` (aucune entrée validée de seq inférieur au maximum observé ne manque).
// Un témoin (même migration sans le verrou) doit, lui, violer la propriété : sinon le test ne prouverait rien.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const PORT = Number(process.env.PGTEST_PORT ?? 54329);
const ITER = Number(process.env.PGTEST_ITERATIONS ?? 3000); // test A1 (S7) : monter à 100000 pour la validation finale
const UID = '11111111-1111-4111-8111-111111111111';
const MIG = (f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8');
const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth; create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`;

let server, dir, n = 0;
const url = (db) => `postgres://postgres:pw@localhost:${PORT}/${db}`;
const connect = async (db) => { const c = new pg.Client(url(db)); await c.connect(); return c; };

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'canaille-pg-'));
  server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: PORT, persistent: false });
  await server.initialise();
  await server.start();
});
after(async () => { await server?.stop(); rmSync(dir, { recursive: true, force: true }); });

/** Une base neuve avec 0001-0004. `control` : même migration SANS le verrou de sérialisation (pour montrer que le test sait échouer). */
async function database({ control = false } = {}) {
  const name = `t${++n}`;
  const admin = await connect('postgres');
  await admin.query(`create database ${name}`);
  await admin.end();
  const c = await connect(name);
  await c.query(BOOT);
  for (const f of ['0001_init.sql', '0002_event_audit.sql', '0003_emb.sql']) await c.query(MIG(f));
  let sql = MIG('0004_journal.sql');
  if (control) {
    const stripped = sql.replace(/if not exists \(select 1 from pg_locks[\s\S]*?end if;/, '').replace('perform pg_advisory_xact_lock(918273, 1);', 'null;');
    assert.notEqual(stripped, sql, 'le témoin doit réellement retirer le verrou');
    sql = stripped;
  }
  await c.query(sql);
  return { name, admin: c };
}

/** Une connexion « comme l'API » : rôle authenticated et jeton du foyer, le temps d'une transaction. */
async function api(db) {
  const c = await connect(db);
  const begin = async () => {
    await c.query('begin');
    await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.headers', 'supabase-js-web', true)`, [JSON.stringify({ sub: UID, role: 'authenticated' })]);
    await c.query('set local role authenticated');
  };
  return { c, begin };
}
const insertEvent = (c) => c.query(`insert into events (id, kind, started_at) values (gen_random_uuid(), 'bib', now())`);
const snapshotSeqs = async (c) => (await c.query(`select coalesce(array_agg(seq order by seq), '{}') as s from journal`)).rows[0].s.map(Number);

/** Violation : un seq validé inférieur au maximum observé manquait à l'observation. */
const violations = (observed, committed) => observed.filter((v) => { const max = v.at(-1) ?? 0; return committed.filter((s) => s <= max).length !== v.length; }).length;

async function stress(db, { writers = 6, txPerWriter = 120, readers = 3 } = {}) {
  const ws = await Promise.all(Array.from({ length: writers }, () => api(db)));
  const rs = await Promise.all(Array.from({ length: readers }, () => connect(db)));
  const observed = [];
  let done = false;
  const readLoop = async (c) => { while (!done) observed.push(await snapshotSeqs(c)); };
  const reading = rs.map(readLoop);
  await Promise.all(ws.map(async ({ c, begin }) => {
    for (let i = 0; i < txPerWriter; i++) {
      await begin();
      await insertEvent(c);
      if (i % 3 === 0) await insertEvent(c);
      await c.query(i % 10 === 9 ? 'rollback' : 'commit');
    }
  }));
  done = true;
  await Promise.all(reading);
  const admin = await connect(db);
  const committed = (await admin.query('select seq from journal order by seq')).rows.map((r) => Number(r.seq));
  const strictly = (await admin.query(`select bool_and(recorded_at > prev) as ok from (select recorded_at, lag(recorded_at) over (order by seq) as prev from journal) x where prev is not null`)).rows[0].ok;
  await Promise.all([admin.end(), ...ws.map((w) => w.c.end()), ...rs.map((r) => r.end())]);
  return { observations: observed.length, violations: violations(observed, committed), recordedAtStrictlyIncreasing: strictly };
}

test('S1 témoin : sans verrou, un lecteur voit le seq 2 sans le seq 1 (le test sait échouer)', async () => {
  const { name, admin } = await database({ control: true });
  const a = await api(name), b = await api(name), r = await connect(name);
  await a.begin(); await insertEvent(a.c);          // seq 1, non validé
  await b.begin(); await insertEvent(b.c); await b.c.query('commit'); // seq 2, validé
  const seen = await snapshotSeqs(r);
  await a.c.query('commit');
  assert.deepEqual(seen, [2], 'sans verrou : seq 2 visible alors que seq 1 ne l’est pas encore');
  await Promise.all([a.c.end(), b.c.end(), r.end(), admin.end()]);
});

test('S2 avec verrou : B attend A, le lecteur ne voit jamais le seq 2 sans le seq 1', async () => {
  const { name, admin } = await database();
  const a = await api(name), b = await api(name), r = await connect(name);
  await a.begin(); await insertEvent(a.c);          // A tient le verrou
  await b.begin();
  const pending = insertEvent(b.c);                  // B se bloque
  let blocked = false;
  for (let i = 0; i < 100 && !blocked; i++) {
    const w = await admin.query(`select 1 from pg_stat_activity where wait_event_type = 'Lock' and wait_event = 'advisory' and datname = $1`, [name]);
    blocked = w.rowCount > 0;
    if (!blocked) await new Promise((x) => setTimeout(x, 20));
  }
  assert.ok(blocked, 'B doit être en attente du verrou consultatif');
  assert.deepEqual(await snapshotSeqs(r), []);       // rien de visible tant que A n'a pas validé
  await a.c.query('commit');
  await pending; await b.c.query('commit');
  assert.deepEqual(await snapshotSeqs(r), [1, 2]);
  await Promise.all([a.c.end(), b.c.end(), r.end(), admin.end()]);
});

test('S4 stress : zéro violation avec le verrou ; le témoin, lui, viole', async () => {
  const real = await database();
  const ok = await stress(real.name);
  await real.admin.end();
  assert.equal(ok.violations, 0, `${ok.violations} violation(s) sur ${ok.observations} observations`);
  assert.equal(ok.recordedAtStrictlyIncreasing, true);

  const ctl = await database({ control: true });
  const bad = await stress(ctl.name, { writers: 10, txPerWriter: 200, readers: 4 });
  await ctl.admin.end();
  assert.ok(bad.violations > 0, `le témoin n’a produit aucune violation sur ${bad.observations} observations : augmenter la contention, le test serait vide`);
});

test('S7 hypothèse A1 : celui qui obtient le verrou après A voit déjà la ligne validée par A', async () => {
  const { name, admin } = await database();
  await admin.query('create table probe (k int primary key)');
  await admin.query('grant all on probe to public');
  const a = await connect(name), b = await connect(name), c = await connect(name);
  let missing = 0;
  for (let k = 1; k <= ITER; k++) {
    await a.query('begin');
    await a.query('select pg_advisory_xact_lock(777, 1)');
    await a.query('insert into probe values ($1)', [k]);
    await b.query('begin');
    const waiting = b.query('select pg_advisory_xact_lock(777, 1)'); // B attend A
    await a.query('commit');
    await waiting;                                                   // B tient le verrou : A est validée
    const seen = await c.query('select 1 from probe where k = $1', [k]); // un snapshot pris maintenant doit voir A
    if (seen.rowCount !== 1) missing++;
    await b.query('commit');
  }
  assert.equal(missing, 0, `A1 invalidée : ${missing} ligne(s) de A invisibles après le verrou sur ${ITER} essais`);
  await Promise.all([a.end(), b.end(), c.end(), admin.end()]);
});

// ---------------------------------------------------------------- scénarios complémentaires (S3, S5, S6, S8, S9, S10)
const journalOf = async (c) => (await c.query('select seq, txid, row_id, op from journal order by seq')).rows.map((r) => ({ ...r, seq: Number(r.seq) }));

test('S3a transactions de plusieurs écritures : entrées contiguës, B attend dès sa première instruction', async () => {
  const { name, admin } = await database();
  const a = await api(name), b = await api(name);
  await a.begin();
  await insertEvent(a.c);
  await a.c.query(`insert into pumps (id, at, left_ml, right_ml) values (gen_random_uuid(), now(), 10, 10)`);
  await b.begin();
  const pending = a.c.query('select 1').then(() => b.c.query(`insert into pumps (id, at, left_ml, right_ml) values (gen_random_uuid(), now(), 20, 20)`));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await journalOf(admin)).length, 0, 'rien de visible tant qu’A n’a pas validé');
  await a.c.query('commit');
  await pending; await insertEvent(b.c); await b.c.query('commit');
  const j = await journalOf(admin);
  assert.deepEqual(j.map((r) => r.seq), [1, 2, 3, 4]);
  assert.equal(j[0].txid, j[1].txid); assert.equal(j[2].txid, j[3].txid); assert.notEqual(j[1].txid, j[2].txid);
  await Promise.all([a.c.end(), b.c.end(), admin.end()]);
});

test('S3b verrou de ligne sur une autre table : interblocage détecté (40P01), une seule transaction abandonnée, journal cohérent', async () => {
  const { name, admin } = await database();
  await admin.query(`insert into kv (key, value) values ('trk', '[]')`);
  const a = await api(name), b = await api(name);
  await a.begin(); await a.c.query(`update kv set value = '[1]' where key = 'trk'`);   // A tient la ligne de kv
  await b.begin(); await insertEvent(b.c);                                            // B tient le verrou du journal
  const pa = a.c.query(`insert into events (id, kind, started_at) values (gen_random_uuid(), 'bib', now())`); // A attend B
  const pb = b.c.query(`update kv set value = '[2]' where key = 'trk'`);                                          // B attend A
  const res = await Promise.allSettled([pa, pb]);
  const failed = res.filter((r) => r.status === 'rejected');
  assert.equal(failed.length, 1, 'exactement une transaction abandonnée');
  assert.equal(failed[0].reason.code, '40P01');
  for (const x of [a, b]) await x.c.query('commit').catch(() => undefined);
  const j = await journalOf(admin);
  assert.equal(j.length, 1, 'une seule entrée : celle de la transaction survivante');
  await Promise.all([a.c.end(), b.c.end(), admin.end()]);
});

test('S5 atomicité : deux requêtes sur un même instantané voient les tables et le journal d’accord', async () => {
  const { name, admin } = await database();
  const ws = await Promise.all(Array.from({ length: 4 }, () => api(name)));
  let done = false;
  const writing = Promise.all(ws.map(async ({ c, begin }) => { while (!done) { await begin(); await insertEvent(c); await c.query('commit'); } }));
  const r1 = await connect(name), r2 = await connect(name);
  let bad = 0;
  for (let i = 0; i < 40; i++) {
    await r1.query('begin isolation level repeatable read');
    const { rows: [{ pg_export_snapshot: snap }] } = await r1.query('select pg_export_snapshot()');
    await r2.query('begin isolation level repeatable read');
    await r2.query(`set transaction snapshot '${snap}'`);
    const ids = new Set((await r2.query('select id::text from events')).rows.map((r) => r.id));
    const jr = new Set((await r2.query(`select row_id from journal where tbl = 'events'`)).rows.map((r) => r.row_id));
    if (ids.size !== jr.size || [...ids].some((x) => !jr.has(x))) bad++;
    await r2.query('commit'); await r1.query('commit');
  }
  done = true; await writing;
  assert.equal(bad, 0, `${bad} instantané(s) où tables et journal divergent`);
  await Promise.all([...ws.map((w) => w.c.end()), r1.end(), r2.end(), admin.end()]);
});

test('S6 écrivain tué en pleine transaction : verrou libéré, aucune entrée fantôme', async () => {
  const { name, admin } = await database();
  const a = await api(name), b = await api(name);
  a.c.on('error', () => undefined); // la connexion tuée signale 57P01 : attendu
  const pid = (await a.c.query('select pg_backend_pid() as p')).rows[0].p;
  await a.begin(); await insertEvent(a.c);
  await b.begin();
  const pending = insertEvent(b.c);
  await new Promise((r) => setTimeout(r, 200));
  await admin.query('select pg_terminate_backend($1)', [pid]);
  await pending; await b.c.query('commit');
  const j = await journalOf(admin);
  assert.equal(j.length, 1);
  assert.ok(j[0].seq >= 1);
  await Promise.all([b.c.end(), admin.end()]);
});

test('S8 isolation autre que READ COMMITTED : écriture refusée', async () => {
  const { name, admin } = await database();
  const c = await connect(name);
  await c.query('begin isolation level repeatable read');
  await assert.rejects(insertEvent(c), /read committed requis/);
  await c.query('rollback');
  await Promise.all([c.end(), admin.end()]);
});

test('S9 lock_timeout : B échoue en 55P03 vers 5 s sans écriture ; la valeur de la session est restaurée quand tout va bien', async () => {
  const { name, admin } = await database();
  const a = await api(name), b = await api(name);
  await a.begin(); await insertEvent(a.c);
  await b.begin();
  const t0 = Date.now();
  await assert.rejects(insertEvent(b.c), (e) => e.code === '55P03');
  const ms = Date.now() - t0;
  assert.ok(ms > 4000 && ms < 9000, `attente de ${ms} ms`);
  await b.c.query('rollback'); await a.c.query('commit');
  await b.begin();
  await b.c.query(`set local lock_timeout = '3s'`);
  await insertEvent(b.c);
  assert.equal((await b.c.query(`select current_setting('lock_timeout') as v`)).rows[0].v, '3s');
  await b.c.query('commit');
  assert.equal((await journalOf(admin)).length, 2);
  await Promise.all([a.c.end(), b.c.end(), admin.end()]);
});

test('S10 point de sauvegarde annulé puis nouvelle écriture dans la même transaction : une seule entrée, jamais d’écriture sans verrou', async () => {
  const { name, admin } = await database();
  const a = await api(name);
  await a.begin();
  await a.c.query('savepoint s');
  await insertEvent(a.c);
  await a.c.query('rollback to savepoint s');
  await insertEvent(a.c);
  await a.c.query('commit');
  assert.equal((await journalOf(admin)).length, 1);
  await Promise.all([a.c.end(), admin.end()]);
});
