// Branche le journal de mesure sur le prochain dodo affiché. Vit ici et non dans le moteur : le moteur ne touche jamais au stockage.
// Local à l'appareil, jamais bloquant, ne modifie ni le journal du bébé ni l'écran.
import { recordForecast, type KeyValueStore } from '@/engine/evaluation/forecastLog';
import type { ViewEngine } from '@/engine/bridge';
import { ENGINE_VERSION } from '@/engine/version';

export function withForecastLog(engine: ViewEngine, store: KeyValueStore | null): ViewEngine {
  if (!store) return engine;
  return {
    ...engine,
    nextSleep(v) {
      const r = engine.nextSleep(v);
      const sleeps = v.events.filter((e) => e.k === 'sleep');
      // il dort (fin absente) ou aucun réveil connu : pas de prévision à noter
      if (r && sleeps.length && sleeps.every((e) => e.b !== undefined)) {
        const ms = (t: number) => new Date(v.origin.getFullYear(), v.origin.getMonth(), v.origin.getDate(), 0, t).getTime();
        const wake = ms(Math.max(...sleeps.map((e) => e.b as number)));
        recordForecast(store, { wake, from: ms(r.a), to: ms(r.b), shownAt: ms(v.now), model: 'survival', engine: ENGINE_VERSION });
      }
      return r;
    },
  };
}

export const deviceStore = (): KeyValueStore | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
