// Branche le journal 0004 sur le moteur : même interface qu'avant, aucune modification de l'écran.
// Mode « journal » seulement si le journal décrit EXACTEMENT les mêmes événements que ceux que l'écran affiche (même fenêtre, même état) ;
// sinon (table absente, journal en retard ou en avance d'une écriture, chaîne rompue) : mode dégradé, jamais une reconstruction douteuse.
import { eventFromRaw, type RawEventRow } from '@/engine/adapters';
import type { ViewEngine } from '@/engine/bridge';
import type { Options, View } from '@/engine/intelligence/run';
import type { EngineEvent } from '@/engine/types';
import { indexJournal } from './asof';
import { journalUsable, journalView } from './intelligenceSource';
import type { JournalAccess } from './journalSource';
import type { JournalRow } from './types';

interface Item {
  id: string;
  k: string;
  a: number;
  b?: number;
}
interface IntelView {
  origin: Date;
  now: number;
  events: Item[];
  birthAt?: number | null;
}

const TOL = 60_000; // l'écran compte en minutes : une seconde d'écart d'arrondi n'est pas une différence
const same = (a: number | undefined, b: number | undefined): boolean => (a === undefined || b === undefined ? a === b : Math.abs(a - b) <= TOL);

// mémorisés par IDENTITÉ du tableau (JournalSource en fournit un nouveau à chaque entrée) : deux journaux de même taille ne se confondent jamais
let tipMemo: { journal: JournalRow[]; events: EngineEvent[] | null } | null = null;
/** Les événements du journal à sa tête (exacte), reconstruits une fois par état du journal ; null si la chaîne est rompue. */
function tipEvents(journal: JournalRow[]): EngineEvent[] | null {
  if (tipMemo?.journal === journal) return tipMemo.events;
  const tip = indexJournal(journal)({ watermark: journal.reduce((m, r) => Math.max(m, r.seq), 0) });
  tipMemo = { journal, events: tip.kind === 'exact' ? tip.state.events.map((x) => eventFromRaw(x as unknown as RawEventRow)) : null };
  return tipMemo.events;
}

let last: { journal: JournalRow[]; minStart: number; view: View } | null = null;
/** Une seule vue en mémoire : elle garde ses reconstructions par instant tant que le journal ne change pas. */
function viewFor(journal: JournalRow[], minStart: number, keep: (e: EngineEvent) => boolean): View {
  if (last && last.journal === journal && last.minStart === minStart) return last.view;
  last = { journal, minStart, view: journalView(journal, keep) };
  return last.view;
}

/** Options à ajouter pour que le moteur lise le journal ; seulement l'estampille quand il doit rester en mode dégradé. */
export function journalOptions(access: JournalAccess | null, v: IntelView): Pick<Options, 'mode' | 'view' | 'stamp'> {
  const journal = access?.get() ?? null, stamp = access?.stamp() ?? 'none';
  if (!journalUsable(journal) || !v.events.length) return { stamp };
  const { origin } = v, ms = (t: number) => new Date(origin.getFullYear(), origin.getMonth(), origin.getDate(), 0, t).getTime();
  const shown = new Map(v.events.map((e) => [e.id, { start: ms(e.a), end: e.b === undefined ? undefined : ms(e.b) }]));
  const minStart = Math.min(...v.events.map((e) => ms(e.a)));
  // l'écran ne montre ni les chronos en cours ni ce qui précède sa fenêtre : le moteur apprend sur la même chose
  const keep = (e: EngineEvent): boolean => e.start >= minStart && !(e.kind === 'sleep' && e.end === undefined);
  const tip = tipEvents(journal);
  if (!tip) return { stamp };
  const there = tip.filter(keep);
  const agrees = there.length === shown.size && there.every((e) => { const s = shown.get(e.id); return !!s && same(s.start, e.start) && same(s.end, e.end); });
  if (!agrees) return { stamp: `${stamp}:mismatch` };
  return { mode: 'journal', view: viewFor(journal, minStart, keep), stamp };
}

/** Le moteur de l'écran, avec le journal quand il est prêt et cohérent. Sans accès (`null`) : exactement le moteur d'avant. */
export function withJournal(engine: ViewEngine, access: JournalAccess | null): ViewEngine {
  if (!access) return engine;
  const merge = (v: IntelView, opts?: Options): Options => ({ ...opts, ...journalOptions(access, v) });
  return {
    ...engine,
    intelligence: (v, opts) => engine.intelligence(v, merge(v, opts)),
    nextSleep: (v, opts) => engine.nextSleep(v, merge(v, opts)),
    bedtime: (v, opts) => engine.bedtime(v, merge(v, opts)),
  };
}
