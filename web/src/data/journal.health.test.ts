// Le contrôle de santé du journal (supabase/checks/journal_health.sql) : il doit être tout vert sur une base saine,
// et dénoncer un déclencheur désactivé, un droit d'écriture rendu, une écriture sans trace.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { app, fresh, ID } from './journalTestkit';

vi.setConfig({ testTimeout: 30_000 });
const SQL = readFileSync(new URL('../../supabase/checks/journal_health.sql', import.meta.url), 'utf8');
type Db = Awaited<ReturnType<typeof fresh>>;
const check = async (db: Db) => (await db.query<{ controle: string; detail: string; statut: string }>(SQL)).rows;
const bad = (rows: Awaited<ReturnType<typeof check>>) => rows.filter((r) => r.statut !== 'ok' && r.statut !== 'info');

describe('contrôle de santé du journal', () => {
  it('base saine : tout est « ok », 14 déclencheurs vérifiés', async () => {
    const db = await fresh();
    await app(db, `insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{"ml":90}')`, [ID(1)]);
    const rows = await check(db);
    expect(bad(rows)).toEqual([]);
    expect(rows.filter((r) => r.controle === '1 déclencheur')).toHaveLength(14);
  });

  it('un déclencheur désactivé est dénoncé', async () => {
    const db = await fresh();
    await db.exec('alter table events disable trigger events_journal');
    expect(bad(await check(db))).toEqual([{ controle: '1 déclencheur', detail: 'events.events_journal', statut: 'DÉSACTIVÉ (D)' }]);
  });

  it('un déclencheur supprimé est dénoncé', async () => {
    const db = await fresh();
    await db.exec('drop trigger pumps_lock on pumps');
    expect(bad(await check(db))).toEqual([{ controle: '1 déclencheur', detail: 'pumps.pumps_lock', statut: 'ABSENT' }]);
  });

  it('un droit d’écriture rendu sur le journal est dénoncé', async () => {
    const db = await fresh();
    await db.exec('grant insert on journal to authenticated');
    expect(bad(await check(db)).map((r) => [r.controle, r.detail])).toEqual([['2 droits d\'écriture', 'authenticated']]);
  });

  it('une écriture sans trace est dénoncée', async () => {
    const db = await fresh();
    await db.exec('alter table events disable trigger events_journal');
    await db.query(`insert into events (id, kind, started_at, payload) values ($1, 'bib', now(), '{}')`, [ID(2)]);
    const rows = bad(await check(db));
    expect(rows.map((r) => r.controle).sort()).toEqual(['1 déclencheur', '5 sans trace']);
  });
});
