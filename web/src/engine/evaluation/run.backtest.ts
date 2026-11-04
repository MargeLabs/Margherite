// Banc de comparaison : `npm run backtest`. Rien ne quitte l'ordinateur. Le rapport va dans `data/rapports/`, ignoré par git.
// Réel : le plus récent `data/canaille-sauvegarde-*.json`. Synthétique : mécanique seulement, jamais une preuve de performance.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { eventFromRaw, type RawEventRow } from '../adapters';
import { habitsModel } from '../index';
import { awakeQuartiles, lastInterval, type Forecaster } from '../predictions/baselines';
import { bayesAwake, kalmanAwake, survivalAgeModel, survivalModel, weightedAwake } from '../predictions/models';
import { assessQuality } from '../quality';
import type { EngineEvent, EvidenceLevel } from '../types';
import { ENGINE_VERSION } from '../version';
import { pairedGain, replay, score, type Decision, type Prediction, type Score } from './backtest';
import { byAge, byHistory, calibrationByWidth, detectionStudy, dropEvents, stratify, windowProbabilityScores } from './diagnostics';
import { conformal, decide } from './selection';
import { SCENARIOS, syntheticLog } from './synthetic';

const DATA = join(__dirname, '..', '..', '..', '..', 'data');
const corrected: Forecaster = ({ birthAt, events }, now) => {
  const w = habitsModel({ babyId: 'x', birthAt, events }, now).nextSleep.window;
  return w ? { from: w.from, to: w.to } : null;
};
const MODELS: Array<[string, Forecaster]> = [['Plage habituelle (référence)', corrected], ['Pondéré, 3 j', weightedAwake(3)], ['Pondéré, 7 j', weightedAwake(7)], ['Kalman', kalmanAwake], ['Bayésien', bayesAwake], ['Survie S + C', survivalModel], ['Survie S + C + âge', survivalAgeModel], ['Quartiles des éveils', awakeQuartiles], ['Dernier éveil ± 15 min', lastInterval]];

/** De 6 h à 20 h 30 : les réveils de nuit ne demandent pas de prévision de sieste. */
const dayOnly = (d: Decision): boolean => {
  const h = new Date(d.at).getHours();
  return h >= 6 && h < 21;
};

const f = (v: number | null, u = '') => (v === null ? 'n/a' : `${Math.round(v)}${u}`);
const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)} %`);
const line = (name: string, s: Score) => `| ${name} | ${s.decisions} | ${s.answered} | ${pct(s.abstentionRate)} | ${pct(s.coverage)} | ${f(s.medianErrorMin, ' min')} | ${f(s.medianWidthMin, ' min')} | ${f(s.intervalScoreMin)} |`;
const HEAD = '| Méthode | Décisions | Réponses | Abstention | Couverture | Erreur médiane | Largeur médiane | Score d’intervalle |\n|---|---|---|---|---|---|---|---|';

const PROB_HEAD = '| Méthode | Brier (80 % annoncé) | Log loss | Couverture par largeur (étroites → larges) |\n|---|---|---|---|';

/** Ajouts de la version 0.7 : probabilités, calibration, strates, journaux troués. Les tableaux ci-dessus ne changent pas. */
function diagnostics(input: { birthAt: number | null; events: EngineEvent[] }, runs: ReadonlyArray<readonly [string, Prediction[]]>, legacy: Prediction[]): string[] {
  const out = ['### Probabilité annoncée et calibration', '', PROB_HEAD];
  for (const [n, p] of runs) {
    const w = windowProbabilityScores(p), c = calibrationByWidth(p);
    out.push(`| ${n} | ${w ? w.brier.toFixed(3) : 'n/a'} | ${w ? w.logLoss.toFixed(3) : 'n/a'} | ${c.length ? c.map((b) => `${pct(b.coverage)} (${b.widthMin} min, n=${b.n})`).join(' ; ') : 'trop peu de réponses'} |`);
  }
  const strata = (title: string, label: (p: Prediction) => string) => {
    out.push('', `### ${title}`, '', '| Méthode | Strate | Décisions | Réponses | Couverture | Erreur médiane |', '|---|---|---|---|---|---|');
    for (const [n, p] of [runs[0], runs.find(([k]) => k.startsWith('Survie S + C'))].filter((x): x is NonNullable<typeof x> => !!x)) for (const g of stratify(p, label)) out.push(`| ${n} | ${g.label} | ${g.score.decisions} | ${g.score.answered} | ${pct(g.score.coverage)} | ${f(g.score.medianErrorMin, ' min')} |`);
  };
  strata('Par quantité d’historique déjà vu', byHistory(input.events));
  strata('Par âge du bébé', byAge(input.birthAt));
  const holes = [0.1, 0.3].map((share) => {
    const t = replay({ birthAt: input.birthAt, events: dropEvents(input.events, share, 9) }, survivalModel, dayOnly), r = replay({ birthAt: input.birthAt, events: dropEvents(input.events, share, 9) }, MODELS[0]![1], dayOnly);
    const a = score(t), b = score(r);
    return `| ${Math.round(share * 100)} % | ${pct(b.abstentionRate)} / ${pct(b.coverage)} | ${pct(a.abstentionRate)} / ${pct(a.coverage)} |`;
  });
  out.push('', '### Journal troué à dessein (événements retirés au hasard)', '', '| Part retirée | Plage habituelle : abstention / couverture | Survie : abstention / couverture |', '|---|---|---|', ...holes, '');
  void legacy;
  return out;
}

