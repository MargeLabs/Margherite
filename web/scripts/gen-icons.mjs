// Fabrique le logo de l'app et les icônes installables à partir de design/canaille-icon-arrondie.svg.
//   public/logo.svg        : le logo (coins arrondis), sans le bloc de métadonnées C2PA, pour l'affichage dans l'app
//   public/icon-192.png, icon-512.png, apple-touch-icon.png (180) : carrés pleins, sans transparence
//     (l'iPhone remplit un coin transparent en noir et arrondit lui-même l'icône)
// Usage : node scripts/gen-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = readFileSync(join(root, 'design', 'canaille-icon-arrondie.svg'), 'utf8');
const clean = source.replace(/<metadata>[\s\S]*?<\/metadata>/, '').replace(/\swidth="512"\s+height="512"/, '');
const square = clean.replace('<rect width="100" height="100" rx="22"', '<rect width="100" height="100" rx="0"');
if (square === clean) throw new Error('le fond arrondi du logo est introuvable : le fichier source a changé');

writeFileSync(join(root, 'public', 'logo.svg'), clean);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(square).toString('base64')}" width="${size}" height="${size}" style="display:block"></body>`);
  await page.waitForFunction(() => document.images[0]?.complete);
  writeFileSync(join(root, 'public', name), await page.screenshot({ type: 'png' }));
}
await browser.close();
console.log('ok : logo.svg, icon-192.png, icon-512.png, apple-touch-icon.png');
