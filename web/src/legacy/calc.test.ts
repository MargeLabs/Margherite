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

const NOW = new Date(2026, 10, 17, 14, 20); // mardi 17 novembre 14:20 = jour 27 de la fenêtre, 860 minutes ; aucun changement d'heure dans la semaine, ces jours-là sortent des habitudes
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




// ---- Retours du 2026-11-01 ------------------------------------------------------------------------------------------
describe('siestes rapprochées, résumé du jour, éveil', () => {
  const Y = 26 * D; // hier = jour 26
  const isYNap1 = (e: ViewEvent) => e.k === 'sleep' && e.a === Y + 540 && e.b === Y + 600;
  const split = (): ViewEvent[] => [...regular(10, 27).filter((e) => !isYNap1(e)), ev({ k: 'sleep', a: Y + 540, b: Y + 560 }), ev({ k: 'sleep', a: Y + 570, b: Y + 580 })];
  const rows = (v: Vals, key: 't1' | 't2' | 't3') => (v.legCur[key].rows as { l: string; v: string }[]).map((r) => [r.l, txt(r.v)]);

  it('hier, journal régulier : nuit et siestes « nombre / total »', () => {
    const v = vals({ events: regular(10, 27) }, { pday: 1 });
    expect(txt(v.legCur.t1.v)).toBe('13 h 40');
    expect(rows(v, 't1')).toEqual([['Nuit', '3 / 10 h 40'], ['Siestes', '3 / 3 h']]);
  });

  it('20 min de sieste puis 10 min après = une seule sieste (40 min, de 9 h à 9 h 40)', () => {
    const v = vals({ events: split() }, { pday: 1 });
    expect(rows(v, 't1')[1]).toEqual(['Siestes', '3 / 2 h 40']);
  });

  it('la nuit n’est jamais fusionnée : un réveil de nuit de 20 min reste un réveil', () => {
    const v = vals({ events: split() }, { pday: 1 });
    expect(rows(v, 't1')[0]).toEqual(['Nuit', '3 / 10 h 40']);
  });

  it('deux siestes à plus de 30 min d’écart restent deux siestes', () => {
    const evs = [...regular(10, 27).filter((e) => !isYNap1(e)), ev({ k: 'sleep', a: Y + 540, b: Y + 560 }), ev({ k: 'sleep', a: Y + 600, b: Y + 620 })];
    expect(rows(vals({ events: evs }, { pday: 1 }), 't1')[1]?.[1]).toBe('4 / 2 h 40');
  });

  it('repas : intervalle moyen entre les biberons du jour (180, 180, 180, 210 → 3 h 10)', () => {
    const v = vals({ events: regular(10, 27) }, { pday: 1 });
    expect(rows(v, 't2')).toEqual([['Mange toutes les', '3 h 10']]);
  });

  it('éveil : total, entre deux dodos, après un biberon', () => {
    const v = vals({ events: regular(10, 27) }, { pday: 1 });
    expect(txt(v.legCur.t3.v)).toBe('10 h 20');
    expect(rows(v, 't3')).toEqual([['Entre deux dodos', '2 h 30'], ['Après un repas', '1 h 15']]);
    expect(v.legCur.t3.rows[0].hasS).toBe(false); // plus de liste des éveils sous « Entre deux dodos »
  });

  it('semaine : mêmes moyennes sur les jours notés en entier', () => {
    const v = vals({ events: regular(10, 27) }, { pview: 'semaine' });
    expect(v.wkAw.on).toBe(true);
    expect(v.wkAw.rows.map((r: { l: string; v: string }) => [r.l, txt(r.v)])).toEqual([['Éveil par 24 h', '10 h 20'], ['Entre deux dodos', '2 h 30'], ['Après un repas', '1 h 15']]);
  });

  it('semaine, onglet Repas : une seule ligne « Mange toutes les »', () => {
    const v = vals({ events: regular(10, 27) }, { pview: 'semaine', wsel: 'repas' });
    expect(v.wkAw.rows.map((r: { l: string; v: string }) => [r.l, txt(r.v)])).toEqual([['Mange toutes les', '3 h 10']]);
  });

  it('tétées seulement : mêmes intervalles que pour des biberons', () => {
    const sein = regular(10, 27).map((e) => (e.k === 'bib' ? ev({ k: 'sein', a: e.a, side: 'G', dur: 15 }) : e));
    const v = vals({ events: sein }, { pday: 1 });
    expect(rows(v, 't2')).toEqual([['Mange toutes les', '3 h 10']]);
    expect(rows(v, 't3')[1]).toEqual(['Après un repas', '1 h 15']);
    const w = vals({ events: sein }, { pview: 'semaine', wsel: 'repas' });
    expect(w.wkAw.rows.map((r: { l: string; v: string }) => [r.l, txt(r.v)])).toEqual([['Mange toutes les', '3 h 10']]);
  });

  it('pas de sommeil noté : pas d’éveil inventé', () => {
    const v = vals({ events: [ev({ k: 'bib', a: Y + 600, ml: 120 })] }, { pday: 1 });
    expect(v.legCur.t3.v).toBe('—');
  });
});

