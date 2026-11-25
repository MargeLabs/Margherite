// Historique d'un événement d'après le journal des écritures : créations, arrêts, corrections rétroactives, suppressions, points de départ.
import { describe, expect, it } from 'vitest';
import { eventHistories, type JournalEntry } from './history';

let seq = 0;
const row = (id: string, start: string, end: string | null, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ id, kind: 'sleep', started_at: start, ended_at: end, payload: {}, ...extra });
function entry(op: string, id: string, oldRow: Record<string, unknown> | null, newRow: Record<string, unknown> | null, at: string, extra: Partial<JournalEntry> = {}): JournalEntry {
  return { seq: ++seq, tbl: 'events', row_id: id, op, old_row: oldRow, new_row: newRow, changed_fields: [], changed_at: at, recorded_at: at, via: 'app', ...extra };
}
const T = (s: string): number => Date.parse(`2026-11-10T${s}:00Z`);

describe('historique des écritures', () => {
  it('chrono lancé puis arrêté : une création, un arrêt, l’instant où la fin a été sue', () => {
    const open = row('a', '2026-11-10T10:00:00Z', null), done = row('a', '2026-11-10T10:00:00Z', '2026-11-10T11:30:00Z');
    const h = eventHistories([entry('insert', 'a', null, open, '2026-11-10T10:00:00Z'), entry('stop', 'a', open, done, '2026-11-10T11:31:00Z', { changed_fields: ['ended_at'] })]).get('a')!;
    expect(h).toMatchObject({ firstOp: 'insert', fromBaseline: false, entries: 2, stops: 1, reopens: 0, timeCorrections: 0, valueCorrections: 0, deletedAt: null });
    expect(h.endRecordedAt).toBe(T('11:31'));
    expect(h.headStart).toBe(T('10:00'));
    expect(h.headEnd).toBe(T('11:30'));
  });

  it('un sommeil saisi déjà terminé n’est pas un arrêt de chrono, mais sa fin est sue à la saisie', () => {
    const done = row('b', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z');
    const h = eventHistories([entry('insert', 'b', null, done, '2026-11-10T15:00:00Z')]).get('b')!;
    expect(h.stops).toBe(0);
    expect(h.endRecordedAt).toBe(T('15:00'));
  });

  it('correction rétroactive de l’heure de début ou de fin d’un sommeil terminé : comptée, original conservé', () => {
    const v1 = row('c', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z'), v2 = row('c', '2026-11-10T09:40:00Z', '2026-11-10T11:00:00Z'), v3 = row('c', '2026-11-10T09:40:00Z', '2026-11-10T11:10:00Z');
    const h = eventHistories([
      entry('insert', 'c', null, v1, '2026-11-10T12:00:00Z'),
      entry('update', 'c', v1, v2, '2026-11-10T12:05:00Z', { changed_fields: ['started_at'] }),
      entry('update', 'c', v2, v3, '2026-11-10T12:06:00Z', { changed_fields: ['ended_at'] }),
    ]).get('c')!;
    expect(h.timeCorrections).toBe(2);
    expect(h.originalStart).toBe(T('10:00'));
    expect(h.originalEnd).toBe(T('11:00'));
    expect(h.headStart).toBe(T('09:40'));
    expect(h.endRecordedAt).toBe(T('12:00')); // corriger la fin d'un sommeil déjà terminé ne change pas quand la fin a été sue
  });

  it('arrêt avec un marqueur de nuit dans le même geste : un arrêt, pas une correction de valeur', () => {
    const open = row('d', '2026-11-10T06:00:00Z', null), done = row('d', '2026-11-10T06:00:00Z', '2026-11-10T07:00:00Z', { payload: { mark: 'wake' } });
    const h = eventHistories([entry('insert', 'd', null, open, '2026-11-10T06:00:00Z'), entry('update', 'd', open, done, '2026-11-10T07:00:00Z', { changed_fields: ['ended_at', 'payload'] })]).get('d')!;
    expect(h).toMatchObject({ stops: 1, valueCorrections: 0, timeCorrections: 0 });
  });

  it('correction d’une valeur (quantité) : comptée à part', () => {
    const v1 = row('e', '2026-11-10T08:00:00Z', null, { kind: 'bib', payload: { ml: 90 } }), v2 = row('e', '2026-11-10T08:00:00Z', null, { kind: 'bib', payload: { ml: 120 } });
    const h = eventHistories([entry('insert', 'e', null, v1, '2026-11-10T08:00:00Z'), entry('update', 'e', v1, v2, '2026-11-10T08:30:00Z', { changed_fields: ['payload'] })]).get('e')!;
    expect(h).toMatchObject({ valueCorrections: 1, timeCorrections: 0 });
  });

  it('réouverture : l’instant où la fin a été sue est annulé jusqu’au nouvel arrêt', () => {
    const open = row('f', '2026-11-10T10:00:00Z', null), done = row('f', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z');
    const base = [entry('insert', 'f', null, open, '2026-11-10T10:00:00Z'), entry('stop', 'f', open, done, '2026-11-10T11:00:00Z', { changed_fields: ['ended_at'] }), entry('reopen', 'f', done, open, '2026-11-10T11:05:00Z', { changed_fields: ['ended_at'] })];
    const reopened = eventHistories(base).get('f')!;
    expect(reopened).toMatchObject({ stops: 1, reopens: 1, endRecordedAt: null, headEnd: null });
    const again = eventHistories([...base, entry('stop', 'f', open, done, '2026-11-10T12:00:00Z', { changed_fields: ['ended_at'] })]).get('f')!;
    expect(again.endRecordedAt).toBe(T('12:00'));
    expect(again.stops).toBe(2);
  });

  it('suppression : tracée, sans version courante', () => {
    const v = row('g', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z');
    const h = eventHistories([entry('insert', 'g', null, v, '2026-11-10T11:00:00Z'), entry('delete', 'g', v, null, '2026-11-10T13:00:00Z')]).get('g')!;
    expect(h.deletedAt).toBe(T('13:00'));
    expect(h.headStart).toBeNull();
    expect(h.originalStart).toBe(T('10:00'));
  });

  it('recréé avec le même identifiant après une suppression : il n’est plus supprimé', () => {
    const v = row('r', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z');
    const h = eventHistories([entry('insert', 'r', null, v, '2026-11-10T11:00:00Z'), entry('delete', 'r', v, null, '2026-11-10T11:05:00Z'), entry('insert', 'r', null, v, '2026-11-10T11:06:00Z')]).get('r')!;
    expect(h.deletedAt).toBeNull();
    expect(h.headStart).toBe(T('10:00'));
  });

  it('point de départ : l’histoire d’avant est déclarée inconnue, et la fin n’y est pas « sue » à la migration', () => {
    const v = row('h', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z');
    const h = eventHistories([entry('baseline', 'h', null, v, '2026-11-05T17:00:00Z', { via: 'migration' })]).get('h')!;
    expect(h).toMatchObject({ firstOp: 'baseline', fromBaseline: true, entries: 0, endRecordedAt: null, lastChangedAt: null });
    expect(h.headStart).toBe(Date.parse('2026-11-01T10:00:00Z'));
  });

  it('reprise des corrections d’avant la migration (0002) : l’original est la version la plus ancienne', () => {
    const v0 = row('i', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z'), v1 = row('i', '2026-11-01T10:20:00Z', '2026-11-01T11:00:00Z');
    const h = eventHistories([
      entry('legacy_update', 'i', v0, null, '2026-11-02T08:00:00Z', { via: 'migration' }),
      entry('baseline', 'i', null, v1, '2026-11-05T17:00:00Z', { via: 'migration' }),
    ]).get('i')!;
    expect(h).toMatchObject({ firstOp: 'legacy', fromBaseline: true, legacyCorrections: 1, entries: 0 });
    expect(h.originalStart).toBe(Date.parse('2026-11-01T10:00:00Z'));
    expect(h.headStart).toBe(Date.parse('2026-11-01T10:20:00Z'));
  });

  it('suppression d’avant la migration : tracée', () => {
    const v = row('j', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z');
    expect(eventHistories([entry('legacy_delete', 'j', v, null, '2026-11-02T08:00:00Z', { via: 'migration' })]).get('j')!.deletedAt).toBe(Date.parse('2026-11-02T08:00:00Z'));
  });

  it('ignore les autres tables et ne dépend pas de l’ordre de lecture', () => {
    const v = row('k', '2026-11-10T10:00:00Z', null), w = row('k', '2026-11-10T10:00:00Z', '2026-11-10T11:00:00Z');
    const rows = [entry('stop', 'k', v, w, '2026-11-10T11:00:00Z'), entry('insert', 'k', null, v, '2026-11-10T10:00:00Z'), { ...entry('insert', 'p', null, { id: 'p' }, '2026-11-10T10:00:00Z'), tbl: 'pumps' }];
    // seq croissant dans l'ordre d'écriture : on les redonne dans le désordre
    rows[0]!.seq = 2; rows[1]!.seq = 1;
    const out = eventHistories(rows);
    expect([...out.keys()]).toEqual(['k']);
    expect(out.get('k')).toMatchObject({ stops: 1, entries: 2 });
  });
});
