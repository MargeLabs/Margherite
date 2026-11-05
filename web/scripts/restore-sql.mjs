// Fabrique le SQL de restauration à partir d'une sauvegarde JSON (celle du bouton Profil ou de `npm run export`).
// N'exécute RIEN et ne se connecte à rien : il écrit un fichier .sql que Victor colle dans le SQL Editor s'il en a besoin.
// Sûr par construction : `on conflict do nothing` (ne remplace aucune ligne existante), une seule transaction.
//   node scripts/restore-sql.mjs ../data/canaille-sauvegarde-2026-11-05.json [sortie.sql]
// Après 0004 : une restauration passée dans le SQL Editor est tracée au journal avec la voie « sql » et la provenance « supplied »
// (created_at conservé tel que sauvegardé : rien ne prouve qu'il vient du serveur). C'est voulu : on ne ment pas sur l'origine.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output] = process.argv;
if (!input) {
  console.error('usage : node scripts/restore-sql.mjs <sauvegarde.json> [sortie.sql]');
  process.exit(1);
}
const b = JSON.parse(readFileSync(input, 'utf8'));
if (b.app !== 'canaille' || !Array.isArray(b.events) || !Array.isArray(b.pumps)) {
  console.error('Ce fichier n\'est pas une sauvegarde Canaille.');
  process.exit(1);
}
// seules les colonnes présentes dans le fichier sont insérées : les autres prennent leur valeur par défaut (un select * y mettrait des null)
const ins = (table, rows, conflict) => {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (!rows.length || cols.some((c) => !/^[a-z_]+$/.test(c))) return '';
  const json = JSON.stringify(rows);
  if (json.includes('$restore$')) throw new Error('délimiteur présent dans les données');
  const list = cols.map((c) => `"${c}"`).join(', ');
  return `insert into public.${table} (${list}) select ${list} from jsonb_populate_recordset(null::public.${table}, $restore$${json}$restore$::jsonb) on conflict ${conflict} do nothing;`;
};
// colonnes propres à 0004 : si la migration n'est pas passée, elles n'existent pas ; on ne les insère que si le fichier les contient
const kv = Object.entries(b.kv ?? {}).map(([key, value]) => ({ key, value }));
const sql = `-- Restauration depuis ${input} (sauvegarde du ${b.exportedAt}) : ${b.events.length} événements, ${b.pumps.length} tirages, ${b.baby ? 1 : 0} fiche, ${kv.length} réglages.
-- Ne remplace rien : une ligne déjà présente (même id) est laissée telle quelle.
begin;
select pg_advisory_xact_lock(918273, 1);
${b.baby ? ins('baby', [b.baby], '(id)') : ''}
${ins('events', b.events, '(id)')}
${ins('pumps', b.pumps, '(id)')}
${ins('kv', kv, '(key)')}
-- contrôle : ces trois nombres doivent être au moins ceux du fichier
select (select count(*) from public.events) as evenements, (select count(*) from public.pumps) as tirages, (select count(*) from public.baby) as fiches;
commit;
`;
const out = output ?? input.replace(/\.json$/, '') + '.restauration.sql';
writeFileSync(out, sql);
console.log(`${out} écrit (${Math.round(sql.length / 1024)} Ko). Rien n'a été exécuté.`);
