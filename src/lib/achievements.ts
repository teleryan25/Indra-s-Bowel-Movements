// Achievements (separate from insights): 30 badges with explicit unlock rules.
// Conditions are pure functions of the analytics context; unlock dates are
// recorded by the app the first time a condition is observed to be true.
import type { Ctx } from './stats';
import { daypartOf } from './stats';
import { addDays, thanksgivingDay, weekdayOf } from './dates';

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** shown while locked; never spoils rare ones completely */
  hint: string;
  check: (c: Ctx) => boolean;
}

const has = (c: Ctx, k: string) => c.dayMap.has(k);
const cnt = (c: Ctx, k: string) => c.dayMap.get(k)?.count ?? 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'launch-day', icon: '🚀', title: 'Launch Day', description: 'First documented movement. The Center is open for business.', hint: 'Record your first movement.', check: (c) => c.n >= 1 },
  { id: 'warming-up', icon: '🥉', title: 'Warming Up', description: 'Three consecutive active days. A pattern emerges.', hint: 'Three days in a row.', check: (c) => c.longestStreak >= 3 },
  { id: 'regularity-royalty', icon: '👑', title: 'Regularity Royalty', description: 'Seven consecutive active days. Long may she reign.', hint: 'A full week in a row.', check: (c) => c.longestStreak >= 7 },
  { id: 'unstoppable', icon: '🔥', title: 'Unstoppable', description: 'Fourteen consecutive active days. Nothing can stop this.', hint: 'Two weeks in a row.', check: (c) => c.longestStreak >= 14 },
  { id: 'institution', icon: '🏛️', title: 'Institution', description: 'A 30-day streak. You are no longer a person. You are an institution.', hint: 'Thirty days in a row.', check: (c) => c.longestStreak >= 30 },
  { id: 'high-throughput', icon: '🚚', title: 'High Throughput', description: 'Multiple movements in one day. Capacity: proven.', hint: 'More than one in a day.', check: (c) => c.maxPerDay >= 2 },
  { id: 'hat-trick', icon: '🎩', title: 'Hat Trick', description: 'Three movements in a single day. Take a bow.', hint: 'Three in a day.', check: (c) => c.maxPerDay >= 3 },
  { id: 'quad-squad', icon: '🍀', title: 'Quad Squad', description: 'Four movements in one day. Logistics experts are baffled.', hint: 'Classified.', check: (c) => c.maxPerDay >= 4 },
  { id: 'surge-pricing', icon: '⚡', title: 'Surge Pricing', description: 'Multi-movement days back to back. Demand is exceptional.', hint: 'Classified.', check: (c) => c.days.some((d) => d.count >= 2 && cnt(c, addDays(d.key, 1)) >= 2) },
  { id: 'express-delivery', icon: '🚄', title: 'Express Delivery', description: 'Two movements within 30 minutes. Remarkable turnaround.', hint: 'Classified.', check: (c) => c.days.some((d) => d.events.some((e, i) => i > 0 && e.ts - d.events[i - 1].ts <= 30 * 60000)) },
  { id: 'operational-excellence', icon: '📈', title: 'Operational Excellence', description: 'Twenty active days in a single month.', hint: 'A very consistent month.', check: (c) => c.months.some((m) => m.poopDays >= 20) },
  { id: 'flawless-month', icon: '🏆', title: 'Flawless Month', description: 'A movement on every single day of a calendar month.', hint: 'A perfect month.', check: (c) => c.completeMonths.some((m) => m.poopDays === m.daysInMonth) },
  { id: 'perfect-week', icon: '🗓️', title: 'Perfect Week', description: 'Monday through Sunday, every day delivered.', hint: 'Monday to Sunday.', check: (c) => c.streaks.some((r) => {
    for (let i = 0; i + 6 < r.len; i++) if (weekdayOf(addDays(r.startKey, i)) === 1) return true;
    return false;
  }) },
  { id: 'weekend-warrior', icon: '🏖️', title: 'Weekend Warrior', description: 'Saturday and Sunday of the same weekend. No days off.', hint: 'Both days of a weekend.', check: (c) => c.days.some((d) => d.wd === 6 && has(c, addDays(d.key, 1))) },
  { id: 'full-rotation', icon: '🌈', title: 'Full Rotation', description: 'A movement on every day of the week at least once.', hint: 'Every weekday, eventually.', check: (c) => c.byWdDays.every((x) => x > 0) },
  { id: 'early-shipment', icon: '🌅', title: 'Early Shipment', description: 'A movement before 7 AM. The sun was barely up.', hint: 'Very early.', check: (c) => c.events.some((e) => e.hour >= 3 && e.hour < 7) },
  { id: 'night-shift', icon: '🌙', title: 'Night Shift', description: 'A movement after 10 PM. Overtime approved.', hint: 'Very late.', check: (c) => c.events.some((e) => e.hour >= 22 || e.hour < 3) },
  { id: 'midnight-run', icon: '🕛', title: 'Midnight Run', description: 'A movement within half an hour of midnight.', hint: 'Classified.', check: (c) => c.events.some((e) => e.mins >= 1410 || e.mins < 30) },
  { id: 'lunch-meeting', icon: '🥪', title: 'Lunch Meeting', description: 'A movement between noon and 1 PM. Very productive lunch.', hint: 'Around lunchtime.', check: (c) => c.events.some((e) => e.hour === 12) },
  { id: 'around-the-clock', icon: '🕰️', title: 'Around the Clock', description: 'Movements recorded in all five shifts: early, morning, afternoon, evening, night.', hint: 'Every time of day.', check: (c) => new Set(c.events.map((e) => daypartOf(e.mins))).size === 5 },
  { id: 'the-comeback', icon: '🦅', title: 'The Comeback', description: 'Back in action after a pause of three or more days.', hint: 'Classified.', check: (c) => c.gaps.some((g) => g.len >= 3) },
  { id: 'unsuperstitious', icon: '🐈‍⬛', title: 'Unsuperstitious', description: 'A movement on Friday the 13th.', hint: 'An unlucky date.', check: (c) => c.days.some((d) => d.d === 13 && d.wd === 5) },
  { id: 'holiday-spirit', icon: '🎄', title: 'Holiday Spirit', description: "A movement on New Year's Day, Valentine's Day, Halloween, Thanksgiving or Christmas.", hint: 'A special day.', check: (c) => c.days.some((d) => (d.m === 0 && d.d === 1) || (d.m === 1 && d.d === 14) || (d.m === 9 && d.d === 31) || (d.m === 11 && d.d === 25) || (d.m === 10 && d.d === thanksgivingDay(d.y))) },
  { id: 'first-full-month', icon: '📅', title: 'First Reporting Period', description: 'A complete calendar month tracked.', hint: 'Keep going for a whole month.', check: (c) => c.completeMonths.length >= 1 },
  { id: 'half-century', icon: '🥇', title: 'Half Century', description: 'Fifty documented movements.', hint: '50 movements.', check: (c) => c.n >= 50 },
  { id: 'nice', icon: '😏', title: 'Nice.', description: 'Sixty-nine documented movements. Nice.', hint: 'A certain number.', check: (c) => c.n >= 69 },
  { id: 'century-club', icon: '💯', title: 'Century Club', description: 'One hundred documented movements.', hint: '100 movements.', check: (c) => c.n >= 100 },
  { id: 'dedicated-analyst', icon: '📊', title: 'Dedicated Analyst', description: 'One hundred active days on record.', hint: '100 active days.', check: (c) => c.poopDays >= 100 },
  { id: 'year-of-service', icon: '🎂', title: 'One Year of Service', description: 'The Center has been operating for a full year.', hint: 'Time will tell.', check: (c) => c.trackedDays >= 365 },
  { id: 'infrastructure', icon: '🏗️', title: 'Infrastructure', description: 'Five hundred documented movements. You are critical infrastructure.', hint: 'A very large number.', check: (c) => c.n >= 500 },
];

export function unlockedIds(c: Ctx): string[] {
  return ACHIEVEMENTS.filter((a) => {
    try {
      return a.check(c);
    } catch {
      return false;
    }
  }).map((a) => a.id);
}
