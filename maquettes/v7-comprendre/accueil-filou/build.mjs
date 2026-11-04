import fs from 'node:fs';
// Assemble la page : CSS de Filou, dessin de la scène et script de démonstration sont copiés dans un seul fichier.
const ts = fs.readFileSync('../../../web/src/comprendre/filou.generated.ts', 'utf8');
const grab = (n) => JSON.parse(ts.match(new RegExp('^export const ' + n + ': string = (".*");\s*$', 'm'))[1]);
const scene = grab('FILOU_SCENE'), defs = grab('FILOU_DEFS');
const css = fs.readFileSync('../filou.css', 'utf8') + '\n' + fs.readFileSync('../filou-extra.css', 'utf8');
let html = fs.readFileSync('page.html', 'utf8');
html = html
  .replace('</style>', () => css + '\n</style>')
  .replace('__SCENE__', () => JSON.stringify(scene))
  .replace('__DEFS__', () => JSON.stringify(defs))
  .replace('__LIVE__', () => fs.readFileSync('live.js', 'utf8'));
fs.writeFileSync('index.html', html);
console.log('ok', html.length);
