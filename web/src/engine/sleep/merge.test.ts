import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timeline';
import type { EngineEvent } from '../types';

const at = (h: number, m: number) => new Date(2026, 10, 3, h, m).getTime();
const sleep = (id: string, a: [number, number], b: [number, number]): EngineEvent => ({ id, kind: 'sleep', start: at(...a), end: at(...b) });
const now = at(23, 0);

describe('fusion des dodos rapprochés', () => {
  it('une sieste de jour (17 h 48 → 19 h 28) et le dodo du soir (19 h 40) ne fusionnent pas, même à 12 min d’écart', () => {
    const tl = buildTimeline([sleep('a', [17, 48], [19, 28]), sleep('b', [19, 40], [22, 11])], now);
    expect(tl.sleeps).toHaveLength(2);
  });
  it('deux dodos de nuit à 12 min d’écart fusionnent toujours (rendormi)', () => {
    const tl = buildTimeline([sleep('a', [21, 25], [22, 30]), sleep('b', [22, 42], [23, 50])], now);
    expect(tl.sleeps).toHaveLength(1);
  });
  it('deux siestes de jour à 20 min d’écart fusionnent toujours', () => {
    const tl = buildTimeline([sleep('a', [10, 0], [10, 40]), sleep('b', [11, 0], [11, 30])], now);
    expect(tl.sleeps).toHaveLength(1);
  });
});
