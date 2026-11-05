// Le moteur lit le journal 0004 côté application : source, bascule automatique, cohérence avec l'écran, reconstruction du passé.
// Les journaux viennent d'une VRAIE base migrée (PGlite + 0004), jamais d'une imitation : lignes d'avant la migration, puis saisies,
// corrections et suppressions de l'app.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { TODAY_INDEX } from '@/engine/sleep/timeline';
import { viewData } from './household';
import { journalOptions } from './journalEngine';
import { JournalSource } from './journalSource';
import { app, base, ID, journal, MIG, state } from './journalTestkit';
import type { BabyRow, EventRow, JournalRow } from './types';

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

/** Trois semaines d'un bébé régulier se terminant à `end` : deux siestes de jour et une nuit, chaque jour. */
function regularRows(end: number): Array<{ id: string; kind: 'sleep' | 'bib'; start: number; stop: number | null; ml?: number }> {
  const top = new Date(end), midnight = new Date(top.getFullYear(), top.getMonth(), top.getDate()).getTime();
  const rows: Array<{ id: string; kind: 'sleep' | 'bib'; start: number; stop: number | null; ml?: number }> = [];
  let n = 100;
  for (let d = 21; d >= 1; d--) {
    const day = midnight - d * DAY, h = (x: number) => day + x * 3_600_000;
    for (const [a, b] of [[9.5, 10.5], [13, 14.5], [20, 31]] as const) rows.push({ id: ID(n++), kind: 'sleep', start: h(a), stop: h(b) });
    for (const x of [7.5, 11, 15, 18.5, 22]) rows.push({ id: ID(n++), kind: 'bib', start: h(x), stop: null, ml: 90 });
  }
  return rows;
}

/** Base d'avant la migration (lignes insérées comme en production), puis 0004, puis l'usage de l'app. */
async function migrated(now: number) {
  const db = await base();
  const rows = regularRows(now);
  for (const r of rows) {
    await db.query(`insert into events (id, kind, started_at, ended_at, payload, created_at, updated_at) values ($1, $2, $3::timestamptz, $4::timestamptz, $5::jsonb, $3::timestamptz, coalesce($4::timestamptz, $3::timestamptz))`, [r.id, r.kind, iso(r.start), r.stop === null ? null : iso(r.stop), JSON.stringify(r.ml ? { ml: r.ml } : {})]);
  }
  await db.query(`insert into baby (id, first_name, birth_at) values (1, 'Marcello', $1)`, [iso(now - 80 * DAY)]);
  await db.exec(MIG('0004_journal.sql'));
  return { db, rows };
}

async function snapshotOf(db: PGlite): Promise<{ baby: BabyRow; events: EventRow[] }> {
  const s = await state(db);
  return { baby: s.baby as BabyRow, events: s.events as EventRow[] };
}
const access = async (db: PGlite): Promise<JournalSource> => {
  const j = await journal(db), src = new JournalSource();
  await src.refresh(async (after) => j.filter((r) => r.seq > after));
  return src;
};
const viewOf = (snap: { baby: BabyRow; events: EventRow[] }, now: number, src: JournalSource | null) => {
  const d = viewData({ baby: snap.baby, events: snap.events, pumps: [], kv: {} }, { mine: {} }, new Date(now), false, src);
  return { d, v: { origin: d.origin, now: TODAY_INDEX * 1440 + d.nowMin, events: d.events, birthAt: d.birthAt.getTime() } };
};