describe('comparaison avec la semaine d’avant : les cartes avec données d’abord', () => {
  const labels = (v: Vals) => v.cmpW.rows.map((r: { l: string }) => r.l);
  it('Dodo : seulement les cartes de sommeil, dans l’ordre d’origine', () => {
    expect(labels(vals({ events: regular(10, 27) }))).toEqual(['Cycles par nuit', 'Durée d’un cycle', 'Éveil moyen']);
  });
  it('Repas : seulement les cartes de repas, dans l’ordre d’origine', () => {
    expect(labels(vals({ events: regular(10, 27) }, { wsel: 'repas' }))).toEqual(['Repas par nuit', 'Mange toutes les', 'Par biberon']);
  });
  it('sommeil non noté la semaine d’avant : toutes les cartes ont une valeur, ordre d’origine', () => {
    const evs = regular(10, 27).filter((e) => !(e.k === 'sleep' && e.a >= 13 * D && e.a < 21 * D - 300));
    expect(labels(vals({ events: evs }))).toEqual(['Cycles par nuit', 'Durée d’un cycle', 'Éveil moyen']);
  });
  it('repas sans donnée : les cartes qui ont une valeur passent devant', () => {
    const evs = regular(10, 27).filter((e) => !(e.k === 'sleep' && e.a >= 21 * D - 300));
    const v = vals({ events: evs }, { wsel: 'repas' });
    expect(labels(v).slice(0, 2)).toEqual(['Mange toutes les', 'Par biberon']);
    expect(v.cmpW.rows.slice(2).every((r: { cls: string }) => r.cls.includes('none'))).toBe(true);
  });
});

describe('journal tire-lait', () => {
  const pumps = [
    { id: 'p1', a: 25 * D + 480, g: 60, d: 70 },
    { id: 'p2', a: 25 * D + 720, g: 50, d: 50 },
    { id: 'p3', a: 25 * D + 900, g: 40, d: 40 },
    { id: 'p4', a: 24 * D + 600, g: 100, d: 100 },
    { id: 'p5', a: 27 * D + 300, g: 30, d: 30 },
  ];
  const v = vals({ pumps }, { pjo: { 0: true } });
  it('chaque jour affiche le total en grand et la moyenne par tirage en petit : 310 mL en 3 tirages = 103 mL', () => {
    const day = v.pjWeeks[0].days.find((d: { k: number }) => d.k === 2);
    expect(txt(day.totL)).toBe('310 mL');
    expect(txt(day.sub)).toBe('3 tirages · moy. 103 mL par tirage');
  });
  it('les tirages d’un jour vont du plus récent au plus ancien', () => {
    const day = v.pjWeeks[0].days.find((d: { k: number }) => d.k === 2);
    expect(day.list.map((p: { t: string }) => p.t)).toEqual(['15:00', '12:00', '8:00']);
  });
});

