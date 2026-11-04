// Extrait de la maquette validée (maquettes/v7-comprendre/) les pièces de la page Comprendre de l'app :
//   le gabarit (page et feuilles), le CSS (page + Filou) et le dessin de Filou. Rien n'est redessiné : tout est repris tel quel.
// Usage : npm run gen:comprendre
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'maquettes', 'v7-comprendre');
const OUT = join(here, '..', 'src', 'comprendre');
mkdirSync(OUT, { recursive: true });
const read = (f) => readFileSync(join(SRC, f), 'utf8').replace(/\r\n/g, '\n');

function cut(text, start, end, label) {
  const a = text.indexOf(start);
  if (a < 0) throw new Error(`introuvable : ${label ?? start}`);
  const b = text.indexOf(end, a + start.length);
  if (b < 0) throw new Error(`introuvable : ${label ?? end}`);
  return text.slice(a + start.length, b);
}

// ---------------------------------------------------------------- page : gabarit
const main = read('Main.dc.html');
const symbols = cut(main, '<div class="cp {{themeCls}}">\n\n', '<div class="cp-scroll">', 'symboles').trim();
const body = cut(main, '<div class="cp-scroll">\n', '\n</div>\n\n<!-- ===== Navigation', 'corps de page').trim();
const sheets = cut(main, '<!-- ===== Feuille : étape par étape ===== -->', '\n</div>\n</div>\n\n<!-- ===== Panneau de démo', 'feuilles').trim();
const assembled = [
  '<div class="cmp">',
  symbols,
  '<div class="cp-scroll">',
  body,
  '</div>',
  '<dc-import name="Portal">',
  '<!-- ===== Feuille : étape par étape ===== -->',
  sheets,
  '</dc-import>',
  '</div>',
].join('\n');

// Les textes de démonstration de la maquette deviennent des trous remplis par la vraie logique ; chaque correctif doit matcher exactement.
function rep(text, find, replace, label) {
  const parts = text.split(find);
  if (parts.length !== 2) throw new Error(`correctif « ${label} » : ${parts.length - 1} occurrence(s) au lieu de 1`);
  return parts.join(replace);
}
const E = ' hint-placeholder-val="{{ false }}"', F = ' hint-placeholder-val="{{ true }}"';
let template = assembled;
template = rep(template, 'Léo · 9 semaines', '{{ageLine}}', 'âge');
template = rep(template, `<sc-if value="{{sparse}}"${E}><div class="cp-empty">Nous apprenons encore à connaître son rythme. Deux jours notés pour l'instant : rien d'assez solide à raconter. Aucune saisie en plus n'est nécessaire.</div></sc-if>\n<sc-if value="{{notSparse}}"${F}>\n<div class="cp-keeps">`, `<sc-if value="{{keepsEmpty}}"${E}><div class="cp-empty">{{keepsMsg}}</div></sc-if>\n<sc-if value="{{keepsFull}}"${F}>\n<div class="cp-keeps">`, 'À retenir');
template = rep(template, `<sc-if value="{{sparse}}"${E}><div class="cp-empty">La journée type apparaît dès 3 journées notées en entier. Il en manque encore une.</div></sc-if>\n<sc-if value="{{notSparse}}"${F}>\n<p class="cp-brief">`, `<sc-if value="{{frEmpty}}"${E}><div class="cp-empty">{{frMsg}}</div></sc-if>\n<sc-if value="{{frFull}}"${F}>\n<p class="cp-brief">`, 'journée et nuit');
template = rep(template, "D'après 9 jours notés en entier sur les 14 derniers.</p>", '{{frBase}}</p>', 'base journée');
template = rep(template, "D'après 8 nuits notées en entier sur les 14 dernières.</p>", '{{frBase}}</p>', 'base nuit');
template = rep(template, "La nuit dernière : couché 30 min plus tard, sinon comme d'habitude.", '{{lastNightLine}}', 'nuit dernière');
template = rep(template, 'Hier : une journée proche de ses journées habituelles.', '{{lastDayLine}}', 'hier');
template = rep(template, `<sc-if value="{{sparse}}"${E}><div class="cp-empty">Il faut au moins 3 semaines notées pour voir ce qui change. Rien à faire de plus : cela se remplit tout seul.</div></sc-if>\n<sc-if value="{{notSparse}}"${F}>\n<div class="cp-chips`, `<sc-if value="{{chEmpty}}"${E}><div class="cp-empty">Il faut au moins 3 semaines notées pour voir ce qui change. Rien à faire de plus : cela se remplit tout seul.</div></sc-if>\n<sc-if value="{{chFull}}"${F}>\n<div class="cp-chips`, 'ce qui change');
template = rep(template, `<sc-if value="{{sparse}}"${E}><div class="cp-empty">Pas encore de broderie. Elles viendront d'elles-mêmes, quand une habitude se dessinera.`, `<sc-if value="{{appEmpty}}"${E}><div class="cp-empty">Pas encore de badge. Ses habitudes et ses badges apparaîtront ici, dès qu'une habitude se dessinera.`, 'album vide');
template = rep(template, 'age="2" medal="{{medalOn}}"', 'age="{{heroAge}}" medal="{{medalOn}}" symbol="{{medalSym}}"', 'Filou du portrait');
template = rep(template, "Filou grandit avec l'âge de Léo.", "Filou grandit avec l'âge de {{babyName}}.", 'âge de Filou');

