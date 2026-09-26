// Renders assets/icon.svg into every PNG size the PWA and iPhone need.
// Usage: npm run icons   (uses the locally installed Chromium via Playwright)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'assets/icon.svg'), 'utf8');
const out = resolve(root, 'public/icons');
mkdirSync(out, { recursive: true });

const targets = [
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  // maskable: keep the emblem inside the 80% safe zone
  { file: 'icon-maskable-512.png', size: 512, pad: 0.12 },
];

const executablePath = process.env.CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const scale = 1 - t.pad * 2;
  const offset = (512 * (1 - scale)) / 2;
  const body = svg
    .replace('width="512" height="512"', `width="${t.size}" height="${t.size}"`)
    .replace('<g id="emblem">', `<g id="emblem" transform="translate(${offset} ${offset}) scale(${scale})">`);
  const html = `<html><body style="margin:0;width:${t.size}px;height:${t.size}px;overflow:hidden">${body}</body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: resolve(out, t.file), clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('wrote', t.file);
}
await browser.close();
