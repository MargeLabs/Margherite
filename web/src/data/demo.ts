// Jeu de démonstration (développement et tests seulement) : les 28 jours d'exemple de la maquette V5, posés dans le dépôt local.
// Sert à vérifier que l'app calcule exactement comme la maquette, sur les mêmes données.
import { newEventFromView } from './mapping';
import type { Snapshot } from './repo';
import { viewToShared, type MineByDay, type WellDay } from './shared';
import type { EventRow, PumpRow, ViewEvent, ViewPump } from './types';

interface DemoFile {
  events: ViewEvent[];
  pumps: ViewPump[];
  well: Record<string, WellDay>;
}

export async function demoSnapshot(origin: Date): Promise<{ snapshot: Snapshot; mine: MineByDay }> {
  const demo = (await import('@/legacy/demo.generated.json')).default as unknown as DemoFile;
  const events: EventRow[] = demo.events.map((e) => {
    const { id, ...rest } = e;
    const n = newEventFromView(rest, origin);
    return { id, kind: n.kind, started_at: n.startedAt.toISOString(), ended_at: n.endedAt ? n.endedAt.toISOString() : null, payload: n.payload };
  });
  const pumps: PumpRow[] = demo.pumps.map((p) => ({
    id: p.id,
    legacy_id: null,
    at: newEventFromView({ k: 'chg', a: p.a }, origin).startedAt.toISOString(),
    left_ml: p.g,
    right_ml: p.d,
  }));
  const well: Record<number, WellDay> = {};
  for (const [d, day] of Object.entries(demo.well)) well[Number(d)] = day;
  const shared = viewToShared({ well }, origin);
  // Léo, né le mardi 25 août 2026 à 8 h 42 : 9 semaines le 27 octobre
  const baby = { id: 1 as const, first_name: 'Léo', birth_at: new Date(2026, 7, 25, 8, 42).toISOString() };
  return { snapshot: { baby, events, pumps, kv: shared.kv }, mine: shared.mine ?? {} };
}
