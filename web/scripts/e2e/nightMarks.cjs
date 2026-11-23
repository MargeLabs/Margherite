// Coucher du soir et réveil du matin déclarés (mode local, trois « soirées » avec une horloge simulée).
// usage : NEXT_PUBLIC_DATA=local next dev -p 3101 (ou next start), puis `APP_URL=http://localhost:3101 node scripts/e2e/nightMarks.cjs`
// La base locale vit dans le navigateur : on passe d'un contexte à l'autre avec `storageState`. Jamais sur la vraie base.
const { chromium } = require('playwright-core');
const APP = process.env.APP_URL || 'http://localhost:3101';
let failed = 0;
const ok = (cond, label) => { console.log((cond ? 'OK   ' : 'FAIL ') + label); if (!cond) failed++; };
const closePop = async (pg) => { const b = pg.locator('.scrim.pp').getByRole('button', { name: 'OK' }); if (await b.count()) await b.first().click(); await pg.waitForTimeout(250); };
const events = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('margherite.local.v1') || '{}').events || []);

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const open = async (time, state) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...(state ? { storageState: state } : {}) });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push(e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await pg.clock.install({ time });
    await pg.goto(APP + '/');
    return { ctx, pg };
  };
  const dodoSheet = async (pg, item) => {
    await pg.locator('button.fab').click();
    await pg.locator('[role=menuitem]', { hasText: item }).first().click();
    await pg.waitForTimeout(300);
  };

  // 1. 15 h : pas de bouton « coucher du soir » ; création du bébé
  const t1 = new Date(2026, 10, 23, 15, 0);
  const one = await open(t1);
  await one.pg.waitForSelector('.welcome', { timeout: 20000 });
  await one.pg.getByRole('button', { name: 'Commencer' }).click();
  await one.pg.locator('input[type=text]').fill('Léo');
  await one.pg.locator('input[type=date]').fill('2026-09-21');
  await one.pg.locator('input[type=time]').fill('08:42');
  await one.pg.getByRole('button', { name: 'Commencer' }).click();
  await one.pg.waitForSelector('.bc', { timeout: 15000 });
  await dodoSheet(one.pg, 'Dodo');
  ok(!(await one.pg.locator('.sheet').innerText()).includes('coucher du soir'), '15 h : pas de bouton « coucher du soir »');
  const state1 = await one.ctx.storageState();
  await one.ctx.close();

  // 2. 21 h : le bouton est là ; un toucher lance le chrono marqué « bed »
  const two = await open(new Date(2026, 10, 23, 21, 0), state1);
  await two.pg.waitForSelector('.bc', { timeout: 20000 });
  await dodoSheet(two.pg, 'Dodo');
  const btn = two.pg.getByRole('button', { name: /C’est le coucher du soir/ });
  ok((await btn.count()) === 1, '21 h : le bouton « coucher du soir » est proposé');
  if (process.env.SHOT_DIR) await two.pg.screenshot({ path: process.env.SHOT_DIR + '/bed.png' });
  await btn.click(); await two.pg.waitForTimeout(500); await closePop(two.pg);
  const ev2 = await events(two.pg);
  ok(ev2.length === 1 && ev2[0].kind === 'sleep' && ev2[0].ended_at === null && ev2[0].payload.mark === 'bed', 'chrono lancé et marqué « bed » (' + JSON.stringify(ev2.map((e) => e.payload)) + ')');
  const state2 = await two.ctx.storageState();
  await two.ctx.close();

  // 3. 2 h du matin : aucun bouton « réveil » (trop tôt) ; 6 h 30 : il est là, un toucher arrête le dodo marqué « both »
  const early = await open(new Date(2026, 10, 24, 2, 0), state2);
  await early.pg.waitForSelector('.bc', { timeout: 20000 });
  await dodoSheet(early.pg, 'Arrêter');
  ok(!(await early.pg.locator('.sheet').innerText()).includes('réveil du matin'), '2 h : pas de bouton « réveil du matin »');
  await early.ctx.close();
  const three = await open(new Date(2026, 10, 24, 6, 30), state2);
  await three.pg.waitForSelector('.bc', { timeout: 20000 });
  await dodoSheet(three.pg, 'Arrêter');
  const wake = three.pg.getByRole('button', { name: /C’est le réveil du matin/ });
  ok((await wake.count()) === 1, '6 h 30 : le bouton « réveil du matin » est proposé');
  if (process.env.SHOT_DIR) await three.pg.screenshot({ path: process.env.SHOT_DIR + '/wake.png' });
  await wake.click(); await three.pg.waitForTimeout(600); await closePop(three.pg);
  const ev3 = await events(three.pg);
  ok(ev3.length === 1 && ev3[0].ended_at !== null && ev3[0].payload.mark === 'both', 'dodo arrêté, marqué « both » (' + JSON.stringify(ev3.map((e) => e.payload)) + ')');
  ok(!(await three.pg.locator('.app').innerText()).includes('Il dort'), 'plus de chrono en cours');

  // 4. la feuille de modification montre les deux cases allumées, et on peut en retirer une
  await three.pg.getByRole('button', { name: 'Journal', exact: true }).click(); await three.pg.waitForTimeout(500);
  await three.pg.mouse.click(42, 175); await three.pg.waitForTimeout(500); // la veille : le dodo y a commencé à 21 h
  const row = three.pg.locator('button', { hasText: /21[:h]00/ }).first();
  await row.click(); await three.pg.waitForTimeout(400);
  const edit = three.pg.getByRole('button', { name: /Modifier (ce sommeil|cette sieste)/ });
  if (await edit.count()) { await edit.click(); await three.pg.waitForTimeout(400); }
  const chips = three.pg.locator('.sheet .seg button');
  console.log('     feuille : ' + ((await three.pg.locator('.sheet').first().innerText().catch(() => 'aucune feuille')).replace(/\s+/g, ' ').slice(0, 200)));
  await three.pg.screenshot({ path: process.env.SHOT || 'nightmarks-edit.png' });
  ok((await chips.count()) === 2 && (await chips.nth(0).getAttribute('class')).includes('on') && (await chips.nth(1).getAttribute('class')).includes('on'), 'modifier : « coucher » et « réveil » sont allumés');
  await chips.nth(0).click(); await three.pg.waitForTimeout(150);
  await three.pg.locator('.sheet .btn-p').click(); await three.pg.waitForTimeout(700);
  const ev4 = await events(three.pg);
  ok(ev4[0] && ev4[0].payload.mark === 'wake', 'retirer « coucher » ne laisse que « wake » (' + JSON.stringify(ev4.map((e) => e.payload)) + ')');
  await three.ctx.close();

  ok(errors.length === 0, 'console propre' + (errors.length ? ' : ' + errors.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(failed ? `\n${failed} échec(s)` : '\nTout est vert');
  process.exit(failed ? 1 : 0);
})();
