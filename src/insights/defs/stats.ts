// QUANTITATIVE RESEARCH — 45 authored insights. Real statistics, Indra vs. historical Indra only.
// Never compared to population data. Never framed as medical normal/abnormal.
import {
  def, fmtClock, fmtDayShort, plural, pct, r1, mean, median, stdev, eventsInLast, poopDaysInLast, eventsInWindow,
  poopDaysInWindow, addDays, has, countOn, fullWeeks, lastN, cached, wdName, sdClock, weekdayOf, daypartOf, pctBelow,
  daysBetween, mm, shifted,
  type Ctx,
} from '../h';
import type { InsightDef } from '../types';

const C = 'stats' as const;

const obsCounts = (c: Ctx) => cached(c, 'sx.obsCounts', () => c.observed.map((k) => countOn(c, k)));

const windowBest = (c: Ctx, len: number, metric: 'events' | 'days') =>
  cached(c, `sx.win.${len}.${metric}`, () => {
    const counts = obsCounts(c);
    if (counts.length < len) return null;
    let sum = 0;
    for (let i = 0; i < len; i++) sum += metric === 'events' ? counts[i] : counts[i] > 0 ? 1 : 0;
    let best = { v: sum, i: 0 };
    let worst = { v: sum, i: 0 };
    for (let i = len; i < counts.length; i++) {
      sum += (metric === 'events' ? counts[i] : counts[i] > 0 ? 1 : 0) - (metric === 'events' ? counts[i - len] : counts[i - len] > 0 ? 1 : 0);
      if (sum > best.v) best = { v: sum, i: i - len + 1 };
      if (sum < worst.v) worst = { v: sum, i: i - len + 1 };
    }
    return { best: { v: best.v, start: c.observed[best.i] }, worst: { v: worst.v, start: c.observed[worst.i] } };
  });

const transitions = (c: Ctx) =>
  cached(c, 'sx.trans', () => {
    let aa = 0, a = 0, qa = 0, q = 0;
    for (let i = 1; i < c.observed.length; i++) {
      const prev = has(c, c.observed[i - 1]);
      const now = has(c, c.observed[i]);
      if (prev) { a++; if (now) aa++; } else { q++; if (now) qa++; }
    }
    return { pAA: a ? aa / a : 0, pQA: q ? qa / q : 0, a, q };
  });

const chiWeekday = (c: Ctx) =>
  cached(c, 'sx.chi', () => {
    const total = c.byWdDays.reduce((x, y) => x + y, 0);
    const obs = c.wdObserved.reduce((x, y) => x + y, 0);
    if (!obs) return 0;
    const p = total / obs;
    let chi = 0;
    for (let wd = 0; wd < 7; wd++) {
      const n = c.wdObserved[wd];
      if (!n) continue;
      const exp = n * p;
      const expMiss = n * (1 - p);
      if (exp > 0) chi += (c.byWdDays[wd] - exp) ** 2 / exp;
      if (expMiss > 0) chi += (n - c.byWdDays[wd] - expMiss) ** 2 / expMiss;
    }
    return chi;
  });

const slotKey = (wd: number, mins: number) => `${wdName(wd)} ${daypartOf(mins) === 'early' ? 'early morning' : daypartOf(mins)}`;
const slotCounts = (c: Ctx) =>
  cached(c, 'sx.slots', () => {
    const m = new Map<string, number>();
    for (const e of c.events) m.set(slotKey(e.wd, e.mins), (m.get(slotKey(e.wd, e.mins)) ?? 0) + 1);
    return m;
  });

const weeklyEvents = (c: Ctx) => fullWeeks(c).map((w) => w.events);

const slope = (ys: number[]) => {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return n > 1 && den ? num / den : 0;
};

const hourEntropy = (c: Ctx) => {
  let h = 0;
  for (const v of c.byHour) if (v) { const p = v / c.n; h -= p * Math.log2(p); }
  return h / Math.log2(24);
};

