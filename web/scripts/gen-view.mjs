// Extrait de la maquette V5 (maquettes/v5/project/Prototype.dc.html) les trois pièces de l'app :
//   le CSS, le gabarit, et la logique. Rien n'est réécrit : tout est repris tel quel (+ éventuels correctifs de `patches.mjs`).
// Usage : npm run gen:view
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patches } from './patches.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'maquettes', 'v5', 'project', 'Prototype.dc.html');
const OUT = join(here, '..', 'src', 'legacy');
mkdirSync(OUT, { recursive: true });

const html = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

function between(start, end, from = 0) {
  const a = html.indexOf(start, from);
  if (a < 0) throw new Error(`introuvable : ${start}`);
  const b = html.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`introuvable : ${end}`);
  return { text: html.slice(a + start.length, b), end: b + end.length };
}

// 1. CSS : le contenu de <helmet><style>
const css = between('<style>', '</style>').text;
// 2. gabarit : ce qui suit </helmet> jusqu'à </x-dc>
const helmetEnd = html.indexOf('</helmet>') + '</helmet>'.length;
const template = html.slice(helmetEnd, html.indexOf('</x-dc>')).trim();
// 3. logique : le script, après la ligne des props
const scriptOpen = html.indexOf('<script type="text/x-dc" data-dc-script');
const scriptBodyStart = html.indexOf('>', scriptOpen) + 1;
const propsAttr = html.slice(scriptOpen, scriptBodyStart).match(/data-props='([\s\S]*?)'>$/);
if (!propsAttr) throw new Error('data-props introuvable');
let logic = html.slice(scriptBodyStart, html.indexOf('</script>', scriptBodyStart)).trim();
const defaults = {};
for (const [k, v] of Object.entries(JSON.parse(propsAttr[1]))) if (v && typeof v === 'object' && 'default' in v) defaults[k] = v.default;

let tpl = template;
const applied = [];
for (const p of patches) {
  const target = p.in === 'template' ? tpl : p.in === 'css' ? css : logic;
  const count = target.split(p.find).length - 1;
  if (count !== (p.count ?? 1)) throw new Error(`correctif « ${p.name} » : ${count} occurrence(s) au lieu de ${p.count ?? 1}`);
  const next = target.split(p.find).join(p.replace);
  if (p.in === 'template') tpl = next;
  else if (p.in === 'logic') logic = next;
  applied.push(p.name);
}

writeFileSync(join(OUT, 'mockup.generated.css'), `/* GÉNÉRÉ par scripts/gen-view.mjs depuis la maquette V5 : ne pas modifier à la main. */\n${css.trim()}\n`);
writeFileSync(join(OUT, 'template.generated.ts'), `// GÉNÉRÉ par scripts/gen-view.mjs : ne pas modifier à la main.\nexport const template: string = ${JSON.stringify(tpl)};\n`);
writeFileSync(join(OUT, 'logic.generated.js'), `// GÉNÉRÉ par scripts/gen-view.mjs depuis la maquette V5 : ne pas modifier à la main.\n// eslint-disable\nexport function createLogicClass(DCLogic) {\n${logic}\nreturn Component;\n}\n`);
writeFileSync(join(OUT, 'props.generated.json'), `${JSON.stringify(defaults, null, 2)}\n`);
console.log(`ok : css ${css.length} o, gabarit ${tpl.length} o, logique ${logic.length} o, ${applied.length} correctif(s)`);
