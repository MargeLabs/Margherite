// Couche 1 : le contrat du journal parental. Cas normaux, limites, minuit, saisies après coup, événements incomplets, incohérences, fuseaux.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROVENANCE_TRUST } from '@/data/types';
import type { RawEventRow } from '../adapters';
import { assessQuality } from '../quality';
import type { EngineEvent } from '../types';
import type { JournalEntry } from './history';
import { ENTRY_TRUST, observe, type JournalReport, type Observation } from './observation';

const TZ = 'Europe/Paris';
const NOW = Date.parse('2026-11-10T12:00:00Z');
const iso = (h: string, d = 10): string => `2026-11-${String(d).padStart(2, '0')}T${h}:00Z`;
const ev = (id: string, kind: RawEventRow['kind'], start: string, end: string | null = null, extra: Partial<RawEventRow> = {}): RawEventRow => ({ id, kind, started_at: start, ended_at: end, payload: {}, ...extra });
const run = (rows: RawEventRow[], more: Partial<Parameters<typeof observe>[0]> = {}): JournalReport => observe({ rows, now: NOW, tz: TZ, ...more });
const one = (rows: RawEventRow[], id: string, more: Partial<Parameters<typeof observe>[0]> = {}): Observation => run(rows, more).observations.find((o) => o.id === id)!;
const codes = (o: Observation): string[] => o.flags.map((f) => f.code).sort();

describe('cas normaux', () => {
  const rows = [
    ev('s', 'sleep', iso('08:00'), iso('09:30'), { created_at: iso('08:00'), provenance: 'server', source: 'timer' }),
    ev('b', 'bib', iso('10:00'), null, { payload: { ml: 120, lait: 'infantile' }, created_at: iso('10:02'), provenance: 'server', source: 'live' }),
    ev('t', 'sein', iso('10:40'), null, { payload: { side: 'G', dur: 12 }, created_at: iso('10:41'), provenance: 'server', source: 'live' }),
    ev('c', 'chg', iso('11:00'), null, { payload: { v: 'pipi' }, created_at: iso('11:01'), provenance: 'server', source: 'live' }),
  ];
  const r = run(rows);

  it('une observation par ligne, triée, rien de retiré, tout « observé »', () => {
    expect(r.observations.map((o) => o.id)).toEqual(['s', 'b', 't', 'c']);
    expect(r.observations.every((o) => o.basis === 'observed' && o.usable && o.flags.length === 0)).toBe(true);
  });

  it('les valeurs sont celles de la saisie, sans volume inventé pour une tétée', () => {
    expect(one(rows, 'b').attrs).toEqual({ ml: 120, milk: 'infantile' });
    expect(one(rows, 't').attrs).toEqual({ side: 'G', durationMin: 12 });
    expect(one(rows, 't').attrs.ml).toBeUndefined();
    expect(one(rows, 'c').status).toBe('instant');
  });

  it('un sommeil terminé a une durée réelle ; les autres n’en ont pas', () => {
    expect(one(rows, 's')).toMatchObject({ status: 'complete', elapsedMin: 90 });
    expect(one(rows, 'b').elapsedMin).toBeUndefined();
  });

  it('un jour sans saisie n’existe pas : jamais de zéro inventé', () => {
    const days = run([ev('x', 'bib', iso('10:00', 3)), ev('y', 'bib', iso('10:00', 7))]).days;
    expect(days.map((d) => d.day)).toEqual(['2026-11-03', '2026-11-07']);
  });

  it('table vide : rapport vide, sans erreur', () => {
    expect(run([])).toMatchObject({ observations: [], open: [], days: [], silences: [], removed: [], journal: 'absent' });
  });
});

