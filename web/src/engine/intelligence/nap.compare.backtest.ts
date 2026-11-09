// Comparaison des modèles du prochain dodo, en rejeu chronologique : `npx vitest run --config vitest.backtest.config.ts src/engine/intelligence/nap.compare.backtest.ts`.
// À chaque réveil, chaque modèle ne reçoit que le journal connu à cet instant (visibleAt) : habitudes, coefficients et statistiques sont recalculés sans rien du futur.
// Réel = le bébé de la dernière sauvegarde (quelques jours : aucune conclusion définitive). Synthétique = la logique seulement, jamais une preuve de performance.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { eventFromRaw, type RawEventRow } from '../adapters';
import { score, visibleAt, type Prediction } from '../evaluation/backtest';
import { outcomesOf, readLog, recordForecast, summarize, type KeyValueStore, type LoggedForecast } from '../evaluation/forecastLog';
import { habitsModel } from '../index';
import { readShadowRaw, shadowOutcomes, type ShadowEntry } from '../evaluation/shadowLog';
import { SCENARIOS, syntheticLog } from '../evaluation/synthetic';
import type { EngineEvent } from '../types';
import { dayAwakeSpans, lastWakeAt, weightedQuantile } from '../predictions/models';
import { recommendNap } from '../predictions/recommendation';
import { readHistory, recordHistory } from './history';
import { runIntelligence } from './run';
import { TARGETS } from './targets';

const DATA = join(__dirname, '..', '..', '..', '..', 'data');
const MIN = 60_000;
const f = (v: number | null, d = 0) => (v === null ? 'n/a' : v.toFixed(d));
const pct = (v: number | null) => (v === null ? 'n/a' : `${Math.round(v * 100)} %`);
const median = (v: number[]) => (v.length ? v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)]! : null);

type Group = 'matin' | 'midi' | 'après-midi';
interface Case {
  at: number;
  actual: number;
  group: Group;
  /** réveil du matin vs ses réveils des jours précédents (jamais le futur) */
  morning: 'tôt' | 'tardif' | 'habituel' | null;
}

function cases(events: EngineEvent[]): Case[] {
  const decs = TARGETS.nap_start.decisions(events).sort((a, b) => a.at - b.at);
  const mornings: number[] = [];
  const seen = new Set<string>();
  return decs.map((d): Case => {
    const t = new Date(d.at), h = t.getHours() + t.getMinutes() / 60, key = t.toDateString();
    const group: Group = h < 10 ? 'matin' : h < 14 ? 'midi' : 'après-midi';
    let morning: Case['morning'] = null;
    if (h >= 6 && h <= 11 && !seen.has(key)) {
      seen.add(key);
      const clock = t.getHours() * 60 + t.getMinutes(), usual = median(mornings);
      if (usual !== null && mornings.length >= 3) morning = clock <= usual - 20 ? 'tôt' : clock >= usual + 20 ? 'tardif' : 'habituel';
      mornings.push(clock);
    }
    return { at: d.at, actual: d.actual, group, morning };
  });
}

function replayAll(events: EngineEvent[], birthAt: number | null, cs: Case[]) {
  const out: Record<string, Prediction[]> = {};
  out.recommandation = cs.map((c) => ({ at: c.at, actual: c.actual, window: recommendNap({ birthAt, events: visibleAt(events, c.at) }, c.at).recommendation?.window ?? null }));
  for (const [name, model] of Object.entries(TARGETS.nap_start.models)) {
    out[name] = cs.map((c) => {
      let window = null;
      try {
        window = model({ birthAt, events: visibleAt(events, c.at) }, c.at);
      } catch {
        window = null;
      }
      return { at: c.at, actual: c.actual, window };
    });
  }
  return out;
}

