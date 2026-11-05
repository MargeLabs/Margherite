// Branche les journaux de mesure sur ce que le moteur montre : fenêtres de dodo affichées, prévisions notées sans affichage (coucher, durée de
// sieste, repas) et historique des modèles. Vit ici et non dans le moteur : le moteur ne touche jamais au stockage.
// Local à l'appareil, jamais bloquant, ne modifie ni le journal du bébé ni l'écran.
import { readLog, recordForecast, type KeyValueStore } from '@/engine/evaluation/forecastLog';
import { threshold } from '@/engine/config';
import { readHistory, recordHistory } from '@/engine/intelligence/history';
import type { IntelligenceReport, Options } from '@/engine/intelligence/run';
import type { ViewEngine } from '@/engine/bridge';
import { ENGINE_VERSION } from '@/engine/version';

/** Seules les prévisions faites avant leur résultat comptent : une fenêtre déjà commencée, ou une durée prévue longtemps après le début, serait rétrospective. */
function noteReport(store: KeyValueStore, r: IntelligenceReport): void {
  recordHistory(store, r);
  for (const p of r.predictions) {
    if (p.target === 'nap_start' || p.anchor === null || !p.window) continue;
    const prospective = p.target === 'nap_duration' ? r.generatedAt - p.anchor <= threshold('liveEntryMax') * 60_000 : r.generatedAt <= p.window.from;
    if (prospective) recordForecast(store, { target: p.target, wake: p.anchor, from: p.window.from, to: p.window.to, shownAt: r.generatedAt, model: p.model, engine: ENGINE_VERSION, watermark: null }, { keepFirst: true });
  }
}

export function withForecastLog(engine: ViewEngine, store: KeyValueStore | null): ViewEngine {
  if (!store) return engine;
  let noted: IntelligenceReport | null = null;
  // le moteur lit ce que l'appareil a déjà affiché (résultats réels) et son historique de modèles (règle de stabilité)
  const withDevice = (opts?: Options): Options => ({ ...opts, live: readLog(store), history: readHistory(store) });
  return {
    ...engine,
    intelligence(v, opts) {
      const r = engine.intelligence(v, withDevice(opts));
      if (r !== noted) {
        noted = r;
        noteReport(store, r);
      }
      return r;
    },
    bedtime(v, opts) {
      this.intelligence(v, opts);
      return engine.bedtime(v, withDevice(opts));
    },
    nextSleep(v, opts) {
      const rep = this.intelligence(v, opts);
      const r = engine.nextSleep(v, withDevice(opts));
      const sleeps = v.events.filter((e) => e.k === 'sleep');
      const ms = (t: number) => new Date(v.origin.getFullYear(), v.origin.getMonth(), v.origin.getDate(), 0, t).getTime();
      // ce que l'écran montre : la fenêtre du modèle, ou sinon la plage habituelle (la référence, calculée à l'identique par l'écran)
      const p = rep.predictions.find((x) => x.target === 'nap_start'), ref = rep.evaluation.find((x) => x.target === 'nap_start')?.reference;
      const inDay = v.now % 1440 >= threshold('forecastDayStart') && v.now % 1440 < threshold('forecastDayEnd');
      const shown = r ? { from: ms(r.a), to: ms(r.b), model: r.model } : inDay && p?.status === 'shown' && p.window && p.model === ref ? { ...p.window, model: p.model } : null;
      // il dort (fin absente) ou aucun réveil connu : pas de prévision à noter
      if (shown && sleeps.length && sleeps.every((e) => e.b !== undefined)) {
        const wake = ms(Math.max(...sleeps.map((e) => e.b as number)));
        recordForecast(store, { wake, from: shown.from, to: shown.to, shownAt: ms(v.now), model: shown.model, engine: ENGINE_VERSION });
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
