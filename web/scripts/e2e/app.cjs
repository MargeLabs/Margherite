// Parcours réel de l'app (mode local, deux onglets = deux téléphones) : premier lancement, chrono partagé, persistance, import tire-lait, profil.
// usage : NEXT_PUBLIC_DATA=local next start -p 3100, puis `node scripts/e2e/app.cjs`
const { chromium } = require('playwright-core');
const path = require('path');
const APP = process.env.APP_URL || 'http://localhost:3100';
const CSV = path.join(__dirname, '..', '..', 'src', 'data', '__fixtures__', 'margherite-2026-10-31.csv');
let failed = 0;
const closePop = async (pg) => { const ok = pg.locator('.scrim.pp').getByRole('button', { name: 'OK' }); if (await ok.count()) await ok.first().click(); await pg.waitForTimeout(200); };
const ok = (cond, label) => { console.log((cond ? 'OK   ' : 'FAIL ') + label); if (!cond) failed++; };
const text = async (pg) => (await pg.locator('.app').innerText()).replace(/[  ]/g, ' ');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  const A = await ctx.newPage();
  A.on('pageerror', (e) => errors.push(e.message));
  A.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await A.goto(APP + '/');
  await A.waitForSelector('.welcome', { timeout: 15000 });

  // 1. premier lancement : tout est obligatoire
  ok((await text(A)).includes('Bienvenue dans Margherite'), 'premier lancement affiché');
  await A.getByRole('button', { name: 'Commencer' }).click(); await A.waitForTimeout(250);
  ok((await text(A)).includes('Donne un prénom'), 'prénom obligatoire');
  await A.locator('input[type=text]').fill('Léo');
  await A.getByRole('button', { name: 'Commencer' }).click(); await A.waitForTimeout(250);
  ok((await text(A)).includes('date de naissance'), 'date obligatoire');
  const d = new Date(Date.now() - 63 * 864e5);
  const p2 = (n) => String(n).padStart(2, '0');
  await A.locator('input[type=date]').fill(`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`);
  await A.getByRole('button', { name: 'Commencer' }).click(); await A.waitForTimeout(250);
  ok((await text(A)).includes('heure de naissance'), 'heure obligatoire');
  await A.locator('input[type=time]').fill('08:42');
  await A.getByRole('button', { name: 'Commencer' }).click(); await A.waitForTimeout(250);
  await A.waitForSelector('.bc', { timeout: 10000 });
  ok((await text(A)).includes('9 semaines'), 'accueil avec l’âge calculé (9 semaines)');
  ok((await text(A)).includes('8:42'), 'heure de naissance affichée');

  // 2. chrono partagé : B est un second téléphone ouvert sur la même base
  const B = await ctx.newPage();
  B.on('pageerror', (e) => errors.push(e.message));
  await B.goto(APP + '/');
  await B.waitForSelector('.bc');
  ok(!(await text(B)).includes('Il dort'), 'B : personne ne dort au départ');
  await A.locator('button.fab').click();
  await A.locator('[role=menuitem]', { hasText: 'Dodo' }).first().click();
  await A.getByRole('button', { name: /Lancer le chrono depuis/ }).click();
  await A.waitForTimeout(600);
  await closePop(A);
  ok((await text(A)).includes('Il dort'), 'A : le chrono tourne');
  await B.waitForFunction(() => document.querySelector('.app').innerText.includes('Il dort'), null, { timeout: 8000 }).catch(() => {});
  ok((await text(B)).includes('Il dort'), 'B voit le chrono lancé par A');
  // B l'arrête
  await B.locator('button.fab').click();
  await B.locator('[role=menuitem]', { hasText: 'Arrêter' }).first().click();
  await B.getByRole('button', { name: /Enregistrer ce réveil/ }).click();
  await B.waitForTimeout(600); await closePop(B);
  ok(!(await text(B)).includes('Il dort'), 'B : le chrono est arrêté');
  await A.waitForFunction(() => !document.querySelector('.app').innerText.includes('Il dort'), null, { timeout: 8000 }).catch(() => {});
  ok(!(await text(A)).includes('Il dort'), 'A voit l’arrêt fait par B');
  await A.getByRole('button', { name: 'Journal', exact: true }).click();
  await A.waitForTimeout(400);
  ok(/Sieste|Sommeil de nuit/.test(await text(A)), 'le dodo apparaît au Journal chez A');

  // 3. un biberon, puis rechargement : les données restent
  await A.getByRole('button', { name: 'Accueil', exact: true }).click();
  await A.locator('button.fab').click();
  await A.locator('[role=menuitem]', { hasText: 'Biberon' }).first().click();
  await A.getByRole('button', { name: /Enregistrer 1\d0 mL/ }).click();
  await A.waitForTimeout(700); await closePop(A);
  await A.reload();
  await A.waitForSelector('.bc');
  ok((await text(A)).includes('Léo') && /\d+ mL/.test(await text(A)), 'après rechargement : bébé et biberon sont toujours là');

  // 4. import du carnet tire-lait (CSV de l'ancienne app)
  await A.getByRole('button', { name: /Journal tire-lait/ }).click();
  await A.waitForSelector('.pj-w');
  const [chooser] = await Promise.all([A.waitForEvent('filechooser'), A.getByRole('button', { name: /Importer l’ancien carnet/ }).click()]);
  await chooser.setFiles(CSV);
  await A.waitForFunction(() => /tirages? ajoutés?/.test(document.querySelector('.toast')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  const t1 = await A.locator('.toast').innerText().catch(() => '');
  ok(/64 tirages ajoutés/.test(t1), 'import CSV : 64 tirages ajoutés (' + t1.replace(/\n/g, ' ') + ')');
  const [chooser2] = await Promise.all([A.waitForEvent('filechooser'), A.getByRole('button', { name: /Importer l’ancien carnet/ }).click()]);
  await chooser2.setFiles(CSV);
  await A.waitForFunction(() => /Aucun nouveau/.test(document.querySelector('.toast')?.innerText || ''), null, { timeout: 8000 }).catch(() => {});
  ok(/Aucun nouveau tirage/.test(await A.locator('.toast').innerText().catch(() => '')), 'second import : rien n’est doublé');
  await A.locator('.sheet .x').click(); await A.waitForTimeout(250);

  // 5. profil : modifier le prénom
  await A.getByRole('button', { name: 'Profil et sauvegarde' }).click();
  await A.waitForSelector('.sheet');
  await A.locator('.sheet input[type=text]').fill('Léonie');
  await A.getByRole('button', { name: 'Enregistrer' }).click();
  await A.waitForTimeout(600);
  ok((await text(A)).includes('Léonie'), 'profil : le prénom est modifié sur la carte');

  // 6. rien d'inattendu en console
  const real = errors.filter((e) => !/fonts\.g|Failed to load resource|net::ERR/.test(e));
  ok(real.length === 0, 'console propre' + (real.length ? ' : ' + real.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(failed ? `\n${failed} échec(s)` : '\nTout est vert.');
  process.exit(failed ? 1 : 0);
})();



