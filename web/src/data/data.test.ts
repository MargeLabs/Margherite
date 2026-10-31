import { describe, expect, it } from 'vitest';
import { babyProblem } from './household';
import { LocalRepo } from './localRepo';
import { RunningConflictError } from './repo';
import { sharedToView, viewToShared } from './shared';
import type { EventRow, PumpRow } from './types';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

const sleep = (id: string, end: string | null): EventRow => ({ id, kind: 'sleep', started_at: '2026-10-27T10:00:00.000Z', ended_at: end, payload: {} });

describe('chrono partagé (deux téléphones = deux dépôts sur le même stockage)', () => {
  it('un seul dodo en cours : le second lancement est refusé', async () => {
    const storage = new MemoryStorage();
    const luana = new LocalRepo(storage, false);
    const victor = new LocalRepo(storage, false);
    await luana.insertEvent(sleep('a', null));
    await expect(victor.insertEvent(sleep('b', null))).rejects.toBeInstanceOf(RunningConflictError);
  });

  it('l’un lance, l’autre arrête, et le dodo apparaît terminé chez les deux', async () => {
    const storage = new MemoryStorage();
    const luana = new LocalRepo(storage, false);
    const victor = new LocalRepo(storage, false);
    await luana.insertEvent(sleep('a', null));
    expect((await victor.load(30)).events[0]?.ended_at).toBeNull();
    await victor.patchEvent('a', { ended_at: '2026-10-27T11:30:00.000Z' });
    expect((await luana.load(30)).events[0]?.ended_at).toBe('2026-10-27T11:30:00.000Z');
    await luana.insertEvent(sleep('c', null)); // un nouveau dodo peut maintenant démarrer
  });

  it('rouvrir un dodo refusé si un autre est déjà en cours', async () => {
    const repo = new LocalRepo(new MemoryStorage(), false);
    await repo.insertEvent(sleep('a', '2026-10-27T11:00:00.000Z'));
    await repo.insertEvent(sleep('b', null));
    await expect(repo.patchEvent('a', { ended_at: null })).rejects.toBeInstanceOf(RunningConflictError);
  });
});

describe('import tire-lait dans le dépôt', () => {
  const p = (id: string, legacy: string | null, at: string, l: number, r: number): PumpRow => ({ id, legacy_id: legacy, at, left_ml: l, right_ml: r });
  it('ne double pas un carnet déjà importé', async () => {
    const repo = new LocalRepo(new MemoryStorage(), false);
    const rows = [p('1', 'x1', '2026-10-24T01:37:00.000Z', 90, 30), p('2', 'x2', '2026-10-24T03:57:00.000Z', 60, 30)];
    expect(await repo.importPumps(rows)).toBe(2);
    expect(await repo.importPumps(rows.map((r) => ({ ...r, id: r.id + 'b' })))).toBe(0);
    expect((await repo.load(30)).pumps).toHaveLength(2);
  });
});

describe('réglages partagés ↔ vue', () => {
  const origin = new Date(2026, 8, 30); // jour 0 = 30 septembre
  it('un relevé reste au même jour et à la même heure quand la fenêtre glisse', () => {
    const w = viewToShared({ trl: [{ id: 'r', tid: 't', a: 27 * 1440 + 485, v: 1 }] }, origin);
    expect(w.kv.trl).toEqual([{ id: 'r', tid: 't', at: '2026-10-27T08:05', v: 1 }]);
    const tomorrow = new Date(2026, 9, 1); // la fenêtre a glissé d'un jour
    expect(sharedToView(w.kv, {}, tomorrow).trl[0]?.a).toBe(26 * 1440 + 485);
  });
  it('les cases « maman » ne partent jamais dans la base', () => {
    const w = viewToShared({ well: { 27: { humeur: 'Calme', mhum: 'Bien', mmoral: ['Dépassée'], dig: [] } } }, origin);
    expect(JSON.stringify(w.kv)).not.toMatch(/mhum|mmoral|Dépassée|Bien/);
    expect(w.kv.well).toEqual({ '2026-10-27': { humeur: 'Calme' } });
    expect(w.mine).toEqual({ '2026-10-27': { mhum: 'Bien', mmoral: ['Dépassée'] } });
    const back = sharedToView(w.kv, w.mine ?? {}, origin);
    expect(back.well[27]).toEqual({ humeur: 'Calme', mhum: 'Bien', mmoral: ['Dépassée'] });
  });
});

describe('profil du bébé', () => {
  const now = new Date(2026, 9, 27, 14, 20);
  it('prénom, date et heure sont tous les trois obligatoires', () => {
    expect(babyProblem('', '2026-08-25', '08:42', now)).toHaveProperty('error');
    expect(babyProblem('Léo', '', '08:42', now)).toHaveProperty('error');
    expect(babyProblem('Léo', '2026-08-25', '', now)).toHaveProperty('error');
  });
  it('refuse une naissance dans le futur ou une date impossible', () => {
    expect(babyProblem('Léo', '2026-10-28', '08:42', now)).toHaveProperty('error');
    expect(babyProblem('Léo', '2026-02-30', '08:42', now)).toHaveProperty('error');
  });
  it('accepte une naissance valide', () => {
    const r = babyProblem(' Léo ', '2026-08-25', '08:42', now);
    expect('birth' in r && r.birth.getHours()).toBe(8);
  });
});
