import { describe, expect, it } from 'vitest';
import type { ViewEngine } from '@/engine/bridge';
import type { KeyValueStore } from '@/engine/evaluation/forecastLog';
import { readShadow } from '@/engine/evaluation/shadowLog';
import { backupJson, readDeviceLogs } from './exportData';
import { withForecastLog } from './forecastRecorder';

const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
};
const origin = new Date(2026, 8, 10);
const day = (m: number) => new Date(2026, 8, 10, 0, m).getTime();
const report = (generatedAt: number, candidates: Record<string, { from: number; to: number } | null>, status = 'shown') =>
  ({ predictions: [{ target: 'nap_start', status, model: 'habit', anchor: day(700), window: { from: day(800), to: day(860) }, candidates }], evaluation: [{ target: 'nap_start', reference: 'habit' }], generatedAt, engineVersion: 't' }) as never;
const engineWith = (r: unknown): ViewEngine => ({ calendar: (() => null) as never, links: (() => null) as never, nextSleep: () => null, bedtime: () => null, intelligence: () => r as never });
const view = { origin, now: 780, events: [{ id: 'a', k: 'sleep', a: 600, b: 700 }] };

describe('journaux de mesure de l’appareil', () => {
  it('note la fenêtre de chaque modèle au premier calcul après le réveil, sans l’écraser ensuite', () => {
    const s = mem();
    withForecastLog(engineWith(report(day(701), { habit: { from: day(800), to: day(860) }, survival: { from: day(740), to: day(790) }, bayes: null })), s).intelligence(view);
    withForecastLog(engineWith(report(day(750), { habit: { from: day(900), to: day(960) } })), s).intelligence({ ...view, now: 790 });
    expect(readShadow(s)).toMatchObject([{ wake: day(700), shownAt: day(701), served: 'habit', windows: { habit: [day(800), day(860)], survival: [day(740), day(790)], bayes: null } }]);
  });

  it('rien à noter sans fenêtre de modèle (il dort, ou cible sans hiérarchie)', () => {
    const s = mem();
    withForecastLog(engineWith({ predictions: [{ target: 'nap_start', status: 'abstained', model: 'habit', anchor: null, window: null }], evaluation: [], generatedAt: 0, engineVersion: 't' }), s).intelligence(view);
    expect(readShadow(s)).toEqual([]);
  });

  it('la sauvegarde du Profil emporte les journaux de l’appareil, illisibles ou absents sans la casser', () => {
    const s = mem();
    s.setItem('canaille.forecastlog.v1', JSON.stringify([{ wake: 1, from: 2, to: 3, shownAt: 1, model: 'habit', engine: 't' }]));
    s.setItem('canaille.shadowlog.v1', '{cassé');
    const logs = readDeviceLogs(s)!;
    expect(logs).toMatchObject({ forecastLog: [{ wake: 1 }], shadowLog: [], modelHistory: [] });
    const json = JSON.parse(backupJson({ baby: null, events: [], pumps: [], kv: {} } as never, new Date(2026, 8, 10), logs));
    expect(json).toMatchObject({ app: 'canaille', version: 2, deviceLogs: { forecastLog: [{ wake: 1 }] } });
    expect(JSON.parse(backupJson({ baby: null, events: [], pumps: [], kv: {} } as never, new Date(2026, 8, 10))).deviceLogs).toBeUndefined();
    expect(readDeviceLogs(null)).toBeUndefined();
  });
});
