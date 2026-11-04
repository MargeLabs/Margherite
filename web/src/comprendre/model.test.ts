// Le modèle de la page Comprendre, sur les 28 jours d'exemple de la maquette (jour 27 = lundi 27 octobre 2026 à 10 h).
import { describe, expect, it } from 'vitest';
import { demoSnapshot } from '@/data/demo';
import { eventFromRow } from '@/data/mapping';
import { originOf, toMinutes } from '@/lib/time';
import { mergeEmb, resolveEmb, type EmbEntry } from './embroidery';
import { buildModel, dur, hm } from './model';

async function demoInput(now: Date, keep: (id: string) => boolean = () => true) {
  const origin = originOf(now);
  const { snapshot } = await demoSnapshot(origin);
  const events = snapshot.events.map((r) => eventFromRow(r, origin)).filter((e) => keep(e.id));
  const run = events.find((e) => e.k === 'sleep' && e.b === undefined)?.a ?? null;
  return { events, origin, nowMin: toMinutes(now, origin), run, birthAt: new Date(2026, 7, 25, 8, 42), babyName: 'Léo' };
}

describe('formats', () => {
  it('écrit les heures et les durées en toutes lettres courtes', () => {
    expect(hm(415)).toBe('6 h 55');
    expect(hm(480)).toBe('8 h');
    expect(dur(70)).toBe('1 h 10');
    expect(dur(50)).toBe('50 min');
    expect(dur(120)).toBe('2 h');
  });
});

describe('modèle de Comprendre sur le jeu d’exemple', () => {
  it('trouve une journée type, des repères et des frises', async () => {
    const m = buildModel(await demoInput(new Date(2026, 9, 27, 10, 0)));
    expect(m.ok).toBe(true);
    expect(m.tiles).toHaveLength(6);
    expect(m.tiles.every((t) => t.v !== '—')).toBe(true);
    expect(m.day?.caps.length).toBeGreaterThan(0);
    expect(m.day?.steps.some((s) => s.l === 'Coucher')).toBe(true);
    expect(m.night?.caps.length).toBeGreaterThan(0);
    // une frise reste dans ses bornes
    for (const c of [...(m.day?.caps ?? []), ...(m.night?.caps ?? [])]) {
      expect(c.l).toBeGreaterThanOrEqual(0);
      expect(c.l + c.w).toBeLessThanOrEqual(1.0001);
    }
  });

  it('chaque découverte garde sa base de calcul et ses points', async () => {
    const m = buildModel(await demoInput(new Date(2026, 9, 27, 10, 0)));
    expect(Object.keys(m.disc).length).toBeGreaterThan(0);
    for (const d of Object.values(m.disc)) {
      expect(d.base.length).toBeGreaterThan(0);
      expect(['constate', 'dessine', 'tendance', 'fragile']).toContain(d.st);
      // jamais « constaté » sur moins de 7 relevés
      if (d.st === 'constate' && d.flags.length) expect(d.flags.length).toBeGreaterThanOrEqual(7);
    }
  });

  it('sur trop peu de jours, il s’abstient au lieu d’inventer', async () => {
    const m = buildModel(await demoInput(new Date(2026, 9, 27, 10, 0), (id) => id.length === 0));
    expect(m.ok).toBe(false);
    expect(m.keeps).toHaveLength(0);
    expect(m.ch).toHaveLength(0);
    expect(m.tiles.every((t) => t.v === '—')).toBe(true);
  });
});

describe('broderies', () => {
  it('une habitude qui se valide est cousue une fois, puis gardée', async () => {
    const m = buildModel(await demoInput(new Date(2026, 9, 27, 10, 0)));
    const first = mergeEmb([], m, 1000);
    expect(first.list.length).toBe(m.embKeys.length);
    expect(first.fresh).toEqual(m.embKeys);
    const again = mergeEmb(first.list, m, 2000);
    expect(again.fresh).toEqual([]);
    expect(again.list).toBe(first.list);
  });

  it('une habitude disparue passe en « Avant » au lieu d’être retirée', async () => {
    const m = buildModel(await demoInput(new Date(2026, 9, 27, 10, 0)));
    const old: EmbEntry = { key: 'wake-ancien', at: 500, phrase: 'Il se réveillait vers 5 h 30.', sym: 'sun', tint: 'ti-but', st: 'constate' };
    const views = resolveEmb([old], m);
    expect(views[0]?.active).toBe(false);
    expect(views[0]?.st).toBe('passe');
  });
});
