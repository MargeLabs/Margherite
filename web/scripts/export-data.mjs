// Sauvegarde locale : lit toute la base et l'écrit dans `data/`, au même format que le bouton du Profil. Aucune écriture en base.
// Le code famille vient de FAMILY_CODE dans `.env.local` (ignoré par git). Jamais de préfixe NEXT_PUBLIC : il partirait dans le site.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(web, '.env.local'));
} catch {
  // pas de fichier : le contrôle ci-dessous le dit
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key, NEXT_PUBLIC_FAMILY_EMAIL: email, FAMILY_CODE: password } = process.env;
if (!url || !key || !email) {
  console.error('web/.env.local incomplet : URL, clé publique ou e-mail famille manquant.');
  process.exit(1);
}
if (!password) {
  console.error('Ajoute FAMILY_CODE=ton-code dans web/.env.local.');
  process.exit(1);
}

// pas de session gardée, et pas de déconnexion à la fin : elle fermerait aussi la session des téléphones
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await sb.auth.signInWithPassword({ email, password });
if (authError) {
  console.error(`Connexion refusée : ${authError.message}`);
  process.exitCode = 1;
} else {
  const PAGE = 1000;
  const all = async (table, order) => {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(table).select('*').order(order).range(from, from + PAGE - 1);
      if (error) throw new Error(`${table} : ${error.message}`);
      out.push(...data);
      if (data.length < PAGE) return out;
    }
  };

  const [events, pumps] = [await all('events', 'started_at'), await all('pumps', 'at')];
  const { data: baby, error: babyError } = await sb.from('baby').select('*').maybeSingle();
  const { data: kvRows, error: kvError } = await sb.from('kv').select('key,value');
  if (babyError || kvError) throw new Error((babyError ?? kvError).message);
  const kv = Object.fromEntries(kvRows.map((r) => [r.key, r.value]));

  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dir = join(web, '..', 'data');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `canaille-sauvegarde-${day}.json`);
  writeFileSync(`${file}.tmp`, JSON.stringify({ app: 'canaille', version: 1, exportedAt: now.toISOString(), baby, events, pumps, kv }, null, 1));
  renameSync(`${file}.tmp`, file); // une coupure en cours d'écriture ne laisse jamais un fichier abîmé
  console.log(`${events.length} événements, ${pumps.length} tirages : data/canaille-sauvegarde-${day}.json`);
}
