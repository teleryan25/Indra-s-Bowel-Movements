// Mobile QA: drives the built app at real iPhone viewports, seeds synthetic
// history (in the browser only), screenshots every screen and checks for
// horizontal overflow, tiny touch targets and console errors.
// Usage: npm run build && npx vite preview --port 4173 & ; QA_URL=http://localhost:4173/ npm run qa
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.QA_URL || 'http://localhost:4173/';
const OUT = process.env.QA_OUT || 'qa-screenshots';
mkdirSync(OUT, { recursive: true });

function seedEvents(days = 160, seed = 7) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [];
  const now = new Date();
  for (let i = days; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (rand() < 0.2) continue;
    const n = rand() < 0.18 ? (rand() < 0.2 ? 3 : 2) : 1;
    for (let k = 0; k < n; k++) {
      const base = k === 0 ? 7.5 + rand() * 3 : 13 + rand() * 8;
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(base), Math.floor(rand() * 60));
      out.push({ id: `seed-${i}-${k}`, ts: t.getTime(), createdAt: t.getTime(), source: 'tap' });
    }
  }
  return out;
}

const viewports = [
  { name: 'iphone15', ...devices['iPhone 15'] },
  { name: 'iphone-se', ...devices['iPhone SE'] },
  { name: 'iphone15-landscape', ...devices['iPhone 15 landscape'] },
];

const problems = [];
const browser = await chromium.launch();
for (const vp of viewports) {
  const { name, ...opts } = vp;
  const context = await browser.newContext({ ...opts, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  const check = async (label) => {
    const r = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.chips') && !el.closest('.radar') && !el.closest('.sr-only') && !el.closest('canvas');
      }).slice(0, 5).map((el) => `${el.tagName}.${el.className}`);
      const small = [...document.querySelectorAll('button, a, input, [role=switch]')].filter((el) => {
        const b = el.getBoundingClientRect();
        if (!b.width || el.closest('.sr-only') || el.classList.contains('sr-only')) return false;
        if (el.matches('.switch input')) return false;
        return b.height < 36 || b.width < 36;
      }).slice(0, 5).map((el) => `${el.tagName}.${el.className}:${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}`);
      return { overflow, wide, small };
    });
    if (r.overflow > 0 || r.wide.length) problems.push(`${name}/${label}: horizontal overflow ${r.overflow}px ${r.wide.join(', ')}`);
    if (r.small.length) problems.push(`${name}/${label}: small targets ${r.small.join(', ')}`);
  };

  const shot = async (label) => {
    await page.waitForTimeout(350);
    await check(label);
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: true });
  };

  const tabs = ['today', 'calendar', 'intel', 'awards', 'settings'];
  await page.goto(URL);
  await page.waitForSelector('.tabbar');
  await shot('empty-today');
  await page.click('.tab >> text=Intel');
  await shot('empty-intel');

  // Seed history directly into on-device storage, then reload.
  await page.evaluate(async (events) => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('indras-bowel-operations-center');
      r.onsuccess = () => {
        const tx = r.result.transaction('events', 'readwrite');
        for (const e of events) tx.objectStore('events').put(e);
        tx.oncomplete = () => { r.result.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
      r.onerror = () => rej(r.error);
    });
  }, seedEvents());
  await page.goto(URL);
  await page.waitForSelector('.hero');
  await shot('seeded-today');
  await page.click('text=YES, I DID THE THING');
  await page.waitForSelector('.celebrate, .toast');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}-celebration.png` });
  await page.click('.celebrate');
  await shot('after-record');
  for (const t of tabs.slice(1)) {
    await page.click(`.tab >> text=${t[0].toUpperCase() + t.slice(1)}`);
    await shot(`seeded-${t}`);
  }
  // Calendar day sheet
  await page.click('.tab >> text=Calendar');
  await page.click('.cal-cell.today');
  await shot('day-sheet');
  await page.keyboard.press('Escape');
  // Archive
  await page.click('.tab >> text=Intel');
  await page.click('text=Insight Archive');
  await shot('archive');

  if (errors.length) problems.push(`${name}: console errors: ${errors.join(' | ')}`);
  await context.close();
}
await browser.close();
console.log(problems.length ? `QA found ${problems.length} issue(s):\n- ${problems.join('\n- ')}` : 'QA: no layout problems found');
