// Suivi sur les données réelles : ce que le journal de l'appareil garde pour comparer, plus tard, recommandations et vrais endormissements.
import { afterEach, describe, expect, it } from 'vitest';
import { viewEngine } from '@/engine/bridge';
import { outcomesOf, readLog, type KeyValueStore } from '@/engine/evaluation/forecastLog';
import { readShadow, shadowOutcomes } from '@/engine/evaluation/shadowLog';
import { runIntelligence } from '@/engine/intelligence/run';
import { TARGETS } from '@/engine/intelligence/targets';
import { at, babyDays, MIN, screenView, withNight } from '@/engine/predictions/napFixtures';
import type { EngineEvent } from '@/engine/types';
import { readDeviceLogs } from './exportData';
import { withForecastLog } from './forecastRecorder';

const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
};
const original = { ...TARGETS.nap_start.models };
afterEach(() => {
  Object.assign(TARGETS.nap_start.models, original);
});
const noForecast = () => {
  for (const k of Object.keys(TARGETS.nap_start.models)) TARGETS.nap_start.models[k] = () => null;
};
const origin = new Date(2026, 8, 15);
/** les fenêtres affichées du prochain dodo (le journal note aussi coucher, durée et repas) */
const naps = (s: KeyValueStore) => readLog(s).filter((x) => (x.target ?? 'nap_start') === 'nap_start');

describe('suivi : chaque décision est retrouvable et comparable au vrai endormissement', () => {
  it('une recommandation affichée laisse tout : réveil, rang, prévision, recommandation, fenêtre présentée, confiance, logique', () => {
    noForecast();
    const s = mem(), events = withNight(390), wake = at(14, 390), now = at(14, 391);
    const out = withForecastLog(viewEngine, s).nextSleep(screenView(events, origin, now), { stamp: 'followup-1' });
    expect(out).toMatchObject({ kind: 'recommendation', model: 'recommendation', measured: false });

    // la fenêtre réellement affichée, sous le nom de sa logique : jamais celui d'un modèle
    const shown = naps(s);
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ wake, model: 'recommendation' });

    // le premier calcul après le réveil, avec tout ce qui permet de refaire l'analyse
    const [e] = readShadow(s);
    expect(e).toMatchObject({ wake, display: 'recommendation', served: 'recommendation', rank: 0, forecast: null });
    expect(e!.shownAt).toBe(now);
    expect(e!.shown).toEqual([shown[0]!.from, shown[0]!.to]);
    expect(e!.recommendation).toMatchObject({ confidence: expect.stringMatching(/low|medium|high/), spans: expect.any(Number), nEff: expect.any(Number), days: expect.any(Number) });
    expect(e!.recommendation!.window).toEqual(e!.shown);
    expect(Object.keys(e!.windows)).toContain('recommendation');
  });

  it('une prévision affichée est notée sous son modèle, avec la recommandation calculée à côté', () => {
    noForecast();
    TARGETS.nap_start.models.weighted7 = (_i, n) => ({ from: n + 55 * MIN, to: n + 95 * MIN });
    const s = mem(), events = withNight(435);
    withForecastLog(viewEngine, s).nextSleep(screenView(events, origin, at(14, 436)), { stamp: 'followup-2' });
    const [e] = readShadow(s);
    expect(e).toMatchObject({ display: 'forecast', served: 'weighted7', forecast: { model: 'weighted7' } });
    expect(e!.recommendation).not.toBeNull();
    expect(naps(s)[0]).toMatchObject({ model: 'weighted7' });
  });

  it('sans fuite du futur : les résultats se calculent après coup, jamais avec une fenêtre calculée après le dodo', () => {
    noForecast();
    const s = mem(), wake = at(14, 390);
    withForecastLog(viewEngine, s).nextSleep(screenView(withNight(390), origin, at(14, 391)), { stamp: 'followup-3' });
    const future: EngineEvent[] = [{ id: 'real', kind: 'sleep', start: at(14, 470), end: at(14, 540), enteredAt: at(14, 470), endKnownAt: at(14, 540) }];
    const events = [...withNight(390), ...future];
    const [reco] = outcomesOf(naps(s), events);
    expect(reco).toMatchObject({ wake, model: 'recommendation', actual: at(14, 470) });
    expect(reco!.shownAt).toBeLessThanOrEqual(reco!.actual!);
    expect(['inside', 'early', 'late']).toContain(reco!.status);
    // le même résultat par la voie des modèles : la recommandation y figure comme un candidat parmi les autres
    expect(shadowOutcomes(readShadow(s), events).recommendation![0]).toMatchObject({ actual: at(14, 470), status: reco!.status });
    // une entrée notée après le dodo n'est pas une prévision
    const late = shadowOutcomes([{ ...readShadow(s)[0]!, shownAt: at(14, 500) }], events);
    expect(late.recommendation![0]!.status).toBe('not_prospective');
  });

  it('la sauvegarde du Profil emporte ce journal', () => {
    noForecast();
    const s = mem();
    withForecastLog(viewEngine, s).nextSleep(screenView(withNight(390), origin, at(14, 391)), { stamp: 'followup-4' });
    const logs = readDeviceLogs(s)!;
    expect((logs.shadowLog as Array<{ recommendation: unknown }>)[0]!.recommendation).not.toBeNull();
    expect((logs.forecastLog as Array<{ model: string; target?: string }>).filter((x) => (x.target ?? 'nap_start') === 'nap_start')[0]!.model).toBe('recommendation');
  });
});

describe('une recommandation n’est jamais une prévision validée', () => {
  it('elle ne compte pas dans la mesure en direct des modèles ni dans leur confiance', () => {
    noForecast();
    const wake = at(14, 435);
    const log = Array.from({ length: 15 }, (_, i) => ({ wake: at(i, 435), from: at(i, 500), to: at(i, 540), shownAt: at(i, 436), model: 'recommendation', engine: 't' }));
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: withNight(435) }, wake + MIN, { targets: ['nap_start'], live: log });
    expect(r.evaluation[0]!.live?.n ?? 0).toBe(0);
    expect(r.predictions[0]!.confidence.live?.n ?? 0).toBe(0);
  });

  it('transmise à l’écran, elle porte son statut : kind recommendation, measured false, jamais le nom d’un modèle', () => {
    noForecast();
    const out = viewEngine.nextSleep(screenView(withNight(390), origin, at(14, 391)), { stamp: 'followup-5' });
    expect(out).toMatchObject({ kind: 'recommendation', measured: false, model: 'recommendation' });
  });

  it('une prévision validée par le rejeu reste une prévision (kind forecast) et garde sa priorité', () => {
    noForecast();
    TARGETS.nap_start.models.weighted7 = (_i, n) => ({ from: n + 55 * MIN, to: n + 95 * MIN });
    const out = viewEngine.nextSleep(screenView(withNight(435), origin, at(14, 436)), { stamp: 'followup-6' });
    expect(out).toMatchObject({ kind: 'forecast', model: 'weighted7' });
  });

  it('données insuffisantes : aucune recommandation artificiellement précise', () => {
    noForecast();
    const out = viewEngine.nextSleep(screenView([...babyDays(1).slice(0, 4), { id: 'n', kind: 'sleep', start: at(0, 1200), end: at(1, 400), enteredAt: at(0, 1200), endKnownAt: at(1, 400) }], origin, at(1, 401)), { stamp: 'followup-7' });
    expect(out).toBeNull();
  });
});
