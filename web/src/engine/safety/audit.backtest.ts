// Relevé pour information des textes actuels de l'app : rien n'y est modifié. Rapport dans `data/rapports/`, avec `npm run backtest`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { checkText } from './vocabulary';

const ROOT = join(__dirname, '..', '..', 'legacy');

it('relevé', () => {
  const src = ['app.logic.generated.js', 'app.template.generated.ts'].map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
  const strings = [...new Set([...src.matchAll(/'([^'\n]{6,240})'|>([^<>{}\n]{6,240})</g)].map((m) => (m[1] ?? m[2] ?? '').trim()).filter((s) => /[a-zà-ÿ]{3,} [a-zà-ÿ]{2,}/i.test(s)))];
  const hits = strings.flatMap((s) => checkText(s).filter((v) => v.rule !== 'genre').map((v) => ({ ...v, s })));
  const by = hits.reduce<Record<string, number>>((o, h) => ({ ...o, [h.rule]: (o[h.rule] ?? 0) + 1 }), {});
  const out = ['# Relevé du vocabulaire des textes actuels (pour information)', '', `${strings.length} textes lus. ${JSON.stringify(by)}. Le genre n'est pas compté : les textes actuels disent « il ».`, '', ...hits.map((h) => `- [${h.rule}] « ${h.match} » : ${h.s.slice(0, 120)}`)];
  mkdirSync(join(ROOT, '..', '..', '..', 'data', 'rapports'), { recursive: true });
  writeFileSync(join(ROOT, '..', '..', '..', 'data', 'rapports', 'vocabulaire.md'), out.join('\n'));
  console.log(out.slice(0, 60).join('\n'));
});
