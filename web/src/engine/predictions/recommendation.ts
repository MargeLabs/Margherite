// Recommandation de sieste : une fenêtre CONSEILLÉE, calculée même quand les données ne permettent pas une vraie prévision.
// Distincte de la prévision (`forecast`) : celle-ci est validée par le rejeu sur le passé du bébé ; la recommandation ne l'est pas, et le dit (confiance).
// Individualisée : dernier réveil réel + les éveils que CE bébé a eus avant ses siestes, jamais une table standard ni une heure imposée.
// Les observations qui ressemblent à la situation du jour pèsent davantage : même rang de sieste, sommeil effectif de la sieste précédente
// (minutes réellement dormies), et pour la première sieste l'heure du réveil du matin. Le récent compte plus, sans effacer le fond.
// Aucun créneau habituel n'impose l'attente : les habitudes n'entrent que par les éveils qu'elles ont produits.
import { threshold } from '../config';
import { habitsModel } from '../index';
import type { Day } from '../sleep/calendar';
import { DAY_MIN, sleepIn } from '../sleep/timeline';
import { med } from '../stats';
import type { Window } from './baselines';
import { weightedQuantile } from './models';

export type RecoConfidence = 'low' | 'medium' | 'high';
export interface Recommendation {
  window: Window;
  /** milieu de la fenêtre : l'indication, pas une heure à tenir */
  center: number;
  confidence: RecoConfidence;
  basis: {
    /** éveils de jour observés et utilisés */
    spans: number;
    /** nombre d'observations équivalentes une fois les poids appliqués */
    nEff: number;
    /** jours distincts d'où viennent les éveils */
    days: number;
    /** nombre de siestes déjà faites aujourd'hui */
    rank: number;
    /** les éveils des 3 derniers jours sont plus courts ou plus longs que les précédents (≥ 15 min) */
    trend: 'earlier' | 'later' | null;
    /** ce qui rapproche les observations de la situation du jour */
    matched: Array<'rank' | 'previous_nap' | 'morning_wake'>;
  };
}
export type RecoReason = 'ok' | 'asleep' | 'outside_day' | 'no_history';
export interface RecoOutcome {
  reason: RecoReason;
  recommendation: Recommendation | null;
}

interface Span {
  rank: number;
  awake: number;
  age: number;
  prevSlept: number | null;
  wakeClock: number | null;
  day: number;
}

const gauss = (d: number, bw: number): number => Math.exp(-0.5 * (d / bw) ** 2);
const mad = (v: number[]): number => {
  if (!v.length) return 0;
  const m = med(v) as number;
  return 1.4826 * (med(v.map((x) => Math.abs(x - m))) as number);
};

