// D'où le moteur tient son journal. Avec la table `journal` (migration 0004) : le passé est reconstruit exactement, corrections et
// suppressions comprises. Sans elle (production aujourd'hui) : mode dégradé, le passé est reconstruit par date de saisie.
// Rien ici n'écrit dans la base ni ne touche l'écran.
import { eventFromRaw, type RawEventRow } from '@/engine/adapters';
import { visibleAt } from '@/engine/evaluation/backtest';
import { runIntelligence, type IntelligenceReport, type Options, type View } from '@/engine/intelligence/run';
import type { EngineEvent, EngineInput } from '@/engine/types';
import { asOf, head, horizon, indexJournal } from './asof';
import type { JournalRow } from './types';

/** Les événements tels qu'ils étaient quand le plus grand `seq` visible était `watermark` ; null si l'historique manque ou si la chaîne est rompue. */
export function eventsAtWatermark(journal: JournalRow[], watermark: number): EngineEvent[] | null {
  const r = asOf(journal, { watermark });
  return r.kind === 'exact' ? r.state.events.map((x) => eventFromRaw(x as unknown as RawEventRow)) : null;
}

/** Même chose par date : approximatif (l'heure exacte du commit n'existe pas), donc réservé à l'évaluation des modèles, jamais présenté comme exact. */
export function eventsAtDate(journal: JournalRow[], at: number): EngineEvent[] | null {
  const r = asOf(journal, { date: at });
  return r.kind === 'exact' || r.kind === 'by_date' ? r.state.events.map((x) => eventFromRaw(x as unknown as RawEventRow)) : null;
}

/** Le passé tel que le journal le donne : par date (approximatif), et avant son point de départ par date de saisie. `keep` borne la fenêtre rejouée. */
export function journalView(journal: JournalRow[], keep: (e: EngineEvent) => boolean = () => true): View {
  const asOfIndexed = indexJournal(journal);
  // le journal sert de vue du passé tant qu'il couvre la période rejouée ; en deçà de son point de départ, on retombe sur les dates de saisie
  const start = Date.parse(journal.find((r) => r.seq === horizon(journal))?.recorded_at ?? journal[0]!.recorded_at);
  const cache = new Map<number, EngineEvent[] | null>();
  return (events, at) => {
    if (at < start) return visibleAt(events, at);
    if (!cache.has(at)) {
      const r = asOfIndexed({ date: at });
      cache.set(at, r.kind === 'exact' || r.kind === 'by_date' ? r.state.events.map((x) => eventFromRaw(x as unknown as RawEventRow)).filter(keep) : null);
    }
    return cache.get(at) ?? visibleAt(events, at);
  };
}

/** Le journal est utilisable : non vide et sa tête dépasse son point de départ. */
export const journalUsable = (journal: JournalRow[] | null | undefined): journal is JournalRow[] => !!journal && journal.length > 0 && head(journal) >= horizon(journal);

/**
 * Le moteur sur ce journal. `journal` absent (table inexistante) ou inutilisable (avant le point de départ, chaîne rompue) : mode dégradé,
 * même résultat qu'avant la migration, marqué comme tel. Le résultat ne dépend jamais d'un appel réseau.
 */
export function intelligenceFor(input: EngineInput, now: number, journal: JournalRow[] | null | undefined, opts: Options = {}): IntelligenceReport {
  if (!journalUsable(journal)) return runIntelligence(input, now, { ...opts, mode: 'degraded' });
  return runIntelligence(input, now, { ...opts, mode: 'journal', view: journalView(journal) });
}
