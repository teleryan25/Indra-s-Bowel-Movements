// Deterministic synthetic histories for tests. Never real data.
import type { PoopEvent } from '../lib/stats';

let counter = 0;
/** ev('2026-03-04 08:30') → a PoopEvent at that local time */
export function ev(s: string, source: PoopEvent['source'] = 'tap'): PoopEvent {
  const [d, t = '09:00'] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const ts = new Date(y, m - 1, day, hh, mm).getTime();
  return { id: `t-${++counter}-${ts}`, ts, createdAt: ts, source };
}

export function at(s: string): Date {
  const [d, t = '12:00'] = s.split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm);
}

export function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A realistic-ish history ending the day before `end`. */
export function history(end: Date, days: number, seed = 1, opts: { pDay?: number; pDouble?: number; pTriple?: number } = {}): PoopEvent[] {
  const rand = rng(seed);
  const { pDay = 0.8, pDouble = 0.18, pTriple = 0.05 } = opts;
  const out: PoopEvent[] = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    if (rand() > pDay) continue;
    const n = rand() < pTriple ? 3 + (rand() < 0.3 ? 1 : 0) : rand() < pDouble ? 2 : 1;
    let minute = Math.floor((5 + rand() * 6) * 60);
    for (let k = 0; k < n; k++) {
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, Math.min(minute, 1439)).getTime();
      out.push({ id: `h-${seed}-${i}-${k}`, ts, createdAt: ts, source: 'tap' });
      minute += 20 + Math.floor(rand() * 600);
    }
  }
  return out;
}
