// Outils des tests du journal sur un vrai Postgres (PGlite) avec les rôles de Supabase simulés.
// PGlite n'a qu'une session : il prouve la logique (droits, déclencheurs, rejeu), pas la concurrence entre connexions (voir web/pgtest).
import { readFileSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { JournalRow } from './types';

export const MIG = (f: string): string => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8');
export const UID = '11111111-1111-4111-8111-111111111111';
export const PHONE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const PHONE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const ago = (min: number): string => `now() - interval '${min} minutes'`;

/** Ce que Supabase fournit et que les migrations supposent : rôles, schéma auth, publication temps réel, droits par défaut. */
const SUPABASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid $$;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export async function base(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE);
  for (const f of ['0001_init.sql', '0002_event_audit.sql', '0003_emb.sql']) await db.exec(MIG(f));
  return db;
}
export async function fresh(): Promise<PGlite> {
  const db = await base();
  await db.exec(MIG('0004_journal.sql'));
  return db;
}

export type Who = { role: 'authenticated' | 'anon' | 'service_role'; device?: string };
/** Une requête comme l'API la ferait : jeton, en-tête X-Client-Info, rôle de la base. */
export async function as<T = Record<string, unknown>>(db: PGlite, who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx: Transaction) => {
    const claims = who.role === 'anon' ? { role: 'anon' } : { sub: UID, role: who.role };
    const headers = { 'x-client-info': `supabase-js-web${who.device ? ` canaille-device/${who.device}` : ''}` };
    await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)`, [JSON.stringify(claims), JSON.stringify(headers)]);
    await tx.exec(`set local role ${who.role}`);
    return (await tx.query<T>(sql, params)).rows;
  });
}
export const app = <T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = [], device = PHONE_A) => as<T>(db, { role: 'authenticated', device }, sql, params);

/** Le journal tel que l'API le rend : instants en texte. */
export async function journal(db: PGlite): Promise<JournalRow[]> {
  const rows = (await db.query<Record<string, unknown>>('select * from journal order by seq')).rows;
  return rows.map((r) => ({ ...r, seq: Number(r.seq), changed_at: (r.changed_at as Date).toISOString(), recorded_at: (r.recorded_at as Date).toISOString() }) as unknown as JournalRow);
}
export const clock = async (db: PGlite): Promise<string> => (await db.query<{ t: string }>('select clock_timestamp()::text as t')).rows[0]!.t;
/** L'état réel des tables à cet instant, au même format JSON que le journal. */
export async function state(db: PGlite): Promise<{ events: unknown[]; pumps: unknown[]; baby: unknown }> {
  const q = async (t: string): Promise<unknown[]> => (await db.query<{ s: unknown[] }>(`select coalesce(jsonb_agg(to_jsonb(x) - 'photo' order by x.id), '[]') as s from ${t} x`)).rows[0]!.s;
  return { events: await q('events'), pumps: await q('pumps'), baby: (await q('baby'))[0] ?? null };
}
