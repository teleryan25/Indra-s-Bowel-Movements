// CALENDAR ANOMALIES — 45 authored insights about dates, holidays and coincidences.
// Only public, universal dates. No private dates are assumed or invented.
import {
  def, ordinal, fmtDayShort, plural, pct, onMonthDay, addDays, daysBetween, has, parseKey, cached,
  type Ctx, type DayRec,
} from '../h';
import { thanksgivingDay } from '../../lib/dates';
import type { InsightDef } from '../types';

const C = 'calendar' as const;
const latestOn = (c: Ctx, m: number, d: number): DayRec | null => onMonthDay(c, m, d).pop() ?? null;
const yearsOn = (c: Ctx, m: number, d: number) => onMonthDay(c, m, d).map((x) => x.y);
const holidayWhen = (m: number, d: number) => (c: Ctx) => onMonthDay(c, m, d).length > 0;

/** nth weekday (0=Sun) of a month, 1-based n. */
const nthWeekday = (y: number, m: number, wd: number, n: number) => {
  const first = new Date(y, m, 1).getDay();
  return 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
};
const firstSundayNov = (y: number) => nthWeekday(y, 10, 0, 1);
const secondSundayMar = (y: number) => nthWeekday(y, 2, 0, 2);
const laborDay = (y: number) => nthWeekday(y, 8, 1, 1);

/** Approximate moon phase in [0,1): 0 = new, 0.5 = full. Good to within about half a day. */
const moonPhase = (ts: number) => {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14);
  const days = (ts - ref) / 86400000;
  return (((days / synodic) % 1) + 1) % 1;
};
const fullMoonDays = (c: Ctx) =>
  cached(c, 'cal.fullmoon', () => c.days.filter((d) => {
    const noon = new Date(d.y, d.m, d.d, 12).getTime();
    return Math.abs(moonPhase(noon) - 0.5) < 0.017; // within ~half a day of full
  }));

const holidays: [string, number, number][] = [
  ["New Year's Day", 0, 1], ["Groundhog Day", 1, 2], ["Valentine's Day", 1, 14], ['Pi Day', 2, 14], ["St. Patrick's Day", 2, 17],
  ["April Fools' Day", 3, 1], ['Earth Day', 3, 22], ['Cinco de Mayo', 4, 5], ['Independence Day', 6, 4], ['Halloween', 9, 31],
  ['Christmas Eve', 11, 24], ['Christmas', 11, 25], ["New Year's Eve", 11, 31],
];
const holidayMulti = (c: Ctx) => {
  for (const d of c.days) {
    if (d.count < 2) continue;
    const h = holidays.find(([, m, dd]) => m === d.m && dd === d.d);
    if (h) return { d, name: h[0] };
    if (d.m === 10 && d.d === thanksgivingDay(d.y)) return { d, name: 'Thanksgiving' };
  }
  return null;
};

