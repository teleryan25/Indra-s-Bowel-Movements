// End-to-end check of a deployed build (default: the GitHub Pages URL).
// Usage: PROD_URL=https://<user>.github.io/<repo>/ node scripts/verify-production.mjs
import { chromium, devices } from 'playwright';

const URL = process.env.PROD_URL || 'https://teleryan25.github.io/Indra-s-Bowel-Movements/';
const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`); };

// QA_IGNORE_TLS=1 only for sandboxes whose egress proxy re-signs HTTPS
const browser = await chromium.launch(process.env.QA_IGNORE_TLS ? { args: ['--ignore-certificate-errors'] } : {});
const context = await browser.newContext({ ...devices['iPhone 15'], acceptDownloads: true, ignoreHTTPSErrors: !!process.env.QA_IGNORE_TLS });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const failed = [];
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

const res = await page.goto(URL, { waitUntil: 'networkidle' });
ok('initial load', res?.status() === 200, `HTTP ${res?.status()}`);
await page.waitForSelector('.hero');
ok('assets load without errors', failed.length === 0, failed.join(', '));

const hrefs = await page.evaluate(() => ({
  manifest: document.querySelector('link[rel=manifest]').href,
  icon: document.querySelector('link[rel=apple-touch-icon]').href,
}));
const mRes = await context.request.get(hrefs.manifest);
const mJson = mRes.ok() ? await mRes.json() : null;
ok('PWA manifest served', !!mJson && mJson.display === 'standalone');
ok('apple touch icon served', (await context.request.get(hrefs.icon)).ok());

const swReady = await page.evaluate(async () => {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 15000))]);
  return !!reg?.active;
});
ok('service worker active', swReady);

// Navigation
for (const t of ['Calendar', 'Intel', 'Awards', 'Settings', 'Today']) {
  await page.click(`.tab >> text=${t}`);
  await page.waitForTimeout(250);
}
ok('bottom navigation works', await page.isVisible('.hero'));

// Record, record another, delete
await page.click('text=YES, I DID THE THING');
await page.waitForSelector('.celebrate');
ok('recording a poop celebrates', await page.isVisible('text=Today\'s successful deployments: 1'));
await page.click('.celebrate');
await page.waitForSelector('text=Mission accomplished.');
await page.waitForTimeout(4500);
await page.click('text=Record another');
await page.waitForSelector('text=Today\'s successful deployments: 2');
ok('recording another', true);
await page.click('.celebrate');
await page.click('.tab >> text=Calendar');
await page.click('.cal-cell.today');
await page.waitForSelector('.sheet');
const before = await page.locator('.sheet .ev-row').count();
await page.locator('.sheet .del').first().click();
await page.click('text=Delete Movement');
await page.waitForTimeout(400);
ok('calendar day details + delete with confirmation', before === 2 && (await page.locator('.sheet .ev-row').count()) === 1);
await page.keyboard.press('Escape');

await page.click('.tab >> text=Intel');
ok('Intel screen', await page.isVisible('text=Today\'s Briefing'));
await page.click('text=Insight Archive');
ok('Insight Archive', await page.isVisible('h1:has-text("Insight Archive")'));
await page.click('.tab >> text=Awards');
ok('Awards screen', await page.isVisible('text=Launch Day'));
await page.click('.tab >> text=Settings');
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.click('text=Download My History')]);
let dlOk = false;
if (download) {
  const p = await download.path();
  const txt = (await import('node:fs')).readFileSync(p, 'utf8');
  dlOk = /^Indras-Poop-History-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()) && JSON.parse(txt).events.length === 1;
}
ok('Download My History', dlOk, download?.suggestedFilename());

// Persistence + direct navigation
await page.goto(`${URL}#/calendar`);
await page.waitForSelector('.cal-grid');
ok('direct navigation to #/calendar after reload', await page.isVisible('.cal-cell.today .poo'));
await page.goto(URL);
await page.waitForSelector('text=Mission accomplished.');
ok('history persists across reload', await page.isVisible('.chip-time'));

// Offline
await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
const offline = await page.waitForSelector('text=Mission accomplished.', { timeout: 10000 }).then(() => true).catch(() => false);
ok('works offline after first load', offline);
await context.setOffline(false);

// Layout
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('no horizontal overflow on iPhone', overflow <= 0, `${overflow}px`);
await page.screenshot({ path: 'qa-screenshots/production-today.png' });

ok('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
const bad = results.filter((r) => !r.pass);
console.log(bad.length ? `\n${bad.length} production check(s) FAILED` : `\nAll ${results.length} production checks passed`);
process.exit(bad.length ? 1 : 0);