describe('contrat : seulement de l’observé', () => {
  it('les champs d’une observation sont exactement ceux du contrat (rien de calculé ne s’y glisse)', () => {
    const o = one([ev('s', 'sleep', iso('08:00'), iso('09:00'), { created_at: iso('09:00'), provenance: 'server', source: 'later' })], 's');
    expect(Object.keys(o).sort()).toEqual(['attrs', 'basis', 'elapsedMin', 'end', 'entry', 'flags', 'history', 'id', 'kind', 'spans', 'start', 'status', 'usable'].sort());
    expect(Object.keys(o.entry).sort()).toEqual(['endTiming', 'enteredAt', 'provenance', 'source', 'startDelayMin', 'startTiming', 'trust'].sort());
  });

  it('les heures rendues sont exactement celles de la table, et les lignes en entrée ne sont pas modifiées', () => {
    const rows = [ev('s', 'sleep', '2026-11-10T08:00:07.123+00:00', '2026-11-10T09:00:42Z', { payload: { mark: 'bed' } })];
    const before = JSON.stringify(rows);
    const o = one(rows, 's');
    expect(o.start).toBe(Date.parse('2026-11-10T08:00:07.123Z'));
    expect(o.end).toBe(Date.parse('2026-11-10T09:00:42Z'));
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('un sommeil sans fin reste « en cours » : aucune fin inventée, même oublié depuis des jours', () => {
    const o = one([ev('z', 'sleep', iso('08:00', 6))], 'z');
    expect(o).toMatchObject({ status: 'open', usable: true });
    expect(o.end).toBeUndefined();
    expect(o.elapsedMin).toBeUndefined();
    expect(o.spans).toBeUndefined();
    expect(o.openForMin).toBe((NOW - Date.parse(iso('08:00', 6))) / 60_000);
    expect(codes(o)).toEqual(['open_too_long']);
  });

  it('ENTRY_TRUST dit la même chose que PROVENANCE_TRUST de la couche de données', () => {
    expect(ENTRY_TRUST).toEqual(PROVENANCE_TRUST);
  });

  it('le code de la couche 1 n’importe que la configuration, les adaptateurs, la qualité et ses propres fichiers', () => {
    const dir = __dirname;
    const allowed = new Set(['../config', '../adapters', '../quality', '../types', './localDays', './history', './observation']);
    for (const f of readdirSync(dir).filter((x) => /\.ts$/.test(x) && !/\.test\.ts$/.test(x))) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/from '([^']+)'/g)) expect(allowed.has(m[1]!), `${f} importe ${m[1]}`).toBe(true);
      expect(src, f).not.toMatch(/Date\.now\(\)|new Date\(\)|Math\.random|fetch\(|localStorage/);
    }
  });
});

describe('passage de minuit', () => {
  const night = ev('n', 'sleep', '2026-11-09T19:30:00Z', '2026-11-10T05:30:00Z'); // 20 h 30 → 6 h 30 à Paris

  it('la nuit est une seule observation, avec ses parts par jour civil local', () => {
    const o = one([night], 'n');
    expect(o.elapsedMin).toBe(600);
    expect(o.spans!.map((s) => [s.day, s.minutes])).toEqual([['2026-11-09', 210], ['2026-11-10', 390]]);
  });

  it('elle COMMENCE le 9 mais couvre le 10 : jours, sommeil et événements commencés ne se confondent pas', () => {
    const days = run([night, ev('b', 'bib', '2026-11-10T07:00:00Z')]).days;
    expect(days.map((d) => [d.day, d.started.sleep, d.started.bottle, d.sleepMin])).toEqual([['2026-11-09', 1, 0, 210], ['2026-11-10', 0, 1, 390]]);
  });

  it('le même sommeil lu en UTC se coupe ailleurs, sans changer sa durée', () => {
    const o = one([night], 'n', { tz: 'UTC' });
    expect(o.spans!.map((s) => s.day)).toEqual(['2026-11-09', '2026-11-10']);
    expect(o.spans!.reduce((t, s) => t + s.minutes, 0)).toBe(600);
  });

  it('la nuit du passage à l’heure d’hiver : 11 h réelles, journée de 25 h', () => {
    const r = run([ev('n', 'sleep', '2026-10-24T20:00:00Z', '2026-10-25T07:00:00Z')]);
    expect(r.observations[0]!.elapsedMin).toBe(660);
    expect(r.days.map((d) => [d.day, d.lengthMin, d.sleepMin])).toEqual([['2026-10-24', 1440, 120], ['2026-10-25', 1500, 540]]);
  });

  it('un sommeil entre minuit et minuit+1 reste dans un seul jour', () => {
    expect(one([ev('m', 'sleep', '2026-11-09T23:00:00Z', '2026-11-09T23:30:00Z')], 'm').spans).toHaveLength(1);
  });
});

