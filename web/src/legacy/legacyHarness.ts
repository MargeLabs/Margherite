// Fait tourner le calcul de production tel quel, hors écran : pour le figer (golden) et pour le mesurer (backtest).
import { blankStore, viewData, type Prefs } from '@/data/household';
import type { Snapshot } from '@/data/repo';
import type { EventRow } from '@/data/types';
import { rawFromEvent } from '@/engine/adapters';
import type { EngineEvent } from '@/engine/types';
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

