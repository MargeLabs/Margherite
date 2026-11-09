// L'écran : une recommandation ne se confond jamais avec une prévision. On rend la logique portée de l'écran avec un moteur qui renvoie l'une ou l'autre
// et on lit tous les textes produits (carte « Prochain dodo », horloge, liste des créneaux, accessibilité).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankStore, viewData } from '@/data/household';
import { rawFromEvent } from '@/engine/adapters';
import { SCENARIOS, syntheticLog } from '@/engine/evaluation/synthetic';
import { createLogicClass } from './app.logic.generated';
import { DCLogic } from './dc-engine';
import defaults from './props.generated.json';

const Logic = (createLogicClass as unknown as (b: typeof DCLogic) => new (p: Record<string, unknown>) => DCLogic)(DCLogic);
const now = new Date(2026, 8, 20, 7, 10);

function texts(next: Record<string, unknown>): { nx: Record<string, string>; all: string[] } {
  const events = syntheticLog({ ...SCENARIOS.regulier!, from: new Date(2026, 8, 1), days: 20 }).filter((e) => e.start < now.getTime()).map((e) => (e.end && e.end > now.getTime() ? { ...e, end: undefined } : e));
  const snap = { baby: { id: 1, first_name: 'B', birth_at: new Date(2026, 5, 1).toISOString() }, events: events.map(rawFromEvent), pumps: [], kv: {} };
  const data = viewData(snap as never, { mine: {} }, now, false);
  const l = new Logic({ ...defaults, store: blankStore(now, { ...data, engine: { ...data.engine, bedtime: () => null, nextSleep: () => ({ a: 7 * 60 + 40, b: 8 * 60 + 30, measured: false, ...next }) as never } }) });
  l.state = {};
  const vals = l.renderVals() as Record<string, unknown>, all: string[] = [];
  const walk = (v: unknown, depth = 0): void => {
    if (depth > 6 || v === null || v === undefined || typeof v === 'function') return;
    if (typeof v === 'string') all.push(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
    else if (typeof v === 'object') Object.values(v as object).forEach((x) => walk(x, depth + 1));
  };
  walk(vals);
  return { nx: vals.nx as Record<string, string>, all };
}

describe('écran : prévision et recommandation', () => {
  it('une recommandation est étiquetée « indication » et dit « Plutôt vers », jamais « S’endort généralement vers »', () => {
    for (const confidence of ['low', 'medium', 'high']) {
      const { nx, all } = texts({ kind: 'recommendation', model: 'recommendation', confidence });
      expect(nx.lab).toBe('Prochain dodo · indication');
      expect(nx.tag).toBe('indication');
      expect(nx.win).toBe('Plutôt vers 7:40–8:30');
      // aucun texte de l'écran ne présente cette fenêtre comme une prévision (« estimé », « en test » ou la formule des habitudes)
      const own = all.filter((t) => t.includes('7:40–8:30'));
      expect(own.length).toBeGreaterThan(2);
      own.forEach((t) => {
        expect(t).not.toMatch(/généralement|estimé|en test/);
        expect(t).toMatch(/Plutôt vers/);
      });
    }
  });

  it('une prévision garde ses étiquettes, sans le vocabulaire de la recommandation', () => {
    const { nx, all } = texts({ kind: 'forecast', model: 'weighted7' });
    expect(nx.lab).toBe('Prochain dodo · en test');
    expect(nx.win).toBe('S’endort généralement vers 7:40–8:30');
    expect(all.filter((t) => /Plutôt vers|indication/.test(t))).toEqual([]);
  });

  // le centre de l'horloge (au toucher d'un créneau) et la phrase de la feuille « repas » ne se rendent qu'au clic : on garde le texte généré sous garde.
  // Une première version testait le libellé au lieu de l'étiquette : vu seulement au rendu réel (« Prochain dodo / S'endort généralement vers » pour une recommandation).
  it('le centre de l’horloge et la feuille « repas » parlent de recommandation d’après l’étiquette, pas d’après un libellé', () => {
    const src = readFileSync(join(__dirname, 'app.logic.generated.js'), 'utf8');
    expect(src).toContain("x.tag === 'indication' ? ' · indication\\nPlutôt vers' : '\\nS’endort généralement vers'");
    expect(src).toContain("wins[0].tag === 'indication' ? ' : plutôt vers' : ' : s’endort généralement vers'");
  });

  it('sans kind (moteur d’avant) : même rendu qu’une prévision', () => {
    const { nx } = texts({ model: 'weighted7' });
    expect(nx.win).toBe('S’endort généralement vers 7:40–8:30');
  });
});
