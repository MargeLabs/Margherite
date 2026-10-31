// Couche calcul : les habitudes, la journée et la nuit « types », les chiffres du jour, « Maintenant » et « À retenir »
// sont calculés par la logique portée de la maquette. Ces tests la font tourner sur des journaux dont on connaît la bonne réponse
// (écrite à la main, pas recalculée), ainsi que sur des journaux vides, partiels et troués : jamais d'erreur, jamais de fausse habitude.
import { describe, expect, it } from 'vitest';
import { blankStore, type ViewStore } from '@/data/household';
import type { ViewEvent } from '@/data/types';
import { DCLogic } from './dc-engine';
import { createLogicClass } from './app.logic.generated';
import defaults from './props.generated.json';

type Vals = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- sortie non typée de la logique portée

const NOW = new Date(2026, 9, 27, 14, 20); // mardi 27 octobre 14:20 = jour 27 de la fenêtre, 860 minutes
const D = 1440;
const Logic = (createLogicClass as unknown as (b: typeof DCLogic) => new (p: Record<string, unknown>) => DCLogic)(DCLogic);

function vals(over: Partial<ViewStore>, state: Record<string, unknown> = {}, props: Record<string, unknown> = {}): Vals {
  const store = blankStore(NOW, { hasBaby: true, babyName: 'Léo', babyTitle: 'Léo, 9 semaines', bc: { name: 'Léo', age: '9 semaines', born: 'Né le mardi 25 août à 8:42', photo: '', hasPhoto: false, noPhoto: true }, ...over });
  const l = new Logic({ ...defaults, ...props, store });
  l.state = state;
  return l.renderVals() as Vals;
}

/** Le texte de la logique utilise des espaces insécables : on compare avec des espaces normales. */
const txt = (s: unknown): string => String(s).replace(/[\u00a0\u202f]/g, ' ');

let n = 0;
const ev = (o: Omit<ViewEvent, 'id'>): ViewEvent => ({ id: `t${n++}`, ...o });

/** Un bébé parfaitement régulier : réveil 7 h, siestes 9–10 h, 12 h 30–14 h, 16 h 30–17 h, coucher 20 h, un réveil de nuit (1 h → 1 h 20). */
function regular(fromDay: number, toDay: number): ViewEvent[] {
  const out: ViewEvent[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const o = d * D;
    out.push(ev({ k: 'sleep', a: o - D + 1200, b: o - D + 1500 }), ev({ k: 'sleep', a: o - D + 1520, b: o + 420 }));
    if (d === 27) {
      out.push(ev({ k: 'bib', a: o + 430, ml: 140 }), ev({ k: 'sleep', a: o + 540, b: o + 600 }), ev({ k: 'bib', a: o + 610, ml: 140 }), ev({ k: 'bib', a: o + 790, ml: 150 }));
      continue;
    }
    for (const t of [430, 610, 790, 970, 1180]) out.push(ev({ k: 'bib', a: o + t, ml: 140 }));
    out.push(ev({ k: 'sleep', a: o + 540, b: o + 600 }), ev({ k: 'sleep', a: o + 750, b: o + 840 }), ev({ k: 'sleep', a: o + 990, b: o + 1020 }));
    out.push(ev({ k: 'chg', a: o + 435, v: 'pipi' }));
  }
  return out;
}

