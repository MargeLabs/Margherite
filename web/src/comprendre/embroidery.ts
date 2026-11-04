// Les broderies : une découverte solide (« se dessine » ou « constaté ») est cousue une fois, à la première validation, puis gardée.
// Ni score, ni compteur, ni série : une habitude qui disparaît passe en « Avant » au lieu d'être retirée. Les souvenirs cousus à la main
// (cousu par le parent) ne dépendent d'aucune donnée.
import { stampLabel, type CmpModel, type MoreId, type StKey, type Tint } from './model';

export interface EmbEntry {
  key: string;
  /** moment de la première validation (ms) */
  at: number;
  phrase: string;
  sym: string;
  tint: Tint;
  st: StKey;
  hand?: boolean;
  hidden?: boolean;
  /** pour un souvenir cousu à la main : la date écrite par le parent */
  date?: string;
  more?: MoreId;
}

export interface EmbView {
  key: string;
  phrase: string;
  sym: string;
  tint: Tint;
  st: StKey;
  base: string;
  sub: string;
  hand: boolean;
  hidden: boolean;
  /** vrai si la habitude est encore d'actualité (ou si c'est un souvenir à la main) */
  active: boolean;
  note?: string;
  more?: MoreId;
}

const SOLID: StKey[] = ['constate', 'dessine', 'tendance'];

/** Ajoute les broderies qui viennent de se valider. Ne retire jamais rien. */
export function mergeEmb(stored: EmbEntry[], model: CmpModel, now: number): { list: EmbEntry[]; fresh: string[] } {
  const have = new Set(stored.map((e) => e.key));
  const fresh: string[] = [];
  const added: EmbEntry[] = [];
  for (const key of model.embKeys) {
    const d = model.disc[key];
    if (!d || have.has(key) || !SOLID.includes(d.st)) continue;
    added.push({ key, at: now, phrase: d.phrase, sym: d.sym, tint: d.tint, st: d.st, ...(d.more ? { more: d.more } : {}) });
    fresh.push(key);
  }
  return { list: added.length ? [...added, ...stored] : stored, fresh };
}

/** Ce que l'album affiche : l'état actuel si l'habitude tient encore, sinon son souvenir. */
export function resolveEmb(stored: EmbEntry[], model: CmpModel): EmbView[] {
  return stored
    .slice()
    .sort((a, b) => b.at - a.at)
    .map((e): EmbView => {
      if (e.hand) return { key: e.key, phrase: e.phrase, sym: e.sym, tint: e.tint, st: 'main', base: `Cousu le ${e.date ?? stampLabel(e.at)}`, sub: `Cousu le ${e.date ?? stampLabel(e.at)}`, hand: true, hidden: !!e.hidden, active: true };
      const cur = model.disc[e.key];
      if (cur && SOLID.includes(cur.st)) {
        const lab = cur.st === 'constate' ? 'Constaté' : cur.st === 'dessine' ? 'Se dessine' : 'Une tendance se dessine';
        return { key: e.key, phrase: cur.phrase, sym: cur.sym, tint: cur.tint, st: cur.st, base: cur.base, sub: `${lab} · ${stampLabel(e.at)}`, hand: false, hidden: !!e.hidden, active: true, ...(cur.more ? { more: cur.more } : {}) };
      }
      return { key: e.key, phrase: e.phrase, sym: e.sym, tint: e.tint, st: 'passe', base: `Cousue le ${stampLabel(e.at)} · cette habitude a changé.`, sub: `Habitude passée · cousue le ${stampLabel(e.at)}`, hand: false, hidden: !!e.hidden, active: false };
    });
}
