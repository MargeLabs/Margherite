// Réglages partagés (suivis, notes, humeur…) : la logique de vue les manipule en « minutes depuis l'origine » et en « numéro de jour » ;
// la base les stocke avec de vraies dates, pour qu'ils restent justes quand la fenêtre glisse.
import { calendarDays, fromMinutes, localDay, localStamp, parseLocal, toMinutes } from '@/lib/time';
import type { KvDocs } from './repo';

export interface Tracker {
  id: string;
  name: string;
  kind: 'fait' | 'compteur' | 'qte';
  unit: string;
  icon: string;
}
export interface TrackerLog {
  id: string;
  tid: string;
  /** minutes depuis l'origine */
  a: number;
  v: number;
}
export interface Note {
  id: string;
  text: string;
}
export type WellDay = Record<string, string | string[]>;

/** Ce que la logique de vue lit. */
export interface SharedView {
  trk: Tracker[];
  trl: TrackerLog[];
  notes: Note[];
  well: Record<number, WellDay>;
  tipsX: string[];
}

/** Les cases « maman » de l'humeur ne sont jamais envoyées : elles restent sur l'appareil (le code famille est partagé). */
export const MINE_KEYS = ['mhum', 'mnuit', 'mall', 'mcorps', 'mmoral', 'msoi'];
export type MineByDay = Record<string, WellDay>;

interface StoredLog {
  id: string;
  tid: string;
  at: string;
  v: number;
}

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

export function sharedToView(kv: KvDocs, mine: MineByDay, origin: Date): SharedView {
  const trl: TrackerLog[] = [];
  for (const l of arr<StoredLog>(kv.trl)) {
    const at = parseLocal(String(l.at));
    if (at) trl.push({ id: l.id, tid: l.tid, a: toMinutes(at, origin), v: l.v });
  }
  const well: Record<number, WellDay> = {};
  const days = new Set([...Object.keys(obj(kv.well)), ...Object.keys(mine)]);
  for (const day of days) {
    const date = parseLocal(day);
    if (!date) continue;
    well[calendarDays(origin, date)] = { ...(obj(kv.well)[day] as WellDay | undefined), ...mine[day] };
  }
  return { trk: arr<Tracker>(kv.trk), trl, notes: arr<Note>(kv.notes), well, tipsX: arr<string>(kv.tipsX) };
}

export interface SharedWrite {
  kv: KvDocs;
  /** présent seulement si les cases « maman » ont changé */
  mine?: MineByDay;
}

/** Une modification de la logique de vue (clés partielles, valeurs complètes) → ce qu'il faut écrire en base et sur l'appareil. */
export function viewToShared(patch: Partial<SharedView>, origin: Date): SharedWrite {
  const kv: KvDocs = {};
  let mine: MineByDay | undefined;
  if (patch.trk) kv.trk = patch.trk;
  if (patch.notes) kv.notes = patch.notes;
  if (patch.tipsX) kv.tipsX = patch.tipsX;
  if (patch.trl) kv.trl = patch.trl.map((l): StoredLog => ({ id: l.id, tid: l.tid, at: localStamp(fromMinutes(l.a, origin)), v: l.v }));
  if (patch.well) {
    const shared: Record<string, WellDay> = {};
    mine = {};
    for (const [idx, day] of Object.entries(patch.well)) {
      const key = localDay(fromMinutes(Number(idx) * 1440, origin));
      const s: WellDay = {};
      const m: WellDay = {};
      for (const [k, v] of Object.entries(day)) {
        const empty = Array.isArray(v) ? v.length === 0 : !v;
        if (empty) continue;
        (MINE_KEYS.includes(k) ? m : s)[k] = v;
      }
      if (Object.keys(s).length) shared[key] = s;
      if (Object.keys(m).length) mine[key] = m;
    }
    kv.well = shared;
  }
  return mine ? { kv, mine } : { kv };
}
