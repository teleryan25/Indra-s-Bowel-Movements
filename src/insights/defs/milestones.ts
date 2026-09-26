// MILESTONES — 50 authored milestone insights. Each milestone gets its own copy.
import { def, fmtDayShort, plural, num, isWeekend, fullWeeks, cm, type Ctx } from '../h';
import { ACHIEVEMENTS, unlockedIds } from '../../lib/achievements';
import type { InsightDef, Rarity } from '../types';

const C = 'milestone' as const;
const nth = (c: Ctx, n: number) => c.events[n - 1];
const count = (n: number, id: string, title: string, rarity: Rarity, priority: number, text: (c: Ctx) => string) =>
  def({ id, title, category: C, rarity, priority, minEvents: n, when: (c) => c.n >= n, msg: text });

const monthsActive = (c: Ctx) => c.months.filter((m) => m.poopDays > 0).length;
const yearCount = (c: Ctx) => c.events.filter((e) => e.y === c.now.getFullYear()).length;
const isPal = (n: number) => String(n) === String(n).split('').reverse().join('');
const FIB = [89, 144, 233, 377, 610, 987, 1597];
const POW2 = [64, 128, 256, 512, 1024, 2048];

export const milestoneInsights: InsightDef[] = [
  count(1, 'ms-1', 'Movement #1', 'common', 90, (c) => `The first documented movement: ${fmtDayShort(nth(c, 1).key)}. Every empire begins somewhere.`),
  count(5, 'ms-5', 'Movement #5', 'common', 70, (c) => `Five documented movements. The fifth arrived ${fmtDayShort(nth(c, 5).key)}. The pilot program is a success.`),
  count(10, 'ms-10', 'Movement #10', 'common', 76, (c) => `Ten documented movements, the tenth on ${fmtDayShort(nth(c, 10).key)}. Double digits. The Center is no longer a startup.`),
  count(25, 'ms-25', 'Movement #25', 'uncommon', 78, (c) => `Movement #25 arrived on ${fmtDayShort(nth(c, 25).key)}. A quarter-century of documented excellence.`),
  count(50, 'ms-50', 'Movement #50', 'uncommon', 82, (c) => `Fifty documented movements (the 50th on ${fmtDayShort(nth(c, 50).key)}). The Center has reached its Series A.`),
  count(69, 'ms-69', 'Movement #69', 'rare', 94, (c) => `Movement #69 was recorded on ${fmtDayShort(nth(c, 69).key)}. The Intelligence Division reviewed this finding carefully and has only one word: nice.`),
  count(100, 'ms-100', 'Movement #100', 'rare', 92, (c) => `THE 100TH MOVEMENT. ${fmtDayShort(nth(c, 100).key)}, ${new Date(nth(c, 100).ts).getFullYear()}. A triple-digit milestone. The Center has entered the history books.`),
  count(150, 'ms-150', 'Movement #150', 'rare', 80, (c) => `Movement #150, recorded ${fmtDayShort(nth(c, 150).key)}. One hundred and fifty. The warehouse has been expanded twice.`),
  count(200, 'ms-200', 'Movement #200', 'rare', 84, (c) => `Two hundred documented movements as of ${fmtDayShort(nth(c, 200).key)}. Analysts have upgraded the Center to "strong buy."`),
  count(250, 'ms-250', 'Movement #250', 'rare', 84, (c) => `Movement #250 (${fmtDayShort(nth(c, 250).key)}). A quarter of a thousand. The number is getting hard to believe.`),
  count(300, 'ms-300', 'Movement #300', 'rare', 82, (c) => `Three hundred documented movements. The 300th arrived ${fmtDayShort(nth(c, 300).key)}. This is Sparta. (Of logistics.)`),
  count(365, 'ms-365', 'Movement #365', 'legendary', 90, (c) => `Movement #365, on ${fmtDayShort(nth(c, 365).key)}. One for every day of a year — though you did it on your own schedule.`),
  count(400, 'ms-400', 'Movement #400', 'rare', 80, (c) => `The 400th movement, recorded ${fmtDayShort(nth(c, 400).key)}. Four hundred. The Center's alumni network is vast.`),
  count(420, 'ms-420', 'Movement #420', 'legendary', 93, (c) => `Movement #420 arrived on ${fmtDayShort(nth(c, 420).key)}. The Intelligence Division is choosing to remain very professional about this. Very. Professional.`),
  count(500, 'ms-500', 'Movement #500', 'legendary', 95, (c) => `FIVE HUNDRED documented movements (the 500th on ${fmtDayShort(nth(c, 500).key)}). The Center is now considered critical infrastructure.`),
  count(600, 'ms-600', 'Movement #600', 'legendary', 82, (c) => `Movement #600 (${fmtDayShort(nth(c, 600).key)}). There is no longer any doubt: this is a lifelong commitment.`),
  count(750, 'ms-750', 'Movement #750', 'legendary', 90, (c) => `Seven hundred and fifty documented movements, as of ${fmtDayShort(nth(c, 750).key)}. Three-quarters of the way to a thousand. The finish line is visible from here.`),
  count(1000, 'ms-1000', 'Movement #1,000', 'legendary', 100, (c) => `ONE THOUSAND DOCUMENTED MOVEMENTS. The 1,000th arrived on ${fmtDayShort(nth(c, 1000).key)}, ${new Date(nth(c, 1000).ts).getFullYear()}. There will be a parade. There will not actually be a parade. But there should be.`),

  def({ id: 'ms-active-7', title: '7 Active Days', category: C, priority: 60, when: (c) => c.poopDays >= 7, msg: (c) => `Seven different days now have a documented movement, the seventh being ${fmtDayShort(c.days[6].key)}. A week's worth of operations.` }),
  def({ id: 'ms-active-30', title: '30 Active Days', category: C, rarity: 'uncommon', priority: 70, when: (c) => c.poopDays >= 30, msg: (c) => `Thirty active days on record, reached ${fmtDayShort(c.days[29].key)}. A month's worth of confirmed movement.` }),
  def({ id: 'ms-active-50', title: '50 Active Days', category: C, rarity: 'uncommon', priority: 72, when: (c) => c.poopDays >= 50, msg: (c) => `Fifty days with at least one movement, as of ${fmtDayShort(c.days[49].key)}. Fifty separate occasions of excellence.` }),
  def({ id: 'ms-active-100', title: '100 Active Days', category: C, rarity: 'rare', priority: 84, when: (c) => c.poopDays >= 100, msg: (c) => `One hundred active days, reached on ${fmtDayShort(c.days[99].key)}. That's one hundred days you showed up.` }),
  def({ id: 'ms-active-200', title: '200 Active Days', category: C, rarity: 'rare', priority: 82, when: (c) => c.poopDays >= 200, msg: (c) => `Two hundred active days, reached ${fmtDayShort(c.days[199].key)}. The Center has been busy.` }),
  def({ id: 'ms-active-365', title: '365 Active Days', category: C, rarity: 'legendary', priority: 94, when: (c) => c.poopDays >= 365, msg: (c) => `365 active days on record, the 365th being ${fmtDayShort(c.days[364].key)}. A full year's worth of days, each with a confirmed movement.` }),

  def({ id: 'ms-tracked-7', title: 'First Week of Operations', category: C, priority: 62, minDays: 7, when: (c) => c.trackedDays >= 7, msg: (c) => `The Bowel Operations Center has now been operating for ${plural(c.trackedDays, 'day')}. The first week is always the hardest. It's done.` }),
  def({ id: 'ms-tracked-30', title: 'Thirty Days of Operations', category: C, rarity: 'uncommon', priority: 68, minDays: 30, when: (c) => c.trackedDays >= 30, msg: (c) => `Thirty days since the Center opened (${fmtDayShort(c.firstKey!)}). Most apps are deleted within a week. This one is load-bearing.` }),
  def({ id: 'ms-tracked-90', title: 'First Quarter Complete', category: C, rarity: 'uncommon', priority: 74, minDays: 90, when: (c) => c.trackedDays >= 90, msg: (c) => `Ninety days of operations. The first quarter is in the books, with ${plural(c.n, 'movement')} documented.` }),
  def({ id: 'ms-tracked-180', title: 'Six Months of Operations', category: C, rarity: 'rare', priority: 80, minDays: 180, when: (c) => c.trackedDays >= 180, msg: (c) => `Half a year of operations. ${plural(c.n, 'movement')} documented since ${fmtDayShort(c.firstKey!)}. The Center is officially established.` }),
  def({ id: 'ms-tracked-500', title: 'Day 500', category: C, rarity: 'legendary', priority: 86, minDays: 500, when: (c) => c.trackedDays >= 500, msg: (c) => `Five hundred days since operations began. ${plural(c.poopDays, 'active day')} along the way. The Center has outlasted most corporate strategy decks.` }),
  def({ id: 'ms-tracked-1000', title: 'Day 1,000', category: C, rarity: 'legendary', priority: 96, minDays: 1000, when: (c) => c.trackedDays >= 1000, msg: (c) => `One thousand days of Bowel Operations. ${num(c.n)} movements. This is, without exaggeration, the most thoroughly documented digestive system in history.` }),

  def({ id: 'ms-months-3', title: 'Three Active Months', category: C, priority: 55, when: (c) => monthsActive(c) >= 3, msg: (c) => `Movements have been documented in ${monthsActive(c)} different calendar months. The Center is going quarterly.` }),
  def({ id: 'ms-months-6', title: 'Six Active Months', category: C, rarity: 'uncommon', priority: 64, when: (c) => monthsActive(c) >= 6, msg: (c) => `${monthsActive(c)} calendar months with documented activity. Half a year of monthly reports, all on file.` }),
  def({ id: 'ms-months-12', title: 'Twelve Active Months', category: C, rarity: 'rare', priority: 78, when: (c) => monthsActive(c) >= 12, msg: (c) => `A dozen calendar months with documented activity. ${monthsActive(c)} monthly reports and counting.` }),

  def({ id: 'ms-doubles-5', title: 'Five Multi-Movement Days', category: C, rarity: 'uncommon', priority: 62, when: (c) => c.multiDayCount >= 5, msg: (c) => `Five days with more than one movement. The fifth: ${fmtDayShort(c.days.filter((d) => d.count >= 2)[4].key)}. High-throughput is becoming routine.` }),
  def({ id: 'ms-doubles-10', title: 'Ten Multi-Movement Days', category: C, rarity: 'rare', priority: 70, when: (c) => c.multiDayCount >= 10, msg: () => `Ten high-throughput days are now on record. The loading dock has been widened.` }),
  def({ id: 'ms-doubles-25', title: 'Twenty-Five Multi-Movement Days', category: C, rarity: 'legendary', priority: 80, when: (c) => c.multiDayCount >= 25, msg: () => `Twenty-five multi-movement days. At this point, "high throughput" is just "throughput."` }),
  def({ id: 'ms-triples-3', title: 'Three Triples', category: C, rarity: 'rare', priority: 72, when: (c) => c.days.filter((d) => d.count >= 3).length >= 3, msg: (c) => `Three separate days have reached three or more movements, the third on ${fmtDayShort(c.days.filter((d) => d.count >= 3)[2].key)}. A triple-triple.` }),
  def({ id: 'ms-triples-10', title: 'Ten Triples', category: C, rarity: 'legendary', priority: 84, when: (c) => c.days.filter((d) => d.count >= 3).length >= 10, msg: () => `Ten triple-or-better days. The Intelligence Division has run out of superlatives and is now just staring at the chart.` }),

  def({ id: 'ms-achievements-5', title: 'Five Achievements', category: C, priority: 58, when: (c) => unlockedIds(c).length >= 5, msg: (c) => `${unlockedIds(c).length} achievements unlocked. The trophy cabinet is filling up.` }),
  def({ id: 'ms-achievements-10', title: 'Ten Achievements', category: C, rarity: 'uncommon', priority: 66, when: (c) => unlockedIds(c).length >= 10, msg: (c) => `${unlockedIds(c).length} of ${ACHIEVEMENTS.length} achievements unlocked. A second trophy cabinet has been ordered.` }),
  def({ id: 'ms-achievements-20', title: 'Twenty Achievements', category: C, rarity: 'rare', priority: 78, when: (c) => unlockedIds(c).length >= 20, msg: (c) => `${unlockedIds(c).length} achievements unlocked. You are now statistically among the most decorated people in this app.` }),
  def({ id: 'ms-achievements-all', title: 'Every Achievement', category: C, rarity: 'legendary', priority: 100, when: (c) => unlockedIds(c).length === ACHIEVEMENTS.length, msg: () => `Every single achievement has been unlocked. There is nothing left to prove. There never was. But you proved it anyway.` }),

  def({ id: 'ms-month-10', title: 'Double-Digit Month', category: C, priority: 52, when: (c) => (cm(c)?.events ?? 0) >= 10, msg: (c) => `This month has reached ${cm(c)!.events} movements. Double digits, and the month isn't over.` }),
  def({ id: 'ms-year-50', title: '50 This Year', category: C, rarity: 'uncommon', priority: 60, when: (c) => yearCount(c) >= 50, msg: (c) => `${yearCount(c)} movements so far in ${c.now.getFullYear()}. The annual target was never set, but it's being exceeded.` }),
  def({ id: 'ms-year-100', title: '100 This Year', category: C, rarity: 'rare', priority: 74, when: (c) => yearCount(c) >= 100, msg: (c) => `${c.now.getFullYear()} has crossed 100 documented movements (${yearCount(c)} and counting). Record-setting fiscal year.` }),
  def({ id: 'ms-weekend-50', title: 'Weekend Fifty', category: C, rarity: 'uncommon', priority: 54, when: (c) => c.events.filter((e) => isWeekend(e.wd)).length >= 50, msg: (c) => `${c.events.filter((e) => isWeekend(e.wd)).length} movements have now happened on weekends. Weekend operations have their own seniority.` }),
  def({ id: 'ms-morning-100', title: 'Morning Hundred', category: C, rarity: 'rare', priority: 62, when: (c) => c.events.filter((e) => e.hour < 12).length >= 100, msg: () => `One hundred movements before noon. The morning desk deserves a raise.` }),
  def({ id: 'ms-monday-25', title: 'Monday Veteran', category: C, rarity: 'uncommon', priority: 50, when: (c) => c.byWd[1] >= 25, msg: (c) => `${c.byWd[1]} movements have happened on Mondays. Most people just survive Mondays. You've been productive on them.` }),
  def({ id: 'ms-perfect-weeks-5', title: 'Perfect Week Collector', category: C, rarity: 'rare', priority: 76, when: (c) => fullWeeks(c).filter((w) => w.poopDays === 7).length >= 5, msg: (c) => `${fullWeeks(c).filter((w) => w.poopDays === 7).length} perfect weeks on record. Collect them all.` }),
  def({ id: 'ms-palindrome-total', title: 'Palindromic Total', category: C, rarity: 'rare', priority: 57, minEvents: 11, when: (c) => c.n >= 11 && isPal(c.n), msg: (c) => `Your lifetime total is currently ${num(c.n)} — a palindrome. It reads the same both ways. Savor it; it won't last.` }),
  def({ id: 'ms-fibonacci', title: 'Fibonacci Milestone', category: C, rarity: 'rare', priority: 58, minEvents: 89, when: (c) => FIB.includes(c.n), msg: (c) => `Your lifetime total is ${num(c.n)}, a Fibonacci number. Nature's favorite sequence, now featuring your bowels.` }),
  def({ id: 'ms-binary', title: 'Binary Milestone', category: C, rarity: 'rare', priority: 56, minEvents: 64, when: (c) => POW2.includes(c.n), msg: (c) => `Lifetime total: ${num(c.n)}, a perfect power of two. In binary that's 1 followed by ${Math.log2(c.n)} zeros. The engineers are very excited.` }),
];