function section(title: string, input: { birthAt: number | null; events: EngineEvent[] }, level: EvidenceLevel): string[] {
  const runs = MODELS.map(([n, m]) => [n, replay(input, m, dayOnly)] as const);
  const legacy = runs[0]?.[1] ?? [];
  const rows = runs.flatMap(([n, p], i) => (i < 1 ? [line(n, score(p))] : [line(n, score(p)), line(`${n} + calibration`, score(conformal(p)))]));
  const verdicts = runs.slice(1).map(([n, p]) => {
    const d = decide(conformal(p), legacy, level);
    return `- ${n} : ${d.verdict} (${d.why}).`;
  });
  const gains = runs.slice(1).map(([n, p]) => {
    const g = pairedGain(p, legacy);
    return g ? `- ${n} contre la plage habituelle : gain ${Math.round(g.gain * 100)} % (intervalle à 90 % : ${Math.round(g.low * 100)} à ${Math.round(g.high * 100)} %), ${g.n} décisions communes sur ${g.days} jours.` : `- ${n} contre la plage habituelle : aucune décision commune.`;
  });
  return [`## ${title}`, '', HEAD, ...rows, '', ...gains, '', 'Verdict de la règle d’activation :', ...verdicts, '', ...diagnostics(input, runs, legacy)];
}

it('backtest', () => {
  const out = [`# Backtest, moteur ${ENGINE_VERSION}`, '', 'Décisions : à chaque réveil, de 6 h à 21 h. Cible : le début du dodo suivant. Fenêtre = ce que la méthode répondait à cet instant.', ''];

  const files = readdirSync(DATA).filter((x) => /^canaille-sauvegarde-.*\.json$/.test(x)).sort((a, b) => statSync(join(DATA, a)).mtimeMs - statSync(join(DATA, b)).mtimeMs);
  const last = files[files.length - 1];
  if (last) {
    const j = JSON.parse(readFileSync(join(DATA, last), 'utf8')) as { baby?: { birth_at: string } | null; events: RawEventRow[]; exportedAt: string };
    const events = j.events.map(eventFromRaw);
    const q = assessQuality(events, Date.parse(j.exportedAt));
    out.push('# Données réelles (niveau R0 : aucune conclusion de performance)', '', `${events.length} événements, ${q.days.length} jours notés, ${q.issues.length} anomalies. Saisie : médiane ${q.entryDelay?.medianMin} min, 90e centile ${q.entryDelay?.p90Min} min, ${pct(q.entryDelay?.lateShare ?? null)} tardives.`, ...q.issues.map((i) => `- anomalie ${i.code} (${i.ids.length} événement(s))`), '');
    out.push(...section('Bébé réel', { birthAt: j.baby ? Date.parse(j.baby.birth_at) : null, events }, 'R0'));
  } else out.push('Aucun export réel dans `data/`.', '');

  out.push('# Données synthétiques (niveau T : mécanique seulement, jamais une preuve de performance)', '');
  for (const [name, o] of Object.entries(SCENARIOS)) out.push(...section(name, { birthAt: new Date(2026, 8, 1 - (name === 'nouveauNe' ? 7 : 90)).getTime(), events: syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 28 }) }, 'T'));

  const d = detectionStudy();
  out.push('# Détection de rupture (synthétique : mécanique seulement)', '', `Rupture au jour 14 (une sieste de moins), ${d.withBreak} journaux avec rupture et ${d.stable} stables. Rappel ${pct(d.recall)}, précision ${pct(d.precision)}, fausses annonces ${d.falseAlarms}, délai médian ${d.medianDelayDays ?? 'n/a'} jour(s).`, '');
  mkdirSync(join(DATA, 'rapports'), { recursive: true });
  writeFileSync(join(DATA, 'rapports', 'backtest-dernier.md'), out.join('\n'));
  console.log(out.join('\n'));
}, 600_000);
