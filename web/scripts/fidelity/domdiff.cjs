// Compare le DOM produit par le moteur officiel et par l'app : outerHTML de .app sans les attributs data-dc-*
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), http = require('http');
const SITE = path.join(__dirname, '..', '..', 'e2e-shots', 'site');
fs.mkdirSync(SITE, { recursive: true });
if (!process.env.DC_RUNTIME) throw new Error('DC_RUNTIME : chemin du support.js (moteur officiel des maquettes) requis');
fs.copyFileSync(process.env.DC_RUNTIME, path.join(SITE, 'support.js'));
fs.copyFileSync(path.join(__dirname, '..', '..', '..', 'maquettes', 'v5', 'project', 'Prototype.dc.html'), path.join(SITE, 'Prototype.dc.html'));
const APP = process.env.APP_URL || 'http://localhost:3100';
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); r.end(fs.readFileSync(f)); }).listen(0);
const props = process.argv[2] || 'screen=accueil';
const parse = (s) => s.split(',').map((kv) => kv.split('='));
const norm = (h) => h.replace(/\sdata-dc-tpl="[^"]*"/g, '').replace(/\sdata-[a-z-]+="[^"]*"/g, '').replace(/<!--.*?-->/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ');
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const side of ['mock', 'app']) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    if (side === 'mock') {
      fs.writeFileSync(path.join(SITE, 'F.dc.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>t</title><script src="./support.js"></script></head><body><x-dc><helmet><style>body{margin:0}</style></helmet><div style="width:390px;height:844px"><dc-import name="Prototype" ${parse(props).map(([k, v]) => `${k}="${v}"`).join(' ')} hint-size="390px,844px"></dc-import></div></x-dc><script type="text/x-dc" data-dc-script data-props='{}'>class Component extends DCLogic { renderVals() { return {}; } }</script></body></html>`);
      await pg.goto('http://localhost:' + srv.address().port + '/F.dc.html');
    } else await pg.goto(`${APP}/mockup?` + parse(props).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'));
    await pg.waitForSelector('.app'); await pg.waitForTimeout(1200);
    out[side] = norm(await pg.evaluate(() => document.querySelector('.app').outerHTML));
    await pg.close();
  }
  const a = out.mock, c = out.app;
  console.log('longueurs :', a.length, c.length);
  let i = 0; while (i < a.length && i < c.length && a[i] === c[i]) i++;
  if (i === a.length && i === c.length) console.log('DOM IDENTIQUE');
  else { console.log('premier écart à', i); console.log('mock :', a.slice(Math.max(0, i - 120), i + 160)); console.log('app  :', c.slice(Math.max(0, i - 120), i + 160)); }
  await b.close(); srv.close();
})();


