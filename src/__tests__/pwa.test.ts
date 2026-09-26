import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('PWA configuration', () => {
  it('has a complete standalone web app manifest', () => {
    const m = JSON.parse(read('public/manifest.webmanifest'));
    expect(m.name).toContain('Bowel Operations Center');
    expect(m.short_name.length).toBeLessThanOrEqual(12);
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) expect(() => readFileSync(resolve(root, 'public', i.src))).not.toThrow();
  });

  it('index.html is set up for iPhone home screen use', () => {
    const html = read('index.html');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('theme-color');
    expect(html).not.toMatch(/googletagmanager|analytics|fonts\.googleapis/);
  });

  it('service worker caches the app shell and supports updates', () => {
    const sw = read('src/sw-template.js');
    expect(sw).toContain('__PRECACHE__');
    expect(sw).toContain('SKIP_WAITING');
    expect(sw).toContain("req.mode === 'navigate'");
    expect(sw).not.toMatch(/indexedDB|localStorage/);
  });

  it('apple touch icon is 180×180', () => {
    const png = readFileSync(resolve(root, 'public/icons/apple-touch-icon.png'));
    expect(png.readUInt32BE(16)).toBe(180);
    expect(png.readUInt32BE(20)).toBe(180);
  });
});
