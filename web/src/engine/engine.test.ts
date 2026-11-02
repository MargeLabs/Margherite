import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { eventFromRaw, rawFromEvent, type RawEventRow } from './adapters';
import { THRESHOLDS } from './config';
import { decisions, pairedGain, replay, score, visibleAt, type Prediction } from './evaluation/backtest';
import { rng, SCENARIOS, syntheticLog } from './evaluation/synthetic';
import { awakeQuartiles, lastInterval, type Forecaster } from './predictions/baselines';
import { bottleMilk, feedingMode } from './feeding/mode';
import { ageInDays } from './age';
import { falseLinkRates, simulateRows } from './evaluation/nullLinks';
import { arbiter, conformal, decide, holdout, MODEL_REGISTRY } from './evaluation/selection';
import { describeNextFeed, feedTimes } from './feeding/nextFeed';
import { analyze, type EngineReport } from './analyze';
import { habitsModel } from './index';
import { checkText } from './safety/vocabulary';
import { renderFact, TEMPLATES } from './safety/templates';
import { bayesAwake, dayAwakeSpans, fitHazard, kalmanAwake, localLevel, survivalModel, weightedAwake, weightedQuantile } from './predictions/models';
import { changeProbabilities, classifySeries, cusum } from './rhythm/change';
import { associations, benjaminiHochberg, residualize } from './patterns/associations';
import { LEGACY_RULES } from './rules';
import { frequentMotifs, transitions, type Token } from './patterns/sequences';
import { tagsFromWell } from './patterns/transversal';
import { ENGINE_VERSION } from './version';
import { assessQuality, hasDstShift } from './quality';
import type { EngineEvent } from './types';

const MIN = 60_000;
const t = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
const sleep = (id: string, a: number, b?: number, extra: Partial<EngineEvent> = {}): EngineEvent => ({ id, kind: 'sleep', start: a, ...(b !== undefined ? { end: b } : {}), ...extra });

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.ts$/.test(f) && !/\.(test|backtest)\.ts$/.test(f) ? [p] : [];
  });
}

describe('architecture', () => {
  it('le moteur ne dépend ni de l’interface, ni de la base, ni du calcul existant', () => {
    for (const f of sources(__dirname)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from '(react|next|@supabase|@\/legacy|@\/data|@\/lib)/);
  });

  it('le moteur ne lit jamais l’heure courante ni le réseau', () => {
    for (const f of sources(__dirname)) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Date\.now\(\)|new Date\(\)|fetch\(|localStorage|Math\.random/);
  });

  it('aucun seuil de minutes en dur hors du registre', () => {
    for (const f of sources(__dirname).filter((x) => !/config\.ts$|synthetic\.ts$/.test(x))) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\b(420|1170|1110|1260|1140|540|330|240)\b/);
  });
});

describe('registre des seuils', () => {
  it('chaque seuil a une valeur, une justification et un usage', () => {
    for (const [k, v] of Object.entries(THRESHOLDS)) {
      expect(Number.isFinite(v.value), k).toBe(true);
      expect(v.why.length, k).toBeGreaterThan(5);
      expect(v.usedBy.length, k).toBeGreaterThan(1);
    }
  });

  it('les contradictions connues restent visibles tant qu’elles ne sont pas résolues', () => {
    expect(new Set([THRESHOLDS.napDayEnd.value, THRESHOLDS.observationDayEnd.value, THRESHOLDS.summaryDayEnd.value]).size).toBe(3);
  });

  it('aucun seuil n’est présenté comme mesuré ou sourcé avant de l’être', () => {
    expect(Object.values(THRESHOLDS).filter((v) => v.status === 'mesure' || v.status === 'source')).toEqual([]);
  });
});

describe('adaptateurs', () => {
  it('garde le contenu d’une ligne, et une tétée n’a jamais de volume', () => {
    const r: RawEventRow = { id: 'a', kind: 'sein', started_at: '2026-10-27T08:00:00.000Z', ended_at: null, payload: { side: 'G', dur: 12 }, created_at: '2026-10-27T08:05:00.000Z' };
    const e = eventFromRaw(r);
    expect(e).toMatchObject({ kind: 'breast', side: 'G', durationMin: 12 });
    expect(e.ml).toBeUndefined();
    expect(e.enteredAt).toBe(Date.parse('2026-10-27T08:05:00.000Z'));
    expect(rawFromEvent(e)).toMatchObject({ kind: 'sein', started_at: r.started_at, ended_at: null });
  });
});

describe('qualité', () => {
  const now = t(27, 12);
  const codes = (ev: EngineEvent[]) => assessQuality(ev, now).issues.map((i) => i.code);

  it('détecte doublon, chevauchement, durées impossibles, futur', () => {
    expect(codes([sleep('a', t(26, 9), t(26, 10)), sleep('b', t(26, 9), t(26, 10))])).toContain('duplicate');
    expect(codes([sleep('a', t(26, 9), t(26, 11)), sleep('b', t(26, 10), t(26, 12))])).toContain('overlap');
    expect(codes([sleep('a', t(25, 6), t(26, 6))])).toContain('sleep_too_long');
    expect(codes([sleep('a', t(26, 8))])).toContain('open_too_long');
    expect(codes([sleep('a', t(27, 10), t(27, 9))])).toContain('end_before_start');
    expect(codes([sleep('a', t(27, 18), t(27, 19))])).toContain('in_future');
    expect(codes([{ id: 'x', kind: 'bottle', start: t(26, 9), ml: 900 }])).toContain('bottle_too_large');
  });

  it('un journal propre ne déclenche rien', () => {
    expect(codes([sleep('a', t(26, 9), t(26, 10)), { id: 'b', kind: 'bottle', start: t(26, 11), ml: 120 }])).toEqual([]);
  });

  it('un jour sans note n’existe pas dans le rapport : jamais de zéro inventé', () => {
    const r = assessQuality([sleep('a', t(24, 9), t(24, 10)), sleep('b', t(26, 9), t(26, 10))], now);
    expect(r.days.map((d) => d.day)).toEqual(['2026-10-24', '2026-10-26']);
  });

  it('mesure le délai de saisie, ou dit qu’il est inconnu', () => {
    expect(assessQuality([sleep('a', t(26, 9), t(26, 10))], now).entryDelay).toBeNull();
    const r = assessQuality([sleep('a', t(26, 9), t(26, 10), { enteredAt: t(26, 9, 5) }), sleep('b', t(26, 11), t(26, 12), { enteredAt: t(26, 14) })], now);
    expect(r.entryDelay).toMatchObject({ n: 2, lateShare: 0.5 });
  });

  it('repère le jour du changement d’heure (fuseau de Paris)', () => {
    if (new Date(2026, 0, 1).getTimezoneOffset() !== -60) return;
    expect(hasDstShift(new Date(2026, 9, 25, 12).getTime())).toBe(true);
    expect(hasDstShift(new Date(2026, 9, 26, 12).getTime())).toBe(false);
  });
});