export function recommendNap(input: { birthAt: number | null; events: Parameters<typeof habitsModel>[0]['events'] }, now: number): RecoOutcome {
  const no = (reason: RecoReason): RecoOutcome => ({ reason, recommendation: null });
  const { events, birthAt } = input;
  if (events.some((e) => e.kind === 'sleep' && e.end === undefined)) return no('asleep');
  if (!events.some((e) => e.kind === 'sleep')) return no('no_history');
  const { timeline: tl, calendar: cal } = habitsModel({ babyId: 'x', birthAt, events }, now);
  const last = tl.sleeps[tl.sleeps.length - 1];
  if (tl.running !== null) return no('asleep');
  if (!last) return no('no_history');
  const wake = last.b, wakeHour = (wake % DAY_MIN) / 60;
  if (wakeHour < 5 || wakeHour >= 21) return no('outside_day');

  // ---- les éveils observés avant une sieste, avec leur contexte ----
  const maxAwake = threshold('baselineMaxAwake'), napStart = threshold('napDayStart'), napEnd = threshold('napDayEnd');
  const spans: Span[] = [];
  for (let d = tl.today - threshold('modelHistoryDays'); d <= tl.today; d++) {
    const day: Day = cal.dayOf(d);
    day.naps.forEach((n, i) => {
      const prev = i ? day.naps[i - 1]! : null, from = prev ? prev.b : day.wake;
      if (from === null || n.a >= wake || n.a % DAY_MIN < napStart || n.a % DAY_MIN >= napEnd) return;
      const awake = n.a - from;
      if (awake > 0 && awake <= maxAwake) spans.push({ rank: i, awake, age: tl.today - d, prevSlept: prev ? sleepIn(prev) : null, wakeClock: prev ? null : (from % DAY_MIN), day: d });
    });
  }
  if (spans.length < threshold('recoMinSpans')) return no('no_history');

  // ---- la situation du jour ----
  const today = cal.dayOf(tl.today), rank = today.naps.length, prevNap = rank ? today.naps[rank - 1]! : null;
  const prevSlept = prevNap ? sleepIn(prevNap) : null, wakeClock = rank ? null : wake % DAY_MIN;

  // ---- poids : récent (sans oublier le fond) × ressemblance avec la situation du jour ----
  const half = threshold('learnHalfLife'), floor = threshold('recoKernelFloor');
  const sameRank = spans.filter((s) => s.rank === rank);
  // bande passante adaptative : jamais plus étroite que la dispersion habituelle, ni que la distance médiane à la situation du jour, sinon une situation
  // jamais vue (réveil plus tôt que tous les autres) ne trouverait aucun voisin ; les observations les plus proches comptent le plus
  const bandwidth = (values: number[], today: number | null, floorMin: number): number => {
    const dist = today === null ? [] : values.map((x) => Math.abs(x - today)).sort((a, b) => a - b);
    return Math.max(floorMin, mad(values), dist.length ? (dist[Math.floor(dist.length / 2)] as number) : 0);
  };
  const bwWake = bandwidth(spans.filter((s) => s.rank === 0 && s.wakeClock !== null).map((s) => s.wakeClock as number), wakeClock, 20);
  const bwPrev = bandwidth(spans.filter((s) => s.rank === rank && s.prevSlept !== null).map((s) => s.prevSlept as number), prevSlept, 15);
  const matched = new Set<'rank' | 'previous_nap' | 'morning_wake'>();
  if (sameRank.length) matched.add('rank');
  const ref = med((sameRank.length >= 3 ? sameRank : spans).map((s) => s.awake)) as number, spread = mad((sameRank.length >= 3 ? sameRank : spans).map((s) => s.awake));
  const weights = spans.map((s) => {
    let w = 0.2 + 0.8 * 0.5 ** (s.age / half);
    w *= threshold('recoRankWeight') ** Math.abs(s.rank - rank);
    if (s.rank === 0 && rank === 0 && s.wakeClock !== null && wakeClock !== null) {
      w *= Math.max(floor, gauss(s.wakeClock - wakeClock, bwWake));
      matched.add('morning_wake');
    } else if (s.rank === rank && rank > 0 && s.prevSlept !== null && prevSlept !== null) {
      w *= Math.max(floor, gauss(s.prevSlept - prevSlept, bwPrev));
      matched.add('previous_nap');
    }
    // une journée atypique ne bouleverse pas le profil : un éveil très éloigné de ce qui est habituel pour ce rang pèse peu
    if (spread > 0 && Math.abs(s.awake - ref) > 3.5 * Math.max(spread, 15)) w *= 0.3;
    return w;
  });
  const sw = weights.reduce((a, b) => a + b, 0), nEff = (sw * sw) / weights.reduce((a, b) => a + b * b, 0);
  const wv = spans.map((s, i) => ({ v: s.awake, w: weights[i]! }));
  const q = (p: number): number => weightedQuantile(wv, p);

  const distinctDays = new Set(spans.map((s) => s.day)).size;
  // moins de jours que ce qu'il faut pour une journée type : jamais mieux que « faible », quel que soit le nombre d'éveils
  const confidence: RecoConfidence = nEff < threshold('recoMediumNeff') || distinctDays < threshold('habitDays') ? 'low' : nEff >= threshold('recoHighNeff') && q(0.8) - q(0.2) <= 60 ? 'high' : 'medium';
  const centre = q(0.5), halfMin = Math.max((q(0.8) - q(0.2)) / 2, threshold('windowMinHalf')) * (confidence === 'low' ? 1.5 : 1);
  const toMs = (t: number): number => new Date(tl.origin.getFullYear(), tl.origin.getMonth(), tl.origin.getDate(), 0, t).getTime();
  const window = { from: toMs(wake + centre - halfMin), to: toMs(wake + centre + halfMin) };

  // tendance : les éveils des 3 derniers jours contre les précédents, au même rang
  const recent = spans.filter((s) => s.age <= 3 && s.rank === rank).map((s) => s.awake), older = spans.filter((s) => s.age > 3 && s.rank === rank).map((s) => s.awake);
  const diff = recent.length >= 3 && older.length >= 3 ? (med(recent) as number) - (med(older) as number) : 0;
  const trend = Math.abs(diff) >= 15 ? (diff < 0 ? 'earlier' : 'later') : null;

  return {
    reason: 'ok',
    recommendation: { window, center: (window.from + window.to) / 2, confidence, basis: { spans: spans.length, nEff: Math.round(nEff * 10) / 10, days: distinctDays, rank, trend, matched: [...matched] } },
  };
}
