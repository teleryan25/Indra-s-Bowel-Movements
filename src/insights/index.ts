// The Bowel Intelligence Division's authored library: exactly 500 insight definitions.
import type { InsightDef } from './types';
import { timeInsights } from './defs/time';
import { weekdayInsights } from './defs/weekday';
import { monthlyInsights } from './defs/monthly';
import { streakInsights } from './defs/streak';
import { droughtInsights } from './defs/drought';
import { multiInsights } from './defs/multi';
import { calendarInsights } from './defs/calendar';
import { statsInsights } from './defs/stats';
import { milestoneInsights } from './defs/milestones';
import { operationsInsights } from './defs/operations';
import { partnershipInsights } from './defs/partnership';

export const INSIGHTS: InsightDef[] = [
  ...operationsInsights,
  ...timeInsights,
  ...weekdayInsights,
  ...monthlyInsights,
  ...streakInsights,
  ...droughtInsights,
  ...multiInsights,
  ...calendarInsights,
  ...statsInsights,
  ...milestoneInsights,
  ...partnershipInsights,
];

export const INSIGHT_COUNT = INSIGHTS.length;
export * from './types';