describe('backtest : aucune fuite du futur', () => {
  const log = syntheticLog({ ...SCENARIOS.irregulier!, from: new Date(2026, 8, 1), days: 20 });

  it('un sommeil pas encore fini ou pas encore saisi n’est pas connu', () => {
    const ev = [sleep('a', t(26, 9), t(26, 10), { enteredAt: t(26, 9), endKnownAt: t(26, 13) }), sleep('b', t(26, 14), t(26, 15), { enteredAt: t(26, 16) })];
    const seen = visibleAt(ev, t(26, 12));
    expect(seen.map((e) => e.id)).toEqual(['a']);
    expect(seen[0]?.end).toBeUndefined();
    expect(visibleAt(ev, t(26, 14)).map((e) => e.end)).toEqual([t(26, 10)]);
  });

  it('modifier le futur ne change aucune prévision passée', () => {
    const cut = new Date(2026, 8, 10).getTime();
    const before = log.filter((e) => e.start < cut);
    const seen: string[] = [];
    const spy: Forecaster = ({ events }, now) => {
      seen.push(`${now}:${events.length}:${Math.max(...events.map((e) => e.end ?? e.start))}`);
      return null;
    };
    replay({ birthAt: null, events: log }, spy, (d) => d.at < cut);
    const first = seen.slice();
    seen.length = 0;
    const changed = log.map((e) => (e.start >= cut ? { ...e, start: e.start + 37 * MIN, ...(e.end !== undefined ? { end: e.end + 41 * MIN } : {}) } : e));
    replay({ birthAt: null, events: changed }, spy, (d) => d.at < cut);
    expect(before.length).toBeLessThan(log.length);
    expect(first.length).toBeGreaterThan(10);
    // la dernière décision peut dépendre du dodo modifié qui la suit : pas la vue du modèle
    expect(seen.slice(0, first.length - 2)).toEqual(first.slice(0, first.length - 2));
  });

  it('un modèle ne voit jamais un événement postérieur à sa décision', () => {
    const spy: Forecaster = ({ events }, now) => {
      for (const e of events) {
        expect(e.start).toBeLessThanOrEqual(now);
        expect(e.end ?? e.start).toBeLessThanOrEqual(now);
      }
      return null;
    };
    replay({ birthAt: null, events: log }, spy);
  });

  it('écarte une décision si le dodo suivant avait déjà commencé', () => {
    const ev = [sleep('a', t(26, 9), t(26, 10), { endKnownAt: t(26, 20) }), sleep('b', t(26, 12), t(26, 13))];
    expect(decisions(ev)).toEqual([]);
  });

  it('deux exécutions donnent le même résultat', () => {
    const run = () => JSON.stringify(score(replay({ birthAt: null, events: log }, awakeQuartiles)));
    expect(run()).toBe(run());
  });
});

describe('métriques, sur réponses calculées à la main', () => {
  const p = (at: number, actual: number, from: number, to: number): Prediction => ({ at: at * MIN, actual: actual * MIN, window: { from: from * MIN, to: to * MIN } });

  it('couverture, erreur, largeur, abstention, score d’intervalle', () => {
    const s = score([p(0, 100, 90, 110), p(0, 130, 90, 110), { at: 0, actual: 50, window: null }]);
    expect(s).toMatchObject({ decisions: 3, answered: 2, coverage: 0.5, medianErrorMin: 15, medianWidthMin: 20 });
    expect(s.abstentionRate).toBeCloseTo(1 / 3);
    expect(s.intervalScoreMin).toBeCloseTo((20 + (20 + 10 * 20)) / 2);
  });

  it('sans aucune réponse, aucun chiffre inventé', () => {
    expect(score([{ at: 0, actual: 1, window: null }])).toMatchObject({ coverage: null, medianErrorMin: null });
  });

  it('gain apparié : A deux fois meilleur que B', () => {
    const day = 1440;
    const a = [0, 1, 2, 3, 4, 5].map((d) => p(d * day, d * day + 100, d * day + 95, d * day + 95));
    const b = a.map((x) => ({ ...x, window: { from: x.actual - 10 * MIN, to: x.actual - 10 * MIN } }));
    expect(pairedGain(a, b)).toMatchObject({ n: 6, days: 6, gain: 0.5, low: 0.5, high: 0.5 });
  });
});

