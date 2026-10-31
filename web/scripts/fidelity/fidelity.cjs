// Fidélité : la maquette rendue par le moteur officiel (support.js) contre l'app Next.js (/mockup), mêmes réglages, mêmes clics.
// usage : node fidelity.cjs [filtre]   -> écrit fid/mock/*.png et fid/app/*.png, puis python fidcmp.py compare
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'), http = require('http');
const SITE = path.join(__dirname, '..', '..', 'e2e-shots', 'site'), ROOT = path.join(__dirname, '..', '..', 'e2e-shots', 'fid');
const APP = process.env.APP_URL || 'http://localhost:3100';
fs.mkdirSync(path.join(ROOT, 'mock'), { recursive: true }); fs.mkdirSync(path.join(ROOT, 'app'), { recursive: true });
fs.mkdirSync(SITE, { recursive: true });
if (!process.env.DC_RUNTIME) throw new Error('DC_RUNTIME : chemin du support.js (moteur officiel des maquettes) requis');
fs.copyFileSync(process.env.DC_RUNTIME, path.join(SITE, 'support.js'));
fs.copyFileSync(path.join(__dirname, '..', '..', '..', 'maquettes', 'v5', 'project', 'Prototype.dc.html'), path.join(SITE, 'Prototype.dc.html'));
const srv = http.createServer((q, r) => { const f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); r.end(fs.readFileSync(f)); }).listen(0);

const CASES = [
  ['accueil', 'screen=accueil'],
  ['accueil-sombre', 'screen=accueil,theme=sombre'],
  ['pilotage-jour', 'screen=pilotage'],
  ['pilotage-semaine', 'screen=pilotage,pview=semaine'],
  ['pilotage-semaine-repas', 'screen=pilotage,pview=semaine,wsel=repas'],
  ['comprendre-retenir', 'screen=comprendre,cview=ret'],
  ['comprendre-explorer', 'screen=comprendre,cview=hc'],
  ['popup-sommeil', 'screen=comprendre,cview=hc', ['xp:Son sommeil et ses cycles']],
  ['popup-siestes', 'screen=comprendre,cview=hc', ['xp:Ses siestes et ses temps']],
  ['popup-alimentation', 'screen=comprendre,cview=hc', ['xp:Son alimentation']],
  ['popup-habitudes', 'screen=comprendre,cview=hc', ['xp:Ses habitudes et leurs']],
  ['popup-journee', 'screen=comprendre,cview=hc', ['css:.hcard.day .sm4-c']],
  ['popup-nuit', 'screen=comprendre,cview=hc', ['css:.hcard.night .sm4-c']],
  ['journal-jour', 'screen=journal'],
  ['journal-calendrier', 'screen=journal,jview=cal'],
  ['feuille-biberon', 'screen=accueil', ['fab:Biberon']],
  ['feuille-dodo', 'screen=accueil', ['fab:Dodo']],
  ['menu-plus', 'screen=accueil', ['fabopen']],
  ['accueil-edition', 'screen=accueil', ['aria:Modifier l’accueil']],
];
const only = process.argv[2];
const parse = (s) => s.split(',').map((kv) => kv.split('='));

async function snap(pg, dir, name) {
  const target = await pg.evaluate(() => { const m = document.querySelector('.sheet.xm'); const sc = document.querySelector('.scroll'); return m ? 'xm' : sc ? 'scroll' : 'none'; });
  const sel = target === 'xm' ? '.sheet.xm' : '.scroll';
  const h = await pg.evaluate((s) => { const e = document.querySelector(s); return e ? e.scrollHeight : 844; }, sel);
  const n = Math.min(8, Math.ceil(h / 640));
  for (let i = 0; i < n; i++) {
    await pg.evaluate(([s, y]) => { const e = document.querySelector(s); if (e) e.scrollTop = y; }, [sel, i * 640]);
    await pg.waitForTimeout(120);
    await pg.screenshot({ path: path.join(ROOT, dir, `${name}_${i}.png`) });
  }
  return h;
}
async function act(pg, step) {
  const [k, v] = [step.slice(0, step.indexOf(':')), step.slice(step.indexOf(':') + 1)];
  let loc;
  if (step === 'fabopen') loc = pg.locator('button.fab');
  else if (k === 'fab') { await pg.locator('button.fab').click(); await pg.waitForTimeout(250); loc = pg.locator('[role=menuitem]', { hasText: v }).first(); }
  else if (k === 'xp') loc = pg.locator('button.xp-h', { hasText: v }).first();
  else if (k === 'css') loc = pg.locator(v).first();
  else if (k === 'aria') loc = pg.locator(`button[aria-label="${v}"]`).first();
  await loc.scrollIntoViewIfNeeded(); await loc.click(); await pg.waitForTimeout(350);
}

(async () => {
  const b = await chromium.launch();
  for (const [name, props, steps] of CASES) {
    if (only && !name.includes(only)) continue;
    for (const side of ['mock', 'app']) {
      const pg = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' || /dc-runtime|dc-engine/.test(m.text())) errs.push(m.text().slice(0, 160)); });
      if (side === 'mock') {
        const attrs = parse(props).map(([k, v]) => `${k}="${v}"`).join(' ');
        fs.writeFileSync(path.join(SITE, 'F.dc.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>t</title><script src="./support.js"></script></head><body><x-dc><helmet><style>body{margin:0}</style></helmet><div style="width:390px;height:844px"><dc-import name="Prototype" ${attrs} hint-size="390px,844px"></dc-import></div></x-dc><script type="text/x-dc" data-dc-script data-props='{}'>class Component extends DCLogic { renderVals() { return {}; } }</script></body></html>`);
        await pg.goto('http://localhost:' + srv.address().port + '/F.dc.html');
      } else {
        // APP_MODE=app : l'app réelle (dépôt local, 28 jours d'exemple, heure figée à 14:20) au lieu de la maquette brute
        const q = parse(props).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        await pg.goto(process.env.APP_MODE === 'app' ? `${APP}/?demo=1&now=2026-10-27T14%3A20&${q}` : `${APP}/mockup?${q}`);
      }
      await pg.waitForSelector('.app', { timeout: 15000 }); await pg.waitForTimeout(1400);
      for (const s of steps || []) await act(pg, s);
      const h = await snap(pg, side, name);
      console.log(name, side, 'h=' + h, errs.filter((e) => !/moveto/.test(e)).slice(0, 2).join(' | ') || '');
      await pg.close();
    }
  }
  await b.close(); srv.close();
})();