export const statsInsights: InsightDef[] = [
  def({
    id: 'sx-rolling-7', title: 'Rolling 7-Day Throughput', category: C, priority: 57, minDays: 7,
    when: (c) => c.trackedDays >= 7,
    msg: (c) => `In the last 7 days: ${plural(eventsInLast(c, 7).length, 'movement')} across ${plural(poopDaysInLast(c, 7), 'active day')}.`,
  }),
  def({
    id: 'sx-rolling-30', title: 'Rolling 30-Day Throughput', category: C, priority: 55, minDays: 30,
    when: (c) => c.trackedDays >= 30,
    msg: (c) => `In the last 30 days: ${plural(eventsInLast(c, 30).length, 'movement')} on ${poopDaysInLast(c, 30)} active days (${pct(poopDaysInLast(c, 30) / 30)} coverage).`,
  }),
  def({
    id: 'sx-rolling-90', title: 'Rolling Quarter', category: C, priority: 48, minDays: 90,
    when: (c) => c.trackedDays >= 90,
    msg: (c) => `Trailing 90-day performance: ${plural(eventsInLast(c, 90).length, 'movement')}, ${(eventsInLast(c, 90).length / 90 * 7).toFixed(1)} per week. The quarterly report writes itself.`,
  }),
  def({
    id: 'sx-recent-vs-historical', title: 'Recent vs. Historical Frequency', category: C, priority: 60, minDays: 60,
    when: (c) => {
      const recent = poopDaysInWindow(c, addDays(c.yesterdayKey, -29), c.yesterdayKey) / 30;
      const before = c.observed.filter((k) => k < addDays(c.yesterdayKey, -29));
      return before.length >= 21 && Math.abs(recent - poopDaysInWindow(c, before[0], before[before.length - 1]) / before.length) >= 0.08;
    },
    msg: (c) => {
      const recent = poopDaysInWindow(c, addDays(c.yesterdayKey, -29), c.yesterdayKey) / 30;
      const before = c.observed.filter((k) => k < addDays(c.yesterdayKey, -29));
      const hist = poopDaysInWindow(c, before[0], before[before.length - 1]) / before.length;
      return `Over the last 30 days, ${pct(recent)} of days were active, compared with ${pct(hist)} before that. Recent frequency is ${recent > hist ? 'running above' : 'running below'} your own historical baseline.`;
    },
  }),
  def({
    id: 'sx-lifetime-coverage', title: 'Lifetime Coverage Rate', category: C, priority: 50, minDays: 14,
    when: (c) => c.observed.length >= 14,
    msg: (c) => `Across ${plural(c.observed.length, 'observed day')}, ${pct(c.poopDays / c.observed.length)} have featured at least one movement.`,
  }),
  def({
    id: 'sx-daily-average', title: 'Daily Throughput Average', category: C, priority: 46, minDays: 14,
    when: (c) => c.observed.length >= 14,
    msg: (c) => `Your long-run average is ${(c.n / c.observed.length).toFixed(2)} movements per day, or ${(c.n / c.observed.length * 7).toFixed(1)} per week.`,
  }),
  def({
    id: 'sx-today-percentile', title: 'Today vs. Your History', category: C, priority: 59, minDays: 21,
    when: (c) => c.todayCount >= 2,
    msg: (c) => `With ${c.todayCount} movements, today outperforms ${pct(pctBelow(obsCounts(c).slice(0, -1), c.todayCount))} of all previously observed days.`,
  }),
  def({
    id: 'sx-weekly-volatility', title: 'Weekly Volatility Index', category: C, priority: 42, minDays: 56,
    when: (c) => weeklyEvents(c).length >= 6 && mean(weeklyEvents(c)) > 0,
    msg: (c) => {
      const cv = stdev(weeklyEvents(c)) / mean(weeklyEvents(c));
      return `Weekly volume has a coefficient of variation of ${cv.toFixed(2)}. ${cv < 0.25 ? 'Low volatility; a blue-chip operation.' : cv < 0.5 ? 'Moderate volatility, typical of a growth stock.' : 'High volatility. Thrilling for investors.'}`;
    },
  }),
  def({
    id: 'sx-best-7-window', title: 'Best 7-Day Window', category: C, priority: 52, minDays: 14,
    when: (c) => !!windowBest(c, 7, 'events'),
    msg: (c) => {
      const w = windowBest(c, 7, 'events')!.best;
      return `Your best 7-day window began ${fmtDayShort(w.start)} and produced ${plural(w.v, 'movement')}.`;
    },
  }),
  def({
    id: 'sx-best-30-window', title: 'Best 30-Day Window', category: C, priority: 51, minDays: 45,
    when: (c) => !!windowBest(c, 30, 'events'),
    msg: (c) => {
      const w = windowBest(c, 30, 'events')!.best;
      return `Peak 30-day performance: ${plural(w.v, 'movement')} in the 30 days starting ${fmtDayShort(w.start)}.`;
    },
  }),
  def({
    id: 'sx-quietest-30-window', title: 'Quietest 30-Day Window', category: C, priority: 34, minDays: 90,
    when: (c) => !!windowBest(c, 30, 'days'),
    msg: (c) => {
      const w = windowBest(c, 30, 'days')!.worst;
      return `The quietest 30-day stretch began ${fmtDayShort(w.start)}, with ${plural(w.v, 'active day')}. Every business has a slow season.`;
    },
  }),
  def({
    id: 'sx-trendline', title: 'Trendline Analysis', category: C, rarity: 'uncommon', priority: 54, minDays: 63,
    when: (c) => weeklyEvents(c).length >= 8 && Math.abs(slope(lastN(weeklyEvents(c), 12))) >= 0.1,
    msg: (c) => {
      const ws = lastN(weeklyEvents(c), 12);
      const s = slope(ws);
      return `A linear fit across the last ${ws.length} weeks shows weekly volume ${s > 0 ? 'rising' : 'easing'} by about ${Math.abs(s).toFixed(2)} movements per week. The line ${s > 0 ? 'goes up. Investors love a line that goes up.' : 'slopes gently down. Analysts remain calm.'}`;
    },
  }),
  def({
    id: 'sx-momentum', title: 'Momentum Coefficient', category: C, rarity: 'uncommon', priority: 58, minDays: 30,
    when: (c) => transitions(c).a >= 10 && transitions(c).q >= 5,
    msg: (c) => {
      const t = transitions(c);
      return `After an active day, the next day is active ${pct(t.pAA)} of the time. After a quiet day, ${pct(t.pQA)}. ${t.pAA > t.pQA ? 'Momentum is real.' : 'Quiet days tend to spring back.'}`;
    },
  }),
  def({
    id: 'sx-mtbm', title: 'Mean Days Between Active Days', category: C, priority: 40, minDays: 21,
    when: (c) => c.poopDays >= 8,
    msg: (c) => {
      const d: number[] = [];
      for (let i = 1; i < c.days.length; i++) d.push(daysBetween(c.days[i - 1].key, c.days[i].key));
      return `On average, active days arrive every ${mean(d).toFixed(2)} days. Engineers call this "mean time between movements."`;
    },
  }),
  def({
    id: 'sx-daily-distribution', title: 'Daily Distribution', category: C, priority: 44, minDays: 30,
    when: (c) => c.observed.length >= 30,
    msg: (c) => {
      const counts = obsCounts(c);
      const z = counts.filter((x) => x === 0).length;
      const one = counts.filter((x) => x === 1).length;
      const more = counts.length - z - one;
      return `Of ${counts.length} observed days: ${pct(z / counts.length)} had zero movements, ${pct(one / counts.length)} had one, and ${pct(more / counts.length)} had two or more.`;
    },
  }),
  def({
    id: 'sx-single-service-share', title: 'Single-Service Share', category: C, priority: 39, minEvents: 15,
    when: (c) => c.poopDays >= 10,
    msg: (c) => `${pct(c.days.filter((d) => d.count === 1).length / c.poopDays)} of active days featured exactly one movement. One and done, efficiently.`,
  }),
  def({
    id: 'sx-annualized', title: 'Annualized Run Rate', category: C, priority: 53, minDays: 30,
    when: (c) => c.observed.length >= 30,
    msg: (c) => `At the current lifetime rate, the Center is on pace for roughly ${Math.round((c.n / c.observed.length) * 365)} movements per year. That's the annualized run rate. It sounds impressive because it is.`,
  }),
  def({
    id: 'sx-median-week', title: 'Median Week', category: C, priority: 41, minDays: 42,
    when: (c) => weeklyEvents(c).length >= 5,
    msg: (c) => `The median full week contains ${median(weeklyEvents(c))} movements. Half of weeks do more, half do less.`,
  }),
  def({
    id: 'sx-fortnight', title: 'Fortnight Comparison', category: C, priority: 49, minDays: 28,
    when: (c) => c.observed.length >= 28,
    msg: (c) => {
      const a = eventsInWindow(c, addDays(c.yesterdayKey, -13), c.yesterdayKey).length;
      const b = eventsInWindow(c, addDays(c.yesterdayKey, -27), addDays(c.yesterdayKey, -14)).length;
      return `Last 14 complete days: ${plural(a, 'movement')}. The 14 days before that: ${b}. ${a === b ? 'Perfectly level.' : a > b ? 'Trending up.' : 'A lighter fortnight.'}`;
    },
  }),
  def({
    id: 'sx-timing-entropy', title: 'Timing Entropy', category: C, rarity: 'uncommon', priority: 36, minEvents: 25,
    when: (c) => c.n >= 25,
    msg: (c) => {
      const e = hourEntropy(c);
      return `Your hourly timing entropy is ${e.toFixed(2)} (0 = always the same hour, 1 = perfectly random). ${e < 0.6 ? 'Highly predictable.' : e < 0.8 ? 'Somewhat predictable.' : 'Delightfully unpredictable.'}`;
    },
  }),
  def({
    id: 'sx-consistency-score', title: 'Consistency Score', category: C, priority: 56, minDays: 28,
    when: (c) => c.observed.length >= 28,
    msg: (c) => {
      const last = lastN(obsCounts(c), 28);
      const m = mean(last);
      const score = m ? Math.max(0, Math.round(100 * (1 - stdev(last) / (m + stdev(last))))) : 0;
      return `Your 28-day Consistency Score is ${score}/100, based on how evenly movements are spread across days. The methodology is rigorous. The score is meaningless. Both things are true.`;
    },
  }),
  def({
    id: 'sx-reliability-index', title: 'Operational Reliability Index', category: C, priority: 52, minDays: 42,
    when: (c) => fullWeeks(c).length >= 5,
    msg: (c) => `${pct(fullWeeks(c).filter((w) => w.poopDays >= 4).length / fullWeeks(c).length)} of complete weeks delivered on four or more days. That's your Operational Reliability Index.`,
  }),
  def({
    id: 'sx-timing-tightening', title: 'Timing Is Tightening', category: C, rarity: 'uncommon', priority: 47, minEvents: 25,
    when: (c) => sdClock(lastN(c.events, 10).map((e) => e.mins)) < 0.7 * sdClock(c.events.map((e) => e.mins)),
    msg: (c) => `Your last 10 movements vary by ${mm(sdClock(lastN(c.events, 10).map((e) => e.mins)))} (standard deviation), versus ${mm(sdClock(c.events.map((e) => e.mins)))} historically. The schedule is tightening.`,
  }),
  def({
    id: 'sx-weekly-z', title: "This Week's Z-Score", category: C, rarity: 'uncommon', priority: 50, minDays: 56,
    when: (c) => {
      const ws = weeklyEvents(c);
      return ws.length >= 6 && stdev(ws) > 0 && Math.abs((eventsInLast(c, 7).length - mean(ws)) / stdev(ws)) >= 1;
    },
    msg: (c) => {
      const ws = weeklyEvents(c);
      const z = (eventsInLast(c, 7).length - mean(ws)) / stdev(ws);
      return `The last 7 days (${eventsInLast(c, 7).length} movements) register a z-score of ${z.toFixed(2)} against your weekly history. ${z > 0 ? 'Above-trend performance.' : 'A below-trend week, well within historical range.'}`;
    },
  }),
  def({
    id: 'sx-median-month-days', title: 'Median Active Days per Month', category: C, priority: 38, minDays: 90,
    when: (c) => c.completeMonths.length >= 3,
    msg: (c) => `Across complete months, the median is ${median(c.completeMonths.map((m) => m.poopDays))} active days per month.`,
  }),
  def({
    id: 'sx-early-encores', title: 'Early Starts Lead to Encores?', category: C, rarity: 'uncommon', priority: 45, minEvents: 25,
    when: (c) => {
      const early = c.days.filter((d) => d.events[0].hour < 9);
      const late = c.days.filter((d) => d.events[0].hour >= 9);
      return early.length >= 5 && late.length >= 5 && c.multiDayCount >= 3;
    },
    msg: (c) => {
      const early = c.days.filter((d) => d.events[0].hour < 9);
      const late = c.days.filter((d) => d.events[0].hour >= 9);
      const a = early.filter((d) => d.count >= 2).length / early.length;
      const b = late.filter((d) => d.count >= 2).length / late.length;
      return `Days that start before 9 AM go on to have a second movement ${pct(a)} of the time, versus ${pct(b)} for later starts. ${Math.abs(a - b) < 0.05 ? 'No real difference.' : a > b ? 'An early start sets up an encore.' : 'Late starters are the encore specialists.'}`;
    },
  }),
  def({
    id: 'sx-dataset-size', title: 'Dataset Size', category: C, priority: 30, minDays: 14,
    when: (c) => c.n >= 10,
    msg: (c) => `The research dataset now contains ${plural(c.n, 'movement')} over ${plural(c.trackedDays, 'day')} (${r1(c.trackedDays / 7)} weeks). The Intelligence Division is thrilled.`,
  }),
  def({
    id: 'sx-weekly-density', title: 'Movements Per Tracked Week', category: C, priority: 37, minDays: 21,
    when: (c) => c.trackedDays >= 21,
    msg: (c) => `Density check: ${(c.n / (c.trackedDays / 7)).toFixed(1)} movements per tracked week since the Center opened.`,
  }),
  def({
    id: 'sx-last-percentile', title: 'Latest Movement Percentile', category: C, priority: 43, minEvents: 15,
    when: (c) => !!c.last,
    msg: (c) => {
      const p = pctBelow(c.events.slice(0, -1).map((e) => shifted(e.mins)), shifted(c.last!.mins));
      return `Your most recent movement (${fmtClock(c.last!.mins)}) was later in the day than ${pct(p)} of all prior movements.`;
    },
  }),
  def({
    id: 'sx-weekday-significant', title: 'Statistically Significant Weekday Effect', category: C, rarity: 'rare', priority: 62, minDays: 56,
    when: (c) => c.wdObserved.every((x) => x >= 8) && chiWeekday(c) > 12.59,
    msg: (c) => `A chi-square test on weekday activity gives χ² = ${chiWeekday(c).toFixed(1)} (df = 6, p < 0.05). Your weekday differences are statistically significant. Nobody asked for this analysis. It was performed anyway.`,
  }),
  def({
    id: 'sx-weekday-null', title: 'No Weekday Effect Detected', category: C, rarity: 'uncommon', priority: 44, minDays: 56,
    when: (c) => c.wdObserved.every((x) => x >= 8) && chiWeekday(c) <= 12.59,
    msg: (c) => `A chi-square test on weekday activity gives χ² = ${chiWeekday(c).toFixed(1)}, below the significance threshold of 12.59. Scientifically speaking, you do not discriminate between days of the week.`,
  }),
  def({
    id: 'sx-tomorrow-forecast', title: "Tomorrow's Forecast", category: C, priority: 45, minDays: 30,
    when: (c) => c.observed.length >= 30,
    msg: (c) => {
      const hits = poopDaysInWindow(c, addDays(c.yesterdayKey, -29), c.yesterdayKey);
      return `Based on the last 30 days (with Laplace smoothing), the estimated chance of a movement on any given day is ${pct((hits + 1) / 32)}. The forecast is sponsored by statistics.`;
    },
  }),
  def({
    id: 'sx-week-forecast', title: 'Week-End Forecast', category: C, priority: 40, minDays: 28,
    when: (c) => weekdayOf(c.todayKey) !== 0 && c.observed.length >= 28,
    msg: (c) => {
      const rate = eventsInLast(c, 28).length / 28;
      const left = 7 - weekdayOf(c.todayKey);
      return `At your 28-day rate of ${rate.toFixed(2)} movements per day, expect roughly ${Math.round(rate * left)} more before the week ends on Sunday.`;
    },
  }),
  def({
    id: 'sx-identical-days', title: 'Identical Output Days', category: C, rarity: 'uncommon', priority: 46,
    when: (c) => c.days.some((d) => d.count >= 2 && countOn(c, addDays(d.key, 1)) === d.count && countOn(c, addDays(d.key, 2)) === d.count),
    msg: (c) => {
      const d = c.days.filter((x) => x.count >= 2 && countOn(c, addDays(x.key, 1)) === x.count && countOn(c, addDays(x.key, 2)) === x.count).pop()!;
      return `Three consecutive days starting ${fmtDayShort(d.key)} each produced exactly ${d.count} movements. Industrial-grade repeatability.`;
    },
  }),
  def({
    id: 'sx-operating-history', title: 'Operating History', category: C, priority: 33, minEvents: 2,
    when: (c) => c.n >= 2 && c.last!.ts - c.first!.ts >= 86400000 * 3,
    msg: (c) => `${Math.round((c.last!.ts - c.first!.ts) / 3600000).toLocaleString('en-US')} hours have elapsed between the first and most recent documented movements.`,
  }),
  def({
    id: 'sx-best-quarter', title: 'Busiest Rolling Quarter', category: C, priority: 42, minDays: 180,
    when: (c) => !!windowBest(c, 90, 'events'),
    msg: (c) => {
      const w = windowBest(c, 90, 'events')!.best;
      return `The busiest 90-day stretch began ${fmtDayShort(w.start)}: ${w.v} movements. Record quarter.`;
    },
  }),
  def({
    id: 'sx-stable-average', title: 'Statistically Stable', category: C, rarity: 'uncommon', priority: 41, minDays: 90,
    when: (c) => {
      const before = c.observed.length - 30;
      if (before < 60) return false;
      const counts = obsCounts(c);
      const a = counts.slice(0, before).reduce((x, y) => x + y, 0) / before;
      const b = c.n / counts.length;
      return a > 0 && Math.abs(b - a) / a < 0.02;
    },
    msg: (c) => `Your lifetime daily average (${(c.n / c.observed.length).toFixed(3)}) has barely moved in 30 days — less than a 2% change. The long-run average has converged.`,
  }),
  def({
    id: 'sx-hall-of-records', title: 'Hall of Records', category: C, priority: 47, minDays: 30,
    when: (c) => c.longestStreak >= 2 && c.maxPerDay >= 2,
    msg: (c) => `Hall of Records: longest streak ${c.longestStreak} days; single-day high ${c.maxPerDay}; longest pause ${c.longestGap} days; lifetime total ${c.n}.`,
  }),
  def({
    id: 'sx-hottest-slot', title: 'Hottest Time Slot', category: C, rarity: 'uncommon', priority: 55, minEvents: 20,
    when: (c) => {
      const vals = [...slotCounts(c).values()];
      const max = Math.max(...vals);
      return max >= 3 && vals.filter((v) => v === max).length === 1;
    },
    msg: (c) => {
      const [slot, v] = [...slotCounts(c).entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
      return `Your single busiest time slot: ${slot}s, with ${v} movements. If the Center had a peak-hours surcharge, it would apply here.`;
    },
  }),
  def({
    id: 'sx-unclaimed-slots', title: 'Unclaimed Time Slots', category: C, priority: 31, minEvents: 40,
    when: (c) => slotCounts(c).size < 35,
    msg: (c) => `Of 35 possible weekday-and-time-of-day combinations, ${35 - slotCounts(c).size} have never seen a movement. Plenty of unclaimed territory.`,
  }),
  def({
    id: 'sx-four-week-ma', title: 'Four-Week Moving Average', category: C, priority: 44, minDays: 56,
    when: (c) => weeklyEvents(c).length >= 6,
    msg: (c) => `Four-week moving average: ${mean(lastN(weeklyEvents(c), 4)).toFixed(1)} movements per week, vs. ${mean(weeklyEvents(c)).toFixed(1)} all-time.`,
  }),
  def({
    id: 'sx-sample-size', title: 'Sample Size Achieved', category: C, rarity: 'uncommon', priority: 61, minEvents: 30,
    when: (c) => c.n >= 30,
    msg: () => `With 30+ documented movements, the dataset has crossed the classic rule-of-thumb threshold for statistical analysis. The Intelligence Division is now fully operational.`,
  }),
  def({
    id: 'sx-longest-interval-hours', title: 'Longest Interval Between Movements', category: C, priority: 35, minEvents: 5,
    when: (c) => c.n >= 5,
    msg: (c) => {
      let best = 0;
      let at = c.events[1];
      for (let i = 1; i < c.events.length; i++) {
        const g = c.events[i].ts - c.events[i - 1].ts;
        if (g > best) { best = g; at = c.events[i]; }
      }
      return `The longest interval between any two consecutive movements was ${Math.round(best / 3600000)} hours, ending ${fmtDayShort(at.key)}.`;
    },
  }),
  def({
    id: 'sx-mode-daily', title: 'Modal Active Day', category: C, priority: 32, minDays: 21,
    when: (c) => c.poopDays >= 10,
    msg: (c) => {
      const counts = new Map<number, number>();
      for (const d of c.days) counts.set(d.count, (counts.get(d.count) ?? 0) + 1);
      const [k, v] = [...counts.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
      return `The most common active day features exactly ${plural(k, 'movement')} (${pct(v / c.poopDays)} of active days). This is your house specialty.`;
    },
  }),
  def({
    id: 'sx-eras', title: 'Early Era vs. Modern Era', category: C, rarity: 'uncommon', priority: 46, minDays: 60,
    when: (c) => c.observed.length >= 60,
    msg: (c) => {
      const half = Math.floor(c.observed.length / 2);
      const a = c.observed.slice(0, half).filter((k) => has(c, k)).length / half;
      const b = c.observed.slice(half).filter((k) => has(c, k)).length / (c.observed.length - half);
      return `Splitting your history in half: the early era was active on ${pct(a)} of days, the modern era on ${pct(b)}. ${Math.abs(a - b) < 0.05 ? 'Remarkably unchanged.' : b > a ? 'The modern era is more productive.' : 'The early era set a high bar.'}`;
    },
  }),
];
