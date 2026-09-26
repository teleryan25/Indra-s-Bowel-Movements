import { evaluateAll, evaluateOne, selectBriefing, updateArchive, isCleanText } from '../engine';
import { INSIGHTS } from '../index';
import { buildCtx } from '../../lib/stats';
import { def } from '../h';
import { at, ev, history } from '../../test/fixtures';

const byId = (id: string) => INSIGHTS.find((d) => d.id === id)!;

describe('insight engine', () => {
  it('respects minimum data requirements', () => {
    const ctx = buildCtx([ev('2026-09-25 08:00')], at('2026-09-25 20:00'));
    expect(evaluateOne(byId('ms-1'), ctx)).not.toBeNull();
    expect(evaluateOne(byId('ms-5'), ctx)).toBeNull();
    expect(evaluateOne(byId('op-awaiting-first'), ctx)).toBeNull();
  });

  it('calculates real values into the message', () => {
    const ctx = buildCtx(['2026-09-20 07:15', '2026-09-21 07:45', '2026-09-22 08:15', '2026-09-23 08:45', '2026-09-24 09:15'].map((s) => ev(s)), at('2026-09-25 20:00'));
    expect(evaluateOne(byId('time-average-clock'), ctx)!.text).toContain('8:15 AM');
    expect(evaluateOne(byId('time-earliest-ever'), ctx)!.text).toContain('7:15 AM');
    expect(evaluateOne(byId('st-5'), ctx)).not.toBeNull();
    expect(evaluateOne(byId('st-7'), ctx)).toBeNull();
    expect(evaluateOne(byId('ms-5'), ctx)!.text).toContain('Sep 24');
  });

  it('special milestone copy for #69 and #420 only unlocks at those counts', () => {
    const end = at('2026-09-25 12:00');
    const h = history(end, 600, 11, { pDay: 1, pDouble: 0 });
    expect(evaluateOne(byId('ms-69'), buildCtx(h.slice(0, 68), end))).toBeNull();
    expect(evaluateOne(byId('ms-69'), buildCtx(h.slice(0, 69), end))!.text).toMatch(/nice/);
    expect(evaluateOne(byId('ms-420'), buildCtx(h.slice(0, 420), end))).not.toBeNull();
  });

  it('handles sparse data gracefully', () => {
    const ctx = buildCtx([ev('2025-01-01 08:00'), ev('2026-06-01 22:00')], at('2026-09-25 20:00'));
    const results = evaluateAll(ctx);
    expect(results.length).toBeGreaterThan(3);
    for (const r of results) expect(isCleanText(r.text)).toBe(true);
  });

  it('swallows crashing or dirty definitions instead of showing them', () => {
    const ctx = buildCtx([ev('2026-09-25 08:00')], at('2026-09-25 20:00'));
    const boom = def({ id: 'x-boom', title: 'Boom', category: 'stats', when: () => { throw new Error('x'); }, msg: () => 'x' });
    const dirty = def({ id: 'x-dirty', title: 'Dirty', category: 'stats', when: () => true, msg: () => `value is ${NaN}` });
    expect(evaluateAll(ctx, [boom, dirty])).toEqual([]);
  });

  it('archives discoveries once and keeps the first discovery date', () => {
    const ctx = buildCtx([ev('2026-09-25 08:00')], at('2026-09-25 20:00'));
    const res = evaluateAll(ctx);
    const first = updateArchive({}, res, 1000);
    expect(first.newIds.length).toBe(res.length);
    const second = updateArchive(first.archive, res, 2000);
    expect(second.newIds).toEqual([]);
    expect(Object.values(second.archive).every((a) => a.discoveredAt === 1000 && a.lastSeenAt === 2000)).toBe(true);
  });

  it('builds a short, varied daily briefing', () => {
    const now = at('2026-09-25 20:00');
    const ctx = buildCtx(history(now, 300, 2), now);
    const res = evaluateAll(ctx);
    const brief = selectBriefing(res, {}, ctx, now.getTime(), 5);
    expect(brief.length).toBe(5);
    const cats = brief.map((b) => b.def.category).filter((c) => c !== 'milestone');
    expect(new Set(cats).size).toBe(cats.length);
  });
});
