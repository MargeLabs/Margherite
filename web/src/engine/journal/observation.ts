// Couche 1 : le journal parental, source de vérité des événements RÉELLEMENT OBSERVÉS (sommeil, biberon, tétée, change).
// Contrat complet : tasks/couche1-journal-parental.md. Ce que cette couche garantit :
//  - elle ne contient que ce qu'un parent a saisi, tel qu'il l'a saisi : `start`, `end` et les attributs ne sont jamais modifiés, arrondis, comblés ni déduits ;
//  - un sommeil sans fin reste « en cours » : aucune fin n'est inventée, même s'il est évidemment oublié (il est seulement signalé) ;
//  - toute observation de la table est rendue, même suspecte : les anomalies sont des drapeaux, jamais des corrections ni des suppressions ;
//  - chaque observation dit comment son heure a été saisie (en direct, avec retard, de mémoire) et par qui (provenance), sans le déduire du reste ;
//  - un jour sans saisie n'existe pas : jamais de zéro inventé ;
//  - rien de calculé (estimation, habitude, prévision, nuit, éveil) n'entre ici : ces choses vivent dans les couches au-dessus, qui lisent celle-ci.
// Pur : ne dépend que de la configuration, des adaptateurs et du contrôle de qualité (test d'architecture). Aucun accès à l'heure courante : `now` est un paramètre.
import { threshold } from '../config';
import { eventFromRaw, type RawEventRow } from '../adapters';
import { assessQuality, type IssueCode } from '../quality';
import type { EngineEvent, EngineEventKind, NightMark } from '../types';
import { eventHistories, type EventHistory, type JournalEntry } from './history';
import { dayLengthMin, dayOf, hostZone, splitByDay, type DayShare } from './localDays';

const MIN = 60_000;

/** Comment une heure est entrée dans le journal, d'après l'écart entre l'heure déclarée et l'enregistrement : un fait, pas une estimation. */
export type Timing = 'live' | 'delayed' | 'recalled' | 'unknown';
export type Provenance = 'server' | 'derived_pre0004' | 'supplied';
/** Confiance dans l'instant d'enregistrement (`created_at`), donc dans `Timing` : miroir de PROVENANCE_TRUST (data/types.ts, vérifié par un test). */
export const ENTRY_TRUST: Record<Provenance, 'high' | 'moderate' | 'low'> = { server: 'high', derived_pre0004: 'moderate', supplied: 'low' };

export type Flag =
  | IssueCode
  /** l'heure de début est postérieure à son enregistrement (au-delà du décalage d'horloge toléré) */
  | 'start_after_entry'
  /** marqueur de nuit incohérent : sur autre chose qu'un sommeil, ou « réveil » sur un sommeil sans fin */
  | 'mark_invalid'
  | 'unknown_kind';
export interface RaisedFlag {
  code: Flag;
  /** l'autre observation en cause (chevauchement, doublon) */
  with?: string[];
}

export interface Observation {
  /** toujours « observed » : le typage empêche d'y mêler une estimation */
  readonly basis: 'observed';
  id: string;
  kind: EngineEventKind | 'unknown';
  /** heures saisies, ms UTC, telles quelles */
  start: number;
  end?: number;
  /** sommeil terminé · sommeil en cours (chrono) · événement sans durée (biberon, tétée, change) */
  status: 'complete' | 'open' | 'instant';
  /** valeurs saisies */
  attrs: Pick<EngineEvent, 'ml' | 'milk' | 'side' | 'durationMin' | 'mark'>;
  /** sommeil terminé et lisible : minutes réellement écoulées (pas des minutes « murales »), et leur découpe par jour civil local (minuit compris) */
  elapsedMin?: number;
  spans?: DayShare[];
  /** sommeil en cours : minutes écoulées depuis son début à `now` */
  openForMin?: number;
  entry: {
    /** timer · live · later · import : déduction du serveur à l'enregistrement ; null avant la migration 0004 */
    source: 'timer' | 'live' | 'later' | 'import' | null;
    provenance: Provenance | null;
    trust: 'high' | 'moderate' | 'low' | null;
    enteredAt?: number;
    startDelayMin?: number;
    startTiming: Timing;
    /** sommeil terminé seulement ; `unknown` sans le journal des écritures (la table ne sait pas quand la fin a été saisie) */
    endDelayMin?: number;
    endTiming?: Timing;
  };
  /** corrections et arrêts connus du journal des écritures ; null si le journal manque ou ne connaît pas cette ligne */
  history: EventHistory | null;
  flags: RaisedFlag[];
  /** faux si l'observation est illisible (heure absurde, fin avant début, nature inconnue) : à ne pas utiliser ; les autres drapeaux n'ôtent rien */
  usable: boolean;
}

