// The analytics core. Pure functions only: given the recorded events and "now",
// build a Ctx that the dashboard, achievements and all 500 insights read from.
// Nothing in here is invented — every number is derived from recorded events.

import {
  addDays,
  daysBetween,
  daysInMonth,
  dayKey,
  monthKey,
  parseKey,
  weekdayOf,
} from './dates';

export interface PoopEvent {
  id: string;
  /** epoch milliseconds of the movement */
  ts: number;
  /** epoch ms when the record was written */
  createdAt: number;
  source: 'tap' | 'manual' | 'restored';
}

export interface Ev {
  id: string;
  ts: number;
  key: string;
  y: number;
  m: number;
  d: number;
  wd: number;
  hour: number;
  minute: number;
  /** minutes since local midnight */
  mins: number;
  /** position in chronological order, 1-based */
  ordinal: number;
}

export interface DayRec {
  key: string;
  y: number;
  m: number;
  d: number;
  wd: number;
  events: Ev[];
  count: number;
}

export interface Run {
  startKey: string;
  endKey: string;
  len: number;
}

export interface Gap {
  /** last poop day before the gap */
  fromKey: string;
  /** poop day that ended the gap */
  toKey: string;
  /** number of full days without a movement */
  len: number;
}

export interface MonthRec {
  key: string;
  y: number;
  m: number;
  poopDays: number;
  events: number;
  daysInMonth: number;
  /** days of this month inside the observed window */
  observedDays: number;
  complete: boolean;
  multiDays: number;
  maxInDay: number;
  dayRecs: DayRec[];
}

export type Daypart = 'early' | 'morning' | 'afternoon' | 'evening' | 'night';
export const DAYPART_LABEL: Record<Daypart, string> = {
  early: 'early morning (4–7 AM)',
  morning: 'morning (7 AM–noon)',
  afternoon: 'afternoon (noon–5 PM)',
  evening: 'evening (5–10 PM)',
  night: 'night (10 PM–4 AM)',
};

export function daypartOf(mins: number): Daypart {
  const h = mins / 60;
  if (h >= 4 && h < 7) return 'early';
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

export interface Ctx {
  now: Date;
  todayKey: string;
  yesterdayKey: string;
  events: Ev[];
  n: number;
  days: DayRec[];
  dayMap: Map<string, DayRec>;
  poopDays: number;
  firstKey: string | null;
  lastKey: string | null;
  first: Ev | null;
  last: Ev | null;
  /** days from first event through today inclusive */
  trackedDays: number;
  /** keys of fully observed days: first poop day → today (if today has a poop) else yesterday */
  observed: string[];
  todayCount: number;
  yesterdayCount: number;
  streaks: Run[];
  gaps: Gap[];
  currentStreak: number;
  currentStreakStart: string | null;
  longestStreak: number;
  longestGap: number;
  daysSinceLast: number | null;
  /** full days without a movement since the last one (today not counted) */
  openGap: number;
  maxPerDay: number;
  multiDayCount: number;
  byHour: number[];
  byWd: number[];
  byWdDays: number[];
  wdObserved: number[];
  daypart: Record<Daypart, number>;
  months: MonthRec[];
  monthMap: Map<string, MonthRec>;
  currentMonth: MonthRec | null;
  completeMonths: MonthRec[];
  meanMins: number;
  medianMins: number;
  sdMins: number;
  /** stable per-day random in [0,1) for a string salt; used only for rotation, never for data */
  dailyRandom: (salt: string) => number;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1));
}

