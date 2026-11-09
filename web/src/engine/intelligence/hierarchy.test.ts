import { afterEach, describe, expect, it } from 'vitest';
import type { Prediction } from '../evaluation/backtest';
import { rng } from '../evaluation/synthetic';
import type { Window } from '../predictions/baselines';
import type { EngineEvent } from '../types';
import { viewEngine } from '../bridge';
import { judgeChallenger } from './challenger';
import { chooseDisplay } from './display';
import { resolveForecast } from './resolve';
import { runIntelligence } from './run';
import { evaluateTarget, fallbackOrder, TARGETS, type Choice } from './targets';

const MIN = 60_000, DAY = 86_400_000;
const at = (d: number, minutes: number) => new Date(2026, 8, 1 + d, 0, minutes).getTime();
const win = (from: number, to: number): Window => ({ from, to });

describe('hiérarchie de secours : resolveForecast', () => {
  const now = 1_000_000;
  const ok = win(now + 10 * MIN, now + 60 * MIN);
  const o = { now, maxWidthMin: 180 };

  it('le premier modèle qui rend une fenêtre valide sert ; l’ordre est respecté', () => {
    const r = resolveForecast(['a', 'b', 'c'], (m) => (m === 'a' ? null : ok), o);
    expect(r.model).toBe('b');
    expect(r.attempts).toEqual([{ model: 'a', outcome: 'no_answer' }, { model: 'b', outcome: 'used' }]);
  });

  it('scénario 10 — un modèle qui lève une erreur ne bloque pas le suivant', () => {
    const r = resolveForecast(['bayes', 'survival', 'weighted7'], (m) => {
      if (m === 'bayes') throw new Error('boom');
      return ok;
    }, o);
    expect(r.model).toBe('survival');
    expect(r.attempts[0]).toEqual({ model: 'bayes', outcome: 'error' });
  });

  it('distingue données insuffisantes, fenêtre invalide, trop large et incohérente', () => {
    const asks: Record<string, Window | null> = { m1: null, m2: win(NaN, now + 5), m3: win(now + 50, now + 10), m4: win(now - 60 * MIN, now - 10 * MIN), m5: win(now, now + 500 * MIN), m6: ok };
    const r = resolveForecast(['m1', 'm2', 'm3', 'm4', 'm5', 'habit', 'm6'], (m) => (m === 'habit' ? ok : asks[m] ?? null), { ...o, explain: (m) => (m === 'm1' ? 'insufficient_data' : null), coherent: (m) => m !== 'habit' });
    expect(r.attempts.map((a) => a.outcome)).toEqual(['insufficient_data', 'invalid_window', 'invalid_window', 'invalid_window', 'window_too_wide', 'incoherent', 'used']);
    expect(r.model).toBe('m6');
  });

  it('si tous échouent : aucune fenêtre inventée, toutes les raisons gardées', () => {
    const r = resolveForecast(['a', 'b'], () => null, o);
    expect(r).toEqual({ model: null, window: null, attempts: [{ model: 'a', outcome: 'no_answer' }, { model: 'b', outcome: 'no_answer' }] });
  });

  it('un modèle répété dans l’ordre n’est essayé qu’une fois', () => {
    let calls = 0;
    resolveForecast(['a', 'a', 'a'], () => { calls++; return null; }, o);
    expect(calls).toBe(1);
  });
});

describe('challenger : doit battre le meilleur modèle en place', () => {
  const now = at(30, 720);
  /** 24 décisions sur 12 jours ; la fenêtre est centrée sur le vrai instant décalé de `bias` min, de demi-largeur `half` min. */
  const preds = (bias: (i: number) => number, half: number): Prediction[] =>
    Array.from({ length: 24 }, (_, i) => {
      const a = now - (24 - i) * 0.5 * DAY + 3 * 3_600_000, actual = a + 90 * MIN, c = actual + bias(i) * MIN;
      return { at: a, actual, window: win(c - half * MIN, c + half * MIN) };
    });
  const rivals = (...p: Array<[string, Prediction[]]>) => p;

  it('promu : meilleur d’au moins 10 % que le meilleur rival, aussi couvert, pas plus large, constant', () => {
    const v = judgeChallenger('new', preds(() => 2, 25), rivals(['best', preds((i) => (i % 2 ? 40 : -40), 25)], ['habit', preds(() => 90, 25)]), now);
    expect(v).toMatchObject({ promoted: true, over: 'best', blocked: [] });
    expect(v.gain).toBeGreaterThan(0.1);
  });

  it('battre seulement une référence faible ne suffit pas', () => {
    const v = judgeChallenger('new', preds(() => 30, 25), rivals(['best', preds(() => 30, 25)], ['habit', preds(() => 90, 25)]), now);
    expect(v.promoted).toBe(false);
    expect(v.blocked).toContain('gain_below_min');
    expect(v.over).toBe('best');
  });

  it('une fenêtre bien plus large pour gagner en couverture est refusée', () => {
    const v = judgeChallenger('new', preds(() => 0, 120), rivals(['best', preds(() => 60, 30)]), now);
    expect(v.promoted).toBe(false);
    expect(v.blocked).toContain('too_wide');
  });

  it('un gain qui n’existe que sur une moitié de la période est refusé', () => {
    const v = judgeChallenger('new', preds((i) => (i < 12 ? 0 : 150), 25), rivals(['best', preds((i) => (i < 12 ? 60 : 40), 25)]), now);
    expect(v.promoted).toBe(false);
    expect(v.blocked).toContain('unstable');
  });

  it('trop peu de cas : jamais promu', () => {
    const v = judgeChallenger('new', preds(() => 0, 25).slice(0, 5), rivals(['best', preds(() => 90, 25)]), now);
    expect(v.promoted).toBe(false);
    expect(v.blocked).toContain('not_enough_cases');
  });
});

