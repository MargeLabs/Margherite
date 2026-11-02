// Fait tourner le calcul de production tel quel, hors écran : pour le figer (golden) et pour le mesurer (backtest).
import { blankStore, viewData, type Prefs } from '@/data/household';
import type { Snapshot } from '@/data/repo';
import type { EventRow } from '@/data/types';
import { rawFromEvent } from '@/engine/adapters';
import type { EngineEvent, EngineInput } from '@/engine/types';
import { DCLogic } from './dc-engine';
import { createLogicClass } from './app.logic.generated';
import defaults from './props.generated.json';

type Vals = Record<string, unknown>;
const Logic = (createLogicClass as unknown as (b: typeof DCLogic) => new (p: Record<string, unknown>) => DCLogic)(DCLogic);
const PREFS: Prefs = { mine: {} };

export function legacyVals(events: EngineEvent[], birthAt: number | null, now: Date): Vals {
  const rows = events.map(rawFromEvent) as unknown as EventRow[];
  const snap: Snapshot = { baby: { id: 1, first_name: 'Bébé', birth_at: new Date(birthAt ?? now.getTime()).toISOString() }, events: rows, pumps: [], kv: {} };
  const store = blankStore(now, { ...viewData(snap, PREFS, now, false) });
  const l = new Logic({ ...defaults, store });
  l.state = {};
  return l.renderVals() as Vals;
}

/** La fenêtre du prochain dodo affichée sur l'Accueil, ou null si l'app n'en propose pas. */
export function legacyNextSleep(input: Pick<EngineInput, 'birthAt' | 'events'>, now: number): { from: number; to: number } | null {
  const date = new Date(now);
  const nx = legacyVals(input.events, input.birthAt, date).nx as { on: boolean; win?: string };
  const m = nx.on && nx.win ? /(\d+):(\d+)\D+(\d+):(\d+)/.exec(nx.win) : null;
  if (!m) return null;
  const at = (h: string | undefined, mi: string | undefined) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(h), Number(mi)).getTime();
  const from = at(m[1], m[2]);
  let to = at(m[3], m[4]);
  if (to < from) to += 86_400_000;
  return { from, to };
}
