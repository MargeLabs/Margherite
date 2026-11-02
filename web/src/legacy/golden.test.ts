// Photographie du calcul de production : toute sortie qui change fait échouer ce test.
// Une différence voulue se relit, puis se valide avec `npx vitest run -u`.
import { describe, expect, it } from 'vitest';
import { SCENARIOS, syntheticLog } from '@/engine/evaluation/synthetic';
import { legacyVals } from './legacyHarness';

const NOW = new Date(2026, 9, 27, 14, 20);
const FROM = new Date(2026, 8, 30);
const KEYS = ['typ', 'nty', 'sit', 'nx', 'ls', 'lf', 'ret', 'dataNote', 'hclk'];

/** Garde les valeurs, retire les fonctions. */
const plain = (v: unknown): unknown => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

describe('calcul de production figé', () => {
  for (const [name, o] of Object.entries(SCENARIOS)) {
    it(name, async () => {
      const events = syntheticLog({ ...o, from: FROM, days: 27 }).filter((e) => e.start <= NOW.getTime() && (e.end ?? 0) <= NOW.getTime());
      const v = legacyVals(events, FROM.getTime() - 60 * 86_400_000, NOW);
      const out = Object.fromEntries(KEYS.map((k) => [k, plain(v[k])]));
      await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot(`__golden__/${name}.json`);
    });
  }

  it('déterministe : deux calculs identiques', () => {
    const o = SCENARIOS.irregulier;
    if (!o) throw new Error('scénario');
    const events = syntheticLog({ ...o, from: FROM, days: 27 });
    expect(JSON.stringify(plain(legacyVals(events, null, NOW).typ))).toBe(JSON.stringify(plain(legacyVals(events, null, NOW).typ)));
  });
});
