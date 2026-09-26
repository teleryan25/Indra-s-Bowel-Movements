// STREAK OPERATIONS — 45 authored insights about consecutive active days.
import {
  def, fmtDayShort, plural, pct, wdName, weekdayOf, runKeys, completedRuns, countOn, has, addDays, mean, lastN,
  daysBetween, fmtMonth,
  type Ctx, type Run,
} from '../h';
import type { InsightDef } from '../types';

const C = 'streak' as const;
const cur = (c: Ctx): Run | null => (c.currentStreak > 0 ? c.streaks[c.streaks.length - 1] : null);
const anyRun = (c: Ctx, n: number) => c.streaks.find((r) => r.len >= n) ?? null;
const prevBest = (c: Ctx) => completedRuns(c).reduce((a, r) => Math.max(a, r.len), 0);
const eventsIn = (c: Ctx, r: Run) => runKeys(r).reduce((a, k) => a + countOn(c, k), 0);
const runsAtLeast = (c: Ctx, n: number) => c.streaks.filter((r) => r.len >= n);

export const streakInsights: InsightDef[] = [
  def({
    id: 'st-3', title: 'First Three-Peat', category: C, priority: 66,
    when: (c) => !!anyRun(c, 3),
    msg: (c) => `First 3-day streak achieved: ${fmtDayShort(anyRun(c, 3)!.startKey)} through ${fmtDayShort(addDays(anyRun(c, 3)!.startKey, 2))}. A pattern is emerging.`,
  }),
  def({
    id: 'st-5', title: 'Five-Day Run', category: C, priority: 70,
    when: (c) => !!anyRun(c, 5),
    msg: (c) => `First 5-day streak on record, completed ${fmtDayShort(addDays(anyRun(c, 5)!.startKey, 4))}. Five business days of flawless delivery.`,
  }),
  def({
    id: 'st-7', title: 'A Full Week', category: C, rarity: 'uncommon', priority: 76,
    when: (c) => !!anyRun(c, 7),
    msg: (c) => `Seven consecutive days of movement, first achieved on ${fmtDayShort(addDays(anyRun(c, 7)!.startKey, 6))}. God rested on the seventh day. You did not.`,
  }),
  def({
    id: 'st-10', title: 'Double Digits', category: C, rarity: 'uncommon', priority: 78,
    when: (c) => !!anyRun(c, 10),
    msg: (c) => `A 10-day streak — first reached ${fmtDayShort(addDays(anyRun(c, 10)!.startKey, 9))}. Double digits. The streak has entered its professional era.`,
  }),
  def({
    id: 'st-14', title: 'Fortnight of Excellence', category: C, rarity: 'rare', priority: 82,
    when: (c) => !!anyRun(c, 14),
    msg: (c) => `Fourteen consecutive days. A full fortnight of uninterrupted operations, completed ${fmtDayShort(addDays(anyRun(c, 14)!.startKey, 13))}. The British would call this "rather good."`,
  }),
  def({
    id: 'st-21', title: 'Three Weeks Strong', category: C, rarity: 'rare', priority: 85,
    when: (c) => !!anyRun(c, 21),
    msg: () => `A 21-day streak. They say it takes 21 days to form a habit. The habit has been formed. It is now a lifestyle.`,
  }),
  def({
    id: 'st-30', title: 'Thirty-Day Streak', category: C, rarity: 'legendary', priority: 92,
    when: (c) => !!anyRun(c, 30),
    msg: (c) => `Thirty consecutive days of confirmed movement, beginning ${fmtDayShort(anyRun(c, 30)!.startKey)}. An entire month without a single service interruption.`,
  }),
  def({
    id: 'st-45', title: 'Forty-Five and Counting', category: C, rarity: 'legendary', priority: 93,
    when: (c) => !!anyRun(c, 45),
    msg: () => `A 45-day streak exists in the historical record. Competitors have stopped trying to compete.`,
  }),
  def({
    id: 'st-60', title: 'Two Months Unbroken', category: C, rarity: 'legendary', priority: 95,
    when: (c) => !!anyRun(c, 60),
    msg: () => `Sixty consecutive days. Two months without missing a single day. The board is considering renaming the building after you.`,
  }),
  def({
    id: 'st-100', title: 'The Century Streak', category: C, rarity: 'legendary', priority: 99,
    when: (c) => !!anyRun(c, 100),
    msg: () => `One hundred consecutive days of movement. This is not a streak anymore. This is infrastructure.`,
  }),
  def({
    id: 'st-current', title: 'Current Streak Report', category: C, priority: 60,
    when: (c) => c.currentStreak >= 2,
    msg: (c) => `Current streak: ${plural(c.currentStreak, 'consecutive day')}, dating back to ${fmtDayShort(c.currentStreakStart!)}.`,
  }),
  def({
    id: 'st-longest', title: 'All-Time Longest Streak', category: C, priority: 58,
    when: (c) => c.longestStreak >= 3,
    msg: (c) => {
      const r = c.streaks.find((x) => x.len === c.longestStreak)!;
      return `Your longest streak on record is ${c.longestStreak} days (${fmtDayShort(r.startKey)} – ${fmtDayShort(r.endKey)}). The benchmark against which all streaks are judged.`;
    },
  }),
  def({
    id: 'st-tying-record', title: 'Tying the Record', category: C, rarity: 'rare', priority: 86,
    when: (c) => c.currentStreak >= 3 && c.currentStreak === prevBest(c),
    msg: (c) => `The current streak has reached ${c.currentStreak} days, tying your all-time record. Tomorrow could make history.`,
  }),
  def({
    id: 'st-new-record', title: 'New Streak Record', category: C, rarity: 'rare', priority: 90,
    when: (c) => c.currentStreak > prevBest(c) && prevBest(c) >= 3,
    msg: (c) => `NEW RECORD. The current ${c.currentStreak}-day streak has surpassed the previous best of ${prevBest(c)} days. Every day from here is uncharted.`,
  }),
  def({
    id: 'st-one-from-history', title: 'One Day From History', category: C, rarity: 'uncommon', priority: 84,
    when: (c) => c.todayCount === 0 && c.currentStreak >= 3 && c.currentStreak === c.longestStreak - 1 && completedRuns(c).length > 0,
    msg: (c) => `The streak stands at ${c.currentStreak} days. A movement today would tie the all-time record of ${c.longestStreak}. No pressure. (Some pressure.)`,
  }),
  def({
    id: 'st-recovery', title: 'Streak Recovery', category: C, priority: 62,
    when: (c) => {
      const r = cur(c);
      if (!r || r.len < 3) return false;
      const g = c.gaps.find((x) => x.toKey === r.startKey);
      return !!g && g.len >= 2;
    },
    msg: (c) => {
      const r = cur(c)!;
      const g = c.gaps.find((x) => x.toKey === r.startKey)!;
      return `After a ${g.len}-day pause, operations rebounded into a ${r.len}-day streak. Resilience is a core competency.`;
    },
  }),
  def({
    id: 'st-weekend-proof', title: 'Weekend-Proof Streak', category: C, priority: 55,
    when: (c) => c.streaks.some((r) => r.len >= 4 && runKeys(r).some((k) => weekdayOf(k) === 6 && runKeys(r).includes(addDays(k, 1)))),
    msg: (c) => {
      const r = c.streaks.filter((x) => x.len >= 4 && runKeys(x).some((k) => weekdayOf(k) === 6 && runKeys(x).includes(addDays(k, 1)))).pop()!;
      return `The ${r.len}-day streak ending ${fmtDayShort(r.endKey)} powered straight through a weekend. Weekends are not an excuse.`;
    },
  }),
  def({
    id: 'st-monday-launch', title: 'Monday Launch', category: C, priority: 46,
    when: (c) => c.streaks.some((r) => r.len >= 3 && weekdayOf(r.startKey) === 1),
    msg: (c) => `${c.streaks.filter((r) => r.len >= 3 && weekdayOf(r.startKey) === 1).length} streaks of 3+ days began on a Monday. New week, new streak.`,
  }),
  def({
    id: 'st-friday-clockout', title: 'Clocked Out Friday', category: C, priority: 44,
    when: (c) => completedRuns(c).some((r) => r.len >= 3 && weekdayOf(r.endKey) === 5),
    msg: (c) => {
      const r = completedRuns(c).filter((x) => x.len >= 3 && weekdayOf(x.endKey) === 5).pop()!;
      return `A ${r.len}-day streak wrapped up on Friday ${fmtDayShort(r.endKey)}. Clocked out for the weekend like a professional.`;
    },
  }),
  def({
    id: 'st-symmetry', title: 'Streak Symmetry', category: C, rarity: 'uncommon', priority: 50,
    when: (c) => {
      const lens = completedRuns(c).filter((r) => r.len >= 3).map((r) => r.len);
      return lens.length !== new Set(lens).size;
    },
    msg: (c) => {
      const lens = completedRuns(c).filter((r) => r.len >= 3).map((r) => r.len);
      const dup = lens.find((l, i) => lens.indexOf(l) !== i)!;
      return `Two separate streaks each lasted exactly ${dup} days. The universe appreciates symmetry.`;
    },
  }),
  def({
    id: 'st-serial', title: 'Serial Streaker', category: C, rarity: 'uncommon', priority: 59,
    when: (c) => runsAtLeast(c, 5).length >= 3,
    msg: (c) => `${runsAtLeast(c, 5).length} separate streaks of five days or more are on record. Streaking is a repeatable process.`,
  }),
  def({
    id: 'st-average-length', title: 'Average Streak Length', category: C, priority: 45, minDays: 30,
    when: (c) => c.streaks.filter((r) => r.len >= 2).length >= 5,
    msg: (c) => {
      const lens = c.streaks.filter((r) => r.len >= 2).map((r) => r.len);
      return `Across ${lens.length} multi-day streaks, the average run lasts ${mean(lens).toFixed(1)} days.`;
    },
  }),
  def({
    id: 'st-getting-longer', title: 'Streaks Getting Longer', category: C, rarity: 'uncommon', priority: 57, minDays: 90,
    when: (c) => {
      const cut = addDays(c.todayKey, -60);
      const recent = c.streaks.filter((r) => r.startKey >= cut && r.len >= 2).map((r) => r.len);
      const older = c.streaks.filter((r) => r.startKey < cut && r.len >= 2).map((r) => r.len);
      return recent.length >= 2 && older.length >= 3 && mean(recent) >= mean(older) + 1;
    },
    msg: (c) => {
      const cut = addDays(c.todayKey, -60);
      const recent = c.streaks.filter((r) => r.startKey >= cut && r.len >= 2).map((r) => r.len);
      const older = c.streaks.filter((r) => r.startKey < cut && r.len >= 2).map((r) => r.len);
      return `Streaks in the last 60 days average ${mean(recent).toFixed(1)} days, up from ${mean(older).toFixed(1)} before that. The organization is maturing.`;
    },
  }),
  def({
    id: 'st-pending', title: 'Streak Status: Pending', category: C, priority: 73,
    when: (c) => c.todayCount === 0 && c.currentStreak >= 3,
    msg: (c) => `The ${c.currentStreak}-day streak is alive but today's movement is still pending. Operations is standing by.`,
  }),
  def({
    id: 'st-extended', title: 'Streak Extended', category: C, priority: 71,
    when: (c) => c.todayCount > 0 && c.currentStreak >= 2,
    msg: (c) => `Today's movement extended the streak to ${c.currentStreak} days. Keep the lights on.`,
  }),
  def({
    id: 'st-density', title: 'Streak Density', category: C, priority: 42, minDays: 30,
    when: (c) => c.poopDays >= 15,
    msg: (c) => {
      const inRuns = runsAtLeast(c, 3).reduce((a, r) => a + r.len, 0);
      return `${pct(inRuns / c.poopDays)} of your active days were part of a streak of three days or more. ${inRuns / c.poopDays >= 0.5 ? 'Momentum is your natural state.' : 'You prefer to operate in bursts.'}`;
    },
  }),
  def({
    id: 'st-lone-operators', title: 'Lone Operators', category: C, priority: 36, minDays: 30,
    when: (c) => c.streaks.filter((r) => r.len === 1).length >= 5,
    msg: (c) => `${c.streaks.filter((r) => r.len === 1).length} active days stood completely alone, with no movement the day before or after. Independent contractors.`,
  }),
  def({
    id: 'st-relentless', title: 'Relentless Throughput', category: C, rarity: 'legendary', priority: 90,
    when: (c) => c.streaks.some((r) => r.len >= 3 && runKeys(r).every((k) => countOn(c, k) >= 2)),
    msg: (c) => {
      const r = c.streaks.find((x) => x.len >= 3 && runKeys(x).every((k) => countOn(c, k) >= 2))!;
      return `Starting ${fmtDayShort(r.startKey)}, three or more consecutive days each had multiple movements. Relentless.`;
    },
  }),
  def({
    id: 'st-longest-throughput', title: 'Longest Streak Throughput', category: C, priority: 43,
    when: (c) => c.longestStreak >= 5,
    msg: (c) => {
      const r = c.streaks.find((x) => x.len === c.longestStreak)!;
      return `Your record ${r.len}-day streak produced ${plural(eventsIn(c, r), 'movement')} in total — ${(eventsIn(c, r) / r.len).toFixed(2)} per day.`;
    },
  }),
  def({
    id: 'st-near-seamless', title: 'Near-Seamless Operations', category: C, rarity: 'rare', priority: 64,
    when: (c) => c.gaps.some((g) => g.len === 1 && (c.streaks.find((r) => r.endKey === g.fromKey)?.len ?? 0) >= 5 && (c.streaks.find((r) => r.startKey === g.toKey)?.len ?? 0) >= 5),
    msg: (c) => {
      const g = c.gaps.filter((x) => x.len === 1 && (c.streaks.find((r) => r.endKey === x.fromKey)?.len ?? 0) >= 5 && (c.streaks.find((r) => r.startKey === x.toKey)?.len ?? 0) >= 5).pop()!;
      return `Two 5+ day streaks were separated by a single quiet day (${fmtDayShort(addDays(g.fromKey, 1))}). One day away from something enormous.`;
    },
  }),
  def({
    id: 'st-launch-day', title: 'Streak Launch Day', category: C, priority: 40, minDays: 45,
    when: (c) => {
      const counts = new Array(7).fill(0);
      for (const r of runsAtLeast(c, 3)) counts[weekdayOf(r.startKey)]++;
      const max = Math.max(...counts);
      return runsAtLeast(c, 3).length >= 4 && max >= 2 && counts.filter((x) => x === max).length === 1;
    },
    msg: (c) => {
      const counts = new Array(7).fill(0);
      for (const r of runsAtLeast(c, 3)) counts[weekdayOf(r.startKey)]++;
      const wd = counts.indexOf(Math.max(...counts));
      return `${wdName(wd)} is where streaks are born: ${counts[wd]} of your ${runsAtLeast(c, 3).length} streaks of 3+ days started on a ${wdName(wd)}.`;
    },
  }),
  def({
    id: 'st-rest-day', title: 'Where Streaks Go to Rest', category: C, priority: 38, minDays: 45,
    when: (c) => {
      const counts = new Array(7).fill(0);
      for (const r of completedRuns(c).filter((x) => x.len >= 3)) counts[weekdayOf(addDays(r.endKey, 1))]++;
      const max = Math.max(...counts);
      return completedRuns(c).filter((x) => x.len >= 3).length >= 4 && max >= 2 && counts.filter((x) => x === max).length === 1;
    },
    msg: (c) => {
      const counts = new Array(7).fill(0);
      for (const r of completedRuns(c).filter((x) => x.len >= 3)) counts[weekdayOf(addDays(r.endKey, 1))]++;
      const wd = counts.indexOf(Math.max(...counts));
      return `Streaks most often end on a ${wdName(wd)} (${counts[wd]} times the first quiet day was a ${wdName(wd)}). ${wdName(wd)} has been notified.`;
    },
  }),
  def({
    id: 'st-above-average', title: 'Above-Average Run', category: C, priority: 56, minDays: 30,
    when: (c) => {
      const lens = c.streaks.map((r) => r.len);
      return lens.length >= 5 && c.currentStreak >= 3 && c.currentStreak >= 2 * mean(lens);
    },
    msg: (c) => `The current ${c.currentStreak}-day streak is more than double your average run length of ${mean(c.streaks.map((r) => r.len)).toFixed(1)} days.`,
  }),
  def({
    id: 'st-leaderboard', title: 'Streak Leaderboard Climber', category: C, priority: 61, minDays: 30,
    when: (c) => {
      if (c.currentStreak < 3 || c.streaks.length < 5) return false;
      const rank = completedRuns(c).filter((r) => r.len > c.currentStreak).length + 1;
      return rank <= 3 && rank > 1;
    },
    msg: (c) => {
      const rank = completedRuns(c).filter((r) => r.len > c.currentStreak).length + 1;
      return `The current ${c.currentStreak}-day streak now ranks #${rank} all-time out of ${c.streaks.length} runs. Climbing the leaderboard.`;
    },
  }),
  def({
    id: 'st-clean-slate', title: 'Clean Slate Streak', category: C, rarity: 'uncommon', priority: 48,
    when: (c) => c.streaks.some((r) => r.len >= 5 && r.startKey.endsWith('-01')),
    msg: (c) => {
      const r = c.streaks.filter((x) => x.len >= 5 && x.startKey.endsWith('-01')).pop()!;
      return `A ${r.len}-day streak launched on the 1st of the month (${fmtDayShort(r.startKey)}). New month, new standards.`;
    },
  }),
  def({
    id: 'st-year-end-continuity', title: 'Year-End Continuity', category: C, rarity: 'legendary', priority: 80,
    when: (c) => c.streaks.some((r) => r.startKey.slice(0, 4) !== r.endKey.slice(0, 4)),
    msg: (c) => {
      const r = c.streaks.find((x) => x.startKey.slice(0, 4) !== x.endKey.slice(0, 4))!;
      return `A streak spanned New Year's, running from ${fmtDayShort(r.startKey)} into ${r.endKey.slice(0, 4)}. Operations did not pause for the fiscal year change.`;
    },
  }),
  def({
    id: 'st-best-this-year', title: 'Best Streak This Year', category: C, priority: 47, minDays: 60,
    when: (c) => {
      const y = String(c.now.getFullYear());
      const best = c.streaks.filter((r) => r.endKey.startsWith(y)).reduce((a, r) => Math.max(a, r.len), 0);
      return best >= 3 && best < c.longestStreak;
    },
    msg: (c) => {
      const y = String(c.now.getFullYear());
      const best = c.streaks.filter((r) => r.endKey.startsWith(y)).reduce((a, r) => Math.max(a, r.len), 0);
      return `The best streak of ${y} so far is ${best} days. The all-time record of ${c.longestStreak} remains in play.`;
    },
  }),
  def({
    id: 'st-streak-throughput', title: 'Streak Throughput', category: C, priority: 49,
    when: (c) => c.currentStreak >= 4,
    msg: (c) => `The current ${c.currentStreak}-day streak has produced ${plural(eventsIn(c, cur(c)!), 'movement')} so far. Throughput remains healthy.`,
  }),
  def({
    id: 'st-last-recap', title: 'Last Streak Recap', category: C, priority: 41,
    when: (c) => {
      const done = completedRuns(c);
      return done.length > 0 && done[done.length - 1].len >= 3;
    },
    msg: (c) => {
      const r = completedRuns(c)[completedRuns(c).length - 1];
      return `Your most recent completed streak ran ${r.len} days, ${fmtDayShort(r.startKey)} to ${fmtDayShort(r.endKey)}. It will be remembered fondly.`;
    },
  }),
  def({
    id: 'st-two-in-month', title: 'Double Streak Month', category: C, rarity: 'uncommon', priority: 45,
    when: (c) => c.months.some((m) => c.streaks.filter((r) => r.len >= 4 && r.startKey.startsWith(m.key) && r.endKey.startsWith(m.key)).length >= 2),
    msg: (c) => {
      const m = c.months.filter((x) => c.streaks.filter((r) => r.len >= 4 && r.startKey.startsWith(x.key) && r.endKey.startsWith(x.key)).length >= 2).pop()!;
      return `${fmtMonth(m.y, m.m)} contained two separate streaks of four days or more. Lightning struck twice.`;
    },
  }),
  def({
    id: 'st-quick-restart', title: 'Quick Restart', category: C, priority: 52,
    when: (c) => c.gaps.some((g) => g.len === 1 && (c.streaks.find((r) => r.endKey === g.fromKey)?.len ?? 0) >= 5),
    msg: (c) => {
      const g = c.gaps.filter((x) => x.len === 1 && (c.streaks.find((r) => r.endKey === x.fromKey)?.len ?? 0) >= 5).pop()!;
      return `When a ${c.streaks.find((r) => r.endKey === g.fromKey)!.len}-day streak ended, operations resumed after just one day off (${fmtDayShort(g.toKey)}). No long faces.`;
    },
  }),
  def({
    id: 'st-six-of-seven', title: 'Nearly Perfect Week', category: C, priority: 54,
    when: (c) => {
      const from = addDays(c.todayKey, c.todayCount > 0 ? -6 : -7);
      if (!c.firstKey || daysBetween(c.firstKey, from) < 0) return false;
      let n = 0;
      for (let i = 0; i < 7; i++) if (has(c, addDays(from, i))) n++;
      return n === 6;
    },
    msg: () => `Six of the last seven days delivered. One day short of perfect, which is still extremely good.`,
  }),
  def({
    id: 'st-portfolio', title: 'Streak Portfolio', category: C, priority: 37, minDays: 21,
    when: (c) => c.streaks.filter((r) => r.len >= 2).length >= 3,
    msg: (c) => {
      const s = c.streaks.filter((r) => r.len >= 2);
      return `Your streak portfolio holds ${s.length} multi-day runs totaling ${s.reduce((a, r) => a + r.len, 0)} days. Diversified and growing.`;
    },
  }),
  def({
    id: 'st-share-of-history', title: 'Streak Share of History', category: C, priority: 39, minDays: 30,
    when: (c) => c.longestStreak >= 4,
    msg: (c) => `Your longest streak alone covers ${pct(c.longestStreak / c.trackedDays)} of all tracked days (${c.longestStreak} of ${c.trackedDays}).`,
  }),
  def({
    id: 'st-bonus-rounds', title: 'Streak with Bonus Rounds', category: C, rarity: 'uncommon', priority: 53,
    when: (c) => !!cur(c) && runKeys(cur(c)!).filter((k) => countOn(c, k) >= 2).length >= 2,
    msg: (c) => `The current streak includes ${runKeys(cur(c)!).filter((k) => countOn(c, k) >= 2).length} multi-movement days. Not just consistent — generous.`,
  }),
  def({
    id: 'st-recent-streakiness', title: 'Recent Momentum', category: C, priority: 35, minDays: 21,
    when: (c) => lastN(c.streaks, 3).length === 3 && lastN(c.streaks, 3).every((r) => r.len >= 3),
    msg: (c) => `Your last three runs lasted ${lastN(c.streaks, 3).map((r) => r.len).join(', ')} days. Momentum is being carried from one streak to the next.`,
  }),
];
