import { describe, expect, it } from 'vitest';
import { ageBand, calibrationByWidth, detectionStudy, dropEvents, firstBreakDay, historyBand, historyDaysAt, stratify, windowProbabilityScores } from './diagnostics';
import type { Prediction } from './backtest';
import { survivalAgeModel, survivalModel } from '../predictions/models';
import { SCENARIOS, syntheticLog } from './synthetic';
import { domainCoverage } from '../quality';
import type { EngineEvent } from '../types';

const MIN = 60_000, DAY = 86_400_000;
const p = (at: number, from: number, to: number, actual: number): Prediction => ({ at, actual, window: { from, to } });

describe('diagnostics du banc', () => {
  it('Brier et log loss : calculés à la main', () => {
    // 2 dedans, 1 dehors, annoncé 0,8 : Brier = (2 × 0,04 + 0,64) / 3 ; log loss = (2 × −ln 0,8 + −ln 0,2) / 3
    const r = windowProbabilityScores([p(0, 0, 10, 5), p(1, 0, 10, 10), p(2, 0, 10, 99)])!;
    expect(r.brier).toBeCloseTo((0.08 + 0.64) / 3, 10);
    expect(r.logLoss).toBeCloseTo((2 * -Math.log(0.8) + -Math.log(0.2)) / 3, 10);
    expect(windowProbabilityScores([{ at: 0, actual: 0, window: null }])).toBeNull();
  });

  it('calibration par largeur : trois groupes, étroites d’abord', () => {
    const preds = [10, 20, 30, 40, 50, 60].map((w, i) => p(i, 0, w * MIN, i < 4 ? 1 : w * MIN * 2));
    const bins = calibrationByWidth(preds);
    expect(bins.map((b) => b.n)).toEqual([2, 2, 2]);
    expect(bins.map((b) => b.coverage)).toEqual([1, 1, 0]);
    expect(calibrationByWidth(preds.slice(0, 3))).toEqual([]);
  });

  it('historique vu à l’instant, jamais après', () => {
    const ev = [{ id: 'a', kind: 'diaper', start: 0 }, { id: 'b', kind: 'diaper', start: 10 * DAY }] as EngineEvent[];
    expect(historyDaysAt(ev, 3 * DAY)).toBe(3);
    expect(historyDaysAt(ev, 12 * DAY)).toBe(12);
    expect([historyBand(2), historyBand(5), historyBand(10), historyBand(30)]).toEqual(['0–3 j', '4–7 j', '8–14 j', '15 j et +']);
    expect([ageBand(null), ageBand(10), ageBand(45), ageBand(120), ageBand(400)]).toEqual(['âge inconnu', '< 1 mois', '1–3 mois', '3–6 mois', '6 mois et +']);
  });

  it('strates : chaque décision tombe dans un seul groupe', () => {
    const s = stratify([p(0, 0, 1, 0), p(1, 0, 1, 0), p(2, 0, 1, 9)], (x) => (x.at < 2 ? 'a' : 'b'));
    expect(s.map((x) => [x.label, x.score.decisions])).toEqual([['a', 2], ['b', 1]]);
  });

  it('journal troué : part retirée, déterministe', () => {
    const log = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 8, 1), days: 10 });
    const a = dropEvents(log, 0.3, 4), b = dropEvents(log, 0.3, 4);
    expect(a).toEqual(b);
    expect(a.length / log.length).toBeGreaterThan(0.6);
    expect(a.length / log.length).toBeLessThan(0.8);
  });

  it('rupture : détectée après le vrai jour, jamais sur une série plate', () => {
    expect(firstBreakDay(Array(20).fill(3))).toBeNull();
    const d = firstBreakDay([...Array(14).fill(4), ...Array(10).fill(3)]);
    expect(d).not.toBeNull();
    expect(d!).toBeGreaterThanOrEqual(14);
    const st = detectionStudy(10);
    expect(st.recall).not.toBeNull();
    expect(st.falseAlarms).toBeLessThanOrEqual(st.stable);
  });
});

describe('survie avec âge', () => {
  const from = new Date(2026, 8, 1), log = syntheticLog({ ...SCENARIOS.nouveauNe!, from, days: 20 });
  const now = Math.max(...log.filter((e) => e.kind === 'sleep').map((e) => e.end ?? 0)) + 5 * MIN;
  const open = log.filter((e) => e.start < now);
  it('sans date de naissance : identique à la production', () => {
    expect(survivalAgeModel({ birthAt: null, events: open }, now)).toEqual(survivalModel({ birthAt: null, events: open }, now));
  });
  it('avec date de naissance : répond, ou s’abstient, sans erreur', () => {
    const w = survivalAgeModel({ birthAt: from.getTime() - 20 * DAY, events: open }, now);
    expect(w === null || w.to > w.from).toBe(true);
  });
});

describe('complétude par domaine', () => {
  const t = (d: number, h: number) => new Date(2026, 8, d, h).getTime();
  const ev = [
    { id: '1', kind: 'sleep', start: t(1, 8), end: t(1, 9) }, { id: '2', kind: 'bottle', start: t(1, 10), ml: 90 },
    { id: '3', kind: 'sleep', start: t(2, 8), end: t(2, 9) },
    { id: '4', kind: 'sleep', start: t(4, 8), end: t(4, 9) }, { id: '5', kind: 'breast', start: t(4, 9) },
  ] as EngineEvent[];
  it('compte les jours notés par domaine ; un jour non noté n’est pas un zéro', () => {
    const c = domainCoverage(ev, t(5, 12), 4);
    expect(c).toEqual({ days: 4, sleepDays: 3, feedDays: 2, bothDays: 2, unnotedDays: 1 });
  });
});