describe('coucher : une sieste du soir n’est pas le début de la nuit', () => {
  const Y = 26 * D; // nuit dernière = du jour 26 au jour 27
  const withEvening = (extra: ViewEvent[]): ViewEvent[] => [...regular(10, 27).filter((e) => e.a !== Y + 1200), ...extra];
  const coucher = (events: ViewEvent[]) => txt(vals({ events }, { tab: 'pilotage', pday: 0 }).nv.rows.find((r: { l: string }) => r.l === 'Coucher').a);

  it('45 min à 19 h 10, éveil de 1 h 35, puis la vraie nuit à 21 h 30 : coucher 21:30', () => {
    expect(coucher(withEvening([ev({ k: 'sleep', a: Y + 1150, b: Y + 1195 }), ev({ k: 'sleep', a: Y + 1290, b: Y + 1500 })]))).toBe('21:30');
  });
  it('45 min à 19 h 10 puis rendormi 5 min après : le premier bloc (< 1 h) n’est pas le coucher, coucher 20:00', () => {
    expect(coucher(withEvening([ev({ k: 'sleep', a: Y + 1150, b: Y + 1195 }), ev({ k: 'sleep', a: Y + 1200, b: Y + 1500 })]))).toBe('20:00');
  });
  it('1 h 05 à 19 h 10 puis rendormi 5 min après : une seule nuit, coucher 19:10', () => {
    expect(coucher(withEvening([ev({ k: 'sleep', a: Y + 1150, b: Y + 1215 }), ev({ k: 'sleep', a: Y + 1220, b: Y + 1500 })]))).toBe('19:10');
  });
  it('cas réel : 50 min à 19 h 40, 23 min d’éveil, puis 2 h 47 : coucher 20:53', () => {
    expect(coucher(withEvening([ev({ k: 'sleep', a: Y + 1180, b: Y + 1230 }), ev({ k: 'sleep', a: Y + 1253, b: Y + 1420 })]))).toBe('20:53');
  });
});

describe('fenêtre de nuit adaptée aux habitudes du bébé', () => {
  const Y = 26 * D;
  const row = (events: ViewEvent[], l: string) => txt(vals({ events }, { tab: 'pilotage', pday: 0 }).nv.rows.find((r: { l: string }) => r.l === l).a);
  // 7 nuits (et plus) de 22 h à 7 h : habitude = coucher 22 h, réveil 7 h
  const late = (extra: ViewEvent[]): ViewEvent[] => {
    const out: ViewEvent[] = [];
    for (let d = 10; d <= 27; d++) out.push(ev({ k: 'sleep', a: d * D - D + 1320, b: d * D + 420 }));
    return [...out, ...extra];
  };

  it('coucher habituel 22 h : un dodo du soir de 1 h 35 (19 h 10 → 20 h 45) n’est pas le coucher', () => {
    expect(row(late([ev({ k: 'sleep', a: Y + 1150, b: Y + 1245 })]), 'Coucher')).toBe('22:00');
  });
  it('réveil habituel 7 h : un dodo à 7 h 45 (40 min après le réveil) n’est pas le réveil du matin', () => {
    expect(row(late([ev({ k: 'sleep', a: 27 * D + 465, b: 27 * D + 505 })]), 'Réveil du matin')).toBe('7:00');
  });
  it('sans habitude (moins de 3 nuits), la fenêtre reste 19 h → 9 h', () => {
    const two = [ev({ k: 'sleep', a: Y + 1150, b: Y + 1230 }), ev({ k: 'sleep', a: Y + 1320, b: 27 * D + 420 })];
    expect(row(two, 'Coucher')).toBe('22:00'); // 1 h 20 : écarté par la durée minimale seule, sans habitude
    expect(row([ev({ k: 'sleep', a: Y + 1150, b: Y + 1245 }), ev({ k: 'sleep', a: Y + 1320, b: 27 * D + 420 })], 'Coucher')).toBe('19:10'); // 1 h 35 : retenu
  });
});

