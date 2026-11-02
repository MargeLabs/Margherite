// Combien de faux liens ? Des nuits simulées sans aucun lien réel, passées dans l'ancien et le nouveau test.
// Niveau T : mesure la méthode, pas un bébé.
import { associations } from '../patterns/associations';
import { evaluateLinks, linkFactors, type FactorKey, type LinkRow, type OutcomeKey } from '../patterns/links';
import { rng } from './synthetic';

const FACTORS: FactorKey[] = ['late', 'many', 'ln', 'awk', 'awb'];
const OUTCOMES: OutcomeKey[] = ['bed', 'lg', 'wk'];

export interface SimOptions {
  nights: number;
  /** minutes par jour : dérive commune à la dernière sieste et au coucher, comme un bébé qui grandit */
  sharedTrend: number;
  /** vrai lien ajouté : minutes de coucher par minute de dernière sieste */
  realEffect: number;
}

export function simulateRows(o: SimOptions, seed: number): LinkRow[] {
  const r = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const rows: LinkRow[] = [];
  let ar = 0;
  for (let d = 0; d < o.nights; d++) {
    ar = 0.5 * ar + gauss() * 15;
    const noiseEnd = gauss() * 35, end = 960 + noiseEnd + o.sharedTrend * d;
    const nap = 3 + (r() < 0.3 ? 1 : 0);
    rows.push({ d, end, many: nap >= 4, nap, bed: 1200 + ar + o.sharedTrend * d + o.realEffect * noiseEnd, wk: Math.max(0, Math.round(2 + gauss())), lg: 200 + gauss() * 30, ln: 60 + gauss() * 15, awk: 100 + gauss() * 12, awb: 180 + gauss() * 25, ml: 0 });
  }
  return rows;
}

export function falseLinkRates(o: SimOptions, runs: number): { legacy: number; current: number } {
  let legacy = 0, current = 0;
  for (let s = 1; s <= runs; s++) {
    const rows = simulateRows(o, s);
    if (evaluateLinks(linkFactors(rows), FACTORS, OUTCOMES, rows).best) legacy++;
    if (associations(rows, FACTORS, OUTCOMES, s).items.some((x) => x.retained)) current++;
  }
  return { legacy: legacy / runs, current: current / runs };
}
