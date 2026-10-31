'use client';

// Le foyer : relie la base (Repo) à la logique de vue portée de la maquette.
// Chaque écriture s'affiche tout de suite (optimiste), part dans une file (l'ordre est gardé : un ajout puis sa modification),
// et si elle échoue l'écran revient à l'état de la base et la logique affiche son message d'erreur.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ageOf, bornText } from '@/lib/age';
import { photoToDataUrl } from '@/lib/photo';
import { fromMinutes, originOf, parseLocal, toMinutes } from '@/lib/time';
import { backupJson, backupName, saveFile } from './exportData';
import { eventFromRow, newEventFromView, pumpFromRow } from './mapping';
import { parsePumpFile } from './pumpImport';
import { EMPTY_SNAPSHOT, RunningConflictError, type KvKey, type Repo, type Snapshot } from './repo';
import { sharedToView, viewToShared, type MineByDay, type SharedView } from './shared';
import type { BabyRow, EventRow, PumpRow, Side, ViewEvent, ViewPump } from './types';

const WINDOW_DAYS = 30;
const PREFS_KEY = 'margherite.prefs.v1';

/** Ce que renvoie une écriture : l'identifiant (connu tout de suite) et une promesse qui dit si la base a accepté. */
export interface Write {
  id: string;
  done: Promise<void>;
}

export interface EventPatch {
  a?: number;
  b?: number | null;
  ml?: number;
  side?: Side;
  v?: string;
}

/** Tout ce que la logique de vue (`this.props.store`) peut lire ou appeler. */
export interface ViewStore {
  hasBaby: boolean;
  babyName: string;
  babyTitle: string;
  birthAt: Date;
  bc: { name: string; age: string; born: string; photo: string; hasPhoto: boolean; noPhoto: boolean };
  origin: Date;
  nowMin: number;
  dark: boolean;
  events: ViewEvent[];
  pumps: ViewPump[];
  /** début du dodo en cours (minutes), null s'il n'y en a pas */
  run: number | null;
  shared: SharedView;
  local: { cv?: unknown; dstart?: string };
  gate: { submit(code: string): Promise<string | null> } | null;
  addEvent(o: Omit<ViewEvent, 'id'>): Write;
  restoreEvent(e: ViewEvent): Write;
  updateEvent(id: string, patch: EventPatch): Write;
  removeEvent(id: string): Write;
  startRun(a: number): Write;
  stopRun(b: number): Write;
  cancelRun(): Write;
  reopenRun(id: string): Write;
  addPump(p: { a: number; g: number; d: number }): Write;
  removePump(id: string): Write;
  setShared(patch: Partial<SharedView>): void;
  setLocal(patch: { cv?: unknown; dstart?: string }): void;
  saveBaby(name?: string, date?: string, time?: string): { error: string | null; done: Promise<void> };
  /** 
ull retire la photo */
  setPhoto(file: File | null): Write;
  importPumpsFile(file: File): Promise<string>;
  exportData(): Promise<void>;
  logout(): void;
}

export interface Prefs {
  cv?: unknown;
  dstart?: string;
  mine: MineByDay;
}

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { mine: {}, ...(JSON.parse(raw) as Partial<Prefs>) } : { mine: {} };
  } catch {
    return { mine: {} };
  }
}

const rejected = (e: Error): Write => ({ id: '', done: Promise.reject(e) });

/** La partie « lecture » du store : ce que la base contient, converti dans le repère de la maquette (minutes depuis l'origine). */
export function viewData(snap: Snapshot, prefs: Prefs, now: Date, dark: boolean) {
  const origin = originOf(now);
  const birthRow = snap.baby;
  const birth = birthRow ? new Date(birthRow.birth_at) : now;
  const age = ageOf(birth, now);
  const name = birthRow?.first_name ?? 'Ton bébé';
  const open = snap.events.find((e) => e.kind === 'sleep' && e.ended_at === null);
  return {
    hasBaby: !!birthRow,
    babyName: name,
    babyTitle: `${name}, ${Math.floor(age.days / 7)} semaines`,
    birthAt: birth,
    bc: { name, age: age.text, born: bornText(birth, now), photo: birthRow?.photo ?? '', hasPhoto: !!birthRow?.photo, noPhoto: !birthRow?.photo },
    origin,
    nowMin: now.getHours() * 60 + now.getMinutes(),
    dark,
    events: snap.events.filter((e) => !(e.kind === 'sleep' && e.ended_at === null)).map((e) => eventFromRow(e, origin)).filter((e) => e.a >= 0),
    pumps: snap.pumps.map((p) => pumpFromRow(p, origin)).filter((p) => p.a >= 0),
    run: open ? toMinutes(new Date(open.started_at), origin) : null,
    shared: sharedToView(snap.kv, prefs.mine, origin),
    local: { ...(prefs.cv !== undefined ? { cv: prefs.cv } : {}), ...(prefs.dstart !== undefined ? { dstart: prefs.dstart } : {}) },
  };
}