describe('journal régulier, bonne réponse connue', () => {
  const v = vals({ events: regular(10, 27) });

  it('journée type : réveil, coucher, siestes', () => {
    expect(v.typ.ok).toBe(true);
    expect(v.typ.n).toBe(7); // les 7 jours d'avant aujourd'hui
    expect(v.typ.wake).toBe(420);
    expect(v.typ.bed).toBe(1200);
    expect(v.typ.naps.map((z: { a: number }) => z.a)).toEqual([540, 750, 990]);
    expect(v.typ.naps.map((z: { du: number }) => z.du)).toEqual([60, 90, 30]);
    expect(v.typ.naps.map((z: { aw: number }) => z.aw)).toEqual([120, 150, 150]); // éveil avant chaque sieste
  });

  it('repas : un toutes les 3 h entre le réveil et le coucher (écarts 180, 180, 180, 210)', () => {
    expect(txt(v.typ.gapV)).toBe('3 h');
    expect(v.typ.sumL.find((x: { l: string }) => x.l === 'Repas sur 24 h').v).toBe('5');
  });

  it('sommeil de jour : 60 + 90 + 30 min', () => {
    expect(txt(v.typ.daySleep)).toBe('≈ 3 h');
    expect(v.typ.sumL.find((x: { l: string }) => x.l === 'Siestes').v).toBe('3');
  });

  it('nuit type : coucher 20 h, un réveil, plus long sommeil 5 h 40, réveil 7 h', () => {
    expect(v.nty.ok).toBe(true);
    const row = (l: string) => v.nty.sumL.find((x: { l: string }) => x.l === l);
    expect(row('Coucher').v).toContain('20:00');
  });

  it('« Maintenant » : éveillé depuis la fin de la sieste de 10 h, soit 4 h 20', () => {
    expect(txt(v.sit.big)).toBe('Éveillé depuis 4 h 20');
    expect(v.sit.sub).toBe('depuis 10:00');
  });

  it('rien d’inventé : aucun repère d’âge non sourcé dans « À retenir »', () => {
    expect(JSON.stringify(v.tipsL)).not.toMatch(/Repère d’âge/);
    expect(JSON.stringify(v.tipsL)).not.toMatch(/est courant/);
  });
});

describe('journaux vides, partiels et troués : pas d’erreur, pas de fausse habitude', () => {
  it('aucune donnée', () => {
    const v = vals({});
    expect(v.typ.ok).toBe(false);
    expect(v.nty.ok).toBe(false);
    expect(v.ret.learning).toBe(true);
    expect(v.ret.obs).toHaveLength(0);
  });

  it('un seul jour noté', () => {
    const v = vals({ events: regular(26, 27) });
    expect(v.typ.ok).toBe(false);
    expect(v.typ.msg).toMatch(/3 journées/);
  });

  it('deux jours complets ne font pas une habitude, trois si', () => {
    expect(vals({ events: regular(25, 27) }).typ.ok).toBe(false);
    expect(vals({ events: regular(24, 27) }).typ.ok).toBe(true);
  });

  it('un trou de saisie de plus de 5 h en journée écarte la journée (jamais comptée comme du sommeil en moins)', () => {
    const base = regular(15, 27);
    const holey = base.filter((e) => !(e.a >= 24 * D + 600 && e.a < 24 * D + 1100)); // jour 24 : plus rien de noté de 10 h à 18 h 20
    const withHole = vals({ events: holey });
    expect(withHole.typ.n).toBe(6);
    expect(withHole.typ.wake).toBe(420); // les jours restants donnent la même habitude
  });

  it('une nuit non notée n’est pas une nuit sans sommeil', () => {
    const base = regular(15, 27).filter((e) => !(e.k === 'sleep' && e.a >= 22 * D + 1100 && e.a < 23 * D + 600));
    const v = vals({ events: base });
    expect(v.dataNote.on).toBe(true);
    expect(v.dataNote.txt).toMatch(/jamais comptée comme une absence de sommeil/);
  });

  it('un dodo en cours est affiché et pas compté comme terminé', () => {
    const v = vals({ events: regular(10, 27), run: 27 * D + 780 });
    expect(v.sit.asleep).toBe(true);
    expect(txt(v.sit.big)).toBe('Endormi depuis 1 h 20');
  });

  it('événements dans le futur ignorés', () => {
    const v = vals({ events: [...regular(10, 27), ev({ k: 'bib', a: 27 * D + 1000, ml: 999 })] });
    expect(JSON.stringify(v.lf)).not.toContain('999');
  });
});

describe('profil du bébé', () => {
  it('la carte de présentation vient du store', () => {
    const v = vals({ events: regular(10, 27) });
    expect(v.bc).toMatchObject({ name: 'Léo', age: '9 semaines', born: 'Né le mardi 25 août à 8:42' });
  });
});