describe('JournalSource : lecture et bascule automatique', () => {
  const entry = (seq: number): JournalRow => ({ seq, tbl: 'events', row_id: `e${seq}`, op: 'insert', old_row: null, new_row: { id: `e${seq}` }, changed_fields: [], source: null, changed_at: iso(0), recorded_at: iso(seq), actor: null, via: 'app', device: null, txid: seq, legacy_revision_id: null });

  it('table absente : pas de journal (mode dégradé), et on ne redemande pas avant le délai ; dès qu’elle existe, bascule', async () => {
    let t = 0, calls = 0, table: JournalRow[] | null = null;
    const src = new JournalSource(10 * 60_000, () => t);
    const fetch = async (after: number) => { calls++; return table === null ? null : table.filter((r) => r.seq > after); };
    await src.refresh(fetch);
    expect([src.status, src.get(), calls]).toEqual(['absent', null, 1]);
    t = 5 * 60_000;
    await src.refresh(fetch);
    expect(calls).toBe(1);
    table = [entry(1), entry(2)];
    t = 11 * 60_000;
    await src.refresh(fetch);
    expect(src.status).toBe('ready');
    expect(src.get()!.map((r) => r.seq)).toEqual([1, 2]);
  });

  it('ne lit que les entrées nouvelles, sans doublon, et annonce le changement par son estampille', async () => {
    const seen: number[] = [];
    const src = new JournalSource();
    const all = [entry(1), entry(2), entry(3)];
    const fetch = async (after: number) => { seen.push(after); return all.filter((r) => r.seq > after); };
    await src.refresh(fetch);
    const s1 = src.stamp();
    all.push(entry(4));
    await src.refresh(fetch);
    expect(seen).toEqual([0, 3]);
    expect(src.get()!.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect(src.stamp()).not.toBe(s1);
    await src.refresh(async () => [entry(2), entry(4)]); // renvoi d'entrées déjà connues
    expect(src.get()).toHaveLength(4);
  });

  it('une panne réseau garde ce qu’on a ; elle ne coupe ni ne vide le journal', async () => {
    const src = new JournalSource();
    await src.refresh(async () => [entry(1)]);
    await src.refresh(async () => { throw new Error('hors ligne'); });
    expect(src.status).toBe('ready');
    expect(src.get()).toHaveLength(1);
    const fresh = new JournalSource();
    await fresh.refresh(async () => { throw new Error('hors ligne'); });
    expect(fresh.status).toBe('unknown');
    expect(fresh.get()).toBeNull();
  });

  it('si la table disparaît (retour arrière niveau 2), on repasse en dégradé', async () => {
    const src = new JournalSource(0);
    await src.refresh(async () => [entry(1)]);
    await src.refresh(async () => null);
    expect([src.status, src.get()]).toEqual(['absent', null]);
  });
});

describe('le moteur sur une base migrée', () => {
  const NOW = Date.UTC(2026, 10, 5, 15, 0);

  async function scenario() {
    const { db, rows } = await migrated(NOW);
    const nap = rows.filter((r) => r.kind === 'sleep' && r.start > NOW - 5 * DAY && new Date(r.start).getUTCHours() === 12)[0] ?? rows.find((r) => r.kind === 'sleep')!;
    const gone = rows.filter((r) => r.kind === 'sleep').at(-6)!;
    await app(db, `update events set ended_at = $2 where id = $1`, [nap.id, iso(nap.stop! + 20 * 60_000)]);
    await app(db, `delete from events where id = $1`, [gone.id]);
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', $2, '{"ml":110}')`, [ID(900), iso(NOW - 40 * 60_000)]);
    return { db, nap, gone };
  }

  it('sans journal : mode dégradé ; avec le journal d’une base migrée : mode journal, mêmes cibles', async () => {
    const { db } = await scenario();
    const snap = await snapshotOf(db);
    const off = viewOf(snap, NOW, null), on = viewOf(snap, NOW, await access(db));
    const a = off.d.engine.intelligence(off.v), b = on.d.engine.intelligence(on.v);
    expect(a.mode).toBe('degraded');
    expect(b.mode).toBe('journal');
    expect(b.predictions.map((p) => p.target)).toEqual(a.predictions.map((p) => p.target));
  }, 120_000);

  it('une table absente ne change rien : dégradé, comme avant la migration', async () => {
    const { db } = await scenario();
    const src = new JournalSource();
    await src.refresh(async () => null);
    const { d, v } = viewOf(await snapshotOf(db), NOW, src);
    expect(d.engine.intelligence(v).mode).toBe('degraded');
  }, 120_000);

  it('le passé est reconstruit avec ce qui était su alors : correction et suppression ne réécrivent pas l’histoire', async () => {
    const { db, nap, gone } = await scenario();
    const j = await journal(db), src = await access(db);
    const { v } = viewOf(await snapshotOf(db), NOW, src);
    const opts = journalOptions(src, v);
    expect(opts.mode).toBe('journal');
    const view = opts.view!;
    const upd = j.find((r) => r.op === 'update' && r.row_id === nap.id)!, del = j.find((r) => r.op === 'delete' && r.row_id === gone.id)!;
    const at = (r: JournalRow, shift = 0) => Date.parse(r.recorded_at) + shift;
    const find = (t: number, id: string) => view([], t).find((e) => e.id === id);
    // juste avant la correction : l'ancienne fin ; juste après : la nouvelle
    expect(find(at(upd, -1), nap.id)?.end).toBe(nap.stop);
    expect(find(at(upd), nap.id)?.end).toBe(nap.stop! + 20 * 60_000);
    // la ligne supprimée existe tant qu'elle n'est pas supprimée, plus après
    expect(find(at(del, -1), gone.id)).toBeDefined();
    expect(find(at(del), gone.id)).toBeUndefined();
    // l'événement saisi après la migration n'existait pas avant son entrée au journal
    const ins = j.find((r) => r.op === 'insert' && r.row_id === ID(900))!;
    expect(find(at(ins, -1), ID(900))).toBeUndefined();
    expect(find(at(ins), ID(900))).toBeDefined();
  }, 120_000);

  it('journal en retard ou en avance d’une écriture sur l’écran : dégradé le temps d’un rechargement, jamais une reconstruction douteuse', async () => {
    const { db } = await scenario();
    const snap = await snapshotOf(db), src = await access(db);
    // l'écran a déjà effacé un événement (optimiste) que le journal connaît encore
    const behind = viewOf({ ...snap, events: snap.events.slice(1) }, NOW, src);
    expect(behind.d.engine.intelligence(behind.v).mode).toBe('degraded');
    // l'écran montre un événement que le journal ne connaît pas encore
    const ahead = viewOf({ ...snap, events: [...snap.events, { id: ID(901), kind: 'bib', started_at: iso(NOW - 10 * 60_000), ended_at: null, payload: {} } as EventRow] }, NOW, src);
    expect(ahead.d.engine.intelligence(ahead.v).mode).toBe('degraded');
    // les deux se rejoignent : mode journal
    const ok = viewOf(snap, NOW, src);
    expect(ok.d.engine.intelligence(ok.v).mode).toBe('journal');
  }, 120_000);

  it('une chaîne rompue (écriture non tracée) : dégradé', async () => {
    const { db } = await scenario();
    await db.exec(`alter table events disable trigger events_journal; alter table events disable trigger events_lock; alter table events disable trigger events_entry`);
    await db.exec(`update events set payload = '{"ml":1}' where id = '${ID(900)}'`);
    await db.exec(`alter table events enable trigger events_journal; alter table events enable trigger events_lock; alter table events enable trigger events_entry`);
    await app(db, `update events set payload = '{"ml":2}' where id = $1`, [ID(900)]);
    const { d, v } = viewOf(await snapshotOf(db), NOW, await access(db));
    expect(d.engine.intelligence(v).mode).toBe('degraded');
  }, 120_000);

  it('les prévisions affichées passent par le même moteur : nextSleep et bedtime reçoivent le mode journal', async () => {
    const { db } = await scenario();
    const { d, v } = viewOf(await snapshotOf(db), NOW, await access(db));
    const day = { ...v, now: TODAY_INDEX * 1440 + 11 * 60 };
    // même rapport mémorisé que l'intelligence : une seule évaluation pour les trois appels
    const r = d.engine.intelligence(day);
    d.engine.nextSleep(day);
    d.engine.bedtime(day);
    expect(d.engine.intelligence(day)).toBe(r);
    expect(r.mode).toBe('journal');
  }, 120_000);
});

// Même chose sur la vraie sauvegarde (jamais commitée : data/ est local) : lignes réelles, secondes dans les heures, un dodo en cours.
const DIR = new URL('../../../data/', import.meta.url);
const file = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^canaille-sauvegarde-.*\.json$/.test(f)).sort().pop() : undefined;
const real = file ? (JSON.parse(readFileSync(new URL(file, DIR), 'utf8')) as { baby: BabyRow; events: Array<Record<string, unknown>> }) : null;

describe.skipIf(!real)('le moteur sur la vraie sauvegarde, après migration', () => {
  it('mode journal, rapide, avec les heures à la seconde (dodo en cours exclu, comme à l’écran)', async () => {
    const db = await base();
    await db.query('insert into baby select * from jsonb_populate_recordset(null::baby, $1)', [JSON.stringify([real!.baby])]);
    await db.query('insert into events select * from jsonb_populate_recordset(null::events, $1)', [JSON.stringify(real!.events)]);
    await db.exec(MIG('0004_journal.sql'));
    const snap = await snapshotOf(db);
    const last = Math.max(...snap.events.map((e) => Date.parse(e.ended_at ?? e.started_at)));
    const now = last + 30 * 60_000, src = await access(db);
    const { d, v } = viewOf(snap, now, src);
    const t0 = performance.now();
    const rep = d.engine.intelligence(v);
    const ms = performance.now() - t0;
    expect(rep.mode).toBe('journal');
    expect(rep.predictions.map((p) => p.target).sort()).toEqual(['bedtime', 'feed', 'nap_duration', 'nap_start']);
    expect(ms).toBeLessThan(8000);
  }, 180_000);
});
