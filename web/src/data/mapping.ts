import { fromMinutes, toMinutes } from '@/lib/time';
import type { EventPayload, EventRow, NewEvent, PumpRow, ViewEvent, ViewPump } from './types';

/** Ligne de la base → événement lisible par la logique de vue. */
export function eventFromRow(row: EventRow, origin: Date): ViewEvent {
  const e: ViewEvent = { id: row.id, k: row.kind, a: toMinutes(new Date(row.started_at), origin) };
  if (row.ended_at) e.b = toMinutes(new Date(row.ended_at), origin);
  const p = row.payload;
  if (p.ml !== undefined) e.ml = p.ml;
  if (p.lait !== undefined) e.lait = p.lait;
  if (p.side !== undefined) e.side = p.side;
  if (p.dur !== undefined) e.dur = p.dur;
  if (p.v !== undefined) e.v = p.v;
  return e;
}

/** Événement de la vue (minutes) → ce qu'on écrit en base. Le dodo en cours n'a pas de fin. */
export function newEventFromView(e: Omit<ViewEvent, 'id'>, origin: Date): NewEvent {
  const payload: EventPayload = {};
  if (e.ml !== undefined) payload.ml = e.ml;
  if (e.lait) payload.lait = e.lait;
  if (e.side) payload.side = e.side;
  if (e.dur !== undefined) payload.dur = e.dur;
  if (e.v) payload.v = e.v;
  return {
    kind: e.k,
    startedAt: fromMinutes(e.a, origin),
    endedAt: e.b !== undefined ? fromMinutes(e.b, origin) : null,
    payload,
  };
}

export function pumpFromRow(row: PumpRow, origin: Date): ViewPump {
  return { id: row.id, a: toMinutes(new Date(row.at), origin), g: row.left_ml, d: row.right_ml };
}
