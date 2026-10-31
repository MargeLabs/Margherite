// Import des tirages de l'ancienne app « Margherite » (tire-lait seul) : sauvegarde JSON ou export CSV.
//   JSON : [{ id, at: 'YYYY-MM-DDTHH:mm', left, right }]      (même validation que l'ancienne app)
//   CSV  : date;heure;gauche_ml;droit_ml;total_ml              (une ligne par tirage, pas d'identifiant)
import { parseLocal } from '@/lib/time';
import type { PumpRow } from './types';

export type PumpImport = { ok: true; rows: PumpRow[] } | { ok: false; error: string };

const BAD_FILE = 'Fichier invalide : une sauvegarde JSON ou un export CSV de Margherite est attendu.';
const newId = (): string => crypto.randomUUID();

function row(at: Date, left: number, right: number, legacyId: string): PumpRow {
  return { id: newId(), legacy_id: legacyId, at: at.toISOString(), left_ml: left, right_ml: right };
}

const isMl = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

function fromJson(data: unknown): PumpImport {
  if (!Array.isArray(data)) return { ok: false, error: BAD_FILE };
  const rows: PumpRow[] = [];
  for (const t of data as unknown[]) {
    const o = (t ?? {}) as Record<string, unknown>;
    const at = typeof o.at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(o.at) ? parseLocal(o.at) : null;
    if (typeof o.id !== 'string' || !/^[\w-]{1,40}$/.test(o.id) || !at || !isMl(o.left) || !isMl(o.right)) return { ok: false, error: BAD_FILE };
    rows.push(row(at, o.left, o.right, o.id));
  }
  return { ok: true, rows };
}

function fromCsv(text: string): PumpImport {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const rows: PumpRow[] = [];
  const seen = new Map<string, number>();
  for (const [i, line] of lines.slice(1).entries()) {
    const [date = '', time = '', g = '', d = ''] = line.split(';').map((x) => x.trim());
    const at = /^\d{4}-\d\d-\d\d$/.test(date) && /^\d\d:\d\d$/.test(time) ? parseLocal(`${date}T${time}`) : null;
    const left = /^\d+$/.test(g) ? Number(g) : NaN;
    const right = /^\d+$/.test(d) ? Number(d) : NaN;
    if (!at || !isMl(left) || !isMl(right)) return { ok: false, error: `Ligne ${i + 2} illisible : « ${line.slice(0, 40)} ».` };
    // deux tirages identiques à la même minute restent deux tirages : on numérote les répétitions
    const key = `csv|${date}T${time}|${left}|${right}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    rows.push(row(at, left, right, n > 1 ? `${key}#${n}` : key));
  }
  return { ok: true, rows };
}

/** Lit le contenu d'un fichier choisi dans le Journal tire-lait. */
export function parsePumpFile(raw: string): PumpImport {
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (text.startsWith('[')) {
    try {
      return fromJson(JSON.parse(text));
    } catch {
      return { ok: false, error: BAD_FILE };
    }
  }
  if (/^date;heure;gauche_ml;droit_ml/i.test(text)) return fromCsv(text);
  return { ok: false, error: BAD_FILE };
}

const content = (p: Pick<PumpRow, 'at' | 'left_ml' | 'right_ml'>): string => `${new Date(p.at).getTime()}|${p.left_ml}|${p.right_ml}`;

/**
 * Garde seulement les tirages pas encore connus : même identifiant d'origine, ou même heure et mêmes quantités
 * (un export CSV puis la sauvegarde JSON du même carnet ne doivent pas compter deux fois).
 */
export function newPumpsOnly(existing: readonly PumpRow[], incoming: readonly PumpRow[]): PumpRow[] {
  const ids = new Set(existing.map((p) => p.legacy_id).filter((x): x is string => !!x));
  const free = new Map<string, number>();
  for (const p of existing) free.set(content(p), (free.get(content(p)) ?? 0) + 1);
  const out: PumpRow[] = [];
  for (const p of incoming) {
    if (p.legacy_id && ids.has(p.legacy_id)) continue;
    const c = content(p);
    const left = free.get(c) ?? 0;
    if (left > 0) {
      free.set(c, left - 1);
      continue;
    }
    out.push(p);
  }
  return out;
}