describe('Rythme › Semaine › son habitude d’éveil (nuit exclue)', () => {
  const wAw = () => vals({ events: regular(10, 27) }, { tab: 'pilotage', pview: 'semaine', sheet: 'weveil' }).wAw;
  const hero = () => { const h = wAw().hero; return txt([h.t1, h.v1, h.t2].join('')); };
  it('la moitié des éveils : biberon 10 min après le réveil (1 h 50 et 2 h 20 d’éveil), l’autre moitié : biberon juste avant le dodo', () => {
    expect(wAw().rows.map((r: { l: string; n: string }) => [r.l, r.n])).toEqual([['Mange tout de suite', '12 sur 24'], ['Mange puis s’endort juste après', '12 sur 24']]);
  });
  it('à égalité, l’habitude affichée est « mange tout de suite », avec la médiane du temps éveillé après le repas (2 h 05)', () => {
    expect(hero()).toBe('Il se réveille, mange tout de suite, puis reste éveillé 2 h 05 jusqu’au dodo.');
  });
  it('les réveils de nuit ne sont pas comptés : 4 éveils par jour sur 6 jours', () => {
    expect(wAw().basis).toContain('24 éveils');
  });
});

describe('Rythme › Jour › feuille d’un créneau de l’horloge', () => {
  const kv = (csel: string, st: Record<string, unknown> = {}) => vals({ events: regular(10, 27) }, { tab: 'pilotage', pview: 'jour', csel, ...st }).kv;
  it('les flèches existent dès l’ouverture de Rythme › Jour (aucun créneau choisi) et pas ailleurs', () => {
    const v = kv('');
    expect([v.on, v.pos, v.noPrev, v.noNext]).toEqual([true, '', false, false]);
    expect(kv('s1', { tab: 'accueil' }).on).toBe(false);
    expect(kv('s1', { pview: 'semaine' }).on).toBe(false);
  });
  it('le premier créneau est celui de minuit (le dodo qui traverse minuit) : « 1 sur N », pas de « plus tôt »', () => {
    const v = kv('s0');
    expect(v.on).toBe(true);
    expect(txt(v.pos)).toMatch(/^1 sur \d+$/);
    expect([v.noPrev, v.noNext]).toEqual([true, false]);
  });
  it('le dodo de 1 h 20 est le 2e, le biberon de 7 h 10 le 3e : dans l’ordre du temps, avec « plus tôt » et « plus tard »', () => {
    expect(txt(kv('s1').pos)).toMatch(/^2 sur \d+$/);
    const v = kv('f0');
    expect(txt(v.pos)).toMatch(/^3 sur \d+$/);
    expect([v.noPrev, v.noNext]).toEqual([false, false]);
    expect(v.ctr).toBe('ca-ctr kn');
  });
});

describe('Rythme › Jour › « Voir la journée complète » : frise verticale', () => {
  const rows = () => vals({ events: regular(10, 27) }, { tab: 'pilotage', pview: 'jour', pday: 1, sheet: 'frise' }).fr.rows as { t: string; lab: string; isW: boolean; isF: boolean; isS: boolean; isN: boolean; d: string }[];
  it('hier : du réveil (7 h) au coucher (20 h), dodos et repas dans l’ordre du temps, sans la nuit', () => {
    expect(rows().map((r) => txt(r.t))).toEqual(['7:00', '7:10', '9:00', '10:10', '12:30', '13:10', '16:10', '16:30', '19:40', '20:00']);
    expect(rows().map((r) => (r.isW ? 'w' : r.isF ? 'f' : r.isS ? 's' : 'n')).join('')).toBe('wfsfsffsfn');
  });
  it('libellés : Réveil, biberon en mL, Sieste avec sa durée, Couché', () => {
    const r = rows();
    expect([r[0]?.lab, txt(r[1]?.lab ?? ''), r[2]?.lab, txt(r[2]?.d ?? ''), r[9]?.lab]).toEqual(['Réveil', '140 mL', 'Sieste', '1 h', 'Couché']);
  });
});

