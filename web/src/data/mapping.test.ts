import { describe, expect, it } from 'vitest';
import { eventFromRow, newEventFromView, pumpFromRow } from './mapping';
import { originOf } from '@/lib/time';
import type { EventRow } from './types';

const now = new Date(2026, 9, 27, 14, 20);
const origin = originOf(now);

describe('correspondance base ↔ vue', () => {
  it('un biberon', () => {
    const row: EventRow = { id: 'x', kind: 'bib', started_at: new Date(2026, 9, 27, 12, 40).toISOString(), ended_at: null, payload: { ml: 150 } };
    expect(eventFromRow(row, origin)).toEqual({ id: 'x', k: 'bib', a: 27 * 1440 + 12 * 60 + 40, ml: 150 });
  });

  it('un dodo en cours n’a pas de fin, un dodo terminé en a une', () => {
    const run: EventRow = { id: 's1', kind: 'sleep', started_at: new Date(2026, 9, 27, 13, 50).toISOString(), ended_at: null, payload: {} };
    expect(eventFromRow(run, origin).b).toBeUndefined();
    const done: EventRow = { ...run, ended_at: new Date(2026, 9, 27, 14, 15).toISOString() };
    expect(eventFromRow(done, origin).b).toBe(27 * 1440 + 14 * 60 + 15);
  });

  it('aller-retour d’un événement de la vue', () => {
    const view = { k: 'sein' as const, a: 26 * 1440 + 9 * 60 + 55, side: 'D' as const, dur: 15 };
    const n = newEventFromView(view, origin);
    expect(n.kind).toBe('sein');
    expect(n.startedAt).toEqual(new Date(2026, 9, 26, 9, 55));
    expect(n.endedAt).toBeNull();
    expect(n.payload).toEqual({ side: 'D', dur: 15 });
  });

  it('un tirage', () => {
    expect(pumpFromRow({ id: 'p', legacy_id: null, at: new Date(2026, 9, 24, 1, 37).toISOString(), left_ml: 90, right_ml: 30 }, origin)).toEqual({ id: 'p', a: 24 * 1440 + 60 + 37, g: 90, d: 30 });
  });
});
