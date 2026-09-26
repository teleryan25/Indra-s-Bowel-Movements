# Indra’s Bowel Operations Center™

*Mission-critical digestive infrastructure.*

A deliberately absurd — and genuinely well-built — iPhone-first Progressive Web App that answers one question with the full seriousness it has never deserved: **did Indra poop today?**

One tap records a timestamped movement. The app then does what any over-funded enterprise analytics platform would do: dashboards, streaks, a premium calendar, 30 achievements, and the **Bowel Intelligence Division**, which slowly discovers 500 hand-authored findings about her schedule. Some of them are secretly notes from Ryan.

- **No backend, no accounts, no analytics.** History lives on the device.
- Architecture: `GitHub → GitHub Actions → GitHub Pages → PWA → Indra’s iPhone`.

## Technology

- React 18 + TypeScript + Vite 5 (no UI framework, no state library)
- Hand-written CSS design system (light/dark, safe areas, reduced motion)
- IndexedDB for storage (no wrapper library)
- Custom service worker generated at build time (no Workbox)
- Vitest + Testing Library + fake-indexeddb for tests; Playwright (Chromium) for mobile QA and icon rendering

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
```

## Tests

```bash
npm test                   # full suite (unit, storage, UI flows, PWA, insight validation)
npm run validate:insights  # just the 500-insight validation
npm run typecheck
```

The insight validation (`src/insights/__tests__/validation.test.ts`) enforces the library contract: exactly 500 definitions, 500 unique ids and titles, category/rarity/priority/min-data on every definition, no duplicated logic, no crashes on empty/one-event/sparse/dense/holiday datasets, and no `NaN`, `Infinity`, `undefined` or `null` in any generated message. It also reports how many insights are reachable with realistic synthetic data.

## Build

```bash
npm run build     # typecheck → vite build → scripts/verify-build.mjs
npm run preview
```

`verify-build.mjs` checks the bundle: manifest, icons, iPhone meta tags, service-worker precache of every hashed asset, and that no tracking services are referenced.

Mobile QA (screenshots at iPhone 15, iPhone SE and landscape, overflow + touch-target checks):

```bash
npx vite preview --port 4173 &
npm run qa        # writes qa-screenshots/
```

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci`
2. `npm test`
3. `npm run validate:insights`
4. `npm run build` with `BASE_PATH=/<repo-name>/`
5. publishes `dist/` to the `gh-pages` branch, which GitHub Pages serves

Pages settings: **Settings → Pages → Deploy from a branch → `gh-pages` / root.** Vite’s `base` comes from `BASE_PATH` (see `vite.config.ts`); routing is hash-based (`#/calendar`), so reloads and deep links always work on Pages.

## Storage architecture

`src/storage/db.ts` is the only code that touches persistence.

- **IndexedDB** database `indras-bowel-operations-center`, schema version 2
  - `events` store (`keyPath: id`, index on `ts`): `{ id, ts, createdAt, source }`
  - `meta` store: settings, insight archive, achievement unlock dates, “No. Send help.” days, install date
- **Migrations** run in `onupgradeneeded` by version (v1 → v2 adds the `meta` store, the `ts` index and backfills fields).
- **Safe writes**: every write is a transaction awaited to `oncomplete`.
- **Duplicate protection**: taps within 4 s are treated as one; manual entries within the same minute are rejected; merges dedupe by id or identical timestamp.
- **Recovery mirror**: a compact copy of the event list is kept in `localStorage`. If the IndexedDB database ever comes back empty while the mirror has data, it is restored automatically. `navigator.storage.persist()` is requested to reduce eviction.
- Falls back to an in-memory store if IndexedDB is unavailable.

“Download My History” writes a versioned JSON document (`Indras-Poop-History-YYYY-MM-DD.json`) via the iOS share sheet (“Save to Files”) or a regular download. “Restore My History” validates the whole file before touching anything, upgrades older formats, and offers *Add to My Existing History* (deduplicated merge) or *Replace My Current History* (confirmed). None of these technical terms appear in the UI.

## Insight architecture

```
src/lib/stats.ts          buildCtx(): one pure analytics context (days, streaks, gaps, months, histograms…)
src/insights/types.ts     InsightDef: id, title, category, rarity, priority, minEvents, minDays, when(), msg()
src/insights/h.ts         shared, memoized helpers for authors
src/insights/defs/*.ts    the authored library, one file per department
src/insights/engine.ts    safe evaluation, archive merging, daily briefing selection
```

| Department | File | Count |
|---|---|---|
| Field Operations | `operations.ts` | 16 |
| Timing Intelligence | `time.ts` | 62 |
| Weekday Analysis | `weekday.ts` | 50 |
| Monthly Performance | `monthly.ts` | 47 |
| Streak Operations | `streak.ts` | 46 |
| Supply Chain (pauses) | `drought.ts` | 35 |
| High Throughput | `multi.ts` | 40 |
| Calendar Anomalies | `calendar.ts` | 46 |
| Quantitative Research | `stats.ts` | 45 |
| Milestones | `milestones.ts` | 52 |
| Strategic Partnership (Ryan ❤️ Indra) | `partnership.ts` | 61 |
| **Total** | | **500** |

Rules the library follows:

- Every number shown is computed from recorded events. Nothing is invented.
- Comparisons are only ever Indra vs. historical Indra. No population data, no medical conclusions.
- Eligibility is re-evaluated whenever data changes; newly eligible findings are **discovered** and stored in the archive with their discovery date.
- The Intel screen shows a 5-finding daily briefing (priority + rarity + freshness + a deterministic daily rotation, one per department) plus recent discoveries. The **Insight Archive** lists everything discovered and shows the rest as *Classified*.
- Partnership notes are mostly gated behind real data conditions and/or a deterministic once-a-day lottery, so they turn up rarely and unexpectedly.

Achievements (30) live in `src/lib/achievements.ts`, separate from insights; unlock dates are recorded the first time a condition is observed.

## PWA behavior

- `public/manifest.webmanifest`: standalone display, relative `start_url`/`scope`, 192/512/maskable icons.
- iPhone: `apple-touch-icon` (180 px), `apple-mobile-web-app-capable`, `viewport-fit=cover`, safe-area padding everywhere.
- `src/sw-template.js` → `dist/sw.js` at build time with a hashed precache list: the whole app shell is cached on first visit and works offline. Navigations are network-first (so updates arrive) with a cached fallback; assets are cache-first. When a new version is downloaded, the app shows “A fresh version is ready — Refresh”.
- The service worker never touches history.
- The icon is original: `assets/icon.svg`, rendered to PNGs with `npm run icons`.

## Privacy

No analytics, ads, telemetry, third-party requests, fonts or remote storage. `noindex`, `no-referrer`. No history ever appears in URLs. No personal data is committed to this repository.
