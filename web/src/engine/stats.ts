// Petites statistiques partagées, reprises à l'identique du calcul de production.
import { threshold } from './config';

export const r5 = (x: number): number => Math.round(x / 5) * 5;

export function median(a: number[]): number | null {
  if (!a.length) return null;
  const v = a.slice().sort((x, y) => x - y), k = Math.floor(v.length / 2);
  return v.length % 2 ? v[k]! : (v[k - 1]! + v[k]!) / 2;
}
/** Médiane d'une liste connue non vide. */
export const med = (a: number[]): number => median(a) as number;
export const mean = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** Plage habituelle : à partir de 5 valeurs, on écarte la plus petite et la plus grande. */
export function lohi(a: number[]): [number, number] {
  const v = a.slice().sort((x, y) => x - y);
  return v.length >= threshold('rangeTrimFrom') ? [v[1]!, v[v.length - 2]!] : [v[0]!, v[v.length - 1]!];
}