describe('saisie après coup, estimée, approximative', () => {
  const at = (delayMin: number, extra: Partial<RawEventRow> = {}): Observation => {
    const start = Date.parse(iso('09:00'));
    return one([ev('e', 'bib', iso('09:00'), null, { created_at: new Date(start + delayMin * 60_000).toISOString(), provenance: 'server', ...extra })], 'e');
  };

  it('en direct, avec retard, de mémoire : d’après l’écart entre l’heure déclarée et l’enregistrement', () => {
    expect([at(0), at(10), at(11), at(60), at(61), at(600)].map((o) => o.entry.startTiming)).toEqual(['live', 'live', 'delayed', 'delayed', 'recalled', 'recalled']);
    expect(at(600).entry.startDelayMin).toBe(600);
  });

  it('une heure un peu dans le futur (horloge qui avance) reste « en direct » ; au-delà, elle est signalée et non qualifiée', () => {
    expect(at(-1).entry.startTiming).toBe('live');
    expect(codes(at(-1))).toEqual([]);
    const far = at(-30);
    expect(far.entry.startTiming).toBe('unknown');
    expect(codes(far)).toContain('start_after_entry');
    expect(far.usable).toBe(true); // signalée, pas écartée
  });

  it('un enregistrement dont l’heure a été fournie par l’écrivain (SQL) n’est pas une mesure', () => {
    const o = at(0, { provenance: 'supplied' });
    expect(o.entry).toMatchObject({ provenance: 'supplied', trust: 'low', startTiming: 'unknown' });
  });

  it('avant la migration 0004 : fiabilité moyenne, source inconnue, rien d’inventé', () => {
    const o = at(120, { provenance: 'derived_pre0004', source: null });
    expect(o.entry).toMatchObject({ source: null, provenance: 'derived_pre0004', trust: 'moderate', startTiming: 'recalled' });
  });

  it('sans heure d’enregistrement du tout (sauvegarde ancienne, démo) : « inconnu », jamais « en direct »', () => {
    const o = one([ev('e', 'bib', iso('09:00'))], 'e');
    expect(o.entry).toMatchObject({ startTiming: 'unknown', source: null, provenance: null, trust: null });
    expect(o.entry.enteredAt).toBeUndefined();
  });

  it('valeurs de source ou de provenance inconnues : ramenées à null plutôt que recopiées', () => {
    const o = at(0, { source: 'robot', provenance: 'magic' });
    expect(o.entry).toMatchObject({ source: null, provenance: null });
  });

  it('la fin d’un sommeil n’est qualifiée que si le journal des écritures la date', () => {
    const rows = [ev('s', 'sleep', iso('08:00'), iso('09:00'), { created_at: iso('08:00'), provenance: 'server' })];
    expect(one(rows, 's').entry.endTiming).toBe('unknown');
    const open = { id: 's', kind: 'sleep', started_at: iso('08:00'), ended_at: null, payload: {} };
    const done = { ...open, ended_at: iso('09:00') };
    const j = (op: string, o: unknown, n: unknown, at: string, seq: number, f: string[] = []): JournalEntry => ({ seq, tbl: 'events', row_id: 's', op, old_row: o as never, new_row: n as never, changed_fields: f, changed_at: at, recorded_at: at, via: 'app' });
    const live = one(rows, 's', { journal: [j('insert', null, open, iso('08:00'), 1), j('stop', open, done, iso('09:01'), 2, ['ended_at'])] });
    expect(live.entry).toMatchObject({ endTiming: 'live', endDelayMin: 1, startTiming: 'live' });
    const retro = one(rows, 's', { journal: [j('insert', null, open, iso('08:00'), 1), j('stop', open, done, iso('11:00'), 2, ['ended_at'])] });
    expect(retro.entry).toMatchObject({ endTiming: 'recalled', endDelayMin: 120 });
  });
});