const line = (name: string, p: Prediction[]) => {
  const s = score(p), within = p.filter((x) => x.window);
  const width = within.length ? within.reduce((a, x) => a + (x.window!.to - x.window!.from) / MIN, 0) / within.length : null;
  return `| ${name} | ${s.answered}/${s.decisions} | ${f(s.meanErrorMin)} | ${f(s.medianErrorMin)} | ${pct(s.coverage)} | ${f(width)} | ${f(s.medianWidthMin)} | ${f(s.intervalScoreMin)} |`;
};
const HEAD = ['| Modèle | Évaluées | Erreur moy. (min) | Erreur méd. (min) | Couverture | Largeur moy. (min) | Largeur méd. (min) | Score d’intervalle |', '|---|---|---|---|---|---|---|---|'];

type Win = Prediction['window'];
interface Detail {
  at: number;
  actual: number;
  wake: number | null;
  /** le créneau habituel de l'écran d'origine : la logique de l'écran, sans abstention */
  screen: Win;
  /** la fenêtre de la prévision du moteur (hiérarchie de secours, sans recommandation) */
  forecast: Win;
  /** ce que le moteur complet afficherait : prévision, ou recommandation quand elle prend la place */
  shown: Win;
  display: string;
  model: string;
  confidence: string | null;
  coherent: boolean | null;
  morning: Case['morning'];
}

const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
};

/** Mêmes calculs pour toutes les versions : l'écart entre le milieu de la fenêtre et le vrai dodo, sur les seules décisions où la version affiche une fenêtre. */
function stats(rows: Detail[], pick: (d: Detail) => Win): string {
  const w = rows.map((d) => ({ d, w: pick(d) })).filter((x): x is { d: Detail; w: NonNullable<Win> } => x.w !== null);
  const err = w.map((x) => Math.abs(x.d.actual - (x.w.from + x.w.to) / 2) / MIN);
  const late = w.filter((x) => x.d.actual < x.w.from).length, early = w.filter((x) => x.d.actual > x.w.to).length, inside = w.length - late - early;
  const coh = rows.filter((d) => pick(d) !== null && d.coherent !== null), cohOk = coh.filter((d) => d.coherent).length;
  const byDay = new Map<string, number[]>();
  w.forEach((x, i) => byDay.set(new Date(x.d.at).toDateString(), [...(byDay.get(new Date(x.d.at).toDateString()) ?? []), err[i]!]));
  const perDay = [...byDay.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length), mean = perDay.reduce((a, b) => a + b, 0) / (perDay.length || 1);
  const sd = Math.sqrt(perDay.reduce((a, b) => a + (b - mean) ** 2, 0) / (perDay.length || 1));
  const half = Math.floor(w.length / 2), h = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const pc = (n: number) => (w.length ? `${Math.round((n / w.length) * 100)} %` : 'n/a');
  return `| ${w.length}/${rows.length} | ${f(median(err))} | ${f(err.length ? err.reduce((a, b) => a + b, 0) / err.length : null)} | ${pc(inside)} | ${pc(late)} | ${pc(early)} | ${coh.length ? Math.round((cohOk / coh.length) * 100) + ' % (' + coh.length + ')' : 'n/a'} | ${f(sd)} | ${f(h(err.slice(0, half)))} → ${f(h(err.slice(half)))} |`;
}
const HEADR = ['| Version | Fenêtres affichées | Écart méd. au vrai dodo (min) | Écart moy. (min) | Dodo dans la fenêtre | Dodo avant la fenêtre (trop tardive) | Dodo après (trop tôt) | Cohérente avec ses éveils | Variation d’un jour à l’autre (écart-type, min) | Écart moy. 1ʳᵉ → 2ᵉ moitié |', '|---|---|---|---|---|---|---|---|---|---|'];

/**
 * L'ancien et le nouveau comportement, mesurés de la même façon : mêmes décisions, même journal connu à chaque instant, même écart.
 * Les trois versions n'affichent pas une fenêtre aux mêmes décisions : on compare donc aussi sur les seules décisions où TOUTES en affichent une.
 */
