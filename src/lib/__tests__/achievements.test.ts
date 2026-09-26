import { ACHIEVEMENTS, unlockedIds } from '../achievements';
import { buildCtx } from '../stats';
import { at, ev, history } from '../../test/fixtures';

describe('achievements', () => {
  it('has 25–30 achievements with icons, titles, descriptions and unique ids', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(30);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.icon && a.title && a.description && a.hint).toBeTruthy();
    }
  });
  it('unlocks nothing on empty data', () => {
    expect(unlockedIds(buildCtx([], at('2026-09-25')))).toEqual([]);
  });
  it('unlocks Launch Day, High Throughput, Early Shipment and Night Shift from the right events', () => {
    const c = buildCtx([ev('2026-09-25 06:30'), ev('2026-09-25 22:30')], at('2026-09-25 23:00'));
    const ids = unlockedIds(c);
    expect(ids).toEqual(expect.arrayContaining(['launch-day', 'high-throughput', 'early-shipment', 'night-shift']));
    expect(ids).not.toContain('hat-trick');
    expect(ids).not.toContain('regularity-royalty');
  });
  it('unlocks Regularity Royalty at exactly 7 consecutive days', () => {
    const six = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'].map((s) => ev(s));
    expect(unlockedIds(buildCtx(six, at('2026-09-06 20:00')))).not.toContain('regularity-royalty');
    expect(unlockedIds(buildCtx([...six, ev('2026-09-07')], at('2026-09-07 20:00')))).toContain('regularity-royalty');
  });
  it('unlocks Century Club at 100 movements', () => {
    const end = at('2026-09-25 12:00');
    const h = history(end, 200, 4, { pDay: 1, pDouble: 0 }).slice(0, 100);
    expect(unlockedIds(buildCtx(h, end))).toContain('century-club');
    expect(unlockedIds(buildCtx(h.slice(1), end))).not.toContain('century-club');
  });
});