describe('prochain dodo : hiérarchie dans le moteur', () => {
  const original = { ...TARGETS.nap_start.models };
  afterEach(() => {
    Object.assign(TARGETS.nap_start.models, original);
  });

  /** 14 jours : réveil ~7 h 15, siestes 1 h 10 après chaque réveil. */
  function baby(): EngineEvent[] {
    const u = rng(3), out: EngineEvent[] = [];
    let k = 0, prevBed = 1200;
    const sl = (a: number, e: number, sd: number, ed: number) => out.push({ id: `s${k++}`, kind: 'sleep', start: at(sd, a), end: at(ed, e), enteredAt: at(sd, a), endKnownAt: at(ed, e) });
    for (let d = 0; d < 14; d++) {
      const wake = 435 + Math.round((u() * 2 - 1) * 40), n1 = wake + 70, n2 = n1 + 60 + 100, n3 = n2 + 85 + 110;
      sl(prevBed, wake, d - 1, d); sl(n1, n1 + 60, d, d); sl(n2, n2 + 85, d, d); sl(n3, n3 + 50, d, d);
      prevBed = 1200;
      [0, 3, 6, 9, 12].forEach((h) => out.push({ id: `f${k++}`, kind: 'bottle', start: at(d, wake + h * 60 + 5), ml: 120, enteredAt: at(d, wake + h * 60 + 7) }));
    }
    return out;
  }
  const morning = (events: EngineEvent[], wake: number) => [...events, { id: 'n', kind: 'sleep' as const, start: at(13, 1200), end: at(14, wake), enteredAt: at(13, 1200), endKnownAt: at(14, wake) }];

  it('tous les modèles échouent : état explicite d’indisponibilité, pas de fenêtre', () => {
    for (const k of Object.keys(TARGETS.nap_start.models)) TARGETS.nap_start.models[k] = () => null;
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: morning(baby(), 420) }, at(14, 421), { targets: ['nap_start'] });
    const p = r.predictions[0]!;
    expect(p).toMatchObject({ status: 'abstained', window: null, abstained: { reason: 'no_reliable_forecast' } });
    expect(p.attempts!.every((a) => a.outcome !== 'used')).toBe(true);
    expect(p.attempts!.length).toBeGreaterThanOrEqual(3);
  });

  it('le modèle choisi lève une erreur : le suivant de la hiérarchie sert, le moteur continue', () => {
    TARGETS.nap_start.models.weighted7 = () => { throw new Error('boom'); };
    TARGETS.nap_start.models.habit = () => { throw new Error('boom'); };
    TARGETS.nap_start.models.survival = (_i, now) => win(now + 30 * MIN, now + 90 * MIN);
    TARGETS.nap_start.models.survival_age = () => null;
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: morning(baby(), 420) }, at(14, 421), { targets: ['nap_start'] });
    const p = r.predictions[0]!;
    expect(p.model).toBe('survival');
    expect(p.status).toBe('shown');
    expect(p.attempts![0]).toEqual({ model: 'weighted7', outcome: 'error' });
    expect(p.confidence.level).toBe('unmeasured');
    expect(p.confidence.why).toContain('fallback_used');
  });

  it('le nouveau modèle est calculé pour le journal mais jamais affiché tant qu’il n’est pas promu', () => {
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: morning(baby(), 420) }, at(14, 421), { targets: ['nap_start'] });
    const p = r.predictions[0]!, ev = r.evaluation[0]!;
    expect(p.challenger?.model).toBe('survival_bayesian_habit');
    if (!ev.challenger?.promoted) expect(p.model).not.toBe('survival_bayesian_habit');
  });

  it('avec candidates : la fenêtre de chaque modèle, répondu ou non, pour la mesure en direct', () => {
    const events = morning(baby(), 420), r = runIntelligence({ babyId: 'x', birthAt: null, events }, at(14, 421), { targets: ['nap_start'], candidates: true });
    expect(Object.keys(r.predictions[0]!.candidates!).sort()).toEqual([...Object.keys(TARGETS.nap_start.models), 'recommendation'].sort());
    expect(runIntelligence({ babyId: 'x', birthAt: null, events }, at(14, 421), { targets: ['nap_start'] }).predictions[0]!.candidates).toBeUndefined();
  });

  it('un créneau habituel qui ferait attendre bien plus que ses éveils observés n’est pas cohérent', () => {
    const events = morning(baby(), 390), wake = at(14, 390), coherent = TARGETS.nap_start.coherent!, input = { birthAt: null, events };
    expect(coherent('habit', win(wake + 70 * MIN, wake + 110 * MIN), input, wake)).toBe(true);
    expect(coherent('habit', win(wake + 240 * MIN, wake + 280 * MIN), input, wake)).toBe(false);
    expect(coherent('weighted7', win(wake + 240 * MIN, wake + 280 * MIN), input, wake)).toBe(true);
    expect(coherent('habit', win(wake + 70 * MIN, wake + 110 * MIN), { birthAt: null, events: events.slice(-6) }, wake)).toBe(false);
  });

  it('aucune fuite du futur : chaque modèle ne reçoit que ce qui était saisi à l’instant de la prévision', () => {
    const seen: Array<{ at: number; events: EngineEvent[] }> = [];
    TARGETS.nap_start.models.spy = (i, now) => {
      seen.push({ at: now, events: i.events });
      return null;
    };
    try {
      evaluateTarget('nap_start', { birthAt: null, events: morning(baby(), 420) }, at(14, 421));
    } finally {
      delete TARGETS.nap_start.models.spy;
    }
    expect(seen.length).toBeGreaterThan(10);
    for (const { at: t, events } of seen) {
      for (const e of events) {
        expect(e.start).toBeLessThanOrEqual(t);
        expect(e.enteredAt ?? e.start).toBeLessThanOrEqual(t);
        if (e.end !== undefined) {
          expect(e.end).toBeLessThanOrEqual(t);
          expect(e.endKnownAt ?? e.end).toBeLessThanOrEqual(t);
        }
      }
    }
  });

  it('ordre de secours : choisi, meilleure survie, weighted7, habitudes', () => {
    const ev = (model: string, s: number) => ({ model, decisions: 20, answered: 20, coverage: 0.7, medianErrorMin: 20, medianWidthMin: 60, intervalScoreMin: s });
    const c = { target: 'nap_start', chosen: 'habit_wake', reference: 'habit', evaluations: [ev('survival', 200), ev('survival_age', 150)] } as unknown as Choice;
    expect(fallbackOrder(c)).toEqual(['habit_wake', 'survival_age', 'weighted7', 'habit']);
  });
});

