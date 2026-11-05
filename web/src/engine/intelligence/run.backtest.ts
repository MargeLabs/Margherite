// Banc de l'intelligence individuelle : `npm run backtest`. Pour chaque cible (dodo, durée de sieste, coucher, repas) : chaque modèle rejoué
// sur le passé du bébé, le choix de l'arbitre, et le temps de calcul (le téléphone refait ce travail à chaque changement du journal).
// Réel = R0 (quelques jours : aucune conclusion de performance). Synthétique = T (mécanique seulement).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { eventFromRaw, type RawEventRow } from '../adapters';
import { SCENARIOS, syntheticLog } from '../evaluation/synthetic';
import { ENGINE_VERSION } from '../version';
import { runIntelligence } from './run';
import { evaluateTarget, TARGETS, type Choice, type TargetId } from './targets';

const DATA = join(__dirname, '..', '..', '..', '..', 'data');
const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)} %`);
const f = (v: number | null) => (v === null ? 'n/a' : String(Math.round(v)));

function table(title: string, input: { birthAt: number | null; events: ReturnType<typeof eventFromRaw>[] }, now: number): string[] {
  const out = [`## ${title}`, ''];
  for (const id of Object.keys(TARGETS) as TargetId[]) {
    const t0 = Date.now(), c: Choice = evaluateTarget(id, input, now), ms = Date.now() - t0;
    out.push(`### ${id} — choix : ${c.chosen} (${c.basis}), ${c.decisions} décisions, ${ms} ms`, '', '| Modèle | Réponses | Couverture | Erreur médiane (min) | Largeur médiane (min) | Score d’intervalle |', '|---|---|---|---|---|---|');
    for (const e of c.evaluations) out.push(`| ${e.model}${e.model === c.reference ? ' (référence)' : ''} | ${e.answered}/${e.decisions} | ${pct(e.coverage)} | ${f(e.medianErrorMin)} | ${f(e.medianWidthMin)} | ${f(e.intervalScoreMin)} |`);
    out.push('');
  }
  const t0 = Date.now(), r = runIntelligence({ babyId: 'bench', ...input }, now);
  out.push(`Sortie complète du moteur : ${Date.now() - t0} ms, mode ${r.mode}, ${r.predictions.map((p) => `${p.target}=${p.status}`).join(', ')}.`, '');
  return out;
}

it('intelligence', () => {
  const out = [`# Intelligence individuelle, moteur ${ENGINE_VERSION}`, ''];
  const files = readdirSync(DATA).filter((x) => /^canaille-sauvegarde-.*\.json$/.test(x)).sort((a, b) => statSync(join(DATA, a)).mtimeMs - statSync(join(DATA, b)).mtimeMs);
  const last = files[files.length - 1];
  if (last) {
    const j = JSON.parse(readFileSync(join(DATA, last), 'utf8')) as { baby?: { birth_at: string } | null; events: RawEventRow[]; exportedAt: string };
    out.push('# Données réelles (R0)', '', ...table('Bébé réel', { birthAt: j.baby ? Date.parse(j.baby.birth_at) : null, events: j.events.map(eventFromRaw) }, Date.parse(j.exportedAt)));
  }
  out.push('# Données synthétiques (T : mécanique seulement)', '');
  for (const [name, o] of Object.entries(SCENARIOS)) {
    const from = new Date(2026, 8, 1), days = 28, events = syntheticLog({ ...o, from, days });
    out.push(...table(name, { birthAt: new Date(2026, 8, 1 - (name === 'nouveauNe' ? 7 : 90)).getTime(), events }, new Date(2026, 8, 1 + days, 12).getTime()));
  }
  mkdirSync(join(DATA, 'rapports'), { recursive: true });
  writeFileSync(join(DATA, 'rapports', 'intelligence-dernier.md'), out.join('\n'));
  console.log(out.join('\n'));
}, 900_000);