describe('mode d’alimentation', () => {
  const now = t(27, 12);
  const feeds = (k: 'bottle' | 'breast', n: number): EngineEvent[] => Array.from({ length: n }, (_, i) => ({ id: `${k}${i}`, kind: k, start: t(26, 8) + i * 60 * MIN, ...(k === 'bottle' ? { ml: 100 } : {}) }));

  it('déduit tout sein, tout biberon, mixte, et dit quand il ne sait pas', () => {
    expect(feedingMode(feeds('breast', 12), now).mode).toBe('breast');
    expect(feedingMode(feeds('bottle', 12), now).mode).toBe('bottle');
    expect(feedingMode([...feeds('bottle', 6), ...feeds('breast', 6)], now).mode).toBe('mixed');
    expect(feedingMode(feeds('bottle', 3), now).mode).toBe('unknown');
  });

  it('suit un passage de l’un à l’autre : seuls les 7 derniers jours comptent', () => {
    const old = feeds('breast', 20).map((e) => ({ ...e, start: e.start - 15 * 86_400_000 }));
    expect(feedingMode([...old, ...feeds('bottle', 12)], now).mode).toBe('bottle');
  });

  it('une tétée n’apporte jamais de mL : pas de total sur 24 h dès qu’il y en a une', () => {
    expect(bottleMilk(feeds('bottle', 3))).toEqual({ bottleMl: 300, total24hMl: 300 });
    expect(bottleMilk([...feeds('bottle', 3), ...feeds('breast', 1)])).toEqual({ bottleMl: 300, total24hMl: null });
    expect(bottleMilk(feeds('breast', 3))).toEqual({ bottleMl: null, total24hMl: null });
  });

  it('un jour sans repas noté n’est pas un jour à zéro', () => {
    expect(bottleMilk([])).toEqual({ bottleMl: null, total24hMl: null });
  });
});

describe('préparation multi-appareils et serveur', () => {
  const o = SCENARIOS.irregulier!;
  const log = syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 28 });
  const now = t(1, 12) - 86_400_000 * 2;
  const view = (m: ReturnType<typeof habitsModel>) => JSON.stringify({ typ: m.typical, win: m.windows, per: m.period('bloc', 7), links: m.links(['late', 'many'], ['bed', 'lg', 'wk']) });

  it('déterministe : deux calculs identiques, l’état n’est pas partagé', () => {
    expect(view(habitsModel({ babyId: 'a', birthAt: null, events: log }, now))).toBe(view(habitsModel({ babyId: 'a', birthAt: null, events: log }, now)));
  });

  it('l’ordre des lignes reçues ne change pas le résultat des habitudes', () => {
    const shuffled = log.slice().sort((x, y) => x.id.localeCompare(y.id));
    expect(habitsModel({ babyId: 'a', birthAt: null, events: shuffled }, now).typical).toEqual(habitsModel({ babyId: 'a', birthAt: null, events: log }, now).typical);
  });

  it('deux bébés ne se mélangent pas et chaque résultat porte son bébé et sa version', () => {
    const a = habitsModel({ babyId: 'a', birthAt: null, events: log }, now), b = habitsModel({ babyId: 'b', birthAt: null, events: [] }, now);
    expect([a.babyId, b.babyId, a.engineVersion]).toEqual(['a', 'b', ENGINE_VERSION]);
    expect(a.typical.ok).toBe(true);
    expect(b.typical.ok).toBe(false);
  });

  it('une entrée se sérialise sans perte, comme pour un envoi à un serveur', () => {
    const input = { babyId: 'a', birthAt: null, events: log };
    expect(view(habitsModel(JSON.parse(JSON.stringify(input)) as typeof input, now))).toBe(view(habitsModel(input, now)));
  });
});

describe('règles corrigées', () => {
  const o = SCENARIOS.leveTot!;
  const log = syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 27 });
  const now = new Date(2026, 8, 27, 14, 20).getTime();
  const input = { babyId: 'a', birthAt: null, events: log.filter((e) => (e.end ?? e.start) <= now) };

  it('un bébé levé vers 5 h 20 a enfin une journée type et une prévision', () => {
    expect(habitsModel(input, now, LEGACY_RULES).typical.ok).toBe(false);
    const m = habitsModel(input, now);
    expect(m.typical.ok).toBe(true);
    expect(m.windows.length).toBeGreaterThan(0);
  });

  it('une nuit coupée sans rien noté après reste partielle : pas de lever inventé', () => {
    const ev = [sleep('a', t(26, 20), t(27, 4, 30))];
    expect(habitsModel({ babyId: 'a', birthAt: null, events: ev }, t(27, 12)).calendar.nightOf(27).st).toBe('partiel');
    const seen = [...ev, { id: 'b', kind: 'bottle' as const, start: t(27, 5), ml: 100 }];
    expect(habitsModel({ babyId: 'a', birthAt: null, events: seen }, t(27, 12)).calendar.nightOf(27).st).toBe('ok');
  });

  it('un jour de changement d’heure n’entre pas dans les habitudes (fuseau de Paris)', () => {
    if (new Date(2026, 0, 1).getTimezoneOffset() !== -60) return;
    const reg = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 9, 1), days: 30 });
    const at = new Date(2026, 9, 29, 14).getTime();
    const ev = { babyId: 'a', birthAt: null, events: reg.filter((e) => (e.end ?? e.start) <= at) };
    expect(habitsModel(ev, at).typical.n).toBe(habitsModel(ev, at, LEGACY_RULES).typical.n - 1);
  });
});

describe('âge', () => {
  it('compte en jours calendaires et reste inconnu si la naissance l’est', () => {
    expect(ageInDays(t(1, 8), t(27, 7))).toBe(26);
    expect(ageInDays(null, t(27, 7))).toBeNull();
    expect(ageInDays(t(28, 7), t(27, 7))).toBeNull();
    expect(habitsModel({ babyId: 'a', birthAt: t(1, 8), events: [] }, t(27, 7)).ageDays).toBe(26);
  });

  it('à 2, 8, 16 et 26 semaines, aucun âge ne fait planter ni n’invente', () => {
    for (const w of [2, 8, 16, 26]) {
      const log = syntheticLog({ ...SCENARIOS.nouveauNe!, seed: w, naps: w < 8 ? 5 : w < 16 ? 4 : 3, nightWakings: w < 8 ? 3 : w < 16 ? 2 : 1, from: new Date(2026, 8, 1), days: 27 });
      const now = new Date(2026, 8, 27, 14, 20).getTime();
      const m = habitsModel({ babyId: 'a', birthAt: now - w * 7 * 86_400_000, events: log.filter((e) => (e.end ?? e.start) <= now) }, now);
      expect(m.ageDays).toBe(w * 7);
      expect(m.nextSleep.window !== undefined || m.nextSleep.abstained !== undefined).toBe(true);
    }
  });
});

