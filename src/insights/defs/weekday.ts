// WEEKDAY ANALYSIS — 50 authored insights about which days of the week carry the load.
import {
  def, fmtClock, fmtDayShort, plural, pct, wdName, wdPlural, wdRate, fullWeeks, countOn, has, addDays,
  isWeekend, avgClock, laterBy, stdev, mean, cached, weekdayOf, lastN, multiDays, cm, mm,
  type Ctx,
} from '../h';
import type { InsightDef } from '../types';

const C = 'weekday' as const;
const ALL = [0, 1, 2, 3, 4, 5, 6];
const ready = (c: Ctx, per = 3) => c.wdObserved.every((x) => x >= per);

const rateRank = (c: Ctx) => ALL.map((wd) => ({ wd, r: wdRate(c, wd) })).sort((a, b) => b.r - a.r || a.wd - b.wd);
const groupRate = (c: Ctx, wds: number[]) => {
  const obs = wds.reduce((a, w) => a + c.wdObserved[w], 0);
  const hit = wds.reduce((a, w) => a + c.byWdDays[w], 0);
  return obs ? hit / obs : 0;
};
const weekendRate = (c: Ctx) => groupRate(c, [0, 6]);
const weekdayRate = (c: Ctx) => groupRate(c, [1, 2, 3, 4, 5]);

/** Chronological list of every observed occurrence of a weekday with hit/miss. */
const occurrences = (c: Ctx, wd: number) =>
  cached(c, `wd.occ.${wd}`, () => c.observed.filter((k) => weekdayOf(k) === wd).map((k) => ({ key: k, hit: has(c, k), count: countOn(c, k) })));

const longestWeekdayRun = (c: Ctx) =>
  cached(c, 'wd.longestRun', () => {
    let best = { wd: 0, len: 0, endKey: '' };
    for (const wd of ALL) {
      let len = 0;
      for (const o of occurrences(c, wd)) {
        len = o.hit ? len + 1 : 0;
        if (len > best.len) best = { wd, len, endKey: o.key };
      }
    }
    return best;
  });

const currentWeekdayMisses = (c: Ctx) =>
  cached(c, 'wd.curMiss', () => {
    let best = { wd: 0, len: 0 };
    for (const wd of ALL) {
      const occ = occurrences(c, wd);
      let len = 0;
      for (let i = occ.length - 1; i >= 0 && !occ[i].hit; i--) len++;
      if (len > best.len) best = { wd, len };
    }
    return best;
  });

const mondayStart = (key: string) => addDays(key, -((weekdayOf(key) + 6) % 7));

const weekdayAvgTimes = (c: Ctx, wd: number) => c.events.filter((e) => e.wd === wd).map((e) => e.mins);

