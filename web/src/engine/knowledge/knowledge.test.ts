import { describe, expect, it } from 'vitest';
import base from './data/base.json';
import { getReference, referenceFrom, validateBase, type KnowledgeBase, type ReferenceEntry } from './getReference';

const real = base as KnowledgeBase;
const src = real.sources[0]!;
const entry = (o: Partial<ReferenceEntry>): ReferenceEntry => ({ id: 'a', indicator: 'sleep_total_24h', unit: 'h', ageFrom: 0, ageTo: 90, feeding: 'all', range: { low: 10, high: 12, type: 'x' }, nature: 'reference_statistique', confidence: 'B', sourceIds: [src.id], status: 'publie', review: { by: 'test', on: '2026-11-02', version: '1' }, ...o });
const kb = (references: ReferenceEntry[]): KnowledgeBase => ({ schemaVersion: 1, baseVersion: 't', sources: [src], references });

describe('la base réelle', () => {
  it('est valide', () => {
    expect(validateBase(real)).toEqual([]);
  });

  it('seules les 3 entrées Paavonen 2020 sont publiées, sous dérogation tracée du propriétaire', () => {
    const pub = real.references.filter((x) => x.status === 'publie');
    expect(pub.map((x) => x.id).sort()).toEqual(['sleep-24h-paavonen-3m', 'sleep-24h-paavonen-6m', 'sleep-24h-paavonen-8m']);
    for (const x of pub) expect(x.review?.by).toMatch(/dérogation/);
    expect(real.references.filter((x) => x.status !== 'publie').every((x) => x.status === 'brouillon')).toBe(true);
  });

  it('hors des âges couverts ou pour un autre indicateur : rien', () => {
    for (const a of [0, 30, 60, 70, 120, 150, 300, 365]) expect(getReference('sleep_total_24h', a), String(a)).toBeNull();
    for (const i of ['nap_count', 'feeds_24h', 'bottle_ml_24h', 'wake_window', 'sleep_cycle'] as const) expect(getReference(i, 91)).toBeNull();
  });

  it('à 3 mois : plage, confiance C, limites et source qui voyagent', () => {
    expect(getReference('sleep_total_24h', 91)).toMatchObject({ range: { low: 10.9, high: 17.9 }, confidence: 'C', nature: 'reference_statistique', baseVersion: '0.3.0', sources: [{ id: 'paavonen-2020' }] });
    expect(getReference('sleep_total_24h', 91)?.limits[0]).toMatch(/questionnaire parental/);
  });

  it('chaque entrée a une source qualifiée et un point à vérifier ou des limites', () => {
    for (const e of real.references) expect(e.toCheck ?? e.limits, e.id).toBeTruthy();
    for (const s of real.sources) expect(s.read, s.id).toMatch(/resume|extrait|tables/);
  });

  it('aucun repère d’éveil, de cycle ou de volume n’a été inventé', () => {
    expect(real.references.filter((e) => ['wake_window', 'sleep_cycle', 'bottle_ml_24h', 'feeds_24h', 'nap_count'].includes(e.indicator))).toEqual([]);
  });
});

describe('getReference', () => {
  it('rend null sans âge, hors plage, pour un autre indicateur', () => {
    const b = kb([entry({})]);
    expect(referenceFrom(b, 'sleep_total_24h', null)).toBeNull();
    expect(referenceFrom(b, 'sleep_total_24h', 91)).toBeNull();
    expect(referenceFrom(b, 'nap_count', 30)).toBeNull();
  });

  it('rend plage, source, confiance et version', () => {
    expect(referenceFrom(kb([entry({})]), 'sleep_total_24h', 30)).toMatchObject({ range: { low: 10, high: 12 }, confidence: 'B', baseVersion: 't', sources: [{ id: src.id }] });
  });

  it('tranches qui se chevauchent : enveloppe et confiance la plus basse', () => {
    const r = referenceFrom(kb([entry({}), entry({ id: 'b', range: { low: 9, high: 11, type: 'x' }, confidence: 'C' })]), 'sleep_total_24h', 30);
    expect(r).toMatchObject({ range: { low: 9, high: 12 }, confidence: 'C' });
  });

  it('une recommandation et une statistique ne se mélangent jamais', () => {
    const r = referenceFrom(kb([entry({ nature: 'recommandation_medicale', range: { low: 14, high: 17, type: 'x' } }), entry({ id: 'b' })]), 'sleep_total_24h', 30);
    expect(r?.range).toEqual({ low: 14, high: 17 });
  });

  it('choisit l’entrée du mode d’alimentation', () => {
    const b = kb([entry({ feeding: 'bottle' })]);
    expect(referenceFrom(b, 'sleep_total_24h', 30, 'breast')).toBeNull();
    expect(referenceFrom(b, 'sleep_total_24h', 30, 'bottle')).not.toBeNull();
  });

  it('un brouillon, une entrée relue non publiée ou obsolète ne sortent pas', () => {
    for (const status of ['brouillon', 'relu', 'obsolete']) expect(referenceFrom(kb([entry({ status })]), 'sleep_total_24h', 30)).toBeNull();
  });
});

describe('validateur', () => {
  const err = (e: Partial<ReferenceEntry>) => validateBase(kb([entry(e)]));

  it('refuse une entrée sans source, plage ou âges invalides', () => {
    expect(err({ sourceIds: [] })).not.toEqual([]);
    expect(err({ sourceIds: ['inconnue'] })).not.toEqual([]);
    expect(err({ range: { low: 5, high: 2, type: 'x' } })).not.toEqual([]);
    expect(err({ ageFrom: 10, ageTo: 5 })).not.toEqual([]);
  });

  it('refuse une publication sans relecture, en confiance D, ou avec un doute', () => {
    expect(err({ review: undefined })).not.toEqual([]);
    expect(err({ confidence: 'D' })).not.toEqual([]);
    expect(err({ toCheck: 'x' })).not.toEqual([]);
  });

  it('refuse un volume au sein', () => {
    expect(err({ indicator: 'bottle_ml_24h', feeding: 'breast' })).not.toEqual([]);
  });

  it('une base invalide ou de schéma incompatible ne rend rien', () => {
    expect(referenceFrom({ ...kb([entry({})]), schemaVersion: 2 }, 'sleep_total_24h', 30)).toBeNull();
    expect(referenceFrom(kb([entry({}), entry({ confidence: 'D', id: 'x' })]), 'sleep_total_24h', 30)).toBeNull();
  });
});
