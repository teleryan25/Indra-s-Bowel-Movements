/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// GitHub Pages serves the app from /<repo-name>/. CI passes BASE_PATH; locally we use '/'.
const base = process.env.BASE_PATH || '/';

/**
 * Emits sw.js with a precache manifest of every built file, so the full
 * app shell works offline after the very first visit. No workbox needed.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'ibo-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = [
        'manifest.webmanifest',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'icons/favicon.svg',
      ];
      const precache = ['./', ...files, ...publicFiles].map((f) => (f === './' ? './' : `./${f}`));
      const hash = createHash('sha256');
      for (const f of files) {
        const item = bundle[f];
        hash.update(f);
        hash.update(item.type === 'chunk' ? item.code : String(item.source));
      }
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(resolve(__dirname, 'src/sw-template.js'), 'utf8');
      const source = template
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
        .replace('__VERSION__', JSON.stringify(version));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), serviceWorkerPlugin()],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    testTimeout: 30000,
  },
});