describe('incohérences : signalées, jamais corrigées', () => {
  it('fin avant début : illisible, mais présente', () => {
    const o = one([ev('x', 'sleep', iso('10:00'), iso('09:00'))], 'x');
    expect(o).toMatchObject({ usable: false, start: Date.parse(iso('10:00')), end: Date.parse(iso('09:00')) });
    expect(codes(o)).toContain('end_before_start');
    expect(o.elapsedMin).toBeUndefined();
  });

  it('heure illisible (NaN) : signalée, sans faire échouer les autres lignes ni fausser leur tri', () => {
    const r = run([ev('bad', 'bib', 'pas une date'), ev('ok', 'bib', iso('09:00')), ev('bad2', 'sleep', iso('09:00'), 'nope')]);
    expect(r.observations.map((o) => o.id)).toEqual(['ok', 'bad2', 'bad']); // l'heure illisible passe en dernier
    expect(codes(r.observations.find((o) => o.id === 'bad')!)).toContain('invalid_time');
    expect(r.observations.find((o) => o.id === 'bad2')!.usable).toBe(false);
    expect(r.observations.find((o) => o.id === 'ok')).toMatchObject({ usable: true, flags: [] });
    expect(r.days.map((d) => d.day)).toEqual(['2026-11-10']);
  });

  it('nature inconnue : conservée comme telle, jamais devinée', () => {
    const o = one([ev('k', 'bib', iso('09:00'), null, { kind: 'bain' as never })], 'k');
    expect(o).toMatchObject({ kind: 'unknown', usable: false });
    expect(codes(o)).toEqual(['unknown_kind']);
  });

  it('chevauchement : le long sommeil est en cause avec chacun de ceux qu’il recouvre, pas seulement son voisin', () => {
    const r = run([ev('A', 'sleep', iso('06:00'), iso('09:00')), ev('B', 'sleep', iso('07:00'), iso('07:30')), ev('C', 'sleep', iso('08:00'), iso('08:30'))]);
    const by = (id: string) => r.observations.find((o) => o.id === id)!;
    expect(by('A').flags.map((f) => f.with?.[0]).sort()).toEqual(['B', 'C']);
    expect(codes(by('B'))).toEqual(['overlap']);
    expect(codes(by('C'))).toEqual(['overlap']);
    expect(by('B').flags[0]!.with).toEqual(['A']);
  });

  it('deux sommeils qui se touchent exactement (fin = début) ne se chevauchent pas', () => {
    expect(run([ev('A', 'sleep', iso('06:00'), iso('07:00')), ev('B', 'sleep', iso('07:00'), iso('08:00'))]).observations.flatMap(codes)).toEqual([]);
  });

  it('un chrono ouvert que recouvre un sommeil plus récent : chevauchement signalé', () => {
    const r = run([ev('old', 'sleep', iso('06:00')), ev('new', 'sleep', iso('09:00'), iso('10:00'))]);
    expect(r.observations.find((o) => o.id === 'new')!.flags.some((f) => f.code === 'overlap')).toBe(true);
  });

  it('doublon : deux biberons à la même minute', () => {
    const r = run([ev('a', 'bib', iso('09:00')), ev('b', 'bib', '2026-11-10T09:00:30Z')]);
    expect(r.observations.every((o) => codes(o).includes('duplicate'))).toBe(true);
  });

  it('futur : la tolérance de décalage d’horloge est de 2 min, comme dans la base', () => {
    const ahead = (min: number) => one([ev('f', 'bib', new Date(NOW + min * 60_000).toISOString())], 'f');
    expect(codes(ahead(1))).toEqual([]);
    expect(codes(ahead(5))).toEqual(['in_future']);
    expect(codes(one([ev('g', 'sleep', iso('11:00'), iso('15:00'))], 'g'))).toContain('in_future'); // une fin dans le futur compte aussi
  });

  it('quantité absurde : signalée, valeur gardée', () => {
    const o = one([ev('q', 'bib', iso('09:00'), null, { payload: { ml: -20 } })], 'q');
    expect(codes(o)).toEqual(['bad_quantity']);
    expect(o.attrs.ml).toBe(-20);
    expect(codes(one([ev('q', 'bib', iso('09:00'), null, { payload: { ml: 900 } })], 'q'))).toEqual(['bottle_too_large']);
  });

  it('sommeil de plus de 16 h : suspect, présent', () => {
    expect(codes(one([ev('l', 'sleep', iso('01:00', 8), iso('11:00', 9))], 'l'))).toContain('sleep_too_long');
  });

  it('marqueur de nuit incohérent : sur autre chose qu’un sommeil, ou « réveil » sans fin', () => {
    expect(codes(one([ev('m', 'bib', iso('09:00'), null, { payload: { mark: 'bed' } })], 'm'))).toContain('mark_invalid');
    expect(codes(one([ev('m', 'sleep', iso('09:00'), null, { payload: { mark: 'wake' } })], 'm'))).toContain('mark_invalid');
    expect(codes(one([ev('m', 'sleep', iso('09:00'), null, { payload: { mark: 'bed' } })], 'm'))).toEqual([]);
    expect(codes(one([ev('m', 'sleep', iso('06:00'), iso('07:00'), { payload: { mark: 'both' } })], 'm'))).toEqual([]);
  });

  it('une ligne sans payload ne fait pas tomber le calcul', () => {
    expect(() => run([{ ...ev('p', 'bib', iso('09:00')), payload: undefined as never }])).not.toThrow();
  });

  it('une fin sur un biberon (interdit par la base, possible dans un import) ne crée ni durée ni couverture de sommeil', () => {
    const o = one([ev('i', 'bib', iso('09:00'), iso('10:00'))], 'i');
    expect(o.status).toBe('instant');
    expect(o.elapsedMin).toBeUndefined();
  });
});

