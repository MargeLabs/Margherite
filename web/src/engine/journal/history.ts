// Couche 1, historique d'un événement : ce que le journal des écritures (0004) dit de ses corrections, sans jamais le réécrire.
// Entrée : les lignes de la table `journal` (forme structurelle, pas d'import de la couche de données). Sortie : un résumé par événement.
// Le journal ne contient que des écritures faites par les parents ou par l'import : rien d'estimé ni de calculé n'y entre.
// Avant le point de départ de la migration (`baseline`), l'historique d'une ligne est inconnu : `fromBaseline` le dit, rien n'est supposé.

/** Ce que le calcul lit d'une ligne du journal 0004 (sous-ensemble de `JournalRow`). */
export interface JournalEntry {
  seq: number;
  tbl: string;
  row_id: string;
  op: string;
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
  changed_fields: string[];
  changed_at: string;
  recorded_at: string;
  via: string;
}

export interface EventHistory {
  id: string;
  /** première version connue : `insert` (écrite par l'app), `baseline` (état à la migration : le passé d'avant est inconnu) ou `legacy` (version d'avant une correction, reprise de 0002) */
  firstOp: 'insert' | 'baseline' | 'legacy';
  fromBaseline: boolean;
  /** heures de la toute première version connue (ms UTC) */
  originalStart: number | null;
  originalEnd: number | null;
  /** nombre d'écritures de l'app sur la ligne (hors point de départ et reprises) */
  entries: number;
  /** corrections de l'heure de début, ou de l'heure de fin d'un sommeil déjà terminé */
  timeCorrections: number;
  /** corrections d'une valeur (quantité, côté, marqueur de nuit…), hors arrêt de chrono */
  valueCorrections: number;
  /** passages « en cours » → « terminé » et « terminé » → « en cours » */
  stops: number;
  reopens: number;
  /** corrections d'avant la migration, reprises de `event_revisions` (0002) */
  legacyCorrections: number;
  /** instant (ms UTC) de la dernière écriture ; null si la ligne n'a que son point de départ */
  lastChangedAt: number | null;
  /** instant où l'app a su que le sommeil était terminé (dernier passage à « terminé » écrit par l'app) ; null : inconnu, rouvert, ou écrit par la migration */
  endRecordedAt: number | null;
  /** heures de la dernière version que le journal connaît (sa tête) ; null si supprimé ou jamais écrit : sert à vérifier que la table et le journal disent la même chose */
  headStart: number | null;
  headEnd: number | null;
  /** supprimé : l'événement n'est plus au journal des parents, son passage reste une trace */
  deletedAt: number | null;
}

const ms = (v: unknown): number | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);

export function eventHistories(journal: readonly JournalEntry[]): Map<string, EventHistory> {
  const out = new Map<string, EventHistory>();
  for (const r of journal.filter((x) => x.tbl === 'events').sort((a, b) => a.seq - b.seq)) {
    const legacy = r.op === 'legacy_update' || r.op === 'legacy_delete';
    let h = out.get(r.row_id);
    if (!h) {
      const first = r.new_row ?? r.old_row;
      h = { id: r.row_id, firstOp: legacy ? 'legacy' : r.op === 'baseline' ? 'baseline' : 'insert', fromBaseline: r.op === 'baseline' || legacy, originalStart: ms(first?.started_at), originalEnd: ms(first?.ended_at), entries: 0, timeCorrections: 0, valueCorrections: 0, stops: 0, reopens: 0, legacyCorrections: 0, lastChangedAt: null, endRecordedAt: null, headStart: null, headEnd: null, deletedAt: null };
      out.set(r.row_id, h);
    }
    if (legacy) {
      h.legacyCorrections += 1; // la première reprise a déjà fixé l'original : la version d'avant la plus ancienne
      if (r.op === 'legacy_delete') h.deletedAt = ms(r.changed_at);
      continue;
    }
    if (r.op !== 'delete') { h.headStart = ms(r.new_row?.started_at); h.headEnd = ms(r.new_row?.ended_at); h.deletedAt = null; } // recréé avec le même id : plus supprimé
    if (r.op === 'baseline') continue;
    h.entries += 1;
    h.lastChangedAt = ms(r.recorded_at);
    const endedNow = typeof r.new_row?.ended_at === 'string', endedBefore = typeof r.old_row?.ended_at === 'string';
    if (r.op === 'delete') {
      h.deletedAt = ms(r.recorded_at);
      h.headStart = h.headEnd = null;
      continue;
    }
    if (endedNow && !endedBefore) {
      if (r.op !== 'insert') h.stops += 1; // un sommeil saisi déjà terminé n'est pas un arrêt de chrono
      h.endRecordedAt = r.via === 'migration' ? null : ms(r.recorded_at);
    } else if (!endedNow && endedBefore) {
      h.reopens += 1;
      h.endRecordedAt = null;
    }
    if (r.op === 'update') {
      const f = r.changed_fields;
      if (f.includes('started_at') || (endedNow && endedBefore && f.includes('ended_at'))) h.timeCorrections += 1;
      // un arrêt ou une réouverture peut emporter un marqueur de nuit dans le même geste : ce n'est pas une correction de valeur
      if (f.includes('kind') || (f.includes('payload') && !(endedNow !== endedBefore))) h.valueCorrections += 1;
    }
  }
  return out;
}
