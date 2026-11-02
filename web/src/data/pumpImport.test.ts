import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newPumpsOnly, parsePumpFile } from './pumpImport';

const csv = readFileSync(join(__dirname, '__fixtures__', 'tirages-synthetiques.csv'), 'utf8');

describe('import tire-lait', () => {
  it('lit un export CSV au format de l’ancienne app (64 tirages synthétiques)', () => {
    const r = parsePumpFile(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(64);
    const first = r.rows[0];
    expect(first?.left_ml).toBe(70);
    expect(first?.right_ml).toBe(40);
    expect(new Date(first?.at ?? '').getHours()).toBe(2);
    expect(new Date(first?.at ?? '').getMinutes()).toBe(10);
  });

  it('lit une sauvegarde JSON de l’ancienne app', () => {
    const r = parsePumpFile(JSON.stringify([{ id: 'abc-1', at: '2025-03-03T02:10', left: 70, right: 40 }]));
    expect(r.ok && r.rows[0]?.legacy_id).toBe('abc-1');
  });

  it('refuse un fichier invalide avec un message lisible', () => {
    expect(parsePumpFile('coucou')).toMatchObject({ ok: false });
    expect(parsePumpFile('[{"id":"x","at":"hier","left":1,"right":1}]')).toMatchObject({ ok: false });
    expect(parsePumpFile('[{"id":"x","at":"2025-03-03T02:10","left":-5,"right":1}]')).toMatchObject({ ok: false });
    const bad = parsePumpFile('date;heure;gauche_ml;droit_ml;total_ml\n2025-03-03;02:10;abc;40;40');
    expect(bad).toMatchObject({ ok: false });
    expect(!bad.ok && bad.error).toContain('Ligne 2');
  });

  it('ne compte pas deux fois : même fichier importé deux fois, ou CSV puis JSON du même carnet', () => {
    const r = parsePumpFile(csv);
    if (!r.ok) throw new Error('csv');
    expect(newPumpsOnly([], r.rows)).toHaveLength(64);
    expect(newPumpsOnly(r.rows, parsePumpFile(csv).ok ? (parsePumpFile(csv) as { rows: typeof r.rows }).rows : [])).toHaveLength(0);
    const json = parsePumpFile(JSON.stringify([{ id: 'zz9', at: '2025-03-03T02:10', left: 70, right: 40 }]));
    if (!json.ok) throw new Error('json');
    expect(newPumpsOnly(r.rows, json.rows)).toHaveLength(0);
  });

  it('garde deux tirages identiques à la même minute dans un même fichier', () => {
    const r = parsePumpFile('date;heure;gauche_ml;droit_ml;total_ml\n2025-03-03;02:10;70;40;110\n2025-03-03;02:10;70;40;110');
    expect(r.ok && r.rows).toHaveLength(2);
    expect(r.ok && newPumpsOnly([], r.rows)).toHaveLength(2);
  });
});