describe('données manquantes et abstention', () => {
  const o = SCENARIOS.regulier!;
  const now = new Date(2026, 8, 27, 14, 20).getTime();
  const full = syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= now);
  const reason = (events: EngineEvent[], at = now) => habitsModel({ babyId: 'a', birthAt: null, events }, at).nextSleep.abstained?.reason;

  it('rend une fenêtre quand il peut, et dit sur quoi elle repose', () => {
    const f = habitsModel({ babyId: 'a', birthAt: null, events: full }, now).nextSleep;
    expect(f.abstained).toBeUndefined();
    expect(f.window?.to).toBeGreaterThan(f.window?.from ?? 0);
    expect(f.window?.coverage).toBeNull();
    expect(f.reliability).toMatchObject({ measured: false });
    expect(f.limits).toContain('coverage_not_measured');
  });

  it('s’abstient : trop peu de jours, il dort, journal arrêté, plus rien à prévoir', () => {
    expect(reason([])).toBe('too_few_days');
    expect(reason([...full, sleep('z', now - 20 * MIN)])).toBe('asleep');
    expect(reason(full.filter((e) => (e.end ?? e.start) < now - 400 * MIN))).toBe('data_gap');
    expect(reason(full, new Date(2026, 8, 27, 23, 50).getTime())).toBe('data_gap');
  });

  it('s’abstient sur une fenêtre trop large plutôt que de la montrer', () => {
    const noisy = syntheticLog({ ...o, noiseMin: 80, seed: 11, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= now);
    const f = habitsModel({ babyId: 'a', birthAt: null, events: noisy }, now).nextSleep;
    if (f.window) expect(f.window.to - f.window.from).toBeLessThanOrEqual(180 * MIN);
  });

  it('une journée trouée sort du calcul au lieu de le fausser', () => {
    const d = 24, a = new Date(2026, 8, 1 + d).getTime(), b = a + 86_400_000;
    const holed = full.filter((e) => e.start < a || e.start >= b);
    const cov = habitsModel({ babyId: 'a', birthAt: null, events: holed }, now).coverage(7);
    expect(cov.completeDays).toBeLessThan(habitsModel({ babyId: 'a', birthAt: null, events: full }, now).coverage(7).completeDays);
    expect(cov.absentNights + cov.partialNights).toBeGreaterThan(0);
  });
});

describe('associations', () => {
  it('Benjamini-Hochberg, sur un cas calculé à la main', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2]);
    expect(q[0]).toBeCloseTo(0.04);
    expect(q[2]).toBeCloseTo(0.0533, 3);
    expect(q[1]).toBeCloseTo(0.0533, 3);
    expect(q[3]).toBeCloseTo(0.2);
  });

  it('retire une tendance et une covariable', () => {
    const d = [0, 1, 2, 3, 4, 5, 6, 7];
    expect(residualize(d.map((x) => 3 * x + 2), [d]).every((v) => Math.abs(v) < 1e-6)).toBe(true);
  });

  it('peu de nuits : pas de test du tout', () => {
    expect(associations(simulateRows({ nights: 10, sharedTrend: 0, realEffect: 0 }, 1), ['late'], ['bed']).enough).toBe(false);
  });

  it('sans lien réel : ≤ 10 % de faux liens, là où l’ancien test en montre bien plus', () => {
    const r = falseLinkRates({ nights: 21, sharedTrend: 0, realEffect: 0 }, 150);
    console.log('sans lien', r);
    expect(r.current).toBeLessThanOrEqual(0.1);
    expect(r.legacy).toBeGreaterThan(r.current);
  }, 60_000);

  it('confondant : une dérive commune ne crée pas de lien', () => {
    const r = falseLinkRates({ nights: 21, sharedTrend: 4, realEffect: 0 }, 150);
    console.log('dérive commune', r);
    expect(r.current).toBeLessThanOrEqual(0.1);
    expect(r.legacy).toBeGreaterThan(r.current);
  }, 60_000);

  it('un vrai lien se retrouve assez souvent', () => {
    let found = 0;
    for (let s = 1; s <= 60; s++) if (associations(simulateRows({ nights: 21, sharedTrend: 0, realEffect: 1 }, s), ['late', 'many', 'ln', 'awk', 'awb'], ['bed', 'lg', 'wk'], s).items.some((x) => x.retained && x.factor === 'late' && x.outcome === 'bed')) found++;
    console.log('puissance', found / 60);
    expect(found / 60).toBeGreaterThan(0.5);
  }, 60_000);
});

