// TIMING INTELLIGENCE — 60 authored insights about *when* operations occur.
import {
  def, fmtClock, fmtDay, fmtDayShort, plural, pct, mm, modalHour, earliest, latest, avgClock, medClock, sdClock,
  laterBy, shifted, isWeekend, wdName, firstOfEachDay, todayRec, eventsInLast, hourShare, h12digits, lastN,
  daysBetween, addDays, cached, sameDayIntervals, prevMonth, cm, median,
  type Ctx, type Ev,
} from '../h';
import { fmtHour, fmtHourRange } from '../../lib/dates';
import type { InsightDef } from '../types';

const C = 'time' as const;

const weekendMins = (c: Ctx) => c.events.filter((e) => isWeekend(e.wd)).map((e) => e.mins);
const weekdayMins = (c: Ctx) => c.events.filter((e) => !isWeekend(e.wd)).map((e) => e.mins);

const firstToday = (c: Ctx): Ev | null => todayRec(c)?.events[0] ?? null;
const historicFirsts = (c: Ctx) => firstOfEachDay(c).filter((e) => e.key !== c.todayKey).map((e) => e.mins);

const sameMinutePair = (c: Ctx) =>
  cached(c, 'time.sameMinute', () => {
    const seen = new Map<string, Ev>();
    for (const e of c.events) {
      const k = `${e.hour}:${e.minute}`;
      const prior = seen.get(k);
      if (prior && prior.key !== e.key) return [prior, e] as const;
      if (!prior) seen.set(k, e);
    }
    return null;
  });

const sameHourRun = (c: Ctx) =>
  cached(c, 'time.sameHourRun', () => {
    let best = { len: 0, hour: 0, endKey: '' };
    let len = 0;
    let prev: Ev | null = null;
    for (const e of firstOfEachDay(c)) {
      if (prev && daysBetween(prev.key, e.key) === 1 && prev.hour === e.hour) len++;
      else len = 1;
      if (len > best.len) best = { len, hour: e.hour, endKey: e.key };
      prev = e;
    }
    return best;
  });

const quarterBuckets = (c: Ctx) => {
  const b = [0, 0, 0, 0];
  for (const e of c.events) b[Math.floor(e.minute / 15)]++;
  return b;
};

const quietHours = (c: Ctx) =>
  cached(c, 'time.quiet', () => {
    // longest circular run of empty hours
    let best = { len: 0, start: 0 };
    for (let s = 0; s < 24; s++) {
      if (c.byHour[s] !== 0 || c.byHour[(s + 23) % 24] === 0) continue;
      let len = 0;
      while (len < 24 && c.byHour[(s + len) % 24] === 0) len++;
      if (len > best.len) best = { len, start: s };
    }
    return best;
  });

const weekAgoEcho = (c: Ctx) =>
  cached(c, 'time.weekEcho', () => {
    for (let i = c.events.length - 1; i >= 0; i--) {
      const e = c.events[i];
      const prior = c.dayMap.get(addDays(e.key, -7));
      const match = prior?.events.find((p) => Math.abs(p.mins - e.mins) <= 10);
      if (match) return { e, match };
    }
    return null;
  });

const standingAppointment = (c: Ctx) =>
  cached(c, 'time.standing', () => {
    const recent = eventsInLast(c, 14);
    const byHour = new Map<number, Set<string>>();
    for (const e of recent) {
      if (!byHour.has(e.hour)) byHour.set(e.hour, new Set());
      byHour.get(e.hour)!.add(e.key);
    }
    let best: { hour: number; days: number } | null = null;
    for (const [hour, set] of byHour) if (!best || set.size > best.days) best = { hour, days: set.size };
    return best;
  });

const clusterOf3 = (c: Ctx) =>
  cached(c, 'time.cluster3', () => {
    const firsts = firstOfEachDay(c).slice().sort((a, b) => a.mins - b.mins);
    for (let i = 0; i + 2 < firsts.length; i++) {
      if (firsts[i + 2].mins - firsts[i].mins <= 5) return firsts.slice(i, i + 3);
    }
    return null;
  });

