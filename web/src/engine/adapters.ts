import type { EngineEvent, EngineEventKind } from './types';

/** Forme d'une ligne de la table `events`, avec les dates que renvoie un export complet. */
export interface RawEventRow {
  id: string;
  kind: 'bib' | 'sein' | 'sleep' | 'chg';
  started_at: string;
  ended_at: string | null;
  payload: { ml?: number; lait?: string; side?: 'G' | 'D'; dur?: number | null; v?: string };
  created_at?: string;
  updated_at?: string;
}

const KIND: Record<RawEventRow['kind'], EngineEventKind> = { bib: 'bottle', sein: 'breast', sleep: 'sleep', chg: 'diaper' };
const ROW_KIND: Record<EngineEventKind, RawEventRow['kind']> = { bottle: 'bib', breast: 'sein', sleep: 'sleep', diaper: 'chg' };

export function eventFromRaw(r: RawEventRow): EngineEvent {
  const e: EngineEvent = { id: r.id, kind: KIND[r.kind], start: Date.parse(r.started_at) };
  if (r.ended_at) e.end = Date.parse(r.ended_at);
  if (r.payload.ml !== undefined) e.ml = r.payload.ml;
  if (r.payload.lait) e.milk = r.payload.lait;
  if (r.payload.side) e.side = r.payload.side;
  if (r.payload.dur !== undefined) e.durationMin = r.payload.dur;
  if (r.created_at) e.enteredAt = Date.parse(r.created_at);
  if (r.ended_at && r.updated_at) e.endKnownAt = Date.parse(r.updated_at);
  return e;
}

export function rawFromEvent(e: EngineEvent): RawEventRow {
  const payload: RawEventRow['payload'] = {};
  if (e.ml !== undefined) payload.ml = e.ml;
  if (e.milk) payload.lait = e.milk;
  if (e.side) payload.side = e.side;
  if (e.durationMin !== undefined) payload.dur = e.durationMin;
  if (e.kind === 'diaper') payload.v = 'pipi';
  return { id: e.id, kind: ROW_KIND[e.kind], started_at: new Date(e.start).toISOString(), ended_at: e.end !== undefined ? new Date(e.end).toISOString() : null, payload };
}
