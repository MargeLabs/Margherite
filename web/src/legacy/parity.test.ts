// Double calcul : l'écran de production passe par le moteur corrigé, et les deux doivent rendre exactement la même chose.
// La production n'est pas modifiée : une sonde est ajoutée à une copie en mémoire de sa logique, pour lire ses valeurs internes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankStore, viewData } from '@/data/household';
import type { Snapshot } from '@/data/repo';
import type { EventRow } from '@/data/types';
import { eventFromRaw, rawFromEvent, type RawEventRow } from '@/engine/adapters';
import { syntheticLog, SCENARIOS } from '@/engine/evaluation/synthetic';
import { habitsModel } from '@/engine';
import { LEGACY_RULES } from '@/engine/rules';
import { METRICS, type MetricKey } from '@/engine/habits/periods';
import type { EngineEvent } from '@/engine/types';
import { DCLogic } from './dc-engine';
import defaults from './props.generated.json';

/* eslint-disable @typescript-eslint/no-explicit-any -- valeurs internes non typées de la logique portée */
type Probe = Record<string, any>;

const raw = readFileSync(join(__dirname, 'app.logic.generated.js'), 'utf8');
const anchor = /const bc = P\.store\.bc;\s+return \{/;
if (!anchor.test(raw)) throw new Error('ancre de la sonde introuvable');
const probed = raw.replace(anchor, (m) => `this.__probe = { SL, FD, evs, nightOf, dayOf, typ, usual, winsH, habitOf, stat, lkEval, lkR, LFX, LO, run };\n${m}`).replace('export function createLogicClass', 'function createLogicClass');
const Logic = new Function('DCLogic', `${probed}\nreturn createLogicClass(DCLogic);`)(DCLogic) as new (p: Record<string, unknown>) => DCLogic & { __probe: Probe };

function legacy(events: EngineEvent[], now: Date): Probe {
  const snap: Snapshot = { baby: { id: 1, first_name: 'B', birth_at: new Date(2026, 5, 1).toISOString() }, events: events.map(rawFromEvent) as unknown as EventRow[], pumps: [], kv: {} };
  const data = viewData(snap, { mine: {} }, now, false);
  // la parité porte sur le calcul des habitudes : la couche d'intelligence (qui remplace une plage seulement si un modèle l'a battue) est testée à part
  const l = new Logic({ ...defaults, store: blankStore(now, { ...data, engine: { ...data.engine, nextSleep: () => null, bedtime: () => null } }) });
  l.state = {};
  l.renderVals();
  return l.__probe;
}

const pickKeys = (o: Probe, k: string[]) => Object.fromEntries(k.map((x) => [x, o[x]]));
const NIGHT = ['st', 'nf', 'bed', 'wake', 'bl', 'total', 'longest', 'wakings'];
const DAY = ['wake', 'bed', 'gap', 'fed', 'complete', 'napsTotal', 'sleep24', 'full24', 'ml', 'sein'];
const USUAL = ['ok', 'n', 'bed', 'wake', 'wk', 'wkMin', 'wkMax', 'longest', 'total', 'blocks', 'fbR', 'b0', 'bedR', 'wakeR', 'mealWake'];

function compare(name: string, events: EngineEvent[], now: Date): number {
  const L = legacy(events, now);
  const E = habitsModel({ babyId: 'b', birthAt: null, events }, now.getTime());
  const ctx = `${name} ${now.toISOString()}`;
  let checks = 0;
  const eq = (got: unknown, want: unknown, what: string) => {
    checks++;
    expect(got, `${ctx} ${what}`).toEqual(want);
  };

  eq(E.timeline.sleeps.map((z) => [z.id, z.a, z.b, z.parts]), L.SL.map((z: Probe) => [z.id, z.a, z.b, z.parts]), 'SL');
  eq(E.timeline.feeds.map((z) => z.id), L.FD.map((z: Probe) => z.id), 'FD');
  for (let d = 1; d <= 28; d++) eq(pickKeys(E.calendar.nightOf(d), NIGHT), pickKeys(L.nightOf(d), NIGHT), `nuit ${d}`);
  for (let d = 0; d <= 27; d++) {
    const a = E.calendar.dayOf(d), b = L.dayOf(d);
    eq(pickKeys(a, DAY), pickKeys(b, DAY), `jour ${d}`);
    eq(a.naps.map((z) => z.id), b.naps.map((z: Probe) => z.id), `siestes ${d}`);
    eq(a.dayFeeds.map((z) => z.id), b.dayFeeds.map((z: Probe) => z.id), `repas ${d}`);
  }
  eq(E.typical.ok, L.typ.ok, 'typ.ok');
  eq(E.typical.n, L.typ.n, 'typ.n');
  if (E.typical.ok) {
    eq(pickKeys(E.typical, ['wake', 'bed', 'wkR', 'bdR', 'naps', 'meals']), pickKeys(L.typ, ['wake', 'bed', 'wkR', 'bdR', 'naps', 'meals']), 'typ');
    eq(E.typical.bandSegs, L.typ.bandSegs.map((z: Probe) => ({ a: z.a, b: z.b })), 'bande');
  }
  for (const d of [20, 25, 27]) eq(pickKeys(E.usual(d), USUAL), Object.fromEntries(USUAL.map((k) => [k, L.usual(d)[k]]).map(([k, v]) => [k, v])), `usual ${d}`);
  eq(E.windows.map((w) => [w.a, w.b, w.bed]), L.winsH.map((w: Probe) => [w.a, w.b, w.bed]), 'wins');
  L.SL.slice(-12).forEach((z: Probe) => {
    const a = E.compare(z.a, z.b, z.id), b = L.habitOf(z.a, z.b, z.id);
    eq([a.kind, a.rows.map((x) => x.ok)], [b.kind, b.rows.map((x: Probe) => x.ok)], `habitude ${z.id}`);
  });
  for (const k of Object.keys(METRICS) as MetricKey[]) {
    for (const p of [7, 14]) {
      const a = E.period(k, p), b = L.stat(k, p);
      eq(pickKeys(a, ['vc', 'vp', 'n', 'ok', 'okP', 'dir']), pickKeys(b, ['vc', 'vp', 'n', 'ok', 'okP', 'dir']), `stat ${k} ${p}`);
    }
  }
  eq(E.linkRows.map(({ late, d: _d, ...x }) => x), L.lkR.map(({ late, d: _d, ...x }: Probe) => x), 'lkR');
  return checks;
}

describe('parité du moteur extrait avec la production', () => {
  let total = 0;
  for (const [name, o] of Object.entries(SCENARIOS)) {
    it(name, () => {
      const log = syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 40 });
      for (const [day, h, m] of [[27, 14, 20], [10, 8, 5], [3, 22, 40], [20, 18, 0], [31, 3, 15]] as Array<[number, number, number]>) {
        const now = day > 30 ? new Date(2026, 9, day - 30, h, m) : day === 27 ? new Date(2026, 8, 27, h, m) : new Date(2026, 9, day, h, m);
        const events = log.filter((e) => e.start <= now.getTime() && (e.end ?? e.start) <= now.getTime());
        total += compare(name, events, now);
      }
    });
  }

  it('avec un dodo en cours', () => {
    const o = SCENARIOS.regulier;
    if (!o) throw new Error('scénario');
    const now = new Date(2026, 8, 25, 10, 30);
    const events = syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 25 }).filter((e) => e.start <= now.getTime()).map((e) => ((e.end ?? 0) > now.getTime() ? { id: e.id, kind: e.kind, start: e.start } : e));
    total += compare('chrono', events, now);
  });

  it('quand un lien apparaît vraiment', () => {
    const day = (d: number, m: number) => new Date(2026, 8, 1 + d, 0, m).getTime();
    const ev: EngineEvent[] = [];
    let n = 0;
    const sleep = (a: number, b: number) => ev.push({ id: `k${n++}`, kind: 'sleep', start: a, end: b });
    for (let d = 0; d < 27; d++) {
      const late = d % 5 < 2;
      // les soirs à dernière sieste tardive, le coucher est plus tard 3 fois sur 4 : ni parfait ni nul
      const bed = 1200 + (late && d % 9 !== 6 ? 45 + (d % 5) * 5 : d % 3);
      sleep(day(d, 540), day(d, 600));
      sleep(day(d, 750), day(d, 820));
      sleep(day(d, late ? 980 : 885), day(d, late ? 1030 : 945));
      sleep(day(d, bed), day(d, 1500));
      sleep(day(d, 1525), day(d, 1860));
      ev.push({ id: `k${n++}`, kind: 'bottle', start: day(d, 620), ml: 120 }, { id: `k${n++}`, kind: 'bottle', start: day(d, 1050), ml: 120 });
    }
    const now = new Date(2026, 8, 28, 14, 20);
    total += compare('lien', ev.filter((e) => (e.end ?? e.start) <= now.getTime()), now);
    const seen = habitsModel({ babyId: 'b', birthAt: null, events: ev.filter((e) => (e.end ?? e.start) <= now.getTime()) }, now.getTime(), LEGACY_RULES).links(['late', 'many'], ['bed', 'lg', 'wk']);
    expect(seen.best?.factor).toBe('late');
  });

  // sur l'export réel s'il est présent sur cet ordinateur (dossier data/, jamais versionné)
  const dataDir = join(__dirname, '..', '..', '..', 'data');
  const exportFile = existsSync(dataDir) ? readdirSync(dataDir).filter((f) => /^canaille-sauvegarde-.*\.json$/.test(f)).sort().pop() : undefined;
  it.skipIf(!exportFile)('sur le journal réel, à chaque heure', () => {
    const j = JSON.parse(readFileSync(join(dataDir, exportFile ?? ''), 'utf8')) as { events: RawEventRow[] };
    const all = j.events.map(eventFromRaw);
    const first = Math.min(...all.map((e) => e.start)), last = Math.max(...all.map((e) => e.end ?? e.start));
    for (let t = first; t <= last + 86_400_000; t += 3_600_000) {
      const now = new Date(t);
      total += compare('réel', all.filter((e) => e.start <= t && (e.end ?? e.start) <= t), now);
    }
  });

  it('un nombre suffisant de comparaisons a réellement tourné', () => {
    expect(total).toBeGreaterThan(5000);
  });
});
