// SUPPLY CHAIN — 35 authored insights about pauses between active days.
// Tone rule: pauses are logistics events, never health events. No diagnosis, ever.
import {
  def, fmtDayShort, plural, pct, wdName, weekdayOf, addDays, has, mean, stdev, lastN, cm, pctBelow,
  completedRuns, countOn, daysBetween, fmtMonth,
  type Ctx,
} from '../h';
import type { InsightDef } from '../types';

const C = 'drought' as const;
const gapLens = (c: Ctx) => c.gaps.map((g) => g.len);
const endedToday = (c: Ctx) => c.gaps.find((g) => g.toKey === c.todayKey) ?? null;

export const droughtInsights: InsightDef[] = [
  def({
    id: 'dr-standby', title: 'Standby Mode', category: C, priority: 56,
    when: (c) => c.todayCount === 0 && c.openGap === 1,
    msg: () => `Yesterday passed without a recorded movement. Operations have entered standby mode. This is routine.`,
  }),
  def({
    id: 'dr-current-pause', title: 'Supply Chain Disruption', category: C, priority: 64,
    when: (c) => c.todayCount === 0 && c.openGap >= 2,
    msg: (c) => `It has been ${plural(c.openGap, 'full day')} since the last movement (${fmtDayShort(c.lastKey!)}). ${c.gaps.length ? `Your typical pause lasts ${mean(gapLens(c)).toFixed(1)} days.` : 'This is the first pause on record.'} Logistics is monitoring the situation.`,
  }),
  def({
    id: 'dr-exec-notified', title: 'Executive Leadership Has Been Notified', category: C, rarity: 'uncommon', priority: 68,
    when: (c) => c.todayCount === 0 && c.openGap >= 3,
    msg: (c) => `Day ${c.openGap} of the current pause. Executive leadership has been briefed and is remaining calm. Snacks have been authorized.`,
  }),
  def({
    id: 'dr-uncharted-pause', title: 'Operations Temporarily Suspended', category: C, rarity: 'rare', priority: 70,
    when: (c) => c.todayCount === 0 && c.openGap >= 2 && c.openGap > c.longestGap && c.gaps.length > 0,
    msg: (c) => `This ${c.openGap}-day pause is now the longest in your recorded history (previous record: ${c.longestGap}). Operations are temporarily suspended. The Center remains fully staffed and ready.`,
  }),
  def({
    id: 'dr-longest-gap', title: 'Longest Supply Chain Disruption', category: C, priority: 48,
    when: (c) => c.longestGap >= 2,
    msg: (c) => {
      const g = c.gaps.find((x) => x.len === c.longestGap)!;
      return `The longest pause on record lasted ${c.longestGap} days, ending ${fmtDayShort(g.toKey)}. It was resolved. They always are.`;
    },
  }),
  def({
    id: 'dr-restored', title: 'Supply Chain Restored', category: C, priority: 85,
    when: (c) => (endedToday(c)?.len ?? 0) >= 2,
    msg: (c) => `After ${plural(endedToday(c)!.len, 'quiet day')}, today's movement has restored the supply chain. All systems nominal.`,
  }),
  def({
    id: 'dr-average-pause', title: 'Average Pause Length', category: C, priority: 44, minDays: 21,
    when: (c) => c.gaps.length >= 5,
    msg: (c) => `Across ${plural(c.gaps.length, 'pause')}, the average lasts ${mean(gapLens(c)).toFixed(1)} days. Pauses are short, and they end.`,
  }),
  def({
    id: 'dr-unusual-pause', title: 'Unusual Pause (By Your Standards)', category: C, rarity: 'uncommon', priority: 55, minDays: 30,
    when: (c) => {
      if (c.gaps.length < 6) return false;
      const prior = gapLens(c).slice(0, -1);
      const last = c.gaps[c.gaps.length - 1].len;
      return stdev(prior) > 0 && last > mean(prior) + 2 * stdev(prior);
    },
    msg: (c) => {
      const g = c.gaps[c.gaps.length - 1];
      return `The most recent pause (${g.len} days, ending ${fmtDayShort(g.toKey)}) was unusually long compared with your own typical ${mean(gapLens(c).slice(0, -1)).toFixed(1)} days. Compared only to you, of course.`;
    },
  }),
  def({
    id: 'dr-rapid-recovery', title: 'Rapid Recovery', category: C, priority: 46, minDays: 21,
    when: (c) => c.gaps.length >= 5 && c.gaps.filter((g) => g.len === 1).length / c.gaps.length >= 0.5,
    msg: (c) => `${pct(c.gaps.filter((g) => g.len === 1).length / c.gaps.length)} of all pauses lasted just a single day. Operations bounce back fast.`,
  }),
  def({
    id: 'dr-dramatic-comeback', title: 'Dramatic Comeback', category: C, rarity: 'rare', priority: 74,
    when: (c) => c.gaps.some((g) => g.len >= 2 && countOn(c, g.toKey) >= 2),
    msg: (c) => {
      const g = c.gaps.filter((x) => x.len >= 2 && countOn(c, x.toKey) >= 2).pop()!;
      return `After a ${g.len}-day pause, ${fmtDayShort(g.toKey)} delivered ${countOn(c, g.toKey)} movements in a single day. A dramatic comeback for the ages.`;
    },
  }),
  def({
    id: 'dr-pause-button-day', title: 'Pause Button Weekday', category: C, priority: 36, minDays: 42,
    when: (c) => {
      const counts = new Array(7).fill(0);
      for (const g of c.gaps) counts[weekdayOf(addDays(g.fromKey, 1))]++;
      const max = Math.max(...counts);
      return c.gaps.length >= 6 && max >= 3 && counts.filter((x) => x === max).length === 1;
    },
    msg: (c) => {
      const counts = new Array(7).fill(0);
      for (const g of c.gaps) counts[weekdayOf(addDays(g.fromKey, 1))]++;
      const wd = counts.indexOf(Math.max(...counts));
      return `Pauses most often begin on a ${wdName(wd)} (${counts[wd]} of ${c.gaps.length}). ${wdName(wd)} is when the Center takes a breather.`;
    },
  }),
  def({
    id: 'dr-restart-day', title: 'Restart Weekday', category: C, priority: 36, minDays: 42,
    when: (c) => {
      const counts = new Array(7).fill(0);
      for (const g of c.gaps) counts[weekdayOf(g.toKey)]++;
      const max = Math.max(...counts);
      return c.gaps.length >= 6 && max >= 3 && counts.filter((x) => x === max).length === 1;
    },
    msg: (c) => {
      const counts = new Array(7).fill(0);
      for (const g of c.gaps) counts[weekdayOf(g.toKey)]++;
      const wd = counts.indexOf(Math.max(...counts));
      return `When a pause ends, it usually ends on a ${wdName(wd)} (${counts[wd]} times). ${wdName(wd)} is your official restart day.`;
    },
  }),
  def({
    id: 'dr-gap-free-weekends', title: 'No Weekend Left Behind', category: C, rarity: 'uncommon', priority: 52, minDays: 42,
    when: (c) => {
      const sats = c.observed.filter((k) => weekdayOf(k) === 6 && c.observed.includes(addDays(k, 1)));
      return sats.length >= 6 && sats.every((k) => has(c, k) || has(c, addDays(k, 1)));
    },
    msg: (c) => `All ${c.observed.filter((k) => weekdayOf(k) === 6 && c.observed.includes(addDays(k, 1))).length} tracked weekends have had at least one movement. No weekend has gone unserved.`,
  }),
  def({
    id: 'dr-pause-frequency', title: 'Pause Frequency', category: C, priority: 34, minDays: 60,
    when: (c) => c.gaps.length >= 3,
    msg: (c) => `On average, the Center experiences ${((c.gaps.length / c.observed.length) * 30).toFixed(1)} pauses per 30 days.`,
  }),
  def({
    id: 'dr-zero-downtime', title: 'Zero Downtime', category: C, rarity: 'uncommon', priority: 72, minDays: 7,
    when: (c) => c.gaps.length === 0 && c.observed.length >= 7 && c.openGap === 0,
    msg: (c) => `${plural(c.observed.length, 'day')} of tracking and not a single day without a movement. 100% uptime.`,
  }),
  def({
    id: 'dr-most-recent-pause', title: 'Most Recent Pause', category: C, priority: 32,
    when: (c) => c.gaps.length > 0 && c.openGap === 0,
    msg: (c) => {
      const g = c.gaps[c.gaps.length - 1];
      return `The last pause lasted ${plural(g.len, 'day')} and ended on ${fmtDayShort(g.toKey)}. It is now a matter for the history books.`;
    },
  }),
  def({
    id: 'dr-incident-free', title: 'Days Without Incident', category: C, rarity: 'uncommon', priority: 58,
    when: (c) => {
      const g = [...c.gaps].reverse().find((x) => x.len >= 2);
      return !!g && c.openGap < 2 && daysBetween(g.toKey, c.todayKey) >= 14;
    },
    msg: (c) => {
      const g = [...c.gaps].reverse().find((x) => x.len >= 2)!;
      return `This facility has gone ${daysBetween(g.toKey, c.todayKey)} days without a multi-day pause. Please update the sign in the break room.`;
    },
  }),
  def({
    id: 'dr-taxonomy', title: 'Pause Taxonomy', category: C, priority: 33, minDays: 45,
    when: (c) => c.gaps.length >= 8,
    msg: (c) => {
      const one = c.gaps.filter((g) => g.len === 1).length;
      const two = c.gaps.filter((g) => g.len === 2).length;
      const more = c.gaps.length - one - two;
      return `Pause taxonomy: ${one} one-day, ${two} two-day, and ${more} longer. Filed and categorized, as is proper.`;
    },
  }),
  def({
    id: 'dr-shrinking', title: 'Pauses Getting Shorter', category: C, rarity: 'uncommon', priority: 50, minDays: 60,
    when: (c) => {
      const g = gapLens(c);
      return g.length >= 10 && mean(lastN(g, 5)) < mean(g.slice(0, -5)) - 0.4;
    },
    msg: (c) => {
      const g = gapLens(c);
      return `Your five most recent pauses averaged ${mean(lastN(g, 5)).toFixed(1)} days, down from ${mean(g.slice(0, -5)).toFixed(1)} previously. Efficiency gains across the supply chain.`;
    },
  }),
  def({
    id: 'dr-longer-intermissions', title: 'Longer Intermissions', category: C, priority: 38, minDays: 60,
    when: (c) => {
      const g = gapLens(c);
      return g.length >= 10 && mean(lastN(g, 5)) > mean(g.slice(0, -5)) + 0.4;
    },
    msg: (c) => {
      const g = gapLens(c);
      return `Recent intermissions have run a bit longer (${mean(lastN(g, 5)).toFixed(1)} days vs. ${mean(g.slice(0, -5)).toFixed(1)} historically). Operations are taking their time. Quality over quantity.`;
    },
  }),
  def({
    id: 'dr-record-pause-concluded', title: 'Record Pause Concluded', category: C, rarity: 'rare', priority: 88,
    when: (c) => !!endedToday(c) && endedToday(c)!.len >= 2 && endedToday(c)!.len === c.longestGap && c.gaps.length >= 2,
    msg: (c) => `Today ended the longest pause in recorded history (${endedToday(c)!.len} days). The Center is back online and would like to thank everyone for their patience.`,
  }),
  def({
    id: 'dr-pause-to-power', title: 'From Pause to Power', category: C, rarity: 'uncommon', priority: 60,
    when: (c) => c.gaps.some((g) => g.len >= 3 && (c.streaks.find((r) => r.startKey === g.toKey)?.len ?? 0) >= 5),
    msg: (c) => {
      const g = c.gaps.filter((x) => x.len >= 3 && (c.streaks.find((r) => r.startKey === x.toKey)?.len ?? 0) >= 5).pop()!;
      const r = c.streaks.find((x) => x.startKey === g.toKey)!;
      return `A ${g.len}-day pause was followed immediately by a ${r.len}-day streak. Rest, then dominate.`;
    },
  }),
  def({
    id: 'dr-back-in-business', title: 'Back in Business', category: C, priority: 62,
    when: (c) => c.todayCount > 0 && endedToday(c)?.len === 1,
    msg: () => `After a single quiet day, today's movement puts the Center back in business. Brief pause, fully resolved.`,
  }),
  def({
    id: 'dr-quiet-ledger', title: 'Quiet Day Ledger', category: C, priority: 30, minDays: 14,
    when: (c) => c.observed.length >= 14 && c.observed.length > c.poopDays,
    msg: (c) => `Of ${c.observed.length} tracked days, ${c.observed.length - c.poopDays} were quiet (${pct((c.observed.length - c.poopDays) / c.observed.length)}). Every good operation includes some downtime.`,
  }),
  def({
    id: 'dr-downtime-month', title: 'Downtime This Month', category: C, priority: 31,
    when: (c) => !!cm(c) && cm(c)!.observedDays >= 10,
    msg: (c) => {
      const m = cm(c)!;
      const obs = m.observedDays - (c.todayCount === 0 ? 1 : 0);
      return `Quiet days this month so far: ${Math.max(0, obs - m.poopDays)} of ${obs} fully observed days.`;
    },
  }),
  def({
    id: 'dr-one-day-ceiling', title: 'Never More Than One Day', category: C, rarity: 'rare', priority: 78, minDays: 30,
    when: (c) => c.observed.length >= 30 && c.longestGap <= 1 && c.openGap <= 1,
    msg: (c) => `In ${c.observed.length} days of tracking, there has never been a pause longer than a single day. That is an extraordinary supply chain.`,
  }),
  def({
    id: 'dr-gap-symmetry', title: 'Pause Symmetry', category: C, rarity: 'uncommon', priority: 40,
    when: (c) => c.gaps.some((g, i) => i > 0 && g.len >= 2 && c.gaps[i - 1].len === g.len),
    msg: (c) => {
      const i = c.gaps.findIndex((g, j) => j > 0 && g.len >= 2 && c.gaps[j - 1].len === g.len);
      return `Two consecutive pauses each lasted exactly ${c.gaps[i].len} days (ending ${fmtDayShort(c.gaps[i - 1].toKey)} and ${fmtDayShort(c.gaps[i].toKey)}). Suspiciously orderly.`;
    },
  }),
  def({
    id: 'dr-first-intermission', title: 'First Intermission', category: C, priority: 42,
    when: (c) => c.gaps.length > 0,
    msg: (c) => `The first pause in Center history came after ${fmtDayShort(c.gaps[0].fromKey)} and lasted ${plural(c.gaps[0].len, 'day')}. Every great enterprise has a first intermission.`,
  }),
  def({
    id: 'dr-longest-this-year', title: 'Longest Pause This Year', category: C, priority: 33, minDays: 90,
    when: (c) => {
      const y = String(c.now.getFullYear());
      const yr = c.gaps.filter((g) => g.toKey.startsWith(y));
      return yr.length >= 2 && Math.max(...yr.map((g) => g.len)) < c.longestGap;
    },
    msg: (c) => {
      const y = String(c.now.getFullYear());
      const best = Math.max(...c.gaps.filter((g) => g.toKey.startsWith(y)).map((g) => g.len));
      return `The longest pause of ${y} so far is ${plural(best, 'day')}, shorter than the all-time record of ${c.longestGap}. This year is running a tighter ship.`;
    },
  }),
  def({
    id: 'dr-pause-percentile', title: 'Pause Percentile', category: C, priority: 52, minDays: 21,
    when: (c) => c.todayCount === 0 && c.openGap >= 1 && c.gaps.length >= 5,
    msg: (c) => `The current pause (${plural(c.openGap, 'day')} so far) is longer than ${pct(pctBelow(gapLens(c), c.openGap))} of your past pauses. For context only; pauses always end.`,
  }),
  def({
    id: 'dr-pent-up-demand', title: 'Pent-Up Demand', category: C, rarity: 'uncommon', priority: 51,
    when: (c) => {
      const multi = c.days.filter((d) => d.count >= 2 && d.key !== c.firstKey);
      return multi.length >= 4 && multi.filter((d) => !has(c, addDays(d.key, -1))).length / multi.length >= 0.5;
    },
    msg: (c) => {
      const multi = c.days.filter((d) => d.count >= 2 && d.key !== c.firstKey);
      return `${pct(multi.filter((d) => !has(c, addDays(d.key, -1))).length / multi.length)} of your multi-movement days came right after a quiet day. Pent-up demand is a real market force.`;
    },
  }),
  def({
    id: 'dr-quiet-90', title: 'Recent Quiet Stretch', category: C, priority: 29, minDays: 90,
    when: (c) => c.gaps.some((g) => g.toKey >= addDays(c.todayKey, -90) && g.len >= 2),
    msg: (c) => {
      const recent = c.gaps.filter((g) => g.toKey >= addDays(c.todayKey, -90));
      const g = recent.reduce((a, b) => (b.len > a.len ? b : a));
      return `The longest pause in the last 90 days lasted ${g.len} days (ending ${fmtDayShort(g.toKey)}).`;
    },
  }),
  def({
    id: 'dr-uninterrupted-month', title: 'Uninterrupted Month-to-Date', category: C, rarity: 'uncommon', priority: 63,
    when: (c) => {
      const m = cm(c);
      if (!m || Number(c.todayKey.slice(8)) < 10) return false;
      const end = c.todayCount > 0 ? c.todayKey : addDays(c.todayKey, -1);
      for (let k = `${m.key}-01`; k <= end; k = addDays(k, 1)) if (!has(c, k)) return false;
      return true;
    },
    msg: (c) => `Every day of ${fmtMonth(c.now.getFullYear(), c.now.getMonth())} so far has delivered. The month is uninterrupted.`,
  }),
  def({
    id: 'dr-pause-to-play', title: 'Pause-to-Play Ratio', category: C, priority: 35, minDays: 45,
    when: (c) => c.gaps.length >= 5 && completedRuns(c).length >= 5,
    msg: (c) => `Your average streak lasts ${mean(c.streaks.map((r) => r.len)).toFixed(1)} days; your average pause ${mean(gapLens(c)).toFixed(1)}. Work-life balance, quantified.`,
  }),
  def({
    id: 'dr-brief-hiccups', title: 'Brief Hiccups', category: C, priority: 28, minDays: 60,
    when: (c) => c.gaps.filter((g) => g.len === 1).length >= 10,
    msg: (c) => `${c.gaps.filter((g) => g.len === 1).length} single-day pauses on record, the latest ending ${fmtDayShort(c.gaps.filter((g) => g.len === 1).pop()!.toKey)}. Barely worth mentioning, and yet here we are, mentioning them.`,
  }),
];