export const timeInsights: InsightDef[] = [
  def({
    id: 'time-first-timestamp', title: 'Operations Commenced', category: C, priority: 40,
    when: (c) => !!c.first,
    msg: (c) => `The Bowel Operations Center logged its very first movement at ${fmtClock(c.first!.mins)} on ${fmtDay(c.first!.key)}. Historians will want to know.`,
  }),
  def({
    id: 'time-earliest-ever', title: 'Earliest Recorded Movement', category: C, priority: 55, minEvents: 3,
    when: (c) => !!earliest(c),
    msg: (c) => `Your earliest documented movement came at ${fmtClock(earliest(c)!.mins)} on ${fmtDayShort(earliest(c)!.key)}. The rest of the world was not yet open for business.`,
  }),
  def({
    id: 'time-latest-ever', title: 'Latest Recorded Movement', category: C, priority: 55, minEvents: 3,
    when: (c) => !!latest(c),
    msg: (c) => `Your latest documented movement came at ${fmtClock(latest(c)!.mins)} on ${fmtDayShort(latest(c)!.key)}. Operations do not keep banker's hours.`,
  }),
  def({
    id: 'time-average-clock', title: 'Average Time of Operations', category: C, priority: 60, minEvents: 5,
    when: (c) => c.n >= 5,
    msg: (c) => `Averaged across ${plural(c.n, 'movement')}, your typical deployment time is ${fmtClock(avgClock(c.events.map((e) => e.mins)))}.`,
  }),
  def({
    id: 'time-median-clock', title: 'Median Deployment Time', category: C, priority: 52, minEvents: 7,
    when: (c) => c.n >= 7,
    msg: (c) => `Half of all movements happen before ${fmtClock(medClock(c.events.map((e) => e.mins)))} and half after. The median has spoken.`,
  }),
  def({
    id: 'time-peak-hour', title: 'Peak Operating Hour', category: C, priority: 62, minEvents: 6,
    when: (c) => c.byHour[modalHour(c)] >= 2,
    msg: (c) => `The ${fmtHourRange(modalHour(c))} window is your busiest hour, hosting ${plural(c.byHour[modalHour(c)], 'movement')} (${pct(c.byHour[modalHour(c)] / c.n)} of all activity).`,
  }),
  def({
    id: 'time-preferred-shift', title: 'Preferred Shift', category: C, priority: 58, minEvents: 8,
    when: (c) => c.n >= 8,
    msg: (c) => {
      const entries = Object.entries(c.daypart) as [keyof typeof c.daypart, number][];
      const [part, v] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
      const names = { early: 'early-morning', morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'night' };
      return `Operations are ${pct(v / c.n)} ${names[part]} shift. Staffing has been adjusted accordingly.`;
    },
  }),
  def({
    id: 'time-morning-majority', title: 'Morning Institution', category: C, priority: 57, minEvents: 10,
    when: (c) => hourShare(c, 4, 12) >= 0.6,
    msg: (c) => `${pct(hourShare(c, 4, 12))} of movements happen before noon. You are, operationally speaking, a morning person.`,
  }),
  def({
    id: 'time-afternoon-majority', title: 'Afternoon Specialist', category: C, priority: 57, minEvents: 10,
    when: (c) => hourShare(c, 12, 17) >= 0.45,
    msg: (c) => `${pct(hourShare(c, 12, 17))} of movements land between noon and 5 PM. The afternoon desk carries this organization.`,
  }),
  def({
    id: 'time-evening-majority', title: 'Evening Operations Division', category: C, priority: 57, minEvents: 10,
    when: (c) => hourShare(c, 17, 22) >= 0.45,
    msg: (c) => `${pct(hourShare(c, 17, 22))} of movements happen between 5 and 10 PM. The evening division is quietly running the company.`,
  }),
  def({
    id: 'time-night-owl', title: 'Night Owl Protocol', category: C, rarity: 'uncommon', priority: 60, minEvents: 10,
    when: (c) => c.daypart.night / c.n >= 0.2,
    msg: (c) => `${pct(c.daypart.night / c.n)} of movements occur between 10 PM and 4 AM. The night shift is fully staffed.`,
  }),
  def({
    id: 'time-pre-dawn', title: 'Pre-Dawn Operations', category: C, rarity: 'uncommon', priority: 64,
    when: (c) => c.events.some((e) => e.hour >= 4 && e.hour < 6),
    msg: (c) => {
      const list = c.events.filter((e) => e.hour >= 4 && e.hour < 6);
      return `${plural(list.length, 'movement')} logged between 4 and 6 AM. Most couriers aren't awake yet.`;
    },
  }),
  def({
    id: 'time-lunch-logistics', title: 'Lunch Break Logistics', category: C, priority: 45, minEvents: 6,
    when: (c) => c.events.filter((e) => e.mins >= 690 && e.mins < 810).length >= 3,
    msg: (c) => `${c.events.filter((e) => e.mins >= 690 && e.mins < 810).length} movements occurred between 11:30 AM and 1:30 PM. The lunch hour is being used strategically.`,
  }),
  def({
    id: 'time-top-of-hour', title: 'Precision Timing', category: C, rarity: 'uncommon', priority: 48,
    when: (c) => c.events.some((e) => e.minute === 0),
    msg: (c) => {
      const list = c.events.filter((e) => e.minute === 0);
      return `${plural(list.length, 'movement')} happened at exactly the top of the hour, most recently ${fmtClock(list[list.length - 1].mins)} on ${fmtDayShort(list[list.length - 1].key)}. Swiss rail would approve.`;
    },
  }),
  def({
    id: 'time-deja-vu', title: 'Déjà Vu', category: C, rarity: 'rare', priority: 70, minEvents: 10,
    when: (c) => !!sameMinutePair(c),
    msg: (c) => {
      const [a, b] = sameMinutePair(c)!;
      return `On ${fmtDayShort(a.key)} and ${fmtDayShort(b.key)}, movements happened at the exact same minute: ${fmtClock(b.hour * 60 + b.minute)}. Coincidence? The Intelligence Division is not ruling anything out.`;
    },
  }),
  def({
    id: 'time-five-minute-cluster', title: 'Clockwork Cluster', category: C, rarity: 'rare', priority: 66, minEvents: 10,
    when: (c) => !!clusterOf3(c),
    msg: (c) => {
      const cl = clusterOf3(c)!;
      return `Three separate days opened within the same five minutes (${fmtClock(cl[0].mins)}–${fmtClock(cl[2].mins)}): ${cl.map((e) => fmtDayShort(e.key)).join(', ')}.`;
    },
  }),
  def({
    id: 'time-clockwork', title: 'Clockwork Operations', category: C, rarity: 'uncommon', priority: 63, minEvents: 10,
    when: (c) => c.poopDays >= 10 && sdClock(firstOfEachDay(c).map((e) => e.mins)) < 60,
    msg: (c) => `Your first movement of the day varies by only about ${mm(sdClock(firstOfEachDay(c).map((e) => e.mins)))} (standard deviation). This is logistics-grade consistency.`,
  }),
  def({
    id: 'time-flexible', title: 'Flexible Scheduling', category: C, priority: 44, minEvents: 10,
    when: (c) => sdClock(c.events.map((e) => e.mins)) > 240,
    msg: (c) => `Movement times vary by about ${mm(sdClock(c.events.map((e) => e.mins)))} (standard deviation). Operations refuse to be pinned down.`,
  }),
  def({
    id: 'time-trending-earlier', title: 'Shifting Earlier', category: C, priority: 61, minEvents: 20,
    when: (c) => {
      const recent = lastN(c.events, 14).map((e) => e.mins);
      const before = c.events.slice(0, -14).map((e) => e.mins);
      return before.length >= 6 && laterBy(avgClock(before), avgClock(recent)) >= 45;
    },
    msg: (c) => {
      const recent = lastN(c.events, 14).map((e) => e.mins);
      const before = c.events.slice(0, -14).map((e) => e.mins);
      return `Your last 14 movements averaged ${fmtClock(avgClock(recent))}, about ${mm(laterBy(avgClock(before), avgClock(recent)))} earlier than your prior average of ${fmtClock(avgClock(before))}.`;
    },
  }),
  def({
    id: 'time-trending-later', title: 'Drifting Later', category: C, priority: 61, minEvents: 20,
    when: (c) => {
      const recent = lastN(c.events, 14).map((e) => e.mins);
      const before = c.events.slice(0, -14).map((e) => e.mins);
      return before.length >= 6 && laterBy(avgClock(recent), avgClock(before)) >= 45;
    },
    msg: (c) => {
      const recent = lastN(c.events, 14).map((e) => e.mins);
      const before = c.events.slice(0, -14).map((e) => e.mins);
      return `Your last 14 movements averaged ${fmtClock(avgClock(recent))}, roughly ${mm(laterBy(avgClock(recent), avgClock(before)))} later than the historical ${fmtClock(avgClock(before))}. The schedule is sliding.`;
    },
  }),
  def({
    id: 'time-weekend-sleep-in', title: 'Weekend Delay Effect', category: C, priority: 59, minEvents: 12,
    when: (c) => weekendMins(c).length >= 4 && weekdayMins(c).length >= 4 && laterBy(avgClock(weekendMins(c)), avgClock(weekdayMins(c))) >= 60,
    msg: (c) => `Weekend movements average ${fmtClock(avgClock(weekendMins(c)))}, a full ${mm(laterBy(avgClock(weekendMins(c)), avgClock(weekdayMins(c))))} after weekdays (${fmtClock(avgClock(weekdayMins(c)))}). Saturdays run on their own clock.`,
  }),
  def({
    id: 'time-weekend-early', title: 'Weekend Early Start', category: C, rarity: 'uncommon', priority: 59, minEvents: 12,
    when: (c) => weekendMins(c).length >= 4 && weekdayMins(c).length >= 4 && laterBy(avgClock(weekdayMins(c)), avgClock(weekendMins(c))) >= 45,
    msg: (c) => `Surprisingly, weekend movements (${fmtClock(avgClock(weekendMins(c)))}) run about ${mm(laterBy(avgClock(weekdayMins(c)), avgClock(weekendMins(c))))} earlier than weekdays. Leisure, apparently, is efficient.`,
  }),
  def({
    id: 'time-weekday-timezones', title: 'Weekday Time Zones', category: C, rarity: 'uncommon', priority: 56, minEvents: 25,
    when: (c) => {
      const avgs = [0, 1, 2, 3, 4, 5, 6].map((wd) => c.events.filter((e) => e.wd === wd).map((e) => e.mins)).filter((l) => l.length >= 3).map(avgClock);
      return avgs.length >= 3 && Math.max(...avgs.map(shifted)) - Math.min(...avgs.map(shifted)) >= 90;
    },
    msg: (c) => {
      const rows = [0, 1, 2, 3, 4, 5, 6]
        .map((wd) => ({ wd, list: c.events.filter((e) => e.wd === wd).map((e) => e.mins) }))
        .filter((r) => r.list.length >= 3)
        .map((r) => ({ wd: r.wd, avg: avgClock(r.list) }));
      rows.sort((a, b) => shifted(a.avg) - shifted(b.avg));
      const lo = rows[0];
      const hi = rows[rows.length - 1];
      return `${wdName(lo.wd)} movements average ${fmtClock(lo.avg)}; ${wdName(hi.wd)} movements average ${fmtClock(hi.avg)}. Different days, different time zones.`;
    },
  }),
  def({
    id: 'time-same-hour-run', title: 'Same Time Tomorrow', category: C, rarity: 'rare', priority: 67, minEvents: 5,
    when: (c) => sameHourRun(c).len >= 3,
    msg: (c) => {
      const r = sameHourRun(c);
      return `${r.len} consecutive days opened in the same ${fmtHourRange(r.hour)} hour, ending ${fmtDayShort(r.endKey)}. Punctuality is a core value.`;
    },
  }),
  def({
    id: 'time-today-early', title: 'Ahead of Schedule', category: C, priority: 72, minEvents: 10,
    when: (c) => !!firstToday(c) && historicFirsts(c).length >= 7 && laterBy(medClock(historicFirsts(c)), firstToday(c)!.mins) > 60,
    msg: (c) => `Today's first movement came at ${fmtClock(firstToday(c)!.mins)}, about ${mm(laterBy(medClock(historicFirsts(c)), firstToday(c)!.mins))} ahead of your usual ${fmtClock(medClock(historicFirsts(c)))}. Early delivery bonus approved.`,
  }),
  def({
    id: 'time-today-late', title: 'Fashionably Late', category: C, priority: 70, minEvents: 10,
    when: (c) => !!firstToday(c) && historicFirsts(c).length >= 7 && laterBy(firstToday(c)!.mins, medClock(historicFirsts(c))) > 90,
    msg: (c) => `Today's first movement arrived at ${fmtClock(firstToday(c)!.mins)}, about ${mm(laterBy(firstToday(c)!.mins, medClock(historicFirsts(c))))} after your usual opening time. Worth the wait.`,
  }),
  def({
    id: 'time-today-on-schedule', title: 'Right On Schedule', category: C, priority: 66, minEvents: 10,
    when: (c) => !!firstToday(c) && historicFirsts(c).length >= 7 && Math.abs(laterBy(firstToday(c)!.mins, medClock(historicFirsts(c)))) <= 20,
    msg: (c) => `Today's first movement at ${fmtClock(firstToday(c)!.mins)} landed within ${mm(Math.abs(laterBy(firstToday(c)!.mins, medClock(historicFirsts(c)))))} of your typical opening time. The schedule holds.`,
  }),
  def({
    id: 'time-new-early-record-today', title: 'New Early Record', category: C, rarity: 'uncommon', priority: 80, minEvents: 10,
    when: (c) => !!firstToday(c) && earliest(c)?.key === c.todayKey,
    msg: (c) => `Today at ${fmtClock(earliest(c)!.mins)}, you set a new all-time record for earliest movement. The previous record is now a footnote.`,
  }),
  def({
    id: 'time-new-late-record-today', title: 'New Late-Night Record', category: C, rarity: 'uncommon', priority: 80, minEvents: 10,
    when: (c) => c.todayCount > 0 && latest(c)?.key === c.todayKey,
    msg: (c) => `Today's ${fmtClock(latest(c)!.mins)} movement is the latest in recorded history. Overtime has been logged.`,
  }),
  def({
    id: 'time-hour-coverage', title: 'Round-the-Clock Coverage', category: C, rarity: 'rare', priority: 54, minEvents: 20,
    when: (c) => c.byHour.filter((x) => x > 0).length >= 12,
    msg: (c) => `Movements have been recorded in ${c.byHour.filter((x) => x > 0).length} of the 24 hours of the day. Coverage is approaching 24/7.`,
  }),
  def({
    id: 'time-unexplored-hours', title: 'Unexplored Hours', category: C, priority: 42, minEvents: 30,
    when: (c) => {
      const empty = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].filter((h) => c.byHour[h] === 0);
      return empty.length > 0 && empty.length <= 5;
    },
    msg: (c) => {
      const empty = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].filter((h) => c.byHour[h] === 0);
      return `Despite ${plural(c.n, 'movement')}, no activity has ever been recorded in the ${empty.map(fmtHour).join(', ')} hour${empty.length === 1 ? '' : 's'}. Uncharted territory remains.`;
    },
  }),
  def({
    id: 'time-midnight-window', title: 'Midnight Operations', category: C, rarity: 'rare', priority: 65,
    when: (c) => c.events.some((e) => e.mins >= 1410 || e.mins < 30),
    msg: (c) => {
      const e = c.events.filter((x) => x.mins >= 1410 || x.mins < 30).pop()!;
      return `A movement was logged at ${fmtClock(e.mins)} on ${fmtDayShort(e.key)}, right around the stroke of midnight. Cinderella could never.`;
    },
  }),
  def({
    id: 'time-graveyard-shift', title: 'Graveyard Shift', category: C, rarity: 'rare', priority: 68,
    when: (c) => c.events.some((e) => e.hour >= 2 && e.hour < 5),
    msg: (c) => {
      const list = c.events.filter((x) => x.hour >= 2 && x.hour < 5);
      return `${plural(list.length, 'movement')} logged between 2 and 5 AM. The graveyard shift is small but dedicated.`;
    },
  }),
  def({
    id: 'time-morning-rush', title: 'Morning Rush Hour', category: C, priority: 55, minEvents: 12,
    when: (c) => hourShare(c, 8, 10) >= 0.25,
    msg: (c) => `${pct(hourShare(c, 8, 10))} of all movements happen between 8 and 10 AM. It's rush hour, and you are the traffic.`,
  }),
  def({
    id: 'time-post-dinner', title: 'Post-Dinner Service', category: C, priority: 50, minEvents: 12,
    when: (c) => c.events.filter((e) => e.mins >= 1110 && e.mins < 1230).length / c.n >= 0.2,
    msg: (c) => `${pct(c.events.filter((e) => e.mins >= 1110 && e.mins < 1230).length / c.n)} of movements occur between 6:30 and 8:30 PM. Dinner service is followed promptly by outbound service.`,
  }),
  def({
    id: 'time-palindrome', title: 'Palindromic Timestamp', category: C, rarity: 'rare', priority: 58,
    when: (c) => c.events.some((e) => { const s = h12digits(e); return s.length >= 3 && s === s.split('').reverse().join(''); }),
    msg: (c) => {
      const e = c.events.filter((x) => { const s = h12digits(x); return s.length >= 3 && s === s.split('').reverse().join(''); }).pop()!;
      return `A movement on ${fmtDayShort(e.key)} was logged at ${fmtClock(e.mins)} — a palindrome. It reads the same forwards and backwards, much like your commitment to operations.`;
    },
  }),
  def({
    id: 'time-sequential', title: 'Sequential Timestamp', category: C, rarity: 'legendary', priority: 75,
    when: (c) => c.events.some((e) => h12digits(e) === '1234'),
    msg: (c) => `A movement was recorded at exactly 12:34 on ${fmtDayShort(c.events.find((e) => h12digits(e) === '1234')!.key)}. One, two, three, four. Beautiful.`,
  }),
  def({
    id: 'time-make-a-wish', title: 'Make a Wish', category: C, rarity: 'legendary', priority: 75,
    when: (c) => c.events.some((e) => h12digits(e) === '1111'),
    msg: (c) => `A movement was logged at 11:11 on ${fmtDayShort(c.events.find((e) => h12digits(e) === '1111')!.key)}. Tradition says you get a wish. Operations recommends wishing big.`,
  }),
  def({
    id: 'time-scheduled-maintenance', title: 'Scheduled Maintenance at 4:20', category: C, rarity: 'legendary', priority: 72,
    when: (c) => c.events.some((e) => h12digits(e) === '420'),
    msg: (c) => `A movement was logged at precisely 4:20 on ${fmtDayShort(c.events.find((e) => h12digits(e) === '420')!.key)}. The Intelligence Division has no further comment.`,
  }),
  def({
    id: 'time-perfect-split', title: 'Perfectly Split Schedule', category: C, rarity: 'uncommon', priority: 47, minEvents: 20,
    when: (c) => Math.abs(hourShare(c, 0, 12) - 0.5) <= 0.05,
    msg: (c) => `Movements are split ${pct(hourShare(c, 0, 12))} before noon and ${pct(1 - hourShare(c, 0, 12))} after. A remarkably balanced portfolio.`,
  }),
  def({
    id: 'time-opening-bell', title: 'Opening Bell', category: C, priority: 53, minEvents: 7,
    when: (c) => c.poopDays >= 7,
    msg: (c) => `On a typical day, the first movement arrives around ${fmtClock(medClock(firstOfEachDay(c).map((e) => e.mins)))} (median across ${plural(c.poopDays, 'active day')}). The market is open.`,
  }),
  def({
    id: 'time-closing-bell', title: 'Closing Bell', category: C, rarity: 'uncommon', priority: 49, minEvents: 8,
    when: (c) => c.days.filter((d) => d.count >= 2).length >= 3,
    msg: (c) => {
      const lasts = c.days.filter((d) => d.count >= 2).map((d) => d.events[d.events.length - 1].mins);
      return `On multi-movement days, the final movement typically lands around ${fmtClock(medClock(lasts))}. That's when the Center closes its books.`;
    },
  }),
  def({
    id: 'time-this-week-timing', title: "This Week's Timing", category: C, priority: 46, minEvents: 15,
    when: (c) => eventsInLast(c, 7).length >= 3 && Math.abs(laterBy(avgClock(eventsInLast(c, 7).map((e) => e.mins)), avgClock(c.events.map((e) => e.mins)))) >= 30,
    msg: (c) => {
      const recent = avgClock(eventsInLast(c, 7).map((e) => e.mins));
      const all = avgClock(c.events.map((e) => e.mins));
      const d = laterBy(recent, all);
      return `This week's movements averaged ${fmtClock(recent)}, ${mm(d)} ${d > 0 ? 'later' : 'earlier'} than your all-time average. A tactical adjustment.`;
    },
  }),
  def({
    id: 'time-monthly-early-bird', title: 'Monthly Early Bird', category: C, priority: 41, minEvents: 5,
    when: (c) => (cm(c)?.events ?? 0) >= 3,
    msg: (c) => {
      const list = cm(c)!.dayRecs.flatMap((d) => d.events);
      const e = list.reduce((a, b) => (shifted(b.mins) < shifted(a.mins) ? b : a));
      return `This month's earliest movement so far: ${fmtClock(e.mins)} on ${fmtDayShort(e.key)}.`;
    },
  }),
  def({
    id: 'time-hour-monopoly', title: 'Hour Monopoly', category: C, rarity: 'uncommon', priority: 60, minEvents: 15,
    when: (c) => c.byHour[modalHour(c)] / c.n >= 0.3,
    msg: (c) => `A single hour — ${fmtHourRange(modalHour(c))} — accounts for ${pct(c.byHour[modalHour(c)] / c.n)} of all movements. Regulators are concerned about market concentration.`,
  }),
  def({
    id: 'time-two-shifts', title: 'Two Distinct Shifts', category: C, rarity: 'uncommon', priority: 55, minEvents: 20,
    when: (c) => {
      const order = c.byHour.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v);
      const [a, b] = order;
      const dist = Math.min(Math.abs(a.h - b.h), 24 - Math.abs(a.h - b.h));
      return a.v / c.n >= 0.15 && b.v / c.n >= 0.15 && dist >= 6;
    },
    msg: (c) => {
      const order = c.byHour.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v);
      const [a, b] = order;
      return `Activity peaks twice: around ${fmtHour(a.h)} and again around ${fmtHour(b.h)}. The organization runs two shifts.`;
    },
  }),
  def({
    id: 'time-quiet-hours', title: 'Quiet Hours', category: C, priority: 43, minEvents: 20,
    when: (c) => quietHours(c).len >= 4,
    msg: (c) => {
      const q = quietHours(c);
      return `No movement has ever been recorded between ${fmtHour(q.start)} and ${fmtHour((q.start + q.len) % 24)}. The Center observes ${q.len} hours of quiet.`;
    },
  }),
  def({
    id: 'time-week-echo', title: 'One Week Later, Same Time', category: C, rarity: 'rare', priority: 62, minEvents: 8,
    when: (c) => !!weekAgoEcho(c),
    msg: (c) => {
      const { e, match } = weekAgoEcho(c)!;
      return `On ${fmtDayShort(e.key)} at ${fmtClock(e.mins)}, a movement arrived within ${mm(Math.abs(e.mins - match.mins))} of the exact time one week earlier (${fmtClock(match.mins)}). Standing weekly appointment detected.`;
    },
  }),
  def({
    id: 'time-weekend-dawn', title: 'Weekend Dawn Patrol', category: C, rarity: 'uncommon', priority: 50,
    when: (c) => c.events.some((e) => isWeekend(e.wd) && e.hour >= 4 && e.hour < 8),
    msg: (c) => {
      const e = c.events.filter((x) => isWeekend(x.wd) && x.hour >= 4 && x.hour < 8).pop()!;
      return `A ${wdName(e.wd)} movement at ${fmtClock(e.mins)} on ${fmtDayShort(e.key)}. Some people sleep in on weekends. Operations does not.`;
    },
  }),
  def({
    id: 'time-friday-night', title: 'Friday Night Deployment', category: C, rarity: 'uncommon', priority: 50,
    when: (c) => c.events.some((e) => e.wd === 5 && e.hour >= 20),
    msg: (c) => {
      const list = c.events.filter((x) => x.wd === 5 && x.hour >= 20);
      return `${plural(list.length, 'Friday-night movement')} after 8 PM on record. Deploying on a Friday night takes real confidence.`;
    },
  }),
  def({
    id: 'time-monday-kickoff', title: 'Monday Morning Kickoff', category: C, priority: 48, minEvents: 6,
    when: (c) => c.events.filter((e) => e.wd === 1 && e.hour < 9).length >= 3,
    msg: (c) => `${c.events.filter((e) => e.wd === 1 && e.hour < 9).length} Mondays have kicked off with a movement before 9 AM. Getting the hard stuff done first.`,
  }),
  def({
    id: 'time-sunday-evening', title: 'Sunday Evening Service', category: C, priority: 44,
    when: (c) => c.events.some((e) => e.wd === 0 && e.hour >= 17 && e.hour < 22),
    msg: (c) => {
      const list = c.events.filter((x) => x.wd === 0 && x.hour >= 17 && x.hour < 22);
      return `${plural(list.length, 'Sunday-evening movement')} recorded. Clearing the decks before the week begins.`;
    },
  }),
  def({
    id: 'time-business-hours', title: 'Business Hours Operations', category: C, priority: 46, minEvents: 15,
    when: (c) => {
      const wk = c.events.filter((e) => !isWeekend(e.wd));
      return wk.length >= 10 && wk.filter((e) => e.hour >= 9 && e.hour < 17).length / wk.length >= 0.5;
    },
    msg: (c) => {
      const wk = c.events.filter((e) => !isWeekend(e.wd));
      return `${pct(wk.filter((e) => e.hour >= 9 && e.hour < 17).length / wk.length)} of weekday movements happen during business hours (9–5). Technically, this is work.`;
    },
  }),
  def({
    id: 'time-outlier-today', title: 'Statistical Outlier', category: C, rarity: 'uncommon', priority: 68, minEvents: 15,
    when: (c) => {
      const t = firstToday(c);
      const hist = c.events.filter((e) => e.key !== c.todayKey).map((e) => e.mins);
      if (!t || hist.length < 12) return false;
      const sd = sdClock(hist);
      return sd > 0 && Math.abs(laterBy(t.mins, avgClock(hist))) > 2 * sd;
    },
    msg: (c) => {
      const t = firstToday(c)!;
      const hist = c.events.filter((e) => e.key !== c.todayKey).map((e) => e.mins);
      const z = Math.abs(laterBy(t.mins, avgClock(hist))) / sdClock(hist);
      return `Today's ${fmtClock(t.mins)} movement sits ${z.toFixed(1)} standard deviations from your average time. Statistically, this is a remarkable event.`;
    },
  }),
  def({
    id: 'time-quarter-hour', title: 'Minute Hand Preference', category: C, rarity: 'uncommon', priority: 38, minEvents: 20,
    when: (c) => Math.max(...quarterBuckets(c)) / c.n >= 0.35,
    msg: (c) => {
      const b = quarterBuckets(c);
      const i = b.indexOf(Math.max(...b));
      const labels = [':00–:14', ':15–:29', ':30–:44', ':45–:59'];
      return `${pct(b[i] / c.n)} of movements land in the ${labels[i]} part of the hour. Nobody asked the Intelligence Division to look into this. It did anyway.`;
    },
  }),
  def({
    id: 'time-operational-window', title: 'Operational Window', category: C, priority: 45, minEvents: 10,
    when: (c) => shifted(latest(c)!.mins) - shifted(earliest(c)!.mins) >= 720,
    msg: (c) => `Between your earliest (${fmtClock(earliest(c)!.mins)}) and latest (${fmtClock(latest(c)!.mins)}) recorded times, the Center has operated across a ${mm(shifted(latest(c)!.mins) - shifted(earliest(c)!.mins))} window.`,
  }),
  def({
    id: 'time-standing-appointment', title: 'Standing Appointment', category: C, rarity: 'uncommon', priority: 64, minEvents: 8,
    when: (c) => (standingAppointment(c)?.days ?? 0) >= 5,
    msg: (c) => {
      const s = standingAppointment(c)!;
      return `In the past two weeks, the ${fmtHourRange(s.hour)} hour saw action on ${s.days} different days. Consider it a recurring calendar invite.`;
    },
  }),
  def({
    id: 'time-year-first', title: 'First Shipment of the Year', category: C, rarity: 'uncommon', priority: 52,
    when: (c) => c.events.some((e) => e.y === c.now.getFullYear()) && c.events[0].y < c.now.getFullYear(),
    msg: (c) => {
      const e = c.events.find((x) => x.y === c.now.getFullYear())!;
      return `The first movement of ${e.y} arrived on ${fmtDayShort(e.key)} at ${fmtClock(e.mins)}. The fiscal year is officially underway.`;
    },
  }),
  def({
    id: 'time-monthly-drift', title: 'Monthly Time Drift', category: C, priority: 51, minEvents: 20,
    when: (c) => {
      const cur = cm(c);
      const prev = prevMonth(c);
      if (!cur || !prev || cur.events < 5 || prev.events < 5) return false;
      const a = medClock(cur.dayRecs.flatMap((d) => d.events.map((e) => e.mins)));
      const b = medClock(prev.dayRecs.flatMap((d) => d.events.map((e) => e.mins)));
      return Math.abs(laterBy(a, b)) >= 60;
    },
    msg: (c) => {
      const a = medClock(cm(c)!.dayRecs.flatMap((d) => d.events.map((e) => e.mins)));
      const b = medClock(prevMonth(c)!.dayRecs.flatMap((d) => d.events.map((e) => e.mins)));
      const d = laterBy(a, b);
      return `This month's median movement time (${fmtClock(a)}) is ${mm(d)} ${d > 0 ? 'later' : 'earlier'} than last month's (${fmtClock(b)}). Seasonal restructuring is underway.`;
    },
  }),
  def({
    id: 'time-high-noon', title: 'High Noon', category: C, rarity: 'rare', priority: 57,
    when: (c) => c.events.some((e) => e.hour === 12 && e.minute < 5),
    msg: (c) => `A movement at ${fmtClock(c.events.find((e) => e.hour === 12 && e.minute < 5)!.mins)} on ${fmtDayShort(c.events.find((e) => e.hour === 12 && e.minute < 5)!.key)}. High noon. The showdown was decisive.`,
  }),
  def({
    id: 'time-median-gap-between', title: 'Typical Time Between Movements', category: C, priority: 44, minEvents: 10,
    when: (c) => c.n >= 10,
    msg: (c) => {
      const gaps: number[] = [];
      for (let i = 1; i < c.events.length; i++) gaps.push((c.events[i].ts - c.events[i - 1].ts) / 60000);
      return `The median time between consecutive movements is ${mm(median(gaps))}. That is your operational heartbeat.`;
    },
  }),
  def({
    id: 'time-encore-timing', title: 'Encore Timing', category: C, rarity: 'uncommon', priority: 47, minEvents: 6,
    when: (c) => sameDayIntervals(c).length >= 3,
    msg: (c) => `When a second movement follows on the same day, it typically arrives ${mm(median(sameDayIntervals(c).map((x) => x.gap)))} after the first. Encores are rarely rushed.`,
  }),
];
