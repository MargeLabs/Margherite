import test from 'node:test';
import assert from 'node:assert/strict';
import { total, byDay, overall } from './stats.js';

const s = (at, left, right) => ({ id: at, at, left, right });

const data = [
  s('2026-10-22T08:00', 100, 80), // 180
  s('2026-10-22T20:00', 60, 60), //  120 -> jour 22 : 300 en 2 tirages
  s('2026-10-23T07:30', 90, 110), // 200 -> jour 23 : 200 en 1 tirage
];

test('total = gauche + droit', () => {
  assert.equal(total(data[0]), 180);
  assert.equal(total(s('2026-10-23T07:30', 0, 70)), 70);
});

test('byDay regroupe par jour, jour le plus récent en premier', () => {
  const days = byDay(data);
  assert.deepEqual(days.map((d) => d.day), ['2026-10-23', '2026-10-22']);
  const d22 = days[1];
  assert.equal(d22.total, 300);
  assert.equal(d22.left, 160);
  assert.equal(d22.right, 140);
  assert.equal(d22.count, 2);
  assert.equal(d22.avgPerSession, 150);
});

test('byDay trie les tirages du jour du plus récent au plus ancien', () => {
  const [, d22] = byDay(data);
  assert.deepEqual(d22.sessions.map((x) => x.at), ['2026-10-22T20:00', '2026-10-22T08:00']);
});

test('byDay ne dépend pas de l’ordre d’entrée', () => {
  assert.deepEqual(byDay([...data].reverse()), byDay(data));
});

test('overall : moyennes sur les jours avec au moins un tirage', () => {
  const o = overall(data);
  assert.equal(o.total, 500);
  assert.equal(o.count, 3);
  assert.equal(o.days, 2);
  assert.equal(o.avgPerDay, 250);
  assert.equal(o.avgPerSession, 500 / 3);
  assert.equal(o.avgLeft, 250 / 3);
  assert.equal(o.avgRight, 250 / 3);
});

test('overall sur liste vide : zéros, jamais NaN', () => {
  assert.deepEqual(overall([]), {
    total: 0, count: 0, days: 0, avgPerDay: 0, avgPerSession: 0, avgLeft: 0, avgRight: 0,
  });
  assert.deepEqual(byDay([]), []);
});
