// Automated validation of the 500-insight requirement.
import { INSIGHTS } from '../index';
import { CATEGORY_LABEL } from '../types';
import { isCleanText } from '../engine';
import { buildCtx, type Ctx, type PoopEvent } from '../../lib/stats';
import { at, ev, history } from '../../test/fixtures';

const RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

describe('insight library shape', () => {
  it('contains exactly 500 insight definitions', () => {
    expect(INSIGHTS).toHaveLength(500);
  });

  it('has exactly 500 unique ids (no duplicates)', () => {
    const ids = INSIGHTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^[a-z]+-[a-z0-9-]+$/);
  });

  it('every insight has a unique, non-empty title', () => {
    const titles = INSIGHTS.map((i) => i.title.trim());
    for (const t of titles) expect(t.length).toBeGreaterThan(2);
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it('every insight has a valid category, rarity and priority', () => {
    for (const i of INSIGHTS) {
      expect(Object.keys(CATEGORY_LABEL)).toContain(i.category);
      expect(RARITIES).toContain(i.rarity);
      expect(i.priority).toBeGreaterThanOrEqual(1);
      expect(i.priority).toBeLessThanOrEqual(100);
    }
  });

  it('every insight has an eligibility function and a message generator', () => {
    for (const i of INSIGHTS) {
      expect(typeof i.when).toBe('function');
      expect(typeof i.msg).toBe('function');
    }
  });

  it('every insight declares minimum-data requirements', () => {
    for (const i of INSIGHTS) {
      expect(Number.isInteger(i.minEvents)).toBe(true);
      expect(Number.isInteger(i.minDays)).toBe(true);
      expect(i.minEvents).toBeGreaterThanOrEqual(0);
      expect(i.minDays).toBeGreaterThanOrEqual(1);
    }
    // Only the empty-state briefing may run with zero data.
    expect(INSIGHTS.filter((i) => i.minEvents === 0).map((i) => i.id)).toEqual(['op-awaiting-first']);
  });

  it('has no exactly duplicated definitions (same eligibility and same message logic)', () => {
    const sigs = INSIGHTS.map((i) => `${i.when.toString()}||${i.msg.toString()}`);
    const dupes = sigs.filter((s, idx) => sigs.indexOf(s) !== idx);
    expect(dupes).toEqual([]);
  });

  it('ships 50–75 partnership easter eggs', () => {
    const n = INSIGHTS.filter((i) => i.category === 'partnership').length;
    expect(n).toBeGreaterThanOrEqual(50);
    expect(n).toBeLessThanOrEqual(75);
  });

  it('covers every requested category with real depth', () => {
    const count = (c: string) => INSIGHTS.filter((i) => i.category === c).length;
    for (const c of ['time', 'weekday', 'monthly', 'streak', 'drought', 'multi', 'calendar', 'stats', 'milestone']) {
      expect(count(c)).toBeGreaterThanOrEqual(30);
    }
  });
});

// ---------- behaviour against many datasets ----------

function scenarios(): { name: string; ctx: Ctx }[] {
  const out: { name: string; ctx: Ctx }[] = [];
  const now = at('2026-09-25 21:30');
  out.push({ name: 'empty', ctx: buildCtx([], now) });
  out.push({ name: 'one event', ctx: buildCtx([ev('2026-09-25 08:00')], now) });
  out.push({ name: 'one event long ago', ctx: buildCtx([ev('2025-01-02 23:59')], now) });
  out.push({ name: 'sparse', ctx: buildCtx(['2026-06-01 07:10', '2026-06-20 13:00', '2026-07-15 22:45', '2026-08-30 03:10', '2026-09-10 12:00'].map((s) => ev(s)), now) });
  out.push({ name: 'same minute every day', ctx: buildCtx(Array.from({ length: 40 }, (_, i) => ev(`2026-08-${String((i % 28) + 1).padStart(2, '0')} 00:00`)), now) });
  out.push({ name: 'huge single day', ctx: buildCtx(Array.from({ length: 12 }, (_, i) => ev(`2026-09-25 ${String(6 + i).padStart(2, '0')}:05`)), now) });
  const big: PoopEvent[] = history(now, 900, 42, { pDay: 0.85, pDouble: 0.25, pTriple: 0.08 });
  // Walk "today" through many dates so date-gated and daily-rotation insights are exercised.
  for (let i = 0; i < 70; i++) {
    const d = new Date(2026, 8, 25 - i * 13, 7 + (i % 16), (i * 7) % 60);
    const evs = big.filter((e) => e.ts <= d.getTime());
    if (i % 3 === 0) evs.push({ id: `today-${i}`, ts: d.getTime() - 60_000, createdAt: d.getTime(), source: 'tap' });
    out.push({ name: `dense@${d.toDateString()}`, ctx: buildCtx(evs, d) });
  }
  for (const [label, s] of [['valentines', '2026-02-14 10:00'], ['halloween', '2025-10-31 10:00'], ['christmas', '2025-12-25 10:00'], ['new year', '2026-01-01 10:00'], ['leap', '2028-02-29 10:00']] as const) {
    const d = at(s);
    const evs = history(d, 500, 9, { pDay: 0.95 });
    evs.push(ev(s.replace('10:00', '08:00')));
    out.push({ name: label, ctx: buildCtx(evs, d) });
  }
  // every day and perfect streaks
  const perfectEnd = at('2026-05-03 12:00');
  out.push({ name: 'perfect', ctx: buildCtx(history(perfectEnd, 400, 3, { pDay: 1, pDouble: 0.5, pTriple: 0.2 }), perfectEnd) });
  // drought in progress
  out.push({ name: 'drought', ctx: buildCtx(history(at('2026-04-01'), 200, 5), at('2026-04-09 18:00')) });
  return out;
}

describe('insight behaviour', () => {
  const all = scenarios();
  const seen = new Set<string>();

  it.each(all.map((s) => [s.name, s.ctx] as const))('never crashes and never prints bad values: %s', (_name, ctx) => {
    for (const def of INSIGHTS) {
      if (ctx.n < def.minEvents) continue;
      if (def.minEvents > 0 && ctx.trackedDays < def.minDays) continue;
      let eligible = false;
      expect(() => (eligible = def.when(ctx)), `${def.id}.when`).not.toThrow();
      if (!eligible) continue;
      let text = '';
      expect(() => (text = def.msg(ctx)), `${def.id}.msg`).not.toThrow();
      expect(isCleanText(text), `${def.id} produced: ${text}`).toBe(true);
      expect(text.length, def.id).toBeLessThan(400);
      seen.add(def.id);
    }
  });

  it('empty data only surfaces the awaiting-first-deployment briefing', () => {
    const ctx = buildCtx([], at('2026-09-25 09:00'));
    const eligible = INSIGHTS.filter((d) => ctx.n >= d.minEvents && d.when(ctx)).map((d) => d.id);
    expect(eligible).toEqual(['op-awaiting-first']);
  });

  it('the vast majority of insights are reachable with realistic data', () => {
    const unreached = INSIGHTS.filter((d) => !seen.has(d.id)).map((d) => d.id);
    console.info(`reached ${seen.size}/500; unreached: ${unreached.join(', ')}`);
    // A handful are intentionally very rare (e.g. 1,000 movements, palindrome dates, 11:11).
    expect(unreached.length, `unreached: ${unreached.join(', ')}`).toBeLessThanOrEqual(45);
  });

  it('distinct insights produce distinct text on a rich dataset', () => {
    const now = at('2026-09-25 21:30');
    const ctx = buildCtx(history(now, 900, 42, { pDay: 0.85, pDouble: 0.25, pTriple: 0.08 }), now);
    const texts = INSIGHTS.filter((d) => ctx.n >= d.minEvents && d.when(ctx)).map((d) => d.msg(ctx));
    expect(new Set(texts).size).toBe(texts.length);
  });
});
