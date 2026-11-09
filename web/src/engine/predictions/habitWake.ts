// Prochain dodo calé sur les habitudes ET sur le dernier réveil : dernier réveil + l'éveil que ce bébé a d'habitude avant le prochain créneau.
// Les créneaux habituels sont fixés à l'heure (ils ignorent le réveil) ; les modèles d'éveil ignorent les créneaux. Celui-ci garde les deux.
import { threshold } from '../config';
import { habitsModel } from '../index';
import { DAY_MIN } from '../sleep/timeline';
import type { Forecaster } from './baselines';
import { lastWakeAt, weightedQuantile } from './models';
import { napSlot } from './sleepWindows';

const MIN = 60_000;

export const habitWake: Forecaster = ({ birthAt, events }, now) => {
  const w = lastWakeAt(events);
  if (w === null) return null;
  const { typical: typ, timeline: tl, calendar: cal } = habitsModel({ babyId: 'x', birthAt, events }, now);
  if (!typ.ok) return null;
  const half = threshold('windowMinHalf');
  // le prochain créneau habituel pas encore pris, comme `sleepWindows`
  const taken = cal.dayOf(tl.today).naps.map((x) => napSlot(typ, x.a % DAY_MIN));
  const slot = typ.naps.find((z) => !taken.includes(z) && tl.t0 + Math.max(z.hi, z.a + half) >= tl.now);
  if (!slot) return null;
  // ses éveils réels avant ce créneau, sur les jours complets de la fenêtre d'habitudes
  const aws: number[] = [];
  for (let d = tl.today - threshold('habitWindowDays'); d < tl.today; d++) {
    const day = cal.dayOf(d);
    if (!day.complete) continue;
    day.naps.forEach((z, i) => {
      const from = i ? day.naps[i - 1]!.b : day.wake;
      if (from !== null && napSlot(typ, z.a % DAY_MIN) === slot) aws.push(z.a - from);
    });
  }
  const v = aws.map((x) => ({ v: x, w: 1 }));
  // peu d'éveils observés : l'éveil médian du créneau, avec la demi-largeur minimale
  const lo = aws.length >= 3 ? weightedQuantile(v, 0.1) : slot.aw, hi = aws.length >= 3 ? weightedQuantile(v, 0.9) : slot.aw;
  const mid = (lo + hi) / 2, h = Math.max((hi - lo) / 2, threshold('habitWakeMinHalf'));
  const out = { from: w + (mid - h) * MIN, to: w + (mid + h) * MIN };
  // fenêtre déjà passée : on s'abstient, comme les autres modèles
  return now > out.to ? null : out;
};
