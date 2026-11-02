// Analyse transversale : sommeil, éveil, repas, couches, observations notées. Des associations, jamais des causes.
// Une valeur inconnue reste null et sort du test concerné : un jour sans couche notée n'est pas un jour sans couche, une tétée n'a pas de volume.
import { threshold } from '../config';
import { win, type Calendar, type Day, type FullNight } from '../sleep/calendar';
import { DAY_MIN, type Timeline } from '../sleep/timeline';
import { med, mean } from '../stats';
import { testAssociations, type TestedLink, type Variable } from './associations';

export const NIGHT_OUTCOMES = ['bed', 'longest', 'wakings', 'total'] as const;
export type NightOutcome = (typeof NIGHT_OUTCOMES)[number];

/** Observations notées sur le bébé, par jour de fenêtre. Santé et notes de la maman n'y entrent jamais. */
export type DayTags = Record<number, string[]>;

const BABY_TAG_KEYS = ['humeur', 'dig', 'selles'];

/** Ne garde que l'humeur, la digestion et les selles : aucune conclusion médicale à partir d'une case cochée. */
export function tagsFromWell(well: Record<string, Record<string, string | string[]>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [day, w] of Object.entries(well)) {
    const tags = BABY_TAG_KEYS.flatMap((k) => {
      const v = w[k];
      return Array.isArray(v) ? v : v ? [v] : [];
    });
    if (tags.length) out[day] = tags;
  }
  return out;
}

interface NightRow {
  d: number;
  nap: number;
  x: Record<string, number | null>;
  y: Record<NightOutcome, number>;
}

function nightRows(tl: Timeline, cal: Calendar, tags: DayTags): NightRow[] {
  const rows: NightRow[] = [];
  const diapers = (d: number) => tl.events.filter((e) => e.kind === 'diaper' && Math.floor(e.a / DAY_MIN) === d).length;
  for (const d of win(1, tl.today)) {
    const n = cal.nightOf(d), y: Day = cal.dayOf(d - 1);
    if (n.st !== 'ok' || y.wake === null || !y.naps.length || y.gap) continue;
    const f = n as FullNight, last = y.naps[y.naps.length - 1]!, aw: number[] = [];
    let t0 = y.wake;
    y.naps.forEach((z) => {
      aw.push(z.a - t0);
      t0 = z.b;
    });
    const feeds = y.feeds, gaps = feeds.slice(1).map((e, i) => e.a - feeds[i]!.a);
    const dt = tags[d - 1], c = diapers(d - 1);
    rows.push({
      d, nap: y.naps.length,
      x: {
        lastNapEnd: last.b % DAY_MIN, lastNapLength: last.b - last.a, napCount: y.naps.length, napTotal: y.napsTotal,
        awakeAverage: mean(aw), awakeBeforeBed: f.bed - last.b,
        feedCount: feeds.length || null, feedGap: gaps.length ? med(gaps) : null,
        // volume seulement les jours sans tétée, et seulement s'il y a des biberons
        bottleMl: y.sein === 0 && y.ml > 0 ? y.ml : null,
        lastFeedBeforeBed: feeds.length ? f.bed - feeds[feeds.length - 1]!.a : null,
        diapers: c || null,
        // une observation n'existe que les jours où quelque chose a été noté
        ...(dt ? Object.fromEntries(dt.map((t) => [`tag:${t}`, 1])) : {}),
      },
      y: { bed: f.bed - (d - 1) * DAY_MIN, longest: f.longest, wakings: f.wakings, total: f.total },
    });
  }
  return rows;
}

/** Un facteur qui contient l'heure du coucher serait lié au coucher par construction : ce n'est pas une découverte. */
const TAUTOLOGIES = ['awakeBeforeBed|bed', 'lastFeedBeforeBed|bed'];

const MIN_EFFECT: Record<NightOutcome, number> = { bed: 30, longest: 30, wakings: 1, total: 30 };

/** Journée puis nuit. Les jours sans note pour un tag sont exclus du test de ce tag, comparé aux autres jours notés. */
export function dayToNightLinks(tl: Timeline, cal: Calendar, tags: DayTags = {}, seed = 1): { items: TestedLink[]; nights: number; enough: boolean } {
  const rows = nightRows(tl, cal, tags);
  const notedDays = new Set(Object.keys(tags).map(Number));
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.x)))];
  const factors: Variable[] = keys.map((k) => ({ key: k, values: rows.map((r) => (k.startsWith('tag:') ? (notedDays.has(r.d - 1) ? (r.x[k] ?? 0) : null) : (r.x[k] ?? null))) }));
  const outcomes: Variable[] = NIGHT_OUTCOMES.map((k) => ({ key: k, values: rows.map((r) => r.y[k]), minEffect: MIN_EFFECT[k] }));
  const r = testAssociations({ groups: rows.map((x) => x.d), factors, outcomes, covariates: [rows.map((x) => x.d), rows.map((x) => x.nap)], skipCovariate: { napCount: 1, napTotal: 1 }, skipPairs: TAUTOLOGIES, seed });
  return { ...r, nights: rows.length };
}

/** Éveil puis sieste suivante. Plusieurs siestes par jour se ressemblent : la permutation mélange des jours entiers. */
export function awakeToNapLinks(tl: Timeline, cal: Calendar, seed = 1): { items: TestedLink[]; enough: boolean } {
  const rows: Array<{ d: number; awake: number; hour: number; rank: number; length: number }> = [];
  for (const d of win(0, tl.today - 1)) {
    const y = cal.dayOf(d);
    if (y.wake === null) continue;
    let t0 = y.wake;
    y.naps.forEach((z, rank) => {
      rows.push({ d, awake: z.a - t0, hour: z.a % DAY_MIN, rank, length: z.b - z.a });
      t0 = z.b;
    });
  }
  return testAssociations({ groups: rows.map((x) => x.d), factors: [{ key: 'awakeBefore', values: rows.map((x) => x.awake) }], outcomes: [{ key: 'napLength', values: rows.map((x) => x.length), minEffect: threshold('linkMinGap') / 2 }], covariates: [rows.map((x) => x.d), rows.map((x) => x.rank), rows.map((x) => x.hour)], seed });
}
