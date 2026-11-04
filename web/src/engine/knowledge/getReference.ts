// Accès à la base de repères. La base est de la donnée, séparée du calcul : changer une valeur ne touche pas au moteur.
// Rend null quand rien de fiable n'existe. Seule une entrée publiée, donc relue par un professionnel, peut sortir.
import base from './data/base.json';

export const SCHEMA_VERSION = 1;

export type Indicator = 'sleep_total_24h' | 'nap_count' | 'feeds_24h' | 'bottle_ml_24h' | 'wake_window' | 'sleep_cycle';
export type Feeding = 'all' | 'breast' | 'bottle' | 'mixed';
export type Confidence = 'A' | 'B' | 'C' | 'D';

export interface Source {
  id: string;
  title: string;
  publisher: string;
  type: string;
  year: number | null;
  doi?: string;
  url?: string;
  consultedOn: string;
  read: string;
  population: string;
  method: string;
  limits: string;
  rights: string;
}

export interface ReferenceEntry {
  id: string;
  indicator: string;
  unit: string;
  ageFrom: number;
  ageTo: number;
  feeding: string;
  range: { low: number; high: number; type: string };
  nature: string;
  confidence: string;
  sourceIds: string[];
  status: string;
  toCheck?: string;
  /** limites connues de l'entrée, qui voyagent avec elle */
  limits?: string;
  review?: { by: string; on: string; version: string };
}

export interface KnowledgeBase {
  schemaVersion: number;
  baseVersion: string;
  sources: Source[];
  references: ReferenceEntry[];
}

export interface Reference {
  indicator: string;
  unit: string;
  range: { low: number; high: number };
  nature: string;
  confidence: Confidence;
  sources: Source[];
  limits: string[];
  baseVersion: string;
}

const RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

/** Tout ce qui interdit une entrée. Une base avec une erreur ne rend rien. */
export function validateBase(b: KnowledgeBase): string[] {
  const errors: string[] = [], ids = new Set(b.sources.map((s) => s.id)), seen = new Set<string>();
  if (b.schemaVersion !== SCHEMA_VERSION) errors.push(`schéma ${b.schemaVersion} incompatible`);
  for (const s of b.sources) for (const k of ['title', 'publisher', 'population', 'method', 'limits', 'rights'] as const) if (!s[k]) errors.push(`source ${s.id} : ${k} manquant`);
  for (const e of b.references) {
    if (seen.has(e.id)) errors.push(`${e.id} : identifiant en double`);
    seen.add(e.id);
    if (!e.sourceIds.length || e.sourceIds.some((x) => !ids.has(x))) errors.push(`${e.id} : source absente`);
    if (e.ageFrom > e.ageTo || e.ageFrom < 0) errors.push(`${e.id} : âges invalides`);
    if (!(e.range.low <= e.range.high)) errors.push(`${e.id} : plage invalide`);
    if (!['recommandation_medicale', 'reference_statistique'].includes(e.nature)) errors.push(`${e.id} : nature inconnue`);
    if (!(e.confidence in RANK)) errors.push(`${e.id} : confiance inconnue`);
    if (!['brouillon', 'relu', 'publie', 'obsolete'].includes(e.status)) errors.push(`${e.id} : statut inconnu`);
    if (e.status === 'publie' && e.confidence === 'D') errors.push(`${e.id} : confiance D jamais publiée`);
    if (e.status === 'publie' && !e.review) errors.push(`${e.id} : publiée sans relecture`);
    if (e.status === 'publie' && e.toCheck) errors.push(`${e.id} : publiée avec un point à vérifier`);
    if (e.indicator === 'bottle_ml_24h' && e.feeding === 'breast') errors.push(`${e.id} : jamais de volume au sein`);
  }
  return errors;
}

/** Enveloppe de toutes les entrées publiées qui couvrent l'âge : aucun saut le jour d'un changement de tranche, confiance la plus basse. */
export function referenceFrom(b: KnowledgeBase, indicator: Indicator, ageInDays: number | null, feeding: Feeding = 'all'): Reference | null {
  if (ageInDays === null || validateBase(b).length) return null;
  const hits = b.references.filter((e) => e.indicator === indicator && e.status === 'publie' && ageInDays >= e.ageFrom && ageInDays <= e.ageTo && (e.feeding === 'all' || e.feeding === feeding));
  const first = hits[0];
  if (!first) return null;
  // une recommandation et une statistique ne se mélangent pas : la recommandation seule ne sort pas d'une enveloppe statistique
  const pure = hits.filter((e) => e.nature === first.nature);
  const worst = pure.reduce((a, e) => ((RANK[e.confidence] ?? 3) > (RANK[a.confidence] ?? 3) ? e : a));
  return {
    indicator, unit: first.unit,
    range: { low: Math.min(...pure.map((e) => e.range.low)), high: Math.max(...pure.map((e) => e.range.high)) },
    nature: first.nature, confidence: worst.confidence as Confidence,
    sources: b.sources.filter((s) => pure.some((e) => e.sourceIds.includes(s.id))),
    limits: [...new Set(pure.flatMap((e) => (e.limits ? [e.limits] : [])))],
    baseVersion: b.baseVersion,
  };
}

export const getReference = (indicator: Indicator, ageInDays: number | null, feeding: Feeding = 'all'): Reference | null => referenceFrom(base as KnowledgeBase, indicator, ageInDays, feeding);
