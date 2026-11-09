// Un nouveau modèle ne prend la tête que s'il bat le MEILLEUR modèle opérationnel, pas seulement la référence (qui peut être volontairement faible).
// Même matière que l'arbitre existant (score d'intervalle à 80 %, gain minimal, nombre de cas), plus : couverture, largeur, et constance dans le temps.
import { threshold } from '../config';
import { score, type Prediction } from '../evaluation/backtest';

const DAY = 86_400_000;

export interface ChallengerVerdict {
  model: string;
  promoted: boolean;
  /** le meilleur modèle opérationnel qu'il devait battre */
  over: string | null;
  /** 1 − score du challenger / score du meilleur : positif = le challenger est meilleur */
  gain: number | null;
  /** pourquoi pas : codes, vide si promu */
  blocked: string[];
}

/** `rivals` : tous les autres modèles, référence comprise, rejoués sur les mêmes décisions. */
export function judgeChallenger(model: string, candidate: Prediction[], rivals: Array<[string, Prediction[]]>, now: number): ChallengerVerdict {
  const since = now - threshold('modelHistoryDays') * DAY, min = threshold('conformalMinCases');
  const recent = (p: Prediction[]) => p.filter((x) => x.at >= since && x.actual <= now);
  const mine = recent(candidate), s = score(mine), blocked: string[] = [];
  const ranked = rivals
    .map(([n, p]) => ({ n, p: recent(p), s: score(recent(p)) }))
    .filter((r) => r.s.answered >= min && r.s.intervalScoreMin !== null)
    .sort((a, b) => (a.s.intervalScoreMin as number) - (b.s.intervalScoreMin as number));
  const best = ranked[0];
  if (s.answered < min || s.intervalScoreMin === null) blocked.push('not_enough_cases');
  if (!best) blocked.push('no_operational_rival');
  let gain: number | null = null;
  if (best && s.intervalScoreMin !== null && s.answered >= min) {
    const b = best.s;
    gain = 1 - s.intervalScoreMin / (b.intervalScoreMin as number);
    if (gain < threshold('gainMin')) blocked.push('gain_below_min');
    if ((s.coverage ?? 0) < (b.coverage ?? 0) - threshold('coverageTolerance')) blocked.push('coverage_worse');
    if ((s.medianWidthMin ?? Infinity) > (b.medianWidthMin ?? 0) * threshold('widthMaxRatio')) blocked.push('too_wide');
    // constance : sur chaque moitié chronologique, il ne fait pas pire que le meilleur modèle en place
    const at = mine.map((x) => x.at).sort((x, y) => x - y), cut = at[Math.floor(at.length / 2)] ?? 0;
    for (const half of [(p: Prediction) => p.at < cut, (p: Prediction) => p.at >= cut]) {
      const a = score(mine.filter(half)), r = score(best.p.filter(half));
      if (a.answered >= 3 && r.answered >= 3 && (a.intervalScoreMin as number) > (r.intervalScoreMin as number) && !blocked.includes('unstable')) blocked.push('unstable');
    }
  }
  return { model, promoted: blocked.length === 0, over: best?.n ?? null, gain, blocked };
}
