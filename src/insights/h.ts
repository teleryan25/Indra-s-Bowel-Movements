// Shared helpers for insight authors. Anything expensive is memoized per Ctx.
import type { Ctx, DayRec, Ev, MonthRec, Run, Gap } from '../lib/stats';
import { daypartOf, mean, median, stdev } from '../lib/stats';
import type { InsightDef, InsightInput } from './types';
import { addDays, daysBetween, fmtClock, fmtDay, fmtDayShort, fmtMonth, parseKey, weekdayOf, WEEKDAYS } from '../lib/dates';

export { fmtClock, fmtDay, fmtDayShort, fmtMonth, WEEKDAYS, daysBetween, addDays, parseKey, weekdayOf, daypartOf, mean, median, stdev };
export type { Ctx, DayRec, Ev, MonthRec, Run, Gap };

export function def(i: InsightInput): InsightDef {
  return {
    rarity: 'common',
    priority: 50,
    minEvents: 1,
    minDays: 1,
    ...i,
  };
}

const memo = new WeakMap<Ctx, Map<string, unknown>>();
export function cached<T>(c: Ctx, key: string, fn: () => T): T {
  let m = memo.get(c);
  if (!m) {
    m = new Map();
    memo.set(c, m);
  }
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as T;
}

// ---------- formatting ----------
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const r1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
export const num = (n: number) => n.toLocaleString('en-US');
export const wdName = (wd: number) => WEEKDAYS[wd];
export const wdPlural = (wd: number) => `${WEEKDAYS[wd]}s`;

// ---------- common derived data ----------

/** Poop day keys as a Set for O(1) lookup. */
export const daySet = (c: Ctx) => cached(c, 'daySet', () => new Set(c.days.map((d) => d.key)));
export const has = (c: Ctx, key: string) => daySet(c).has(key);
export const countOn = (c: Ctx, key: string) => c.dayMap.get(key)?.count ?? 0;

/** Events in the last `n` calendar days including today. */
export function eventsInLast(c: Ctx, n: number): Ev[] {
  const from = addDays(c.todayKey, -(n - 1));
  return c.events.filter((e) => e.key >= from);
}
export function poopDaysInLast(c: Ctx, n: number): number {
  const from = addDays(c.todayKey, -(n - 1));
  return c.days.filter((d) => d.key >= from).length;
}
/** Poop days in the n days that end yesterday (a window unaffected by today being in progress). */
export function poopDaysInWindow(c: Ctx, fromKey: string, toKey: string): number {
  return c.days.filter((d) => d.key >= fromKey && d.key <= toKey).length;
}
export function eventsInWindow(c: Ctx, fromKey: string, toKey: string): Ev[] {
  return c.events.filter((e) => e.key >= fromKey && e.key <= toKey);
}

/** Overall share of observed days that had at least one movement. */
export const dayRate = (c: Ctx) => (c.observed.length ? c.poopDays / c.observed.length : 0);

/** Share of observed <weekday>s with at least one movement. */
export const wdRate = (c: Ctx, wd: number) => (c.wdObserved[wd] ? c.byWdDays[wd] / c.wdObserved[wd] : 0);

export const minsOf = (c: Ctx) => cached(c, 'mins', () => c.events.map((e) => e.mins));

/** Circular-safe-ish: we treat the day as starting at 4 AM for "earliness" so 1 AM counts as late. */
export const shifted = (mins: number) => (mins < 240 ? mins + 1440 : mins);

export const earliest = (c: Ctx) =>
  cached(c, 'earliest', () => c.events.reduce<Ev | null>((a, e) => (!a || shifted(e.mins) < shifted(a.mins) ? e : a), null));
export const latest = (c: Ctx) =>
  cached(c, 'latest', () => c.events.reduce<Ev | null>((a, e) => (!a || shifted(e.mins) > shifted(a.mins) ? e : a), null));

/** Minute gaps between consecutive movements on the same day. */
export const sameDayIntervals = (c: Ctx) =>
  cached(c, 'sdi', () => {
    const out: { key: string; gap: number; a: Ev; b: Ev }[] = [];
    for (const d of c.days) {
      for (let i = 1; i < d.events.length; i++) {
        out.push({ key: d.key, gap: (d.events[i].ts - d.events[i - 1].ts) / 60000, a: d.events[i - 1], b: d.events[i] });
      }
    }
    return out;
  });