const monthsLater = (key: string, n: number) => {
  const { y, m, d } = parseKey(key);
  const t = new Date(y, m + n, d);
  return t.getDate() === d ? `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};

export const calendarInsights: InsightDef[] = [
  def({
    id: 'ca-first-of-month-club', title: 'First-of-the-Month Club', category: C, rarity: 'uncommon', priority: 47,
    when: (c) => c.days.filter((d) => d.d === 1).length >= 3,
    msg: (c) => `${c.days.filter((d) => d.d === 1).length} different months have opened with a movement on the 1st. Rent isn't the only thing due on the first.`,
  }),
  def({
    id: 'ca-month-end-close', title: 'Month-End Close Specialist', category: C, rarity: 'uncommon', priority: 47,
    when: (c) => c.days.filter((d) => d.d === new Date(d.y, d.m + 1, 0).getDate()).length >= 3,
    msg: (c) => `${c.days.filter((d) => d.d === new Date(d.y, d.m + 1, 0).getDate()).length} months have closed with a movement on their final day. Accounting loves a clean month-end close.`,
  }),
  def({
    id: 'ca-friday-13', title: 'Friday the 13th', category: C, rarity: 'rare', priority: 76,
    when: (c) => c.days.some((d) => d.d === 13 && d.wd === 5),
    msg: (c) => `A movement was confirmed on Friday the 13th (${fmtDayShort(c.days.filter((d) => d.d === 13 && d.wd === 5).pop()!.key)}). Superstition has no jurisdiction over logistics.`,
  }),
  def({
    id: 'ca-leap-day', title: 'Leap Day Delivery', category: C, rarity: 'legendary', priority: 95,
    when: holidayWhen(1, 29),
    msg: (c) => `A movement on February 29, ${latestOn(c, 1, 29)!.y}. This date only exists once every four years, and you made it count.`,
  }),
  def({
    id: 'ca-new-years-day', title: 'First Movement of the New Year', category: C, rarity: 'rare', priority: 82,
    when: holidayWhen(0, 1),
    msg: (c) => `Movement confirmed on New Year's Day ${yearsOn(c, 0, 1).join(' and ')}. Starting the year the way you mean to go on.`,
  }),
  def({
    id: 'ca-groundhog', title: 'Groundhog Day', category: C, rarity: 'rare', priority: 70,
    when: holidayWhen(1, 2),
    msg: () => `A movement was recorded on Groundhog Day. Unlike the groundhog, you did not retreat back inside.`,
  }),
  def({
    id: 'ca-valentines', title: "Valentine's Day Delivery", category: C, rarity: 'rare', priority: 80,
    when: holidayWhen(1, 14),
    msg: (c) => `Movement confirmed on Valentine's Day ${latestOn(c, 1, 14)!.y}. Love is patient, love is kind, love is regular.`,
  }),
  def({
    id: 'ca-pi-day', title: 'Pi Day', category: C, rarity: 'rare', priority: 68,
    when: holidayWhen(2, 14),
    msg: () => `A movement on March 14th — Pi Day. 3.14159... movements, rounded to the nearest whole number.`,
  }),
  def({
    id: 'ca-ides-of-march', title: 'The Ides of March', category: C, rarity: 'rare', priority: 64,
    when: holidayWhen(2, 15),
    msg: () => `A movement on the Ides of March. Julius Caesar had a considerably worse day.`,
  }),
  def({
    id: 'ca-st-patricks', title: "St. Patrick's Day", category: C, rarity: 'rare', priority: 66,
    when: holidayWhen(2, 17),
    msg: () => `Movement confirmed on St. Patrick's Day. The luck of the Irish extends to outbound logistics.`,
  }),
  def({
    id: 'ca-april-fools', title: "April Fools' Day", category: C, rarity: 'rare', priority: 70,
    when: holidayWhen(3, 1),
    msg: () => `A movement on April Fools' Day. The Intelligence Division has verified it is not a prank.`,
  }),
  def({
    id: 'ca-tax-day', title: 'Filed on Tax Day', category: C, rarity: 'rare', priority: 62,
    when: holidayWhen(3, 15),
    msg: () => `Something was filed on April 15th, Tax Day. It was not taxes, but it was on time.`,
  }),
  def({
    id: 'ca-earth-day', title: 'Earth Day', category: C, rarity: 'rare', priority: 64,
    when: holidayWhen(3, 22),
    msg: () => `A movement on Earth Day. Returning resources to the planet, as nature intended.`,
  }),
  def({
    id: 'ca-may-fourth', title: 'May the Fourth', category: C, rarity: 'rare', priority: 66,
    when: holidayWhen(4, 4),
    msg: () => `A movement on May 4th. The Force was with you.`,
  }),
  def({
    id: 'ca-cinco-de-mayo', title: 'Cinco de Mayo', category: C, rarity: 'rare', priority: 62,
    when: holidayWhen(4, 5),
    msg: () => `Movement confirmed on Cinco de Mayo. ¡Felicidades al departamento de logística!`,
  }),
  def({
    id: 'ca-halftime', title: 'Halftime Show', category: C, rarity: 'rare', priority: 60,
    when: holidayWhen(6, 2),
    msg: () => `A movement on July 2nd, the exact midpoint of the year. The halftime show went off without a hitch.`,
  }),
  def({
    id: 'ca-independence-day', title: 'Independence Day', category: C, rarity: 'rare', priority: 70,
    when: holidayWhen(6, 4),
    msg: () => `Movement confirmed on the Fourth of July. Declaring independence from whatever was in there.`,
  }),
  def({
    id: 'ca-labor-day', title: 'Worked on Labor Day', category: C, rarity: 'rare', priority: 62,
    when: (c) => c.days.some((d) => d.m === 8 && d.d === laborDay(d.y)),
    msg: () => `A movement on Labor Day. Everyone else got the day off. Operations did not.`,
  }),
  def({
    id: 'ca-halloween', title: 'Halloween', category: C, rarity: 'rare', priority: 74,
    when: holidayWhen(9, 31),
    msg: (c) => `A movement on Halloween ${latestOn(c, 9, 31)!.y}. Trick or treat? The Intelligence Division is choosing "treat."`,
  }),
  def({
    id: 'ca-world-toilet-day', title: 'World Toilet Day (Yes, Really)', category: C, rarity: 'legendary', priority: 88,
    when: holidayWhen(10, 19),
    msg: () => `November 19th is World Toilet Day, a real United Nations observance. You observed it. Professionally.`,
  }),
  def({
    id: 'ca-thanksgiving', title: 'Thanksgiving Operations', category: C, rarity: 'rare', priority: 78,
    when: (c) => c.days.some((d) => d.m === 10 && d.d === thanksgivingDay(d.y)),
    msg: () => `A movement on Thanksgiving. The Center is thankful for many things. This is one of them.`,
  }),
  def({
    id: 'ca-black-friday', title: 'Black Friday', category: C, rarity: 'rare', priority: 66,
    when: (c) => c.days.some((d) => d.m === 10 && d.d === thanksgivingDay(d.y) + 1),
    msg: () => `A movement on Black Friday. The biggest shipping day of the year, and you participated.`,
  }),
  def({
    id: 'ca-christmas-eve', title: 'Christmas Eve', category: C, rarity: 'rare', priority: 72,
    when: holidayWhen(11, 24),
    msg: () => `A movement on Christmas Eve. Santa isn't the only one making deliveries tonight.`,
  }),
  def({
    id: 'ca-christmas', title: 'Christmas Delivery', category: C, rarity: 'rare', priority: 82,
    when: holidayWhen(11, 25),
    msg: (c) => `Movement confirmed on Christmas Day ${latestOn(c, 11, 25)!.y}. A Christmas miracle, logistically speaking.`,
  }),
  def({
    id: 'ca-boxing-day', title: 'Boxing Day', category: C, rarity: 'rare', priority: 60,
    when: holidayWhen(11, 26),
    msg: () => `A movement on Boxing Day. Something was, in fact, unboxed.`,
  }),
  def({
    id: 'ca-new-years-eve', title: "New Year's Eve", category: C, rarity: 'rare', priority: 74,
    when: holidayWhen(11, 31),
    msg: () => `A movement on New Year's Eve. Closing out the year with no outstanding deliveries.`,
  }),
  def({
    id: 'ca-repeating-date', title: 'Repeating Date', category: C, rarity: 'uncommon', priority: 55,
    when: (c) => c.days.some((d) => d.m + 1 === d.d),
    msg: (c) => {
      const d = c.days.filter((x) => x.m + 1 === x.d).pop()!;
      return `A movement on ${d.m + 1}/${d.d}. Month and day, perfectly matched. The Intelligence Division enjoys a tidy date.`;
    },
  }),
  def({
    id: 'ca-palindrome-date', title: 'Palindrome Date', category: C, rarity: 'legendary', priority: 84,
    when: (c) => c.days.some((d) => { const s = d.key.replace(/-/g, ''); return s === s.split('').reverse().join(''); }),
    msg: (c) => {
      const d = c.days.find((x) => { const s = x.key.replace(/-/g, ''); return s === s.split('').reverse().join(''); })!;
      return `${d.key.replace(/-/g, '')}: a movement on a palindrome date. It reads the same in both directions. So does excellence.`;
    },
  }),
  def({
    id: 'ca-multiplication-date', title: 'Multiplication Date', category: C, rarity: 'rare', priority: 66,
    when: (c) => c.days.some((d) => (d.m + 1) * d.d === d.y % 100),
    msg: (c) => {
      const d = c.days.filter((x) => (x.m + 1) * x.d === x.y % 100).pop()!;
      return `A movement on ${d.m + 1}/${d.d}/${String(d.y % 100).padStart(2, '0')}: ${d.m + 1} × ${d.d} = ${d.y % 100}. A multiplication date. Math is beautiful.`;
    },
  }),
  def({
    id: 'ca-same-date-diff-year', title: 'Same Date, Different Year', category: C, rarity: 'rare', priority: 72, minDays: 366,
    when: (c) => c.days.some((d) => has(c, `${d.y + 1}${d.key.slice(4)}`)),
    msg: (c) => {
      const d = c.days.filter((x) => has(c, `${x.y + 1}${x.key.slice(4)}`)).pop()!;
      return `${fmtDayShort(d.key)} delivered in both ${d.y} and ${d.y + 1}. This date has a track record.`;
    },
  }),
  def({
    id: 'ca-ordinal-alignment', title: 'Ordinal Alignment', category: C, rarity: 'rare', priority: 67,
    when: (c) => c.events.some((e) => e.ordinal === e.d && e.ordinal >= 5),
    msg: (c) => {
      const e = c.events.filter((x) => x.ordinal === x.d && x.ordinal >= 5).pop()!;
      return `Your ${ordinal(e.ordinal)} documented movement happened on the ${ordinal(e.d)} of the month. The numbers aligned.`;
    },
  }),
  def({
    id: 'ca-first-anniversary', title: 'One Year of Operations', category: C, rarity: 'legendary', priority: 97,
    when: (c) => !!c.firstKey && has(c, `${Number(c.firstKey.slice(0, 4)) + 1}${c.firstKey.slice(4)}`),
    msg: (c) => `Exactly one year after the very first recorded movement (${fmtDayShort(c.firstKey!)}), operations delivered again on the anniversary. Happy anniversary to the Bowel Operations Center.`,
  }),
  def({
    id: 'ca-half-year', title: 'Half-Year Anniversary', category: C, rarity: 'rare', priority: 80,
    when: (c) => !!c.firstKey && !!monthsLater(c.firstKey, 6) && has(c, monthsLater(c.firstKey, 6)!),
    msg: (c) => `Six months to the day after the first recorded movement, operations delivered again (${fmtDayShort(monthsLater(c.firstKey!, 6)!)}). Half a year of excellence.`,
  }),
  def({
    id: 'ca-day-100', title: 'Day 100', category: C, rarity: 'rare', priority: 83,
    when: (c) => !!c.firstKey && has(c, addDays(c.firstKey, 99)),
    msg: (c) => `Day 100 of the Bowel Operations Center (${fmtDayShort(addDays(c.firstKey!, 99))}) featured a movement. The first hundred days are always the most important.`,
  }),
  def({
    id: 'ca-one-orbit', title: 'One Full Orbit', category: C, rarity: 'legendary', priority: 90,
    when: (c) => c.trackedDays >= 365,
    msg: (c) => `The Earth has completed a full orbit of the Sun since tracking began on ${fmtDayShort(c.firstKey!)}. In that time: ${plural(c.n, 'movement')}. The Earth did nothing comparable.`,
  }),
  def({
    id: 'ca-solstice', title: 'Solstice Service', category: C, rarity: 'rare', priority: 62,
    when: (c) => onMonthDay(c, 5, 21).length > 0 || onMonthDay(c, 11, 21).length > 0,
    msg: (c) => `A movement on the ${onMonthDay(c, 5, 21).length ? 'summer' : 'winter'} solstice${onMonthDay(c, 5, 21).length && onMonthDay(c, 11, 21).length ? ' (and the winter one too)' : ''}. The Earth tilted. You delivered.`,
  }),
  def({
    id: 'ca-equinox', title: 'Equinox Balance', category: C, rarity: 'rare', priority: 60,
    when: (c) => onMonthDay(c, 2, 20).length > 0 || onMonthDay(c, 8, 22).length > 0,
    msg: () => `A movement on the equinox, when day and night are equal. Perfect balance, as all things should be.`,
  }),
  def({
    id: 'ca-dst', title: 'Clock Change Resilience', category: C, rarity: 'rare', priority: 63,
    when: (c) => c.days.some((d) => (d.m === 2 && d.d === secondSundayMar(d.y)) || (d.m === 10 && d.d === firstSundayNov(d.y))),
    msg: () => `A movement on a daylight-saving clock-change day. The clocks moved. Operations did not care.`,
  }),
  def({
    id: 'ca-twelve-months', title: 'Twelve Months of Service', category: C, rarity: 'legendary', priority: 86,
    when: (c) => new Set(c.days.map((d) => d.m)).size === 12,
    msg: () => `Movements have now been recorded in every calendar month, January through December. The Center is a year-round institution.`,
  }),
  def({
    id: 'ca-full-calendar', title: 'Full Calendar Coverage', category: C, rarity: 'legendary', priority: 87,
    when: (c) => new Set(c.days.map((d) => d.d)).size === 31,
    msg: () => `Every date from the 1st to the 31st has now hosted at least one movement. The calendar has been fully collected.`,
  }),
  def({
    id: 'ca-odd-even', title: 'Odd Dates Preferred', category: C, priority: 38, minDays: 45,
    when: (c) => c.poopDays >= 30 && Math.abs(c.days.filter((d) => d.d % 2 === 1).length / c.poopDays - 0.5) >= 0.1,
    msg: (c) => {
      const odd = c.days.filter((d) => d.d % 2 === 1).length / c.poopDays;
      return `${pct(Math.max(odd, 1 - odd))} of active days fall on ${odd > 0.5 ? 'odd' : 'even'}-numbered dates. There is no explanation for this. There doesn't need to be.`;
    },
  }),
  def({
    id: 'ca-full-moon', title: 'Full Moon Operations', category: C, rarity: 'rare', priority: 64,
    when: (c) => fullMoonDays(c).length > 0,
    msg: (c) => `${plural(fullMoonDays(c).length, 'movement day')} coincided with a full moon, most recently ${fmtDayShort(fullMoonDays(c)[fullMoonDays(c).length - 1].key)}. Werewolves were unavailable for comment.`,
  }),
  def({
    id: 'ca-lunar-cycle', title: 'Lunar Cycle Complete', category: C, rarity: 'uncommon', priority: 52,
    when: (c) => c.trackedDays >= 30,
    msg: (c) => `Tracking has now spanned ${(c.trackedDays / 29.530588853).toFixed(1)} lunar cycles. The moon has been watching the whole time.`,
  }),
  def({
    id: 'ca-calendar-collection', title: 'Calendar Collection', category: C, rarity: 'rare', priority: 58, minDays: 150,
    when: (c) => new Set(c.days.map((d) => d.key.slice(5))).size >= 100,
    msg: (c) => `Movements have been recorded on ${new Set(c.days.map((d) => d.key.slice(5))).size} distinct dates of the year. The collection is ${pct(new Set(c.days.map((d) => d.key.slice(5))).size / 366)} complete.`,
  }),
  def({
    id: 'ca-holiday-double', title: 'Holiday Double Feature', category: C, rarity: 'legendary', priority: 85,
    when: (c) => !!holidayMulti(c),
    msg: (c) => {
      const h = holidayMulti(c)!;
      return `${h.name} ${h.d.y} featured ${h.d.count} movements. A holiday double feature. Festive throughput.`;
    },
  }),
  def({
    id: 'ca-programmers-day', title: "Programmers' Day", category: C, rarity: 'rare', priority: 55,
    when: (c) => c.days.some((d) => daysBetween(`${d.y}-01-01`, d.key) === 255),
    msg: (c) => {
      const d = c.days.filter((x) => daysBetween(`${x.y}-01-01`, x.key) === 255).pop()!;
      return `${fmtDayShort(d.key)} was the 256th day of ${d.y} — Programmers' Day, a real observance. The engineers who built this Center salute you.`;
    },
  }),
];
