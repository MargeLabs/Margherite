// Le marqueur coucher / réveil voyage dans `payload.mark` (jsonb : aucune migration) de la base jusqu'au moteur.
import { describe, expect, it } from 'vitest';
import { eventFromRaw, rawFromEvent } from '@/engine/adapters';
import { eventFromRow, newEventFromView } from './mapping';
import type { EventRow } from './types';

const origin = new Date(2026, 8, 1);
const row = (mark?: 'bed' | 'wake' | 'both'): EventRow => ({
  id: 'e1', kind: 'sleep', started_at: new Date(2026, 8, 5, 20, 30).toISOString(), ended_at: new Date(2026, 8, 6, 6, 40).toISOString(), payload: mark ? { mark } : {},
});

describe('marqueur de nuit : de la ligne à la vue et retour', () => {
  it('payload.mark devient mk dans la vue, et inversement', () => {
    expect(eventFromRow(row('bed'), origin).mk).toBe('bed');
    expect(eventFromRow(row(), origin).mk).toBeUndefined();
    const v = eventFromRow(row('both'), origin);
    const { id: _id, ...rest } = v;
    expect(newEventFromView(rest, origin).payload.mark).toBe('both');
  });
  it('un dodo sans marqueur n’écrit aucune clé `mark`', () => {
    const v = eventFromRow(row(), origin);
    const { id: _id, ...rest } = v;
    expect('mark' in newEventFromView(rest, origin).payload).toBe(false);
  });
  it('le moteur lit et réécrit le même marqueur', () => {
    const e = eventFromRaw({ ...row('wake'), payload: { mark: 'wake' } });
    expect(e.mark).toBe('wake');
    expect(rawFromEvent(e).payload.mark).toBe('wake');
    expect(eventFromRaw(row()).mark).toBeUndefined();
  });
});