export function toEv(e: PoopEvent): Omit<Ev, 'ordinal'> {
  const d = new Date(e.ts);
  const key = dayKey(d);
  const { y, m, d: dd } = parseKey(key);
  return {
    id: e.id,
    ts: e.ts,
    key,
    y,
    m,
    d: dd,
    wd: d.getDay(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    mins: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60,
  };
}

export function runsOf(sortedKeys: string[]): Run[] {
  const runs: Run[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  for (const k of sortedKeys) {
    if (prev && daysBetween(prev, k) === 1) {
      prev = k;
      continue;
    }
    if (start && prev) runs.push({ startKey: start, endKey: prev, len: daysBetween(start, prev) + 1 });
    start = k;
    prev = k;
  }
  if (start && prev) runs.push({ startKey: start, endKey: prev, len: daysBetween(start, prev) + 1 });
  return runs;
}

export function buildCtx(raw: PoopEvent[], now: Date = new Date()): Ctx {
  const todayKey = dayKey(now);
  const yesterdayKey = addDays(todayKey, -1);
  // Future-dated events (clock weirdness) are ignored by analytics.
  const events: Ev[] = [...raw]
    .filter((e) => Number.isFinite(e.ts) && e.ts <= now.getTime() + 60_000)
    .sort((a, b) => a.ts - b.ts)
    .map((e, i) => ({ ...toEv(e), ordinal: i + 1 }));

  const dayMap = new Map<string, DayRec>();
  for (const ev of events) {
    let rec = dayMap.get(ev.key);
    if (!rec) {
      rec = { key: ev.key, y: ev.y, m: ev.m, d: ev.d, wd: weekdayOf(ev.key), events: [], count: 0 };
      dayMap.set(ev.key, rec);
    }
    rec.events.push(ev);
    rec.count++;
  }
  const days = [...dayMap.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  const firstKey = days.length ? days[0].key : null;
  const lastKey = days.length ? days[days.length - 1].key : null;
  const todayCount = dayMap.get(todayKey)?.count ?? 0;
  const yesterdayCount = dayMap.get(yesterdayKey)?.count ?? 0;

  const trackedDays = firstKey ? Math.max(1, daysBetween(firstKey, todayKey) + 1) : 0;
  const observed: string[] = [];
  if (firstKey) {
    const endKey = todayCount > 0 ? todayKey : yesterdayKey;
    for (let k = firstKey; k <= endKey; k = addDays(k, 1)) observed.push(k);
  }

  const streaks = runsOf(days.map((d) => d.key));
  const gaps: Gap[] = [];
  for (let i = 1; i < days.length; i++) {
    const len = daysBetween(days[i - 1].key, days[i].key) - 1;
    if (len > 0) gaps.push({ fromKey: days[i - 1].key, toKey: days[i].key, len });
  }

  let currentStreak = 0;
  let currentStreakStart: string | null = null;
  const lastRun = streaks[streaks.length - 1];
  if (lastRun && (lastRun.endKey === todayKey || lastRun.endKey === yesterdayKey)) {
    currentStreak = lastRun.len;
    currentStreakStart = lastRun.startKey;
  }
  const daysSinceLast = lastKey ? daysBetween(lastKey, todayKey) : null;
  const openGap = daysSinceLast === null ? 0 : Math.max(0, daysSinceLast - 1);

  const byHour = new Array(24).fill(0);
  const byWd = new Array(7).fill(0);
  const byWdDays = new Array(7).fill(0);
  const wdObserved = new Array(7).fill(0);
  const daypart: Record<Daypart, number> = { early: 0, morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const ev of events) {
    byHour[ev.hour]++;
    byWd[ev.wd]++;
    daypart[daypartOf(ev.mins)]++;
  }
  for (const d of days) byWdDays[d.wd]++;
  for (const k of observed) wdObserved[weekdayOf(k)]++;

  const months: MonthRec[] = [];
  if (firstKey) {
    const f = parseKey(firstKey);
    const t = parseKey(todayKey);
    let y = f.y;
    let m = f.m;
    while (y < t.y || (y === t.y && m <= t.m)) {
      const key = monthKey(y, m);
      const dim = daysInMonth(y, m);
      const dayRecs = days.filter((d) => d.y === y && d.m === m);
      const monthStart = `${key}-01`;
      const monthEnd = `${key}-${String(dim).padStart(2, '0')}`;
      const obsStart = monthStart < firstKey ? firstKey : monthStart;
      const obsEnd = monthEnd > todayKey ? todayKey : monthEnd;
      months.push({
        key,
        y,
        m,
        poopDays: dayRecs.length,
        events: dayRecs.reduce((a, d) => a + d.count, 0),
        daysInMonth: dim,
        observedDays: obsEnd >= obsStart ? daysBetween(obsStart, obsEnd) + 1 : 0,
        complete: monthEnd < todayKey,
        multiDays: dayRecs.filter((d) => d.count >= 2).length,
        maxInDay: dayRecs.reduce((a, d) => Math.max(a, d.count), 0),
        dayRecs,
      });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  }
  const monthMap = new Map(months.map((mr) => [mr.key, mr]));
  const nowParts = parseKey(todayKey);
  const currentMonth = monthMap.get(monthKey(nowParts.y, nowParts.m)) ?? null;

  const minsList = events.map((e) => e.mins);

  return {
    now,
    todayKey,
    yesterdayKey,
    events,
    n: events.length,
    days,
    dayMap,
    poopDays: days.length,
    firstKey,
    lastKey,
    first: events[0] ?? null,
    last: events[events.length - 1] ?? null,
    trackedDays,
    observed,
    todayCount,
    yesterdayCount,
    streaks,
    gaps,
    currentStreak,
    currentStreakStart,
    longestStreak: streaks.reduce((a, r) => Math.max(a, r.len), 0),
    longestGap: gaps.reduce((a, g) => Math.max(a, g.len), 0),
    daysSinceLast,
    openGap,
    maxPerDay: days.reduce((a, d) => Math.max(a, d.count), 0),
    multiDayCount: days.filter((d) => d.count >= 2).length,
    byHour,
    byWd,
    byWdDays,
    wdObserved,
    daypart,
    months,
    monthMap,
    currentMonth,
    completeMonths: months.filter((mr) => mr.complete && mr.observedDays === mr.daysInMonth),
    meanMins: mean(minsList),
    medianMins: median(minsList),
    sdMins: stdev(minsList),
    dailyRandom: (salt: string) => hashString(`${todayKey}|${salt}`) / 4294967296,
  };
}

/** Rebuilds a context as if "now" were the end of the given day, using only events up to then. */
export function ctxAsOf(raw: PoopEvent[], key: string): Ctx {
  const { y, m, d } = parseKey(key);
  const end = new Date(y, m, d, 23, 59, 59);
  return buildCtx(raw.filter((e) => e.ts <= end.getTime()), end);
}

// ---------- Dashboard summary ----------

export interface Summary {
  todayCount: number;
  currentStreak: number;
  daysSinceLast: number | null;
  monthPoopDays: number;
  monthEvents: number;
  avgPoopDaysPerWeek: number | null;
  avgEventsPerWeek: number | null;
  topWeekday: number | null;
  topDaypart: Daypart | null;
  longestStreak: number;
  longestGap: number;
  lifetime: number;
  lastTs: number | null;
  status: 'operational' | 'standby' | 'delayed' | 'disrupted' | 'awaiting';
}

export function summarize(c: Ctx): Summary {
  const weeks = c.observed.length / 7;
  let topWeekday: number | null = null;
  if (c.n >= 3) {
    const rates = c.byWd.map((v) => v);
    const max = Math.max(...rates);
    topWeekday = rates.indexOf(max);
  }
  let topDaypart: Daypart | null = null;
  if (c.n >= 3) {
    const entries = Object.entries(c.daypart) as [Daypart, number][];
    topDaypart = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  let status: Summary['status'] = 'awaiting';
  if (c.n > 0) {
    if (c.todayCount > 0) status = 'operational';
    else if (c.daysSinceLast === 1) status = 'standby';
    else if ((c.daysSinceLast ?? 0) <= 2) status = 'delayed';
    else status = 'disrupted';
  }
  return {
    todayCount: c.todayCount,
    currentStreak: c.currentStreak,
    daysSinceLast: c.daysSinceLast,
    monthPoopDays: c.currentMonth?.poopDays ?? 0,
    monthEvents: c.currentMonth?.events ?? 0,
    avgPoopDaysPerWeek: weeks >= 1 ? (c.poopDays / c.observed.length) * 7 : null,
    avgEventsPerWeek: weeks >= 1 ? (c.n / c.observed.length) * 7 : null,
    topWeekday,
    topDaypart,
    longestStreak: c.longestStreak,
    longestGap: c.longestGap,
    lifetime: c.n,
    lastTs: c.last?.ts ?? null,
    status,
  };
}