/** Un silence : aucune saisie ni sommeil sur cette durée. Un fait de couverture, jamais la preuve d'un oubli. */
export interface Silence {
  from: number;
  to: number;
  minutes: number;
}
/** Un jour civil local qui contient au moins une saisie ou une part de sommeil. Les autres jours n'existent pas. */
export interface ObservedDay {
  day: string;
  /** durée réelle du jour : 1380, 1440 ou 1500 minutes */
  lengthMin: number;
  /** événements COMMENCÉS ce jour-là, par nature */
  started: Record<EngineEventKind, number>;
  /** minutes de sommeil terminé qui tombent dans ce jour (une nuit est coupée à minuit) */
  sleepMin: number;
}

export interface JournalReport {
  tz: string;
  now: number;
  /** une par ligne de la table, triées par début ; aucune n'est retirée */
  observations: Observation[];
  /** sommeil en cours (au plus un en théorie : la base l'impose) */
  open: string[];
  days: ObservedDay[];
  silences: Silence[];
  /** événements supprimés d'après le journal des écritures : une trace, pas des observations */
  removed: Array<{ id: string; deletedAt: number; originalStart: number | null; originalEnd: number | null }>;
  journal: 'present' | 'absent';
  /** cohérence table ↔ journal des écritures (vide si le journal est absent) : lignes sans aucune écriture au journal, et lignes dont les heures diffèrent de sa tête */
  integrity: { untraced: string[]; diverged: string[] };
}

export interface ObserveInput {
  /** l'état actuel de la table `events` */
  rows: readonly RawEventRow[];
  /** la table `journal` (0004) ; absente ou vide : l'historique est inconnu, pas vide */
  journal?: readonly JournalEntry[] | null;
  now: number;
  /** fuseau IANA des frontières de jour ; défaut : celui de l'appareil */
  tz?: string;
}

const KINDS = new Set(['bib', 'sein', 'sleep', 'chg']);
const MARKS = new Set<NightMark>(['bed', 'wake', 'both']);
const SOURCES = new Set(['timer', 'live', 'later', 'import']);
const PROVENANCES = new Set<string>(['server', 'derived_pre0004', 'supplied']);

function timing(delayMin: number | undefined, trust: Observation['entry']['trust']): Timing {
  // une heure d'enregistrement écrite par n'importe qui (SQL) n'est pas une mesure ; une heure d'avenir au-delà du décalage d'horloge n'est pas un retard
  if (delayMin === undefined || trust === 'low' || delayMin < -threshold('qualityFutureToleranceMin')) return 'unknown';
  return delayMin <= threshold('qualityLiveEntryMin') ? 'live' : delayMin <= threshold('qualityLateEntryMin') ? 'delayed' : 'recalled';
}

