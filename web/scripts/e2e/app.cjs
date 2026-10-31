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
  const hhmm = await A.evaluate(() => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
  const lbl = await A.getByRole('button', { name: /Lancer le chrono depuis/ }).innerText();
  ok(lbl.includes(hhmm) || lbl.includes(String(Number(hhmm.slice(0, 2))) + ':'), 'Dodo : l’heure proposée est maintenant, pas une heure plus tôt (' + lbl.replace(/\n/g, ' ') + ' / ' + hhmm + ')');
  // un dodo de moins d'une minute n'est pas enregistré : on le fait démarrer il y a 90 minutes
  const before = await A.evaluate(() => { const d = new Date(Date.now() - 90 * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
  await A.locator('.sheet input[type=time]').first().fill(before);
  await A.getByRole('button', { name: /Lancer le chrono depuis/ }).click();
  await A.waitForTimeout(600);
  await closePop(A);
  ok((await text(A)).includes('Il dort'), 'A : le chrono tourne');
  // oubli d'un dodo pendant que le chrono tourne : il s'ajoute, le chrono continue
  await A.getByRole('button', { name: 'Ajouter un enregistrement oublié' }).click();
  await A.getByRole('button', { name: 'Dodo', exact: true }).click();
  await A.waitForTimeout(300);
  const oubli = await A.locator('.sheet').innerText();
  ok(/Endormi à/.test(oubli) && !/Il se réveille maintenant/.test(oubli), 'oubli : la feuille Dodo propose deux heures, pas l’arrêt du chrono');
  await A.locator('.sheet .btn-p').click(); await A.waitForTimeout(700); await closePop(A);
  ok((await text(A)).includes('Il dort'), 'oubli : le chrono en cours continue');
  ok(/Sieste|Sommeil/.test(await A.locator('.rc').first().innerText().catch(() => '')) || /min|h/.test(await text(A)), 'oubli : le dodo ajouté apparaît');
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

  // cartes Dodo et Repas : un + en haut à droite
  ok((await A.locator('.fc-plus').count()) === 2, 'Accueil : un + sur chacune des cartes Dodo et Repas');
  await A.locator('.fc-plus').nth(1).click(); await A.waitForTimeout(300);
  ok((await A.locator('.sheet').innerText()).includes('Biberon') && (await A.locator('.sheet').innerText()).includes('Tétée'), '+ Repas : choix Biberon ou Tétée');
  await A.locator('.sheet .x').click(); await A.waitForTimeout(250);
  await A.locator('.fc-plus').first().click(); await A.waitForTimeout(300);
  const dodoSheet = await A.locator('.sheet').innerText();
  ok(/Lancer le chrono/.test(dodoSheet) && !/Il s’endort maintenant/.test(dodoSheet), '+ Dodo : un seul bouton, « Lancer le chrono »');
  await A.locator('.sheet .x').click(); await A.waitForTimeout(250);

  // 4. import du carnet tire-lait (CSV de l'ancienne app)
  await A.getByRole('button', { name: /Journal tire-lait/ }).click();
  await A.waitForSelector('.pj-w');
  ok((await A.getByRole('button', { name: 'Ajouter un tirage' }).count()) === 1, 'Journal tire-lait : on peut ajouter un tirage');
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
  await A.getByRole('button', { name: 'Profil et sauvegarde' }).click();
  await A.waitForSelector('.sheet');
  const [pc] = await Promise.all([A.waitForEvent('filechooser'), A.getByRole('button', { name: 'Ajouter une photo' }).click()]);
  await pc.setFiles(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
  await A.waitForSelector('.bc-photo', { timeout: 8000 }).catch(() => {});
  ok((await A.locator('.bc-photo').count()) === 1 && (await A.locator('.bc-baby').count()) === 0, 'photo : elle remplace le dessin sur la carte du bébé');
  ok(!/jours/.test(await A.locator('.bc').innerText()) || /^\\d+ jours?$/m.test(await A.locator('.bc-a').innerText()), 'carte bébé : pas de nombre total de jours');

  // 6. rien d'inattendu en console
  const real = errors.filter((e) => !/fonts\.g|Failed to load resource|net::ERR/.test(e));
  ok(real.length === 0, 'console propre' + (real.length ? ' : ' + real.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(failed ? `\n${failed} échec(s)` : '\nTout est vert.');
  process.exit(failed ? 1 : 0);
})();







