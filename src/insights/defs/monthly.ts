// MONTHLY PERFORMANCE — 45 authored insights about month-level throughput.
import {
  def, ordinal, fmtDayShort, fmtMonth, plural, pct, cm, prevMonth, addDays, lastN, stdev, mean, rankDesc, countOn,
  type Ctx, type MonthRec,
} from '../h';
import type { InsightDef } from '../types';

const C = 'monthly' as const;
const done = (c: Ctx) => c.completeMonths;
const rate = (m: MonthRec) => (m.observedDays ? m.poopDays / m.observedDays : 0);
const name = (m: MonthRec) => fmtMonth(m.y, m.m);
const busiest = (c: Ctx) => done(c).reduce<MonthRec | null>((a, m) => (!a || m.events > a.events ? m : a), null);
const quietest = (c: Ctx) => done(c).reduce<MonthRec | null>((a, m) => (!a || m.events < a.events ? m : a), null);
const lastDone = (c: Ctx) => (done(c).length ? done(c)[done(c).length - 1] : null);
const prevDone = (c: Ctx) => (done(c).length >= 2 ? done(c)[done(c).length - 2] : null);
const dayOfMonth = (c: Ctx) => Number(c.todayKey.slice(8, 10));
const firstPoopDayOfMonth = (m: MonthRec) => m.dayRecs[0] ?? null;
const inDays = (m: MonthRec, lo: number, hi: number) => m.dayRecs.filter((d) => d.d >= lo && d.d <= hi).length;
const prevMonthStrongAt = (c: Ctx) => {
  // same point in previous month for pace comparisons
  const p = prevMonth(c);
  if (!p) return null;
  return p.dayRecs.filter((d) => d.d <= dayOfMonth(c)).length;
};