function recoValidation(detail: Detail[]): string[] {
  const versions: Array<[string, (d: Detail) => Win]> = [['Créneau habituel (écran d’origine)', (d) => d.screen], ['Moteur sans recommandation', (d) => d.forecast], ['Moteur avec recommandation (affiché)', (d) => d.shown]];
  const table = (rows: Detail[]) => [...HEADR, ...versions.map(([n, pick]) => `| ${n} ${stats(rows, pick)}`), ''];
  const common = detail.filter((d) => d.screen !== null && d.forecast !== null && d.shown !== null);
  const changed = detail.filter((d) => (d.shown === null) !== (d.forecast === null) || (d.shown !== null && d.forecast !== null && (d.shown.from !== d.forecast.from || d.shown.to !== d.forecast.to)));
  const out = ['### Validation de la recommandation : ancien et nouveau comportement', '', `Les ${detail.length} décisions sont les mêmes pour les trois versions (même journal connu à l'instant de chaque réveil). Une version sans fenêtre à une décision n'est pas comptée dans ses écarts : la colonne « Fenêtres affichées » donne la taille de son ensemble.`, ''];
  out.push('**A. Chaque version sur son propre ensemble** (les ensembles diffèrent : les écarts ne sont PAS comparables entre lignes)', '', ...table(detail));
  out.push(`**B. Mêmes décisions pour les trois versions** (${common.length} où toutes affichent une fenêtre : seule comparaison équitable)`, '', ...table(common));
  out.push(`**C. Décisions où la recommandation change ce qui est affiché** (${changed.length})`, '');
  if (changed.length) {
    out.push('| Réveil | Affiché | Prévision seule | Recommandation affichée | Confiance | Vrai dodo | Éveil réel (min) | Écart prévision (min) | Écart affiché (min) |', '|---|---|---|---|---|---|---|---|---|');
    const t = (ms: number) => new Date(ms).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const w = (x: Win) => (x ? `${new Date(x.from).toTimeString().slice(0, 5)}–${new Date(x.to).toTimeString().slice(0, 5)}` : 'aucune');
    const e = (d: Detail, x: Win) => (x ? f(Math.abs(d.actual - (x.from + x.to) / 2) / MIN) : 'n/a');
    changed.forEach((d) => out.push(`| ${t(d.at)} | ${d.display} | ${w(d.forecast)} | ${w(d.shown)} | ${d.confidence ?? '—'} | ${new Date(d.actual).toTimeString().slice(0, 5)} | ${d.wake === null ? 'n/a' : Math.round((d.actual - d.wake) / MIN)} | ${e(d, d.forecast)} | ${e(d, d.shown)} |`));
    out.push('');
  }
  const early = detail.filter((d) => d.morning === 'tôt');
  out.push(`**D. Premier réveil du matin plus tôt que d’habitude** (${early.length} jours : trop peu pour conclure)`, '', ...(early.length ? table(early) : ['Aucun.', '']));
  const conf: Record<string, number> = {};
  detail.forEach((d) => {
    const k = d.confidence ?? 'aucune';
    conf[k] = (conf[k] ?? 0) + 1;
  });
  out.push(`Confiance de la recommandation (toutes décisions) : ${Object.entries(conf).map(([k, v]) => `${k} ×${v}`).join(', ')}`, '');
  return out;
}