/** Ce que la logique lit quand il n'y a ni bébé ni données (écran du code, premier lancement). */
export function blankStore(now: Date, over: Partial<ViewStore> = {}): ViewStore {
  const reject = (): never => {
    throw new Error('Pas de base connectée.');
  };
  return {
    hasBaby: false,
    babyName: 'Ton bébé',
    babyTitle: 'Ton bébé, 0 semaine',
    birthAt: now,
    bc: { name: 'Ton bébé', age: '', born: '', photo: '', hasPhoto: false, noPhoto: true },
    origin: originOf(now),
    nowMin: now.getHours() * 60 + now.getMinutes(),
    dark: false,
    events: [],
    pumps: [],
    run: null,
    shared: { trk: [], trl: [], notes: [], well: {}, tipsX: [] },
    local: {},
    gate: null,
    addEvent: reject,
    restoreEvent: reject,
    updateEvent: reject,
    removeEvent: reject,
    startRun: reject,
    stopRun: reject,
    cancelRun: reject,
    reopenRun: reject,
    addPump: reject,
    removePump: reject,
    setShared: () => undefined,
    setLocal: () => undefined,
    saveBaby: () => ({ error: null, done: Promise.reject(new Error('Pas de base connectée.')) }),
    setPhoto: reject,
    importPumpsFile: reject,
    exportData: reject,
    logout: () => undefined,
    ...over,
  };
}

/** Valide le profil saisi (prénom, date et heure de naissance) ; null si tout est bon. */
export function babyProblem(name = '', date = '', time = '', now: Date): { error: string } | { birth: Date } {
  if (!name.trim()) return { error: 'Donne un prénom.' };
  if (!date) return { error: 'Indique la date de naissance.' };
  if (!time) return { error: 'Indique l’heure de naissance.' };
  const birth = parseLocal(`${date}T${time}`);
  if (!birth) return { error: 'Cette date de naissance n’est pas valide.' };
  if (birth.getTime() > now.getTime() + 60_000) return { error: 'La naissance ne peut pas être dans le futur.' };
  return { birth };
}