describe('modèles candidats', () => {
  const NOW = new Date(2026, 8, 27, 11, 0).getTime();
  const log = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);
  const input = { birthAt: null, events: log };

  it('tous répondent par une fenêtre, ou s’abstiennent sans historique', () => {
    for (const m of [weightedAwake(7), bayesAwake, kalmanAwake, survivalModel]) {
      const w = m(input, NOW);
      expect(w && w.to > w.from).toBe(true);
      expect(m({ birthAt: null, events: [] }, NOW)).toBeNull();
      expect(m({ birthAt: null, events: log.slice(-6) }, NOW)).toBeNull();
    }
  });

  it('les réveils dans la nuit et les siestes rapprochées ne sont pas des éveils', () => {
    const at = (d: number, h: number, mi = 0) => new Date(2026, 8, d, h, mi).getTime();
    const ev = [sleep('n1', at(10, 20), at(11, 1)), sleep('n2', at(11, 1, 5), at(11, 7)), sleep('s1', at(11, 9), at(11, 10)), sleep('s2', at(11, 10, 10), at(11, 11)), sleep('s3', at(11, 13), at(11, 14)), sleep('n3', at(11, 18), at(12, 7)), { id: 'b', kind: 'bottle' as const, start: at(11, 8), ml: 90 }];
    expect(dayAwakeSpans(ev, at(12, 12), 14).map((s) => (s.to - s.from) / MIN)).toEqual([120, 120, 240]);
  });

  it('survie : la fenêtre ne s’ouvre pas juste après le réveil, avant ses éveils les plus courts', () => {
    const log = syntheticLog({ ...SCENARIOS.regulier!, seed: 5, from: new Date(2026, 8, 1), days: 27 });
    const nap = log.filter((e) => e.kind === 'sleep' && e.end !== undefined && new Date(e.end).getHours() >= 10 && new Date(e.end).getHours() < 17).pop()!;
    const now = (nap.end as number) + 5 * MIN, input = { birthAt: null, events: log.filter((e) => e.start < now) };
    const w = survivalModel(input, now);
    const gaps = dayAwakeSpans(input.events, now, 14).map((s) => s.to - s.from).sort((x, y) => x - y);
    expect(w).not.toBeNull();
    expect(w!.from).toBeGreaterThanOrEqual((nap.end as number) + (gaps[0] as number));
    expect(w!.to).toBeGreaterThan(w!.from);
  });

  it('une fenêtre trop large devient une abstention', () => {
    const noisy = syntheticLog({ ...SCENARIOS.regulier!, noiseMin: 90, seed: 21, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);
    for (const f of [bayesAwake, kalmanAwake, survivalModel]) {
      const w = f({ birthAt: null, events: noisy }, NOW);
      if (w) expect(w.to - w.from).toBeLessThanOrEqual(180 * MIN);
    }
  });

  it('quantile pondéré : le récent pèse plus', () => {
    expect(weightedQuantile([{ v: 1, w: 1 }, { v: 2, w: 1 }, { v: 3, w: 8 }], 0.5)).toBe(3);
  });

  it('Kalman : suit une marche, ignore un bruit pur', () => {
    const step = localLevel([0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5]);
    expect(step?.level).toBeGreaterThan(3.5);
    expect(localLevel([1, 2])).toBeNull();
  });

  it('bayésien : peu de données, fenêtre plus large', () => {
    const w = (ev: EngineEvent[]) => {
      const x = bayesAwake({ birthAt: null, events: ev }, NOW);
      return x ? x.to - x.from : 0;
    };
    expect(w(log.slice(-45))).toBeGreaterThan(0);
    expect(w(log.slice(-45))).toBeGreaterThan(w(log) * 0.9);
  });

  it('survie : plus il est éveillé depuis longtemps, plus le sommeil approche', () => {
    const b = fitHazard(log, NOW);
    expect(b).not.toBeNull();
    expect((b as number[])[1]).toBeGreaterThan(0);
  });

  it('survie : après un réveil tardif, la fenêtre suit le réveil, contrairement au calcul à l’heure', () => {
    const a = survivalModel({ birthAt: null, events: [...log, sleep('x', NOW - 90 * MIN, NOW - 60 * MIN)] }, NOW);
    const b = survivalModel({ birthAt: null, events: [...log, sleep('x', NOW - 60 * MIN, NOW)] }, NOW);
    expect(a && b).toBeTruthy();
    expect((b?.from ?? 0)).toBeGreaterThanOrEqual(a?.from ?? 0);
  });

  it('survie : calcul assez rapide pour un téléphone (< 100 ms ici)', () => {
    const t0 = performance.now();
    survivalModel(input, NOW);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe('ruptures et statuts', () => {
  it('stable, insuffisant, ponctuel, rupture, tendance', () => {
    const flat = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
    expect(classifySeries(flat)).toBe('stable');
    expect(classifySeries([3, 3, 3])).toBe('insufficient');
    expect(classifySeries([...flat, 3, 3, 6])).toBe('one_off');
    expect(classifySeries([...flat, 2, 2, 2])).toBe('break');
    expect(classifySeries(Array.from({ length: 14 }, (_, i) => 100 + i * 2))).toBe('trend');
  });

  it('quelques observations ne deviennent pas une règle : un seul jour atypique n’est pas une rupture', () => {
    expect(classifySeries([4, 4, 3, 4, 4, 3, 4, 4, 4, 3, 4, 4, 1, 4, 4])).not.toBe('break');
  });

  it('CUSUM et BOCPD voient la rupture connue du passage à une sieste de moins', () => {
    const s = [...Array(14).fill(4), ...Array(10).fill(3)].map((x, i) => x + (i % 3 === 0 ? 0.2 : -0.1));
    expect(cusum(s, 10)).toBeGreaterThanOrEqual(14);
    const p = changeProbabilities(s);
    expect(Math.max(...p.slice(14, 19))).toBeGreaterThan(0.5);
    expect(Math.max(...p.slice(2, 12))).toBeLessThan(0.5);
  });

  it('peu de fausses alertes sur 200 séries sans rupture', () => {
    const r = rng(9);
    let alerts = 0;
    for (let i = 0; i < 200; i++) {
      const s = Array.from({ length: 21 }, () => 120 + (r() + r() + r() - 1.5) * 20);
      if (classifySeries(s) === 'break') alerts++;
    }
    expect(alerts / 200).toBeLessThan(0.1);
  });
});

describe('repas, descriptif seulement', () => {
  const NOW = new Date(2026, 8, 27, 11, 0).getTime();
  const log = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);

  it('rend une fenêtre descriptive, sans consigne', () => {
    const f = describeNextFeed('a', { birthAt: null, events: log }, NOW);
    expect(f.window).toBeDefined();
    expect(f.limits).toEqual(expect.arrayContaining(['descriptive_only', 'not_a_schedule']));
    expect(JSON.stringify(f)).not.toMatch(/delay|limit_feed|should|wait/i);
  });

  it('s’abstient sans assez de repas', () => {
    expect(describeNextFeed('a', { birthAt: null, events: [] }, NOW).abstained?.reason).toBe('too_few_days');
  });

  it('des tétées rapprochées comptent pour un seul repas', () => {
    const f = (m: number): EngineEvent => ({ id: String(m), kind: 'breast', start: t(26, 9, m) });
    expect(feedTimes([f(0), f(15), f(50)])).toHaveLength(2);
  });
});

describe('règle d’activation', () => {
  const DAY = 86_400_000;
  const series = (n: number, err: number, width = 40) => Array.from({ length: n }, (_, i): Prediction => {
    const at = i * 6 * 3_600_000 + DAY, actual = at + 100 * MIN, c = actual + err * MIN * (i % 2 ? 1 : -1);
    return { at, actual, window: { from: c - (width / 2) * MIN, to: c + (width / 2) * MIN } };
  });

  it('jamais d’activation sur du synthétique, même avec un gain énorme', () => {
    expect(decide(series(300, 1), series(300, 30), 'T').verdict).toBe('mechanics_only');
  });

  it('jamais d’activation avec trop peu de jours', () => {
    expect(decide(series(40, 1), series(40, 30), 'R2').verdict).toBe('not_enough_data');
    expect(decide(series(300, 1), series(300, 30), 'R0').verdict).toBe('not_enough_data');
  });

  it('retient un gain réel bien calibré, refuse un gain nul ou une fenêtre fausse', () => {
    const cal = (e: number, w: number) => series(400, e, w).map((p, i) => (i % 5 === 0 ? { ...p, actual: p.actual + 300 * MIN } : p));
    expect(decide(cal(5, 30), cal(10, 30), 'R2').verdict).toBe('retained');
    expect(decide(series(400, 10), series(400, 10), 'R2').verdict).toBe('rejected');
    expect(decide(series(400, 5, 12), series(400, 10, 12), 'R2').why).toBe('fenêtre mal calibrée');
  });

  it('la période gelée vient après tout le reste', () => {
    const p = series(400, 5), h = holdout(p);
    expect(h[0]!.at).toBeGreaterThan(p[0]!.at);
    expect(h[h.length - 1]).toBe(p[p.length - 1]);
    expect(holdout(series(20, 5))).toEqual([]);
  });

  it('calibration conforme : sans regarder l’avenir, couvre proche de la cible', () => {
    const r = rng(4), gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const p = Array.from({ length: 300 }, (_, i): Prediction => {
      const at = i * 3_600_000 * 8, actual = at + 100 * MIN + gauss() * 40 * MIN;
      return { at, actual, window: { from: at + 95 * MIN, to: at + 105 * MIN } };
    });
    expect(score(p).coverage).toBeLessThan(0.3);
    expect(score(conformal(p)).coverage).toBeGreaterThan(0.7);
    expect(score(conformal(p)).coverage).toBeLessThan(0.9);
  });

  it('arbitre : repli sur le calcul simple tant que le modèle n’a pas fait ses preuves sur ce bébé', () => {
    const good = series(60, 2), bad = series(60, 40), now = good[59]!.actual;
    expect(arbiter(good, bad, now)).toBe('model');
    expect(arbiter(bad, good, now)).toBe('fallback');
    expect(arbiter(good.slice(0, 3), bad.slice(0, 3), now)).toBe('fallback');
  });

  it('le registre n’annonce aucun modèle en production à part le calcul actuel', () => {
    expect(MODEL_REGISTRY.filter((m) => m.status === 'production').map((m) => m.id)).toEqual(['current-wins']);
  });
});

describe('analyse transversale', () => {
  const NOW = new Date(2026, 8, 28, 14, 20).getTime();
  const rich = (mix: (d: number) => { late: boolean; bed: number; breast?: boolean; diaper?: boolean }, days = 27) => {
    const ev: EngineEvent[] = [];
    let n = 0;
    const at = (d: number, m: number) => new Date(2026, 8, 1 + d, 0, m).getTime();
    for (let d = 0; d < days; d++) {
      const x = mix(d);
      for (const [a, b] of [[540, 600], [750, 820], [x.late ? 980 : 885, x.late ? 1030 : 945], [x.bed, 1500], [1525, 1860]] as Array<[number, number]>) ev.push({ id: `e${n++}`, kind: 'sleep', start: at(d, a), end: at(d, b) });
      ev.push({ id: `e${n++}`, kind: x.breast ? 'breast' : 'bottle', start: at(d, 620), ...(x.breast ? {} : { ml: 120 }) }, { id: `e${n++}`, kind: 'bottle', start: at(d, 1050), ml: 100 + (d % 4) * 10 });
      if (x.diaper) ev.push({ id: `e${n++}`, kind: 'diaper', start: at(d, 700) });
    }
    return ev.filter((e) => (e.end ?? e.start) <= NOW);
  };
  const model = (ev: EngineEvent[]) => habitsModel({ babyId: 'a', birthAt: null, events: ev }, NOW);

  it('retrouve un lien injecté entre dernière sieste et coucher, sans en faire une cause', () => {
    const m = model(rich((d) => { const late = d % 5 < 2; return { late, bed: 1200 + (late ? 60 : 0) + d % 3 }; }));
    const hit = m.dayToNight().items.find((x) => x.factor === 'lastNapEnd' && x.outcome === 'bed');
    expect(hit?.retained).toBe(true);
    expect(hit?.effect).toBeGreaterThan(30);
    expect(Object.keys(hit ?? {})).not.toContain('cause');
  });

  it('une tétée n’entre jamais dans un volume : le facteur lait saute les jours avec tétée', () => {
    const r = model(rich((d) => ({ late: false, bed: 1200 + d % 3, breast: d % 2 === 0 }))).dayToNight();
    expect(r.items.filter((x) => x.factor === 'bottleMl').every((x) => x.n <= 14)).toBe(true);
  });

  it('un jour sans couche notée n’est pas compté comme zéro', () => {
    const r = model(rich((d) => ({ late: false, bed: 1200 + d % 3, diaper: d % 2 === 0 }))).dayToNight();
    expect(r.items.filter((x) => x.factor === 'diapers').length).toBe(0);
  });

  it('seules l’humeur, la digestion et les selles deviennent des observations : ni santé, ni notes de la maman', () => {
    expect(tagsFromWell({ '2026-09-01': { humeur: 'Calme', sante: ['Fièvre'], mhum: 'Triste', dig: ['Gaz'] } })).toEqual({ '2026-09-01': ['Calme', 'Gaz'] });
  });

  it('un facteur qui contient le coucher n’est jamais testé contre le coucher', () => {
    const r = model(rich((d) => ({ late: d % 2 === 0, bed: 1200 + (d % 7) * 10 }))).dayToNight();
    expect(r.items.some((x) => x.outcome === 'bed' && /BeforeBed/.test(x.factor))).toBe(false);
  });

  it('toute la famille de tests, sans lien réel : peu de journaux à faux lien', () => {
    let any = 0;
    const runs = 40;
    for (let s = 1; s <= runs; s++) {
      const log = syntheticLog({ ...SCENARIOS.irregulier!, seed: 100 + s, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);
      const items = habitsModel({ babyId: 'a', birthAt: null, events: log }, NOW).dayToNight().items;
      // issues mécaniquement liées par le générateur lui-même, écartées pour ne juger que le hasard
      if (items.some((x) => x.retained && x.outcome === 'bed')) any++;
    }
    console.log('famille complète, faux liens sur le coucher', any / runs);
    expect(any / runs).toBeLessThanOrEqual(0.15);
  }, 120_000);

  it('un tag n’est comparé qu’aux autres jours notés', () => {
    const tags: Record<number, string[]> = {};
    for (let d = 3; d < 27; d++) tags[d] = d % 2 ? ['Gaz'] : ['Calme'];
    const r = model(rich((d) => ({ late: false, bed: 1200 + d % 3 }))).dayToNight(tags);
    expect(r.items.some((x) => x.factor === 'tag:Gaz')).toBe(true);
  });

  it('éveil puis sieste : teste sur plusieurs jours, sans lien inventé sur un journal régulier', () => {
    const m = model(rich((d) => ({ late: false, bed: 1200 + d % 3 })));
    expect(m.awakeToNap().items.filter((x) => x.retained)).toEqual([]);
  });

  it('types de journées : deux groupes nets, ou rien', () => {
    const none = model(rich((d) => ({ late: false, bed: 1200 + d % 3 }))).dayTypes();
    expect(none).toBeNull();
    const two = model(syntheticLog({ ...SCENARIOS.rupture!, noiseMin: 3, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW)).dayTypes();
    expect(two?.length).toBe(2);
    expect(Math.abs((two?.[0]?.naps ?? 0) - (two?.[1]?.naps ?? 0))).toBeGreaterThan(0.5);
  });

  it('motifs : un enchaînement constant ressort, le hasard non', () => {
    const fixed = Array.from({ length: 15 }, (): Token[] => ['W', 'F', 'S', 'F', 'S', 'F', 'S', 'F']);
    expect(frequentMotifs(fixed).map((m) => m.motif)).toEqual(expect.arrayContaining(['FSF']));
    const r = rng(5), noise = Array.from({ length: 30 }, (): Token[] => Array.from({ length: 10 }, () => (r() < 0.5 ? 'S' : 'F')));
    expect(frequentMotifs(noise)).toEqual([]);
    expect(frequentMotifs(fixed.slice(0, 5))).toEqual([]);
  });

  it('transitions : des probabilités qui somment à 1', () => {
    const t2 = transitions([['W', 'F', 'S', 'F']]);
    expect(t2.F).toEqual({ S: 1 });
    expect(t2.W).toEqual({ F: 1 });
  });

  it('évolution : la rupture connue ressort sur les siestes, pas sur le coucher', () => {
    const at = new Date(2026, 8, 19, 14).getTime();
    const log = syntheticLog({ ...SCENARIOS.rupture!, noiseMin: 3, from: new Date(2026, 8, 1), days: 18 }).filter((e) => (e.end ?? e.start) <= at);
    const ev = habitsModel({ babyId: 'a', birthAt: null, events: log }, at).evolutions();
    expect(ev.find((x) => x.key === 'naps')?.status).toBe('break');
    expect(ev.find((x) => x.key === 'bedtime')?.status).not.toBe('break');
    expect(habitsModel({ babyId: 'a', birthAt: null, events: [] }, at).evolutions().every((x) => x.status === 'insufficient')).toBe(true);
  });
});

describe('contrat de résultats', () => {
  const NOW = new Date(2026, 8, 28, 14, 20).getTime();
  const log = syntheticLog({ ...SCENARIOS.irregulier!, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);
  const report = analyze({ babyId: 'a', birthAt: NOW - 70 * 86_400_000, events: log }, NOW);
  const all = (r: EngineReport) => [...r.habits, ...r.forecasts, ...r.evolutions, ...r.associations, ...r.comparisons, ...r.references];

  it('porte versions, bébé, âge, qualité et une liste pour chaque famille', () => {
    expect(report).toMatchObject({ contractVersion: 1, engineVersion: ENGINE_VERSION, babyId: 'a', ageDays: 70, knowledgeVersion: null });
    for (const k of ['habits', 'forecasts', 'evolutions', 'associations', 'comparisons', 'references'] as const) expect(Array.isArray(report[k])).toBe(true);
    expect(report.dataQuality.days.length).toBeGreaterThan(0);
  });

  it('chaque résultat dit sa fiabilité et sa base, ou s’abstient avec une raison', () => {
    for (const f of all(report)) {
      expect(f.reliability.basis.length, f.id).toBeGreaterThan(0);
      expect(f.engineVersion).toBe(ENGINE_VERSION);
      expect(f.reliability.measured, f.id).toBe(false);
      if (f.status === 'insufficient' && f.id !== 'next_sleep') expect(f.abstained, f.id).toBeDefined();
    }
  });

  it('jamais de recommandation : quatre natures seulement', () => {
    expect(new Set(all(report).map((f) => f.kind)).size).toBeLessThanOrEqual(4);
    for (const f of all(report)) expect(['observation', 'hypothesis', 'forecast', 'reference']).toContain(f.kind);
  });

  it('aucune référence tant que rien n’est validé', () => {
    expect(report.references).toEqual([]);
  });

  it('déterministe et sérialisable, journal vide compris', () => {
    const again = analyze({ babyId: 'a', birthAt: NOW - 70 * 86_400_000, events: log }, NOW);
    expect(JSON.stringify(again)).toBe(JSON.stringify(report));
    expect(JSON.parse(JSON.stringify(report))).toEqual(JSON.parse(JSON.stringify(again)));
    const empty = analyze({ babyId: 'a', birthAt: null, events: [] }, NOW);
    expect(empty.ageDays).toBeNull();
    expect(all(empty).every((f) => f.abstained !== undefined || f.status === 'insufficient')).toBe(true);
  });

  it('tout l’historique, au-delà des 30 jours de l’écran', () => {
    const from = new Date(2026, 5, 1), at = new Date(2026, 8, 28, 14, 20).getTime();
    const long = syntheticLog({ ...SCENARIOS.regulier!, from, days: 118 }).filter((e) => (e.end ?? e.start) <= at);
    const r = analyze({ babyId: 'a', birthAt: from.getTime(), events: long }, at);
    expect(r.evolutions.find((f) => f.id === 'evolution_naps')?.reliability.n).toBeGreaterThan(60);
  });

  it('6 mois d’historique tiennent en moins de 3 s ici', () => {
    const from = new Date(2026, 2, 1), at = new Date(2026, 8, 28, 14, 20).getTime();
    const long = syntheticLog({ ...SCENARIOS.irregulier!, from, days: 210 }).filter((e) => (e.end ?? e.start) <= at);
    const t0 = performance.now();
    analyze({ babyId: 'a', birthAt: from.getTime(), events: long }, at);
    const ms = performance.now() - t0;
    console.log('analyze 6 mois (ms)', Math.round(ms), long.length);
    expect(ms).toBeLessThan(3000);
  }, 20_000);
});

describe('vocabulaire', () => {
  it('chaque gabarit passe le contrôle, chaque fait émis a un gabarit', () => {
    for (const [k, v] of Object.entries(TEMPLATES)) expect(checkText(v), k).toEqual([]);
    const NOW = new Date(2026, 8, 28, 14, 20).getTime();
    const log = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 8, 1), days: 27 }).filter((e) => (e.end ?? e.start) <= NOW);
    const r = analyze({ babyId: 'a', birthAt: null, events: log }, NOW);
    for (const f of [...r.habits, ...r.forecasts, ...r.evolutions, ...r.associations, ...r.comparisons]) {
      for (const x of f.facts) {
        const t = renderFact(x.code, x.params);
        expect(t, x.code).not.toBeNull();
        expect(checkText(t ?? ''), x.code).toEqual([]);
      }
    }
  });

  it.each([
    ['Son sommeil est normal pour son âge', 'norme'], ['Un léger retard sur les siestes', 'jugement'], ['Il faut attendre avant le biberon', 'injonction'],
    ['Limitez le dernier repas', 'injonction'], ['Évitez le biberon du soir', 'injonction'], ['Bébé né tôt', 'genre'], ['Vous devriez retarder le repas', 'injonction'], ['Ce trouble du sommeil', 'medical'],
    ['Ce repas provoque les réveils', 'cause'], ['Il dort mieux', 'genre'], ['Le coucher tardif à cause de la sieste', 'cause'],
  ])('refuse : %s', (text, rule) => {
    expect(checkText(text).map((v) => v.rule)).toContain(rule);
  });

  it('les phrases neutres passent', () => {
    expect(checkText('Coucher le plus souvent vers 20:00, sur 5 journées notées en entier.')).toEqual([]);
  });
});

describe('références', () => {
  it('s’abstiennent sans assez d’historique et quand il dort', () => {
    const ev = [sleep('a', t(26, 9), t(26, 10)), sleep('b', t(26, 12), t(26, 13))];
    expect(awakeQuartiles({ birthAt: null, events: ev }, t(26, 14))).toBeNull();
    expect(lastInterval({ birthAt: null, events: [...ev, sleep('c', t(26, 15))] }, t(26, 16))).toBeNull();
  });

  it('dernier éveil : réveil + 2 h, à ± 15 min', () => {
    const ev = [sleep('a', t(26, 9), t(26, 10)), sleep('b', t(26, 12), t(26, 13))];
    expect(lastInterval({ birthAt: null, events: ev }, t(26, 13))).toEqual({ from: t(26, 14, 45), to: t(26, 15, 15) });
  });

  it('un long trou de saisie n’est pas un éveil', () => {
    const ev = [sleep('a', t(26, 1), t(26, 2)), sleep('b', t(26, 12), t(26, 13))];
    expect(lastInterval({ birthAt: null, events: ev }, t(26, 13))).toBeNull();
  });
});
