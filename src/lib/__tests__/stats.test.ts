import { buildCtx, summarize, daypartOf } from '../stats';
import { daysBetween, addDays, fmtClock, thanksgivingDay, weekdayOf } from '../dates';
import { at, ev } from '../../test/fixtures';

const now = at('2026-09-25 20:00'); // a Friday

describe('empty first run', () => {
  it('has zeroed, finite metrics', () => {
    const c = buildCtx([], now);
    const s = summarize(c);
    expect(c.n).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.daysSinceLast).toBeNull();
    expect(s.status).toBe('awaiting');
    expect(s.avgPoopDaysPerWeek).toBeNull();
    expect(Number.isFinite(c.meanMins)).toBe(true);
  });
});

describe('streaks', () => {
  it('counts a current streak that includes today', () => {
    const c = buildCtx([ev('2026-09-23 08:00'), ev('2026-09-24 08:00'), ev('2026-09-25 08:00')], now);
    expect(c.currentStreak).toBe(3);
    expect(c.currentStreakStart).toBe('2026-09-23');
  });
  it('keeps a streak alive through yesterday while today is pending', () => {
    const c = buildCtx([ev('2026-09-22 08:00'), ev('2026-09-23 08:00'), ev('2026-09-24 08:00')], now);
    expect(c.currentStreak).toBe(3);
    expect(summarize(c).status).toBe('standby');
  });
  it('breaks a streak after a full missed day', () => {
    const c = buildCtx([ev('2026-09-20 08:00'), ev('2026-09-21 08:00'), ev('2026-09-23 08:00')], now);
    expect(c.currentStreak).toBe(0);
  });
  it('finds the longest historical streak and ignores multiple events per day', () => {
    const c = buildCtx(
      ['2026-01-01', '2026-01-02', '2026-01-02 18:00', '2026-01-03', '2026-01-04', '2026-02-01', '2026-02-02'].map((s) => ev(s)),
      now,
    );
    expect(c.longestStreak).toBe(4);
    expect(c.streaks.map((r) => r.len)).toEqual([4, 2]);
  });
  it('handles streaks across month and DST boundaries', () => {
    const c = buildCtx(['2026-03-07', '2026-03-08', '2026-03-09', '2026-10-31', '2026-11-01', '2026-11-02'].map((s) => ev(s)), at('2026-11-02 12:00'));
    expect(c.streaks.map((r) => r.len)).toEqual([3, 3]);
  });
});

describe('droughts', () => {
  it('measures gaps between active days and the open gap', () => {
    const c = buildCtx([ev('2026-09-10'), ev('2026-09-13'), ev('2026-09-14'), ev('2026-09-20')], now);
    expect(c.gaps.map((g) => g.len)).toEqual([2, 5]);
    expect(c.longestGap).toBe(5);
    expect(c.daysSinceLast).toBe(5);
    expect(c.openGap).toBe(4);
    expect(summarize(c).status).toBe('disrupted');
  });
});

describe('monthly totals', () => {
  it('computes per-month active days, events and completeness', () => {
    const c = buildCtx([ev('2026-08-01'), ev('2026-08-01 20:00'), ev('2026-08-31'), ev('2026-09-02'), ev('2026-09-25')], now);
    const aug = c.monthMap.get('2026-08')!;
    const sep = c.monthMap.get('2026-09')!;
    expect(aug).toMatchObject({ poopDays: 2, events: 3, complete: true, multiDays: 1, maxInDay: 2 });
    expect(sep).toMatchObject({ poopDays: 2, events: 2, complete: false });
    expect(c.completeMonths.map((m) => m.key)).toEqual(['2026-08']);
    expect(summarize(c).monthEvents).toBe(2);
  });
});

describe('weekday calculations', () => {
  it('counts events and active days by weekday and observed weekday occurrences', () => {
    // 2026-09-14 is a Monday
    const c = buildCtx([ev('2026-09-14 08:00'), ev('2026-09-14 12:00'), ev('2026-09-21 09:00'), ev('2026-09-16 10:00')], now);
    expect(weekdayOf('2026-09-14')).toBe(1);
    expect(c.byWd[1]).toBe(3);
    expect(c.byWdDays[1]).toBe(2);
    expect(c.byWd[3]).toBe(1);
    expect(c.wdObserved.reduce((a, b) => a + b, 0)).toBe(c.observed.length);
    expect(summarize(c).topWeekday).toBe(1);
  });
});

describe('time calculations', () => {
  it('computes mean/median minutes and dayparts', () => {
    const c = buildCtx([ev('2026-09-20 07:00'), ev('2026-09-21 08:00'), ev('2026-09-22 12:00')], now);
    expect(c.meanMins).toBe(9 * 60);
    expect(c.medianMins).toBe(8 * 60);
    expect(c.byHour[8]).toBe(1);
    expect(daypartOf(5 * 60)).toBe('early');
    expect(daypartOf(23 * 60)).toBe('night');
    expect(fmtClock(0)).toBe('12:00 AM');
    expect(fmtClock(13 * 60 + 5)).toBe('1:05 PM');
  });
  it('ignores events recorded in the future', () => {
    const c = buildCtx([ev('2026-09-26 08:00')], now);
    expect(c.n).toBe(0);
  });
});

describe('multi-event days', () => {
  it('tracks max per day and multi-day counts', () => {
    const c = buildCtx([ev('2026-09-25 07:00'), ev('2026-09-25 09:00'), ev('2026-09-25 19:00'), ev('2026-09-24 08:00'), ev('2026-09-24 20:00')], now);
    expect(c.maxPerDay).toBe(3);
    expect(c.multiDayCount).toBe(2);
    expect(c.todayCount).toBe(3);
    expect(c.yesterdayCount).toBe(2);
  });
});

describe('date helpers', () => {
  it('are DST-safe and know public holidays', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(thanksgivingDay(2026)).toBe(26);
  });
});