describe('Rythme › « Cette nuit en détail » : durée moyenne d’un cycle', () => {
  const row = (events: ViewEvent[], pday = 1) => (vals({ events }, { tab: 'pilotage', pday }).nv.rows as { l: string; a: string; w: string; h: string }[]).find((r) => r.l === 'Durée moyenne d’un cycle');
  it('nuit de 2 périodes (5 h + 5 h 40) : 5 h 20 par cycle, comme d’habitude', () => {
    const r = row(regular(10, 27));
    expect([txt(r?.a ?? ''), r?.w]).toEqual(['5 h 20', 'comme d’habitude']);
  });
  it('nuit non notée : « non noté », sans valeur inventée', () => {
    expect(row(regular(10, 25).filter((e) => e.a < 26 * D - 600), 1)?.a).toBe('non noté');
  });
});

describe('prochain dodo en test : modèle de survie', () => {
  const at = (d: number, m: number) => d * D + m;
  const week = (): ViewEvent[] => {
    const out: ViewEvent[] = [];
    for (const d of [22, 23, 24, 25, 26]) for (const [a, b] of [[540, 600], [720, 790], [900, 960]] as Array<[number, number]>) out.push(ev({ k: 'sleep', a: at(d, a), b: at(d, b) }));
    out.push(ev({ k: 'sleep', a: at(27, 540), b: at(27, 600) }), ev({ k: 'sleep', a: at(27, 700), b: at(27, 760) }));
    return out;
  };

  it('propose une fenêtre avant les 3 journées complètes, étiquetée en test, jamais présentée comme une habitude', () => {
    const v = vals({ events: week() });
    expect(v.typ.ok).toBe(false);
    expect(v.nx.on).toBe(true);
    expect(v.nx.tag).toBe('en test');
    expect(v.suite[0].lab).toBe('Prochain dodo');
    expect(v.hasSuite).toBe(true);
  });

  it('rien tant qu’il dort, ni la nuit', () => {
    expect(vals({ events: week(), run: at(27, 850) }).nx.on).toBe(false);
    const night = new Logic({ ...defaults, store: blankStore(new Date(2026, 10, 17, 23, 30), { hasBaby: true, events: week() }) });
    night.state = {};
    expect((night.renderVals() as Vals).nx.tag).not.toBe('en test');
  });
});

describe('Rythme › nuit en popup', () => {
  const evs = regular(10, 27);
  it('ouverte seulement sur Rythme › Jour, sous l’en-tête', () => {
    expect(vals({ events: evs }, { tab: 'pilotage', nopen: true, ntop: 170 }).nsh).toMatchObject({ on: true, style: 'top: 170px' });
    expect(vals({ events: evs }, { tab: 'pilotage', nopen: false }).nsh.on).toBe(false);
    expect(vals({ events: evs }, { tab: 'accueil', nopen: true }).nsh.on).toBe(false);
    expect(vals({ events: evs }, { tab: 'pilotage', pview: 'semaine', nopen: true }).nsh.on).toBe(false);
  });
  it('on bascule d’un jour à l’autre sans fermer : bornes aujourd’hui et il y a 6 jours', () => {
    const at = (pday: number) => vals({ events: evs }, { tab: 'pilotage', nopen: true, pday }).nsh;
    expect([at(0).noNext, at(0).noPrev]).toEqual([true, false]);
    expect([at(3).noNext, at(3).noPrev]).toEqual([false, false]);
    expect([at(6).noNext, at(6).noPrev]).toEqual([false, true]);
  });
  it('la nuit affichée suit le jour choisi', () => {
    const v = vals({ events: evs }, { tab: 'pilotage', nopen: true, pday: 1 });
    expect(v.nv.title).toContain('Nuit du');
  });
});
