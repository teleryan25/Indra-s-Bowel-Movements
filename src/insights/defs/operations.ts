// FIELD OPERATIONS — situation reports and briefings on the here and now.
import {
  def, fmtClock, fmtDayShort, plural, pct, cm, eventsInLast, poopDaysInLast, addDays, countOn, weekdayOf, has,
  shifted, relativeDayLabel,
} from '../h';
import type { InsightDef } from '../types';

const C = 'operations' as const;

export const operationsInsights: InsightDef[] = [
  def({
    id: 'op-awaiting-first', title: 'Awaiting First Deployment', category: C, priority: 100, minEvents: 0,
    when: (c) => c.n === 0,
    msg: () => `The Bowel Intelligence Division is fully staffed and awaiting its first data point. Record a movement to begin operations.`,
  }),
  def({
    id: 'op-today-summary', title: "Today's Operations Summary", category: C, priority: 64,
    when: (c) => c.todayCount > 0,
    msg: (c) => `Today's log: ${plural(c.todayCount, 'movement')} at ${c.dayMap.get(c.todayKey)!.events.map((e) => fmtClock(e.mins)).join(', ')}. All deliveries confirmed.`,
  }),
  def({
    id: 'op-yesterday-briefing', title: "Yesterday's Briefing", category: C, priority: 40, minDays: 2,
    when: (c) => c.yesterdayCount > 0,
    msg: (c) => `Yesterday: ${plural(c.yesterdayCount, 'movement')}, first at ${fmtClock(c.dayMap.get(c.yesterdayKey)!.events[0].mins)}. Filed and archived.`,
  }),
  def({
    id: 'op-last-known', title: 'Last Known Movement', category: C, priority: 36,
    when: (c) => !!c.last && c.todayCount === 0,
    msg: (c) => `Last confirmed movement: ${relativeDayLabel(c, c.last!.key)} at ${fmtClock(c.last!.mins)}.`,
  }),
  def({
    id: 'op-week-to-date', title: 'Week-to-Date', category: C, priority: 42, minDays: 3,
    when: (c) => weekdayOf(c.todayKey) !== 1,
    msg: (c) => {
      const back = (weekdayOf(c.todayKey) + 6) % 7;
      const start = addDays(c.todayKey, -back);
      let n = 0;
      let d = 0;
      for (let i = 0; i <= back; i++) { const k = addDays(start, i); n += countOn(c, k); if (has(c, k)) d++; }
      return `Week-to-date (since Monday): ${plural(n, 'movement')} across ${plural(d, 'active day')}.`;
    },
  }),
  def({
    id: 'op-status-report', title: 'Operational Status Report', category: C, priority: 34,
    when: (c) => c.n > 0,
    msg: (c) => c.todayCount > 0
      ? `Status: OPERATIONAL. ${plural(c.todayCount, 'movement')} confirmed today. All systems nominal.`
      : c.daysSinceLast === 1
        ? `Status: STANDBY. Last movement yesterday. Systems ready.`
        : `Status: AWAITING DEPLOYMENT. Last movement ${fmtDayShort(c.lastKey!)}. Systems ready and patient.`,
  }),
  def({
    id: 'op-lifetime', title: 'Lifetime Throughput', category: C, priority: 38,
    when: (c) => c.n >= 2,
    msg: (c) => `Lifetime documented throughput: ${plural(c.n, 'movement')} across ${plural(c.poopDays, 'active day')} since ${fmtDayShort(c.firstKey!)}.`,
  }),
  def({
    id: 'op-then-vs-now', title: 'Then vs. Now', category: C, priority: 46, minDays: 35,
    when: (c) => c.observed.length >= 35,
    msg: (c) => {
      const firstWeek = c.observed.slice(0, 7).filter((k) => has(c, k)).length;
      const lastWeek = c.observed.slice(-7).filter((k) => has(c, k)).length;
      return `Your first tracked week had ${plural(firstWeek, 'active day')}; your most recent week had ${lastWeek}. ${lastWeek > firstWeek ? 'Growth!' : lastWeek === firstWeek ? 'Consistency!' : 'Still a great week.'}`;
    },
  }),
  def({
    id: 'op-72-hour', title: '72-Hour Situation Report', category: C, priority: 44, minDays: 3,
    when: (c) => c.trackedDays >= 3,
    msg: (c) => `72-hour situation report: ${plural(eventsInLast(c, 3).length, 'movement')} across ${plural(poopDaysInLast(c, 3), 'day')}.`,
  }),
  def({
    id: 'op-weekly-standup', title: 'Weekly Standup', category: C, priority: 48, minDays: 14,
    when: (c) => c.trackedDays % 7 === 0,
    msg: (c) => `Weekly standup: the Center has now completed ${c.trackedDays / 7} weeks of operations. Last 7 days: ${plural(eventsInLast(c, 7).length, 'movement')}. No blockers.`,
  }),
  def({
    id: 'op-day-over-day', title: 'Day-over-Day', category: C, priority: 41, minDays: 2,
    when: (c) => c.todayCount > 0 && c.yesterdayCount > 0,
    msg: (c) => `Day-over-day: ${c.todayCount} today vs. ${c.yesterdayCount} yesterday. ${c.todayCount > c.yesterdayCount ? 'Up.' : c.todayCount === c.yesterdayCount ? 'Flat — perfectly stable.' : 'Down, with time still on the clock.'}`,
  }),
  def({
    id: 'op-prime-time', title: 'Right Now, Historically', category: C, rarity: 'uncommon', priority: 50, minEvents: 20,
    when: (c) => c.byHour[c.now.getHours()] / c.n >= 0.1,
    msg: (c) => `Historically, ${pct(c.byHour[c.now.getHours()] / c.n)} of your movements happen in this exact hour. You are currently in prime time.`,
  }),
  def({
    id: 'op-morning-briefing', title: 'Morning Briefing', category: C, priority: 52, minEvents: 10,
    when: (c) => c.now.getHours() < 12 && c.now.getHours() >= 4 && c.todayCount === 0,
    msg: (c) => {
      const nowM = shifted(c.now.getHours() * 60 + c.now.getMinutes());
      return `Morning briefing: operations have not yet begun today. For reference, ${pct(c.events.filter((e) => shifted(e.mins) > nowM).length / c.n)} of your historical movements happened later than this time of day.`;
    },
  }),
  def({
    id: 'op-evening-briefing', title: 'Evening Briefing', category: C, priority: 50, minEvents: 10,
    when: (c) => c.now.getHours() >= 18 && c.todayCount === 0,
    msg: (c) => `Evening briefing: ${pct(c.days.filter((d) => d.events[0].hour >= 18 || d.events[0].hour < 4).length / c.poopDays)} of your active days didn't get started until after 6 PM. There's still time.`,
  }),
  def({
    id: 'op-company-age', title: 'Company Age', category: C, priority: 30, minDays: 10,
    when: (c) => c.trackedDays >= 10,
    msg: (c) => `The Bowel Operations Center is ${plural(c.trackedDays, 'day')} old. In startup years, that's basically a unicorn.`,
  }),
  def({
    id: 'op-market-share', title: "This Month's Market Share", category: C, priority: 35, minDays: 45,
    when: (c) => (cm(c)?.events ?? 0) > 0 && c.months.length >= 2,
    msg: (c) => `This month accounts for ${pct(cm(c)!.events / c.n)} of all movements ever documented.`,
  }),
];
