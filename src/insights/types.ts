import type { Ctx } from '../lib/stats';

export type Category =
  | 'time'
  | 'weekday'
  | 'monthly'
  | 'streak'
  | 'drought'
  | 'multi'
  | 'calendar'
  | 'stats'
  | 'milestone'
  | 'operations'
  | 'partnership';

export const CATEGORY_LABEL: Record<Category, string> = {
  time: 'Timing Intelligence',
  weekday: 'Weekday Analysis',
  monthly: 'Monthly Performance',
  streak: 'Streak Operations',
  drought: 'Supply Chain',
  multi: 'High Throughput',
  calendar: 'Calendar Anomalies',
  stats: 'Quantitative Research',
  milestone: 'Milestones',
  operations: 'Field Operations',
  partnership: 'Strategic Partnership',
};

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface InsightDef {
  /** stable, unique, never reused */
  id: string;
  title: string;
  category: Category;
  rarity: Rarity;
  /** 1–100, higher surfaces first when eligible */
  priority: number;
  /** minimum lifetime events before eligibility is even considered */
  minEvents: number;
  /** minimum tracked days (first movement → today) before eligibility is considered */
  minDays: number;
  /** is this finding currently true of Indra's data? */
  when: (c: Ctx) => boolean;
  /** the finding, computed from Indra's data */
  msg: (c: Ctx) => string;
}

export interface InsightInput {
  id: string;
  title: string;
  category: Category;
  rarity?: Rarity;
  priority?: number;
  minEvents?: number;
  minDays?: number;
  when: (c: Ctx) => boolean;
  msg: (c: Ctx) => string;
}
