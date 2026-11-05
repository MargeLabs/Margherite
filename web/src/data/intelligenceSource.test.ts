import { describe, expect, it } from 'vitest';
import { rawFromEvent } from '@/engine/adapters';
import type { EngineEvent } from '@/engine/types';
import { eventsAtDate, eventsAtWatermark, intelligenceFor } from './intelligenceSource';
import type { JournalRow } from './types';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, 1 + d, h, m).getTime();
const iso = (t: number) => new Date(t).toISOString();

/** Un bébé régulier sur 24 jours ; chaque dodo est inscrit au journal à l'heure où il finit. */
function baby(days: number): EngineEvent[] {
  const out: EngineEvent[] = [];
  let n = 0;
  const sleep = (a: number, b: number) => out.push({ id: `s${n++}`, kind: 'sleep', start: a, end: b, enteredAt: a, endKnownAt: b });
  for (let d = 0; d < days; d++) {
    sleep(at(d, 9, 30), at(d, 10, 30));
    sleep(at(d, 13), at(d, 14, 30));
    sleep(at(d, 20), at(d + 1, 7));
  }
  return out.sort((a, b) => (a.end ?? 0) - (b.end ?? 0));
}

function journalOf(events: EngineEvent[], deleted: Array<{ id: string; at: number }> = []): JournalRow[] {
  let seq = 0;
  const rows: JournalRow[] = events.map((e) => {
    const t = e.end ?? e.start, raw = { ...rawFromEvent(e), created_at: iso(e.start), updated_at: iso(t) };
    return { seq: ++seq, tbl: 'events', row_id: e.id, op: 'insert', old_row: null, new_row: raw as unknown as Record<string, unknown>, changed_fields: [], source: 'timer', changed_at: iso(t), recorded_at: iso(t), actor: null, via: 'app', device: null, txid: seq, legacy_revision_id: null };
  });
  const sorted = rows.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).map((r, i) => ({ ...r, seq: i + 1 }));
  for (const d of deleted) {
    const prev = sorted.find((r) => r.row_id === d.id)!;
    sorted.push({ ...prev, seq: sorted.length + 1, op: 'delete', old_row: prev.new_row, new_row: null, recorded_at: iso(d.at), changed_at: iso(d.at), txid: sorted.length + 1 });
  }
  return sorted;
}

describe('journal comme source du moteur', () => {
  const events = baby(24);
  const gone = events.find((e) => e.start === at(5, 13))!;
  const journal = journalOf(events, [{ id: gone.id, at: at(7, 8) }]);

  it('exact par watermark : les n premières entrées donnent exactement les n premiers dodos', () => {
    expect(eventsAtWatermark(journal, 10)).toHaveLength(10);
    expect(eventsAtWatermark(journal, 0)).toHaveLength(0);
    expect(eventsAtWatermark(journal, 10_000)).toBeNull();
    expect(eventsAtWatermark(null as never, 3)).toBeNull();
  });

  it('une suppression ultérieure ne réécrit pas le passé : avant elle le dodo existe, après non', () => {
    expect(eventsAtDate(journal, at(6, 12))!.some((e) => e.id === gone.id)).toBe(true);
    expect(eventsAtDate(journal, at(8, 12))!.some((e) => e.id === gone.id)).toBe(false);
  });

  it('un dodo n’existe pas pour le moteur avant l’heure où il a été noté', () => {
    const early = eventsAtDate(journal, at(3, 12))!;
    expect(early.every((e) => (e.end ?? 0) <= at(3, 12))).toBe(true);
  });

  it('sans journal : mode dégradé ; avec journal : mode journal, mêmes cibles', () => {
    const input = { babyId: 'x', birthAt: null, events: events.filter((e) => e.id !== gone.id) };
    const d = intelligenceFor(input, at(24, 12), null, { targets: ['bedtime', 'nap_start'] });
    const j = intelligenceFor(input, at(24, 12), journal, { targets: ['bedtime', 'nap_start'] });
    expect(d.mode).toBe('degraded');
    expect(j.mode).toBe('journal');
    expect(j.predictions.map((p) => p.target)).toEqual(d.predictions.map((p) => p.target));
    expect(j.predictions.every((p) => !p.limits.includes('evaluation_approximate') && p.limits.includes('evaluation_journal_by_date'))).toBe(true);
    expect(d.predictions.every((p) => p.limits.includes('evaluation_approximate'))).toBe(true);
  });

  it('un journal vide ou inutilisable retombe sur le mode dégradé sans erreur', () => {
    const input = { babyId: 'x', birthAt: null, events };
    expect(intelligenceFor(input, at(24, 12), [], { targets: ['feed'] }).mode).toBe('degraded');
    expect(intelligenceFor(input, at(24, 12), undefined, { targets: ['feed'] }).mode).toBe('degraded');
  });
});
