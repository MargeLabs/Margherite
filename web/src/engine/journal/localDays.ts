// Couche 1, jours locaux : la frontière d'un jour est MINUIT DANS UN FUSEAU NOMMÉ (IANA), jamais « 24 h après le début ».
// Le jour du passage à l'heure d'été dure 23 h, celui de l'heure d'hiver 25 h. Une durée est toujours un écart réel entre deux instants (ms UTC) ;
// la « minute murale » (1440 par jour) est une vue des couches supérieures, pas une donnée du journal.
// Pur : aucun accès à l'heure courante. Le fuseau par défaut est celui de l'appareil (celui du foyer), lu par Intl, sans horloge.
// Limite : un fuseau dont minuit n'existe pas certains jours (changement d'heure à minuit) donne la première heure valide qui suit.

export const hostZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const MIN = 60_000;
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(ms: number, tz: string): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(tz, f);
  }
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(ms)) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year!, m: o.month!, d: o.day!, h: o.hour!, mi: o.minute!, s: o.second! };
}

/** Décalage du fuseau à cet instant, en minutes (Paris l'été : +120). */
export function offsetMin(ms: number, tz: string): number {
  const p = parts(ms, tz);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / MIN);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Jour civil local « AAAA-MM-JJ » de l'instant. */
export function dayOf(ms: number, tz: string = hostZone()): string {
  const p = parts(ms, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Instant (ms UTC) du minuit local qui ouvre le jour « AAAA-MM-JJ ». */
export function startOfDay(day: string, tz: string = hostZone()): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d);
  let t = wall - offsetMin(wall, tz) * MIN;
  const again = offsetMin(t, tz); // le décalage de minuit peut différer de celui de l'estimation : on corrige une fois
  if (wall - again * MIN !== t) t = wall - again * MIN;
  return t;
}

/** Le jour civil qui suit « AAAA-MM-JJ ». */
export function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export interface DayShare {
  day: string;
  /** début et fin réels de la part, dans ce jour (ms UTC) */
  from: number;
  to: number;
  /** minutes réellement écoulées dans ce jour (un jour d'heure d'hiver en compte jusqu'à 1500) */
  minutes: number;
}

/**
 * Découpe [start, end] aux minuits locaux : une nuit de 20 h à 7 h donne deux parts, une par jour civil. Aucun temps n'est perdu ni inventé :
 * la somme des parts est exactement `end - start`. Un intervalle vide ou inversé (end ≤ start) donne une seule part vide au jour de `start`.
 */
export function splitByDay(start: number, end: number, tz: string = hostZone()): DayShare[] {
  if (!(end > start)) return [{ day: dayOf(start, tz), from: start, to: start, minutes: 0 }];
  const out: DayShare[] = [];
  let day = dayOf(start, tz), from = start;
  while (from < end) {
    const boundary = startOfDay(nextDay(day), tz);
    const to = Math.min(end, boundary > from ? boundary : end);
    out.push({ day, from, to, minutes: (to - from) / MIN });
    from = to;
    day = nextDay(day);
  }
  return out;
}

/** Durée réelle du jour civil en minutes : 1440, 1380 (heure d'été) ou 1500 (heure d'hiver). */
export const dayLengthMin = (day: string, tz: string = hostZone()): number => (startOfDay(nextDay(day), tz) - startOfDay(day, tz)) / MIN;
