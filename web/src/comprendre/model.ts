// Les vraies valeurs de la page Comprendre : tout est calculé par le moteur à partir du journal, avec sa base de calcul.
// Aucune donnée inventée : quand le journal ne suffit pas, le modèle le dit (ok: false, abstentions) au lieu de combler.
import { habitsModel } from '@/engine';
import { CURRENT_RULES } from '@/engine/rules';
import { classifySeries } from '@/engine/rhythm/change';
import { win, type FullNight } from '@/engine/sleep/calendar';
import { DAY_MIN, isNapStart } from '@/engine/sleep/timeline';
import { lohi, med, mean, r5 } from '@/engine/stats';
import type { EngineEvent } from '@/engine/types';
import type { ViewEvent } from '@/data/types';
import { fromMinutes } from '@/lib/time';
import type { Situation } from './Filou';

// ---------------------------------------------------------------- formats
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** 415 → « 6 h 55 » ; 480 → « 8 h ». */
export function hm(min: number): string {
  const m = Math.round(((min % DAY_MIN) + DAY_MIN) % DAY_MIN);
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h} h ${p2(mm)}` : `${h} h`;
}
/** 70 → « 1 h 10 » ; 50 → « 50 min ». */
export function dur(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h} h ${p2(mm)}` : `${h} h`;
}
const dayLabel = (d: Date) => `${d.getDate()}${d.getDate() === 1 ? 'er' : ''} ${MONTHS[d.getMonth()]}`;
export const stampLabel = (ms: number) => dayLabel(new Date(ms));
const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

// ---------------------------------------------------------------- types
export type StKey = 'constate' | 'dessine' | 'tendance' | 'fragile' | 'main' | 'passe' | 'pas';
export type MoreId = 'sleep' | 'naps' | 'food' | 'links' | 'day' | 'night';
export type Tint = 'ti-but' | 'ti-lav' | 'ti-sky' | 'ti-rose' | 'ti-sage';

export interface Disc {
  key: string;
  sym: string;
  tint: Tint;
  phrase: string;
  st: StKey;
  base: string;
  /** un point par jour, une nuit ou une semaine : vrai si l'habitude s'y retrouve, dans l'ordre du temps */
  flags: boolean[];
  lab: string;
  more?: MoreId;
  /** peut devenir une broderie (jamais une observation fragile) */
  emb: boolean;
}
export interface Bar { l: string; v: string; pct: number; inc?: boolean }
export interface Row { k: string; v: string; p?: string }
export interface Sec { q: string; ph: string; st: StKey; base: string; bars?: Bar[]; rows?: Row[] }
export interface More { t: string; sym: string; tint: Tint; line: string; key: string; bul: string[]; sec: Sec[] }
export interface Tile { k: string; v: string; s: string; d: number; ti: Tint; sym: string; to: ['d' | 'm', string] }
export interface Step { isGap?: boolean; isStep?: boolean; t?: string; l: string; d?: string; dots?: string[] }
export interface Frise { brief: string; caps: Array<{ l: number; w: number }>; dots: number[]; axis: Array<{ t: string; l: number; cls: '' | 'c' | 'r' }>; mealLab: string; mealPills: string[]; steps: Step[]; base: string }
export interface Series { id: 'night' | 'nap' | 'wake' | 'meal'; l: string; q: string; ph: string; st: StKey; base: string; bars: Bar[] }

export interface CmpModel {
  /** vrai si la journée type existe (au moins 3 journées complètes) */
  ok: boolean;
  situation: Situation;
  tiles: Tile[];
  basis: string;
  day: Frise | null;
  night: Frise | null;
  lastDayLine: string;
  disc: Record<string, Disc>;
  keeps: Array<{ key: string; title: string }>;
  /** découvertes qui peuvent devenir des broderies, de la plus récente à la plus ancienne */
  embKeys: string[];
  ch: Series[];
  more: Record<MoreId, More>;
  bubbles: string[];
}

// ---------------------------------------------------------------- entrée
export interface CmpInput {
  events: ViewEvent[];
  origin: Date;
  nowMin: number;
  run: number | null;
  birthAt: Date | null;
  babyName: string;
}

const KIND = { bib: 'bottle', sein: 'breast', sleep: 'sleep', chg: 'diaper' } as const;

function engineEvents(i: CmpInput): EngineEvent[] {
  return i.events.map((e): EngineEvent => {
    const o: EngineEvent = { id: e.id, kind: KIND[e.k], start: fromMinutes(e.a, i.origin).getTime() };
    if (e.b !== undefined) o.end = fromMinutes(e.b, i.origin).getTime();
    if (e.ml !== undefined) o.ml = e.ml;
    return o;
  });
}

const dotsFor = (spread: number, n: number): string[] => {
  let lvl = spread <= 20 ? 3 : spread <= 40 ? 2 : 1;
  if (n < 5) lvl = Math.min(lvl, 2);
  return [0, 1, 2].map((k) => (k < lvl ? 'on' : ''));
};

/** Statut d'une habitude d'après la part de jours où elle se retrouve : jamais « constaté » sur moins de 7 relevés. */
function statusOf(n: number, N: number): StKey | null {
  if (N < 3) return null;
  const share = n / N;
  if (N >= 7 && share >= 0.8) return 'constate';
  if (N >= 5 && share >= 0.6) return 'dessine';
  return 'fragile';
}

/** Le créneau d'une sieste habituelle, en minutes arrondies à 5 min, large d'au moins 30 min : une plage, jamais une heure précise. */
function napRange(z: { a: number; lo: number; hi: number }): [number, number] {
  return [r5(Math.min(z.lo, z.a - 15)), r5(Math.max(z.hi, z.a + 15))];
}

