// Reconstruction du journal tel qu'il était connu à un instant passé, à partir de la table `journal` (migration 0004).
//
// Deux modes, jamais confondus :
//  - 'exact'   : par WATERMARK (un `seq`). Les écritures sont sérialisées par un verrou et `seq` suit l'ordre des commits : l'ensemble des
//                entrées visibles à un instant est toujours un préfixe de `seq`. Rejouer jusqu'au watermark W redonne exactement ce qu'un
//                lecteur voyait quand le plus grand seq visible était W. C'est le seul mode admis pour évaluer une prédiction.
//  - 'by_date' : par DATE. On cherche le plus grand seq dont l'heure serveur d'entrée (`recorded_at`) précède la date. C'est approximatif :
//                PostgreSQL ne donne pas l'heure exacte du commit, `recorded_at` est prise juste avant, et l'horloge du serveur peut dériver.
//
// Quand l'historique manque, on le dit (`unavailable`) au lieu de deviner : avant le point de départ de la migration (`baseline`),
// au-delà de la tête du journal, ou si la chaîne des modifications d'une ligne est rompue (écriture non tracée).
import type { JournalRow } from './types';

export type Row = Record<string, unknown>;
export interface State {
  events: Row[];
  pumps: Row[];
  baby: Row | null;
}
export type UnavailableReason = 'no_journal' | 'before_baseline' | 'beyond_head' | 'chain_broken';
export type AsOf =
  | { kind: 'exact'; watermark: number; state: State }
  | { kind: 'by_date'; watermark: number; state: State; note: string }
  | { kind: 'unavailable'; reason: UnavailableReason; detail?: string };

export const BY_DATE_NOTE = 'approximatif : l’heure exacte du commit n’existe pas ; le watermark est le dernier seq enregistré avant cette date';

const stable = (v: unknown): string =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Row).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const isLegacy = (r: JournalRow): boolean => r.op === 'legacy_update' || r.op === 'legacy_delete';
const bySeq = (a: JournalRow, b: JournalRow): number => a.seq - b.seq;

/**
 * Point de départ : le plus grand seq d'un `baseline` (la migration a trouvé des lignes). Avant lui, l'état n'est pas reconstructible.
 * Sans `baseline`, la migration est passée sur une base vide : le journal est complet depuis le seq 1 et le point de départ est 0.
 */
export function horizon(journal: JournalRow[]): number {
  let h = 0;
  for (const r of journal) if (r.op === 'baseline' && r.seq > h) h = r.seq;
  return h;
}

export const head = (journal: JournalRow[]): number => journal.reduce((m, r) => Math.max(m, r.seq), 0);

/** Première rupture de chaîne jusqu'à `upTo` : une modification dont la « ligne d'avant » n'est pas la « ligne d'après » de l'entrée précédente. */
export function chainBreak(journal: JournalRow[], upTo = Infinity): JournalRow | null {
  const last = new Map<string, Row | null>();
  for (const r of journal.filter((x) => x.seq <= upTo && !isLegacy(x)).sort(bySeq)) {
    const key = `${r.tbl}/${r.row_id}`;
    if (r.op === 'update' || r.op === 'stop' || r.op === 'reopen' || r.op === 'delete') {
      const prev = last.get(key);
      if (prev === undefined || stable(prev) !== stable(r.old_row)) return r;
    }
    last.set(key, r.op === 'delete' ? null : r.new_row);
  }
  return null;
}

/** Rejeu brut des entrées seq ≤ w : la dernière entrée de chaque ligne donne son état ; une suppression la retire. */
function replay(journal: JournalRow[], w: number): State {
  const rows = new Map<string, JournalRow>();
  for (const r of journal.filter((x) => x.seq <= w && x.op !== 'legacy_update').sort(bySeq)) rows.set(`${r.tbl}/${r.row_id}`, r);
  const alive = [...rows.values()].filter((r) => r.op !== 'delete' && r.op !== 'legacy_delete' && r.new_row);
  const of = (tbl: JournalRow['tbl']): Row[] => alive.filter((r) => r.tbl === tbl).map((r) => r.new_row as Row).sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
  return { events: of('events'), pumps: of('pumps'), baby: of('baby')[0] ?? null };
}

