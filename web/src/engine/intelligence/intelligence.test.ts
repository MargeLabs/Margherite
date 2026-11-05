import { describe, expect, it } from 'vitest';
import { visibleAt } from '../evaluation/backtest';
import { readLog, recordForecast, resolveLog, type KeyValueStore } from '../evaluation/forecastLog';
import type { EngineEvent } from '../types';
import { HISTORY_KEY, readHistory, recordHistory } from './history';
import { learnProfile } from './learn';
import { CAPABILITIES, runIntelligence } from './run';
import { evaluateTarget, TARGETS } from './targets';

const MIN = 60_000;
const at = (d: number, h: number, m = 0) => new Date(2026, 8, 1 + d, h, m).getTime();
const mem = (): KeyValueStore => {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

/**
 * Un bébé dont le coucher dépend de sa dernière sieste : sieste du soir tôt (15 h → 16 h 30, coucher 20 h) un jour sur deux,
 * tard (16 h 30 → 18 h, coucher 21 h 30) l'autre. Tout est saisi en direct.
 */
function baby(days: number, late = (d: number) => d % 2 === 1): EngineEvent[] {
  const out: EngineEvent[] = [];
  let n = 0;
  const sleep = (a: number, b: number) => out.push({ id: `s${n++}`, kind: 'sleep', start: a, end: b, enteredAt: a, endKnownAt: b });
  for (let d = 0; d < days; d++) {
    const l = late(d), napA = l ? at(d, 16, 30) : at(d, 15), napB = l ? at(d, 18) : at(d, 16, 30), bed = l ? at(d, 21, 30) : at(d, 20);
    sleep(at(d, 9, 30), at(d, 10, 30));
    sleep(at(d, 12), at(d, 13));
    sleep(napA, napB);
    sleep(bed, at(d + 1, 7));
    [7, 10, 13, 16, 19].forEach((h) => out.push({ id: `f${n++}`, kind: 'bottle', start: at(d, h, 5), ml: 120, enteredAt: at(d, h, 7) }));
  }
  return out;
}

describe('apprentissage individuel', () => {
  const events = baby(21);
  const now = at(21, 12);

  it('les jours récents pèsent plus : demi-vie de 7 jours', () => {
    const p = learnProfile({ birthAt: null, events }, now);
    expect(p.weight(p.tl.today - 1)).toBeGreaterThan(p.weight(p.tl.today - 8));
    expect(p.weight(p.tl.today - 7)).toBeCloseTo(0.5, 5);
  });

  it('une rupture raccourcit la mémoire de la série concernée seulement', () => {
    const p = learnProfile({ birthAt: null, events }, now);
    const broken = learnProfile({ birthAt: null, events }, now);
    broken.breaks.push('bedtime');
    expect(broken.weight(broken.tl.today - 3, 'bedtime')).toBeLessThan(p.weight(p.tl.today - 3, 'bedtime'));
    expect(broken.weight(broken.tl.today - 3, 'feeds')).toBeCloseTo(p.weight(p.tl.today - 3, 'feeds'), 10);
  });

  it('un seul passage donne couchers, siestes et leurs derniers réveils', () => {
    const p = learnProfile({ birthAt: null, events }, now);
    expect(p.beds.length).toBeGreaterThanOrEqual(15);
    const late = p.beds.filter((b) => b.rel === 21 * 60 + 30);
    expect(late.length).toBeGreaterThan(5);
    late.forEach((b) => expect(b.lastWake).toBe(18 * 60));
    expect(p.naps.some((n) => n.k === 0 && n.dur === 60)).toBe(true);
  });

  it('l’âge est un contexte : jamais un seuil', () => {
    const a = runIntelligence({ babyId: 'x', birthAt: at(-60, 8), events }, now, { targets: ['bedtime'] });
    const b = runIntelligence({ babyId: 'x', birthAt: null, events }, now, { targets: ['bedtime'] });
    expect(a.context.ageBand).toBe('1–3 mois');
    expect(b.context.ageDays).toBeNull();
    expect(a.predictions[0]?.window).toEqual(b.predictions[0]?.window);
  });
});

describe('coucher : le dernier réveil décale le coucher', () => {
  const events = baby(24);

  it('après une sieste tardive, le modèle prévoit un coucher tardif ; la plage habituelle ne bouge pas', () => {
    const t = at(24, 18, 5); // sieste finie à 18 h : coucher réel 21 h 30
    const today: EngineEvent[] = [
      { id: 'x1', kind: 'sleep', start: at(24, 9, 30), end: at(24, 10, 30) },
      { id: 'x2', kind: 'sleep', start: at(24, 12), end: at(24, 13) },
      { id: 'x3', kind: 'sleep', start: at(24, 16, 30), end: at(24, 18) },
    ];
    const input = { birthAt: null, events: [...events.filter((e) => e.start < at(24, 0)), ...today] };
    const w = TARGETS.bedtime.models.after_wake!(input, t)!, h = TARGETS.bedtime.models.habit!(input, t)!;
    expect(Math.abs((w.from + w.to) / 2 - at(24, 21, 30))).toBeLessThanOrEqual(20 * MIN);
    expect(Math.abs((h.from + h.to) / 2 - at(24, 21, 30))).toBeGreaterThan(30 * MIN);
  });

  it('avant la dernière sieste, il s’abstient plutôt que de deviner', () => {
    const input = { birthAt: null, events: events.filter((e) => e.start < at(24, 0)).concat([{ id: 'y', kind: 'sleep', start: at(24, 9, 30), end: at(24, 10, 30) }]) };
    expect(TARGETS.bedtime.models.after_wake!(input, at(24, 11))).toBeNull();
  });

  it('l’arbitre le retient uniquement parce qu’il bat la référence sur ses couchers passés', () => {
    const c = evaluateTarget('bedtime', { birthAt: null, events }, at(24, 12));
    expect(c.basis).toBe('measured_better');
    expect(c.chosen).toBe('after_wake');
    const me = c.evaluations.find((e) => e.model === 'after_wake')!, ref = c.evaluations.find((e) => e.model === c.reference)!;
    expect(me.intervalScoreMin!).toBeLessThan(ref.intervalScoreMin!);
    expect(me.answered).toBeGreaterThanOrEqual(10);
  });

  it('avec trop peu de jours, rien n’est mesuré : la référence sert', () => {
    const c = evaluateTarget('bedtime', { birthAt: null, events: baby(4) }, at(4, 12));
    expect(c.basis).toBe('unmeasured');
    expect(c.chosen).toBe('habit');
  });
});

describe('durée de sieste et repas', () => {
  const events = baby(24);
  it('la durée prévue est notée sur les dodos suivis en direct seulement', () => {
    const live = TARGETS.nap_duration.decisions(events).length;
    const late = TARGETS.nap_duration.decisions(events.map((e) => (e.kind === 'sleep' ? { ...e, enteredAt: e.start + 3 * 3_600_000 } : e))).length;
    expect(live).toBeGreaterThan(30);
    expect(late).toBe(0);
  });
  it('fenêtre de durée autour de la durée vraie (siestes régulières)', () => {
    const t = at(24, 9, 31), input = { birthAt: null, events: visibleAt(events, t) };
    const w = TARGETS.nap_duration.models.weighted!(input, t)!;
    expect(w.from).toBeLessThanOrEqual(90 * MIN);
    expect(w.to).toBeGreaterThanOrEqual(60 * MIN);
    expect(w.to - w.from).toBeGreaterThanOrEqual(30 * MIN);
  });
  it('un repas est prévu au moment où il a été saisi, pas avant', () => {
    const d = TARGETS.feed.decisions(events)[3]!;
    expect(d.at).toBeLessThan(d.actual);
    expect(d.known).toBe(d.actual);
  });
});

describe('moteur central', () => {
  const events = baby(24), now = at(24, 12);
  const r = runIntelligence({ babyId: 'x', birthAt: null, events }, now);

  it('quatre prévisions, avec une confiance justifiée par une mesure, jamais par une impression', () => {
    expect(r.predictions.map((p) => p.target)).toEqual(['nap_start', 'bedtime', 'nap_duration', 'feed']);
    for (const p of r.predictions) {
      expect(['measured', 'unmeasured']).toContain(p.confidence.level);
      if (p.confidence.level === 'measured') expect(p.confidence.basis).toBe('measured_better');
      expect(p.confidence.live).toBeNull();
      if (p.window && p.unit === 'instant') expect(p.window.to).toBeGreaterThan(p.window.from);
    }
    expect(r.predictions.find((p) => p.target === 'nap_duration')?.status).not.toBe('shown');
  });
  it('mode dégradé par défaut, et ce qui exige le journal 0004 est listé', () => {
    expect(r.mode).toBe('degraded');
    expect(r.predictions.every((p) => p.limits.includes('evaluation_approximate'))).toBe(true);
    expect(CAPABILITIES.filter((c) => c.needsJournal).map((c) => c.feature)).toContain('exact_replay_by_watermark');
    expect(CAPABILITIES.find((c) => c.feature === 'predictions_and_understanding')?.needsJournal).toBe(false);
  });
  it('même journal, même résultat', () => {
    expect(runIntelligence({ babyId: 'x', birthAt: null, events }, now).predictions).toEqual(r.predictions);
  });
  it('compréhension à la demande : habitudes, évolutions, associations, sans cause affirmée', () => {
    const u = runIntelligence({ babyId: 'x', birthAt: null, events }, now, { understand: true, targets: ['bedtime'] }).understanding!;
    expect(u.habits.length).toBeGreaterThan(0);
    expect(u.associations.every((a) => a.kind === 'hypothesis' && a.limits.includes('association_not_cause'))).toBe(true);
  });
  it('une rupture de rythme est détectée et signalée', () => {
    const shifted = baby(30, (d) => d >= 27);
    const rep = runIntelligence({ babyId: 'x', birthAt: null, events: shifted }, at(30, 12), { targets: ['bedtime'] });
    expect(rep.profile.breaks).toContain('bedtime');
    expect(rep.changes.find((c) => c.key === 'bedtime')?.status).toBe('break');
    expect(rep.predictions.find((x) => x.target === 'bedtime')?.limits).toContain('recent_break');
  });
});

describe('notes et historique', () => {
  const events = baby(24);
  it('un coucher noté se retrouve dans le soir qui suit le réveil, et se note comme les autres prévisions', () => {
    const s = mem(), wake = at(11, 18);
    recordForecast(s, { target: 'bedtime', wake, from: at(11, 21), to: at(11, 22), shownAt: wake + MIN, model: 'after_wake', engine: 't' }, { keepFirst: true });
    recordForecast(s, { target: 'bedtime', wake, from: at(11, 1), to: at(11, 2), shownAt: wake + 5 * MIN, model: 'x', engine: 't' }, { keepFirst: true });
    expect(readLog(s)).toHaveLength(1);
    expect(readLog(s)[0]!.from).toBe(at(11, 21));
    const r = resolveLog(readLog(s), events, 'bedtime');
    expect(r.pending).toBe(0);
    expect(r.predictions[0]).toMatchObject({ at: wake, actual: at(11, 21, 30) });
  });
  it('le journal des dodos et celui des couchers ne se mélangent pas', () => {
    const s = mem();
    recordForecast(s, { wake: 5, from: 1, to: 2, shownAt: 5, model: 'survival', engine: 't' });
    recordForecast(s, { target: 'bedtime', wake: 5, from: 1, to: 2, shownAt: 5, model: 'habit', engine: 't' });
    expect(readLog(s)).toHaveLength(2);
  });
  it('historique : une entrée par cible et par jour, la dernière évaluation fait foi', () => {
    const s = mem(), rep = runIntelligence({ babyId: 'x', birthAt: null, events }, at(24, 12), { targets: ['bedtime'] });
    recordHistory(s, rep);
    recordHistory(s, { ...rep, generatedAt: rep.generatedAt + 60 * MIN });
    recordHistory(s, { ...rep, generatedAt: rep.generatedAt + 86_400_000 });
    const h = readHistory(s);
    expect(h).toHaveLength(2);
    // premier jour sur l'appareil : le modèle gagne au rejeu mais n'est pas encore confirmé, la référence sert
    expect(h[0]).toMatchObject({ target: 'bedtime', chosen: 'habit', basis: 'measured_better', reason: 'switch_pending', candidate: 'after_wake' });
    expect(() => recordHistory({ getItem: () => null, setItem: () => { throw new Error('plein'); } }, rep)).not.toThrow();
    expect(readHistory({ getItem: () => '{cassé', setItem: () => {} })).toEqual([]);
    expect(HISTORY_KEY).toContain('modelhistory');
  });
  it('de bout en bout : jour 1 en attente, jour 2 adopté, chaque raison gardée dans l’historique', () => {
    const s = mem();
    const d1 = runIntelligence({ babyId: 'x', birthAt: null, events: baby(24) }, at(24, 12), { targets: ['bedtime'], history: readHistory(s), live: [] });
    expect(d1.evaluation[0]).toMatchObject({ chosen: 'habit', proposed: 'after_wake', reason: 'switch_pending' });
    recordHistory(s, d1);
    const d2 = runIntelligence({ babyId: 'x', birthAt: null, events: baby(25) }, at(25, 12), { targets: ['bedtime'], history: readHistory(s), live: [] });
    expect(d2.evaluation[0]).toMatchObject({ chosen: 'after_wake', reason: 'switch_confirmed', previous: 'habit' });
    expect(d2.predictions[0]!.confidence.level).toBe('measured');
    recordHistory(s, d2);
    expect(readHistory(s).map((x) => [x.chosen, x.reason])).toEqual([['habit', 'switch_pending'], ['after_wake', 'switch_confirmed']]);
  });
});