// ---------------------------------------------------------------- calcul
export function buildModel(input: CmpInput): CmpModel {
  const nowMs = fromMinutes(input.nowMin, input.origin).getTime();
  const m = habitsModel({ babyId: 'baby', birthAt: input.birthAt ? input.birthAt.getTime() : null, events: engineEvents(input) }, nowMs, CURRENT_RULES);
  const tl = m.timeline, cal = m.calendar, typ = m.typical, today = tl.today;
  const un = m.usual(today);
  const origin = tl.origin;
  const dateOf = (d: number) => new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() + d);
  const nightsOk = (a: number, b: number) => win(a, b).map(cal.nightOf).filter((x): x is FullNight => x.st === 'ok');
  const name = input.babyName;

  // ---- les journées et nuits récentes (14 jours)
  const days14 = win(today - 14, today - 1).map(cal.dayOf).filter((x) => x.complete);
  const nights14 = nightsOk(today - 13, today);
  const wakeAt = (x: FullNight) => x.wake - x.d * DAY_MIN;
  const bedAt = (x: FullNight) => x.bed - (x.d - 1) * DAY_MIN;

  const disc: Record<string, Disc> = {};
  const embKeys: string[] = [];
  const add = (d: Disc) => {
    disc[d.key] = d;
    if (d.emb && (d.st === 'constate' || d.st === 'dessine' || d.st === 'tendance')) embKeys.push(d.key);
  };
  const span = (xs: number[]) => (xs.length ? `du ${dayLabel(dateOf(Math.min(...xs)))} au ${dayLabel(dateOf(Math.max(...xs)))}` : '');

  // ---- réveil habituel
  if (nights14.length >= 3) {
    const v = nights14.map(wakeAt), mid = med(v), flags = v.map((x) => Math.abs(x - mid) <= 20), n = flags.filter(Boolean).length;
    const st = statusOf(n, v.length), [lo, hi] = lohi(v);
    if (st) add({ key: 'wake', sym: 'sun', tint: 'ti-but', phrase: r5(lo) === r5(hi) ? `${name} se réveille vers ${hm(r5(lo))}.` : `${name} se réveille entre ${hm(r5(lo))} et ${hm(r5(hi))}.`, st, base: `${n} matins sur ${v.length} · ${span(nights14.map((x) => x.d))}`, flags, lab: 'Chaque point est un matin noté en entier.', more: 'sleep', emb: true });
  }
  // ---- coucher habituel
  if (nights14.length >= 3) {
    const v = nights14.map(bedAt), mid = med(v), flags = v.map((x) => Math.abs(x - mid) <= 20), n = flags.filter(Boolean).length;
    const st = statusOf(n, v.length);
    if (st) add({ key: 'bed', sym: 'star', tint: 'ti-lav', phrase: `Il se couche le plus souvent vers ${hm(r5(mid))}.`, st, base: `${n} soirs sur ${v.length} · ${span(nights14.map((x) => x.d - 1))}`, flags, lab: 'Chaque point est un soir noté en entier.', more: 'sleep', emb: true });
  }
  // ---- heure de chaque sieste (un rang à la fois) ; une seule devient broderie : la plus régulière, pour ne pas multiplier le même symbole
  const napDiscs: Array<{ key: string; share: number }> = [];
  // un créneau de sieste habituel (par l'heure, jamais par le rang du jour) : le point d'un jour est vrai s'il s'y endort
  if (typ.ok && days14.length >= 3) {
    typ.naps.forEach((z) => {
      const [lo, hi] = napRange(z), flags = days14.map((x) => x.naps.some((p) => { const m = p.a % DAY_MIN; return m >= lo - 15 && m <= hi + 15; })), n = flags.filter(Boolean).length;
      const st = statusOf(n, days14.length);
      if (!st) return;
      add({ key: `nap${z.k}`, sym: 'cloud', tint: 'ti-sky', phrase: `Il fait souvent une sieste entre ${hm(lo)} et ${hm(hi)}.`, st, base: `${n} jours sur ${days14.length} · ${span(days14.map((x) => x.d))}`, flags, lab: 'Chaque point est un jour noté en entier.', more: 'naps', emb: false });
      napDiscs.push({ key: `nap${z.k}`, share: n / days14.length });
    });
  }
  const bestNap = napDiscs.filter((x) => disc[x.key]!.st !== 'fragile').sort((a, b) => b.share - a.share)[0];
  if (bestNap) {
    disc[bestNap.key]!.emb = true;
    embKeys.push(bestNap.key);
  }
  // ---- repas qui reviennent à intervalle régulier
  const gapsOf = days14.filter((x) => x.dayFeeds.length >= 4).map((x) => ({ d: x.d, g: med(x.dayFeeds.slice(1).map((f, i) => f.a - x.dayFeeds[i]!.a)) }));
  if (gapsOf.length >= 3) {
    const mid = med(gapsOf.map((x) => x.g)), flags = gapsOf.map((x) => Math.abs(x.g - mid) <= 30), n = flags.filter(Boolean).length;
    const st = statusOf(n, gapsOf.length);
    if (st) add({ key: 'meals', sym: 'bottle', tint: 'ti-rose', phrase: `Il mange environ toutes les ${dur(r5(mid))}.`, st, base: `${n} jours sur ${gapsOf.length} · ${span(gapsOf.map((x) => x.d))}`, flags, lab: 'Chaque point est un jour noté en entier.', more: 'food', emb: true });
  }

  // ---- séries par semaine (lundi → dimanche) : nuit, siestes, éveil, biberon
  const weekOf = (d: number) => {
    const dt = dateOf(d);
    return d - ((dt.getDay() + 6) % 7);
  };
  const weekStarts = [...new Set(win(0, today).map(weekOf))].filter((s) => s + 6 >= 0).sort((a, b) => a - b);
  const allDays = win(0, today).map(cal.dayOf);
  const allNights = nightsOk(1, today);
  const weekLabel = (s: number) => `${dateOf(s).getDate()}/${dateOf(s).getMonth() + 1}`;
  const gapsDay = (x: { wake: number | null; naps: Array<{ a: number; b: number }> }): number[] => {
    if (x.wake === null) return [];
    const out: number[] = [];
    let t = x.wake;
    x.naps.forEach((z) => {
      out.push(z.a - t);
      t = z.b;
    });
    return out;
  };
  const bottles = tl.feeds.filter((f) => f.kind === 'bottle' && (f.ml ?? 0) > 0);
  interface Wk { s: number; night: number | null; nap: number | null; wake: number | null; meal: number | null }
  const weeks: Wk[] = weekStarts.map((s) => {
    const inW = (d: number) => d >= s && d <= s + 6;
    const ns = allNights.filter((x) => inW(x.d)).map((x) => x.longest);
    const ds = allDays.filter((x) => inW(x.d) && x.complete);
    const aw = ds.flatMap((x) => gapsDay(x));
    const ml = bottles.filter((f) => inW(Math.floor(f.a / DAY_MIN))).map((f) => f.ml as number);
    return { s, night: ns.length >= 2 ? med(ns) : null, nap: ds.length >= 2 ? med(ds.map((x) => x.naps.length)) : null, wake: aw.length >= 4 ? med(aw) : null, meal: ml.length >= 5 ? mean(ml) : null };
  });
  const mkSeries = (id: Series['id'], l: string, q: string, pick: (w: Wk) => number | null, fmt: (v: number) => string, eq: number, say: (a: number, b: number, nW: number) => { up: string; down: string; flat: string }, base?: string): Series | null => {
    const pts = weeks.map((w) => ({ w, v: pick(w) })).filter((x): x is { w: Wk; v: number } => x.v !== null);
    if (pts.length < 3) return null;
    const max = Math.max(...pts.map((x) => x.v)) || 1;
    const first = pts[0]!.v, lastFull = pts[pts.length - (pts[pts.length - 1]!.w.s + 6 >= today ? 2 : 1)]?.v ?? pts[pts.length - 1]!.v;
    const nW = pts.length - (pts[pts.length - 1]!.w.s + 6 >= today ? 1 : 0);
    const diff = lastFull - first;
    const s = say(first, lastFull, nW);
    const trend = classifySeries(pts.map((x) => x.v));
    const st: StKey = Math.abs(diff) < eq ? 'constate' : trend === 'trend' ? 'tendance' : 'fragile';
    return {
      id, l, q, st, ph: Math.abs(diff) < eq ? s.flat : diff > 0 ? s.up : s.down,
      base: base ?? `${pts.length} semaines${pts[pts.length - 1]!.w.s + 6 >= today ? ' · la dernière est incomplète' : ''}.`,
      bars: pts.map((x) => ({ l: weekLabel(x.w.s), v: fmt(x.v), pct: Math.max(12, Math.round((x.v / max) * 100)), ...(x.w.s + 6 >= today ? { inc: true } : {}) })),
    };
  };
  const ch = [
    mkSeries('night', 'Nuits', 'Son plus long sommeil de la nuit', (w) => w.night, (v) => dur(r5(v)), 15, (a, b, n) => ({ up: `Ses plus longs sommeils de nuit s’allongent depuis ${n} semaines.`, down: `Ses plus longs sommeils de nuit sont plus courts qu’il y a ${n} semaines.`, flat: 'Ses plus longs sommeils de nuit sont stables.' })),
    mkSeries('nap', 'Siestes', 'Nombre de siestes par jour', (w) => w.nap, (v) => String(Math.round(v * 10) / 10).replace('.', ','), 0.5, (a, b) => ({ up: `Il est passé de ${Math.round(a)} à ${Math.round(b)} siestes par jour.`, down: `Il est passé de ${Math.round(a)} à ${Math.round(b)} siestes par jour.`, flat: 'Le nombre de siestes par jour est stable.' })),
    mkSeries('wake', 'Éveil', 'Temps d’éveil entre deux dodos', (w) => w.wake, (v) => dur(r5(v)), 10, () => ({ up: 'Ses temps d’éveil s’allongent doucement.', down: 'Ses temps d’éveil sont un peu plus courts qu’avant.', flat: 'Ses temps d’éveil sont stables.' })),
    mkSeries('meal', 'Repas', 'Taille d’un biberon', (w) => w.meal, (v) => `${Math.round(v)} mL`, 10, (a, b) => ({ up: `Ses biberons sont passés d’environ ${Math.round(a)} à ${Math.round(b)} mL.`, down: `Ses biberons sont passés d’environ ${Math.round(a)} à ${Math.round(b)} mL.`, flat: 'La taille de ses biberons est stable.' }), 'Biberons seulement : la quantité des tétées n’est pas mesurée.'),
  ].filter((x): x is Series => x !== null);

  // ---- plus longs sommeils de nuit : une tendance, si le moteur la voit
  const night = ch.find((x) => x.id === 'night');
  if (night && night.st === 'tendance') {
    const v = night.bars, flags = v.slice(1).map((_, i) => v[i + 1]!.pct >= v[i]!.pct), n = flags.filter(Boolean).length;
    add({ key: 'nights', sym: 'moon', tint: 'ti-lav', phrase: night.ph, st: 'tendance', base: `${v.length} semaines · du ${v[0]!.l} au ${v[v.length - 1]!.l}`, flags, lab: 'Chaque point est une semaine plus longue ou égale à la précédente.', more: 'sleep', emb: true });
    void n;
  }

  // ---- lien jour → nuit retenu par le moteur (jamais une cause)
  const FACT: Record<string, string> = { late: 'sa dernière sieste finit tard', many: 'il fait beaucoup de siestes', ln: 'sa dernière sieste est longue', awk: 'ses éveils sont longs', awb: 'son éveil avant le coucher est long' };
  const OUT = (o: string, up: boolean) => (o === 'bed' ? (up ? 'il se couche plus tard' : 'il se couche plus tôt') : o === 'lg' ? (up ? 'son plus long sommeil est plus long' : 'son plus long sommeil est plus court') : up ? 'il se réveille plus souvent la nuit' : 'il se réveille moins souvent la nuit');
  const assoc = m.associations(['late', 'many', 'ln', 'awk', 'awb'], ['bed', 'lg', 'wk']);
  const link = assoc.enough ? assoc.items.filter((x) => x.retained && !(x.factor === 'awb' && x.outcome === 'bed')).sort((a, b) => a.q - b.q)[0] : undefined;
  if (link) add({ key: 'link', sym: 'moon', tint: 'ti-lav', phrase: `Les jours où ${FACT[link.factor]}, ${OUT(link.outcome, link.effect > 0)}.`, st: 'tendance', base: `${link.n} soirs · À rapprocher, sans conclure.`, flags: [], lab: '', more: 'links', emb: false });

  // ---- À retenir : aujourd'hui comparé à d'habitude, puis une habitude qui se dessine, puis une observation fragile
  const keeps: CmpModel['keeps'] = [];
  const todayN = cal.nightOf(today);
  if (disc.wake && todayN.st === 'ok') {
    const w = wakeAt(todayN as FullNight), diff = Math.round(w - med(nights14.filter((x) => x.d !== today).map(wakeAt).concat(nights14.length === 1 ? [w] : [])));
    keeps.push({ key: 'wake', title: Math.abs(diff) <= 20 ? `Ce matin, réveil à ${hm(w)} : dans ses horaires habituels.` : `Ce matin, réveil à ${hm(w)}, ${Math.abs(diff)} min ${diff > 0 ? 'plus tard' : 'plus tôt'} que d’habitude.` });
  }
  // ---- sieste d'aujourd'hui plus longue ou plus courte que sa sieste la plus longue d'habitude (jamais un jugement)
  const todayD = cal.dayOf(today);
  const longest = (x: { naps: Array<{ a: number; b: number }> }) => Math.max(...x.naps.map((z) => z.b - z.a));
  const refNaps = days14.filter((x) => x.d !== today && x.naps.length).map(longest);
  if (todayD.naps.length && refNaps.length >= 3) {
    const t = longest(todayD), diff = Math.round(t - med(refNaps));
    if (Math.abs(diff) >= 20) {
      const phrase = `Aujourd’hui, sa plus longue sieste a duré ${dur(r5(t))}, ${dur(r5(Math.abs(diff)))} de ${diff > 0 ? 'plus' : 'moins'} que d’habitude.`;
      add({ key: 'napLong', sym: 'cloud', tint: 'ti-sky', phrase, st: refNaps.length >= 7 ? 'constate' : 'fragile', base: `Comparée à sa plus longue sieste de ${refNaps.length} jours notés en entier (${dur(r5(med(refNaps)))} en général). Un jour seul ne fait pas une habitude.`, flags: [], lab: '', more: 'naps', emb: false });
      keeps.push({ key: 'napLong', title: phrase });
    }
  }
  const forming = [disc.link, ...Object.values(disc).filter((d) => d.key !== 'link' && (d.st === 'dessine' || d.st === 'tendance'))].filter((d): d is Disc => !!d);
  forming.forEach((d) => { if (keeps.length < 3 && !keeps.some((k) => k.key === d.key)) keeps.push({ key: d.key, title: d.phrase }); });
  const fragile = Object.values(disc).find((d) => d.st === 'fragile' && !keeps.some((k) => k.key === d.key));
  if (fragile && keeps.length < 3) keeps.push({ key: fragile.key, title: fragile.phrase });
  Object.values(disc).filter((d) => d.st === 'constate' && keeps.length < 3 && !keeps.some((k) => k.key === d.key)).forEach((d) => keeps.push({ key: d.key, title: d.phrase }));

  // ---- repères
  const ok = typ.ok;
  const tiles: Tile[] = [];
  let basis = `D’après ${typ.n} ${plural(typ.n, 'jour noté', 'jours notés')} en entier. Les repères apparaissent dès 3 jours notés en entier.`;
  let day: Frise | null = null, nightF: Frise | null = null;
  const napCount = ok && typ.napCounts.length ? Math.round(med(typ.napCounts)) : 0;
  if (ok) {
    const awK = typ.naps.map((z) => z.aw), awM = awK.length ? r5(med(awK)) : 0;
    const wakeSp = typ.wkR[1] - typ.wkR[0], bedSp = typ.bdR[1] - typ.bdR[0];
    const napSp = typ.naps.length ? Math.max(...typ.naps.map((z) => z.hi - z.lo)) : 99;
    const sameCount = typ.napCounts.filter((c) => c === napCount).length / typ.napCounts.length;
    tiles.push({ k: 'Réveil', v: hm(r5(typ.wake)), s: 'le matin', d: dotsFor(wakeSp, typ.n).filter(Boolean).length, ti: 'ti-but', sym: 'sun', to: ['d', 'wake'] });
    tiles.push({ k: 'Siestes', v: napCount ? `${napCount} ${plural(napCount, 'sieste', 'siestes')}` : 'Aucune sieste', s: napCount ? (typ.naps.length ? `dont ${typ.naps.length} ${plural(typ.naps.length, 'créneau habituel', 'créneaux habituels')}` : 'à des heures variables') : 'notée en entier', d: Math.min(sameCount >= 0.8 ? 3 : sameCount >= 0.5 ? 2 : 1, typ.n < 5 ? 2 : 3), ti: 'ti-sky', sym: 'cloud', to: ['m', 'naps'] });
    tiles.push({ k: 'Éveil', v: awM ? `≈ ${dur(awM)}` : '—', s: 'entre deux dodos', d: dotsFor(napSp, typ.n).filter(Boolean).length, ti: 'ti-sage', sym: 'smile', to: ['m', 'naps'] });
    tiles.push({ k: 'Coucher', v: hm(r5(typ.bed)), s: 'le soir', d: dotsFor(bedSp, typ.n).filter(Boolean).length, ti: 'ti-lav', sym: 'star', to: ['d', 'bed'] });
    tiles.push({ k: 'Nuit', v: un.ok ? `${un.wk} ${plural(un.wk, 'réveil', 'réveils')}` : '—', s: un.ok ? `plus long sommeil ≈ ${dur(r5(un.longest))}` : 'Pas encore assez de nuits', d: un.ok ? (un.n >= 5 ? (un.wkMax - un.wkMin <= 1 ? 3 : 2) : 1) : 0, ti: 'ti-lav', sym: 'moon', to: ['m', 'sleep'] });
    tiles.push({ k: 'Repas', v: typ.feedGap ? dur(r5(typ.feedGap)) : '—', s: 'entre deux repas, biberons et tétées', d: typ.feedGap ? (typ.n >= 5 ? 2 : 1) : 0, ti: 'ti-rose', sym: 'bottle', to: ['m', 'food'] });
    basis = `D’après ${typ.n} jours notés en entier sur les 7 derniers (${span(typ.days.map((x) => x.d))}).`;

    // ---- journée type : de minuit au coucher, siestes en capsules, repas en points
    const total = Math.max(60, r5(typ.bed));
    const napsS = typ.naps.slice().sort((a, b) => a.a - b.a);
    const mealsDay = typ.meals.filter((t) => t >= typ.wake - 60 && t < total);
    const axisD: Frise['axis'] = [{ t: '0 h', l: 0, cls: '' }];
    [360, 720, 1080].forEach((t) => { if (t < total - 150) axisD.push({ t: `${t / 60} h`, l: t / total, cls: 'c' }); });
    axisD.push({ t: hm(r5(typ.bed)), l: 1, cls: 'r' });
    const steps: Step[] = [{ isStep: true, t: hm(r5(typ.wake)), l: 'Réveil', d: '', dots: dotsFor(wakeSp, typ.n) }];
    let prevEnd = typ.wake;
    napsS.forEach((z, i) => {
      steps.push({ isGap: true, l: `éveillé ${dur(r5(z.a - prevEnd))}` });
      steps.push({ isStep: true, t: hm(napRange(z)[0]), l: `Sieste ${i + 1}`, d: `jusqu’à ${hm(napRange(z)[1])} · ≈ ${dur(r5(z.du))}`, dots: dotsFor(z.hi - z.lo, z.n) });
      prevEnd = z.a + z.du;
    });
    steps.push({ isGap: true, l: `éveillé ${dur(r5(typ.bed - prevEnd))}` });
    steps.push({ isStep: true, t: hm(r5(typ.bed)), l: 'Coucher', d: '', dots: dotsFor(bedSp, typ.n) });
    day = {
      brief: `Une journée type : réveil vers ${hm(r5(typ.wake))}, ${napCount} ${plural(napCount, 'sieste', 'siestes')}, coucher vers ${hm(r5(typ.bed))}.`,
      caps: napsS.map((z) => ({ l: z.a / total, w: Math.min(z.du, total - z.a) / total })),
      dots: mealsDay.map((t) => t / total),
      axis: axisD, mealLab: 'Ses repas reviennent vers', mealPills: mealsDay.map(hm),
      steps, base: `D’après ${typ.n} jours notés en entier sur les 7 derniers.`,
    };
  } else {
    ['Réveil', 'Siestes', 'Éveil', 'Coucher', 'Nuit', 'Repas'].forEach((k, i) => tiles.push({ k, v: '—', s: 'Pas encore assez de jours', d: 0, ti: (['ti-but', 'ti-sky', 'ti-sage', 'ti-lav', 'ti-lav', 'ti-rose'] as Tint[])[i]!, sym: ['sun', 'cloud', 'smile', 'star', 'moon', 'bottle'][i]!, to: ['m', 'sleep'] }));
  }
  // ---- nuit type : du coucher au réveil
  if (un.ok) {
    const bedM = r5(un.bed), total = DAY_MIN + un.wake - un.bed;
    const rel = (t: number) => Math.max(0, Math.min(1, (t - un.bed) / total));
    const axisN: Frise['axis'] = [{ t: hm(bedM), l: 0, cls: '' }, { t: '0 h', l: rel(DAY_MIN), cls: 'c' }];
    if (un.wake > 240) axisN.push({ t: '3 h', l: rel(DAY_MIN + 180), cls: 'c' });
    axisN.push({ t: hm(r5(un.wake)), l: 1, cls: 'r' });
    // les plages où il dort au moins une nuit sur deux (observées) ; les réveils qui n'ont pas lieu à la même heure ne sont que comptés, jamais placés
    const blocks = un.habBlocks, loose = Math.max(0, un.wk - (blocks.length - 1));
    const nsteps: Step[] = [{ isStep: true, t: hm(bedM), l: 'Coucher', d: '', dots: dotsFor(un.bedR[1] - un.bedR[0], un.n) }];
    blocks.forEach((b, i) => {
      const last = i === blocks.length - 1;
      nsteps.push({ isGap: true, l: last && loose ? `dort, avec ${loose} ${plural(loose, 'réveil', 'réveils')} à des heures variables` : `dort ≈ ${dur(r5(b[1] - b[0]))}` });
      if (i < blocks.length - 1) nsteps.push({ isStep: true, t: hm(r5(b[1])), l: 'Réveil', d: '', dots: dotsFor(un.wakeR[1] - un.wakeR[0], un.n).map((_, k) => (k < 1 ? 'on' : '')) });
    });
    nsteps.push({ isStep: true, t: hm(r5(un.wake)), l: 'Réveil du matin', d: '', dots: dotsFor(un.wakeR[1] - un.wakeR[0], un.n) });
    nightF = {
      brief: `Une nuit type : couché vers ${hm(bedM)}, ${un.wk} ${plural(un.wk, 'réveil', 'réveils')}, réveil vers ${hm(r5(un.wake))}.`,
      caps: blocks.map((b) => ({ l: rel(b[0]), w: Math.max(0.02, rel(b[1]) - rel(b[0])) })),
      dots: blocks.slice(0, -1).map((b) => rel(b[1])),
      axis: axisN, mealLab: 'Ses réveils de nuit, avec un repas, vers', mealPills: blocks.slice(0, -1).map((b) => hm(r5(b[1]))),
      steps: nsteps, base: `D’après ${un.n} nuits notées en entier sur les 7 dernières.`,
    };
  }

  // ---- hier et la nuit dernière, comparés à ses 7 jours (ou nuits) d'avant
  const diffText = (d: number, tol: number, unit: 'min' | 'n') => (Math.abs(d) <= tol ? 'comme d’habitude' : unit === 'min' ? `${d > 0 ? '+' : '−'}${Math.abs(Math.round(d))} min` : `${d > 0 ? '+' : '−'}${Math.abs(d)}`);
  const yest = cal.dayOf(today - 1);
  const prevDays = win(today - 8, today - 2).map(cal.dayOf).filter((x) => x.complete);
  let lastDayLine = 'Hier n’est pas noté en entier : rien à comparer.';
  const moreDay: More = { t: 'La journée d’hier', sym: 'sun', tint: 'ti-but', line: '', key: '', bul: ['Hier n’est pas noté en entier.'], sec: [{ q: 'Hier, comparée à ses 7 jours d’avant', ph: 'Il manque des repères pour comparer : rien n’est affirmé.', st: 'pas', base: '' }] };
  if (yest.complete && prevDays.length >= 3 && yest.wake !== null && yest.bed !== null) {
    const rows: Row[] = [];
    const wk = yest.wake - yest.d * DAY_MIN, wkH = med(prevDays.map((x) => (x.wake as number) - x.d * DAY_MIN));
    const bd = yest.bed - yest.d * DAY_MIN, bdH = med(prevDays.map((x) => (x.bed as number) - x.d * DAY_MIN));
    rows.push({ k: 'Réveil', v: hm(wk), p: diffText(wk - wkH, 15, 'min') });
    rows.push({ k: 'Nombre de siestes', v: String(yest.naps.length), p: diffText(yest.naps.length - Math.round(med(prevDays.map((x) => x.naps.length))), 0, 'n') });
    rows.push({ k: 'Sommeil de jour', v: dur(r5(yest.napsTotal)), p: diffText(yest.napsTotal - med(prevDays.map((x) => x.napsTotal)), 20, 'min') });
    if (yest.naps.length && prevDays.every((x) => x.naps.length)) {
      const le = (yest.naps[yest.naps.length - 1]!.b) % DAY_MIN, leH = med(prevDays.map((x) => x.naps[x.naps.length - 1]!.b % DAY_MIN));
      rows.push({ k: 'Dernière sieste finie', v: hm(le), p: diffText(le - leH, 15, 'min') });
    }
    rows.push({ k: 'Coucher', v: hm(bd), p: diffText(bd - bdH, 15, 'min') });
    const odd = rows.filter((r) => r.p !== 'comme d’habitude');
    lastDayLine = odd.length ? 'Hier : une journée un peu différente de ses journées habituelles.' : 'Hier : une journée proche de ses journées habituelles.';
    const wd = `${WEEKDAYS[dateOf(today - 1).getDay()]} ${dateOf(today - 1).getDate()} ${MONTHS[dateOf(today - 1).getMonth()]}`;
    moreDay.bul = [odd.length ? `Différente sur : ${odd.map((r) => r.k.toLowerCase()).join(', ')}.` : 'Une journée proche de ses journées habituelles.', 'Une journée seule ne fait pas une tendance.'];
    moreDay.sec = [{ q: 'Hier, comparée à ses 7 jours d’avant', ph: odd.length ? 'Quelques écarts, à regarder sans conclure.' : 'Rien d’inhabituel.', st: 'constate', base: `${wd[0]!.toUpperCase()}${wd.slice(1)} · ${prevDays.length} jours d’avant.`, rows }];
  }
  const moreNight: More = { t: 'La nuit dernière', sym: 'moon', tint: 'ti-lav', line: '', key: '', bul: ['La nuit dernière n’est pas notée en entier.'], sec: [{ q: 'Comparée à ses nuits d’avant', ph: 'Il manque des repères pour comparer : rien n’est affirmé.', st: 'pas', base: '' }] };
  if (todayN.st === 'ok' && un.ok) {
    const nn = todayN as FullNight;
    const rows: Row[] = [
      { k: 'Coucher', v: hm(bedAt(nn)), p: diffText(bedAt(nn) - un.bed, 15, 'min') },
      { k: 'Plus long sommeil', v: dur(r5(nn.longest)), p: diffText(nn.longest - un.longest, 15, 'min') },
      { k: 'Réveils de nuit', v: String(nn.wakings), p: diffText(nn.wakings - un.wk, 0, 'n') },
      { k: 'Réveil du matin', v: hm(wakeAt(nn)), p: diffText(wakeAt(nn) - un.wake, 15, 'min') },
    ];
    const odd = rows.filter((r) => r.p !== 'comme d’habitude');
    moreNight.bul = [odd.length ? `Différente sur : ${odd.map((r) => r.k.toLowerCase()).join(', ')}.` : 'Une nuit proche de ses nuits habituelles.', 'Une nuit seule ne fait pas une tendance.'];
    moreNight.sec = [{ q: `Comparée à ses ${un.n} nuits d’avant`, ph: odd.length ? 'Quelques écarts, à regarder sans conclure.' : 'Rien d’inhabituel.', st: 'constate', base: `D’après ${un.n} nuits notées en entier.`, rows }];
  }

  // ---- feuilles « aller plus loin »
  const byBars = (id: Series['id']) => ch.find((x) => x.id === id);
  const barsOf = (s: Series | undefined): Sec | null => (s ? { q: s.q, ph: s.ph, st: s.st, base: s.base, bars: s.bars } : null);
  const nightTotals = nights14.map((x) => x.total).filter((x) => x > 0), napTotals = days14.map((x) => x.napsTotal);
  const nightShare = nightTotals.length && napTotals.length ? Math.round((100 * med(nightTotals)) / (med(nightTotals) + med(napTotals))) : null;
  const periodLen = nights14.flatMap((x) => x.bl);
  const sec24 = days14.filter((x) => x.full24).map((x) => x.sleep24);
  const sleep: More = {
    t: 'Son sommeil et ses cycles', sym: 'moon', tint: 'ti-lav', line: 'Ses nuits et son sommeil', key: un.ok ? `Plus long sommeil ≈ ${dur(r5(un.longest))}` : 'Pas encore assez de nuits',
    bul: [
      byBars('night')?.ph ?? 'Il faut au moins 3 semaines notées pour voir l’évolution de ses nuits.',
      periodLen.length ? `Une période de sommeil dure ≈ ${dur(r5(med(periodLen)))}. Un journal montre des périodes, pas des cycles biologiques.` : 'Les périodes de sommeil apparaissent dès quelques nuits notées en entier.',
      nightShare !== null ? `Environ ${nightShare} % de son sommeil se fait la nuit.` : 'La répartition nuit et jour apparaît dès quelques jours notés en entier.',
    ],
    sec: [barsOf(byBars('night')), sec24.length >= 3 ? { q: 'Combien dort-il en 24 h ?', ph: `Environ ${dur(r5(med(sec24)))} de sommeil noté par 24 h.`, st: statusOf(sec24.length, sec24.length) ?? 'fragile', base: `${sec24.length} jours notés en entier sur 14.` } : null].filter((x): x is Sec => x !== null),
  };
  const napRows = ok ? typ.naps.slice().sort((a, b) => a.a - b.a).map((z, i) => ({ k: `Sieste ${i + 1}`, v: `${hm(napRange(z)[0])} – ${hm(napRange(z)[1])} · ≈ ${dur(r5(z.du))}` })) : [];
  const awakeBars: Bar[] = ok ? typ.naps.slice().sort((a, b) => a.k - b.k).map((z) => ({ l: z.k === 0 ? '1re' : `${z.k + 1}e`, v: dur(r5(z.aw)), pct: 0 })) : [];
  const awMax = Math.max(1, ...(ok ? typ.naps.map((z) => z.aw) : [1]));
  ok && awakeBars.forEach((b, i) => { b.pct = Math.max(12, Math.round((100 * typ.naps.slice().sort((a, c) => a.k - c.k)[i]!.aw) / awMax)); });
  const naps: More = {
    t: 'Ses siestes et ses temps d’éveil', sym: 'cloud', tint: 'ti-sky', line: 'Combien de temps éveillé entre deux dodos', key: ok ? `${napCount} ${plural(napCount, 'sieste', 'siestes')} · éveil ≈ ${dur(r5(med(typ.naps.map((z) => z.aw) .concat(typ.naps.length ? [] : [0]))))}` : 'Pas encore assez de jours',
    bul: ok ? [`Il fait environ ${napCount} ${plural(napCount, 'sieste', 'siestes')} par jour.`, `Il reste éveillé ≈ ${dur(r5(med(typ.naps.map((z) => z.aw))))} entre deux dodos.`, byBars('wake')?.ph ?? 'L’évolution de ses éveils apparaît dès 3 semaines notées.'] : ['Les siestes apparaissent dès 3 journées notées en entier.'],
    sec: ok ? [
      { q: 'À quelle heure dort-il en journée ?', ph: 'Ses siestes reviennent à des heures plus ou moins proches d’un jour à l’autre.', st: statusOf(typ.n, typ.n) ?? 'fragile', base: `${typ.n} jours notés en entier sur les 7 derniers.`, rows: napRows },
      { q: 'Combien de temps reste-t-il éveillé avant chaque sieste ?', ph: 'Le temps d’éveil avant chaque dodo, de la première à la dernière sieste.', st: statusOf(typ.n, typ.n) ?? 'fragile', base: `${typ.n} jours notés en entier sur les 7 derniers.`, bars: awakeBars },
    ] : [],
  };
  const nightFeeds = nights14.map((x) => tl.feeds.filter((f) => f.a >= x.bed && f.a < x.wake).length);
  const mealRows: Row[] = [];
  if (ok && typ.meals.length) {
    const grp = (lo: number, hi: number) => typ.meals.filter((t) => t >= lo && t < hi).map(hm).join(' · ');
    [['Matin', 0, 720], ['Après-midi', 720, 1020], ['Soir', 1020, 1440]].forEach(([k, lo, hi]) => { const v = grp(lo as number, hi as number); if (v) mealRows.push({ k: k as string, v }); });
  }
  if (nights14.length >= 3 && nightFeeds.some((x) => x > 0)) mealRows.push({ k: 'Nuit', v: `${Math.round(med(nightFeeds))} ${plural(Math.round(med(nightFeeds)), 'repas', 'repas')} en général` });
  const ml7 = bottles.filter((f) => f.a >= (today - 7) * DAY_MIN).map((f) => f.ml as number);
  const food: More = {
    t: 'Son alimentation', sym: 'bottle', tint: 'ti-rose', line: 'À quelles heures il mange', key: ok && typ.feedGap ? dur(r5(typ.feedGap)) : 'Pas encore assez de jours',
    bul: [ok && typ.feedGap ? `Il mange environ toutes les ${dur(r5(typ.feedGap))}, biberons et tétées.` : 'Les heures de repas apparaissent dès 3 journées notées en entier.', ml7.length >= 5 ? `Ses biberons font ≈ ${Math.round(mean(ml7) as number)} mL.` : 'La taille des biberons apparaît dès quelques biberons notés.', nights14.length >= 3 ? `Il y a en général ${Math.round(med(nightFeeds))} ${plural(Math.round(med(nightFeeds)), 'repas', 'repas')} la nuit.` : 'Les repas de nuit apparaissent dès quelques nuits notées.'],
    sec: [
      mealRows.length ? { q: 'À quelles heures mange-t-il ?', ph: 'Les heures de repas se dessinent peu à peu.', st: disc.meals?.st ?? 'fragile', base: disc.meals?.base ?? `${typ.n} jours notés en entier.`, rows: mealRows } : null,
      barsOf(byBars('meal')),
    ].filter((x): x is Sec => x !== null),
  };
  const links: More = {
    t: 'Ses habitudes et leurs liens', sym: 'flower', tint: 'ti-sage', line: 'Ce qui semble aller ensemble', key: link ? '1 lien se dessine' : 'Aucun lien net',
    bul: [link ? `${disc.link!.phrase} À rapprocher, sans conclure.` : assoc.enough ? 'Aucun lien net entre ses journées et ses nuits pour l’instant.' : 'Il faut davantage de nuits notées pour chercher des liens.', 'Bain et rituels : pas encore notés.'],
    sec: [
      { q: 'Ses journées et ses nuits', ph: link ? 'À rapprocher, sans conclure : une association n’est pas une cause.' : 'Rien de net : ce n’est pas un défaut, seulement ce que le journal permet de voir.', st: link ? 'tendance' : 'pas', base: link ? `${link.n} soirs.` : '', rows: link ? [['Ce qui semble aller ensemble', disc.link!.phrase.replace(/^Les jours où /, '')].map((x, i) => (i ? x : 'Lien'))].map((r) => ({ k: r[0]!, v: r[1]! })) : [] },
      { q: 'Bain et rituels', ph: 'Ces moments ne sont pas notés : il n’y a rien à calculer.', st: 'pas', base: '', rows: [{ k: 'Bain', v: 'Pas encore noté' }, { k: 'Rituel du coucher', v: 'Pas encore noté' }] },
    ],
  };
  const more: Record<MoreId, More> = { sleep, naps, food, links, day: moreDay, night: moreNight };

  // ---- situation de Filou : enregistrée, puis estimée (jamais déduite sans données)
  let situation: Situation = 'awake';
  const lastEnd = Math.max(-Infinity, ...tl.sleeps.map((z) => z.b));
  const lastEvent = Math.max(-Infinity, ...tl.events.map((e) => Math.max(e.a, e.b ?? 0)));
  if (input.run !== null) {
    const since = input.nowMin - input.run;
    situation = since < 15 ? 'fell' : isNapStart(input.run) ? 'nap' : 'night';
  } else if (Number.isFinite(lastEnd) && input.nowMin - lastEnd < 10) situation = 'woke';
  else if (!Number.isFinite(lastEvent) || input.nowMin - lastEvent > 18 * 60) situation = 'none';
  else if (m.nextSleep.window && !m.nextSleep.abstained && m.nextSleep.reliability.n >= 3 && nowMs <= m.nextSleep.window.to && m.nextSleep.window.from - nowMs <= 30 * 60_000) situation = 'approach';

  const bubbles = ['wake', 'bed', ...Object.keys(disc).filter((k) => k.startsWith('nap'))].filter((k) => disc[k]);
  return { ok, situation, tiles, basis, day, night: nightF, lastDayLine, disc, keeps, embKeys, ch, more, bubbles };
}
