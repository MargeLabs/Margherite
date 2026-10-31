// Extrait de la maquette V5 (maquettes/v5/project/Prototype.dc.html) les trois pièces de l'app :
//   le CSS, le gabarit, et la logique. Rien n'est réécrit : tout est repris tel quel.
// Deux variantes :
//   - « mockup » : la maquette telle quelle (référence de fidélité, route /mockup)
//   - « app »    : la même, plus les correctifs de `patches.mjs` (vraies données)
// Et le jeu de démonstration (les 28 jours d'exemple de la maquette) pour tester l'app sans base.
// Usage : npm run gen:view
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appPatches, mockupPatches } from './patches.mjs';

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

const css = between('<style>', '</style>').text;
const helmetEnd = html.indexOf('</helmet>') + '</helmet>'.length;
const template = html.slice(helmetEnd, html.indexOf('</x-dc>')).trim();
const scriptOpen = html.indexOf('<script type="text/x-dc" data-dc-script');
const scriptBodyStart = html.indexOf('>', scriptOpen) + 1;
const propsAttr = html.slice(scriptOpen, scriptBodyStart).match(/data-props='([\s\S]*?)'>$/);
if (!propsAttr) throw new Error('data-props introuvable');
const logic = html.slice(scriptBodyStart, html.indexOf('</script>', scriptBodyStart)).trim();
const defaults = {};
for (const [k, v] of Object.entries(JSON.parse(propsAttr[1]))) if (v && typeof v === 'object' && 'default' in v) defaults[k] = v.default;

function apply(patches, tpl0, logic0) {
  let tpl = tpl0;
  let lg = logic0;
  const names = [];
  for (const p of patches) {
    if (p.in === 'css') throw new Error('correctifs CSS non gérés');
    const target = p.in === 'template' ? tpl : lg;
    const want = p.count ?? 1;
    let next;
    let count;
    if (p.find instanceof RegExp) {
      const re = new RegExp(p.find.source, p.find.flags.includes('g') ? p.find.flags : p.find.flags + 'g');
      count = (target.match(re) ?? []).length;
      next = target.replace(re, () => p.replace);
    } else {
      count = target.split(p.find).length - 1;
      next = target.split(p.find).join(p.replace);
    }
    if (count !== want) throw new Error(`correctif « ${p.name} » : ${count} occurrence(s) au lieu de ${want}`);
    if (p.in === 'template') tpl = next;
    else lg = next;
    names.push(p.name);
  }
  return { tpl, lg, names };
}

const logicFile = (lg) => `// GÉNÉRÉ par scripts/gen-view.mjs depuis la maquette V5 : ne pas modifier à la main.\n// eslint-disable\nexport function createLogicClass(DCLogic) {\n${lg}\nreturn Component;\n}\n`;
const templateFile = (tpl) => `// GÉNÉRÉ par scripts/gen-view.mjs : ne pas modifier à la main.\nexport const template: string = ${JSON.stringify(tpl)};\n`;

const mock = apply(mockupPatches, template, logic);
const app = apply(appPatches, template, logic);

writeFileSync(join(OUT, 'mockup.generated.css'), `/* GÉNÉRÉ par scripts/gen-view.mjs depuis la maquette V5 : ne pas modifier à la main. */\n${css.trim()}\n`);
writeFileSync(join(OUT, 'template.generated.ts'), templateFile(mock.tpl));
writeFileSync(join(OUT, 'logic.generated.js'), logicFile(mock.lg));
writeFileSync(join(OUT, 'props.generated.json'), `${JSON.stringify(defaults, null, 2)}\n`);
writeFileSync(join(OUT, 'app.template.generated.ts'), templateFile(app.tpl));
writeFileSync(join(OUT, 'app.logic.generated.js'), logicFile(app.lg));

// jeu de démonstration : exactement ce que la maquette calcule, évalué hors navigateur
const Component = new Function(`${logicFile(logic).replace('export function createLogicClass', 'function createLogicClass')}; return createLogicClass;`)()(class {});
const base = new Component().base();
const w0 = logic.match(/    const W0 = (\{[\s\S]*?\n    \});\n/);
if (!w0) throw new Error('W0 introuvable');
const well = new Function(`return ${w0[1]}`)();
writeFileSync(
  join(OUT, 'demo.generated.json'),
  `${JSON.stringify({ note: 'GÉNÉRÉ par scripts/gen-view.mjs : les 28 jours d’exemple de la maquette (jour 27 = aujourd’hui, minutes depuis l’origine).', events: base.ev, pumps: base.pump, well })}\n`,
);

console.log(`ok : css ${css.length} o, gabarit ${template.length} o, logique ${logic.length} o · maquette ${mock.names.length} correctif(s), app ${app.names.length} correctif(s) · démo ${base.ev.length} événements, ${base.pump.length} tirages`);