export function observe({ rows, journal, now, tz = hostZone() }: ObserveInput): JournalReport {
  const histories = journal && journal.length ? eventHistories(journal) : null;
  const known = rows.filter((r) => KINDS.has(r.kind));
  const events = known.map((r) => eventFromRaw({ ...r, payload: r.payload ?? {} })); // une ligne sans payload n'arrête pas le calcul
  const byId = new Map(events.map((e) => [e.id, e]));
  const issues = new Map<string, RaisedFlag[]>();
  const raise = (id: string, flag: RaisedFlag): void => void issues.set(id, [...(issues.get(id) ?? []), flag]);
  for (const q of assessQuality(events, now).issues) for (const id of q.ids) raise(id, { code: q.code, ...(q.ids.length > 1 ? { with: q.ids.filter((x) => x !== id) } : {}) });

  const observations = rows.map((raw): Observation => {
    const unknown = !KINDS.has(raw.kind);
    const e = unknown ? null : byId.get(raw.id) ?? null;
    const history = histories?.get(raw.id) ?? null;
    const start = Date.parse(raw.started_at), end = raw.ended_at ? Date.parse(raw.ended_at) : undefined;
    const provenance = typeof raw.provenance === 'string' && PROVENANCES.has(raw.provenance) ? (raw.provenance as Provenance) : null;
    const trust = provenance ? ENTRY_TRUST[provenance] : null;
    const enteredAt = raw.created_at ? Date.parse(raw.created_at) : undefined;
    const startDelayMin = enteredAt !== undefined && Number.isFinite(enteredAt) && Number.isFinite(start) ? (enteredAt - start) / MIN : undefined;
    const isSleep = raw.kind === 'sleep';
    const endDelayMin = isSleep && end !== undefined && history?.endRecordedAt != null ? (history.endRecordedAt - end) / MIN : undefined;
    const readable = Number.isFinite(start) && (end === undefined || (Number.isFinite(end) && end >= start));

    const flags: RaisedFlag[] = unknown ? [{ code: 'unknown_kind' }] : [...(issues.get(raw.id) ?? [])];
    if (startDelayMin !== undefined && startDelayMin < -threshold('qualityFutureToleranceMin')) flags.push({ code: 'start_after_entry' });
    const mark = raw.payload?.mark;
    if (mark !== undefined && (!MARKS.has(mark) || !isSleep || ((mark === 'wake' || mark === 'both') && end === undefined))) flags.push({ code: 'mark_invalid' });

    const o: Observation = {
      basis: 'observed',
      id: raw.id,
      kind: e?.kind ?? 'unknown',
      start,
      ...(end !== undefined ? { end } : {}),
      status: isSleep ? (end === undefined ? 'open' : 'complete') : 'instant',
      attrs: e ? { ...(e.ml !== undefined ? { ml: e.ml } : {}), ...(e.milk ? { milk: e.milk } : {}), ...(e.side ? { side: e.side } : {}), ...(e.durationMin !== undefined ? { durationMin: e.durationMin } : {}), ...(e.mark ? { mark: e.mark } : {}) } : {},
      entry: {
        source: typeof raw.source === 'string' && SOURCES.has(raw.source) ? (raw.source as 'timer' | 'live' | 'later' | 'import') : null,
        provenance,
        trust,
        ...(enteredAt !== undefined && Number.isFinite(enteredAt) ? { enteredAt } : {}),
        ...(startDelayMin !== undefined ? { startDelayMin } : {}),
        startTiming: timing(startDelayMin, trust),
        ...(isSleep && end !== undefined ? { endTiming: timing(endDelayMin, trust), ...(endDelayMin !== undefined ? { endDelayMin } : {}) } : {}),
      },
      history,
      flags,
      usable: !unknown && readable,
    };
    if (o.usable && isSleep && end !== undefined) {
      o.elapsedMin = (end - start) / MIN;
      o.spans = splitByDay(start, end, tz);
    }
    if (o.usable && isSleep && end === undefined) o.openForMin = Math.max(0, (now - start) / MIN);
    return o;
  });
  observations.sort((a, b) => (Number.isFinite(a.start) ? a.start : Infinity) - (Number.isFinite(b.start) ? b.start : Infinity));

  // jours : seulement ceux qui ont une saisie ou une part de sommeil
  const days = new Map<string, ObservedDay>();
  const dayOfEntry = (day: string): ObservedDay => {
    let d = days.get(day);
    if (!d) days.set(day, (d = { day, lengthMin: dayLengthMin(day, tz), started: { sleep: 0, bottle: 0, breast: 0, diaper: 0 }, sleepMin: 0 }));
    return d;
  };
  for (const o of observations) {
    if (!o.usable || o.kind === 'unknown') continue;
    dayOfEntry(dayOf(o.start, tz)).started[o.kind] += 1;
    for (const s of o.spans ?? []) dayOfEntry(s.day).sleepMin += s.minutes;
  }

  // silences : écarts sans aucune couverture entre deux saisies lisibles (un sommeil couvre sa durée, un sommeil en cours couvre jusqu'à `now`)
  const silences: Silence[] = [];
  let reach: number | null = null;
  for (const o of observations.filter((x) => x.usable)) {
    if (reach !== null && o.start - reach >= threshold('qualitySilenceMin') * MIN) silences.push({ from: reach, to: o.start, minutes: (o.start - reach) / MIN });
    const cover = o.kind === 'sleep' ? o.end ?? Math.max(o.start, now) : o.start;
    reach = reach === null ? cover : Math.max(reach, cover);
  }

  const present = new Set(rows.map((r) => r.id));
  const removed = histories ? [...histories.values()].filter((h) => h.deletedAt !== null && !present.has(h.id)).map((h) => ({ id: h.id, deletedAt: h.deletedAt!, originalStart: h.originalStart, originalEnd: h.originalEnd })) : [];
  const integrity = { untraced: [] as string[], diverged: [] as string[] };
  if (histories) {
    for (const o of observations) {
      const h = o.history;
      if (!h) integrity.untraced.push(o.id);
      else if (h.headStart !== o.start || (h.headEnd ?? null) !== (o.end ?? null)) integrity.diverged.push(o.id);
    }
  }

  return { tz, now, observations, open: observations.filter((o) => o.status === 'open' && o.usable).map((o) => o.id), days: [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1)), silences, removed, journal: histories ? 'present' : 'absent', integrity };
}
