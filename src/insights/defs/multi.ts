// HIGH THROUGHPUT — 40 authored insights about multi-movement days.
import {
  def, fmtClock, fmtDayShort, plural, pct, wdName, mm, has, addDays, countOn, mean, eventsInLast, fullWeeks,
  sameDayIntervals, multiDays, cm, isWeekend, runKeys, daysBetween, fmtHourRange, poopDaysInLast,
  type Ctx, type DayRec,
} from '../h';
import type { InsightDef } from '../types';

const C = 'multi' as const;
const firstWith = (c: Ctx, n: number): DayRec | null => c.days.find((d) => d.count >= n) ?? null;
const today = (c: Ctx) => c.dayMap.get(c.todayKey) ?? null;
const others = (c: Ctx) => c.days.filter((d) => d.key !== c.todayKey);

export const multiInsights: InsightDef[] = [
  def({
    id: 'mu-first-double', title: 'First Double Deployment', category: C, priority: 78,
    when: (c) => !!firstWith(c, 2),
    msg: (c) => `${fmtDayShort(firstWith(c, 2)!.key)} saw the Center's first multi-movement day. Throughput capacity has officially been proven.`,
  }),
  def({
    id: 'mu-first-triple', title: 'First Triple', category: C, rarity: 'uncommon', priority: 84,
    when: (c) => !!firstWith(c, 3),
    msg: (c) => `On ${fmtDayShort(firstWith(c, 3)!.key)}, operations achieved three movements in one day. Additional loading docks have been requisitioned.`,
  }),
  def({
    id: 'mu-first-quad', title: 'Four-Movement Day', category: C, rarity: 'rare', priority: 90,
    when: (c) => !!firstWith(c, 4),
    msg: (c) => `${fmtDayShort(firstWith(c, 4)!.key)}: four movements in one day. Logistics experts are studying the footage.`,
  }),
  def({
    id: 'mu-five', title: 'Maximum Capacity Event', category: C, rarity: 'legendary', priority: 96,
    when: (c) => !!firstWith(c, 5),
    msg: (c) => `${plural(firstWith(c, 5)!.count, 'movement')} on ${fmtDayShort(firstWith(c, 5)!.key)}. The facility was not designed for this, and yet it held.`,
  }),
  def({
    id: 'mu-record', title: 'Single-Day Record', category: C, priority: 50,
    when: (c) => c.maxPerDay >= 2,
    msg: (c) => {
      const d = c.days.filter((x) => x.count === c.maxPerDay);
      return `Your single-day record is ${c.maxPerDay} movements${d.length > 1 ? `, achieved on ${d.length} separate days` : `, set on ${fmtDayShort(d[0].key)}`}.`;
    },
  }),
  def({
    id: 'mu-record-tied-today', title: 'Single-Day Record Tied', category: C, rarity: 'rare', priority: 88,
    when: (c) => c.todayCount >= 2 && c.todayCount === c.maxPerDay && others(c).some((d) => d.count === c.maxPerDay),
    msg: (c) => `Today's ${c.todayCount} movements tie your single-day record. One more would make history. No pressure.`,
  }),
  def({
    id: 'mu-record-broken-today', title: 'Single-Day Record Broken', category: C, rarity: 'rare', priority: 94,
    when: (c) => c.todayCount >= 3 && others(c).length > 0 && others(c).every((d) => d.count < c.todayCount) && others(c).some((d) => d.count >= 2),
    msg: (c) => `NEW SINGLE-DAY RECORD: ${c.todayCount} movements today, surpassing the previous best of ${Math.max(...others(c).map((d) => d.count))}. Historic throughput.`,
  }),
  def({
    id: 'mu-double-frequency', title: 'Double Frequency', category: C, priority: 49, minDays: 14,
    when: (c) => c.multiDayCount >= 3 && c.poopDays >= 10,
    msg: (c) => `${pct(c.multiDayCount / c.poopDays)} of your active days include more than one movement. That's roughly one high-throughput day for every ${(c.poopDays / c.multiDayCount).toFixed(1)} active days.`,
  }),
  def({
    id: 'mu-triple-rate', title: 'Triple Rate', category: C, rarity: 'uncommon', priority: 53,
    when: (c) => multiDays(c, 3).length >= 2,
    msg: (c) => `${multiDays(c, 3).length} days have reached three or more movements, most recently ${fmtDayShort(multiDays(c, 3).pop()!.key)}.`,
  }),
  def({
    id: 'mu-volume-share', title: 'Volume on High-Throughput Days', category: C, priority: 47, minEvents: 12,
    when: (c) => c.multiDayCount >= 3,
    msg: (c) => {
      const onMulti = multiDays(c).reduce((a, d) => a + d.count, 0);
      return `${pct(onMulti / c.n)} of all movements happened on multi-movement days. The high-throughput days carry a lot of the load.`;
    },
  }),
  def({
    id: 'mu-triple-crown-weekday', title: 'Triple Crown Weekday', category: C, rarity: 'rare', priority: 60,
    when: (c) => {
      const counts = new Array(7).fill(0);
      for (const d of multiDays(c, 3)) counts[d.wd]++;
      return Math.max(...counts) >= 2 && counts.filter((x) => x === Math.max(...counts)).length === 1;
    },
    msg: (c) => {
      const counts = new Array(7).fill(0);
      for (const d of multiDays(c, 3)) counts[d.wd]++;
      const wd = counts.indexOf(Math.max(...counts));
      return `${wdName(wd)} has hosted ${counts[wd]} triple-or-better days — more than any other weekday. ${wdName(wd)} means business.`;
    },
  }),
  def({
    id: 'mu-fastest-encore', title: 'Fastest Encore', category: C, rarity: 'uncommon', priority: 58,
    when: (c) => sameDayIntervals(c).length >= 1,
    msg: (c) => {
      const f = sameDayIntervals(c).reduce((a, b) => (b.gap < a.gap ? b : a));
      return `Fastest encore on record: ${mm(f.gap)} between movements on ${fmtDayShort(f.key)} (${fmtClock(f.a.mins)} and ${fmtClock(f.b.mins)}). Remarkable turnaround time.`;
    },
  }),
  def({
    id: 'mu-longest-interval', title: 'Longest Same-Day Interval', category: C, priority: 45,
    when: (c) => sameDayIntervals(c).length >= 2,
    msg: (c) => {
      const f = sameDayIntervals(c).reduce((a, b) => (b.gap > a.gap ? b : a));
      return `The widest spacing between two movements on the same day: ${mm(f.gap)}, on ${fmtDayShort(f.key)}. Morning shift and evening shift, both reporting.`;
    },
  }),
  def({
    id: 'mu-bookend-service', title: 'Bookend Service', category: C, rarity: 'uncommon', priority: 55,
    when: (c) => multiDays(c).some((d) => d.events[0].hour < 11 && d.events[d.events.length - 1].hour >= 18),
    msg: (c) => {
      const d = multiDays(c).filter((x) => x.events[0].hour < 11 && x.events[x.events.length - 1].hour >= 18).pop()!;
      return `${fmtDayShort(d.key)} opened with a movement at ${fmtClock(d.events[0].mins)} and closed with another at ${fmtClock(d.events[d.events.length - 1].mins)}. Full-day coverage.`;
    },
  }),
  def({
    id: 'mu-weekend-throughput', title: 'High-Throughput Weekend', category: C, rarity: 'rare', priority: 66,
    when: (c) => c.days.some((d) => d.wd === 6 && d.count >= 2 && countOn(c, addDays(d.key, 1)) >= 2),
    msg: (c) => {
      const d = c.days.filter((x) => x.wd === 6 && x.count >= 2 && countOn(c, addDays(x.key, 1)) >= 2).pop()!;
      return `The weekend of ${fmtDayShort(d.key)} delivered multiple movements on both Saturday and Sunday. A high-throughput weekend.`;
    },
  }),
  def({
    id: 'mu-back-to-back-doubles', title: 'Back-to-Back Doubles', category: C, rarity: 'uncommon', priority: 62,
    when: (c) => c.days.some((d) => d.count >= 2 && countOn(c, addDays(d.key, 1)) >= 2),
    msg: (c) => {
      const d = c.days.filter((x) => x.count >= 2 && countOn(c, addDays(x.key, 1)) >= 2).pop()!;
      return `${fmtDayShort(d.key)} and ${fmtDayShort(addDays(d.key, 1))}: consecutive multi-movement days. Sustained high throughput.`;
    },
  }),
  def({
    id: 'mu-busy-week', title: 'Busy Week', category: C, rarity: 'uncommon', priority: 57,
    when: (c) => c.days.some((d) => c.days.filter((x) => x.count >= 2 && x.key >= d.key && daysBetween(d.key, x.key) < 7).length >= 3),
    msg: (c) => {
      const d = c.days.filter((y) => c.days.filter((x) => x.count >= 2 && x.key >= y.key && daysBetween(y.key, x.key) < 7).length >= 3).pop()!;
      return `The seven days starting ${fmtDayShort(d.key)} contained three separate multi-movement days. The loading dock was very busy.`;
    },
  }),
  def({
    id: 'mu-monthly-double-record', title: 'Monthly Doubles Record', category: C, rarity: 'rare', priority: 72, minDays: 40,
    when: (c) => {
      const m = cm(c);
      if (!m || c.months.length < 2) return false;
      const prior = c.months.slice(0, -1).map((x) => x.multiDays);
      return m.multiDays >= 2 && m.multiDays > Math.max(...prior);
    },
    msg: (c) => `This month has produced ${cm(c)!.multiDays} multi-movement days, a new monthly record. Throughput is at all-time highs.`,
  }),
  def({
    id: 'mu-today-double', title: 'Double Deployment Confirmed', category: C, priority: 77,
    when: (c) => c.todayCount === 2,
    msg: (c) => `Two movements today (${today(c)!.events.map((e) => fmtClock(e.mins)).join(' and ')}). Throughput doubled. Shareholders notified.`,
  }),
  def({
    id: 'mu-today-triple', title: 'Triple Deployment Confirmed', category: C, rarity: 'uncommon', priority: 83,
    when: (c) => c.todayCount === 3,
    msg: (c) => `Three movements today: ${today(c)!.events.map((e) => fmtClock(e.mins)).join(', ')}. Today will appear in the quarterly report.`,
  }),
  def({
    id: 'mu-express-lane', title: 'Express Lane', category: C, rarity: 'uncommon', priority: 48,
    when: (c) => sameDayIntervals(c).filter((x) => x.gap <= 60).length >= 3,
    msg: (c) => `${sameDayIntervals(c).filter((x) => x.gap <= 60).length} encores have arrived within an hour of the previous movement. The express lane is open.`,
  }),
  def({
    id: 'mu-doubles-this-month', title: 'Doubles This Month', category: C, priority: 44,
    when: (c) => (cm(c)?.multiDays ?? 0) >= 2,
    msg: (c) => `This month has featured ${cm(c)!.multiDays} multi-movement days so far. High-throughput operations remain active.`,
  }),
  def({
    id: 'mu-last-high-throughput', title: 'Last High-Throughput Day', category: C, priority: 32, minDays: 30,
    when: (c) => c.multiDayCount >= 3 && daysBetween(multiDays(c).pop()!.key, c.todayKey) >= 14,
    msg: (c) => {
      const d = multiDays(c).pop()!;
      return `The last multi-movement day was ${fmtDayShort(d.key)}, ${daysBetween(d.key, c.todayKey)} days ago. Single-service operations have been the norm lately.`;
    },
  }),
  def({
    id: 'mu-per-active-day', title: 'Movements Per Active Day', category: C, priority: 46, minEvents: 10,
    when: (c) => c.poopDays >= 7,
    msg: (c) => `On days when operations are active, you average ${(c.n / c.poopDays).toFixed(2)} movements.`,
  }),
  def({
    id: 'mu-intensity-trend', title: 'Intensity Trend', category: C, priority: 43, minDays: 60,
    when: (c) => {
      const recentDays = poopDaysInLast(c, 30);
      const recent = eventsInLast(c, 30).length;
      if (recentDays < 8 || c.poopDays - recentDays < 8) return false;
      const a = recent / recentDays;
      const b = (c.n - recent) / (c.poopDays - recentDays);
      return Math.abs(a - b) >= 0.15;
    },
    msg: (c) => {
      const recentDays = poopDaysInLast(c, 30);
      const recent = eventsInLast(c, 30).length;
      const a = recent / recentDays;
      const b = (c.n - recent) / (c.poopDays - recentDays);
      return `In the last 30 days, active days averaged ${a.toFixed(2)} movements, versus ${b.toFixed(2)} before that. Intensity is ${a > b ? 'up' : 'down'}.`;
    },
  }),
  def({
    id: 'mu-stockpile', title: 'Inventory Clearance Effect', category: C, rarity: 'uncommon', priority: 42,
    when: (c) => {
      const m = multiDays(c).filter((d) => c.observed.includes(addDays(d.key, 1)));
      return m.length >= 4 && m.filter((d) => !has(c, addDays(d.key, 1))).length / m.length >= 0.6;
    },
    msg: (c) => {
      const m = multiDays(c).filter((d) => c.observed.includes(addDays(d.key, 1)));
      return `After a multi-movement day, the next day is quiet ${pct(m.filter((d) => !has(c, addDays(d.key, 1))).length / m.length)} of the time. Inventory has been cleared; the warehouse rests.`;
    },
  }),
  def({
    id: 'mu-morning-doubleheader', title: 'Morning Doubleheader', category: C, rarity: 'uncommon', priority: 52,
    when: (c) => multiDays(c).some((d) => d.events.filter((e) => e.hour < 12).length >= 2),
    msg: (c) => {
      const d = multiDays(c).filter((x) => x.events.filter((e) => e.hour < 12).length >= 2).pop()!;
      return `${fmtDayShort(d.key)} fit two movements in before noon. A morning doubleheader.`;
    },
  }),
  def({
    id: 'mu-evening-doubleheader', title: 'Evening Doubleheader', category: C, rarity: 'uncommon', priority: 52,
    when: (c) => multiDays(c).some((d) => d.events.filter((e) => e.hour >= 17).length >= 2),
    msg: (c) => {
      const d = multiDays(c).filter((x) => x.events.filter((e) => e.hour >= 17).length >= 2).pop()!;
      return `${fmtDayShort(d.key)} featured two movements after 5 PM. The evening doubleheader is a rare and beautiful thing.`;
    },
  }),
  def({
    id: 'mu-triple-window', title: 'Triple Coverage Window', category: C, rarity: 'rare', priority: 59,
    when: (c) => multiDays(c, 3).length >= 1,
    msg: (c) => {
      const d = multiDays(c, 3).pop()!;
      return `On ${fmtDayShort(d.key)}, ${d.count} movements spanned ${mm(d.events[d.events.length - 1].mins - d.events[0].mins)} from first to last. That is a full shift.`;
    },
  }),
  def({
    id: 'mu-hit-ground-running', title: 'Hit the Ground Running', category: C, rarity: 'rare', priority: 65,
    when: (c) => c.days.length > 0 && c.days[0].count >= 2,
    msg: (c) => `The very first day of tracking (${fmtDayShort(c.days[0].key)}) was a multi-movement day. The Center opened at full capacity.`,
  }),
  def({
    id: 'mu-double-anniversary', title: 'Double Anniversary', category: C, rarity: 'legendary', priority: 80,
    when: (c) => multiDays(c).some((d) => countOn(c, `${d.y + 1}${d.key.slice(4)}`) >= 2),
    msg: (c) => {
      const d = multiDays(c).find((x) => countOn(c, `${x.y + 1}${x.key.slice(4)}`) >= 2)!;
      return `${fmtDayShort(d.key)} was a multi-movement day in both ${d.y} and ${d.y + 1}. An annual tradition may be forming.`;
    },
  }),
  def({
    id: 'mu-ten-week', title: 'Ten-Movement Week', category: C, rarity: 'rare', priority: 64,
    when: (c) => fullWeeks(c).some((w) => w.events >= 10),
    msg: (c) => {
      const w = fullWeeks(c).filter((x) => x.events >= 10).pop()!;
      return `The week of ${fmtDayShort(w.startKey)} produced ${w.events} movements. Double digits in a single week.`;
    },
  }),
  def({
    id: 'mu-noon-divider', title: 'Noon Divider', category: C, priority: 40, minEvents: 12,
    when: (c) => multiDays(c).length >= 4 && multiDays(c).filter((d) => d.events[0].hour < 12 && d.events[d.events.length - 1].hour >= 12).length / multiDays(c).length >= 0.6,
    msg: (c) => `${pct(multiDays(c).filter((d) => d.events[0].hour < 12 && d.events[d.events.length - 1].hour >= 12).length / multiDays(c).length)} of multi-movement days straddle noon: one before, one after. Morning and afternoon desks share the workload.`,
  }),
  def({
    id: 'mu-concentrated-output', title: 'Concentrated Output', category: C, rarity: 'uncommon', priority: 41,
    when: (c) => fullWeeks(c).some((w) => w.poopDays <= 3 && Math.max(...w.counts) >= 3),
    msg: (c) => {
      const w = fullWeeks(c).filter((x) => x.poopDays <= 3 && Math.max(...x.counts) >= 3).pop()!;
      return `The week of ${fmtDayShort(w.startKey)} had only ${w.poopDays} active days but still included a ${Math.max(...w.counts)}-movement day. Concentrated output.`;
    },
  }),
  def({
    id: 'mu-multi-average-load', title: 'Multi-Day Average Load', category: C, priority: 39,
    when: (c) => c.multiDayCount >= 5,
    msg: (c) => `On high-throughput days, you average ${mean(multiDays(c).map((d) => d.count)).toFixed(2)} movements. When it rains, it pours.`,
  }),
  def({
    id: 'mu-encore-hour', title: 'Encore Hour', category: C, rarity: 'uncommon', priority: 43,
    when: (c) => {
      const counts = new Array(24).fill(0);
      for (const d of multiDays(c)) counts[d.events[1].hour]++;
      return c.multiDayCount >= 5 && Math.max(...counts) >= 3;
    },
    msg: (c) => {
      const counts = new Array(24).fill(0);
      for (const d of multiDays(c)) counts[d.events[1].hour]++;
      const h = counts.indexOf(Math.max(...counts));
      return `Second movements of the day most often arrive in the ${fmtHourRange(h)} hour (${counts[h]} times). That's encore o'clock.`;
    },
  }),
  def({
    id: 'mu-high-throughput-season', title: 'High-Throughput Season', category: C, rarity: 'uncommon', priority: 54, minDays: 60,
    when: (c) => {
      const recent = c.days.filter((d) => d.key > addDays(c.todayKey, -30));
      const older = c.days.filter((d) => d.key <= addDays(c.todayKey, -30));
      if (recent.length < 8 || older.length < 10) return false;
      const a = recent.filter((d) => d.count >= 2).length / recent.length;
      const b = older.filter((d) => d.count >= 2).length / older.length;
      return a >= b + 0.15;
    },
    msg: (c) => {
      const recent = c.days.filter((d) => d.key > addDays(c.todayKey, -30));
      const older = c.days.filter((d) => d.key <= addDays(c.todayKey, -30));
      return `${pct(recent.filter((d) => d.count >= 2).length / recent.length)} of active days in the last month were multi-movement days, up from ${pct(older.filter((d) => d.count >= 2).length / older.length)} historically. It's high-throughput season.`;
    },
  }),
  def({
    id: 'mu-peak-within-peak', title: 'Peak Within a Peak', category: C, rarity: 'rare', priority: 63,
    when: (c) => c.streaks.some((r) => r.len >= 5 && runKeys(r).some((k) => countOn(c, k) >= 3)),
    msg: (c) => {
      const r = c.streaks.filter((x) => x.len >= 5 && runKeys(x).some((k) => countOn(c, k) >= 3)).pop()!;
      const k = runKeys(r).find((x) => countOn(c, x) >= 3)!;
      return `During a ${r.len}-day streak, ${fmtDayShort(k)} delivered ${countOn(c, k)} movements. A peak within a peak.`;
    },
  }),
  def({
    id: 'mu-three-day-surge', title: 'Three-Day Surge', category: C, rarity: 'rare', priority: 61,
    when: (c) => c.days.some((d) => countOn(c, d.key) + countOn(c, addDays(d.key, 1)) + countOn(c, addDays(d.key, 2)) >= 6),
    msg: (c) => {
      const d = c.days.filter((x) => countOn(c, x.key) + countOn(c, addDays(x.key, 1)) + countOn(c, addDays(x.key, 2)) >= 6).pop()!;
      const total = countOn(c, d.key) + countOn(c, addDays(d.key, 1)) + countOn(c, addDays(d.key, 2));
      return `${total} movements in the three days starting ${fmtDayShort(d.key)}. A three-day surge worthy of a press release.`;
    },
  }),
  def({
    id: 'mu-weekend-vs-weekday-intensity', title: 'Weekend Intensity', category: C, priority: 37, minEvents: 20,
    when: (c) => {
      const we = c.days.filter((d) => isWeekend(d.wd));
      const wk = c.days.filter((d) => !isWeekend(d.wd));
      return we.length >= 4 && wk.length >= 8 && Math.abs(mean(we.map((d) => d.count)) - mean(wk.map((d) => d.count))) >= 0.2;
    },
    msg: (c) => {
      const we = mean(c.days.filter((d) => isWeekend(d.wd)).map((d) => d.count));
      const wk = mean(c.days.filter((d) => !isWeekend(d.wd)).map((d) => d.count));
      return `Active weekend days average ${we.toFixed(2)} movements; active weekdays ${wk.toFixed(2)}. ${we > wk ? 'Weekends go bigger.' : 'Weekdays pack more in.'}`;
    },
  }),
];