describe('événements manquants', () => {
  it('un silence entre deux saisies est un fait de couverture, avec ses bornes', () => {
    const r = run([ev('a', 'bib', iso('00:00')), ev('b', 'bib', iso('07:00'))]);
    expect(r.silences).toEqual([{ from: Date.parse(iso('00:00')), to: Date.parse(iso('07:00')), minutes: 420 }]);
  });

  it('une nuit de sommeil saisie couvre sa durée : pas de silence', () => {
    const r = run([ev('a', 'bib', iso('00:00')), ev('n', 'sleep', iso('00:30'), iso('06:45')), ev('b', 'bib', iso('07:00'))]);
    expect(r.silences).toEqual([]);
  });

  it('un sommeil en cours couvre jusqu’à maintenant ; rien n’est dit après la dernière saisie', () => {
    expect(run([ev('a', 'bib', iso('00:00')), ev('n', 'sleep', iso('00:30'))]).silences).toEqual([]);
    expect(run([ev('a', 'bib', iso('00:00'))]).silences).toEqual([]);
  });

  it('juste sous le seuil : pas de silence ; au seuil : silence', () => {
    expect(run([ev('a', 'bib', iso('00:00')), ev('b', 'bib', iso('05:59'))]).silences).toEqual([]);
    expect(run([ev('a', 'bib', iso('00:00')), ev('b', 'bib', iso('06:00'))]).silences).toHaveLength(1);
  });

  it('les lignes illisibles ne comblent ni ne creusent un silence', () => {
    const r = run([ev('a', 'bib', iso('00:00')), ev('x', 'sleep', iso('02:00'), iso('01:00')), ev('b', 'bib', iso('07:00'))]);
    expect(r.silences).toHaveLength(1);
  });
});

