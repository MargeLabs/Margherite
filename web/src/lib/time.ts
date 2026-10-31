// Repère de temps de la maquette V5 : des « minutes depuis une origine ».
// L'origine est minuit (heure locale) d'il y a 27 jours : aujourd'hui = jour 27, la fenêtre glisse chaque jour.
// Les calculs de Comprendre, Pilotage et du Journal reposent sur ce repère ; on le garde tel quel.
//
// On compte en « heure murale » (ce que montre la pendule) : les jours sont toujours de 1440 minutes.
// Conséquence connue et acceptée : le jour du passage à l'heure d'été ou d'hiver, un dodo qui enjambe le changement
// est décalé d'une heure.

export const MIN_PER_DAY = 1440;
export const TODAY_INDEX = 27;

/** Minuit local du jour de `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Nombre de jours calendaires entre deux dates (heure locale), sans effet de l'heure d'été. */
export function calendarDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Origine de la fenêtre : minuit local, 27 jours avant `now`. */
export function originOf(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - TODAY_INDEX);
}

/** Minutes (heure murale) écoulées entre `origin` et `ts`. Peut être négatif avant la fenêtre. */
export function toMinutes(ts: Date, origin: Date): number {
  return calendarDays(origin, ts) * MIN_PER_DAY + ts.getHours() * 60 + ts.getMinutes();
}

/** Inverse de `toMinutes` : la date locale correspondant à `minutes` depuis `origin`. */
export function fromMinutes(minutes: number, origin: Date): Date {
  const day = Math.floor(minutes / MIN_PER_DAY);
  const inDay = minutes - day * MIN_PER_DAY;
  return new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() + day, Math.floor(inDay / 60), inDay % 60);
}

/** Texte « YYYY-MM-DD » (jour local) d'une date. */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