// ---------------------------------------------------------------- page : CSS
let css = cut(main, '/* ===== Canaille, look Jardin ===== */', '/* ===== panneau de démo ===== */', 'css');
css = css
  .replace(/^\.cp\{--bg[\s\S]*?\}\n/m, '')
  .replace(/^\.cp\.dark\{--bg[^\n]*\}\n/m, '')
  .replace(/\.cp(?![-\w])/g, '.cmp');
if (/--lav2:#D9CCF2/.test(css)) throw new Error('le bloc de jetons de la maquette est resté dans le CSS');
const filouCss = read('filou.css') + '\n' + read('filou-extra.css');

// ---------------------------------------------------------------- Filou : dessin
const filou = read('Filou.dc.html');
const defs = cut(filou, '<sc-if value="{{showDefs}}" hint-placeholder-val="{{ true }}">\n', '\n</sc-if>', 'defs').trim();
const sceneStart = filou.indexOf('<div class="fl-scene');
const openEnd = filou.indexOf('>', sceneStart) + 1;
const endMarker = '</div>\n</div>\n</x-dc>';
const sceneEnd = filou.indexOf(endMarker);
if (sceneStart < 0 || sceneEnd < 0) throw new Error('scène de Filou introuvable');
const scene = filou
  .slice(openEnd, sceneEnd)
  .replace(' onAnimationIteration="{{onIter}}"', '')
  .replace(' onClick="{{tap}}"', '');
if (scene.includes('{{')) throw new Error('il reste un trou dans le dessin de Filou');

const header = '// GÉNÉRÉ par scripts/gen-comprendre.mjs à partir de maquettes/v7-comprendre/ : ne pas modifier à la main.\n';
writeFileSync(join(OUT, 'cmp.template.generated.ts'), `${header}export const cmpTemplate: string = ${JSON.stringify(template)};\n`);
writeFileSync(join(OUT, 'comprendre.generated.css'), `/* GÉNÉRÉ par scripts/gen-comprendre.mjs : ne pas modifier à la main. */\n${css}\n${filouCss}\n`);
writeFileSync(join(OUT, 'filou.generated.ts'), `${header}export const FILOU_DEFS: string = ${JSON.stringify(defs)};\nexport const FILOU_SCENE: string = ${JSON.stringify(scene)};\n`);
console.log('ok', { template: template.length, css: css.length + filouCss.length, defs: defs.length, scene: scene.length });