/** Exact : l'état de la base quand le plus grand seq visible était `w`. */
export function stateAtWatermark(journal: JournalRow[] | null | undefined, w: number): AsOf {
  if (!journal) return { kind: 'unavailable', reason: 'no_journal', detail: 'table journal absente : migration 0004 non passée' };
  const h = horizon(journal);
  if (w < h) return { kind: 'unavailable', reason: 'before_baseline', detail: `watermark ${w} < point de départ ${h}` };
  if (w > head(journal)) return { kind: 'unavailable', reason: 'beyond_head', detail: `watermark ${w} > tête ${head(journal)}` };
  const broken = chainBreak(journal, w);
  if (broken) return { kind: 'unavailable', reason: 'chain_broken', detail: `${broken.tbl}/${broken.row_id} au seq ${broken.seq}` };
  return { kind: 'exact', watermark: w, state: replay(journal, w) };
}

/** Le plus grand seq enregistré à `t` ou avant ; null si aucune entrée. Les `recorded_at` croissent avec `seq` : la recherche est monotone. */
export function watermarkForDate(journal: JournalRow[], t: Date | string | number): number | null {
  const ms = t instanceof Date ? t.getTime() : typeof t === 'number' ? t : Date.parse(t);
  let w: number | null = null;
  for (const r of journal) if (Date.parse(r.recorded_at) <= ms && (w === null || r.seq > w)) w = r.seq;
  return w;
}

export function asOf(journal: JournalRow[] | null | undefined, q: { watermark: number } | { date: Date | string | number }): AsOf {
  if (!journal) return stateAtWatermark(journal, 0);
  if ('watermark' in q) return stateAtWatermark(journal, q.watermark);
  const w = watermarkForDate(journal, q.date);
  if (w === null) return { kind: 'unavailable', reason: 'before_baseline', detail: 'aucune entrée à cette date' };
  const r = stateAtWatermark(journal, w);
  return r.kind === 'exact' ? { kind: 'by_date', watermark: r.watermark, state: r.state, note: BY_DATE_NOTE } : r;
}

/**
 * Même résultat que `asOf`, pour un journal qu'on interroge souvent (le moteur rejoue des dizaines d'instants passés) :
 * tri, première rupture de chaîne et dates sont calculés une fois. Une chaîne valide jusqu'à w ⇔ la première rupture est au-delà de w.
 */
export function indexJournal(journal: JournalRow[] | null | undefined): (q: { watermark: number } | { date: Date | string | number }) => AsOf {
  if (!journal) return (q) => asOf(journal, q);
  const sorted = [...journal].sort(bySeq);
  const times = sorted.map((r) => Date.parse(r.recorded_at));
  const first = chainBreak(sorted), h = horizon(sorted), tip = head(sorted);
  const replayed = new Map<number, State>();
  const at = (w: number): AsOf => {
    if (w < h) return { kind: 'unavailable', reason: 'before_baseline', detail: `watermark ${w} < point de départ ${h}` };
    if (w > tip) return { kind: 'unavailable', reason: 'beyond_head', detail: `watermark ${w} > tête ${tip}` };
    if (first && first.seq <= w) return { kind: 'unavailable', reason: 'chain_broken', detail: `${first.tbl}/${first.row_id} au seq ${first.seq}` };
    let s = replayed.get(w);
    if (!s) {
      s = replay(sorted, w);
      if (replayed.size > 200) replayed.clear();
      replayed.set(w, s);
    }
    return { kind: 'exact', watermark: w, state: s };
  };
  return (q) => {
    if ('watermark' in q) return at(q.watermark);
    const ms = q.date instanceof Date ? q.date.getTime() : typeof q.date === 'number' ? q.date : Date.parse(q.date);
    // recorded_at croît avec seq : dernière entrée dont l'heure est ≤ ms (recherche dichotomique)
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid]! <= ms) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return { kind: 'unavailable', reason: 'before_baseline', detail: 'aucune entrée à cette date' };
    const r = at(sorted[lo - 1]!.seq);
    return r.kind === 'exact' ? { kind: 'by_date', watermark: r.watermark, state: r.state, note: BY_DATE_NOTE } : r;
  };
}