export function useHousehold(repo: Repo, opts: { fixedNow?: Date; onLogout: () => void }) {
  const [snap, setSnapState] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => opts.fixedNow ?? new Date());
  const [dark, setDark] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(() => readPrefs());
  const [notice, setNotice] = useState<string | null>(null);

  const snapRef = useRef<Snapshot | null>(null);
  const nowRef = useRef(now);
  const seq = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const prefsRef = useRef(prefs);
  nowRef.current = now;
  prefsRef.current = prefs;

  const setSnap = useCallback((s: Snapshot) => {
    snapRef.current = s;
    setSnapState(s);
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    const started = seq.current;
    try {
      const s = await repo.load(WINDOW_DAYS);
      if (started !== seq.current) {
        // une écriture est partie pendant la lecture : cette lecture est périmée, on recommence quand la file est vide
        void queue.current.then(() => reload());
        return;
      }
      setSnap(s);
      setLoadError(null);
    } catch (e) {
      if (!snapRef.current) setLoadError((e as Error).message || 'Lecture impossible.');
    }
  }, [repo, setSnap]);

  useEffect(() => {
    void reload();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = repo.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload(), 250);
    });
    const back = () => {
      if (document.visibilityState === 'visible') {
        if (!opts.fixedNow) setNow(new Date());
        void reload();
      }
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('online', back);
    const tick = opts.fixedNow ? undefined : setInterval(() => setNow(new Date()), 20_000);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('online', back);
    };
  }, [repo, reload, opts.fixedNow]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Affiche tout de suite, écrit dans l'ordre, et revient à la base si ça échoue. */
  const write = useCallback(
    (optimistic: (s: Snapshot) => Snapshot, call: () => Promise<unknown>): Promise<void> => {
      seq.current += 1;
      setSnap(optimistic(snapRef.current ?? EMPTY_SNAPSHOT));
      const p = queue.current.then(call);
      queue.current = p.catch(() => undefined);
      return p.then(
        () => undefined,
        (e: unknown) => {
          seq.current += 1;
          void reload();
          throw e;
        },
      );
    },
    [reload, setSnap],
  );

  const store = useMemo<ViewStore | null>(() => {
    if (!snap) return null;
    const origin = originOf(now);
    const iso = (m: number) => fromMinutes(m, originOf(nowRef.current)).toISOString();
    const openRow = () => snapRef.current?.events.find((e) => e.kind === 'sleep' && e.ended_at === null);
    const failSoft = (p: Promise<void>) => p.catch(() => setNotice('Une modification n’a pas pu être enregistrée.'));

    const insert = (row: EventRow): Write => ({ id: row.id, done: write((s) => ({ ...s, events: [...s.events, row] }), () => repo.insertEvent(row)) });
    const toRow = (o: Omit<ViewEvent, 'id'>, id: string): EventRow => {
      const n = newEventFromView(o, originOf(nowRef.current));
      return { id, kind: n.kind, started_at: n.startedAt.toISOString(), ended_at: n.endedAt ? n.endedAt.toISOString() : null, payload: n.payload };
    };
    const update = (id: string, patch: EventPatch): Write => {
      const cur = snapRef.current?.events.find((e) => e.id === id);
      if (!cur) return rejected(new Error('Événement introuvable.'));
      const upd: Partial<Pick<EventRow, 'started_at' | 'ended_at' | 'payload'>> = {};
      if (patch.a !== undefined) upd.started_at = iso(patch.a);
      if (patch.b !== undefined) upd.ended_at = patch.b === null ? null : iso(patch.b);
      const payload = { ...cur.payload };
      if (patch.ml !== undefined) payload.ml = patch.ml;
      if (patch.side !== undefined) payload.side = patch.side;
      if (patch.v !== undefined) payload.v = patch.v;
      upd.payload = payload;
      return { id, done: write((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...e, ...upd } : e)) }), () => repo.patchEvent(id, upd)) };
    };
    const remove = (id: string): Write => ({ id, done: write((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }), () => repo.deleteEvent(id)) });
    const mintId = (): string => crypto.randomUUID();

    const s: ViewStore = {
      ...viewData(snap, prefs, now, dark),
      gate: null,

      addEvent: (o) => insert(toRow(o, mintId())),
      restoreEvent: (e) => {
        const { id, ...rest } = e;
        return insert(toRow(rest, id));
      },
      updateEvent: update,
      removeEvent: remove,
      startRun: (a) => (openRow() ? rejected(new RunningConflictError()) : insert(toRow({ k: 'sleep', a }, mintId()))),
      stopRun: (b) => {
        const r = openRow();
        return r ? update(r.id, { b }) : rejected(new Error('Aucun dodo en cours.'));
      },
      cancelRun: () => {
        const r = openRow();
        return r ? remove(r.id) : { id: '', done: Promise.resolve() };
      },
      reopenRun: (id) => update(id, { b: null }),
      addPump: ({ a, g, d }) => {
        const row: PumpRow = { id: mintId(), legacy_id: null, at: iso(a), left_ml: g, right_ml: d };
        return { id: row.id, done: write((x) => ({ ...x, pumps: [...x.pumps, row] }), () => repo.insertPump(row)) };
      },
      removePump: (id) => ({ id, done: write((x) => ({ ...x, pumps: x.pumps.filter((p) => p.id !== id) }), () => repo.deletePump(id)) }),

      setShared: (patch) => {
        const w = viewToShared(patch, originOf(nowRef.current));
        if (w.mine) {
          const next = { ...prefsRef.current, mine: w.mine };
          prefsRef.current = next;
          setPrefsState(next);
          localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        }
        for (const [key, value] of Object.entries(w.kv) as Array<[KvKey, unknown]>) {
          failSoft(write((x) => ({ ...x, kv: { ...x.kv, [key]: value } }), () => repo.setKv(key, value)));
        }
      },
      setLocal: (patch) => {
        const next = { ...prefsRef.current, ...patch };
        prefsRef.current = next;
        setPrefsState(next);
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      },

      saveBaby: (nameIn, date, time) => {
        const r = babyProblem(nameIn, date, time, nowRef.current);
        if ('error' in r) return { error: r.error, done: Promise.resolve() };
        const photo = snapRef.current?.baby?.photo;
        const row = { id: 1 as const, first_name: (nameIn ?? '').trim(), birth_at: r.birth.toISOString(), ...(photo ? { photo } : {}) };
        return { error: null, done: write((x) => ({ ...x, baby: row }), () => repo.saveBaby(row)) };
      },
      setPhoto: (file) => {
        const done = (async () => {
          const prev = snapRef.current?.baby;
          if (!prev) throw new Error('Pas encore de profil.');
          let photo: string | null = null;
          if (file) {
            try {
              photo = await photoToDataUrl(file);
            } catch {
              throw new Error('Cette image ne peut pas être lue : choisis-en une autre.');
            }
          }
          const row: BabyRow = { ...prev, photo };
          try {
            await write((x) => ({ ...x, baby: row }), () => repo.saveBaby(row));
          } catch (e) {
            throw new Error(/photo/i.test((e as Error).message) ? 'La base n’a pas la colonne « photo » : exécute la migration 0002 dans Supabase.' : 'Ce n’est pas enregistré : vérifie ta connexion et réessaie.');
          }
        })();
        return { id: '', done };
      },
      importPumpsFile: async (file) => {
        const parsed = parsePumpFile(await file.text());
        if (!parsed.ok) return parsed.error;
        seq.current += 1;
        const p = queue.current.then(() => repo.importPumps(parsed.rows));
        queue.current = p.catch(() => undefined);
        const n = await p;
        seq.current += 1;
        await reload();
        return n === 0 ? 'Aucun nouveau tirage : ils sont déjà tous là.' : `${n} tirage${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}.`;
      },
      exportData: async () => {
        const all = await repo.exportAll();
        await saveFile(backupName(nowRef.current), backupJson(all, nowRef.current));
      },
      logout: opts.onLogout,
    };
    return s;
  }, [snap, now, dark, prefs, repo, write, reload, opts.onLogout]);

  return { store, loadError, notice, retry: reload };
}



