// Habitude stable, tendance récente, variation ponctuelle, rupture, données insuffisantes.
// Une valeur isolée ne fait jamais une rupture : il faut plusieurs jours concordants.
import { threshold } from '../config';
import { med } from '../stats';
import type { FindingStatus } from '../types';

const mad = (v: number[]): number => {
  const m = med(v);
  return 1.4826 * med(v.map((x) => Math.abs(x - m)));
};

/** CUSUM robuste : la référence la plus simple à battre. Rend l'indice où la dérive franchit le seuil, sinon null. */
export function cusum(series: number[], baseline: number): number | null {
  const ref = series.slice(0, baseline);
  if (ref.length < 3) return null;
  const m = med(ref), sd = Math.max(mad(ref), 0.01), h = threshold('changeCusumLimit'), k = 0.5;
  let up = 0, down = 0;
  for (let i = baseline; i < series.length; i++) {
    const z = Math.max(-3, Math.min(3, ((series[i] ?? 0) - m) / sd)); // écrêté : une valeur isolée ne suffit pas
    up = Math.max(0, up + z - k);
    down = Math.max(0, down - z - k);
    if (up > h || down > h) return i;
  }
  return null;
}

/** BOCPD (Adams & MacKay 2007) : distribution de la longueur du régime courant, modèle normal à variance fixée. */
export function changeProbabilities(series: number[], hazard = 1 / 30): number[] {
  const sd = Math.max(mad(series), 0.01), v = sd * sd;
  let run = [1], mu = [series[0] ?? 0], n = [1];
  const out: number[] = [0];
  const pdf = (x: number, m: number, s2: number) => Math.exp(-((x - m) ** 2) / (2 * s2)) / Math.sqrt(2 * Math.PI * s2);
  for (let t = 1; t < series.length; t++) {
    const x = series[t] ?? 0;
    const pred = run.map((_, i) => pdf(x, mu[i] ?? 0, v * (1 + 1 / (n[i] ?? 1))));
    const grow = run.map((r, i) => r * (pred[i] ?? 0) * (1 - hazard));
    const cp = run.reduce((s, r, i) => s + r * (pred[i] ?? 0) * hazard, 0);
    const next = [cp, ...grow], z = next.reduce((a, b) => a + b, 0) || 1;
    run = next.map((r) => r / z);
    mu = [x, ...mu.map((m, i) => (m * (n[i] ?? 1) + x) / ((n[i] ?? 1) + 1))];
    n = [1, ...n.map((c) => c + 1)];
    // probabilité que le régime courant ait commencé il y a peu de jours
    out.push(t > threshold('changeConfirmDays') ? run.slice(0, threshold('changeConfirmDays') + 1).reduce((a, b) => a + b, 0) : 0);
  }
  return out;
}

const slopeOf = (v: number[]): number => {
  const n = v.length, xm = (n - 1) / 2, ym = v.reduce((a, b) => a + b, 0) / n;
  return v.reduce((s, y, i) => s + (i - xm) * (y - ym), 0) / v.reduce((s, _, i) => s + (i - xm) ** 2, 0);
};

export function classifySeries(series: number[]): FindingStatus {
  if (series.length < threshold('changeMinDays')) return 'insufficient';
  const confirm = threshold('changeConfirmDays'), past = series.slice(0, -confirm), recent = series.slice(-confirm);
  // on compare les derniers jours à ce que la pente passée annonçait : une évolution régulière n'est pas une rupture
  const slope = slopeOf(past), fitted = past.map((y, i) => y - slope * i), m = med(fitted);
  const sd = Math.max(mad(fitted), threshold('changeMinSpread'));
  const off = recent.map((x, i) => (x - (m + slope * (past.length + i))) / sd);
  if (off.every((z) => z > threshold('changeZ')) || off.every((z) => z < -threshold('changeZ'))) return 'break';
  if (Math.abs(off[off.length - 1] ?? 0) > threshold('changeZ')) return 'one_off';
  return Math.abs(slopeOf(series) * series.length) > threshold('changeZ') * sd ? 'trend' : 'stable';
}