describe('corrections rétroactives et suppressions (avec le journal des écritures)', () => {
  const v1 = { id: 'c', kind: 'sleep', started_at: iso('10:00'), ended_at: iso('11:00'), payload: {} };
  const v2 = { ...v1, started_at: iso('09:30') };
  const j = (seq: number, op: string, o: unknown, n: unknown, at: string, f: string[] = [], id = 'c'): JournalEntry => ({ seq, tbl: 'events', row_id: id, op, old_row: o as never, new_row: n as never, changed_fields: f, changed_at: at, recorded_at: at, via: 'app' });
  const journal = [j(1, 'insert', null, v1, iso('11:00')), j(2, 'update', v1, v2, iso('11:30'), ['started_at'])];

  it('l’observation porte son histoire : valeur d’origine et correction, la valeur courante restant la saisie', () => {
    const o = one([ev('c', 'sleep', iso('09:30'), iso('11:00'), { created_at: iso('11:00'), provenance: 'server' })], 'c', { journal });
    expect(o.start).toBe(Date.parse(iso('09:30')));
    expect(o.history).toMatchObject({ originalStart: Date.parse(iso('10:00')), timeCorrections: 1, entries: 2 });
    expect(o.entry.startTiming).toBe('recalled'); // saisie à 11 h pour 9 h 30
  });

  it('un événement supprimé n’est pas une observation, mais sa trace reste', () => {
    const del = [...journal, j(3, 'delete', v2, null, iso('12:00'))];
    const r = run([], { journal: del });
    expect(r.observations).toEqual([]);
    expect(r.removed).toEqual([{ id: 'c', deletedAt: Date.parse(iso('12:00')), originalStart: Date.parse(iso('10:00')), originalEnd: Date.parse(iso('11:00')) }]);
    expect(r.days).toEqual([]);
  });

  it('un journal vide ou absent : historique inconnu, pas « aucune correction »', () => {
    const rows = [ev('c', 'sleep', iso('09:30'), iso('11:00'))];
    expect(one(rows, 'c').history).toBeNull();
    expect(one(rows, 'c', { journal: [] }).history).toBeNull();
    expect(run(rows, { journal: null }).journal).toBe('absent');
    expect(run(rows, { journal }).journal).toBe('present');
  });

  it('cohérence table ↔ journal : une ligne jamais écrite au journal, ou dont les heures ont bougé sans écriture, est dénoncée', () => {
    const rows = [ev('c', 'sleep', iso('09:30'), iso('11:00')), ev('ghost', 'bib', iso('09:00')), ev('moved', 'sleep', iso('08:00'), iso('08:45'))];
    const moved = { id: 'moved', kind: 'sleep', started_at: iso('08:00'), ended_at: iso('08:30'), payload: {} };
    const r = run(rows, { journal: [...journal, j(3, 'insert', null, moved, iso('08:30'), [], 'moved')] });
    expect(r.integrity).toEqual({ untraced: ['ghost'], diverged: ['moved'] });
  });

  it('le journal et la table d’accord : aucune dénonciation', () => {
    expect(run([ev('c', 'sleep', iso('09:30'), iso('11:00'))], { journal }).integrity).toEqual({ untraced: [], diverged: [] });
  });
});

describe('fuseau et sommeil en cours', () => {
  it('open liste le chrono ; il n’entre pas dans le sommeil par jour (non terminé)', () => {
    const r = run([ev('o', 'sleep', iso('11:00'))]);
    expect(r.open).toEqual(['o']);
    expect(r.days).toEqual([{ day: '2026-11-10', lengthMin: 1440, started: { sleep: 1, bottle: 0, breast: 0, diaper: 0 }, sleepMin: 0 }]);
    expect(r.observations[0]!.openForMin).toBe(60);
  });

  it('le fuseau est un paramètre du contrat, rendu dans le rapport', () => {
    expect(run([], { tz: 'Asia/Tokyo' }).tz).toBe('Asia/Tokyo');
    const t = '2026-11-10T16:00:00Z'; // 17 h à Paris, 1 h le lendemain à Tokyo
    expect(run([ev('a', 'bib', t)], { tz: 'Asia/Tokyo' }).days[0]!.day).toBe('2026-11-11');
    expect(run([ev('a', 'bib', t)]).days[0]!.day).toBe('2026-11-10');
  });
});

describe('contrôle de qualité : correctifs de la couche 1', () => {
  const sleep = (id: string, a: string, b?: string): EngineEvent => ({ id, kind: 'sleep', start: Date.parse(a), ...(b ? { end: Date.parse(b) } : {}) });
  it('l’ancien comportement reste : un journal propre ne déclenche rien, les anomalies simples restent détectées', () => {
    expect(assessQuality([sleep('a', iso('06:00'), iso('07:00')), { id: 'b', kind: 'bottle', start: Date.parse(iso('08:00')), ml: 120 }], NOW).issues).toEqual([]);
    expect(assessQuality([sleep('a', iso('06:00'), iso('08:00')), sleep('b', iso('07:00'), iso('09:00'))], NOW).issues.map((i) => i.code)).toContain('overlap');
  });
  it('NaN dans une heure : signalé, le reste est évalué normalement', () => {
    const q = assessQuality([{ id: 'n', kind: 'bottle', start: NaN }, sleep('a', iso('06:00'), iso('08:00')), sleep('b', iso('07:00'), iso('09:00'))], NOW).issues;
    expect(q.map((i) => i.code).sort()).toEqual(['invalid_time', 'overlap']);
  });
});