describe('prévision ou recommandation', () => {
  const reco = (from: number, to: number) => ({ window: { from, to }, center: (from + to) / 2, confidence: 'medium' as const, basis: { spans: 20, nEff: 8, days: 7, rank: 0, trend: null, matched: [] } });
  const habitAt = (from: number) => ({ shown: true, model: 'habit', reference: 'habit', window: { from, to: from + 60 * MIN } });

  it('pas de prévision : la recommandation prend le relais ; pas de recommandation non plus : rien', () => {
    expect(chooseDisplay({ shown: false, model: 'habit', reference: 'habit', window: null }, reco(100, 200))).toBe('recommendation');
    expect(chooseDisplay({ shown: false, model: 'habit', reference: 'habit', window: null }, null)).toBeNull();
  });

  it('une prévision cohérente avec la recommandation reste une prévision ; un modèle choisi n’est jamais remplacé', () => {
    expect(chooseDisplay(habitAt(150), reco(100, 200))).toBe('forecast');
    expect(chooseDisplay({ shown: true, model: 'weighted7', reference: 'habit', window: { from: 5000, to: 6000 } }, reco(100, 200))).toBe('forecast');
  });

  it('le créneau habituel qui commence après la fin de la fenêtre conseillée est remplacé par la recommandation', () => {
    expect(chooseDisplay(habitAt(201), reco(100, 200))).toBe('recommendation');
  });

  const original = { ...TARGETS.nap_start.models };
  afterEach(() => {
    Object.assign(TARGETS.nap_start.models, original);
  });
  function babyDays(): EngineEvent[] {
    const u = rng(3), out: EngineEvent[] = [];
    let k = 0, prevBed = 1200;
    const sl = (a: number, e: number, sd: number, ed: number) => out.push({ id: `s${k++}`, kind: 'sleep', start: at(sd, a), end: at(ed, e), enteredAt: at(sd, a), endKnownAt: at(ed, e) });
    for (let d = 0; d < 14; d++) {
      const wake = 435 + Math.round((u() * 2 - 1) * 40), n1 = wake + 70, n2 = n1 + 60 + 100, n3 = n2 + 85 + 110;
      sl(prevBed, wake, d - 1, d); sl(n1, n1 + 60, d, d); sl(n2, n2 + 85, d, d); sl(n3, n3 + 50, d, d);
      prevBed = 1200;
      [0, 3, 6, 9, 12].forEach((h) => out.push({ id: `f${k++}`, kind: 'bottle', start: at(d, wake + h * 60 + 5), ml: 120, enteredAt: at(d, wake + h * 60 + 7) }));
    }
    return out;
  }
  const withNight = (wake: number) => [...babyDays(), { id: 'n', kind: 'sleep' as const, start: at(13, 1200), end: at(14, wake), enteredAt: at(13, 1200), endKnownAt: at(14, wake) }];

  it('aucun modèle ne peut prévoir : l’état « pas de prévision fiable » n’empêche pas la recommandation', () => {
    for (const k of Object.keys(TARGETS.nap_start.models)) TARGETS.nap_start.models[k] = () => null;
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: withNight(390) }, at(14, 391), { targets: ['nap_start'] }), p = r.predictions[0]!;
    expect(p).toMatchObject({ status: 'abstained', abstained: { reason: 'no_reliable_forecast' }, display: 'recommendation' });
    expect(p.recommendation).not.toBeNull();
    expect(p.recommendation!.window.from).toBeGreaterThanOrEqual(at(14, 390));
  });

  it('réveil précoce, créneau habituel trop tardif pour ses éveils : la recommandation est avancée', () => {
    for (const k of Object.keys(TARGETS.nap_start.models)) TARGETS.nap_start.models[k] = () => null;
    // créneau habituel à 1 h 45 du réveil : encore dans la fourchette de ses éveils (jusqu'à ~1 h 50), donc servi, mais pas avec ses éveils du matin (~1 h 10)
    TARGETS.nap_start.models.habit = (_i, now) => ({ from: now + 105 * MIN, to: now + 150 * MIN });
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: withNight(390) }, at(14, 391), { targets: ['nap_start'] }), p = r.predictions[0]!;
    expect(p.model).toBe('habit');
    expect(p.display).toBe('recommendation');
    expect(p.recommendation!.window.to).toBeLessThan(p.window!.from);
  });

  it('réveil habituel : le créneau habituel reste la prévision, pas de conseil inutile', () => {
    for (const k of Object.keys(TARGETS.nap_start.models)) TARGETS.nap_start.models[k] = () => null;
    TARGETS.nap_start.models.habit = (_i, now) => ({ from: now + 55 * MIN, to: now + 95 * MIN });
    const r = runIntelligence({ babyId: 'x', birthAt: null, events: withNight(435) }, at(14, 436), { targets: ['nap_start'] }), p = r.predictions[0]!;
    expect(p.model).toBe('habit');
    expect(p.display).toBe('forecast');
  });

  it('l’écran reçoit une recommandation étiquetée comme telle, jamais confondue avec une prévision', () => {
    for (const k of Object.keys(TARGETS.nap_start.models)) TARGETS.nap_start.models[k] = () => null;
    const origin = new Date(2026, 8, 15), events = withNight(390), minutes = (t: number) => Math.round((t - origin.getTime()) / MIN);
    const view = { origin, now: minutes(at(14, 391)), events: events.map((e) => ({ id: e.id, k: e.kind === 'bottle' ? 'bib' : 'sleep', a: minutes(e.start), ...(e.end !== undefined ? { b: minutes(e.end) } : {}), ...(e.ml ? { ml: e.ml } : {}) })), birthAt: null };
    const out = viewEngine.nextSleep(view, { stamp: 'reco-test' });
    expect(out).toMatchObject({ kind: 'recommendation', model: 'recommendation', measured: false });
    expect(['low', 'medium', 'high']).toContain(out!.confidence);
    expect(out!.b).toBeGreaterThan(out!.a);
    expect(out!.a).toBeGreaterThanOrEqual(view.now - 1);
  });
});
