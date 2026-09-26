// Post-build sanity checks for the production bundle (run automatically by `npm run build`).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const base = process.env.BASE_PATH || '/';
const fail = (m) => { console.error(`✗ build verification failed: ${m}`); process.exit(1); };
const need = (p) => existsSync(resolve(dist, p)) || fail(`missing dist/${p}`);

['index.html', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg'].forEach(need);

const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
if (!html.includes(`${base}manifest.webmanifest`)) fail(`index.html does not link ${base}manifest.webmanifest`);
if (!html.includes(`${base}icons/apple-touch-icon.png`)) fail('index.html is missing the apple-touch-icon');
if (!html.includes('viewport-fit=cover')) fail('viewport is missing viewport-fit=cover');
if (!/<script type="module" crossorigin src="[^"]+\.js">/.test(html)) fail('index.html has no module bundle');
if (/https?:\/\/(?!www\.w3\.org)/.test(html)) fail('index.html references an external origin');

const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone') fail('manifest display must be standalone');
if (!manifest.icons?.some((i) => i.sizes === '512x512')) fail('manifest needs a 512px icon');

const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
if (sw.includes('__PRECACHE__') || sw.includes('__VERSION__')) fail('service worker placeholders were not replaced');
const assets = readdirSync(resolve(dist, 'assets'));
for (const a of assets) if (!sw.includes(`./assets/${a}`)) fail(`service worker does not precache assets/${a}`);

const js = assets.filter((a) => a.endsWith('.js')).map((a) => readFileSync(resolve(dist, 'assets', a), 'utf8')).join('\n');
for (const banned of ['google-analytics', 'googletagmanager', 'segment.io', 'mixpanel', 'sentry.io']) {
  if (js.includes(banned)) fail(`bundle references a tracking service: ${banned}`);
}
console.log(`✓ build verified (${assets.length} assets precached, base ${base})`);