export const weekdayInsights: InsightDef[] = [
  def({
    id: 'wd-most-reliable', title: 'Most Reliable Weekday', category: C, priority: 64, minDays: 21,
    when: (c) => ready(c) && rateRank(c)[0].r > rateRank(c)[1].r,
    msg: (c) => {
      const top = rateRank(c)[0];
      return `${wdPlural(top.wd)} are your most reliable day: ${pct(top.r)} of them (${c.byWdDays[top.wd]} of ${c.wdObserved[top.wd]}) featured at least one movement.`;
    },
  }),
  def({
    id: 'wd-least-reliable', title: 'Least Reliable Weekday', category: C, priority: 55, minDays: 21,
    when: (c) => ready(c) && rateRank(c)[6].r < rateRank(c)[5].r,
    msg: (c) => {
      const low = rateRank(c)[6];
      return `${wdPlural(low.wd)} trail the league, with movements on ${pct(low.r)} of them. Management is choosing to view this as potential.`;
    },
  }),
  def({
    id: 'wd-monday-reliability', title: 'Monday Reliability Index', category: C, rarity: 'uncommon', priority: 58, minDays: 28,
    when: (c) => c.wdObserved[1] >= 4 && wdRate(c, 1) >= 0.8,
    msg: (c) => `${pct(wdRate(c, 1))} of Mondays have delivered. While others struggle with Mondays, your operations thrive.`,
  }),
  def({
    id: 'wd-two-for-tuesday', title: 'Two-for-Tuesday', category: C, rarity: 'rare', priority: 62,
    when: (c) => c.days.filter((d) => d.wd === 2 && d.count >= 2).length >= 2,
    msg: (c) => `${c.days.filter((d) => d.wd === 2 && d.count >= 2).length} Tuesdays have featured two or more movements. Tuesday runs a quiet buy-one-get-one promotion.`,
  }),
  def({
    id: 'wd-hump-day', title: 'Hump Day Champion', category: C, rarity: 'uncommon', priority: 57, minDays: 28,
    when: (c) => c.wdObserved[3] >= 4 && [1, 2, 4, 5].every((w) => wdRate(c, 3) > wdRate(c, w)),
    msg: (c) => `Wednesday is your strongest workday, delivering on ${pct(wdRate(c, 3))} of Wednesdays. Getting over the hump, literally.`,
  }),
  def({
    id: 'wd-thursday-perfect', title: 'Thursday Perfect Attendance', category: C, rarity: 'rare', priority: 66, minDays: 28,
    when: (c) => c.wdObserved[4] >= 4 && c.byWdDays[4] === c.wdObserved[4],
    msg: (c) => `Every single one of the last ${c.wdObserved[4]} Thursdays has delivered. Thursday has never missed a shift.`,
  }),
  def({
    id: 'wd-casual-friday', title: 'Casual Friday Timing', category: C, rarity: 'uncommon', priority: 50, minEvents: 15,
    when: (c) => {
      const fri = weekdayAvgTimes(c, 5);
      const wk = c.events.filter((e) => e.wd >= 1 && e.wd <= 4).map((e) => e.mins);
      return fri.length >= 3 && wk.length >= 8 && laterBy(avgClock(fri), avgClock(wk)) >= 30;
    },
    msg: (c) => {
      const fri = avgClock(weekdayAvgTimes(c, 5));
      const wk = avgClock(c.events.filter((e) => e.wd >= 1 && e.wd <= 4).map((e) => e.mins));
      return `Friday movements average ${fmtClock(fri)}, about ${mm(laterBy(fri, wk))} later than Monday–Thursday. Casual Friday applies to all departments.`;
    },
  }),
  def({
    id: 'wd-saturday-mornings', title: 'Saturday Morning Programming', category: C, rarity: 'uncommon', priority: 47,
    when: (c) => c.events.filter((e) => e.wd === 6 && e.hour < 10).length >= 3,
    msg: (c) => `${c.events.filter((e) => e.wd === 6 && e.hour < 10).length} Saturday movements have happened before 10 AM. Saturday morning programming has been renewed for another season.`,
  }),
  def({
    id: 'wd-day-of-rest', title: 'Day of Rest', category: C, priority: 45, minDays: 28,
    when: (c) => c.wdObserved[0] >= 4 && rateRank(c)[6].wd === 0 && wdRate(c, 0) <= 0.5,
    msg: (c) => `Sunday is your quietest day, with movements on ${pct(wdRate(c, 0))} of Sundays. Even infrastructure observes the Sabbath.`,
  }),
  def({
    id: 'wd-weekend-warrior', title: 'Weekend Warrior', category: C, rarity: 'uncommon', priority: 56, minDays: 21,
    when: (c) => ready(c, 2) && weekendRate(c) - weekdayRate(c) >= 0.15,
    msg: (c) => `Weekend reliability (${pct(weekendRate(c))}) outpaces weekdays (${pct(weekdayRate(c))}). Operations perform best off the clock.`,
  }),
  def({
    id: 'wd-workweek-loyalist', title: 'Workweek Loyalist', category: C, rarity: 'uncommon', priority: 56, minDays: 21,
    when: (c) => ready(c, 2) && weekdayRate(c) - weekendRate(c) >= 0.15,
    msg: (c) => `Weekdays deliver ${pct(weekdayRate(c))} of the time versus ${pct(weekendRate(c))} on weekends. A true professional keeps business on business days.`,
  }),
  def({
    id: 'wd-equal-opportunity', title: 'Equal Opportunity Employer', category: C, rarity: 'uncommon', priority: 52, minDays: 42,
    when: (c) => ready(c, 5) && rateRank(c)[0].r - rateRank(c)[6].r <= 0.15,
    msg: (c) => `Every weekday delivers between ${pct(rateRank(c)[6].r)} and ${pct(rateRank(c)[0].r)} of the time. No day gets special treatment.`,
  }),
  def({
    id: 'wd-favoritism', title: 'Weekday Favoritism', category: C, priority: 53, minEvents: 21,
    when: (c) => {
      const nz = c.byWd.filter((x) => x > 0);
      return nz.length >= 5 && Math.max(...c.byWd) >= 2 * Math.min(...nz);
    },
    msg: (c) => {
      const max = Math.max(...c.byWd);
      const nz = c.byWd.filter((x) => x > 0);
      const min = Math.min(...nz);
      return `${wdName(c.byWd.indexOf(max))} has hosted ${max} movements; ${wdName(c.byWd.indexOf(min))} only ${min}. HR has received a complaint about favoritism.`;
    },
  }),
  def({
    id: 'wd-perfect-week', title: 'Perfect Week', category: C, rarity: 'uncommon', priority: 70,
    when: (c) => fullWeeks(c).some((w) => w.poopDays === 7),
    msg: (c) => {
      const w = fullWeeks(c).filter((x) => x.poopDays === 7).pop()!;
      return `The week of ${fmtDayShort(w.startKey)} achieved a movement every single day, Monday through Sunday. A perfect week.`;
    },
  }),
  def({
    id: 'wd-back-to-back-perfect', title: 'Back-to-Back Perfect Weeks', category: C, rarity: 'rare', priority: 76,
    when: (c) => fullWeeks(c).some((w, i, a) => i > 0 && w.poopDays === 7 && a[i - 1].poopDays === 7),
    msg: (c) => {
      const ws = fullWeeks(c);
      const i = ws.findIndex((w, j) => j > 0 && w.poopDays === 7 && ws[j - 1].poopDays === 7);
      return `The weeks starting ${fmtDayShort(ws[i - 1].startKey)} and ${fmtDayShort(ws[i].startKey)} were both perfect. Fourteen days, zero excuses.`;
    },
  }),
  def({
    id: 'wd-workweek-sweep', title: 'Workweek Sweep', category: C, priority: 58,
    when: (c) => fullWeeks(c).some((w) => w.counts.slice(0, 5).every((x) => x > 0)),
    msg: (c) => {
      const n = fullWeeks(c).filter((w) => w.counts.slice(0, 5).every((x) => x > 0)).length;
      return `${plural(n, 'full workweek')} with a movement every day Monday through Friday. Clocked in, every day.`;
    },
  }),
  def({
    id: 'wd-full-weekend', title: 'Full Weekend Coverage', category: C, priority: 48,
    when: (c) => c.days.filter((d) => d.wd === 6 && has(c, addDays(d.key, 1))).length >= 4,
    msg: (c) => `${c.days.filter((d) => d.wd === 6 && has(c, addDays(d.key, 1))).length} weekends have been covered on both Saturday and Sunday. Weekend staffing is exemplary.`,
  }),
  def({
    id: 'wd-weekend-off', title: 'Weekend Off', category: C, priority: 40, minDays: 14,
    when: (c) => c.observed.some((k) => weekdayOf(k) === 6 && c.observed.includes(addDays(k, 1)) && !has(c, k) && !has(c, addDays(k, 1))),
    msg: (c) => {
      const k = c.observed.filter((x) => weekdayOf(x) === 6 && c.observed.includes(addDays(x, 1)) && !has(c, x) && !has(c, addDays(x, 1))).pop()!;
      return `The weekend of ${fmtDayShort(k)} passed with no recorded movements on Saturday or Sunday. Even logistics takes a weekend off sometimes.`;
    },
  }),
  def({
    id: 'wd-seven-day-operation', title: 'Seven-Day Operation', category: C, priority: 60,
    when: (c) => c.byWdDays.every((x) => x > 0),
    msg: () => `Movements have now been recorded on every day of the week. The Center is officially a seven-day operation.`,
  }),
  def({
    id: 'wd-forgotten-weekday', title: 'The Forgotten Weekday', category: C, rarity: 'uncommon', priority: 55, minDays: 21,
    when: (c) => c.byWdDays.filter((x) => x === 0).length === 1 && c.wdObserved[c.byWdDays.indexOf(0)] >= 3,
    msg: (c) => {
      const wd = c.byWdDays.indexOf(0);
      return `After ${c.wdObserved[wd]} ${wdPlural(wd)}, not a single ${wdName(wd)} movement has been recorded. ${wdName(wd)} awaits its moment.`;
    },
  }),
  def({
    id: 'wd-volume-vs-reliability', title: 'Volume vs. Reliability Split', category: C, rarity: 'uncommon', priority: 49, minEvents: 25, minDays: 28,
    when: (c) => ready(c) && c.byWd.indexOf(Math.max(...c.byWd)) !== rateRank(c)[0].wd,
    msg: (c) => {
      const vol = c.byWd.indexOf(Math.max(...c.byWd));
      return `${wdName(vol)} leads in total volume (${c.byWd[vol]} movements), but ${wdName(rateRank(c)[0].wd)} is the most reliable day. Two different kinds of excellence.`;
    },
  }),
  def({
    id: 'wd-record-week', title: 'Record Week', category: C, priority: 59, minDays: 14,
    when: (c) => fullWeeks(c).length >= 2,
    msg: (c) => {
      const ws = fullWeeks(c);
      const best = ws.reduce((a, b) => (b.events > a.events ? b : a));
      return `Your highest-volume week began ${fmtDayShort(best.startKey)}, with ${plural(best.events, 'movement')} across ${plural(best.poopDays, 'day')}.`;
    },
  }),
  def({
    id: 'wd-weekly-run-rate', title: 'Weekly Run Rate', category: C, priority: 57, minDays: 21,
    when: (c) => fullWeeks(c).length >= 3,
    msg: (c) => {
      const ws = fullWeeks(c);
      return `Across ${plural(ws.length, 'complete week')}, you average ${mean(ws.map((w) => w.poopDays)).toFixed(1)} active days and ${mean(ws.map((w) => w.events)).toFixed(1)} movements per week.`;
    },
  }),
  def({
    id: 'wd-last-week-review', title: 'Last Week in Review', category: C, priority: 63, minDays: 21,
    when: (c) => fullWeeks(c).length >= 3,
    msg: (c) => {
      const ws = fullWeeks(c);
      const last = ws[ws.length - 1];
      const avg = mean(ws.map((w) => w.poopDays));
      const diff = last.poopDays - avg;
      const verdict = Math.abs(diff) < 0.5 ? 'right on your average' : diff > 0 ? `${diff.toFixed(1)} above your average` : `${Math.abs(diff).toFixed(1)} below your average`;
      return `Last week (starting ${fmtDayShort(last.startKey)}) delivered on ${plural(last.poopDays, 'day')} — ${verdict}.`;
    },
  }),
  def({
    id: 'wd-week-to-date-flawless', title: 'Week-to-Date: Flawless', category: C, priority: 69,
    when: (c) => {
      const start = mondayStart(c.todayKey);
      const elapsed = (weekdayOf(c.todayKey) + 6) % 7 + 1;
      if (elapsed < 3 || !c.firstKey || c.firstKey > start) return false;
      for (let i = 0; i < elapsed; i++) if (!has(c, addDays(start, i))) return false;
      return true;
    },
    msg: (c) => `Every day this week so far — ${(weekdayOf(c.todayKey) + 6) % 7 + 1} out of ${(weekdayOf(c.todayKey) + 6) % 7 + 1} — has delivered. The week is flawless.`,
  }),
  def({
    id: 'wd-monday-recovery', title: 'Monday Recovery Protocol', category: C, priority: 44,
    when: (c) => c.days.filter((d) => d.wd === 1 && c.observed.includes(addDays(d.key, -1)) && !has(c, addDays(d.key, -1))).length >= 3,
    msg: (c) => `${c.days.filter((d) => d.wd === 1 && c.observed.includes(addDays(d.key, -1)) && !has(c, addDays(d.key, -1))).length} times, a quiet Sunday was followed by a productive Monday. The Monday Recovery Protocol works.`,
  }),
  def({
    id: 'wd-intensity-leader', title: 'Intensity Leader', category: C, priority: 46, minEvents: 20,
    when: (c) => ALL.filter((wd) => c.byWdDays[wd] >= 3).length >= 4 && Math.max(...ALL.map((wd) => (c.byWdDays[wd] >= 3 ? c.byWd[wd] / c.byWdDays[wd] : 0))) >= 1.2,
    msg: (c) => {
      const scores = ALL.map((wd) => (c.byWdDays[wd] >= 3 ? c.byWd[wd] / c.byWdDays[wd] : 0));
      const wd = scores.indexOf(Math.max(...scores));
      return `When ${wdName(wd)} delivers, it averages ${scores[wd].toFixed(2)} movements that day — the highest intensity of any weekday.`;
    },
  }),
  def({
    id: 'wd-weekly-ritual', title: 'Weekly Ritual', category: C, rarity: 'rare', priority: 63, minDays: 42,
    when: (c) => longestWeekdayRun(c).len >= 6,
    msg: (c) => {
      const r = longestWeekdayRun(c);
      return `${r.len} consecutive ${wdPlural(r.wd)} delivered without fail (through ${fmtDayShort(r.endKey)}). That's no longer a habit. That's a ritual.`;
    },
  }),
  def({
    id: 'wd-absence-streak', title: 'Weekday Absence Streak', category: C, priority: 42, minDays: 28,
    when: (c) => currentWeekdayMisses(c).len >= 4,
    msg: (c) => {
      const m = currentWeekdayMisses(c);
      return `${wdName(m.wd)} has gone ${m.len} weeks in a row without a movement. ${wdName(m.wd)} is currently on sabbatical.`;
    },
  }),
  def({
    id: 'wd-double-day-preference', title: 'Double Day Preference', category: C, rarity: 'uncommon', priority: 54,
    when: (c) => multiDays(c).length >= 3 && (() => {
      const counts = ALL.map((wd) => multiDays(c).filter((d) => d.wd === wd).length);
      return counts.filter((x) => x === Math.max(...counts)).length === 1;
    })(),
    msg: (c) => {
      const counts = ALL.map((wd) => multiDays(c).filter((d) => d.wd === wd).length);
      const wd = counts.indexOf(Math.max(...counts));
      return `${wdName(wd)} is your favorite day for multi-movement days, hosting ${counts[wd]} of ${multiDays(c).length}. High-throughput ${wdName(wd)}s are a known phenomenon.`;
    },
  }),
  def({
    id: 'wd-weekday-debut', title: 'Weekday Debut', category: C, rarity: 'uncommon', priority: 74,
    when: (c) => {
      const t = c.dayMap.get(c.todayKey);
      return !!t && c.byWdDays[t.wd] === 1 && c.wdObserved[t.wd] >= 4;
    },
    msg: (c) => `After ${c.wdObserved[weekdayOf(c.todayKey)] - 1} quiet ${wdPlural(weekdayOf(c.todayKey))}, today marks the first ${wdName(weekdayOf(c.todayKey))} movement in recorded history. Welcome to the team, ${wdName(weekdayOf(c.todayKey))}.`,
  }),
  def({
    id: 'wd-today-forecast', title: "Today's Weekday Outlook", category: C, priority: 58, minDays: 21,
    when: (c) => c.todayCount === 0 && c.wdObserved[weekdayOf(c.todayKey)] >= 4,
    msg: (c) => {
      const wd = weekdayOf(c.todayKey);
      return `Historically, ${pct(wdRate(c, wd))} of ${wdPlural(wd)} have featured a movement (${c.byWdDays[wd]} of ${c.wdObserved[wd]}). Today's outlook is based purely on precedent.`;
    },
  }),
  def({
    id: 'wd-playing-to-strengths', title: 'Playing to Strengths', category: C, priority: 60, minDays: 28,
    when: (c) => c.todayCount > 0 && ready(c) && rateRank(c)[0].wd === weekdayOf(c.todayKey),
    msg: (c) => `Today is a ${wdName(weekdayOf(c.todayKey))}, your most reliable weekday — and it delivered again. Playing to your strengths.`,
  }),
  def({
    id: 'wd-defying-odds', title: 'Defying the Odds', category: C, rarity: 'uncommon', priority: 65, minDays: 28,
    when: (c) => c.todayCount > 0 && ready(c) && rateRank(c)[6].wd === weekdayOf(c.todayKey),
    msg: (c) => `${wdName(weekdayOf(c.todayKey))} is statistically your least reliable weekday. And yet, here we are. Movement confirmed.`,
  }),
  def({
    id: 'wd-power-rankings', title: 'Weekday Power Rankings', category: C, priority: 54, minDays: 35,
    when: (c) => ready(c, 4),
    msg: (c) => {
      const r = rateRank(c);
      return `Official weekday power rankings: 1. ${wdName(r[0].wd)} (${pct(r[0].r)}), 2. ${wdName(r[1].wd)} (${pct(r[1].r)}), 3. ${wdName(r[2].wd)} (${pct(r[2].r)}). ${wdName(r[6].wd)} is in rebuilding mode.`;
    },
  }),
  def({
    id: 'wd-midweek-momentum', title: 'Midweek Momentum', category: C, priority: 43, minEvents: 20,
    when: (c) => (c.byWd[2] + c.byWd[3] + c.byWd[4]) / c.n >= 0.5,
    msg: (c) => `${pct((c.byWd[2] + c.byWd[3] + c.byWd[4]) / c.n)} of all movements happen Tuesday through Thursday — three days that would only claim 43% by chance.`,
  }),
  def({
    id: 'wd-bookend-imbalance', title: 'Bookend Imbalance', category: C, priority: 45, minDays: 28,
    when: (c) => c.wdObserved[1] >= 4 && c.wdObserved[5] >= 4 && Math.abs(wdRate(c, 1) - wdRate(c, 5)) >= 0.25,
    msg: (c) => {
      const mon = wdRate(c, 1);
      const fri = wdRate(c, 5);
      return `Mondays deliver ${pct(mon)} of the time; Fridays ${pct(fri)}. The week ${mon > fri ? 'starts strong and coasts' : 'starts slow and finishes strong'}.`;
    },
  }),
  def({
    id: 'wd-weekend-rivalry', title: 'Weekend Sibling Rivalry', category: C, priority: 45, minDays: 28,
    when: (c) => c.wdObserved[0] >= 4 && c.wdObserved[6] >= 4 && Math.abs(wdRate(c, 0) - wdRate(c, 6)) >= 0.25,
    msg: (c) => {
      const [hi, lo] = wdRate(c, 6) > wdRate(c, 0) ? [6, 0] : [0, 6];
      return `${wdName(hi)} (${pct(wdRate(c, hi))}) is decisively out-performing ${wdName(lo)} (${pct(wdRate(c, lo))}). The weekend siblings are not speaking.`;
    },
  }),
  def({
    id: 'wd-weekend-volume', title: 'Weekend Volume', category: C, rarity: 'uncommon', priority: 50,
    when: (c) => multiDays(c).length >= 4 && multiDays(c).filter((d) => isWeekend(d.wd)).length / multiDays(c).length >= 0.5,
    msg: (c) => `${pct(multiDays(c).filter((d) => isWeekend(d.wd)).length / multiDays(c).length)} of your multi-movement days fell on a weekend. Weekends are for high throughput.`,
  }),
  def({
    id: 'wd-long-weekend', title: 'Long Weekend Coverage', category: C, rarity: 'uncommon', priority: 52,
    when: (c) => c.days.some((d) => d.wd === 5 && has(c, addDays(d.key, 1)) && has(c, addDays(d.key, 2)) && has(c, addDays(d.key, 3))),
    msg: (c) => {
      const d = c.days.filter((x) => x.wd === 5 && has(c, addDays(x.key, 1)) && has(c, addDays(x.key, 2)) && has(c, addDays(x.key, 3))).pop()!;
      return `Friday ${fmtDayShort(d.key)} through Monday: four straight days of confirmed movement. The long weekend was fully covered.`;
    },
  }),
  def({
    id: 'wd-six-day-weeks', title: 'Six-Day Work Weeks', category: C, rarity: 'uncommon', priority: 55,
    when: (c) => fullWeeks(c).filter((w) => w.poopDays >= 6).length >= 4,
    msg: (c) => `${fullWeeks(c).filter((w) => w.poopDays >= 6).length} complete weeks have delivered on six or more days. Management has stopped asking for overtime approval.`,
  }),
  def({
    id: 'wd-light-week', title: 'Light Week', category: C, priority: 38, minDays: 28,
    when: (c) => fullWeeks(c).length >= 4 && fullWeeks(c).some((w) => w.poopDays <= 2),
    msg: (c) => {
      const w = fullWeeks(c).filter((x) => x.poopDays <= 2).pop()!;
      return `The week of ${fmtDayShort(w.startKey)} was a light one, with just ${plural(w.poopDays, 'active day')}. Every organization has quiet quarters.`;
    },
  }),
  def({
    id: 'wd-weekly-consistency', title: 'Weekly Consistency Rating', category: C, rarity: 'uncommon', priority: 56, minDays: 42,
    when: (c) => fullWeeks(c).length >= 6 && stdev(fullWeeks(c).map((w) => w.poopDays)) <= 0.8,
    msg: (c) => `Across ${fullWeeks(c).length} complete weeks, your active-day count varies by only ${stdev(fullWeeks(c).map((w) => w.poopDays)).toFixed(2)} days (standard deviation). Weekly output is remarkably steady.`,
  }),
  def({
    id: 'wd-week-over-week', title: 'Week-Over-Week Growth', category: C, priority: 57, minDays: 28,
    when: (c) => {
      const ws = lastN(fullWeeks(c), 3);
      return ws.length === 3 && ws[0].events < ws[1].events && ws[1].events < ws[2].events;
    },
    msg: (c) => {
      const ws = lastN(fullWeeks(c), 3);
      return `Three consecutive weeks of growth: ${ws.map((w) => w.events).join(' → ')} movements. Investors are delighted.`;
    },
  }),
  def({
    id: 'wd-record-day-weekday', title: 'Record Day Origin', category: C, priority: 40, minEvents: 6,
    when: (c) => c.maxPerDay >= 2 && c.days.filter((d) => d.count === c.maxPerDay).length === 1,
    msg: (c) => {
      const d = c.days.find((x) => x.count === c.maxPerDay)!;
      return `Your single-day record of ${c.maxPerDay} movements was set on a ${wdName(d.wd)} (${fmtDayShort(d.key)}). ${wdName(d.wd)} will be telling this story for years.`;
    },
  }),
  def({
    id: 'wd-full-rotation-month', title: 'Full Weekly Rotation', category: C, priority: 47,
    when: (c) => !!cm(c) && new Set(cm(c)!.dayRecs.map((d) => d.wd)).size === 7,
    msg: () => `Every day of the week has delivered at least once this month. The full rotation is complete.`,
  }),
  def({
    id: 'wd-recurring-double', title: 'Recurring Double Feature', category: C, rarity: 'rare', priority: 64,
    when: (c) => c.days.some((d) => d.count >= 2 && countOn(c, addDays(d.key, 7)) >= 2),
    msg: (c) => {
      const d = c.days.find((x) => x.count >= 2 && countOn(c, addDays(x.key, 7)) >= 2)!;
      return `${wdPlural(d.wd)} ${fmtDayShort(d.key)} and ${fmtDayShort(addDays(d.key, 7))} were both multi-movement days. A recurring double feature has been scheduled.`;
    },
  }),
  def({
    id: 'wd-midweek-lull', title: 'Midweek Lull', category: C, priority: 36, minDays: 21,
    when: (c) => fullWeeks(c).some((w) => w.counts[1] === 0 && w.counts[2] === 0 && w.counts[3] === 0),
    msg: (c) => {
      const w = fullWeeks(c).filter((x) => x.counts[1] === 0 && x.counts[2] === 0 && x.counts[3] === 0).pop()!;
      return `In the week of ${fmtDayShort(w.startKey)}, Tuesday through Thursday passed without a movement. A classic midweek lull.`;
    },
  }),
  def({
    id: 'wd-weekend-share', title: 'Weekend Share of Operations', category: C, priority: 41, minEvents: 14,
    when: (c) => c.n >= 14,
    msg: (c) => {
      const share = (c.byWd[0] + c.byWd[6]) / c.n;
      return `Weekends account for ${pct(share)} of all movements (they're 29% of the calendar). ${share > 0.29 ? 'Weekends are over-delivering.' : 'Weekdays are carrying the team.'}`;
    },
  }),
  def({
    id: 'wd-first-weekday', title: 'Founding Weekday', category: C, priority: 30,
    when: (c) => !!c.first,
    msg: (c) => `The Bowel Operations Center was founded on a ${wdName(c.first!.wd)}. ${wdPlural(c.first!.wd)} will always be a little bit special.`,
  }),
];