/** Monday-start weeks fully inside the observed window. */
export interface WeekRec {
  startKey: string;
  poopDays: number;
  events: number;
  counts: number[]; // per day Mon..Sun
}
export const fullWeeks = (c: Ctx): WeekRec[] =>
  cached(c, 'weeks', () => {
    if (!c.observed.length) return [];
    const first = c.observed[0];
    const last = c.observed[c.observed.length - 1];
    const wd = weekdayOf(first);
    let start = addDays(first, (8 - wd) % 7); // next Monday (or same day if Monday)
    if (wd === 1) start = first;
    const weeks: WeekRec[] = [];
    while (addDays(start, 6) <= last) {
      const counts: number[] = [];
      for (let i = 0; i < 7; i++) counts.push(countOn(c, addDays(start, i)));
      weeks.push({
        startKey: start,
        poopDays: counts.filter((x) => x > 0).length,
        events: counts.reduce((a, b) => a + b, 0),
        counts,
      });
      start = addDays(start, 7);
    }
    return weeks;
  });

/** Hour histogram helper returning [hour, count] of the modal hour. */
export const modalHour = (c: Ctx) =>
  cached(c, 'modalHour', () => {
    let best = 0;
    for (let h = 1; h < 24; h++) if (c.byHour[h] > c.byHour[best]) best = h;
    return best;
  });

export const multiDays = (c: Ctx, min = 2) => c.days.filter((d) => d.count >= min);

/** Minutes, rounded, as a readable span. */
export const mm = (mins: number) => {
  const m = Math.round(Math.abs(mins));
  if (m < 60) return plural(m, 'minute');
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${plural(h, 'hour')} ${plural(rest, 'minute')}` : plural(h, 'hour');
};

export const lastN = <T,>(xs: T[], n: number) => xs.slice(Math.max(0, xs.length - n));

/** Events whose local date matches month/day. */
export const onMonthDay = (c: Ctx, m: number, d: number) => c.days.filter((x) => x.m === m && x.d === d);

/** Rank of a value among others (1 = highest). */
export const rankDesc = (xs: number[], v: number) => xs.filter((x) => x > v).length + 1;

/** Percentile of v within xs (share of xs strictly below v). */
export const pctBelow = (xs: number[], v: number) => (xs.length ? xs.filter((x) => x < v).length / xs.length : 0);

export const inRange = (x: number, lo: number, hi: number) => x >= lo && x < hi;

export const cm = (c: Ctx) => c.currentMonth;
export const prevMonth = (c: Ctx): MonthRec | null => (c.months.length >= 2 ? c.months[c.months.length - 2] : null);

/** The run containing a given day key, if it was a poop day. */
export const runOf = (c: Ctx, key: string) => c.streaks.find((r) => r.startKey <= key && r.endKey >= key) ?? null;

/** Days within a streak run. */
export const runKeys = (r: Run) => {
  const out: string[] = [];
  for (let i = 0; i < r.len; i++) out.push(addDays(r.startKey, i));
  return out;
};

export const lastGap = (c: Ctx): Gap | null => (c.gaps.length ? c.gaps[c.gaps.length - 1] : null);
export const lastRun = (c: Ctx): Run | null => (c.streaks.length ? c.streaks[c.streaks.length - 1] : null);
/** Most recently *completed* run (not including one that is still alive). */
export const completedRuns = (c: Ctx) =>
  c.currentStreak > 0 ? c.streaks.slice(0, -1) : c.streaks;

export const todayRec = (c: Ctx) => c.dayMap.get(c.todayKey) ?? null;
export const isToday = (c: Ctx, key: string | null | undefined) => key === c.todayKey;

export const hourShare = (c: Ctx, lo: number, hi: number) =>
  c.n ? c.events.filter((e) => e.hour >= lo && e.hour < hi).length / c.n : 0;

export const firstOfEachDay = (c: Ctx) => cached(c, 'fed', () => c.days.map((d) => d.events[0]));

/** Average clock time with a 4 AM day boundary, so 11 PM and 1 AM average to midnight. */
export const avgClock = (mins: number[]) => (mins.length ? mean(mins.map(shifted)) % 1440 : 0);
export const medClock = (mins: number[]) => (mins.length ? median(mins.map(shifted)) % 1440 : 0);
export const sdClock = (mins: number[]) => stdev(mins.map(shifted));
/** Signed minutes a is later than b, both on the 4 AM-boundary scale. */
export const laterBy = (a: number, b: number) => shifted(a) - shifted(b);
export const hhmm = (e: Ev) => `${e.hour}:${String(e.minute).padStart(2, '0')}`;
export const h12digits = (e: Ev) => {
  const h = e.hour % 12 === 0 ? 12 : e.hour % 12;
  return `${h}${String(e.minute).padStart(2, '0')}`;
};
export const isWeekend = (wd: number) => wd === 0 || wd === 6;
import { relativeDay, fmtHourRange, fmtHour } from '../lib/dates';
export { fmtHourRange, fmtHour };
export const relativeDayLabel = (c: Ctx, key: string) => {
  const r = relativeDay(key, c.todayKey);
  return r === 'Today' || r === 'Yesterday' ? r.toLowerCase() : r;
};