function report(title: string, events: EngineEvent[], birthAt: number | null, withPipeline: boolean): string[] {
  const cs = cases(events), runs = replayAll(events, birthAt, cs), names = Object.keys(runs);
  const out = [`## ${title}`, '', `${cs.length} décisions (un réveil de jour suivi d’une sieste) rejouées dans l’ordre.`, ''];
  out.push('### Toutes les décisions où le modèle répond', '', ...HEAD, ...names.map((n) => line(n, runs[n]!)), '');
  // même ensemble pour tous : seulement les décisions où TOUS les modèles répondent
  const common = cs.map((_, i) => names.every((n) => runs[n]![i]!.window !== null));
  const sub = (n: string) => runs[n]!.filter((_, i) => common[i]);
  out.push(`### Mêmes décisions pour tous (${common.filter(Boolean).length} où tous répondent)`, '', ...HEAD, ...names.map((n) => line(n, sub(n))), '');
  for (const g of ['matin', 'midi', 'après-midi'] as Group[]) {
    const idx = cs.map((c, i) => (c.group === g ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    out.push(`### ${g} (${idx.length})`, '', ...HEAD, ...names.map((n) => line(n, idx.map((i) => runs[n]![i]!))), '');
  }
  for (const m of ['tôt', 'tardif', 'habituel'] as const) {
    const idx = cs.map((c, i) => (c.morning === m ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    out.push(`### Premier réveil du matin ${m === 'habituel' ? 'habituel' : m} (${idx.length} jours)`, '', ...HEAD, ...names.map((n) => line(n, idx.map((i) => runs[n]![i]!))), '');
  }
  const half = Math.floor(cs.length / 2);
  out.push('### Constance : première puis seconde moitié de la période', '', '| Modèle | Score 1ʳᵉ moitié | Score 2ᵉ moitié |', '|---|---|---|');
  names.forEach((n) => out.push(`| ${n} | ${f(score(runs[n]!.slice(0, half)).intervalScoreMin)} | ${f(score(runs[n]!.slice(half)).intervalScoreMin)} |`));
  out.push('');
  if (withPipeline) {
    // l'appareil : historique des modèles et fenêtres déjà affichées s'accumulent d'une décision à l'autre (règle des 2 jours, contrôle en direct)
    const store = mem(), served: Record<string, number> = {}, display: Record<string, number> = {}, detail: Detail[] = [];
    const forecastOnly: Prediction[] = [], shownAll: Prediction[] = [];
    cs.forEach((c) => {
      const ev = visibleAt(events, c.at);
      const r = runIntelligence({ babyId: 'bench', birthAt, events: ev }, c.at, { targets: ['nap_start'], history: readHistory(store), live: readLog(store) }), p = r.predictions[0]!;
      recordHistory(store, r);
      const key = p.status === 'abstained' ? `abstention:${p.abstained?.reason}` : p.model;
      served[key] = (served[key] ?? 0) + 1;
      display[String(p.display)] = (display[String(p.display)] ?? 0) + 1;
      const forecast = p.status === 'shown' && p.window ? p.window : null, reco = p.recommendation?.window ?? null;
      const shown = p.display === 'recommendation' ? reco : p.display === 'forecast' ? forecast : null;
      if (shown && p.anchor !== null) recordForecast(store, { wake: p.anchor, from: shown.from, to: shown.to, shownAt: c.at, model: p.display === 'recommendation' ? 'recommendation' : p.model, engine: 'bench' });
      forecastOnly.push({ at: c.at, actual: c.actual, window: forecast });
      shownAll.push({ at: c.at, actual: c.actual, window: shown });
      const hm = habitsModel({ babyId: 'bench', birthAt, events: ev }, c.at), w0 = hm.windows[0];
      const toMs = (t: number) => new Date(hm.timeline.origin.getFullYear(), hm.timeline.origin.getMonth(), hm.timeline.origin.getDate(), 0, t).getTime();
      const screen = w0 ? { from: toMs(w0.a), to: toMs(w0.b) } : null;
      // cohérence avec ses propres éveils déjà observés (jamais le futur)
      const wake = lastWakeAt(ev);
      const spans = wake === null ? [] : dayAwakeSpans(ev, wake, 14).filter((x) => { const d = new Date(x.to), m = d.getHours() * 60 + d.getMinutes(); return m >= 6 * 60 && m < 19.5 * 60; }).map((x) => ({ v: (x.to - x.from) / MIN, w: 1 }));
      const wait = shown && wake !== null ? ((shown.from + shown.to) / 2 - wake) / MIN : null;
      const coherent = wait !== null && spans.length >= 8 ? wait >= weightedQuantile(spans, 0.1) && wait <= weightedQuantile(spans, 0.9) : null;
      detail.push({ at: c.at, actual: c.actual, wake, screen, forecast, shown, display: String(p.display ?? 'aucun'), model: p.display === 'recommendation' ? 'recommendation' : p.model, confidence: p.display === 'recommendation' ? (p.recommendation?.confidence ?? null) : null, coherent, morning: c.morning });
    });
    out.push('### Ce que le moteur complet aurait affiché (arbitre, hiérarchie de secours et règle des 2 jours, comme sur l’appareil)', '', ...HEAD, line('moteur sans recommandation', forecastOnly), line('moteur avec recommandation (affiché)', shownAll), '', `Modèle servi : ${Object.entries(served).map(([k, v]) => `${k} ×${v}`).join(', ')}`, `Affiché comme : ${Object.entries(display).map(([k, v]) => `${k} ×${v}`).join(', ')}`, '');
    out.push(...recoValidation(detail));
  }
  return out;
}

/** Mesure en direct : ce que l'appareil a réellement affiché, et ce que chaque modèle aurait proposé, face aux vraies siestes. Seulement si la sauvegarde vient du bouton du Profil (deviceLogs). */
function liveSection(files: string[]): string[] {
  for (const name of [...files].reverse()) {
    const j = JSON.parse(readFileSync(join(DATA, name), 'utf8')) as { events: RawEventRow[]; deviceLogs?: { forecastLog?: LoggedForecast[]; shadowLog?: ShadowEntry[] } };
    const shown = j.deviceLogs?.forecastLog ?? [], shadow = readShadowRaw(j.deviceLogs?.shadowLog);
    if (!shown.length && !shadow.length) continue;
    const events = j.events.map(eventFromRaw), out = ['# C. Mesure en direct (appareil)', '', `Sauvegarde : ${name}`, ''];
    const row = (label: string, o: ReturnType<typeof outcomesOf>) => {
      const s = summarize(o);
      return `| ${label} | ${s.n} | ${pct(s.coverage)} | ${s.early} / ${s.late} | ${f(s.medianMissMin)} | ${s.pending} | ${s.notProspective} |`;
    };
    const head = ['| Modèle | Résultats | Dedans | Trop tôt / trop tard | Écart médian (min) | En attente | Non prospectives |', '|---|---|---|---|---|---|---|'];
    out.push('### Fenêtres réellement affichées', '', ...head, ...[...new Set(shown.map((x) => x.model))].map((m) => row(m, outcomesOf(shown.filter((x) => x.model === m), events))), '');
    const byModel = shadowOutcomes(shadow, events);
    out.push(`### Fenêtre de chaque modèle à chaque réveil (${shadow.length} réveils notés)`, '', ...head, ...Object.entries(byModel).map(([m, o]) => row(m, o)), '');
    return out;
  }
  return ['# C. Mesure en direct (appareil)', '', 'Aucune sauvegarde ne contient encore les journaux de l’appareil : télécharge la sauvegarde depuis le Profil après quelques jours d’usage.', ''];
}

it('comparaison nap_start', () => {
  const files = readdirSync(DATA).filter((x) => /^canaille-sauvegarde-.*\.json$/.test(x)).sort((a, b) => statSync(join(DATA, a)).mtimeMs - statSync(join(DATA, b)).mtimeMs);
  const last = files[files.length - 1]!;
  const j = JSON.parse(readFileSync(join(DATA, last), 'utf8')) as { baby?: { birth_at: string } | null; events: RawEventRow[]; exportedAt: string };
  const out = ['# Prochain dodo : comparaison des modèles', '', `Données réelles : ${last}. Synthétiques : logique seulement.`, '', '# A. Données réelles (jamais une preuve définitive : quelques jours)', ''];
  out.push(...report('Bébé réel', j.events.map(eventFromRaw), j.baby ? Date.parse(j.baby.birth_at) : null, true));
  out.push('# B. Données synthétiques (mécanique seulement)', '');
  for (const [name, o] of Object.entries(SCENARIOS)) {
    const events = syntheticLog({ ...o, from: new Date(2026, 8, 1), days: 28 });
    out.push(...report(`Synthétique « ${name} »`, events, new Date(2026, 8, 1 - (name === 'nouveauNe' ? 7 : 90)).getTime(), false));
  }
  out.push(...liveSection(files));
  mkdirSync(join(DATA, 'rapports'), { recursive: true });
  writeFileSync(join(DATA, 'rapports', 'nap-start-comparaison.md'), out.join('\n'));
  console.log(out.slice(0, 120).join('\n'));
}, 900_000);