export const monthlyInsights: InsightDef[] = [
  def({
    id: 'mo-busiest-month', title: 'Busiest Completed Month', category: C, priority: 60, minDays: 60,
    when: (c) => done(c).length >= 2,
    msg: (c) => `${name(busiest(c)!)} holds the monthly throughput record with ${plural(busiest(c)!.events, 'movement')} across ${plural(busiest(c)!.poopDays, 'day')}.`,
  }),
  def({
    id: 'mo-quietest-month', title: 'Quietest Completed Month', category: C, priority: 44, minDays: 60,
    when: (c) => done(c).length >= 2 && quietest(c)!.key !== busiest(c)!.key,
    msg: (c) => `${name(quietest(c)!)} was the quietest full month on record: ${plural(quietest(c)!.events, 'movement')}. A strategic pause.`,
  }),
  def({
    id: 'mo-month-over-month-up', title: 'Month-Over-Month Growth', category: C, priority: 62, minDays: 60,
    when: (c) => !!lastDone(c) && !!prevDone(c) && lastDone(c)!.events > prevDone(c)!.events,
    msg: (c) => {
      const a = prevDone(c)!;
      const b = lastDone(c)!;
      return `${name(b)} delivered ${plural(b.events, 'movement')}, up ${pct((b.events - a.events) / Math.max(1, a.events))} from ${name(a)}'s ${a.events}. Growth is growth.`;
    },
  }),
  def({
    id: 'mo-month-over-month-down', title: 'Month-Over-Month Correction', category: C, priority: 46, minDays: 60,
    when: (c) => !!lastDone(c) && !!prevDone(c) && lastDone(c)!.events < prevDone(c)!.events,
    msg: (c) => {
      const a = prevDone(c)!;
      const b = lastDone(c)!;
      return `${name(b)} came in at ${plural(b.events, 'movement')}, down from ${a.events} in ${name(a)}. Analysts are calling it a healthy market correction.`;
    },
  }),
  def({
    id: 'mo-month-flat', title: 'Flat Quarter Energy', category: C, rarity: 'uncommon', priority: 48, minDays: 60,
    when: (c) => !!lastDone(c) && !!prevDone(c) && lastDone(c)!.events === prevDone(c)!.events,
    msg: (c) => `${name(prevDone(c)!)} and ${name(lastDone(c)!)} both produced exactly ${plural(lastDone(c)!.events, 'movement')}. Guidance was met precisely.`,
  }),
  def({
    id: 'mo-active-day-percentage', title: 'Monthly Coverage Rate', category: C, priority: 55,
    when: (c) => !!cm(c) && cm(c)!.observedDays >= 7,
    msg: (c) => `So far this month, ${pct(rate(cm(c)!))} of days (${cm(c)!.poopDays} of ${cm(c)!.observedDays}) have featured a movement.`,
  }),
  def({
    id: 'mo-first-of-month', title: 'First Delivery of the Month', category: C, priority: 50,
    when: (c) => !!cm(c) && !!firstPoopDayOfMonth(cm(c)!) && c.months.length >= 2,
    msg: (c) => {
      const d = firstPoopDayOfMonth(cm(c)!)!;
      return `This month's first movement arrived on ${fmtDayShort(d.key)}${d.d === 1 ? ' — day one. No warm-up required.' : `, ${d.d - 1} day${d.d - 1 === 1 ? '' : 's'} into the month.`}`;
    },
  }),
  def({
    id: 'mo-last-month-final', title: 'Final Delivery of Last Month', category: C, priority: 40,
    when: (c) => !!lastDone(c) && lastDone(c)!.dayRecs.length > 0,
    msg: (c) => {
      const m = lastDone(c)!;
      const d = m.dayRecs[m.dayRecs.length - 1];
      return `${name(m)} closed out with a final movement on ${fmtDayShort(d.key)}${d.d === m.daysInMonth ? ', the very last day. Books closed on time.' : '.'}`;
    },
  }),
  def({
    id: 'mo-strong-start', title: 'Strong Month Start', category: C, rarity: 'uncommon', priority: 58,
    when: (c) => !!cm(c) && dayOfMonth(c) >= 5 && inDays(cm(c)!, 1, 5) === 5,
    msg: () => `The first five days of this month all delivered. Q1 of the month: excellent.`,
  }),
  def({
    id: 'mo-strong-finish', title: 'Strong Month Finish', category: C, rarity: 'uncommon', priority: 56,
    when: (c) => !!lastDone(c) && inDays(lastDone(c)!, lastDone(c)!.daysInMonth - 4, lastDone(c)!.daysInMonth) === 5,
    msg: (c) => `${name(lastDone(c)!)} ended with movements on each of its final five days. Finishing strong is a choice.`,
  }),
  def({
    id: 'mo-mid-month', title: 'Mid-Month Activity', category: C, priority: 42, minDays: 60,
    when: (c) => done(c).length >= 2,
    msg: (c) => {
      const mid = done(c).reduce((a, m) => a + m.dayRecs.filter((d) => d.d >= 11 && d.d <= 20).reduce((s, d) => s + d.count, 0), 0);
      const all = done(c).reduce((a, m) => a + m.events, 0);
      return `Across complete months, days 11–20 account for ${pct(mid / Math.max(1, all))} of movements. The middle of the month ${mid / Math.max(1, all) > 0.33 ? 'pulls its weight' : 'is the quiet stretch'}.`;
    },
  }),
  def({
    id: 'mo-new-record-set', title: 'New Monthly Record', category: C, rarity: 'rare', priority: 82, minDays: 45,
    when: (c) => !!cm(c) && done(c).length >= 1 && cm(c)!.events > Math.max(...done(c).map((m) => m.events)),
    msg: (c) => `With ${plural(cm(c)!.events, 'movement')}, this month has already broken the all-time monthly record of ${Math.max(...done(c).map((m) => m.events))}. Champagne is on ice.`,
  }),
  def({
    id: 'mo-record-tied', title: 'Monthly Record Tied', category: C, rarity: 'rare', priority: 78, minDays: 45,
    when: (c) => !!cm(c) && done(c).length >= 1 && cm(c)!.events === Math.max(...done(c).map((m) => m.events)),
    msg: (c) => `This month has tied the all-time monthly record of ${plural(cm(c)!.events, 'movement')}. One more makes history.`,
  }),
  def({
    id: 'mo-consecutive-strong', title: 'Consecutive Strong Months', category: C, rarity: 'rare', priority: 66, minDays: 90,
    when: (c) => lastN(done(c), 3).length === 3 && lastN(done(c), 3).every((m) => rate(m) >= 0.7),
    msg: (c) => `${lastN(done(c), 3).map(name).join(', ')}: three consecutive months with movement on at least 70% of days. Sustained operational excellence.`,
  }),
  def({
    id: 'mo-consistent-months', title: 'Unusually Consistent Months', category: C, rarity: 'uncommon', priority: 53, minDays: 120,
    when: (c) => done(c).length >= 4 && stdev(done(c).map((m) => m.poopDays)) <= 1.5,
    msg: (c) => `Your complete months vary by just ${stdev(done(c).map((m) => m.poopDays)).toFixed(1)} active days (standard deviation). Month after month, remarkably steady.`,
  }),
  def({
    id: 'mo-unusual-month', title: 'Unusual Month', category: C, rarity: 'uncommon', priority: 54, minDays: 120,
    when: (c) => {
      const ms = done(c);
      if (ms.length < 4) return false;
      const mu = mean(ms.map((m) => m.events));
      const sd = stdev(ms.map((m) => m.events));
      return sd > 0 && ms.some((m) => Math.abs(m.events - mu) > 1.8 * sd);
    },
    msg: (c) => {
      const ms = done(c);
      const mu = mean(ms.map((m) => m.events));
      const sd = stdev(ms.map((m) => m.events));
      const odd = ms.filter((m) => Math.abs(m.events - mu) > 1.8 * sd).pop()!;
      return `${name(odd)} (${plural(odd.events, 'movement')}) stands out against your typical month (${mu.toFixed(1)}). The Intelligence Division has flagged it for the history books.`;
    },
  }),
  def({
    id: 'mo-streak-spanning', title: 'Month-Spanning Streak', category: C, rarity: 'uncommon', priority: 57,
    when: (c) => c.streaks.some((r) => r.len >= 3 && r.startKey.slice(0, 7) !== r.endKey.slice(0, 7)),
    msg: (c) => {
      const r = c.streaks.filter((x) => x.len >= 3 && x.startKey.slice(0, 7) !== x.endKey.slice(0, 7)).pop()!;
      return `A ${r.len}-day streak from ${fmtDayShort(r.startKey)} to ${fmtDayShort(r.endKey)} crossed a month boundary without breaking stride. Calendars can't stop this.`;
    },
  }),
  def({
    id: 'mo-multi-month-record', title: 'Monthly Double Record', category: C, rarity: 'uncommon', priority: 52, minDays: 45,
    when: (c) => c.months.filter((m) => m.multiDays > 0).length >= 2,
    msg: (c) => {
      const best = c.months.reduce((a, m) => (m.multiDays > a.multiDays ? m : a));
      return `${name(best)} holds the record for multi-movement days in a month: ${best.multiDays}. High-throughput season.`;
    },
  }),
  def({
    id: 'mo-perfect-month', title: 'Perfect Month', category: C, rarity: 'legendary', priority: 95,
    when: (c) => done(c).some((m) => m.poopDays === m.daysInMonth),
    msg: (c) => {
      const m = done(c).filter((x) => x.poopDays === x.daysInMonth).pop()!;
      return `${name(m)}: a movement on every single one of its ${m.daysInMonth} days. A perfect month. This will be taught in business schools.`;
    },
  }),
  def({
    id: 'mo-pace-vs-last', title: 'Monthly Pace Check', category: C, priority: 59, minDays: 35,
    when: (c) => !!cm(c) && dayOfMonth(c) >= 7 && prevMonthStrongAt(c) !== null,
    msg: (c) => {
      const now = cm(c)!.poopDays;
      const then = prevMonthStrongAt(c)!;
      const verdict = now > then ? 'ahead of' : now < then ? 'behind' : 'exactly matching';
      return `Through day ${dayOfMonth(c)}, this month has ${plural(now, 'active day')} — ${verdict} last month's pace (${then}).`;
    },
  }),
  def({
    id: 'mo-projection', title: 'End-of-Month Projection', category: C, priority: 55, minDays: 21,
    when: (c) => !!cm(c) && dayOfMonth(c) >= 10 && cm(c)!.observedDays >= 10,
    msg: (c) => {
      const m = cm(c)!;
      const projected = Math.round((m.events / m.observedDays) * m.daysInMonth);
      return `At the current pace (${m.events} movements in ${m.observedDays} days), this month projects to roughly ${projected} movements. Forecast only; past performance is not a guarantee of future movements.`;
    },
  }),
  def({
    id: 'mo-month-rank', title: 'Monthly Leaderboard Position', category: C, priority: 50, minDays: 90,
    when: (c) => !!cm(c) && done(c).length >= 3,
    msg: (c) => {
      const all = done(c).map((m) => m.events);
      const r = rankDesc(all, cm(c)!.events);
      return `With ${plural(cm(c)!.events, 'movement')} so far, this month already ranks #${r} out of ${done(c).length + 1} months tracked.`;
    },
  }),
  def({
    id: 'mo-first-full-month', title: 'First Full Month Complete', category: C, rarity: 'uncommon', priority: 74,
    when: (c) => done(c).length >= 1,
    msg: (c) => `${name(done(c)[0])} was your first fully tracked month: ${plural(done(c)[0].events, 'movement')} on ${plural(done(c)[0].poopDays, 'day')}. The Center has completed its first reporting period.`,
  }),
  def({
    id: 'mo-twenty-club', title: '20-Day Month', category: C, rarity: 'uncommon', priority: 64,
    when: (c) => c.months.some((m) => m.poopDays >= 20),
    msg: (c) => {
      const m = c.months.filter((x) => x.poopDays >= 20).pop()!;
      return `${name(m)} delivered on ${m.poopDays} different days. Membership in the 20-Day Club has been granted.`;
    },
  }),
  def({
    id: 'mo-month-events-exceed-days', title: 'More Movements Than Days', category: C, rarity: 'rare', priority: 70,
    when: (c) => done(c).some((m) => m.events > m.daysInMonth),
    msg: (c) => {
      const m = done(c).filter((x) => x.events > x.daysInMonth).pop()!;
      return `${name(m)} logged ${m.events} movements in a ${m.daysInMonth}-day month. Output exceeded the calendar itself.`;
    },
  }),
  def({
    id: 'mo-first-vs-second-half', title: 'Half-Month Split', category: C, priority: 43, minDays: 60,
    when: (c) => !!lastDone(c) && lastDone(c)!.events >= 8,
    msg: (c) => {
      const m = lastDone(c)!;
      const a = m.dayRecs.filter((d) => d.d <= 15).reduce((s, d) => s + d.count, 0);
      const b = m.events - a;
      return `${name(m)} split ${a} movements in the first half and ${b} in the second. ${a === b ? 'Perfectly balanced.' : a > b ? 'Front-loaded.' : 'A back-half surge.'}`;
    },
  }),
  def({
    id: 'mo-best-stretch-in-month', title: 'Best Stretch This Month', category: C, priority: 47,
    when: (c) => !!cm(c) && c.streaks.some((r) => r.len >= 3 && r.endKey.slice(0, 7) === c.todayKey.slice(0, 7)),
    msg: (c) => {
      const r = c.streaks.filter((x) => x.endKey.slice(0, 7) === c.todayKey.slice(0, 7)).reduce((a, b) => (b.len > a.len ? b : a));
      return `This month's longest run so far: ${r.len} consecutive days, ending ${fmtDayShort(r.endKey)}.`;
    },
  }),
  def({
    id: 'mo-zero-day-month-start', title: 'Slow Month Start', category: C, priority: 35,
    when: (c) => !!cm(c) && dayOfMonth(c) >= 4 && c.months.length >= 2 && inDays(cm(c)!, 1, 3) === 0,
    msg: () => `The first three days of this month passed quietly. Plenty of month left. Operations remains optimistic.`,
  }),
  def({
    id: 'mo-month-doubles-first', title: 'Month Opened With a Double', category: C, rarity: 'rare', priority: 60,
    when: (c) => c.months.some((m) => m.dayRecs[0]?.d === 1 && m.dayRecs[0].count >= 2),
    msg: (c) => {
      const m = c.months.filter((x) => x.dayRecs[0]?.d === 1 && x.dayRecs[0].count >= 2).pop()!;
      return `${name(m)} opened on the 1st with ${plural(m.dayRecs[0].count, 'movement')}. Setting the tone early.`;
    },
  }),
  def({
    id: 'mo-seasonal', title: 'Seasonal Performance', category: C, rarity: 'rare', priority: 52, minDays: 270,
    when: (c) => {
      const seasons = [[11, 0, 1], [2, 3, 4], [5, 6, 7], [8, 9, 10]];
      return seasons.filter((s) => done(c).some((m) => s.includes(m.m))).length >= 3;
    },
    msg: (c) => {
      const seasons: [string, number[]][] = [['winter', [11, 0, 1]], ['spring', [2, 3, 4]], ['summer', [5, 6, 7]], ['fall', [8, 9, 10]]];
      const rows = seasons
        .map(([nm, ms]) => {
          const mr = done(c).filter((m) => ms.includes(m.m));
          const days = mr.reduce((a, m) => a + m.observedDays, 0);
          const hit = mr.reduce((a, m) => a + m.poopDays, 0);
          return { nm, r: days ? hit / days : -1 };
        })
        .filter((r) => r.r >= 0)
        .sort((a, b) => b.r - a.r);
      return `Seasonal analysis: ${rows[0].nm} is your strongest season (${pct(rows[0].r)} of days active), ${rows[rows.length - 1].nm} your quietest (${pct(rows[rows.length - 1].r)}).`;
    },
  }),
  def({
    id: 'mo-year-to-date', title: 'Year-to-Date Report', category: C, priority: 54, minDays: 30,
    when: (c) => c.months.filter((m) => m.y === c.now.getFullYear()).length >= 2,
    msg: (c) => {
      const y = c.now.getFullYear();
      const n = c.events.filter((e) => e.y === y).length;
      const d = c.days.filter((x) => x.y === y).length;
      return `Year-to-date ${y}: ${plural(n, 'movement')} across ${plural(d, 'active day')}. The annual report is shaping up nicely.`;
    },
  }),
  def({
    id: 'mo-year-over-year', title: 'Year-Over-Year Comparison', category: C, rarity: 'rare', priority: 68, minDays: 380,
    when: (c) => {
      const cur = cm(c);
      if (!cur) return false;
      return !!c.monthMap.get(`${cur.y - 1}-${String(cur.m + 1).padStart(2, '0')}`);
    },
    msg: (c) => {
      const cur = cm(c)!;
      const ly = c.monthMap.get(`${cur.y - 1}-${String(cur.m + 1).padStart(2, '0')}`)!;
      return `Same month last year: ${plural(ly.events, 'movement')} in ${name(ly)}. This ${fmtMonth(cur.y, cur.m).split(' ')[0]} so far: ${cur.events}. Year-over-year analysis is now possible, which is frankly alarming.`;
    },
  }),
  def({
    id: 'mo-month-first-day-today', title: 'Month Opener', category: C, priority: 67,
    when: (c) => dayOfMonth(c) === 1 && c.todayCount > 0 && c.months.length >= 2,
    msg: () => `Movement confirmed on the first day of the month. The new reporting period is off to an immediate start.`,
  }),
  def({
    id: 'mo-month-last-day-today', title: 'Closing the Books', category: C, priority: 67,
    when: (c) => !!cm(c) && dayOfMonth(c) === cm(c)!.daysInMonth && c.todayCount > 0,
    msg: (c) => `Movement confirmed on the final day of the month, bringing this month's total to ${plural(cm(c)!.events, 'movement')}. The books are closed.`,
  }),
  def({
    id: 'mo-monthly-average', title: 'Average Monthly Output', category: C, priority: 48, minDays: 90,
    when: (c) => done(c).length >= 3,
    msg: (c) => `Across ${done(c).length} complete months, you average ${mean(done(c).map((m) => m.events)).toFixed(1)} movements and ${mean(done(c).map((m) => m.poopDays)).toFixed(1)} active days per month.`,
  }),
  def({
    id: 'mo-improving-trend', title: 'Three-Month Uptrend', category: C, rarity: 'uncommon', priority: 58, minDays: 100,
    when: (c) => {
      const ms = lastN(done(c), 3);
      return ms.length === 3 && rate(ms[0]) < rate(ms[1]) && rate(ms[1]) < rate(ms[2]);
    },
    msg: (c) => {
      const ms = lastN(done(c), 3);
      return `Monthly coverage has risen three months running: ${ms.map((m) => pct(rate(m))).join(' → ')}. The trend line is pointing up and to the right.`;
    },
  }),
  def({
    id: 'mo-month-spanning-drought', title: 'Month-Spanning Quiet Period', category: C, priority: 40,
    when: (c) => c.gaps.some((g) => g.len >= 2 && g.fromKey.slice(0, 7) !== g.toKey.slice(0, 7)),
    msg: (c) => {
      const g = c.gaps.filter((x) => x.len >= 2 && x.fromKey.slice(0, 7) !== x.toKey.slice(0, 7)).pop()!;
      return `A ${g.len}-day quiet period stretched across a month boundary, from ${fmtDayShort(addDays(g.fromKey, 1))} to ${fmtDayShort(addDays(g.toKey, -1))}. The fiscal calendar was not consulted.`;
    },
  }),
  def({
    id: 'mo-thirty-events', title: '30-Movement Month', category: C, rarity: 'rare', priority: 70,
    when: (c) => c.months.some((m) => m.events >= 30),
    msg: (c) => {
      const m = c.months.filter((x) => x.events >= 30).pop()!;
      return `${name(m)} crossed 30 movements (${m.events} total). Throughput at this level typically requires additional warehouse space.`;
    },
  }),
  def({
    id: 'mo-weekend-heavy-month', title: 'Weekend-Heavy Month', category: C, priority: 38, minDays: 35,
    when: (c) => !!lastDone(c) && lastDone(c)!.events >= 10 && lastDone(c)!.dayRecs.filter((d) => d.wd === 0 || d.wd === 6).reduce((a, d) => a + d.count, 0) / lastDone(c)!.events >= 0.4,
    msg: (c) => {
      const m = lastDone(c)!;
      const w = m.dayRecs.filter((d) => d.wd === 0 || d.wd === 6).reduce((a, d) => a + d.count, 0);
      return `${pct(w / m.events)} of ${name(m)}'s movements happened on weekends. That month really lived for the weekend.`;
    },
  }),
  def({
    id: 'mo-best-rate-month', title: 'Highest Coverage Month', category: C, priority: 51, minDays: 60,
    when: (c) => done(c).length >= 2,
    msg: (c) => {
      const m = done(c).reduce((a, b) => (rate(b) > rate(a) ? b : a));
      return `${name(m)} achieved your best-ever monthly coverage: movement on ${pct(rate(m))} of days.`;
    },
  }),
  def({
    id: 'mo-days-remaining-to-record', title: 'Record Watch', category: C, priority: 63, minDays: 45,
    when: (c) => {
      const cur = cm(c);
      if (!cur || done(c).length < 1) return false;
      const rec = Math.max(...done(c).map((m) => m.poopDays));
      const left = cur.daysInMonth - dayOfMonth(c) + (c.todayCount > 0 ? 0 : 1);
      return rec > cur.poopDays && rec - cur.poopDays <= Math.min(3, left);
    },
    msg: (c) => {
      const cur = cm(c)!;
      const rec = Math.max(...done(c).map((m) => m.poopDays));
      return `This month has ${cur.poopDays} active days. The all-time monthly record is ${rec}. Only ${plural(rec - cur.poopDays, 'more day')} to tie it.`;
    },
  }),
  def({
    id: 'mo-month-without-doubles', title: 'Single-Service Month', category: C, priority: 34, minDays: 45,
    when: (c) => !!lastDone(c) && lastDone(c)!.poopDays >= 10 && lastDone(c)!.multiDays === 0 && c.multiDayCount > 0,
    msg: (c) => `${name(lastDone(c)!)} delivered on ${lastDone(c)!.poopDays} days without a single multi-movement day. Consistent, disciplined, one-and-done.`,
  }),
  def({
    id: 'mo-same-count-as-date', title: 'Numerical Harmony', category: C, rarity: 'rare', priority: 58,
    when: (c) => !!cm(c) && c.todayCount > 0 && cm(c)!.events === dayOfMonth(c) && dayOfMonth(c) >= 5,
    msg: (c) => `Today is the ${ordinal(dayOfMonth(c))}... and this month's movement count is exactly ${cm(c)!.events}. One movement per calendar day, on average, to the decimal.`,
  }),
  def({
    id: 'mo-month-coverage-today-anniv', title: 'Monthly Anniversary Check', category: C, priority: 33, minDays: 32,
    when: (c) => {
      if (!c.firstKey) return false;
      const d = Number(c.firstKey.slice(8, 10));
      return dayOfMonth(c) === d && c.todayKey !== c.firstKey;
    },
    msg: (c) => {
      const since = c.events.filter((e) => e.key > addDays(c.todayKey, -30)).length;
      return `Today marks another monthly anniversary of the Center's founding. Movements in the last 30 days: ${since}. Tradition demands a brief moment of reflection.`;
    },
  }),
  def({
    id: 'mo-busiest-day-of-month', title: 'Favorite Date of the Month', category: C, rarity: 'uncommon', priority: 39, minDays: 90,
    when: (c) => {
      const counts = new Array(32).fill(0);
      for (const d of c.days) counts[d.d]++;
      const max = Math.max(...counts);
      return max >= 3 && counts.filter((x) => x === max).length === 1;
    },
    msg: (c) => {
      const counts = new Array(32).fill(0);
      for (const d of c.days) counts[d.d]++;
      const max = Math.max(...counts);
      const day = counts.indexOf(max);
      return `The ${ordinal(day)} of the month has delivered in ${max} different months — more than any other date. It is the official Date of Record.`;
    },
  }),
  def({
    id: 'mo-last-three-days', title: 'Quarter-End Push', category: C, priority: 37, minDays: 30,
    when: (c) => !!lastDone(c) && [0, 1, 2].every((i) => countOn(c, `${lastDone(c)!.key}-${String(lastDone(c)!.daysInMonth - i).padStart(2, '0')}`) > 0) && [2, 5, 8, 11].includes(lastDone(c)!.m),
    msg: (c) => `${name(lastDone(c)!)} was a quarter-end month, and the final three days all delivered. The quarter closed with a push.`,
  }),
  def({
    id: 'mo-today-is-months-best-day', title: 'Top Day of the Month', category: C, priority: 49,
    when: (c) => c.todayCount >= 2 && !!cm(c) && cm(c)!.dayRecs.every((d) => d.key === c.todayKey || d.count < c.todayCount),
    msg: (c) => `With ${plural(c.todayCount, 'movement')}, today is officially this month's highest-throughput day.`,
  }),
];

